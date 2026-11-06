<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Calendar from 'primevue/calendar'
import Dropdown from 'primevue/dropdown'
import Textarea from 'primevue/textarea'
import InputText from 'primevue/inputtext'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { useRecordsStore } from '../stores/records'
import { useFollowUpsStore } from '../stores/followUps'
import { useStatusesStore } from '../stores/statuses'
import { useBranchesStore } from '../stores/branches'
import { format, parseISO } from 'date-fns'

const route = useRoute()
const router = useRouter()
const confirm = useConfirm()
const toast = useToast()
const recordsStore = useRecordsStore()
const followUpsStore = useFollowUpsStore()
const statusesStore = useStatusesStore()
const branchesStore = useBranchesStore()

const recordId = computed(() => String(route.params.id))
const record = ref(null)
const history = ref([])
const followUps = ref([])
const loading = ref(true)
const activeTab = ref('details') // 'details' | 'followups' | 'history'

// Follow-up form
const fuForm = ref({ follow_up_date: null, subject: '', remarks: '' })
const fuSaving = ref(false)
const showFuForm = ref(false)

function openFuForm() {
  fuForm.value = { follow_up_date: null, subject: '', remarks: '' }
  showFuForm.value = true
}

function cancelFuForm() {
  showFuForm.value = false
}

onMounted(async () => {
  await Promise.all([statusesStore.fetch(), branchesStore.fetch()])
  await loadRecord()
})

async function loadRecord() {
  loading.value = true
  const [{ data: rec }, { data: hist }] = await Promise.all([
    recordsStore.getById(recordId.value),
    recordsStore.fetchHistory(recordId.value),
  ])
  record.value = rec
  history.value = hist || []
  await loadFollowUps()
  loading.value = false
}

async function loadFollowUps() {
  const { data } = await followUpsStore.fetchByParent('record', recordId.value)
  followUps.value = data || []
}

function formatDate(val) {
  if (!val) return '—'
  try { return format(parseISO(val), 'dd-MMM-yyyy') } catch { return val }
}

function formatDateTime(val) {
  if (!val) return '—'
  try { return format(parseISO(val), 'MMM d, yyyy h:mm a') } catch { return val }
}

const isBorrowed = computed(() => record.value?.module === 'borrowed')

function goToEdit() {
  router.push({ name: 'record-edit', params: { id: recordId.value } })
}

function goBack() {
  const mod = record.value?.module
  const archived = record.value?.is_archived
  if (mod === 'transmittal') {
    router.push({ name: archived ? 'archive-transmittal' : 'transmittal-records' })
  } else {
    router.push({ name: archived ? 'archive-borrowed' : 'borrowed-records' })
  }
}

// ── Inline Edit ───────────────────────────────────────────────
const editing = ref(false)
const editSaving = ref(false)
const editForm = ref({})

function startEdit() {
  editForm.value = {
    branch_id: record.value.branch_id,
    document_transmitted: record.value.document_transmitted || '',
    purpose_status_id: record.value.purpose_status_id,
    date_released: record.value.date_released ? parseISO(record.value.date_released) : null,
    date_transmitted: record.value.date_transmitted ? parseISO(record.value.date_transmitted) : null,
    received_by: record.value.received_by || '',
    date_returned: record.value.date_returned ? parseISO(record.value.date_returned) : null,
    remarks: record.value.remarks || '',
  }
  editing.value = true
}

function cancelEdit() {
  editing.value = false
}

function fmtDate(d) {
  if (!d) return null
  if (d instanceof Date) return format(d, 'yyyy-MM-dd')
  return d
}

