<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Calendar from 'primevue/calendar'
import Dropdown from 'primevue/dropdown'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { useToast } from 'primevue/usetoast'
import { useRecordsStore } from '../stores/records'
import { useStatusesStore } from '../stores/statuses'
import { useBranchesStore } from '../stores/branches'
import HybridClientSelector from '../components/client/HybridClientSelector.vue'
import { format, parseISO } from 'date-fns'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const recordsStore = useRecordsStore()
const statusesStore = useStatusesStore()
const branchesStore = useBranchesStore()

const selectorRef = ref(null)
const editingId = computed(() => route.params.id ? String(route.params.id) : null)
const isEditing = computed(() => !!editingId.value)

// Determine module from route name or existing record
const recordModule = ref(
  route.name === 'transmittal-new' ? 'transmittal' : 'borrowed'
)

const originalValues = ref({})

const form = ref({
  client_id: null,
  client_account_id: null,
  branch_id: null,
  document_transmitted: '',
  purpose_status_id: null,
  date_released: null,
  date_transmitted: null,
  received_by: '',
  date_returned: null,
  remarks: '',
})

// Filter statuses by module
const availableStatuses = computed(() =>
  recordModule.value === 'transmittal'
    ? statusesStore.transmittalStatuses
    : statusesStore.borrowedStatuses
)

// Document Transmitted checkboxes — quick-fill shortcuts
const docChecks = ref({ orcr: false, key: false })

function syncDocuments() {
  const current = form.value.document_transmitted || ''
  // Build list of other text (anything not ORCR/Key)
  const parts = current.split(',').map((s) => s.trim()).filter(Boolean)
  const others = parts.filter((p) => !['orcr', 'key'].includes(p.toLowerCase()))

  const selected = []
  if (docChecks.value.orcr) selected.push('ORCR')
  if (docChecks.value.key)  selected.push('Key')

  form.value.document_transmitted = [...selected, ...others].join(', ')
}

function loadDocChecks(val) {
  const parts = (val || '').split(',').map((s) => s.trim().toLowerCase())
  docChecks.value.orcr = parts.includes('orcr')
  docChecks.value.key  = parts.includes('key')
}
// New status inline creation
const showStatusDialog = ref(false)
const newStatusName = ref('')
const savingStatus = ref(false)

async function createStatus() {
  if (!newStatusName.value.trim()) return
  savingStatus.value = true
  const { data, error } = await statusesStore.create(newStatusName.value, recordModule.value)
  savingStatus.value = false
  if (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 4000 })
    return
  }
  form.value.purpose_status_id = data.id
  newStatusName.value = ''
  showStatusDialog.value = false
  toast.add({ severity: 'success', summary: 'Created', detail: `Status "${data.name}" added.`, life: 3000 })
}

const saving = ref(false)

onMounted(async () => {
  await Promise.all([
    statusesStore.fetch(),
    branchesStore.fetch(),
  ])

  if (editingId.value) {
    const { data, error } = await recordsStore.getById(editingId.value)
    if (error || !data) {
      toast.add({ severity: 'error', summary: 'Not Found', detail: 'Record not found.', life: 5000 })
      router.push({ name: 'borrowed-records' })
      return
    }

    recordModule.value = data.module || 'borrowed'

    // Guard: archived records are read-only
    if (data.is_archived) {
      toast.add({ severity: 'warn', summary: 'Read-only', detail: 'Archived records cannot be edited. Restore first.', life: 5000 })
      const detailRoute = data.module === 'transmittal' ? 'transmittal-detail' : 'record-detail'
      router.push({ name: detailRoute, params: { id: editingId.value } })
      return
    }

    const f = {
      client_id: data.client_id,
      client_account_id: data.client_account_id,
      branch_id: data.branch_id,
      document_transmitted: data.document_transmitted || '',
      purpose_status_id: data.purpose_status_id,
      date_released: data.date_released ? parseISO(data.date_released) : null,
      date_transmitted: data.date_transmitted ? parseISO(data.date_transmitted) : null,
      received_by: data.received_by || '',
      date_returned: data.date_returned ? parseISO(data.date_returned) : null,
      remarks: data.remarks || '',
    }
    form.value = f
    originalValues.value = { ...data }
    loadDocChecks(data.document_transmitted)
  }
})

