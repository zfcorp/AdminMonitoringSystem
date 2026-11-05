import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'

export const useStatusesStore = defineStore('statuses', () => {
  const statuses = ref([])        // all statuses
  const borrowedStatuses = ref([])
  const transmittalStatuses = ref([])
  const loading = ref(false)

  async function fetch() {
    loading.value = true
    const { data, error } = await supabase
      .from('statuses')
      .select('*')
      .order('name')
    if (error) {
      console.error('[statuses] fetch error:', error.message)
    } else {
      statuses.value = data
      borrowedStatuses.value = data.filter((s) => s.module === 'borrowed' || s.module === 'both')
      transmittalStatuses.value = data.filter((s) => s.module === 'transmittal' || s.module === 'both')
    }
    loading.value = false
    return { data, error }
  }

  async function create(name, module = 'borrowed') {
    const { data, error } = await supabase
      .from('statuses')
      .insert({ name: name.trim(), module })
      .select()
      .single()
    if (!error) await fetch()
    return { data, error }
  }

  async function update(id, name) {
    const { data, error } = await supabase
      .from('statuses')
      .update({ name: name.trim() })
      .eq('id', id)
      .select()
      .single()
    if (!error) await fetch()
    return { data, error }
  }

  async function remove(id) {
    const { count } = await supabase
      .from('records')
      .select('*', { count: 'exact', head: true })
      .eq('purpose_status_id', id)

    if (count > 0) return { error: null, blocked: true, count }

    const { error } = await supabase.from('statuses').delete().eq('id', id)
    if (!error) await fetch()
    return { error, blocked: false }
  }

  function getById(id) {
    return statuses.value.find((s) => s.id === id)
  }

  return {
    statuses,
    borrowedStatuses,
    transmittalStatuses,
    loading,
    fetch,
    create,
    update,
    remove,
    getById,
  }
})