async function saveEdit() {
  editSaving.value = true
  const payload = {
    branch_id: editForm.value.branch_id || null,
    document_transmitted: editForm.value.document_transmitted || null,
    purpose_status_id: editForm.value.purpose_status_id || null,
    date_released: fmtDate(editForm.value.date_released),
    date_transmitted: fmtDate(editForm.value.date_transmitted),
    received_by: editForm.value.received_by || null,
    date_returned: fmtDate(editForm.value.date_returned),
    remarks: editForm.value.remarks || null,
  }
  const { error } = await recordsStore.update(recordId.value, payload, record.value)
  editSaving.value = false
  if (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 5000 })
    return
  }
  toast.add({ severity: 'success', summary: 'Saved', detail: 'Record updated.', life: 3000 })
  editing.value = false
  await loadRecord()
}

const availableStatuses = computed(() =>
  record.value?.module === 'transmittal'
    ? statusesStore.transmittalStatuses
    : statusesStore.borrowedStatuses
)

// ── Follow-up ─────────────────────────────────────────────────

async function saveFollowUp() {
  if (!fuForm.value.follow_up_date) {
    toast.add({ severity: 'warn', summary: 'Required', detail: 'Follow-up date is required.', life: 3000 })
    return
  }

  fuSaving.value = true

  const payload = {
    record_id: Number(recordId.value),
    follow_up_date: format(fuForm.value.follow_up_date, 'yyyy-MM-dd'),
    subject: fuForm.value.subject || null,
    remarks: fuForm.value.remarks || null,
    status: 'Open',
  }

  const { error } = await followUpsStore.create(payload)
  fuSaving.value = false

  if (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 5000 })
    return
  }

  toast.add({ severity: 'success', summary: 'Follow-up added', detail: 'Visible in Follow-up Monitoring.', life: 3000 })
  fuForm.value = { follow_up_date: null, subject: '', remarks: '' }
  showFuForm.value = false
  await loadFollowUps()
}

async function resolveFollowUp(fu) {
  const { error } = await followUpsStore.markResolved(fu.id)
  if (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 5000 })
    return
  }
  toast.add({ severity: 'success', summary: 'Resolved', detail: 'Follow-up marked as resolved.', life: 3000 })
  await loadFollowUps()
}

async function deleteFollowUp(fu) {
  confirm.require({
    message: 'Delete this follow-up?',
    header: 'Confirm Delete',
    acceptLabel: 'Delete',
    rejectLabel: 'Cancel',
    accept: async () => {
      await followUpsStore.remove(fu.id)
      await loadFollowUps()
    },
  })
}

// ── History helpers ───────────────────────────────────────────

function activityIcon(activity) {
  const icons = {
    created:              'pi pi-plus-circle',
    updated:              'pi pi-pencil',
    moved_to_transmittal: 'pi pi-arrow-right',
    archived:             'pi pi-box',
    restored:             'pi pi-undo',
    deleted:              'pi pi-trash',
  }
  return icons[activity] || 'pi pi-circle'
}

function activityColor(activity) {
  const colors = {
    created:              '#22c55e',
    updated:              '#3b82f6',
    moved_to_transmittal: '#f59e0b',
    archived:             '#8b5cf6',
    restored:             '#06b6d4',
    deleted:              '#ef4444',
  }
  return colors[activity] || '#94a3b8'
}

function activityLabel(activity) {
  const labels = {
    created:              'Record Created',
    updated:              'Record Updated',
    moved_to_transmittal: 'Moved to Transmittal',
    archived:             'Record Archived',
    restored:             'Record Restored',
    deleted:              'Record Deleted',
  }
  return labels[activity] || activity
}
</script>

