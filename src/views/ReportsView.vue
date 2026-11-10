<script setup>
import { ref, computed } from 'vue'
import Calendar from 'primevue/calendar'
import Button from 'primevue/button'
import Dropdown from 'primevue/dropdown'
import { supabase } from '../lib/supabase'
import { format, parseISO } from 'date-fns'

const dateFrom = ref(null)
const dateTo = ref(null)
const statusFilter = ref(null) // 'pending' | 'resolved' | null
const loading = ref(false)
const followUps = ref([])
const fetched = ref(false)

const statusOptions = [
  { label: 'All', value: null },
  { label: 'Pending (Open)', value: 'pending' },
  { label: 'Resolved', value: 'resolved' },
]

async function loadReport() {
  loading.value = true
  fetched.value = false

  let query = supabase
    .from('follow_ups')
    .select(`
      id, reference_number, follow_up_date, subject, details,
      status, resolved_date, remarks,
      records(reference_number, module, clients(name), client_accounts(account_number))
    `)
    .order('follow_up_date', { ascending: true })

  if (dateFrom.value) query = query.gte('follow_up_date', format(dateFrom.value, 'yyyy-MM-dd'))
  if (dateTo.value)   query = query.lte('follow_up_date', format(dateTo.value, 'yyyy-MM-dd'))
  if (statusFilter.value === 'pending')  query = query.is('resolved_date', null)
  if (statusFilter.value === 'resolved') query = query.not('resolved_date', 'is', null)

  const { data, error } = await query
  if (!error) followUps.value = data || []
  loading.value = false
  fetched.value = true
}

function resetFilters() {
  dateFrom.value = null
  dateTo.value = null
  statusFilter.value = null
  followUps.value = []
  fetched.value = false
}

function formatDate(val) {
  if (!val) return '—'
  try { return format(parseISO(val), 'dd-MMM-yyyy') } catch { return val }
}

function parentInfo(fu) {
  if (fu.records) return {
    ref:     fu.records.reference_number,
    client:  fu.records.clients?.name,
    account: fu.records.client_accounts?.account_number,
    module:  fu.records.module === 'transmittal' ? 'Transmittal' : 'Borrowed',
  }
  return { ref: '—', client: '—', account: '—', module: '—' }
}

const reportTitle = computed(() => {
  const parts = []
  if (dateFrom.value) parts.push(`From ${format(dateFrom.value, 'dd-MMM-yyyy')}`)
  if (dateTo.value)   parts.push(`To ${format(dateTo.value, 'dd-MMM-yyyy')}`)
  if (!parts.length)  parts.push('All Dates')
  if (statusFilter.value) parts.push(statusFilter.value === 'pending' ? '— Pending' : '— Resolved')
  return `Follow-up Report · ${parts.join(' ')}`
})

function printReport() {
  window.print()
}
</script>

