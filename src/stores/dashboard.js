import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'

export const useDashboardStore = defineStore('dashboard', () => {
  const metrics = ref({
    totalTransmittals: 0,
    currentlyBorrowed: 0,
    returnedItems:     0,
    pendingFollowUps:  0,
    resolvedFollowUps: 0,
    archivedTotal:     0,
  })

  // Chart data
  const statusBreakdown    = ref([]) // [{ name, count, module }]
  const monthlyTrend       = ref([]) // [{ month, transmittals, borrowed }]
  const topBranches        = ref([]) // [{ name, count }]
  const recentActivity     = ref([]) // last 10 records

  const loading       = ref(false)
  const lastRefreshed = ref(null)

  async function fetch() {
    loading.value = true

    const [tRes, bRes, rRes, pRes, sRes, archRes] = await Promise.all([
      supabase.from('records').select('*', { count: 'exact', head: true }).eq('module', 'transmittal').eq('is_archived', false),
      supabase.from('records').select('*', { count: 'exact', head: true }).eq('module', 'borrowed').eq('is_archived', false).is('date_returned', null),
      supabase.from('records').select('*', { count: 'exact', head: true }).eq('module', 'borrowed').eq('is_archived', false).not('date_returned', 'is', null),
      supabase.from('follow_ups').select('*', { count: 'exact', head: true }).is('resolved_date', null),
      supabase.from('follow_ups').select('*', { count: 'exact', head: true }).not('resolved_date', 'is', null),
      supabase.from('records').select('*', { count: 'exact', head: true }).eq('is_archived', true),
    ])

    metrics.value = {
      totalTransmittals: tRes.count || 0,
      currentlyBorrowed: bRes.count || 0,
      returnedItems:     rRes.count || 0,
      pendingFollowUps:  pRes.count || 0,
      resolvedFollowUps: sRes.count || 0,
      archivedTotal:     archRes.count || 0,
    }

    // ── Status breakdown ─────────────────────────────────────────────
    const { data: statusRows } = await supabase
      .from('records')
      .select('purpose_status_id, module, statuses!records_purpose_status_id_fkey(name)')
      .eq('is_archived', false)
      .not('purpose_status_id', 'is', null)

    const statusMap = {}
    for (const row of statusRows || []) {
      const name = row.statuses?.name ?? 'Unknown'
      const key = `${name}::${row.module}`
      statusMap[key] = (statusMap[key] || { name, module: row.module, count: 0 })
      statusMap[key].count++
    }
    statusBreakdown.value = Object.values(statusMap).sort((a, b) => b.count - a.count).slice(0, 8)

    // ── Monthly trend (last 6 months) ─────────────────────────────────
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
    sixMonthsAgo.setDate(1)
    const fromDate = sixMonthsAgo.toISOString().split('T')[0]

    const { data: trendRows } = await supabase
      .from('records')
      .select('module, created_at')
      .eq('is_archived', false)
      .gte('created_at', fromDate)

    const trendMap = {}
    for (let i = 0; i < 6; i++) {
      const d = new Date()
      d.setMonth(d.getMonth() - (5 - i))
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      trendMap[key] = { month: key, transmittals: 0, borrowed: 0 }
    }
    for (const row of trendRows || []) {
      const key = row.created_at.slice(0, 7)
      if (trendMap[key]) {
        trendMap[key][row.module === 'transmittal' ? 'transmittals' : 'borrowed']++
      }
    }
    monthlyTrend.value = Object.values(trendMap)

    // ── Top branches ─────────────────────────────────────────────────
    const { data: branchRows } = await supabase
      .from('records')
      .select('branch_id, branches(name)')
      .eq('is_archived', false)
      .not('branch_id', 'is', null)

    const branchMap = {}
    for (const row of branchRows || []) {
      const name = row.branches?.name ?? 'Unknown'
      branchMap[name] = (branchMap[name] || 0) + 1
    }
    topBranches.value = Object.entries(branchMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)

    // ── Recent activity ───────────────────────────────────────────────
    const { data: recent } = await supabase
      .from('records')
      .select('id, reference_number, module, created_at, clients(name), statuses!records_purpose_status_id_fkey(name)')
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .limit(8)
    recentActivity.value = recent || []

    lastRefreshed.value = new Date()
    loading.value = false
  }

  return { metrics, loading, lastRefreshed, fetch, statusBreakdown, monthlyTrend, topBranches, recentActivity }
})
