import { defineStore } from 'pinia'
import { ref, computed, nextTick } from 'vue'
import { supabase } from '../lib/supabase'
import { readWorkbook, mapRows, TRANSMITTAL_FIELDS, BORROWED_FIELDS } from '../utils/excel'
import { validateImportRow } from '../utils/validators'

export const useImportsStore = defineStore('imports', () => {
  const fileName = ref('')
  const sheets = ref([])
  const selectedSheetNames = ref([])
  const sheetConfigs = ref({})
  const previewRows = ref([])
  const loading = ref(false)
  const saving = ref(false)
  const importSummary = ref(null)

  // Progress tracking
  const progressLabel = ref('')
  const progressCurrent = ref(0)
  const progressTotal = ref(0)
  const progressPercent = computed(() =>
    progressTotal.value > 0 ? Math.round((progressCurrent.value / progressTotal.value) * 100) : 0
  )

  async function loadFile(file) {
    loading.value = true
    fileName.value = file.name
    const parsed = await readWorkbook(file)
    sheets.value = parsed
    selectedSheetNames.value = parsed.map((s) => s.sheetName)
    sheetConfigs.value = {}
    parsed.forEach((s) => {
      sheetConfigs.value[s.sheetName] = {
        targetModule: 'transmittal',
        mapping: autoMapColumns(s.headers, 'transmittal'),
      }
    })
    loading.value = false
  }

  async function generatePreview() {
    // Count total rows first for progress
    let totalRows = 0
    for (const sheetName of selectedSheetNames.value) {
      const sheet = sheets.value.find((s) => s.sheetName === sheetName)
      if (sheet) totalRows += sheet.rows.length
    }

    progressLabel.value = 'Generating preview…'
    progressCurrent.value = 0
    progressTotal.value = totalRows

    const allRows = []
    const CHUNK = 50 // rows per batch before yielding

    for (const sheetName of selectedSheetNames.value) {
      const sheet = sheets.value.find((s) => s.sheetName === sheetName)
      if (!sheet) continue
      const config = sheetConfigs.value[sheetName]
      if (!config) continue
      const baseModule = config.targetModule.replace('archive_', '')

      // Process in batches — map + validate a chunk at a time, then yield
      for (let start = 0; start < sheet.rows.length; start += CHUNK) {
        const batchRows = sheet.rows.slice(start, start + CHUNK)
        const mapped = mapRows(batchRows, sheet.headers, config.mapping)

        for (const row of mapped) {
          const validation = validateImportRow(row, baseModule)
          allRows.push({
            ...row,
            _sheetName: sheetName,
            _targetModule: config.targetModule,
            _valid: validation.valid,
            _errors: validation.errors,
            _duplicate: null,
            _duplicateDecision: 'create',
          })
          progressCurrent.value++
        }

        // Flush Vue reactivity + yield to browser paint after every batch
        await nextTick()
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    }

    previewRows.value = allRows
    progressLabel.value = ''
    progressCurrent.value = 0
    progressTotal.value = 0
  }

  /**
   * Check each valid row for existing duplicates using bulk DB queries.
   * 3 queries total regardless of row count:
   *  1. Fetch all clients
   *  2. Fetch all accounts for matched clients
   *  3. One records query using all collected client+account id pairs
   */
  async function checkDuplicates() {
    const validRows = previewRows.value.filter((r) => r._valid)
    progressLabel.value = 'Checking duplicates…'
    progressCurrent.value = 0
    progressTotal.value = validRows.length

    // ── Step 1: resolve client names → IDs in bulk ───────────────────
    const uniqueClientNames = [...new Set(
      validRows.map((r) => r.client_name?.toString().trim().toLowerCase()).filter(Boolean)
    )]

    // Fetch all clients and filter in memory to avoid .in() 1000-row limit issues
    const allClientsForDupe = await (async () => {
      const PAGE = 1000
      let from = 0, all = []
      while (true) {
        const { data } = await supabase.from('clients').select('id, name').range(from, from + PAGE - 1)
        if (!data?.length) break
        all = all.concat(data)
        if (data.length < PAGE) break
        from += PAGE
      }
      return all
    })()

    const clientMap = new Map()
    for (const c of allClientsForDupe) {
      if (uniqueClientNames.includes(c.name.toLowerCase())) {
        clientMap.set(c.name.toLowerCase(), c.id)
      }
    }

    // ── Step 2: resolve account numbers → IDs in bulk ────────────────
    const clientIds = [...new Set([...clientMap.values()])]
    const accountRows = clientIds.length ? await (async () => {
      const PAGE = 1000
      let from = 0, all = []
      while (true) {
        const { data } = await supabase
          .from('client_accounts').select('id, client_id, account_number')
          .in('client_id', clientIds)
          .range(from, from + PAGE - 1)
        if (!data?.length) break
        all = all.concat(data)
        if (data.length < PAGE) break
        from += PAGE
      }
      return all
    })() : []

    const accountMap = new Map()
    for (const a of accountRows) accountMap.set(`${a.client_id}::${a.account_number}`, a.id)

    // ── Step 3: collect all (client_id, account_id) pairs ────────────
    const pairSet = new Set()
    for (const row of validRows) {
      const clientId  = clientMap.get(row.client_name?.toString().trim().toLowerCase())
      const accountNum = (row.client_account_id || '').toString().trim() || 'N/A'
      const accountId = clientId ? accountMap.get(`${clientId}::${accountNum}`) : null
      if (clientId && accountId) pairSet.add(`${clientId}::${accountId}`)
    }

    // ── Step 4: one bulk query for existing records ───────────────────
    const allClientIds  = [...new Set([...pairSet].map((p) => Number(p.split('::')[0])))]
    const allAccountIds = [...new Set([...pairSet].map((p) => Number(p.split('::')[1])))]

    const module = validRows[0]?._targetModule?.replace('archive_', '') ?? 'transmittal'
    const isArchive = validRows[0]?._targetModule?.startsWith('archive_') ?? false

    let existingRecords = []
    if (allClientIds.length > 0) {
      const { data } = await supabase
        .from('records')
        .select('id, client_id, client_account_id, date_released, module, is_archived')
        .in('client_id', allClientIds)
        .in('client_account_id', allAccountIds)
        .eq('module', module)
        .eq('is_archived', isArchive)
      existingRecords = data || []
    }

    // Build lookup: `${clientId}::${accountId}::${date}` → record
    const existingMap = new Map()
    for (const rec of existingRecords) {
      const dateKey = rec.date_released || 'null'
      existingMap.set(`${rec.client_id}::${rec.client_account_id}::${dateKey}`, rec)
      // also index without date for fallback
      if (!existingMap.has(`${rec.client_id}::${rec.client_account_id}`)) {
        existingMap.set(`${rec.client_id}::${rec.client_account_id}`, rec)
      }
    }

    // ── Step 5: match rows against the map ───────────────────────────
    for (const row of previewRows.value) {
      if (!row._valid) continue

      const clientId   = clientMap.get(row.client_name?.toString().trim().toLowerCase())
      const accountNum = (row.client_account_id || '').toString().trim() || 'N/A'
      const accountId  = clientId ? accountMap.get(`${clientId}::${accountNum}`) : null

      if (!clientId || !accountId) {
        row._duplicate = null
        row._duplicateDecision = 'create'
        progressCurrent.value++
        continue
      }

      const dateKey = row.date_released ? formatDateForDB(row.date_released) : 'null'
      const match =
        existingMap.get(`${clientId}::${accountId}::${dateKey}`) ||
        (dateKey === 'null' ? existingMap.get(`${clientId}::${accountId}`) : null)

      if (match) {
        row._duplicate = match
        row._duplicateDecision = 'keep'
      } else {
        row._duplicate = null
        row._duplicateDecision = 'create'
      }

      progressCurrent.value++
    }

    progressLabel.value = ''
    progressCurrent.value = 0
    progressTotal.value = 0
  }

  function setDuplicateDecision(rowIndex, decision) {
    if (previewRows.value[rowIndex]) {
      previewRows.value[rowIndex]._duplicateDecision = decision
    }
  }

  /**
   * Execute the import using bulk operations to avoid N+1 DB calls.
   *
   * Strategy:
   *  1. Pre-fetch all clients, accounts, branches, statuses into memory
   *  2. Resolve each row against in-memory maps (no per-row DB calls)
   *  3. Bulk-create any missing clients / accounts in one insert each
   *  4. Bulk-insert all new records in chunks of 500
   *  5. Bulk-insert import_records audit rows and import_errors in one call
   */
  async function saveImport() {
    saving.value = true
    const userId = (await supabase.auth.getUser()).data.user?.id
    const now = new Date().toISOString()

    // ── Create import log entry ───────────────────────────────────────
    const { data: importRecord } = await supabase
      .from('imports')
      .insert({ filename: fileName.value, total_records: previewRows.value.length, status: 'processing' })
      .select()
      .single()
    const importId = importRecord.id

    progressLabel.value = 'Loading reference data…'
    progressCurrent.value = 0
    progressTotal.value = previewRows.value.length

    // ── Step 1: pre-fetch reference tables ───────────────────────────
    // Use range pagination to fetch ALL rows past Supabase's 1000-row default limit
    async function fetchAll(table, columns) {
      const PAGE = 1000
      let from = 0
      let all = []
      while (true) {
        const { data, error } = await supabase
          .from(table)
          .select(columns)
          .range(from, from + PAGE - 1)
        if (error || !data?.length) break
        all = all.concat(data)
        if (data.length < PAGE) break
        from += PAGE
      }
      return all
    }

    const [allClients, allAccounts, allBranches, allStatuses] = await Promise.all([
      fetchAll('clients', 'id, name'),
      fetchAll('client_accounts', 'id, client_id, account_number'),
      supabase.from('branches').select('id, name').then((r) => r.data || []),
      supabase.from('statuses').select('id, name, module').then((r) => r.data || []),
    ])

    // Build lookup maps
    const clientMap   = new Map() // name.lower → id
    for (const c of allClients || []) clientMap.set(c.name.toLowerCase(), c.id)

    const accountMap  = new Map() // `${clientId}::${accountNumber}` → id
    for (const a of allAccounts || []) accountMap.set(`${a.client_id}::${a.account_number}`, a.id)

    const branchMap   = new Map() // name.lower → id
    for (const b of allBranches || []) branchMap.set(b.name.toLowerCase(), b.id)

    // Status map: try exact then partial. Pre-resolve all unique status strings.
    const statusCache = new Map() // raw string → id

    function findStatusId(name, module) {
      if (!name?.toString().trim()) return null
      const key = `${name.toLowerCase().trim()}::${module}`
      if (statusCache.has(key)) return statusCache.get(key)

      const moduleStatuses = (allStatuses || []).filter(
        (s) => s.module === module || s.module === 'both'
      )

      function matchOne(raw) {
        const n = raw.toLowerCase().trim()
        if (!n) return null
        // 1. exact match
        let found = moduleStatuses.find((s) => s.name.toLowerCase() === n)
        // 2. the status name contains the input (e.g. "Key for Duplication" contains "for duplication")
        if (!found) found = moduleStatuses.find((s) => s.name.toLowerCase().includes(n))
        // 3. the input contains the status name (e.g. "for duplication/repo unit" contains "duplication")
        if (!found) found = moduleStatuses.find((s) => n.includes(s.name.toLowerCase()))
        // 4. word-level partial — any word in the status name appears in the input
        if (!found) found = moduleStatuses.find((s) => {
          const words = s.name.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
          return words.length > 0 && words.some((w) => n.includes(w))
        })
        return found?.id ?? null
      }

      // Split compound values: "for duplication/repo unit", "chattel, pullout", "hire & change class"
      const parts = name.toString().split(/[\/,&;]+/).map((p) => p.trim()).filter(Boolean)

      let id = null
      // Try the full original string first
      id = matchOne(name.toString())
      // If no match, try each part
      if (!id) {
        for (const part of parts) {
          id = matchOne(part)
          if (id) break
        }
      }
      // Final fallback to "Others"
      if (!id) {
        id = moduleStatuses.find((s) => s.name.toLowerCase() === 'others')?.id ?? null
      }

      statusCache.set(key, id)
      return id
    }

    function findBranchId(name) {
      if (!name?.toString().trim()) return null
      const n = name.toString().toLowerCase().trim()
      // exact
      if (branchMap.has(n)) return branchMap.get(n)
      // partial
      for (const [k, v] of branchMap) {
        if (k.includes(n) || n.includes(k)) return v
      }
      return null
    }

    // ── Step 2: Collect missing clients ──────────────────────────────
    progressLabel.value = 'Resolving clients…'
    const missingClientNames = new Set()
    for (const row of previewRows.value) {
      if (!row._valid || row._duplicateDecision === 'keep') continue
      const name = row.client_name?.toString().trim()
      if (name && !clientMap.has(name.toLowerCase())) missingClientNames.add(name)
    }

    if (missingClientNames.size > 0) {
      const { data: newClients } = await supabase
        .from('clients')
        .insert([...missingClientNames].map((name) => ({ name })))
        .select('id, name')
      for (const c of newClients || []) clientMap.set(c.name.toLowerCase(), c.id)
    }

    // ── Step 3: Collect missing accounts ─────────────────────────────
    progressLabel.value = 'Resolving accounts…'
    const missingAccounts = [] // { client_id, account_number }
    for (const row of previewRows.value) {
      if (!row._valid || row._duplicateDecision === 'keep') continue
      const clientName = row.client_name?.toString().trim()
      const clientId = clientMap.get(clientName?.toLowerCase())
      if (!clientId) continue
      const accountNum = (row.client_account_id || '').toString().trim() || 'N/A'
      const aKey = `${clientId}::${accountNum}`
      if (!accountMap.has(aKey)) missingAccounts.push({ client_id: clientId, account_number: accountNum })
    }

    if (missingAccounts.length > 0) {
      // Deduplicate before inserting
      const unique = [...new Map(missingAccounts.map((a) => [`${a.client_id}::${a.account_number}`, a])).values()]
      const { data: newAccounts } = await supabase
        .from('client_accounts')
        .insert(unique)
        .select('id, client_id, account_number')
      for (const a of newAccounts || []) accountMap.set(`${a.client_id}::${a.account_number}`, a.id)
    }

    // ── Step 4: Build payloads ────────────────────────────────────────
    progressLabel.value = 'Building payloads…'
    const toInsert   = [] // { payload, rowRef } for new records
    const toUpdate   = [] // { id, payload, rowRef } for update decisions
    const errorRows  = [] // invalid rows for import_errors

    for (const row of previewRows.value) {
      if (!row._valid) {
        errorRows.push(row)
        progressCurrent.value++
        continue
      }
      if (row._duplicateDecision === 'keep') {
        progressCurrent.value++
        continue
      }

      const clientName = row.client_name?.toString().trim()
      const clientId   = clientMap.get(clientName?.toLowerCase())
      if (!clientId) { progressCurrent.value++; continue }

      const accountNum = (row.client_account_id || '').toString().trim() || 'N/A'
      const accountId  = accountMap.get(`${clientId}::${accountNum}`)
      if (!accountId) { progressCurrent.value++; continue }

      const branchId = findBranchId(row.branch)
      const module   = row._targetModule.replace('archive_', '')
      const isArchive = row._targetModule.startsWith('archive_')
      const statusId = findStatusId(row.purpose_status, module)

      const payload = buildPayload(row, clientId, accountId, branchId, statusId, module, userId, isArchive)

      if (row._duplicateDecision === 'update' && row._duplicate) {
        toUpdate.push({ id: row._duplicate.id, payload, row })
      } else {
        toInsert.push({ payload, row })
      }
      progressCurrent.value++
    }

    await nextTick()

    // ── Step 5: Bulk insert new records ───────────────────────────────
    progressLabel.value = 'Inserting records…'
    progressCurrent.value = 0
    progressTotal.value = toInsert.length + toUpdate.length

    let imported = 0, updated = 0, errors = errorRows.length
    const auditRows = [] // for import_records bulk insert

    const INSERT_CHUNK = 500
    for (let i = 0; i < toInsert.length; i += INSERT_CHUNK) {
      const chunk = toInsert.slice(i, i + INSERT_CHUNK)
      const { data: created, error: insertError } = await supabase
        .from('records')
        .insert(chunk.map((c) => c.payload))
        .select('id')
      if (!insertError && created) {
        for (const rec of created) {
          auditRows.push({ import_id: importId, table_name: 'records', record_id: rec.id, action: 'created' })
          imported++
        }
      } else {
        errors += chunk.length
      }
      progressCurrent.value += chunk.length
      await nextTick()
      await new Promise((r) => setTimeout(r, 0))
    }

    // ── Step 6: Process updates (still row-by-row but usually few) ───
    for (const { id, payload, row } of toUpdate) {
      const { data: existing } = await supabase.from('records').select('*').eq('id', id).single()
      await supabase.from('records').update(payload).eq('id', id)
      auditRows.push({ import_id: importId, table_name: 'records', record_id: id, action: 'updated', previous_values: existing })
      updated++
      progressCurrent.value++
    }

    // ── Step 7: Bulk insert audit + errors ────────────────────────────
    progressLabel.value = 'Saving audit log…'
    if (auditRows.length > 0) {
      for (let i = 0; i < auditRows.length; i += 500) {
        await supabase.from('import_records').insert(auditRows.slice(i, i + 500))
      }
    }
    if (errorRows.length > 0) {
      const errPayloads = errorRows.map((row) => ({
        import_id: importId,
        worksheet_name: row._sheetName,
        row_number: row._rowNumber,
        client_name: row.client_name?.toString() || '',
        account_id: row.client_account_id?.toString() || '',
        error_details: row._errors.map((e) => e.message).join('; '),
      }))
      for (let i = 0; i < errPayloads.length; i += 500) {
        await supabase.from('import_errors').insert(errPayloads.slice(i, i + 500))
      }
    }

    const skipped = previewRows.value.filter((r) => r._duplicateDecision === 'keep').length

    await supabase.from('imports').update({
      imported_count: imported,
      skipped_count: skipped,
      updated_count: updated,
      error_count: errors,
      status: 'completed',
    }).eq('id', importId)

    importSummary.value = { importId, imported, skipped, updated, errors, total: previewRows.value.length }
    saving.value = false
    progressLabel.value = ''
    progressCurrent.value = 0
    progressTotal.value = 0
    return importSummary.value
  }

  // --- Helper functions ---

  async function resolveOrCreateClient(name) {
    const { data } = await supabase.from('clients').select('id').ilike('name', `%${name}%`).limit(1)
    if (data?.length) return data[0].id
    const { data: created } = await supabase.from('clients').insert({ name }).select('id').single()
    return created?.id
  }

  async function resolveOrCreateAccount(clientId, accountNumber) {
    const { data } = await supabase.from('client_accounts').select('id').eq('client_id', clientId).eq('account_number', accountNumber).limit(1)
    if (data?.length) return data[0].id
    const { data: created } = await supabase.from('client_accounts').insert({ client_id: clientId, account_number: accountNumber }).select('id').single()
    return created?.id
  }

  /**
   * Resolve a free-text status/purpose name to a statuses.id.
   * Tries exact case-insensitive match first, then partial match.
   * Scopes to the correct module ('transmittal' | 'borrowed' | 'both').
   */
  async function resolveStatus(statusName, module) {
    if (!statusName?.toString().trim()) return null
    const name = statusName.toString().trim()

    // Try exact match scoped to the module or 'both'
    const { data: exact, error: e1 } = await supabase
      .from('statuses')
      .select('id, name, module')
      .ilike('name', name)
      .or(`module.eq.${module},module.eq.both`)
      .limit(1)

    if (exact?.length) {
      console.log(`[resolveStatus] "${name}" → exact match id=${exact[0].id}`)
      return exact[0].id
    }

    // Partial match fallback
    const { data: partial } = await supabase
      .from('statuses')
      .select('id, name, module')
      .ilike('name', `%${name}%`)
      .or(`module.eq.${module},module.eq.both`)
      .limit(1)

    if (partial?.length) {
      console.log(`[resolveStatus] "${name}" → partial match "${partial[0].name}" id=${partial[0].id}`)
      return partial[0].id
    }

    console.warn(`[resolveStatus] "${name}" (module=${module}) — no match found, falling back to "Others"`)

    // Fallback: use the "Others" status for this module
    const { data: others } = await supabase
      .from('statuses')
      .select('id')
      .ilike('name', 'Others')
      .or(`module.eq.${module},module.eq.both`)
      .limit(1)
    if (others?.length) return others[0].id

    return null
  }
  async function resolveBranch(branchName) {
    if (!branchName?.toString().trim()) return null
    const name = branchName.toString().trim()

    // Exact match (case-insensitive)
    const { data: exact } = await supabase
      .from('branches')
      .select('id')
      .ilike('name', name)
      .limit(1)
    if (exact?.length) return exact[0].id

    // Partial match fallback
    const { data: partial } = await supabase
      .from('branches')
      .select('id')
      .ilike('name', `%${name}%`)
      .limit(1)
    if (partial?.length) return partial[0].id

    return null
  }

  function buildPayload(row, clientId, accountId, branchId, statusId, module, userId = null, isArchive = false) {
    const now = new Date().toISOString()
    const base = {
      module,
      client_id: clientId,
      client_account_id: accountId,
      branch_id: branchId || null,
      date_released: formatDateForDB(row.date_released),
      purpose_status_id: statusId || null,
      remarks: row.remarks || null,
      created_by: userId || null,
      is_archived: isArchive,
      archived_at: isArchive ? now : null,
      archived_by: isArchive ? userId : null,
    }

    if (module === 'transmittal') {
      return {
        ...base,
        document_transmitted: row.documents_transmitted || null,
        date_transmitted: formatDateForDB(row.date_transmitted),
        received_by: row.received_by || null,
      }
    }

    // borrowed
    return {
      ...base,
      document_transmitted: row.documents_items || null,
      date_returned: formatDateForDB(row.date_returned),
    }
  }

  function formatDateForDB(val) {
    if (!val || !val.toString().trim()) return null
    if (val instanceof Date) return val.toISOString().split('T')[0]
    const d = new Date(val)
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
    return null
  }

  function autoMapColumns(headers, targetModule) {
    // Archive modules use the same field sets as their base modules
    const baseModule = targetModule.replace('archive_', '')
    const fields = baseModule === 'transmittal' ? TRANSMITTAL_FIELDS : BORROWED_FIELDS
    const mapping = {}

    // Extra aliases so common column names from older files map correctly
    const ALIASES = {
      'purpose_status': ['purpose / status', 'purpose/status', 'status', 'purpose', 'purpose status'],
      'documents_transmitted': ['documents transmitted', 'document transmitted', 'documents'],
      'documents_items': ['documents/items', 'documents items', 'items', 'documents'],
      'client_account_id': ['client account id', 'account id', 'account number', 'accountid'],
      'client_name': ['client name', 'name of client', 'client'],
      'date_released': ['date released', 'date_released', 'release date'],
      'date_transmitted': ['date transmitted', 'date_transmitted'],
      'date_returned': ['date returned', 'date_returned', 'return date'],
      'received_by': ['received by', 'received_by', 'receiver'],
    }

    headers.forEach((header, index) => {
      const normalized = header.toLowerCase().trim().replace(/\s+/g, ' ')
      const match = fields.find((f) => {
        const labelNorm = f.label.toLowerCase().trim().replace(/\s+/g, ' ')
        const keyNorm = f.key.toLowerCase().replace(/_/g, ' ').trim()
        const aliases = ALIASES[f.key] || []
        return (
          labelNorm === normalized ||
          keyNorm === normalized ||
          aliases.includes(normalized)
        )
      })
      mapping[index] = match ? match.key : '_skip'
    })
    return mapping
  }

  function reset() {
    fileName.value = ''
    sheets.value = []
    selectedSheetNames.value = []
    sheetConfigs.value = {}
    previewRows.value = []
    loading.value = false
    saving.value = false
    importSummary.value = null
  }

  // --- Import History & Undo ---

  const importHistory = ref([])
  const importDetails = ref(null)

  async function fetchHistory() {
    const { data, error } = await supabase
      .from('imports')
      .select('*')
      .order('imported_at', { ascending: false })
    if (!error) importHistory.value = data
    return { data, error }
  }

  /**
   * Fetch details for a specific import: affected records and errors.
   * Flags records that were manually edited after the import.
   */
  async function fetchImportDetails(importId) {
    const importRecord = importHistory.value.find((i) => i.id === importId)
    const importedAt = importRecord?.imported_at

    const [recordsResult, errorsResult] = await Promise.all([
      supabase.from('import_records').select('*').eq('import_id', importId),
      supabase.from('import_errors').select('*').eq('import_id', importId),
    ])

    const affectedRecords = []
    for (const record of recordsResult.data || []) {
      let manuallyEdited = false
      try {
        const { data: current } = await supabase
          .from(record.table_name)
          .select('updated_at')
          .eq('id', record.record_id)
          .single()
        if (current?.updated_at && importedAt) {
          manuallyEdited = new Date(current.updated_at) > new Date(importedAt)
        }
      } catch {
        // Record may have been deleted — that's fine
      }
      affectedRecords.push({ ...record, manually_edited: manuallyEdited })
    }

    importDetails.value = {
      records: affectedRecords,
      errors: errorsResult.data || [],
    }
    return importDetails.value
  }

  /**
   * Undo an import: delete created records, restore updated records.
   * Records flagged as manually_edited are highlighted for review.
   */
  async function undoImport(importId) {
    const details = await fetchImportDetails(importId)

    const createdIds = details.records
      .filter((r) => r.action === 'created')
      .map((r) => r.record_id)

    // Bulk delete all created records in one query
    if (createdIds.length > 0) {
      await supabase.from('records').delete().in('id', createdIds)
    }

    // Restore updated records (still row-by-row as each has different previous_values)
    for (const record of details.records.filter((r) => r.action === 'updated' && r.previous_values)) {
      const { id, created_at, updated_at, ...restoreValues } = record.previous_values
      await supabase.from('records').update(restoreValues).eq('id', record.record_id)
    }

    await supabase.from('imports').update({
      undone: true,
      undone_at: new Date().toISOString(),
    }).eq('id', importId)

    await fetchHistory()
  }

  return {
    fileName, sheets, selectedSheetNames, sheetConfigs, previewRows,
    loading, saving, importSummary,
    progressLabel, progressCurrent, progressTotal, progressPercent,
    importHistory, importDetails,
    loadFile, generatePreview, checkDuplicates, setDuplicateDecision,
    saveImport, autoMapColumns, reset,
    fetchHistory, fetchImportDetails, undoImport,
  }
})
