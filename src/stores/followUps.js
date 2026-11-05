import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'

const SELECT_RELATIONS =
  '*, transmittals(id, reference_number, clients(name), client_accounts(account_number)), borrowed_items(id, reference_number, clients(name), client_accounts(account_number)), records(id, reference_number, module, clients(name), client_accounts(account_number))'

export const useFollowUpsStore = defineStore('followUps', () => {
  const followUps = ref([])
  const totalCount = ref(0)
  const loading = ref(false)

  async function fetch({
    page = 1,
    perPage = 20,
    sortBy = { field: 'follow_up_date', order: 'desc' },
    filters = {},
  } = {}) {
    loading.value = true

    let query = supabase
      .from('follow_ups')
      .select(SELECT_RELATIONS, { count: 'exact' })

    if (filters.status === 'pending') {
      query = query.is('resolved_date', null)
    } else if (filters.status === 'resolved') {
      query = query.not('resolved_date', 'is', null)
    }

    if (filters.parentType === 'transmittal' && filters.parentId) {
      query = query.eq('transmittal_id', filters.parentId)
    } else if (filters.parentType === 'borrowed' && filters.parentId) {
      query = query.eq('borrowed_item_id', filters.parentId)
    }

    if (sortBy) {
      query = query.order(sortBy.field, { ascending: sortBy.order === 'asc' })
    }

    const from = (page - 1) * perPage
    const to = from + perPage - 1
    query = query.range(from, to)

    const { data, error, count } = await query
    if (!error) {
      followUps.value = data
      totalCount.value = count || 0
    }
    loading.value = false
    return { data, error, count }
  }

  /**
   * Fetch follow-ups linked to a specific parent record.
   * @param {'transmittal'|'borrowed'} type
   * @param {number} parentId
   */
  async function fetchByParent(type, parentId) {
    const column =
      type === 'transmittal' ? 'transmittal_id' :
      type === 'record'      ? 'record_id'      :
                               'borrowed_item_id'
    const { data, error } = await supabase
      .from('follow_ups')
      .select(SELECT_RELATIONS)
      .eq(column, parentId)
      .order('follow_up_date', { ascending: false })

    return { data, error }
  }

  async function getById(id) {
    const { data, error } = await supabase
      .from('follow_ups')
      .select(SELECT_RELATIONS)
      .eq('id', id)
      .single()

    return { data, error }
  }

  async function create(payload) {
    const { data, error } = await supabase
      .from('follow_ups')
      .insert(payload)
      .select(SELECT_RELATIONS)
      .single()

    return { data, error }
  }

  async function update(id, payload) {
    const { data, error } = await supabase
      .from('follow_ups')
      .update(payload)
      .eq('id', id)
      .select(SELECT_RELATIONS)
      .single()

    return { data, error }
  }

  /**
   * Manually mark a follow-up as Resolved.
   * Sets status to 'Resolved' and resolved_date to today.
   * This is the ONLY way a follow-up becomes resolved —
   * returning a borrowed item does NOT auto-resolve follow-ups.
   */
  async function markResolved(id) {
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('follow_ups')
      .update({ status: 'Resolved', resolved_date: today })
      .eq('id', id)
      .select(SELECT_RELATIONS)
      .single()

    return { data, error }
  }

  async function remove(id) {
    const { error } = await supabase
      .from('follow_ups')
      .delete()
      .eq('id', id)

    return { error }
  }

  /**
   * Search for parent records (transmittals or borrowed items)
   * by reference_number for the follow-up form parent selector.
   * @param {'transmittal'|'borrowed'} type
   * @param {string} query
   */
  async function searchParents(type, query) {
    const table = type === 'transmittal' ? 'transmittals' : 'borrowed_items'
    const { data, error } = await supabase
      .from(table)
      .select('id, reference_number, clients(name)')
      .ilike('reference_number', `%${query}%`)
      .order('reference_number')
      .limit(10)

    return { data, error }
  }

  return {
    followUps,
    totalCount,
    loading,
    fetch,
    fetchByParent,
    getById,
    create,
    update,
    markResolved,
    remove,
    searchParents,
  }
})
