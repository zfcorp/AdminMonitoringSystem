import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'

// Follow-ups only link to the unified `records` table now
const SELECT_RELATIONS =
  '*, records(id, reference_number, module, clients(name), client_accounts(account_number))'

export const useFollowUpsStore = defineStore('followUps', () => {
  const followUps  = ref([])
  const totalCount = ref(0)
  const loading    = ref(false)

  async function fetch({
    page    = 1,
    perPage = 20,
    sortBy  = { field: 'follow_up_date', order: 'desc' },
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

    if (filters.parentId) {
      query = query.eq('record_id', filters.parentId)
    }

    if (sortBy) {
      query = query.order(sortBy.field, { ascending: sortBy.order === 'asc' })
    }

    const from = (page - 1) * perPage
    query = query.range(from, from + perPage - 1)

    const { data, error, count } = await query
    if (!error) {
      followUps.value  = data
      totalCount.value = count || 0
    }
    loading.value = false
    return { data, error, count }
  }

  async function fetchByParent(type, parentId) {
    const { data, error } = await supabase
      .from('follow_ups')
      .select(SELECT_RELATIONS)
      .eq('record_id', parentId)
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
    const { error } = await supabase.from('follow_ups').delete().eq('id', id)
    return { error }
  }

  /**
   * Search for parent records by reference number or client name.
   * Uses the unified records table only.
   */
  async function searchParents(type, query) {
    const { data, error } = await supabase
      .from('records')
      .select('id, reference_number, module, clients(name)')
      .eq('module', type)
      .eq('is_archived', false)
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
