<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dropdown from 'primevue/dropdown'
import { useFollowUpsStore } from '../stores/followUps'
import { useCrudList } from '../composables/useCrudList'
import { useConfirmDelete } from '../composables/useConfirmDelete'
import { useToast } from 'primevue/usetoast'
import { format, parseISO } from 'date-fns'

const router = useRouter()
const toast = useToast()
const followUpsStore = useFollowUpsStore()
const { confirmDelete } = useConfirmDelete()

const {
  perPage,
  currentPage,
  sortField,
  sortOrder,
  lazyParams,
  items,
  totalCount,
  loading,
  loadData,
  onPage,
  onSort,
} = useCrudList(followUpsStore, {
  itemsKey: 'followUps',
  defaultSort: { field: 'follow_up_date', order: 'desc' },
})

const statusFilter = ref(null)
const statusOptions = [
  { label: 'All', value: null },
  { label: 'Pending', value: 'pending' },
  { label: 'Resolved', value: 'resolved' },
]

function currentFilters() {
  return { status: statusFilter.value || undefined }
}

onMounted(async () => {
  await loadData(currentFilters())
})

async function refresh() {
  await loadData(currentFilters())
}

function onPageHandler(event) {
  onPage(event)
  refresh()
}

function onSortHandler(event) {
  onSort(event)
  refresh()
}

function onFilter() {
  currentPage.value = 1
  refresh()
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy')
  } catch {
    return dateStr
  }
}

function parentInfo(row) {
  if (row.records) {
    const routeName = row.records.module === 'transmittal' ? 'transmittal-detail' : 'record-detail'
    return {
      type: row.records.module === 'transmittal' ? 'Transmittal' : 'Borrowed',
      ref: row.records.reference_number,
      client: row.records.clients?.name,
      account: row.records.client_accounts?.account_number,
      recordId: row.record_id,
      routeName,
    }
  }
  return { type: '—', ref: '—', client: '—', account: '—', recordId: null, routeName: null }
}

function goToNew() {
  router.push({ name: 'followup-new' })
}

function goToEdit(id) {
  router.push({ name: 'followup-edit', params: { id } })
}

async function handleResolve(record) {
  const { error } = await followUpsStore.markResolved(record.id)
  if (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 5000 })
    return
  }
  toast.add({ severity: 'success', summary: 'Resolved', detail: `Follow-up ${record.reference_number} marked as resolved.`, life: 3000 })
  await refresh()
}

function handleDelete(record) {
  confirmDelete({
    message: `Are you sure you want to delete follow-up ${record.reference_number}?`,
    onAccept: async () => {
      const { error } = await followUpsStore.remove(record.id)
      if (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 5000 })
        return
      }
      toast.add({ severity: 'success', summary: 'Deleted', detail: 'Follow-up deleted.', life: 3000 })
      await refresh()
    },
  })
}
</script>

