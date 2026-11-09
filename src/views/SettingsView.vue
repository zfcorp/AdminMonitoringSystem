<script setup>
import { ref, computed, onMounted } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Dropdown from 'primevue/dropdown'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { useStatusesStore } from '../stores/statuses'
import { useBranchesStore } from '../stores/branches'
import { useAuthStore } from '../stores/auth'
import { supabase } from '../lib/supabase'

const statusesStore = useStatusesStore()
const branchesStore = useBranchesStore()
const authStore = useAuthStore()
const confirm = useConfirm()
const toast = useToast()

const activeTab = ref('branches')

const tabs = [
  { key: 'branches',             label: 'Branches',             icon: 'pi pi-building' },
  { key: 'statuses_borrowed',    label: 'Borrowed Statuses',    icon: 'pi pi-tag'      },
  { key: 'statuses_transmittal', label: 'Transmittal Statuses', icon: 'pi pi-tag'      },
  { key: 'users',                label: 'Users',                icon: 'pi pi-users'    },
]

// ── Branch / Status form state ────────────────────────────────
const showDialog = ref(false)
const dialogMode = ref('add')
const editingId  = ref(null)
const inputName  = ref('')
const saving     = ref(false)
const fetchError = ref('')

// ── Users ─────────────────────────────────────────────────────
const users        = ref([])
const usersLoading = ref(false)
const showRoleDialog   = ref(false)
const editingUser      = ref(null)
const editingRole      = ref('user')
const savingRole       = ref(false)

// Edit user dialog (email + password)
const showEditUserDialog = ref(false)
const editUserEmail      = ref('')
const editUserPassword   = ref('')
const showEditPassword   = ref(false)
const savingEditUser     = ref(false)

// Add user dialog
const showAddUserDialog = ref(false)
const newUserEmail    = ref('')
const newUserPassword = ref('')
const newUserRole     = ref('user')
const addingUser      = ref(false)
const showNewPassword = ref(false)

const roleOptions = [
  { label: 'User',          value: 'user'  },
  { label: 'Administrator', value: 'admin' },
]

async function fetchUsers() {
  usersLoading.value = true
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false })
  usersLoading.value = false
  if (error) { fetchError.value = `Users: ${error.message}`; return }
  users.value = data || []
}

async function addUser() {
  if (!newUserEmail.value || !newUserPassword.value) {
    toast.add({ severity: 'warn', summary: 'Required', detail: 'Email and password are required.', life: 3000 })
    return
  }
  addingUser.value = true
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({
      email: newUserEmail.value,
      password: newUserPassword.value,
      role: newUserRole.value,
    }),
  })
  const result = await res.json()
  addingUser.value = false
  if (!res.ok || result.error) {
    toast.add({ severity: 'error', summary: 'Error', detail: result.error || 'Failed to create user.', life: 5000 })
    return
  }
  toast.add({ severity: 'success', summary: 'User Created', detail: `${newUserEmail.value} has been added.`, life: 3000 })
  showAddUserDialog.value = false
  newUserEmail.value = ''
  newUserPassword.value = ''
  newUserRole.value = 'user'
  await fetchUsers()
}

function openEditRole(u) {
  editingUser.value = u
  editingRole.value = u.role
  showRoleDialog.value = true
}

async function saveRole() {
  if (!editingUser.value) return
  savingRole.value = true
  const { error } = await supabase
    .from('profiles')
    .update({ role: editingRole.value })
    .eq('id', editingUser.value.id)
  savingRole.value = false
  if (error) { toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 5000 }); return }
  toast.add({ severity: 'success', summary: 'Updated', detail: `Role updated to ${editingRole.value}.`, life: 3000 })
  showRoleDialog.value = false
  await fetchUsers()
}

function openEditUser(u) {
  editingUser.value    = u
  editUserEmail.value  = u.email
  editUserPassword.value = ''
  showEditPassword.value = false
  showEditUserDialog.value = true
}

async function saveEditUser() {
  if (!editingUser.value) return
  if (!editUserEmail.value) {
    toast.add({ severity: 'warn', summary: 'Required', detail: 'Email is required.', life: 3000 })
    return
  }
  savingEditUser.value = true
  const { data: { session } } = await supabase.auth.getSession()
  const body = { userId: editingUser.value.id }
  if (editUserEmail.value !== editingUser.value.email) body.email = editUserEmail.value
  if (editUserPassword.value)                          body.password = editUserPassword.value

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify(body),
  })
  const result = await res.json()
  savingEditUser.value = false
  if (!res.ok || result.error) {
    toast.add({ severity: 'error', summary: 'Error', detail: result.error || 'Update failed.', life: 5000 })
    return
  }
  toast.add({ severity: 'success', summary: 'Updated', detail: 'User updated successfully.', life: 3000 })
  showEditUserDialog.value = false
  await fetchUsers()
}

