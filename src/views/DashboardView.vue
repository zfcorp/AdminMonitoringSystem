<script setup>
import { onMounted, computed } from 'vue'
import Button from 'primevue/button'
import { useDashboardStore } from '../stores/dashboard'
import { format, parseISO } from 'date-fns'

const store = useDashboardStore()

onMounted(() => store.fetch())

const refreshedText = computed(() =>
  store.lastRefreshed ? format(store.lastRefreshed, 'MMM d, yyyy h:mm a') : ''
)

// ── Metric cards ──────────────────────────────────────────────
const metricCards = computed(() => [
  { label: 'Total Transmittals', value: store.metrics.totalTransmittals, icon: 'pi pi-send',               color: 'blue'   },
  { label: 'Currently Borrowed', value: store.metrics.currentlyBorrowed, icon: 'pi pi-clock',              color: 'amber'  },
  { label: 'Items Returned',     value: store.metrics.returnedItems,     icon: 'pi pi-check-circle',       color: 'green'  },
  { label: 'Pending Follow-ups', value: store.metrics.pendingFollowUps,  icon: 'pi pi-exclamation-circle', color: 'orange' },
  { label: 'Resolved Follow-ups',value: store.metrics.resolvedFollowUps, icon: 'pi pi-check',              color: 'teal'   },
  { label: 'Archived Records',   value: store.metrics.archivedTotal,     icon: 'pi pi-box',                color: 'purple' },
])

// ── Monthly trend chart ───────────────────────────────────────
const trendChartData = computed(() => ({
  labels: store.monthlyTrend.map((m) => {
    const [y, mo] = m.month.split('-')
    return new Date(Number(y), Number(mo) - 1).toLocaleString('default', { month: 'short', year: '2-digit' })
  }),
  datasets: [
    {
      label: 'Transmittals',
      data: store.monthlyTrend.map((m) => m.transmittals),
      backgroundColor: 'rgba(59,130,246,0.15)',
      borderColor: '#3b82f6',
      borderWidth: 2,
      tension: 0.4,
      fill: true,
      pointRadius: 4,
      pointBackgroundColor: '#3b82f6',
    },
    {
      label: 'Borrowed',
      data: store.monthlyTrend.map((m) => m.borrowed),
      backgroundColor: 'rgba(245,158,11,0.12)',
      borderColor: '#f59e0b',
      borderWidth: 2,
      tension: 0.4,
      fill: true,
      pointRadius: 4,
      pointBackgroundColor: '#f59e0b',
    },
  ],
}))

const trendChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 12 } } } },
  scales: {
    y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#f1f5f9' } },
    x: { grid: { display: false } },
  },
}

// ── Status breakdown chart ────────────────────────────────────
const statusChartData = computed(() => {
  const COLORS = ['#3b82f6','#f59e0b','#10b981','#ef4444','#8b5cf6','#06b6d4','#f97316','#64748b']
  return {
    labels: store.statusBreakdown.map((s) => s.name),
    datasets: [{
      data: store.statusBreakdown.map((s) => s.count),
      backgroundColor: COLORS,
      borderWidth: 0,
    }],
  }
})

const statusChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 }, padding: 10 } },
  },
  cutout: '60%',
}

// ── Top branches chart ────────────────────────────────────────
const branchChartData = computed(() => ({
  labels: store.topBranches.map((b) => b.name.replace('VMSC ', '').replace('VSMC ', '')),
  datasets: [{
    label: 'Records',
    data: store.topBranches.map((b) => b.count),
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  }],
}))

const branchChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y',
  plugins: { legend: { display: false } },
  scales: {
    x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#f1f5f9' } },
    y: { grid: { display: false }, ticks: { font: { size: 11 } } },
  },
}

function formatDate(val) {
  if (!val) return '—'
  try { return format(parseISO(val), 'dd-MMM-yyyy') } catch { return val }
}

// Dynamically import Chart.js + PrimeVue Chart
import { defineAsyncComponent } from 'vue'
const Chart = defineAsyncComponent(() => import('primevue/chart'))
</script>

