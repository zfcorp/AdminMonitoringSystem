import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'

export const useDashboardStore = defineStore('dashboard', () => {
  const metrics = ref({
    totalTransmittals: 0,
    currentlyBorrowed: 0,
    returnedItems: 0,
    pendingFollowUps: 0,
    resolvedFollowUps: 0,
  })
  const loading = ref(false)
  const lastRefreshed = ref(null)

  async function fetch() {
    loading.value = true

    // Run all 5 count queries in parallel
    const [tRes, bRes, rRes, pRes, sRes] = await Promise.all([
      // Total transmittals
      supabase.from('transmittals').select('*', { count: 'exact', head: true }),
      // Currently borrowed (not returned)
      supabase.from('borrowed_items').select('*', { count: 'exact', head: true }).is('date_returned', null),
      // Returned items
      supabase.from('borrowed_items').select('*', { count: 'exact', head: true }).not('date_returned', 'is', null),
      // Pending follow-ups (not resolved)
      supabase.from('follow_ups').select('*', { count: 'exact', head: true }).is('resolved_date', null),
      // Resolved follow-ups
      supabase.from('follow_ups').select('*', { count: 'exact', head: true }).not('resolved_date', 'is', null),
    ])

    metrics.value = {
      totalTransmittals: tRes.count || 0,
      currentlyBorrowed: bRes.count || 0,
      returnedItems: rRes.count || 0,
      pendingFollowUps: pRes.count || 0,
      resolvedFollowUps: sRes.count || 0,
    }
    lastRefreshed.value = new Date()
    loading.value = false
  }

  return { metrics, loading, lastRefreshed, fetch }
})