<template>
  <div>
    <div class="page-header">
      <Button label="New Follow-up" icon="pi pi-plus" @click="goToNew" />
    </div>

    <div class="filter-bar">
      <Dropdown
        v-model="statusFilter"
        :options="statusOptions"
        optionLabel="label"
        optionValue="value"
        placeholder="Filter by status"
        showClear
        @change="onFilter"
      />
    </div>

    <div class="info-note">
      <i class="pi pi-info-circle"></i>
      Follow-ups are resolved manually. Returning a borrowed item does <strong>not</strong> auto-resolve its follow-ups.
    </div>

    <DataTable
      :value="items"
      :loading="loading"
      :lazy="true"
      :paginator="true"
      :rows="perPage"
      :totalRecords="totalCount"
      :first="lazyParams.first"
      @page="onPageHandler"
      @sort="onSortHandler"
      stripedRows
      removableSort
    >
      <Column header="No." style="width: 50px">
        <template #body="slotProps">{{ slotProps.index + 1 }}</template>
      </Column>

      <Column header="Client Name">
        <template #body="slotProps">
          <span class="client-name">{{ parentInfo(slotProps.data).client || '—' }}</span>
        </template>
      </Column>

      <Column header="Account ID" style="width: 120px">
        <template #body="slotProps">
          <span>{{ parentInfo(slotProps.data).account || '—' }}</span>
        </template>
      </Column>

      <Column header="Module" style="width: 110px">
        <template #body="slotProps">
          <span class="parent-badge" :class="parentInfo(slotProps.data).type.toLowerCase()">
            {{ parentInfo(slotProps.data).type || '—' }}
          </span>
        </template>
      </Column>

      <Column header="Ref. No." style="width: 100px">
        <template #body="slotProps">
          <RouterLink
            v-if="parentInfo(slotProps.data).routeName && parentInfo(slotProps.data).recordId"
            :to="{ name: parentInfo(slotProps.data).routeName, params: { id: parentInfo(slotProps.data).recordId } }"
            class="parent-ref-link"
          >{{ parentInfo(slotProps.data).ref }}</RouterLink>
          <span v-else>{{ parentInfo(slotProps.data).ref || '—' }}</span>
        </template>
      </Column>

      <Column field="follow_up_date" header="Follow-up Date" sortable style="width: 130px">
        <template #body="slotProps">{{ formatDate(slotProps.data.follow_up_date) }}</template>
      </Column>

      <Column field="subject" header="Subject" sortable />

      <Column field="details" header="Details">
        <template #body="slotProps">{{ slotProps.data.details || '—' }}</template>
      </Column>

      <Column field="status" header="Status" sortable style="width: 110px">
        <template #body="slotProps">
          <span v-if="slotProps.data.resolved_date" class="badge badge--resolved">Resolved</span>
          <span v-else class="badge badge--pending">{{ slotProps.data.status || 'Open' }}</span>
        </template>
      </Column>

      <Column field="resolved_date" header="Resolved Date" sortable style="width: 130px">
        <template #body="slotProps">{{ formatDate(slotProps.data.resolved_date) || '—' }}</template>
      </Column>

      <Column field="remarks" header="Remarks">
        <template #body="slotProps">{{ slotProps.data.remarks || '—' }}</template>
      </Column>

      <Column header="Actions" style="width: 110px">
        <template #body="slotProps">
          <div class="action-btns">
            <button
              v-if="!slotProps.data.resolved_date"
              class="act-btn act-btn--resolve"
              title="Mark as Resolved"
              @click="handleResolve(slotProps.data)"
            ><i class="pi pi-check" /></button>
            <button class="act-btn act-btn--edit" title="Edit" @click="goToEdit(slotProps.data.id)">
              <i class="pi pi-pencil" />
            </button>
            <button class="act-btn act-btn--delete" title="Delete" @click="handleDelete(slotProps.data)">
              <i class="pi pi-trash" />
            </button>
          </div>
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<style scoped>
.parent-badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
}
.parent-badge.transmittal { background: #dbeafe; color: #1e40af; }
.parent-badge.borrowed    { background: #fce7f3; color: #9d174d; }

.parent-ref-link {
  color: #2563eb;
  font-weight: 600;
  font-size: 0.875rem;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.parent-ref-link:hover { color: #1d4ed8; }

.action-btns { display: flex; align-items: center; gap: 0.3rem; }
.act-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border: none; border-radius: 6px;
  cursor: pointer; font-size: 0.8rem;
  transition: background 0.15s, color 0.15s;
}
.act-btn--resolve { color: #065f46; background: #d1fae5; }
.act-btn--resolve:hover { background: #a7f3d0; }
.act-btn--edit    { color: #0369a1; background: #f0f9ff; }
.act-btn--edit:hover { background: #e0f2fe; }
.act-btn--delete  { color: #dc2626; background: #fef2f2; }
.act-btn--delete:hover { background: #fee2e2; }
</style>
