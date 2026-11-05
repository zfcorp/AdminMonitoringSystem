<script setup>
import { ref, computed, onMounted } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { useStatusesStore } from '../stores/statuses'
import { useBranchesStore } from '../stores/branches'

const statusesStore = useStatusesStore()
const branchesStore = useBranchesStore()
const confirm = useConfirm()
const toast = useToast()

const activeTab = ref('branches')

const tabs = [
  { key: 'branches',             label: 'Branches',              icon: 'pi pi-building' },
  { key: 'statuses_borrowed',    label: 'Borrowed Statuses',     icon: 'pi pi-tag'      },
  { key: 'statuses_transmittal', label: 'Transmittal Statuses',  icon: 'pi pi-tag'      },
]

const showDialog = ref(false)
const dialogMode = ref('add')
const editingId  = ref(null)
const inputName  = ref('')
const saving     = ref(false)
const fetchError = ref('')

onMounted(async () => {
  const [b, s] = await Promise.all([
    branchesStore.fetch(),
    statusesStore.fetch(),
  ])
  if (b.error) fetchError.value = `Branches: ${b.error.message}`
  else if (s.error) fetchError.value = `Statuses: ${s.error.message}`
})

const currentItems   = computed(() => {
  if (activeTab.value === 'branches') return branchesStore.branches
  if (activeTab.value === 'statuses_transmittal') return statusesStore.transmittalStatuses
  return statusesStore.borrowedStatuses
})
const currentLoading = computed(() => activeTab.value === 'branches' ? branchesStore.loading : statusesStore.loading)
const currentLabel   = computed(() => activeTab.value === 'branches' ? 'Branch' : 'Status')
const currentModule  = computed(() => activeTab.value === 'statuses_transmittal' ? 'transmittal' : 'borrowed')

// ── Open add / edit dialog ────────────────────────────────────
function openAdd() {
  dialogMode.value = 'add'
  editingId.value  = null
  inputName.value  = ''
  showDialog.value = true
}

function openEdit(item) {
  dialogMode.value = 'edit'
  editingId.value  = item.id
  inputName.value  = item.name
  showDialog.value = true
}

// ── Save (add or update) ──────────────────────────────────────
async function save() {
  if (!inputName.value.trim()) {
    toast.add({ severity: 'warn', summary: 'Required', detail: 'Name is required.', life: 3000 })
    return
  }

  saving.value = true
  let error

  if (activeTab.value === 'branches') {
    const res = dialogMode.value === 'add'
      ? await branchesStore.create(inputName.value)
      : await branchesStore.update(editingId.value, inputName.value)
    error = res.error
  } else {
    const res = dialogMode.value === 'add'
      ? await statusesStore.create(inputName.value, currentModule.value)
      : await statusesStore.update(editingId.value, inputName.value)
    error = res.error
  }

  saving.value = false

  if (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 5000 })
    return
  }

  toast.add({
    severity: 'success',
    summary: 'Saved',
    detail: `${currentLabel.value} ${dialogMode.value === 'add' ? 'added' : 'updated'}.`,
    life: 3000,
  })
  showDialog.value = false
}

// ── Delete ────────────────────────────────────────────────────
function handleDelete(item) {
  confirm.require({
    message: `Delete "${item.name}"? This cannot be undone.`,
    header: `Delete ${currentLabel.value}`,
    acceptClass: 'p-button-danger',
    acceptLabel: 'Delete',
    rejectLabel: 'Cancel',
    accept: async () => {
      if (activeTab.value === 'branches') {
        const refCount = await branchesStore.getReferenceCount(item.id)
        if (refCount > 0) {
          toast.add({
            severity: 'warn',
            summary: 'Cannot Delete',
            detail: `"${item.name}" is used by ${refCount} record(s). Remove those records first.`,
            life: 6000,
          })
          return
        }
        const { error } = await branchesStore.remove(item.id)
        if (error) { toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 5000 }); return }
      } else {
        const { blocked, count, error } = await statusesStore.remove(item.id)
        if (blocked) {
          toast.add({
            severity: 'warn',
            summary: 'Cannot Delete',
            detail: `"${item.name}" is assigned to ${count} record(s). Reassign them first.`,
            life: 6000,
          })
          return
        }
        if (error) { toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 5000 }); return }
      }
      toast.add({ severity: 'success', summary: 'Deleted', detail: `${currentLabel.value} deleted.`, life: 3000 })
    },
  })
}
</script>

