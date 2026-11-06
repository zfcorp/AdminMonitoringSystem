<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Dropdown from 'primevue/dropdown'
import Calendar from 'primevue/calendar'
import { useRecordsStore } from '../stores/records'
import { useStatusesStore } from '../stores/statuses'
import { useBranchesStore } from '../stores/branches'
import { useAuthStore } from '../stores/auth'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { format } from 'date-fns'
import { exportToExcel, exportToCsv } from '../utils/export'

const router        = useRouter()
const recordsStore  = useRecordsStore()
const statusesStore = useStatusesStore()
const branchesStore = useBranchesStore()
const authStore     = useAuthStore()
const toast         = useToast()
const confirm       = useConfirm()

const availableYears  = ref([])
const selectedYear    = ref(null)
const searchQuery     = ref('')
const filterBranchId  = ref(null)
const filterStatusId  = ref(null)
const filterDateFrom  = ref(null)
const filterDateTo    = ref(null)
const showFilters     = ref(false)
const page            = ref(1)
const perPage         = 50
const exporting       = ref(false)

onMounted(async () => {
  await Promise.all([statusesStore.fetch(), branchesStore.fetch()])
  availableYears.value = await recordsStore.fetchArchiveYears('transmittal')
  if (availableYears.value.length) selectedYear.value = availableYears.value[0]
  await load()
})

function buildFilters() {
  return {
    search:   searchQuery.value    || undefined,
    branchId: filterBranchId.value || undefined,
    statusId: filterStatusId.value || undefined,
    dateFrom: filterDateFrom.value ? format(filterDateFrom.value, 'yyyy-MM-dd') : undefined,
    dateTo:   filterDateTo.value   ? format(filterDateTo.value,   'yyyy-MM-dd') : undefined,
    year:     selectedYear.value   || undefined,
  }
}

async function load() {
  await recordsStore.fetch({
    module:          'transmittal',
    includeArchived: true,
    page:            page.value,
    perPage,
    filters: buildFilters(),
  })
}

async function selectYear(year) {
  selectedYear.value = year
  page.value = 1
  await load()
}

function onSearch() { page.value = 1; load() }

function resetFilters() {
  searchQuery.value    = ''
  filterBranchId.value = null
  filterStatusId.value = null
  filterDateFrom.value = null
  filterDateTo.value   = null
  page.value = 1
  load()
}

function formatDate(val) {
  if (!val) return '—'
  try { return format(new Date(val), 'dd-MMM-yyyy') } catch { return val }
}

function openDetail(record) {
  router.push({ name: 'record-detail', params: { id: record.id } })
}

async function handleRestore(record) {
  confirm.require({
    message: `Restore record ${record.reference_number} for ${record.clients?.name}? It will return to the active Transmittal list.`,
    header: 'Restore Record',
    acceptLabel: 'Restore',
    rejectLabel: 'Cancel',
    accept: async () => {
      const { error } = await recordsStore.restore(record.id)
      if (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 5000 })
        return
      }
      toast.add({ severity: 'success', summary: 'Restored', detail: `${record.reference_number} returned to Transmittal.`, life: 3000 })
      availableYears.value = await recordsStore.fetchArchiveYears('transmittal')
      await load()
    },
  })
}

async function doExcelExport() {
  exporting.value = true
  await exportToExcel(recordsStore.records, 'transmittal')
  exporting.value = false
}
async function doCsvExport() {
  exporting.value = true
  await exportToCsv(recordsStore.records, 'transmittal')
  exporting.value = false
}
</script>

