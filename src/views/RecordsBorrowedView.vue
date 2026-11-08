<script setup>
import { ref, computed, onMounted } from 'vue'
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
import { useConfirmDelete } from '../composables/useConfirmDelete'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { format } from 'date-fns'
import { exportToExcel, exportToCsv } from '../utils/export'

function formatDate(val) {
  if (!val) return '—'
  try { return format(new Date(val), 'dd-MMM-yyyy') } catch { return val }
}

const router      = useRouter()
const recordsStore = useRecordsStore()
const statusesStore = useStatusesStore()
const branchesStore = useBranchesStore()
const authStore   = useAuthStore()
const { confirmDelete } = useConfirmDelete()
const confirm     = useConfirm()
const toast       = useToast()

const searchQuery = ref('')
const filterBranchId = ref(null)
const filterStatusId = ref(null)
const filterDateFrom = ref(null)
const filterDateTo = ref(null)
const showFilters = ref(false)
const page = ref(1)
const perPage = 50
const selectedRecords = ref([])
const bulkArchiving = ref(false)

const totalPages = computed(() => Math.max(1, Math.ceil(recordsStore.totalCount / perPage)))

onMounted(async () => {
  await Promise.all([statusesStore.fetch(), branchesStore.fetch()])
  await load()
})

function buildFilters() {
  return {
    search: searchQuery.value || undefined,
    branchId: filterBranchId.value || undefined,
    statusId: filterStatusId.value || undefined,
    dateFrom: filterDateFrom.value ? format(filterDateFrom.value, 'yyyy-MM-dd') : undefined,
    dateTo: filterDateTo.value ? format(filterDateTo.value, 'yyyy-MM-dd') : undefined,
  }
}

async function load() {
  await recordsStore.fetch({
    module: 'borrowed',
    page: page.value,
    perPage,
    filters: buildFilters(),
  })
}

function onSearch() { page.value = 1; load() }

function resetFilters() {
  searchQuery.value = ''
  filterBranchId.value = null
  filterStatusId.value = null
  filterDateFrom.value = null
  filterDateTo.value = null
  page.value = 1
  load()
}

const exporting = ref(false)

async function doExcelExport() {
  exporting.value = true
  await exportToExcel(recordsStore.records, 'borrowed')
  exporting.value = false
}

async function doCsvExport() {
  exporting.value = true
  await exportToCsv(recordsStore.records, 'borrowed')
  exporting.value = false
}

function openDetail(record) {
  router.push({ name: 'record-detail', params: { id: record.id } })
}

async function handleArchive(record) {
  const { eligible, reason } = await recordsStore.checkArchiveEligibility(record)
  if (!eligible) {
    toast.add({ severity: 'warn', summary: 'Cannot Archive', detail: reason, life: 7000 })
    return
  }
  confirm.require({
    message: `Archive record ${record.reference_number} for ${record.clients?.name}? It will be moved to Borrowed Archive and removed from this list.`,
    header: 'Archive Record',
    acceptLabel: 'Archive',
    rejectLabel: 'Cancel',
    accept: async () => {
      const { error } = await recordsStore.archive(record.id)
      if (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 5000 })
        return
      }
      toast.add({ severity: 'success', summary: 'Archived', detail: `${record.reference_number} moved to Borrowed Archive.`, life: 3000 })
      load()
    },
  })
}

function openNew() {
  router.push({ name: 'record-new' })
}

function handleDelete(record) {
  confirmDelete({
    message: `Delete record ${record.reference_number} for ${record.clients?.name}? This cannot be undone.`,
    onAccept: async () => {
      const { error } = await recordsStore.remove(record.id)
      if (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 5000 })
        return
      }
      toast.add({ severity: 'success', summary: 'Deleted', detail: 'Record deleted.', life: 3000 })
      load()
    },
  })
}

async function handleBulkArchive() {
  if (!selectedRecords.value.length) return
  confirm.require({
    message: `Archive ${selectedRecords.value.length} selected record(s)? They will be moved to Borrowed Archive.`,
    header: 'Bulk Archive',
    acceptLabel: 'Archive All',
    rejectLabel: 'Cancel',
    accept: async () => {
      bulkArchiving.value = true
      const ids = selectedRecords.value.map((r) => r.id)
      const { error } = await recordsStore.bulkArchive(ids)
      bulkArchiving.value = false
      if (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 5000 })
        return
      }
      toast.add({ severity: 'success', summary: 'Archived', detail: `${ids.length} record(s) moved to Borrowed Archive.`, life: 3000 })
      selectedRecords.value = []
      load()
    },
  })
}
</script>