// ── Lifecycle ─────────────────────────────────────────────────
onMounted(async () => {
  const [b, s] = await Promise.all([branchesStore.fetch(), statusesStore.fetch()])
  if (b.error) fetchError.value = `Branches: ${b.error.message}`
  else if (s.error) fetchError.value = `Statuses: ${s.error.message}`
})

function onTabChange(key) {
  activeTab.value = key
  if (key === 'users' && !users.value.length) fetchUsers()
}

// ── Branch / Status computed ──────────────────────────────────
const currentItems = computed(() => {
  if (activeTab.value === 'branches') return branchesStore.branches
  if (activeTab.value === 'statuses_transmittal') return statusesStore.transmittalStatuses
  return statusesStore.borrowedStatuses
})
const currentLoading = computed(() => activeTab.value === 'branches' ? branchesStore.loading : statusesStore.loading)
const currentLabel   = computed(() => activeTab.value === 'branches' ? 'Branch' : 'Status')
const currentModule  = computed(() => activeTab.value === 'statuses_transmittal' ? 'transmittal' : 'borrowed')

function openAdd() {
  dialogMode.value = 'add'; editingId.value = null; inputName.value = ''; showDialog.value = true
}
function openEdit(item) {
  dialogMode.value = 'edit'; editingId.value = item.id; inputName.value = item.name; showDialog.value = true
}

async function save() {
  if (!inputName.value.trim()) { toast.add({ severity: 'warn', summary: 'Required', detail: 'Name is required.', life: 3000 }); return }
  saving.value = true
  let error
  if (activeTab.value === 'branches') {
    const res = dialogMode.value === 'add' ? await branchesStore.create(inputName.value) : await branchesStore.update(editingId.value, inputName.value)
    error = res.error
  } else {
    const res = dialogMode.value === 'add' ? await statusesStore.create(inputName.value, currentModule.value) : await statusesStore.update(editingId.value, inputName.value)
    error = res.error
  }
  saving.value = false
  if (error) { toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 5000 }); return }
  toast.add({ severity: 'success', summary: 'Saved', detail: `${currentLabel.value} ${dialogMode.value === 'add' ? 'added' : 'updated'}.`, life: 3000 })
  showDialog.value = false
}

