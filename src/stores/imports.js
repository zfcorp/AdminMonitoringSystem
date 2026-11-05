import { defineStore } from 'pinia'
import { ref } from 'vue'
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

  function generatePreview() {
    const allRows = []
    for (const sheetName of selectedSheetNames.value) {
      const sheet = sheets.value.find((s) => s.sheetName === sheetName)
      if (!sheet) continue
      const config = sheetConfigs.value[sheetName]
      if (!config) continue
      const mapped = mapRows(sheet.rows, sheet.headers, config.mapping)
      mapped.forEach((row) => {
        const validation = validateImportRow(row, config.targetModule)
        allRows.push({
          ...row,
          _sheetName: sheetName,
          _targetModule: config.targetModule,
          _valid: validation.valid,
          _errors: validation.errors,
          _duplicate: null,
          _duplicateDecision: 'create',
        })
      })
    }
    previewRows.value = allRows
  }

  /**
   * Check each valid row for existing duplicates in the database.
   * Matching rule: same client_name + account_number + date_released + key field.
   */
  async function checkDuplicates() {
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
        continue
      }

      const accountId = accounts[0].id
      const table = row._targetModule === 'transmittal' ? 'transmittals' : 'borrowed_items'

      // Check for duplicate
      let query = supabase.from(table).select('*').eq('client_id', clientId).eq('client_account_id', accountId)
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
    }
  }

  function setDuplicateDecision(rowIndex, decision) {
    if (previewRows.value[rowIndex]) {
      previewRows.value[rowIndex]._duplicateDecision = decision
    }
  }

  /**
   * Execute the import: create/update records, write import_records/errors.
   */
  async function saveImport() {
    saving.value = true

    // Create import record
    const { data: importRecord } = await supabase
      .from('imports')
      .insert({ filename: fileName.value, total_records: previewRows.value.length, status: 'processing' })
      .select()
      .single()

    const importId = importRecord.id
    let imported = 0, skipped = 0, updated = 0, errors = 0

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
        continue
      }

      if (row._duplicateDecision === 'keep') {
        skipped++
        continue
      }

      // Resolve client and account
      const clientId = await resolveOrCreateClient(row.client_name.toString())
      if (!clientId) { errors++; continue }

      const accountId = await resolveOrCreateAccount(clientId, row.client_account_id.toString())
      if (!accountId) { errors++; continue }

      // Resolve branch name → branch ID (optional field, null if not found)
      const branchId = await resolveBranch(row.branch)

      const table = row._targetModule === 'transmittal' ? 'transmittals' : 'borrowed_items'
      const payload = buildPayload(row, clientId, accountId, branchId, row._targetModule)

      if (row._duplicateDecision === 'update' && row._duplicate) {
        // Capture previous values for undo
        const { data: existing } = await supabase.from(table).select('*').eq('id', row._duplicate.id).single()
        await supabase.from(table).update(payload).eq('id', row._duplicate.id)
        await supabase.from('import_records').insert({
          import_id: importId, table_name: table, record_id: row._duplicate.id,
          action: 'updated', previous_values: existing,
        })
        updated++
      } else {
        // Create new record
        const { data: created } = await supabase.from(table).insert(payload).select('id').single()
        if (created) {
          await supabase.from('import_records').insert({
            import_id: importId, table_name: table, record_id: created.id, action: 'created',
          })
          imported++
        }
      }
    }

    // Update import record with final counts
    await supabase.from('imports').update({
      imported_count: imported, skipped_count: skipped,
      updated_count: updated, error_count: errors, status: 'completed',
    }).eq('id', importId)

    importSummary.value = { importId, imported, skipped, updated, errors, total: previewRows.value.length }
    saving.value = false
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
   * Resolve a branch name from Excel to a branch ID.
   * Tries exact match first, then case-insensitive partial match.
   * Returns null if not found — branch will be left blank on the record.
   */
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

  function buildPayload(row, clientId, accountId, branchId, module) {
    if (module === 'transmittal') {
      return {
        client_id: clientId,
        client_account_id: accountId,
        branch_id: branchId || null,
        date_released: formatDateForDB(row.date_released),
        documents_transmitted: row.documents_transmitted || null,
        purpose: row.purpose || null,
        date_transmitted: formatDateForDB(row.date_transmitted),
        received_by: row.received_by || null,
        remarks: row.remarks || null,
      }
    }
    return {
      client_id: clientId,
      client_account_id: accountId,
      branch_id: branchId || null,
      date_released: formatDateForDB(row.date_released),
      documents_items: row.documents_items || null,
      purpose: row.purpose || null,
      additional_details: row.additional_details || null,
      borrowing_reason: row.borrowing_reason || null,
      date_returned: formatDateForDB(row.date_returned),
      status: row.status || null,
      remarks: row.remarks || null,
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
    const fields = targetModule === 'transmittal' ? TRANSMITTAL_FIELDS : BORROWED_FIELDS
    const mapping = {}
    headers.forEach((header, index) => {
      const normalized = header.toLowerCase().trim()
      const match = fields.find((f) => {
        const labelNorm = f.label.toLowerCase().trim()
        const keyNorm = f.key.toLowerCase().replace(/_/g, ' ').trim()
        return labelNorm === normalized || keyNorm === normalized
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
        await supabase.from(record.table_name).delete().eq('id', record.record_id)
      } else if (record.action === 'updated' && record.previous_values) {
        const { id, created_at, updated_at, ...restoreValues } = record.previous_values
        await supabase.from(record.table_name).update(restoreValues).eq('id', record.record_id)
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
    importHistory, importDetails,
    loadFile, generatePreview, checkDuplicates, setDuplicateDecision,
    saveImport, autoMapColumns, reset,
    fetchHistory, fetchImportDetails, undoImport,
  }
})