<template>
  <div class="archive-page">

    <!-- Year tabs -->
    <div class="year-tabs">
      <button v-if="!availableYears.length" class="year-tab year-tab--empty" disabled>
        No archived records yet
      </button>
      <button
        v-for="year in availableYears"
        :key="year"
        :class="['year-tab', { 'year-tab--active': selectedYear === year }]"
        @click="selectYear(year)"
      >{{ year }}</button>
    </div>

    <!-- Topbar -->
    <div class="topbar">
      <InputText v-model="searchQuery" placeholder="Search client name, account, reference…"
        @keydown.enter="onSearch" class="topbar__search" />
      <button :class="['filter-toggle', { 'filter-toggle--active': showFilters }]" @click="showFilters = !showFilters">
        <i class="pi pi-filter" /> Filters
      </button>
      <span class="total-label">{{ recordsStore.totalCount }} record(s)</span>
      <div class="topbar__spacer" />
      <button class="export-btn" :disabled="exporting" @click="doExcelExport" title="Excel">
        <i class="pi pi-file-excel" /> Excel
      </button>
      <button class="export-btn" :disabled="exporting" @click="doCsvExport" title="CSV">
        <i class="pi pi-file" /> CSV
      </button>
    </div>

    <!-- Filter panel -->
    <div v-if="showFilters" class="filter-panel">
      <div class="filter-panel__row">
        <div class="filter-panel__field">
          <span class="filter-label">PURPOSE / STATUS</span>
          <Dropdown v-model="filterStatusId" :options="statusesStore.transmittalStatuses"
            optionLabel="name" optionValue="id" placeholder="All Statuses" showClear />
        </div>
        <div class="filter-panel__field">
          <span class="filter-label">BRANCH</span>
          <Dropdown v-model="filterBranchId" :options="branchesStore.branches"
            optionLabel="name" optionValue="id" placeholder="All Branches" showClear filter />
        </div>
        <div class="filter-panel__field">
          <span class="filter-label">DATE TRANSMITTED FROM</span>
          <Calendar v-model="filterDateFrom" dateFormat="dd-M-yy" showIcon placeholder="Start date" />
        </div>
        <div class="filter-panel__field">
          <span class="filter-label">DATE TRANSMITTED TO</span>
          <Calendar v-model="filterDateTo" dateFormat="dd-M-yy" showIcon placeholder="End date" />
        </div>
      </div>
      <div class="filter-panel__actions">
        <Button label="Apply" icon="pi pi-search" size="small" @click="onSearch" />
        <button class="clear-btn" @click="resetFilters"><i class="pi pi-times" /> Clear Filters</button>
      </div>
    </div>

    <!-- Archive notice -->
    <div class="archive-notice">
      <i class="pi pi-info-circle" />
      These records are archived and read-only. Only Admins can restore them to the active Transmittal list.
    </div>

    <!-- Table -->
    <DataTable :value="recordsStore.records" :loading="recordsStore.loading" stripedRows>
      <Column field="id" header="No." style="width:50px">
        <template #body="slotProps">{{ slotProps.index + 1 }}</template>
      </Column>
      <Column field="client_id" header="Client Name">
        <template #body="slotProps">
          <span class="client-name">{{ slotProps.data.clients?.name || '—' }}</span>
        </template>
      </Column>
      <Column field="client_account_id" header="Account" style="width:130px">
        <template #body="slotProps">{{ slotProps.data.client_accounts?.account_number || '—' }}</template>
      </Column>
      <Column field="date_released" header="Date Released" style="width:120px">
        <template #body="slotProps">{{ formatDate(slotProps.data.date_released) }}</template>
      </Column>
      <Column field="branch_id" header="Branch">
        <template #body="slotProps">{{ slotProps.data.branches?.name || '—' }}</template>
      </Column>
      <Column field="document_transmitted" header="Document Transmitted">
        <template #body="slotProps">{{ slotProps.data.document_transmitted || '—' }}</template>
      </Column>
      <Column field="purpose_status_id" header="Purpose / Status">
        <template #body="slotProps">
          <span class="status-badge">{{ slotProps.data.statuses?.name || '—' }}</span>
        </template>
      </Column>
      <Column field="received_by" header="Received By">
        <template #body="slotProps">{{ slotProps.data.received_by || '—' }}</template>
      </Column>
      <Column field="date_transmitted" header="Date Transmitted" style="width:130px">
        <template #body="slotProps">{{ formatDate(slotProps.data.date_transmitted) }}</template>
      </Column>
      <Column field="archived_at" header="Archived On" style="width:130px">
        <template #body="slotProps">
          <span class="archived-date">{{ formatDate(slotProps.data.archived_at) }}</span>
        </template>
      </Column>
      <Column header="Actions" style="width:100px">
        <template #body="slotProps">
          <div class="action-btns">
            <button class="act-btn act-btn--view" @click.stop="openDetail(slotProps.data)" title="View Details">
              <i class="pi pi-eye" />
            </button>
            <button
              v-if="authStore.isAdmin()"
              class="act-btn act-btn--restore"
              @click.stop="handleRestore(slotProps.data)"
              title="Restore to Active"
            >
              <i class="pi pi-undo" />
            </button>
          </div>
        </template>
      </Column>
    </DataTable>

  </div>