function formatDate(d) {
  if (!d) return null
  if (d instanceof Date) return format(d, 'yyyy-MM-dd')
  return d
}

async function save() {
  if (selectorRef.value && !isEditing.value) {
    const ids = await selectorRef.value.ensureCreated()
    if (ids?.clientId) form.value.client_id = ids.clientId
    if (ids?.accountId) form.value.client_account_id = ids.accountId
  }

  if (!form.value.client_id) {
    toast.add({ severity: 'warn', summary: 'Required', detail: 'Client Name is required.', life: 3000 })
    return
  }
  if (!form.value.client_account_id) {
    toast.add({ severity: 'warn', summary: 'Required', detail: 'Account ID is required.', life: 3000 })
    return
  }

  saving.value = true

  const payload = {
    client_id: form.value.client_id,
    client_account_id: form.value.client_account_id,
    branch_id: form.value.branch_id || null,
    document_transmitted: form.value.document_transmitted || null,
    purpose_status_id: form.value.purpose_status_id || null,
    date_released: formatDate(form.value.date_released),
    date_transmitted: formatDate(form.value.date_transmitted),
    received_by: form.value.received_by || null,
    date_returned: formatDate(form.value.date_returned),
    remarks: form.value.remarks || null,
  }

  let result
  if (isEditing.value) {
    result = await recordsStore.update(editingId.value, payload, originalValues.value)
  } else {
    result = await recordsStore.create(payload, recordModule.value)
  }

  saving.value = false

  if (result.error) {
    toast.add({ severity: 'error', summary: 'Error', detail: result.error.message, life: 5000 })
    return
  }

  toast.add({
    severity: 'success',
    summary: isEditing.value ? 'Updated' : 'Created',
    detail: `Record ${result.data?.reference_number || ''} ${isEditing.value ? 'updated' : 'created'}.`,
    life: 3000,
  })

  const targetId = isEditing.value ? editingId.value : result.data?.id
  if (isEditing.value && targetId) {
    const detailRoute = recordModule.value === 'transmittal' ? 'transmittal-detail' : 'record-detail'
    router.push({ name: detailRoute, params: { id: targetId } })
  } else {
    router.push({ name: recordModule.value === 'transmittal' ? 'transmittal-records' : 'borrowed-records' })
  }
}

function cancel() {
  if (isEditing.value) {
    const detailRoute = recordModule.value === 'transmittal' ? 'transmittal-detail' : 'record-detail'
    router.push({ name: detailRoute, params: { id: editingId.value } })
  } else {
    router.push({ name: recordModule.value === 'transmittal' ? 'transmittal-records' : 'borrowed-records' })
  }
}
</script>