<template>
  <div>

    <!-- Search + Filter toggle -->
    <div class="topbar">
      <InputText v-model="searchQuery" placeholder="Search client name or account ID…" @keydown.enter="onSearch" class="topbar__search" />
      <button :class="['filter-toggle', { 'filter-toggle--active': showFilters }]" @click="showFilters = !showFilters">
        <i class="pi pi-filter" /> Filters
      </button>
      <span class="total-label">{{ recordsStore.totalCount }} record(s)</span>
      <div class="topbar__spacer" />
      <Button
        v-if="authStore.isAdmin() && selectedRecords.length"
        :label="`Archive Selected (${selectedRecords.length})`"
        icon="pi pi-box"
        severity="warning"
        size="small"
        :loading="bulkArchiving"
        @click="handleBulkArchive"
      />
      <div class="page-controls">
        <button class="page-btn" :disabled="page === 1" @click="page--; load()">
          <i class="pi pi-chevron-left" />
        </button>
        <span class="page-label">Page {{ page }} of {{ totalPages }}</span>
        <button class="page-btn" :disabled="page >= totalPages" @click="page++; load()">
          <i class="pi pi-chevron-right" />
        </button>
      </div>
      <button class="export-btn" :disabled="exporting" @click="doExcelExport" title="Download Excel">
        <i class="pi pi-file-excel" /> Excel
      </button>
      <button class="export-btn" :disabled="exporting" @click="doCsvExport" title="Download CSV">
        <i class="pi pi-file" /> CSV
      </button>
      <Button label="New Record" icon="pi pi-plus" @click="openNew" />
    </div>

    <!-- Expanded filter panel -->
    <div v-if="showFilters" class="filter-panel">
      <div class="filter-panel__row">
        <div class="filter-panel__field">
          <span class="filter-label">PURPOSE / STATUS</span>
          <Dropdown v-model="filterStatusId" :options="statusesStore.borrowedStatuses" optionLabel="name" optionValue="id"
            placeholder="All Statuses" showClear />
        </div>
        <div class="filter-panel__field">
          <span class="filter-label">BRANCH</span>
          <Dropdown v-model="filterBranchId" :options="branchesStore.branches" optionLabel="name" optionValue="id"
            placeholder="All Branches" showClear filter />
        </div>
        <div class="filter-panel__field">
          <span class="filter-label">DATE RELEASED FROM</span>
          <Calendar v-model="filterDateFrom" dateFormat="dd-M-yy" showIcon placeholder="Start date" />
        </div>
        <div class="filter-panel__field">
          <span class="filter-label">DATE RELEASED TO</span>
          <Calendar v-model="filterDateTo" dateFormat="dd-M-yy" showIcon placeholder="End date" />
        </div>
      </div>
      <div class="filter-panel__actions">
        <Button label="Apply" icon="pi pi-search" size="small" @click="onSearch" />
        <button class="clear-btn" @click="resetFilters"><i class="pi pi-times" /> Clear Filters</button>
      </div>
    </div>

    <DataTable
      v-model:selection="selectedRecords"
      :value="recordsStore.records"
      :loading="recordsStore.loading"
      stripedRows
      dataKey="id"
    >
      <Column selectionMode="multiple" style="width: 40px" />
      <Column field="id" header="No." style="width: 50px">
        <template #body="slotProps">{{ slotProps.index + 1 }}</template>
      </Column>
      <Column field="client_id" header="Client Name">
        <template #body="slotProps">
          <span class="client-name">{{ slotProps.data.clients?.name || '—' }}</span>
        </template>
      </Column>
      <Column field="client_account_id" header="Account" style="width: 130px">
        <template #body="slotProps">
          {{ slotProps.data.client_accounts?.account_number || '—' }}
        </template>
      </Column>
      <Column field="date_released" header="Date Released" style="width: 120px">
        <template #body="slotProps">{{ formatDate(slotProps.data.date_released) }}</template>
      </Column>
      <Column field="branch_id" header="Branch">
        <template #body="slotProps">
          {{ slotProps.data.branches?.name || '—' }}
        </template>
      </Column>
      <Column field="document_transmitted" header="Document Transmitted">
        <template #body="slotProps">
          <span v-if="!slotProps.data.document_transmitted" class="dim">—</span>
          <span v-else class="doc-tags">
            <span
              v-for="tag in slotProps.data.document_transmitted.split(',').map(s => s.trim()).filter(Boolean)"
              :key="tag"
              class="doc-tag"
            >{{ tag }}</span>
          </span>
        </template>
      </Column>
      <Column field="purpose_status_id" header="Purpose / Status">
        <template #body="slotProps">
          <span class="status-badge">{{ slotProps.data.statuses?.name || '—' }}</span>
        </template>
      </Column>
      <Column field="date_transmitted" header="Date Transmitted" style="width: 130px">
        <template #body="slotProps">{{ formatDate(slotProps.data.date_transmitted) }}</template>
      </Column>
      <Column field="received_by" header="Received By">
        <template #body="slotProps">{{ slotProps.data.received_by || '—' }}</template>
      </Column>
      <Column field="date_returned" header="Date Returned" style="width: 120px">
        <template #body="slotProps">
          <span v-if="slotProps.data.date_returned" class="returned">{{ formatDate(slotProps.data.date_returned) }}</span>
          <span v-else class="dim">—</span>
        </template>
      </Column>
      <Column header="Actions" style="width: 150px">
        <template #body="slotProps">
          <div class="action-btns">
            <button class="act-btn act-btn--view" @click.stop="openDetail(slotProps.data)" title="View">
              <i class="pi pi-eye" />
            </button>
            <button class="act-btn act-btn--edit" @click.stop="router.push({ name: 'record-edit', params: { id: slotProps.data.id } })" title="Edit">
              <i class="pi pi-pencil" />
            </button>
            <button
              v-if="authStore.isAdmin()"
              class="act-btn act-btn--archive"
              @click.stop="handleArchive(slotProps.data)"
              title="Archive"
            >
              <i class="pi pi-box" />
            </button>
            <button
              v-if="authStore.isAdmin()"
              class="act-btn act-btn--delete"
              @click.stop="handleDelete(slotProps.data)"
              title="Delete"
            >
              <i class="pi pi-trash" />
            </button>
          </div>
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<style scoped>
/* ── Top bar ── */
.topbar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}
.topbar__search { width: 260px; }
.topbar__spacer { flex: 1; }

