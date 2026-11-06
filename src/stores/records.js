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
  purpose_status_id:    'Purpose / Status',
  date_released:        'Date Released',
  date_transmitted:     'Date Transmitted',
  received_by:          'Received By',
  date_returned:        'Date Returned',
  remarks:              'Remarks',
  branch_id:            'Branch',
  client_id:            'Client Name',
  client_account_id:    'Account ID',
}

// ── Archive eligibility ────────────────────────────────────────
// Borrowed: only records with a non-null date_returned are eligible.
// Transmittal: only records whose status name is one of the
//   completed/closed statuses are eligible.
const TRANSMITTAL_ARCHIVABLE_STATUSES = [
  'closed accounts',
  'preterm',
  'repo cash sales',
  'not account of zurich',
  'others',
]

export const useRecordsStore = defineStore('records', () => {
  const records    = ref([])
  const totalCount = ref(0)
  const loading    = ref(false)

  // ── Fetch ──────────────────────────────────────────────────

  /**
   * Fetch records filtered by module and archive state.
   * @param {'borrowed'|'transmittal'} module
   * @param {boolean} includeArchived  true = archived only, false (default) = active only
   * @param {{ search, statusId, branchId, dateFrom, dateTo, year }} filters
   */
  async function fetch({
    module          = 'borrowed',
    includeArchived = false,
    page            = 1,
    perPage         = 50,
    sortBy          = { field: 'created_at', order: 'desc' },
    filters         = {},
  } = {}) {
    loading.value = true
    records.value = []

    let query = supabase
      .from('records')
      .select(SELECT_RELATIONS, { count: 'exact' })
      .eq('module', module)
      .eq('is_archived', includeArchived)   // ← key change

    // ── Text search ──
    if (filters.search) {
      const { data: matchingClients } = await supabase
        .from('clients')
        .select('id')
        .ilike('name', `%${filters.search}%`)

      const { data: matchingAccounts } = await supabase
        .from('client_accounts')
        .select('id')
        .ilike('account_number', `%${filters.search}%`)

      const clientIds  = (matchingClients  || []).map((c) => c.id)
      const accountIds = (matchingAccounts || []).map((a) => a.id)

      const orParts = []
      if (clientIds.length)  orParts.push(`client_id.in.(${clientIds.join(',')})`)
      if (accountIds.length) orParts.push(`client_account_id.in.(${accountIds.join(',')})`)
      orParts.push(`reference_number.ilike.%${filters.search}%`)

      query = query.or(orParts.join(','))
    }

    // ── Column filters ──
    if (filters.statusId) query = query.eq('purpose_status_id', filters.statusId)
    if (filters.branchId) query = query.eq('branch_id', filters.branchId)
    if (filters.dateFrom) query = query.gte('date_released', filters.dateFrom)
    if (filters.dateTo)   query = query.lte('date_released', filters.dateTo)

    // ── Archive year filter (derived from date_released / date_transmitted) ──
    if (filters.year) {
      const y = parseInt(filters.year, 10)
      if (module === 'transmittal') {
        query = query
          .gte('date_transmitted', `${y}-01-01`)
          .lte('date_transmitted', `${y}-12-31`)
      } else {
        query = query
          .gte('date_released', `${y}-01-01`)
          .lte('date_released', `${y}-12-31`)
      }
    }

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

  /**
   * Fetch the distinct years that have archived records for a module.
   * Used to build the year selector in the archive views.
   * Year is derived from date_released (borrowed) or date_transmitted (transmittal).
   */
  async function fetchArchiveYears(module = 'borrowed') {
    const dateField = module === 'transmittal' ? 'date_transmitted' : 'date_released'

    const { data, error } = await supabase
      .from('records')
      .select(dateField)
      .eq('module', module)
      .eq('is_archived', true)
      .not(dateField, 'is', null)

    if (error || !data) return []

    const years = [...new Set(
      data.map((r) => new Date(r[dateField]).getFullYear())
    )].sort((a, b) => b - a) // descending

    return years
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
        recordId:    data.id,
        activity:    'created',
        description: `${module === 'transmittal' ? 'Transmittal' : 'Borrowed'} record created.`,
        performedBy: userId,
      })
    }

    return { data, error }
  }

  // ── Update ────────────────────────────────────────────────

  async function update(id, payload, original) {
    const userId = (await supabase.auth.getUser()).data.user?.id

    const { data, error } = await supabase
      .from('records')
      .update(payload)
      .eq('id', id)
      .select(SELECT_RELATIONS)
      .single()

    if (!error && data) {
      const changedFields = Object.keys(payload).filter(
        (key) => payload[key] !== original[key]
      )
      for (const field of changedFields) {
        const label = FIELD_LABELS[field] || field
        await writeHistory({
          recordId:    id,
          activity:    'updated',
          fieldName:   field,
          oldValue:    formatValue(original[field]),
          newValue:    formatValue(payload[field]),
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
    const now    = new Date().toISOString()

    const updatePayload = {
      module:         'transmittal',
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
        recordId:    id,
        activity:    'moved_to_transmittal',
        description: 'Record transferred from Borrowed to Transmittal.',
        performedBy: userId,
      })
    }

    return { data, error }
  }

  // ── Archive ───────────────────────────────────────────────

  /**
   * Check whether a record is eligible for archiving.
   * Returns { eligible: boolean, reason: string }.
   *
   * BORROWED rules:
   *   - date_returned must be set (item has been returned).
   *
   * TRANSMITTAL rules:
   *   - status must be one of the completed/closed statuses.
   *
   * SHARED rule:
   *   - No open follow-ups (resolved_date IS NULL) linked via record_id.
   */
  async function checkArchiveEligibility(record) {
    // Already archived
    if (record.is_archived) {
      return { eligible: false, reason: 'This record is already archived.' }
    }

    // ── Borrowed: must have a return date ──
    if (record.module === 'borrowed') {
      if (!record.date_returned) {
        return {
          eligible: false,
          reason: 'Borrowed records can only be archived after the item has been returned. Set a Date Returned first.',
        }
      }
    }

    // ── Transmittal: must have a completed/closed status ──
    if (record.module === 'transmittal') {
      const statusName = (record.statuses?.name ?? '').toLowerCase()
      if (!TRANSMITTAL_ARCHIVABLE_STATUSES.includes(statusName)) {
        return {
          eligible: false,
          reason: `Transmittal records can only be archived when their status is one of: Closed Accounts, Preterm, Repo Cash Sales, Not Account of Zurich, or Others. Current status: "${record.statuses?.name ?? 'None'}".`,
        }
      }
    }

    // ── Shared: no open follow-ups ──
    const { count: openFollowUps } = await supabase
      .from('follow_ups')
      .select('id', { count: 'exact', head: true })
      .eq('record_id', record.id)
      .is('resolved_date', null)

    if (openFollowUps > 0) {
      return {
        eligible: false,
        reason: `This record has ${openFollowUps} open follow-up${openFollowUps > 1 ? 's' : ''}. Resolve all follow-ups before archiving.`,
      }
    }

    return { eligible: true, reason: '' }
  }

  /**
   * Bulk archive multiple records by ID (admin only — enforced by RLS).
   */
  async function bulkArchive(ids) {
    const userId = (await supabase.auth.getUser()).data.user?.id
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('records')
      .update({ is_archived: true, archived_at: now, archived_by: userId })
      .in('id', ids)
    return { error }
  }

  /**
   * Archive a record (admin only — enforced by RLS).
   * Atomically sets is_archived + archived_at + archived_by,
   * then writes a record_history entry.
   */
  async function archive(id) {
    const userId = (await supabase.auth.getUser()).data.user?.id
    const now    = new Date().toISOString()

    const { data, error } = await supabase
      .from('records')
      .update({
        is_archived: true,
        archived_at: now,
        archived_by: userId,
      })
      .eq('id', id)
      .select(SELECT_RELATIONS)
      .single()

    if (!error && data) {
      await writeHistory({
        recordId:    id,
        activity:    'archived',
        description: 'Record archived by Admin.',
        performedBy: userId,
      })
    }

    return { data, error }
  }

  /**
   * Restore an archived record (admin only — enforced by RLS).
   * Clears the archive flags and writes a history entry.
   * The record returns to its original module (borrowed/transmittal).
   */
  async function restore(id) {
    const userId = (await supabase.auth.getUser()).data.user?.id

    const { data, error } = await supabase
      .from('records')
      .update({
        is_archived: false,
        archived_at: null,
        archived_by: null,
      })
      .eq('id', id)
      .select(SELECT_RELATIONS)
      .single()

    if (!error && data) {
      await writeHistory({
        recordId:    id,
        activity:    'restored',
        description: 'Record restored from Archive by Admin.',
        performedBy: userId,
      })
    }

    return { data, error }
  }

  // ── Delete ────────────────────────────────────────────────

  async function remove(id) {
    const userId = (await supabase.auth.getUser()).data.user?.id

    await writeHistory({
      recordId:    id,
      activity:    'deleted',
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
    fieldName   = null,
    oldValue    = null,
    newValue    = null,
    description = '',
    performedBy = null,
  }) {
    await supabase.from('record_history').insert({
      record_id:    recordId,
      activity,
      field_name:   fieldName,
      old_value:    oldValue,
      new_value:    newValue,
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
    fetchArchiveYears,
    getById,
    create,
    update,
    moveToTransmittal,
    checkArchiveEligibility,
    bulkArchive,
    archive,
    restore,
    remove,
    fetchHistory,
    writeHistory,
  }
})