<template>
  <div>
    <!-- Back button -->
    <button class="back-btn" @click="goBack">
      ← Back to
      <span v-if="record?.module === 'transmittal' && record?.is_archived">Transmittal Archive</span>
      <span v-else-if="record?.module === 'transmittal'">Transmittal</span>
      <span v-else-if="record?.is_archived">Borrowed Archive</span>
      <span v-else>Borrowed</span>
    </button>

    <div v-if="loading" class="loading-state">Loading…</div>

    <div v-else-if="record">
      <!-- Page header -->
      <div class="detail-header">
        <div class="detail-header__left">
          <div class="ref-number">{{ record.reference_number }}</div>
          <h1>{{ record.clients?.name }}</h1>
          <div class="account-tag">{{ record.client_accounts?.account_number }}</div>
        </div>
        <div class="detail-header__right">
          <span :class="['module-badge', `module-badge--${record.module}`]">
            {{ record.module === 'borrowed' ? 'Borrowed' : 'Transmittal' }}
          </span>
          <template v-if="editing">
            <Button label="Cancel" text @click="cancelEdit" />
            <Button label="Save Changes" icon="pi pi-check" :loading="editSaving" @click="saveEdit" />
          </template>
          <Button v-else-if="!record.is_archived" label="Edit" icon="pi pi-pencil" @click="startEdit" />
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button
          v-for="tab in ['details', 'followups', 'history']"
          :key="tab"
          :class="['tab-btn', { 'tab-btn--active': activeTab === tab }]"
          @click="activeTab = tab"
        >
          <i :class="{
            'pi pi-list':  tab === 'details',
            'pi pi-bell':  tab === 'followups',
            'pi pi-clock': tab === 'history',
          }" />
          <span v-if="tab === 'details'">Details</span>
          <span v-else-if="tab === 'followups'">
            Follow-ups
            <span v-if="followUps.length" class="tab-count">{{ followUps.length }}</span>
          </span>
          <span v-else>History ({{ history.length }})</span>
        </button>
      </div>

      <!-- ── Details Tab ── -->
      <div v-if="activeTab === 'details'" class="tab-content">
        <div class="details-layout">
          <!-- Left: all fields -->
          <div class="details-list">
            <div class="detail-row">
              <span class="detail-key">Client Name</span>
              <span class="detail-val">{{ record.clients?.name || '—' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-key">Account ID</span>
              <span class="detail-val">{{ record.client_accounts?.account_number || '—' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-key">Branch</span>
              <span v-if="!editing" class="detail-val">{{ record.branches?.name || '—' }}</span>
              <Dropdown v-else v-model="editForm.branch_id" :options="branchesStore.branches"
                optionLabel="name" optionValue="id" placeholder="Select branch…"
                filter class="inline-input" />
            </div>
            <div class="detail-row">
              <span class="detail-key">Document Transmitted</span>
              <span v-if="!editing" class="detail-val">{{ record.document_transmitted || '—' }}</span>
              <InputText v-else v-model="editForm.document_transmitted" placeholder="e.g. ORCR, Key…" class="inline-input" />
            </div>
            <div class="detail-row">
              <span class="detail-key">Purpose / Status</span>
              <span v-if="!editing" class="detail-val">{{ record.statuses?.name || '—' }}</span>
              <Dropdown v-else v-model="editForm.purpose_status_id" :options="availableStatuses"
                optionLabel="name" optionValue="id" placeholder="Select status…" class="inline-input" />
            </div>
            <div class="detail-row">
              <span class="detail-key">Date Released</span>
              <span v-if="!editing" class="detail-val">{{ formatDate(record.date_released) }}</span>
              <Calendar v-else v-model="editForm.date_released" dateFormat="dd-M-yy" showIcon
                placeholder="Select date" class="inline-input" />
            </div>
            <div class="detail-row">
              <span class="detail-key">Date Transmitted</span>
              <span v-if="!editing" class="detail-val">{{ formatDate(record.date_transmitted) }}</span>
              <Calendar v-else v-model="editForm.date_transmitted" dateFormat="dd-M-yy" showIcon
                placeholder="Select date" class="inline-input" />
            </div>
            <div class="detail-row">
              <span class="detail-key">Received By</span>
              <span v-if="!editing" class="detail-val">{{ record.received_by || '—' }}</span>
              <InputText v-else v-model="editForm.received_by" placeholder="Recipient name…" class="inline-input" />
            </div>
            <div class="detail-row">
              <span class="detail-key">Date Returned</span>
              <span v-if="!editing" class="detail-val"
                :class="{ 'value--returned': record.date_returned, 'value--pending': !record.date_returned }">
                {{ formatDate(record.date_returned) }}
              </span>
              <Calendar v-else v-model="editForm.date_returned" dateFormat="dd-M-yy" showIcon
                placeholder="Leave blank if not returned" class="inline-input" />
            </div>
          </div>

          <!-- Right: Remarks card -->
          <div class="remarks-card">
            <div class="remarks-card__label">Remarks</div>
            <div v-if="!editing" class="remarks-card__text">
              {{ record.remarks || 'No remarks.' }}
            </div>
            <Textarea v-else v-model="editForm.remarks" rows="6"
              placeholder="Additional notes…" class="remarks-card__textarea" />
          </div>
        </div>
      </div>

      <!-- ── Follow-ups Tab ── -->
      <div v-if="activeTab === 'followups'" class="tab-content">

        <!-- Header row with Add button -->
        <div class="fu-header">
          <span class="fu-header__count">{{ followUps.length }} follow-up(s)</span>
          <Button
            v-if="!showFuForm"
            label="Add Follow-up"
            icon="pi pi-plus"
            size="small"
            @click="openFuForm"
          />
        </div>

        <!-- Add follow-up form (shown only when triggered) -->
        <div v-if="showFuForm" class="fu-form">
          <h3 class="fu-form__title">Add Follow-up</h3>
          <div class="fu-form__row">
            <label>
              Follow-up Date <span class="req">*</span>
              <Calendar v-model="fuForm.follow_up_date" dateFormat="dd-M-yy" showIcon placeholder="Select date" />
            </label>
            <label>
              Subject / Concern
              <InputText v-model="fuForm.subject" placeholder="e.g. Pending ORCR, Key for pickup…" />
            </label>
          </div>
          <div class="fu-form__row">
            <label style="flex:1">
              Remarks
              <Textarea v-model="fuForm.remarks" rows="2" placeholder="Optional notes…" />
            </label>
          </div>
          <div class="fu-form__actions">
            <Button label="Cancel" text @click="cancelFuForm" />
            <Button label="Add Follow-up" icon="pi pi-plus" :loading="fuSaving" @click="saveFollowUp" />
          </div>
        </div>

        <!-- Existing follow-ups -->
        <div v-if="!followUps.length" class="empty-state">
          No follow-ups yet for this record.
        </div>

        <div v-else class="fu-list">
          <div v-for="fu in followUps" :key="fu.id" class="fu-item">
            <div class="fu-item__left">
              <div class="fu-item__date">{{ formatDate(fu.follow_up_date) }}</div>
              <div v-if="fu.subject" class="fu-item__subject">{{ fu.subject }}</div>
              <div v-if="fu.remarks" class="fu-item__remarks">{{ fu.remarks }}</div>
            </div>
            <div class="fu-item__right">
              <span v-if="fu.resolved_date" class="badge badge--resolved">Resolved</span>
              <span v-else class="badge badge--pending">Open</span>
              <Button
                v-if="!fu.resolved_date"
                icon="pi pi-check"
                severity="success"
                text rounded size="small"
                v-tooltip="'Mark Resolved'"
                @click="resolveFollowUp(fu)"
              />
              <Button
                icon="pi pi-trash"
                severity="danger"
                text rounded size="small"
                @click="deleteFollowUp(fu)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- ── History Tab ── -->
      <div v-if="activeTab === 'history'" class="tab-content">
        <div v-if="!history.length" class="empty-state">
          No history recorded yet.
        </div>

        <div v-else class="history-timeline">
          <div v-for="entry in history" :key="entry.id" class="history-entry">
            <div class="history-entry__icon-col">
              <div class="history-dot" :style="{ background: activityColor(entry.activity) }">
                <i :class="activityIcon(entry.activity)" style="font-size: 0.7rem; color: #fff" />
              </div>
              <div class="history-line" />
            </div>
            <div class="history-entry__content">
              <div class="history-entry__header">
                <span class="history-activity">{{ activityLabel(entry.activity) }}</span>
                <span class="history-time">{{ formatDateTime(entry.performed_at) }}</span>
              </div>
              <div class="history-description">{{ entry.description }}</div>
              <div v-if="entry.field_name && (entry.old_value || entry.new_value)" class="history-diff">
                <span v-if="entry.old_value" class="diff-old">{{ entry.old_value }}</span>
                <i class="pi pi-arrow-right" style="font-size: 0.7rem; color: #94a3b8" />
                <span class="diff-new">{{ entry.new_value }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="loading-state">Record not found.</div>
  </div>
</template>

<style scoped>
.back-btn {
  background: none; border: none; color: #64748b;
  font-size: 0.85rem; cursor: pointer; padding: 0;
  margin-bottom: 1rem; display: inline-flex; align-items: center; gap: 0.3rem;
}
.back-btn:hover { color: #1e293b; }

.loading-state { padding: 3rem; text-align: center; color: #94a3b8; }

/* ── Header ── */
.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e2e8f0;
  flex-wrap: wrap;
  gap: 1rem;
}
.ref-number { font-size: 0.8rem; color: #94a3b8; font-weight: 500; margin-bottom: 0.2rem; }
.detail-header h1 { font-size: 1.5rem; color: #1e293b; margin-bottom: 0.3rem; }
.account-tag {
  display: inline-block; padding: 0.2rem 0.65rem;
  background: #dbeafe; color: #1e40af;
  border-radius: 999px; font-size: 0.8rem; font-weight: 600;
}
.detail-header__right { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }

.module-badge {
  display: inline-block; padding: 0.25rem 0.75rem;
  border-radius: 999px; font-size: 0.78rem; font-weight: 600;
}
.module-badge--borrowed    { background: #fef3c7; color: #92400e; }
.module-badge--transmittal { background: #d1fae5; color: #065f46; }

/* ── Tabs ── */
.tabs {
  display: flex;
  gap: 0;
  border-bottom: 2px solid #e2e8f0;
  margin-bottom: 1.25rem;
}
.tab-btn {
  background: none; border: none; border-bottom: 2px solid transparent;
  padding: 0.65rem 1.25rem;
  font-size: 0.875rem; font-weight: 500; color: #64748b;
  cursor: pointer; margin-bottom: -2px;
  display: flex; align-items: center; gap: 0.4rem;
  transition: color 0.15s, border-color 0.15s;
}
.tab-btn:hover { color: #1e293b; }
.tab-btn--active { color: #2563eb; border-bottom-color: #2563eb; }

.tab-count {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 18px;
  background: #2563eb; color: #fff;
  border-radius: 999px; font-size: 0.7rem; font-weight: 700;
  padding: 0 4px; margin-left: 0.25rem;
}

.tab-content {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 0 0 10px 10px;
  padding: 1.5rem;
}

/* ── Details layout ── */
.details-layout {
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
}
.details-list { flex: 1; display: flex; flex-direction: column; }

/* ── Remarks card ── */
.remarks-card {
  flex: 1;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-height: 100%;
}
.remarks-card__label {
  font-size: 0.72rem; font-weight: 700; color: #64748b;
  text-transform: uppercase; letter-spacing: 0.06em;
}
.remarks-card__text {
  font-size: 0.875rem; color: #1e293b;
  line-height: 1.6; white-space: pre-wrap;
}
:deep(.remarks-card__textarea) { width: 100%; }

.detail-row {
  display: flex;
  padding: 0.65rem 0;
  border-bottom: 1px solid #f1f5f9;
  gap: 1rem;
}
.detail-row:last-child { border-bottom: none; }
.detail-key {
  width: 200px; flex-shrink: 0;
  font-size: 0.82rem; font-weight: 600; color: #64748b;
}
.detail-val { font-size: 0.875rem; color: #1e293b; }
.value--returned { color: #065f46; font-weight: 600; }
.value--pending  { color: #94a3b8; font-style: italic; }

.detail-row--tall { align-items: flex-start; }

.inline-input {
  flex: 1;
  max-width: 380px;
}
:deep(.inline-input.p-inputtext),
:deep(.inline-input .p-inputtext),
:deep(.inline-input .p-calendar),
:deep(.inline-input .p-dropdown),
:deep(.inline-input .p-textarea) {
  width: 100%;
}

/* ── Follow-ups ── */
.fu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}
.fu-header__count {
  font-size: 0.82rem;
  color: #94a3b8;
}
.fu-form {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
}
.fu-form__title {
  font-size: 0.9rem; font-weight: 700; color: #1e293b;
  margin-bottom: 1rem;
}
.fu-form__row {
  display: flex; gap: 1rem; margin-bottom: 0.75rem;
}
.fu-form__row label { flex: 1; }
.fu-form__actions {
  display: flex; justify-content: flex-end; margin-top: 0.5rem;
}
.fu-form label {
  display: flex; flex-direction: column; gap: 0.35rem;
  font-size: 0.82rem; font-weight: 500; color: #475569;
}
.fu-form :deep(.p-inputtext),
.fu-form :deep(.p-calendar),
.fu-form :deep(.p-textarea) { width: 100%; }

.req { color: #ef4444; }

.empty-state {
  padding: 2rem;
  text-align: center;
  color: #94a3b8;
  font-style: italic;
  font-size: 0.875rem;
}

.fu-list { display: flex; flex-direction: column; gap: 0.5rem; }
.fu-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 0.75rem 1rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  gap: 1rem;
}
.fu-item__date {
  font-size: 0.9rem; font-weight: 700; color: #1e293b;
  margin-bottom: 0.15rem;
}
.fu-item__subject { font-size: 0.85rem; color: #334155; }
.fu-item__remarks { font-size: 0.8rem; color: #64748b; margin-top: 0.15rem; }
.fu-item__right { display: flex; align-items: center; gap: 0.25rem; flex-shrink: 0; }

/* ── History ── */
.history-timeline { display: flex; flex-direction: column; }
.history-entry { display: flex; gap: 1rem; }
.history-entry__icon-col {
  display: flex; flex-direction: column; align-items: center; flex-shrink: 0;
}
.history-dot {
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; z-index: 1;
}
.history-line {
  width: 2px; flex: 1; background: #e2e8f0;
  margin: 4px 0; min-height: 20px;
}
.history-entry:last-child .history-line { display: none; }
.history-entry__content { padding-bottom: 1.25rem; flex: 1; }
.history-entry__header {
  display: flex; align-items: center; gap: 0.75rem;
  margin-bottom: 0.2rem; flex-wrap: wrap;
}
.history-activity { font-weight: 600; font-size: 0.875rem; color: #1e293b; }
.history-time { font-size: 0.78rem; color: #94a3b8; }
.history-description { font-size: 0.85rem; color: #475569; }
.history-diff {
  display: inline-flex; align-items: center; gap: 0.5rem;
  margin-top: 0.4rem; font-size: 0.8rem;
}
.diff-old {
  background: #fee2e2; color: #991b1b;
  padding: 0.1rem 0.5rem; border-radius: 4px; text-decoration: line-through;
}
.diff-new {
  background: #d1fae5; color: #065f46;
  padding: 0.1rem 0.5rem; border-radius: 4px;
}

/* ── Move to Transmittal dialog ── */
.move-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0.25rem 0;
}
.move-dialog-note {
  font-size: 0.875rem;
  color: #475569;
}
.move-dialog-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.field-label {
  font-size: 0.85rem;
  font-weight: 500;
  color: #374151;
}
.req { color: #ef4444; }
</style>
