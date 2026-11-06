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
   * Check each valid row for existing duplicates in the database.
   * Matching rule: same client_name + account_number + date_released + key field.
   */
  async function checkDuplicates() {
    const validRows = previewRows.value.filter((r) => r._valid)
    progressLabel.value = 'Checking duplicates…'
    progressCurrent.value = 0
    progressTotal.value = validRows.length

    for (const row of previewRows.value) {
      if (!row._valid) continue

      // Resolve client by name
      const { data: clients } = await supabase
        .from('clients')
        .select('id')
        .ilike('name', `%${row.client_name}%`)
        .limit(1)

      if (!clients?.length) {
        row._duplicate = null
        row._duplicateDecision = 'create'
        progressCurrent.value++
        continue
      }

      const clientId = clients[0].id

      // Resolve account
      const { data: accounts } = await supabase
        .from('client_accounts')
        .select('id')
        .eq('client_id', clientId)
        .eq('account_number', row.client_account_id.toString())
        .limit(1)

      if (!accounts?.length) {
        row._duplicate = null
        row._duplicateDecision = 'create'
        progressCurrent.value++
        continue
      }

      const accountId = accounts[0].id
      const module = row._targetModule.replace('archive_', '') // 'transmittal' or 'borrowed'
      const isArchive = row._targetModule.startsWith('archive_')

      // Check for duplicate in the unified records table
      let query = supabase
        .from('records')
        .select('*')
        .eq('module', module)
        .eq('client_id', clientId)
        .eq('client_account_id', accountId)
        .eq('is_archived', isArchive)

      if (row.date_released) {
        query = query.eq('date_released', formatDateForDB(row.date_released))
      }
      const { data: existing } = await query.limit(1)

      if (existing?.length > 0) {
        row._duplicate = existing[0]
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
   * Execute the import: create/update records in the unified `records` table,
   * write import_records/errors.
   */
  async function saveImport() {
    saving.value = true

    const userId = (await supabase.auth.getUser()).data.user?.id

    // Create import record
    const { data: importRecord } = await supabase
      .from('imports')
      .insert({ filename: fileName.value, total_records: previewRows.value.length, status: 'processing' })
      .select()
      .single()

    const importId = importRecord.id
    let imported = 0, skipped = 0, updated = 0, errors = 0

    progressLabel.value = 'Saving records…'
    progressCurrent.value = 0
    progressTotal.value = previewRows.value.length

    for (const row of previewRows.value) {
      if (!row._valid) {
        await supabase.from('import_errors').insert({
          import_id: importId,
          worksheet_name: row._sheetName,
          row_number: row._rowNumber,
          client_name: row.client_name?.toString() || '',
          account_id: row.client_account_id?.toString() || '',
          error_details: row._errors.map((e) => e.message).join('; '),
        })
        errors++
        progressCurrent.value++
        continue
      }

      if (row._duplicateDecision === 'keep') {
        skipped++
        progressCurrent.value++
        continue
      }

      // Resolve client and account
      const clientId = await resolveOrCreateClient(row.client_name.toString())
      if (!clientId) { errors++; progressCurrent.value++; continue }

      const accountId = await resolveOrCreateAccount(clientId, (row.client_account_id || '').toString() || 'N/A')
      if (!accountId) { errors++; progressCurrent.value++; continue }

      // Resolve branch name → branch ID
      const branchId = await resolveBranch(row.branch)

      // Resolve purpose/status text → statuses.id
      const module = row._targetModule.replace('archive_', '') // 'transmittal' or 'borrowed'
      const isArchive = row._targetModule.startsWith('archive_')
      const statusId = await resolveStatus(row.purpose_status, module)

      const payload = buildPayload(row, clientId, accountId, branchId, statusId, module, userId, isArchive)

      if (row._duplicateDecision === 'update' && row._duplicate) {
        // Capture previous values for undo
        const { data: existing } = await supabase
          .from('records')
          .select('*')
          .eq('id', row._duplicate.id)
          .single()
        await supabase.from('records').update(payload).eq('id', row._duplicate.id)
        await supabase.from('import_records').insert({
          import_id: importId,
          table_name: 'records',
          record_id: row._duplicate.id,
          action: 'updated',
          previous_values: existing,
        })
        updated++
      } else {
        // Create new record
        const { data: created } = await supabase
          .from('records')
          .insert(payload)
          .select('id')
          .single()
        if (created) {
          await supabase.from('import_records').insert({
            import_id: importId,
            table_name: 'records',
            record_id: created.id,
            action: 'created',
          })
          imported++
        } else {
          errors++
        }
      }

      progressCurrent.value++
    }

    // Update import record with final counts
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

    for (const record of details.records) {
      if (record.action === 'created') {
        await supabase.from('records').delete().eq('id', record.record_id)
      } else if (record.action === 'updated' && record.previous_values) {
        const { id, created_at, updated_at, ...restoreValues } = record.previous_values
        await supabase.from('records').update(restoreValues).eq('id', record.record_id)
      }
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
