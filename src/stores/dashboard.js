import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'

export const useDashboardStore = defineStore('dashboard', () => {
  const metrics = ref({
    totalTransmittals:  0,
    currentlyBorrowed:  0,
    returnedItems:      0,
    pendingFollowUps:   0,
    resolvedFollowUps:  0,
  })
  const loading = ref(false)
  const lastRefreshed = ref(null)

  async function fetch() {
    loading.value = true

    // All five queries in parallel.
    // Metrics 1-3 now read the `records` table (active UI-created records only).
    // Metrics 4-5 read `follow_ups` (covers all parent types).
    const [tRes, bRes, rRes, pRes, sRes] = await Promise.all([
      // 1. Total active transmittal records
      supabase
        .from('records')
        .select('*', { count: 'exact', head: true })
        .eq('module', 'transmittal')
        .eq('is_archived', false),

      // 2. Currently borrowed (not yet returned, not archived)
      supabase
        .from('records')
        .select('*', { count: 'exact', head: true })
        .eq('module', 'borrowed')
        .eq('is_archived', false)
        .is('date_returned', null),

      // 3. Returned borrowed items (not archived)
      supabase
        .from('records')
        .select('*', { count: 'exact', head: true })
        .eq('module', 'borrowed')
        .eq('is_archived', false)
        .not('date_returned', 'is', null),

      // 4. Pending follow-ups (not resolved)
      supabase
        .from('follow_ups')
        .select('*', { count: 'exact', head: true })
        .is('resolved_date', null),

      // 5. Resolved follow-ups
      supabase
        .from('follow_ups')
        .select('*', { count: 'exact', head: true })
        .not('resolved_date', 'is', null),
    ])

    metrics.value = {
      totalTransmittals:  tRes.count || 0,
      currentlyBorrowed:  bRes.count || 0,
      returnedItems:      rRes.count || 0,
      pendingFollowUps:   pRes.count || 0,
      resolvedFollowUps:  sRes.count || 0,
    }
    lastRefreshed.value = new Date()
    loading.value = false
  }

  return { metrics, loading, lastRefreshed, fetch }
})