.filter-toggle {
  display: inline-flex; align-items: center; gap: 0.35rem;
  padding: 0.4rem 0.9rem;
  border: 1px solid #cbd5e1; border-radius: 6px;
  background: #fff; color: #475569;
  font-size: 0.85rem; font-weight: 500; cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
}
.filter-toggle:hover { background: #f1f5f9; }
.filter-toggle--active { background: #eff6ff; border-color: #93c5fd; color: #2563eb; }

.export-btn {
  display: inline-flex; align-items: center; gap: 0.3rem;
  padding: 0.4rem 0.85rem;
  border: 1px solid #cbd5e1; border-radius: 6px;
  background: #fff; color: #475569;
  font-size: 0.85rem; font-weight: 500; cursor: pointer;
  transition: background 0.12s;
}
.export-btn:hover { background: #f1f5f9; }
.export-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── Filter panel ── */
.filter-panel {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1rem 1.25rem 0.75rem;
  margin-bottom: 0.75rem;
}
.filter-panel__row {
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem;
  margin-bottom: 0.75rem;
}
.filter-panel__field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 180px;
}
.filter-label {
  font-size: 0.7rem;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.filter-panel__field :deep(.p-dropdown),
.filter-panel__field :deep(.p-calendar) {
  width: 100%;
}
.filter-panel__actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.clear-btn {
  display: inline-flex; align-items: center; gap: 0.3rem;
  background: none; border: none;
  font-size: 0.82rem; color: #64748b;
  cursor: pointer; padding: 0.3rem 0;
}
.clear-btn:hover { color: #ef4444; }

/* ── Actions ── */
.action-btns { display: flex; align-items: center; gap: 0.3rem; }
.act-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border: none; border-radius: 6px;
  cursor: pointer; font-size: 0.85rem;
  transition: background 0.15s, color 0.15s;
}
.act-btn--view   { color: #2563eb; background: #eff6ff; }
.act-btn--view:hover { background: #dbeafe; }
.act-btn--edit   { color: #0369a1; background: #f0f9ff; }
.act-btn--edit:hover { background: #e0f2fe; }
.act-btn--archive { color: #7c3aed; background: #ede9fe; }
.act-btn--archive:hover { background: #ddd6fe; }
.act-btn--delete { color: #dc2626; background: #fef2f2; }
.act-btn--delete:hover { background: #fee2e2; }

.truncate {
  display: inline-block; max-width: 160px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.returned { color: #065f46; font-size: 0.83rem; }
.dim { color: #94a3b8; }

.doc-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}
.doc-tag {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  background: #dbeafe;
  color: #1e40af;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  white-space: nowrap;
}

.page-controls {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.page-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #fff;
  color: #475569;
  cursor: pointer;
  font-size: 0.8rem;
  transition: background 0.12s;
}
.page-btn:hover:not(:disabled) { background: #f1f5f9; }
.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.page-label {
  font-size: 0.82rem;
  color: #475569;
  white-space: nowrap;
}
</style>