</template>

<style scoped>
.archive-page { display: flex; flex-direction: column; gap: 0.75rem; }

.year-tabs {
  display: flex; gap: 0.4rem; flex-wrap: wrap;
  padding-bottom: 0.5rem; border-bottom: 2px solid #e2e8f0;
}
.year-tab {
  padding: 0.35rem 1rem; border: 1px solid #e2e8f0; border-radius: 6px;
  background: #fff; font-size: 0.85rem; font-weight: 500; color: #475569;
  cursor: pointer; transition: background 0.12s, border-color 0.12s, color 0.12s;
}
.year-tab:hover { background: #f1f5f9; }
.year-tab--active { background: #7c3aed; color: #fff; border-color: #7c3aed; }
.year-tab--empty { color: #94a3b8; cursor: default; font-style: italic; border: none; background: none; }

.topbar { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
.topbar__search { width: 280px; }
.topbar__spacer { flex: 1; }

.filter-toggle {
  display: inline-flex; align-items: center; gap: 0.35rem;
  padding: 0.4rem 0.9rem; border: 1px solid #cbd5e1; border-radius: 6px;
  background: #fff; color: #475569; font-size: 0.85rem; font-weight: 500; cursor: pointer;
}
.filter-toggle:hover { background: #f1f5f9; }
.filter-toggle--active { background: #ede9fe; border-color: #a78bfa; color: #7c3aed; }

.export-btn {
  display: inline-flex; align-items: center; gap: 0.3rem;
  padding: 0.4rem 0.85rem; border: 1px solid #cbd5e1; border-radius: 6px;
  background: #fff; color: #475569; font-size: 0.85rem; font-weight: 500; cursor: pointer;
}
.export-btn:hover { background: #f1f5f9; }
.export-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.filter-panel {
  background: #f8fafc; border: 1px solid #e2e8f0;
  border-radius: 8px; padding: 1rem 1.25rem 0.75rem;
}
.filter-panel__row { display: flex; flex-wrap: wrap; gap: 1.25rem; margin-bottom: 0.75rem; }
.filter-panel__field { display: flex; flex-direction: column; gap: 0.3rem; min-width: 180px; }
.filter-label {
  font-size: 0.7rem; font-weight: 700; color: #64748b;
  letter-spacing: 0.06em; text-transform: uppercase;
}
.filter-panel__field :deep(.p-dropdown),
.filter-panel__field :deep(.p-calendar) { width: 100%; }
.filter-panel__actions { display: flex; align-items: center; gap: 0.75rem; }
.clear-btn {
  display: inline-flex; align-items: center; gap: 0.3rem;
  background: none; border: none; font-size: 0.82rem; color: #64748b; cursor: pointer;
}
.clear-btn:hover { color: #ef4444; }

.archive-notice {
  display: flex; align-items: center; gap: 0.5rem;
  background: #ede9fe; color: #5b21b6;
  border: 1px solid #c4b5fd; border-radius: 6px;
  padding: 0.5rem 0.85rem; font-size: 0.8rem;
}

.action-btns { display: flex; align-items: center; gap: 0.3rem; }
.act-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border: none; border-radius: 6px;
  cursor: pointer; font-size: 0.85rem; transition: background 0.15s;
}
.act-btn--view    { color: #2563eb; background: #eff6ff; }
.act-btn--view:hover { background: #dbeafe; }
.act-btn--restore { color: #0891b2; background: #ecfeff; }
.act-btn--restore:hover { background: #cffafe; }

.returned { color: #065f46; font-size: 0.83rem; }
.archived-date { color: #7c3aed; font-size: 0.83rem; }
.dim { color: #94a3b8; }
</style>