<template>
  <div class="dashboard">

    <!-- Header -->
    <div class="dash-header">
      <div>
        <h1 class="dash-title">Dashboard</h1>
        <span v-if="refreshedText" class="refreshed">Last refreshed: {{ refreshedText }}</span>
      </div>
      <Button label="Refresh" icon="pi pi-refresh" text :loading="store.loading" @click="store.fetch()" />
    </div>

    <!-- Metric cards -->
    <div class="metrics-grid">
      <div v-for="card in metricCards" :key="card.label" class="metric-card" :class="`metric-card--${card.color}`">
        <div class="metric-card__icon"><i :class="card.icon" /></div>
        <div class="metric-card__body">
          <div class="metric-card__value">{{ card.value.toLocaleString() }}</div>
          <div class="metric-card__label">{{ card.label }}</div>
        </div>
      </div>
    </div>

    <!-- Charts row -->
    <div class="charts-row">

      <!-- Monthly trend -->
      <div class="chart-card chart-card--wide">
        <div class="chart-card__header">
          <span class="chart-card__title">Monthly Activity (Last 6 Months)</span>
        </div>
        <div class="chart-wrap">
          <Suspense>
            <Chart type="line" :data="trendChartData" :options="trendChartOptions" style="height:100%" />
          </Suspense>
        </div>
      </div>

      <!-- Status breakdown -->
      <div class="chart-card">
        <div class="chart-card__header">
          <span class="chart-card__title">Status Breakdown</span>
        </div>
        <div class="chart-wrap">
          <Suspense>
            <Chart type="doughnut" :data="statusChartData" :options="statusChartOptions" style="height:100%" />
          </Suspense>
        </div>
        <div v-if="!store.statusBreakdown.length && !store.loading" class="chart-empty">No status data yet</div>
      </div>

    </div>

    <!-- Bottom row -->
    <div class="charts-row">

      <!-- Top branches -->
      <div class="chart-card">
        <div class="chart-card__header">
          <span class="chart-card__title">Top Branches by Records</span>
        </div>
        <div class="chart-wrap chart-wrap--tall">
          <Suspense>
            <Chart type="bar" :data="branchChartData" :options="branchChartOptions" style="height:100%" />
          </Suspense>
        </div>
        <div v-if="!store.topBranches.length && !store.loading" class="chart-empty">No branch data yet</div>
      </div>

      <!-- Recent activity -->
      <div class="chart-card chart-card--wide">
        <div class="chart-card__header">
          <span class="chart-card__title">Recent Records</span>
        </div>
        <div class="activity-list">
          <div v-if="store.loading" class="chart-empty">Loading…</div>
          <div v-else-if="!store.recentActivity.length" class="chart-empty">No records yet</div>
          <div v-else v-for="rec in store.recentActivity" :key="rec.id" class="activity-row">
            <span :class="['activity-badge', rec.module === 'transmittal' ? 'activity-badge--t' : 'activity-badge--b']">
              {{ rec.module === 'transmittal' ? 'TRN' : 'BRW' }}
            </span>
            <div class="activity-info">
              <div class="activity-client">{{ rec.clients?.name ?? '—' }}</div>
              <div class="activity-ref">{{ rec.reference_number }}</div>
            </div>
            <div class="activity-meta">
              <span v-if="rec.statuses?.name" class="activity-status">{{ rec.statuses.name }}</span>
              <span class="activity-date">{{ formatDate(rec.created_at) }}</span>
            </div>
          </div>
        </div>
      </div>

    </div>

  </div>
</template>

<style scoped>
.dashboard { display: flex; flex-direction: column; gap: 1.25rem; }

.dash-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.dash-title { font-size: 1.4rem; font-weight: 700; color: #1e293b; margin: 0; }
.refreshed  { font-size: 0.78rem; color: #94a3b8; }

/* ── Metric cards ── */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 0.875rem;
}
.metric-card {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 1rem 1.25rem;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  transition: box-shadow 0.15s;
}
.metric-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.07); }

.metric-card__icon {
  width: 44px; height: 44px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center; font-size: 1.3rem; flex-shrink: 0;
}
.metric-card--blue   .metric-card__icon { background: #dbeafe; color: #1e40af; }
.metric-card--amber  .metric-card__icon { background: #fef3c7; color: #92400e; }
.metric-card--green  .metric-card__icon { background: #d1fae5; color: #065f46; }
.metric-card--orange .metric-card__icon { background: #ffedd5; color: #9a3412; }
.metric-card--teal   .metric-card__icon { background: #ccfbf1; color: #115e59; }
.metric-card--purple .metric-card__icon { background: #ede9fe; color: #5b21b6; }

.metric-card__value { font-size: 1.75rem; font-weight: 700; color: #1e293b; line-height: 1; }
.metric-card__label { font-size: 0.75rem; color: #64748b; margin-top: 0.2rem; }

/* ── Chart layout ── */
.charts-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.chart-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.chart-card--wide { grid-column: span 1; }

@media (max-width: 900px) {
  .charts-row { grid-template-columns: 1fr; }
}

.chart-card__header { display: flex; justify-content: space-between; align-items: center; }
.chart-card__title  { font-size: 0.9rem; font-weight: 600; color: #334155; }

.chart-wrap { height: 220px; position: relative; }
.chart-wrap--tall { height: 260px; }
.chart-empty { text-align: center; color: #94a3b8; font-size: 0.85rem; padding: 2rem 0; }

/* ── Recent activity list ── */
.activity-list { display: flex; flex-direction: column; gap: 0.5rem; overflow-y: auto; max-height: 300px; }

.activity-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.25rem;
  border-bottom: 1px solid #f1f5f9;
}
.activity-row:last-child { border-bottom: none; }

.activity-badge {
  display: inline-flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; border-radius: 8px;
  font-size: 0.65rem; font-weight: 700; flex-shrink: 0;
}
.activity-badge--t { background: #dbeafe; color: #1e40af; }
.activity-badge--b { background: #fce7f3; color: #9d174d; }

.activity-info { flex: 1; min-width: 0; }
.activity-client { font-size: 0.85rem; font-weight: 500; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.activity-ref    { font-size: 0.75rem; color: #94a3b8; }

.activity-meta { text-align: right; flex-shrink: 0; }
.activity-status { display: block; font-size: 0.72rem; color: #475569; white-space: nowrap; }
.activity-date   { display: block; font-size: 0.72rem; color: #94a3b8; }
</style>