<template>
  <div class="reports-page">

    <!-- Filter panel (hidden on print) -->
    <div class="filter-card no-print">
      <h2 class="filter-card__title">Follow-up Report</h2>
      <div class="filter-card__row">
        <div class="filter-field">
          <span class="filter-label">DATE FROM</span>
          <Calendar v-model="dateFrom" dateFormat="dd-M-yy" showIcon placeholder="Start date" />
        </div>
        <div class="filter-field">
          <span class="filter-label">DATE TO</span>
          <Calendar v-model="dateTo" dateFormat="dd-M-yy" showIcon placeholder="End date" />
        </div>
        <div class="filter-field">
          <span class="filter-label">STATUS</span>
          <Dropdown v-model="statusFilter" :options="statusOptions"
            optionLabel="label" optionValue="value" placeholder="All" />
        </div>
      </div>
      <div class="filter-card__actions">
        <Button label="Generate Report" icon="pi pi-chart-bar" :loading="loading" @click="loadReport" />
        <button class="clear-btn" @click="resetFilters"><i class="pi pi-times" /> Reset</button>
      </div>
    </div>

    <!-- Report output -->
    <div v-if="fetched" class="report-output">

      <!-- Report header (shows on print too) -->
      <div class="report-header">
        <div class="report-header__logo">
          <div class="report-header__company">Zurich Finance</div>
          <div class="report-header__system">Admin Monitoring System</div>
        </div>
        <div class="report-header__meta">
          <div class="report-header__title">Follow-up Report</div>
          <div class="report-header__sub">
            <span v-if="dateFrom || dateTo">
              {{ dateFrom ? format(dateFrom, 'dd-MMM-yyyy') : '—' }}
              &nbsp;to&nbsp;
              {{ dateTo ? format(dateTo, 'dd-MMM-yyyy') : '—' }}
            </span>
            <span v-else>All Dates</span>
            &nbsp;·&nbsp;
            <span v-if="statusFilter === 'pending'">Pending Only</span>
            <span v-else-if="statusFilter === 'resolved'">Resolved Only</span>
            <span v-else>All Statuses</span>
          </div>
          <div class="report-header__date">Printed: {{ format(new Date(), 'dd-MMM-yyyy h:mm a') }}</div>
        </div>
      </div>

      <!-- Summary -->
      <div class="report-summary no-print">
        <span class="summary-pill">{{ followUps.length }} follow-up(s) found</span>
        <Button label="Print / Save as PDF" icon="pi pi-print" outlined size="small" @click="printReport" />
      </div>

      <!-- Empty state -->
      <div v-if="!followUps.length" class="empty-state">
        No follow-ups found for the selected filters.
      </div>

      <!-- Table -->
      <table v-else class="report-table">
        <thead>
          <tr>
            <th style="width:40px">No.</th>
            <th>Client Name</th>
            <th>Account ID</th>
            <th>Module</th>
            <th>Ref. No.</th>
            <th>Follow-up Date</th>
            <th>Subject</th>
            <th>Details</th>
            <th>Status</th>
            <th>Resolved Date</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(fu, idx) in followUps" :key="fu.id">
            <td>{{ idx + 1 }}</td>
            <td>{{ parentInfo(fu).client }}</td>
            <td>{{ parentInfo(fu).account }}</td>
            <td>
              <span :class="['mod-badge', parentInfo(fu).module.toLowerCase()]">
                {{ parentInfo(fu).module }}
              </span>
            </td>
            <td>{{ parentInfo(fu).ref }}</td>
            <td>{{ formatDate(fu.follow_up_date) }}</td>
            <td>{{ fu.subject || '—' }}</td>
            <td>{{ fu.details || '—' }}</td>
            <td>
              <span :class="['status-pill', fu.resolved_date ? 'resolved' : 'pending']">
                {{ fu.resolved_date ? 'Resolved' : (fu.status || 'Open') }}
              </span>
            </td>
            <td>{{ formatDate(fu.resolved_date) }}</td>
            <td>{{ fu.remarks || '—' }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Footer (print only) -->
      <div class="report-footer print-only">
        <span>Zurich Finance Admin Monitoring System</span>
        <span>Generated: {{ format(new Date(), 'dd-MMM-yyyy h:mm a') }}</span>
      </div>

    </div>
  </div>
</template>

<style scoped>
.reports-page { display: flex; flex-direction: column; gap: 1.25rem; }

/* ── Filter card ── */
.filter-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 1.25rem 1.5rem;
}
.filter-card__title {
  font-size: 1rem; font-weight: 700; color: #1e293b;
  margin-bottom: 1rem;
}
.filter-card__row {
  display: flex; flex-wrap: wrap; gap: 1.25rem;
  margin-bottom: 1rem;
}
.filter-field {
  display: flex; flex-direction: column; gap: 0.3rem;
  min-width: 180px;
}
.filter-label {
  font-size: 0.7rem; font-weight: 700; color: #64748b;
  letter-spacing: 0.06em; text-transform: uppercase;
}
.filter-field :deep(.p-calendar),
.filter-field :deep(.p-dropdown) { width: 100%; }
.filter-card__actions {
  display: flex; align-items: center; gap: 0.75rem;
}
.clear-btn {
  display: inline-flex; align-items: center; gap: 0.3rem;
  background: none; border: none; font-size: 0.82rem;
  color: #64748b; cursor: pointer;
}
.clear-btn:hover { color: #ef4444; }

/* ── Report output ── */
.report-output {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 1.5rem;
}

/* ── Report header ── */
.report-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 1rem;
  border-bottom: 2px solid #1e293b;
  margin-bottom: 1rem;
}
.report-header__company {
  font-size: 1.1rem; font-weight: 800; color: #1e293b;
}
.report-header__system {
  font-size: 0.75rem; color: #64748b;
}
.report-header__title {
  font-size: 1rem; font-weight: 700; color: #1e293b; text-align: right;
}
.report-header__sub {
  font-size: 0.78rem; color: #64748b; text-align: right;
}
.report-header__date {
  font-size: 0.72rem; color: #94a3b8; text-align: right; margin-top: 0.2rem;
}

/* ── Summary row ── */
.report-summary {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 1rem;
}
.summary-pill {
  background: #f1f5f9; border-radius: 999px;
  padding: 0.2rem 0.75rem; font-size: 0.8rem; color: #475569; font-weight: 500;
}

/* ── Table ── */
.report-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}
.report-table th {
  background: #1e293b;
  color: #fff;
  text-align: left;
  padding: 0.5rem 0.6rem;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
}
.report-table td {
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: top;
  color: #1e293b;
}
.report-table tbody tr:nth-child(even) td { background: #f8fafc; }

.mod-badge {
  display: inline-block; padding: 0.1rem 0.45rem;
  border-radius: 4px; font-size: 0.68rem; font-weight: 700;
}
.mod-badge.borrowed    { background: #fce7f3; color: #9d174d; }
.mod-badge.transmittal { background: #dbeafe; color: #1e40af; }

.status-pill {
  display: inline-block; padding: 0.1rem 0.5rem;
  border-radius: 999px; font-size: 0.72rem; font-weight: 600;
}
.status-pill.pending  { background: #fef3c7; color: #92400e; }
.status-pill.resolved { background: #d1fae5; color: #065f46; }

.empty-state {
  padding: 2rem; text-align: center;
  color: #94a3b8; font-style: italic;
}

/* ── Print footer ── */
.report-footer {
  display: none;
  justify-content: space-between;
  font-size: 0.72rem;
  color: #94a3b8;
  padding-top: 1rem;
  border-top: 1px solid #e2e8f0;
  margin-top: 1.5rem;
}
</style>

<!-- Print styles — global so they affect the whole page -->
<style>
@media print {
  .app-sidebar,
  .app-header,
  .no-print {
    display: none !important;
  }

  .app-content {
    padding: 0 !important;
  }

  .app-main {
    width: 100% !important;
  }

  .report-output {
    border: none !important;
    border-radius: 0 !important;
    padding: 0 !important;
  }

  .filter-card {
    display: none !important;
  }

  .report-footer {
    display: flex !important;
  }

  .report-table th {
    background: #1e293b !important;
    color: #fff !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .report-table tbody tr:nth-child(even) td {
    background: #f8fafc !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .mod-badge,
  .status-pill {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
</style>
