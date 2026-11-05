import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'

export const useBranchesStore = defineStore('branches', () => {
  const branches = ref([])
  const loading = ref(false)

  /**
   * Fetch all branches ordered by name.
   * Called on app load to populate the shared dropdown source.
   */
  async function fetch() {
    loading.value = true
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .order('name')

    if (error) {
      console.error('[branches] fetch error:', error.message)
    } else {
      branches.value = data
    }
    loading.value = false
    return { data, error }
  }

  /**
   * Create a new branch.
   * @param {string} name
   */
  async function create(name) {
    const { data, error } = await supabase
      .from('branches')
      .insert({ name })
      .select()
      .single()

    if (!error) {
      await fetch()
    }
    return { data, error }
  }

  /**
   * Update an existing branch.
   * @param {number} id
   * @param {string} name
   */
  async function update(id, name) {
    const { data, error } = await supabase
      .from('branches')
      .update({ name })
      .eq('id', id)
      .select()
      .single()

    if (!error) {
      await fetch()
    }
    return { data, error }
  }

  /**
   * Delete a branch. Caller should check getReferenceCount first.
   * @param {number} id
   */
  async function remove(id) {
    const { error } = await supabase
      .from('branches')
      .delete()
      .eq('id', id)

    if (!error) {
      await fetch()
    }
    return { error }
  }

  /**
   * Count how many transmittals and borrowed_items reference
   * this branch. Returns 0 for tables that don't exist yet,
   * so the check degrades gracefully during early development.
   * @param {number} id
   * @returns {Promise<number>}
   */
  async function getReferenceCount(id) {
    let count = 0

    const { count: tCount, error: tError } = await supabase
      .from('transmittals')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', id)
    if (!tError) count += tCount || 0

    const { count: bCount, error: bError } = await supabase
      .from('borrowed_items')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', id)
    if (!bError) count += bCount || 0

    const { count: rCount, error: rError } = await supabase
      .from('records')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', id)
    if (!rError) count += rCount || 0

    return count
  }

  /**
   * Get a branch by ID from the cached list.
   * @param {number} id
   */
  function getById(id) {
    return branches.value.find((b) => b.id === id)
  }

  return { branches, loading, fetch, create, update, remove, getReferenceCount, getById }
})