function handleDelete(item) {
  confirm.require({
    message: `Delete "${item.name}"? This cannot be undone.`,
    header: `Delete ${currentLabel.value}`,
    acceptClass: 'p-button-danger', acceptLabel: 'Delete', rejectLabel: 'Cancel',
    accept: async () => {
      if (activeTab.value === 'branches') {
        const refCount = await branchesStore.getReferenceCount(item.id)
        if (refCount > 0) { toast.add({ severity: 'warn', summary: 'Cannot Delete', detail: `"${item.name}" is used by ${refCount} record(s).`, life: 6000 }); return }
        const { error } = await branchesStore.remove(item.id)
        if (error) { toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 5000 }); return }
      } else {
        const { blocked, count, error } = await statusesStore.remove(item.id)
        if (blocked) { toast.add({ severity: 'warn', summary: 'Cannot Delete', detail: `"${item.name}" is assigned to ${count} record(s).`, life: 6000 }); return }
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
        v-for="tab in tabs" :key="tab.key"
        :class="['tab-pill', { 'tab-pill--active': activeTab === tab.key }]"
        @click="onTabChange(tab.key)"
      >
        <i :class="tab.icon" /> {{ tab.label }}
      </button>
    </div>

    <!-- Error banner -->
    <div v-if="fetchError" class="error-banner">
      <i class="pi pi-exclamation-circle" /> {{ fetchError }}
    </div>

    <!-- ── Users panel ── -->
    <div v-if="activeTab === 'users'" class="settings-card">
      <div class="card-header">
        <span class="card-title">Users</span>
        <div style="display:flex;gap:0.5rem">
          <button class="add-btn" @click="fetchUsers"><i class="pi pi-refresh" /> Refresh</button>
          <button class="add-btn" @click="showAddUserDialog = true"><i class="pi pi-plus" /> Add User</button>
        </div>
      </div>
      <div class="list-head users-head">
        <span>EMAIL</span><span>ROLE</span><span>JOINED</span><span>ACTIONS</span>
      </div>
      <div v-if="usersLoading" class="state-msg">Loading users…</div>
      <div v-else-if="!users.length" class="state-msg">No users found.</div>
      <div v-else v-for="u in users" :key="u.id" class="list-row list-row--users">
        <span class="user-email-cell">
          <span class="user-initial">{{ u.email?.[0]?.toUpperCase() }}</span>
          {{ u.email }}
          <span v-if="u.id === authStore.user?.id" class="you-badge">You</span>
        </span>
        <span>
          <span :class="['role-badge', u.role === 'admin' ? 'role-badge--admin' : 'role-badge--user']">
            {{ u.role === 'admin' ? 'Administrator' : 'User' }}
          </span>
        </span>
        <span class="user-date">{{ u.created_at ? new Date(u.created_at).toLocaleDateString() : '—' }}</span>
        <span class="row-actions">
          <button class="icon-btn" title="Edit Email / Password" :disabled="u.id === authStore.user?.id" @click="openEditUser(u)">
            <i class="pi pi-pencil" />
          </button>
          <button class="icon-btn" title="Change Role" :disabled="u.id === authStore.user?.id" @click="openEditRole(u)">
            <i class="pi pi-shield" />
          </button>
        </span>
      </div>
    </div>

    <!-- ── Branches / Statuses panel ── -->
    <div v-if="activeTab !== 'users'" class="settings-card">
      <div class="card-header">
        <span class="card-title">
          {{ activeTab === 'branches' ? 'Branches' : activeTab === 'statuses_transmittal' ? 'Transmittal Statuses' : 'Borrowed Statuses' }}
        </span>
        <button class="add-btn" @click="openAdd">+ Add {{ currentLabel }}</button>
      </div>
      <div class="list-head"><span>NAME</span><span>ACTIONS</span></div>
      <div v-if="currentLoading" class="state-msg">Loading…</div>
      <div v-else-if="!currentItems.length" class="state-msg">No {{ currentLabel.toLowerCase() }}s added yet.</div>
      <div v-else v-for="item in currentItems" :key="item.id" class="list-row">
        <span class="row-name">{{ item.name }}</span>
        <span class="row-actions">
          <button class="icon-btn" title="Edit" @click="openEdit(item)"><i class="pi pi-pencil" /></button>
          <button class="icon-btn icon-btn--danger" title="Delete" @click="handleDelete(item)"><i class="pi pi-trash" /></button>
        </span>
      </div>
    </div>

    <!-- Add / Edit dialog -->
    <Dialog v-model:visible="showDialog" :header="`${dialogMode === 'add' ? 'Add' : 'Edit'} ${currentLabel}`" :modal="true" style="width: 420px">
      <div class="dialog-body">
        <label class="dialog-label">
          {{ currentLabel }} Name
          <InputText v-model="inputName" :placeholder="`Enter ${currentLabel.toLowerCase()} name`" autofocus style="width:100%" />
        </label>
      </div>
      <template #footer>
        <Button label="Cancel" text @click="showDialog = false" />
        <Button :label="dialogMode === 'add' ? `Add ${currentLabel}` : 'Save Changes'" :loading="saving" @click="save" />
      </template>
    </Dialog>

    <!-- Change Role dialog -->
    <Dialog v-model:visible="showRoleDialog" header="Change User Role" :modal="true" style="width: 380px">
      <div class="dialog-body">
        <p class="role-dialog-email">{{ editingUser?.email }}</p>
        <label class="dialog-label">
          Role
          <Dropdown v-model="editingRole" :options="roleOptions" optionLabel="label" optionValue="value" style="width:100%" />
        </label>
      </div>
      <template #footer>
        <Button label="Cancel" text @click="showRoleDialog = false" />
        <Button label="Save Role" :loading="savingRole" @click="saveRole" />
      </template>
    </Dialog>

    <!-- Add User dialog -->
    <Dialog v-model:visible="showAddUserDialog" header="Add New User" :modal="true" style="width: 420px">
      <div class="dialog-body" style="display:flex;flex-direction:column;gap:1rem">
        <label class="dialog-label">
          Email
          <InputText v-model="newUserEmail" type="email" placeholder="user@zurichfinance.com" style="width:100%" />
        </label>
        <label class="dialog-label">
          Password
          <div class="password-wrap">
            <InputText v-model="newUserPassword" :type="showNewPassword ? 'text' : 'password'" placeholder="••••••••" style="width:100%" />
            <button type="button" class="pw-toggle" @click="showNewPassword = !showNewPassword">
              <i :class="showNewPassword ? 'pi pi-eye-slash' : 'pi pi-eye'" />
            </button>
          </div>
        </label>
        <label class="dialog-label">
          Role
          <Dropdown v-model="newUserRole" :options="roleOptions" optionLabel="label" optionValue="value" style="width:100%" />
        </label>
      </div>
      <template #footer>
        <Button label="Cancel" text @click="showAddUserDialog = false" />
        <Button label="Create User" icon="pi pi-plus" :loading="addingUser" @click="addUser" />
      </template>
    </Dialog>

    <!-- Edit User dialog -->
    <Dialog v-model:visible="showEditUserDialog" header="Edit User" :modal="true" style="width: 420px">
      <div class="dialog-body" style="display:flex;flex-direction:column;gap:1rem">
        <label class="dialog-label">
          Email
          <InputText v-model="editUserEmail" type="email" placeholder="user@zurichfinance.com" style="width:100%" />
        </label>
        <label class="dialog-label">
          New Password <span style="font-size:0.75rem;color:#94a3b8;font-weight:400">(leave blank to keep current)</span>
          <div class="password-wrap">
            <InputText v-model="editUserPassword" :type="showEditPassword ? 'text' : 'password'" placeholder="Leave blank to keep current" style="width:100%" />
            <button type="button" class="pw-toggle" @click="showEditPassword = !showEditPassword">
              <i :class="showEditPassword ? 'pi pi-eye-slash' : 'pi pi-eye'" />
            </button>
          </div>
        </label>
      </div>
      <template #footer>
        <Button label="Cancel" text @click="showEditUserDialog = false" />
        <Button label="Save Changes" icon="pi pi-check" :loading="savingEditUser" @click="saveEditUser" />
      </template>
    </Dialog>

  </div>
</template>

<style scoped>
.settings-page { padding: 0; }

.tab-bar { display: flex; gap: 0.5rem; margin-bottom: 1.25rem; flex-wrap: wrap; }

.tab-pill {
  display: inline-flex; align-items: center; gap: 0.4rem;
  padding: 0.45rem 1rem; border-radius: 8px; border: 1px solid #e5e7eb;
  background: #fff; font-size: 0.875rem; font-weight: 500; color: #374151;
  cursor: pointer; transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.tab-pill:hover { background: #f3f4f6; }
.tab-pill--active { background: #2563eb; color: #fff; border-color: #2563eb; }
.tab-pill--active:hover { background: #1d4ed8; }
.tab-pill i { font-size: 0.85rem; }

.settings-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1.5rem; }

.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; }
.card-title { font-size: 1rem; font-weight: 700; color: #111827; }

.add-btn {
  display: inline-flex; align-items: center; gap: 0.3rem;
  background: #2563eb; color: #fff; border: none; border-radius: 8px;
  padding: 0.45rem 1.1rem; font-size: 0.875rem; font-weight: 500; cursor: pointer;
  transition: background 0.12s;
}
.add-btn:hover { background: #1d4ed8; }

.list-head {
  display: flex; justify-content: space-between;
  padding: 0 0 0.5rem; border-bottom: 1px solid #e5e7eb;
  font-size: 0.72rem; font-weight: 600; color: #6b7280;
  letter-spacing: 0.07em; text-transform: uppercase;
}

.users-head { display: grid; grid-template-columns: 1fr auto auto auto; gap: 1rem; }

.list-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.8rem 0; border-bottom: 1px solid #f3f4f6; transition: background 0.1s;
}
.list-row:last-child { border-bottom: none; }
.list-row:hover { background: #f9fafb; margin: 0 -1.5rem; padding-left: 1.5rem; padding-right: 1.5rem; }

.list-row--users { display: grid; grid-template-columns: 1fr auto auto auto; gap: 1rem; align-items: center; }

.row-name { font-size: 0.9rem; color: #111827; }
.row-actions { display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0; }

.icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; background: none; border: none; border-radius: 6px;
  cursor: pointer; color: #9ca3af; font-size: 0.85rem; transition: color 0.12s, background 0.12s;
}
.icon-btn:hover { color: #374151; background: #f3f4f6; }
.icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.icon-btn--danger:hover { color: #dc2626; background: #fee2e2; }

.state-msg { padding: 2rem 0; text-align: center; color: #9ca3af; font-size: 0.875rem; font-style: italic; }

/* Users */
.user-email-cell { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; color: #111827; min-width: 0; }
.user-initial {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 50%; background: #1e293b;
  color: #fff; font-size: 0.75rem; font-weight: 700; flex-shrink: 0;
}
.you-badge {
  display: inline-block; padding: 0.1rem 0.45rem;
  background: #dbeafe; color: #1e40af; border-radius: 999px; font-size: 0.7rem; font-weight: 600;
}
.role-badge { display: inline-block; padding: 0.2rem 0.65rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; white-space: nowrap; }
.role-badge--admin { background: #fef3c7; color: #92400e; }
.role-badge--user  { background: #f1f5f9; color: #475569; }
.user-date { font-size: 0.8rem; color: #9ca3af; white-space: nowrap; }

/* Dialog */
.dialog-body { padding: 0.25rem 0 0.5rem; }
.dialog-label { display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.85rem; font-weight: 500; color: #374151; }
.role-dialog-email { font-size: 0.875rem; color: #475569; margin-bottom: 1rem; padding: 0.5rem 0.75rem; background: #f8fafc; border-radius: 6px; }

.password-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.password-wrap :deep(.p-inputtext) { padding-right: 2.5rem; }
.pw-toggle {
  position: absolute;
  right: 0.6rem;
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0;
  display: flex;
  align-items: center;
}
.pw-toggle:hover { color: #475569; }
</style>