<template>
  <div>
    <div class="page-header">
      <h1>{{ isEditing ? 'Edit Record' : recordModule === 'transmittal' ? 'New Transmittal Record' : 'New Borrowed Record' }}</h1>
    </div>

    <div class="form-card">
      <!-- Client & Account -->
      <HybridClientSelector
        ref="selectorRef"
        v-model:clientId="form.client_id"
        v-model:accountId="form.client_account_id"
      />

      <!-- Branch -->
      <div class="form-row">
        <label>Branch
          <Dropdown
            v-model="form.branch_id"
            :options="branchesStore.branches"
            optionLabel="name"
            optionValue="id"
            placeholder="Select branch…"
            filter
            filterPlaceholder="Search branch…"
          />
        </label>
      </div>

      <!-- Document & Purpose/Status -->
      <div class="form-row form-row--two">
        <div class="form-field">
          <span class="field-label">Document Transmitted</span>
          <div class="doc-checks">
            <label class="check-item">
              <input type="checkbox" v-model="docChecks.orcr" @change="syncDocuments" />
              <span>ORCR</span>
            </label>
            <label class="check-item">
              <input type="checkbox" v-model="docChecks.key" @change="syncDocuments" />
              <span>Key</span>
            </label>
          </div>
          <InputText
            v-model="form.document_transmitted"
            placeholder="e.g. ORCR, Key, CR…"
          />
        </div>
        <div class="form-field">
          <span class="field-label">Purpose / Status</span>
          <div class="status-row">
            <Dropdown
              v-model="form.purpose_status_id"
              :options="availableStatuses"
              optionLabel="name"
              optionValue="id"
              placeholder="Select status…"
              class="status-dropdown"
            />
            <button class="add-status-btn" type="button" title="Add new status" @click.stop="showStatusDialog = true">
              <i class="pi pi-plus" />
            </button>
          </div>
          <span class="field-hint">Click + to add a new status</span>
        </div>
      </div>

      <!-- Dates row -->
      <div class="form-row form-row--two">
        <label>
          Date Released
          <span class="field-hint">When the motorcycle was released</span>
          <Calendar v-model="form.date_released" dateFormat="dd-M-yy" showIcon placeholder="Select date" />
        </label>
        <label>
          Date Transmitted
          <span class="field-hint">When the liaison got the documents</span>
          <Calendar v-model="form.date_transmitted" dateFormat="dd-M-yy" showIcon placeholder="Select date" />
        </label>
      </div>

      <!-- Received By & Date Returned -->
      <div class="form-row form-row--two">
        <label>Received By
          <InputText v-model="form.received_by" placeholder="Recipient name or delivery method" />
        </label>
        <label>
          Date Returned
          <span class="field-hint">Leave blank if not yet returned</span>
          <Calendar v-model="form.date_returned" dateFormat="dd-M-yy" showIcon placeholder="Select date" />
        </label>
      </div>

      <!-- Remarks -->
      <div class="form-row">
        <label>Remarks
          <Textarea v-model="form.remarks" rows="3" placeholder="Additional notes…" />
        </label>
      </div>

      <div class="form-actions">
        <Button label="Cancel" text @click="cancel" />
        <Button
          :label="isEditing ? 'Update Record' : 'Save Record'"
          icon="pi pi-check"
          :loading="saving"
          @click="save"
        />
      </div>
    </div>

    <!-- New Status Dialog -->
    <Dialog
      v-model:visible="showStatusDialog"
      header="Add New Status"
      :modal="true"
      style="width: 380px"
    >
      <div class="dialog-body">
        <label class="dialog-label">
          Status Name
          <InputText
            v-model="newStatusName"
            placeholder="Enter status name…"
            autofocus
            style="width: 100%"
            @keydown.enter="createStatus"
          />
        </label>
        <div class="dialog-module-note">
          Will be added to <strong>{{ recordModule === 'transmittal' ? 'Transmittal' : 'Borrowed' }}</strong> statuses.
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" text @click="showStatusDialog = false" />
        <Button label="Add Status" icon="pi pi-plus" :loading="savingStatus" @click="createStatus" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.form-row label,
.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  flex: 1;
  min-width: 0;
}

.field-label {
  font-size: 0.85rem;
  font-weight: 500;
  color: #475569;
}

/* Checkboxes quick-fill row */
.doc-checks {
  display: flex;
  gap: 1rem;
  align-items: center;
  padding: 0.35rem 0.65rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}

.check-item {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
  user-select: none;
}

.check-item input[type="checkbox"] {
  width: 15px;
  height: 15px;
  accent-color: #2563eb;
  cursor: pointer;
}

/* Status row with + button */
.status-row {
  display: flex;
  gap: 0.4rem;
  align-items: center;
}

.status-dropdown { flex: 1; }

.add-status-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 35px;
  height: 35px;
  flex-shrink: 0;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  cursor: pointer;
  color: #2563eb;
  font-size: 0.85rem;
  transition: background 0.15s;
}
.add-status-btn:hover { background: #dbeafe; border-color: #93c5fd; }

.dialog-label {
  display: flex; flex-direction: column; gap: 0.4rem;
  font-size: 0.85rem; font-weight: 500; color: #374151;
}
.dialog-module-note {
  font-size: 0.8rem; color: #64748b;
  background: #f8fafc; border-radius: 6px;
  padding: 0.4rem 0.65rem;
}

:deep(.p-inputtext),
:deep(.p-textarea),
:deep(.p-calendar),
:deep(.p-dropdown),
:deep(.p-autocomplete) {
  width: 100%;
}
</style>