<template>
  <div class="settings-page">

    <!-- Tab bar -->
    <div class="tab-bar">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :class="['tab-pill', { 'tab-pill--active': activeTab === tab.key }]"
        @click="activeTab = tab.key"
      >
        <i :class="tab.icon" />
        {{ tab.label }}
      </button>
    </div>

    <!-- Schema error banner -->
    <div v-if="fetchError" class="error-banner">
      <i class="pi pi-exclamation-circle" />
      Database error: {{ fetchError }}.
      Make sure you have run <code>full_schema.sql</code> in the Supabase SQL Editor.
    </div>

    <!-- Content card -->
    <div class="settings-card">

      <!-- Card header -->
      <div class="card-header">
        <span class="card-title">
          {{ activeTab === 'branches' ? 'Branches' : activeTab === 'statuses_transmittal' ? 'Transmittal Statuses' : 'Borrowed Statuses' }}
        </span>
        <button class="add-btn" @click="openAdd">
          + Add {{ currentLabel }}
        </button>
      </div>

      <!-- Column headers -->
      <div class="list-head">
        <span>NAME</span>
        <span>ACTIONS</span>
      </div>

      <!-- Loading -->
      <div v-if="currentLoading" class="state-msg">Loading…</div>

      <!-- Empty -->
      <div v-else-if="!currentItems.length" class="state-msg">
        No {{ currentLabel.toLowerCase() }}s added yet.
      </div>

      <!-- Rows -->
      <div
        v-else
        v-for="item in currentItems"
        :key="item.id"
        class="list-row"
      >
        <span class="row-name">{{ item.name }}</span>
        <span class="row-actions">
          <button class="icon-btn" title="Edit" @click="openEdit(item)">
            <i class="pi pi-pencil" />
          </button>
          <button class="icon-btn icon-btn--danger" title="Delete" @click="handleDelete(item)">
            <i class="pi pi-trash" />
          </button>
        </span>
      </div>

    </div><!-- /card -->

    <!-- Add / Edit dialog -->
    <Dialog
      v-model:visible="showDialog"
      :header="`${dialogMode === 'add' ? 'Add' : 'Edit'} ${currentLabel}`"
      :modal="true"
      style="width: 420px"
    >
      <div class="dialog-body">
        <label class="dialog-label">
          {{ currentLabel }} Name
          <InputText
            v-model="inputName"
            :placeholder="`Enter ${currentLabel.toLowerCase()} name`"
            autofocus
            style="width:100%"
          />
        </label>
      </div>
      <template #footer>
        <Button label="Cancel" text @click="showDialog = false" />
        <Button
          :label="dialogMode === 'add' ? `Add ${currentLabel}` : 'Save Changes'"
          :loading="saving"
          @click="save"
        />
      </template>
    </Dialog>

  </div>
</template>

<style scoped>
.settings-page { padding: 0; }

.page-title {
  font-size: 1.4rem;
  font-weight: 700;
  color: #111827;
  margin-bottom: 1.25rem;
}

/* ── Tab bar ── */
.tab-bar {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}

.tab-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 1rem;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: #fff;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.tab-pill:hover { background: #f3f4f6; }
.tab-pill--active { background: #2563eb; color: #fff; border-color: #2563eb; }
.tab-pill--active:hover { background: #1d4ed8; }
.tab-pill i { font-size: 0.85rem; }

/* ── Card ── */
.settings-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 1.5rem;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
}
.card-title { font-size: 1rem; font-weight: 700; color: #111827; }

.add-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.45rem 1.1rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s;
}
.add-btn:hover { background: #1d4ed8; }

/* ── List header ── */
.list-head {
  display: flex;
  justify-content: space-between;
  padding: 0 0 0.5rem;
  border-bottom: 1px solid #e5e7eb;
  font-size: 0.72rem;
  font-weight: 600;
  color: #6b7280;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

/* ── List rows ── */
.list-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.8rem 0;
  border-bottom: 1px solid #f3f4f6;
  transition: background 0.1s;
}
.list-row:last-child { border-bottom: none; }
.list-row:hover { background: #f9fafb; margin: 0 -1.5rem; padding-left: 1.5rem; padding-right: 1.5rem; }

.row-name {
  font-size: 0.9rem;
  color: #111827;
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
}

/* ── Icon buttons ── */
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background: none;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  color: #9ca3af;
  font-size: 0.85rem;
  transition: color 0.12s, background 0.12s;
}
.icon-btn:hover { color: #374151; background: #f3f4f6; }
.icon-btn--danger:hover { color: #dc2626; background: #fee2e2; }

/* ── States ── */
.state-msg {
  padding: 2rem 0;
  text-align: center;
  color: #9ca3af;
  font-size: 0.875rem;
  font-style: italic;
}

/* ── Dialog ── */
.dialog-body { padding: 0.25rem 0 0.5rem; }
.dialog-label {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.85rem;
  font-weight: 500;
  color: #374151;
}
</style>

