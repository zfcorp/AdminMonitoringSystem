import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'

const SELECT_RELATIONS = `
  *,
  clients(id, name),
  client_accounts(id, account_number),
  branches(id, name),
  statuses!records_purpose_status_id_fkey(id, name)
`

// Human-readable field labels for history descriptions
const FIELD_LABELS = {
  document_transmitted: 'Document Transmitted',
  purpose_status_id: 'Purpose / Status',
  date_released: 'Date Released',
  date_transmitted: 'Date Transmitted',
  received_by: 'Received By',
  date_returned: 'Date Returned',
  remarks: 'Remarks',
  branch_id: 'Branch',
  client_id: 'Client Name',
  client_account_id: 'Account ID',
}

export const useRecordsStore = defineStore('records', () => {
  const records = ref([])
  const totalCount = ref(0)
  const loading = ref(false)

  // ── Fetch ──────────────────────────────────────────────────

  /**
   * Fetch records filtered by module.
   * @param {'borrowed'|'transmittal'} module
   * @param {{ search, page, perPage, sortBy }} opts
   */
  async function fetch({
    module = 'borrowed',
    page = 1,
    perPage = 50,
    sortBy = { field: 'created_at', order: 'desc' },
    filters = {},
  } = {}) {
    loading.value = true
    records.value = [] // clear immediately so stale data doesn't flash

    let query = supabase
      .from('records')
      .select(SELECT_RELATIONS, { count: 'exact' })
      .eq('module', module)

    if (filters.search) {
      // Search client name via client_id — two-step
      const { data: matchingClients } = await supabase
        .from('clients')
        .select('id')
        .ilike('name', `%${filters.search}%`)

      // Also search account number
      const { data: matchingAccounts } = await supabase
        .from('client_accounts')
        .select('id')
        .ilike('account_number', `%${filters.search}%`)

      const clientIds = (matchingClients || []).map((c) => c.id)
      const accountIds = (matchingAccounts || []).map((a) => a.id)

      const orParts = []
      if (clientIds.length) orParts.push(`client_id.in.(${clientIds.join(',')})`)
      if (accountIds.length) orParts.push(`client_account_id.in.(${accountIds.join(',')})`)
      orParts.push(`reference_number.ilike.%${filters.search}%`)

      query = query.or(orParts.join(','))
    }

    if (filters.statusId) query = query.eq('purpose_status_id', filters.statusId)
    if (filters.branchId) query = query.eq('branch_id', filters.branchId)
    if (filters.dateFrom) query = query.gte('date_released', filters.dateFrom)
    if (filters.dateTo)   query = query.lte('date_released', filters.dateTo)

    query = query.order(sortBy.field, { ascending: sortBy.order === 'asc' })

    const from = (page - 1) * perPage
    query = query.range(from, from + perPage - 1)

    const { data, error, count } = await query
    if (!error) {
      records.value = data
      totalCount.value = count || 0
    }
    loading.value = false
    return { data, error, count }
  }

  async function getById(id) {
    const { data, error } = await supabase
      .from('records')
      .select(SELECT_RELATIONS)
      .eq('id', id)
      .single()
    return { data, error }
  }

  // ── Create ────────────────────────────────────────────────

  async function create(payload, module = 'borrowed') {
    const userId = (await supabase.auth.getUser()).data.user?.id

    const { data, error } = await supabase
      .from('records')
      .insert({ ...payload, module, created_by: userId })
      .select(SELECT_RELATIONS)
      .single()

    if (!error && data) {
      await writeHistory({
        recordId: data.id,
        activity: 'created',
        description: `${module === 'transmittal' ? 'Transmittal' : 'Borrowed'} record created.`,
        performedBy: userId,
      })
    }

    return { data, error }
  }

  // ── Update ────────────────────────────────────────────────

  /**
   * Update a record and write field-level history for every changed field.
   * @param {number} id
   * @param {object} payload - new values
   * @param {object} original - current values before change (for diff)
   */
  async function update(id, payload, original) {
    const userId = (await supabase.auth.getUser()).data.user?.id

    const { data, error } = await supabase
      .from('records')
      .update(payload)
      .eq('id', id)
      .select(SELECT_RELATIONS)
      .single()

    if (!error && data) {
      // Write one history entry per changed field
      const changedFields = Object.keys(payload).filter(
        (key) => payload[key] !== original[key]
      )

      for (const field of changedFields) {
        const label = FIELD_LABELS[field] || field
        await writeHistory({
          recordId: id,
          activity: 'updated',
          fieldName: field,
          oldValue: formatValue(original[field]),
          newValue: formatValue(payload[field]),
          description: `${label} updated.`,
          performedBy: userId,
        })
      }
    }

    return { data, error }
  }

  // ── Move to Transmittal ───────────────────────────────────

  async function moveToTransmittal(id, statusId = null) {
    const userId = (await supabase.auth.getUser()).data.user?.id
    const now = new Date().toISOString()

    const updatePayload = {
      module: 'transmittal',
      transferred_at: now,
      transferred_by: userId,
    }
    if (statusId) updatePayload.purpose_status_id = statusId

    const { data, error } = await supabase
      .from('records')
      .update(updatePayload)
      .eq('id', id)
      .select(SELECT_RELATIONS)
      .single()

    if (!error && data) {
      await writeHistory({
        recordId: id,
        activity: 'moved_to_transmittal',
        description: 'Record transferred from Borrowed to Transmittal.',
        performedBy: userId,
      })
    }

    return { data, error }
  }

  // ── Delete ────────────────────────────────────────────────

  async function remove(id) {
    const userId = (await supabase.auth.getUser()).data.user?.id

    // Write deletion history BEFORE the delete (CASCADE will remove history rows
    // only if the record is hard-deleted; we soft-note it first)
    await writeHistory({
      recordId: id,
      activity: 'deleted',
      description: 'Record deleted by Admin.',
      performedBy: userId,
    })

    const { error } = await supabase.from('records').delete().eq('id', id)
    return { error }
  }

  // ── History ───────────────────────────────────────────────

  async function fetchHistory(recordId) {
    const { data, error } = await supabase
      .from('record_history')
      .select('*')
      .eq('record_id', recordId)
      .order('performed_at', { ascending: false })
    return { data, error }
  }

  // ── Internal helpers ──────────────────────────────────────

  async function writeHistory({
    recordId,
    activity,
    fieldName = null,
    oldValue = null,
    newValue = null,
    description = '',
    performedBy = null,
  }) {
    await supabase.from('record_history').insert({
      record_id: recordId,
      activity,
      field_name: fieldName,
      old_value: oldValue,
      new_value: newValue,
      description,
      performed_by: performedBy,
    })
  }

  function formatValue(val) {
    if (val === null || val === undefined) return ''
    if (val instanceof Date) return val.toISOString().split('T')[0]
    return String(val)
  }

  return {
    records,
    totalCount,
    loading,
    fetch,
    getById,
    create,
    update,
    moveToTransmittal,
    remove,
    fetchHistory,
    writeHistory,
  }
})
