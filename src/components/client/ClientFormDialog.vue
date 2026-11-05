<script setup>
import { ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { useClientsStore } from '../../stores/clients'

const props = defineProps({
  visible: { type: Boolean, default: false },
  client: { type: Object, default: null },
})
const emit = defineEmits(['update:visible', 'saved'])

const clientsStore = useClientsStore()
const toast = useToast()

const clientName = ref('')
const accounts = ref([])
const newAccountNumber = ref('')
const saving = ref(false)
const editingId = ref(null)

// Load client data when the dialog opens for editing
watch(
  () => props.visible,
  async (isVisible) => {
    if (isVisible) {
      if (props.client) {
        editingId.value = props.client.id
        clientName.value = props.client.name
        const { data } = await clientsStore.getAccounts(props.client.id)
        accounts.value = data || []
      } else {
        editingId.value = null
        clientName.value = ''
        accounts.value = []
      }
      newAccountNumber.value = ''
    }
  }
)

async function addAccount() {
  if (!newAccountNumber.value.trim()) return
  if (!editingId.value) {
    // New client not yet saved — keep account in local list
    accounts.value.push({ id: null, account_number: newAccountNumber.value.trim(), _new: true })
    newAccountNumber.value = ''
    return
  }
  const { data, error } = await clientsStore.createAccount(editingId.value, newAccountNumber.value.trim())
  if (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 5000 })
    return
  }
  accounts.value.push(data)
  newAccountNumber.value = ''
}

async function removeAccount(account, index) {
  if (account._new) {
    accounts.value.splice(index, 1)
    return
  }
  const { error } = await clientsStore.removeAccount(account.id)
  if (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 5000 })
    return
  }
  accounts.value.splice(index, 1)
}

async function save() {
  if (!clientName.value.trim()) {
    toast.add({ severity: 'warn', summary: 'Required', detail: 'Client name is required.', life: 3000 })
    return
  }

  saving.value = true

  if (editingId.value) {
    // Update existing client
    const { error } = await clientsStore.update(editingId.value, clientName.value.trim())
    if (error) {
      toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 5000 })
      saving.value = false
      return
    }

    // Create any pending new accounts
    for (const acct of accounts.value) {
      if (acct._new) {
        await clientsStore.createAccount(editingId.value, acct.account_number)
      }
    }

    toast.add({ severity: 'success', summary: 'Updated', detail: 'Client updated.', life: 3000 })
  } else {
    // Create new client
    const { data, error } = await clientsStore.create(clientName.value.trim())
    if (error) {
      toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 5000 })
      saving.value = false
      return
    }

    // Create all accounts for the new client
    for (const acct of accounts.value) {
      if (acct._new || !acct.id) {
        await clientsStore.createAccount(data.id, acct.account_number)
      }
    }

    toast.add({ severity: 'success', summary: 'Created', detail: 'Client created.', life: 3000 })
  }

  saving.value = false
  emit('saved')
  emit('update:visible', false)
}
</script>

<template>
  <Dialog
    :visible="visible"
    @update:visible="$emit('update:visible', $event)"
    :header="editingId ? 'Edit Client' : 'New Client'"
    :modal="true"
    style="width: 500px"
  >
    <div class="client-form">
      <label>
        Client Name <span class="req">*</span>
        <InputText v-model="clientName" placeholder="e.g., Juan dela Cruz" autofocus />
      </label>

      <div class="accounts-section">
        <div class="accounts-header">
          <span class="accounts-title">Account IDs</span>
        </div>
        <div class="account-list">
          <div v-for="(acct, i) in accounts" :key="i" class="account-item">
            <span>{{ acct.account_number }}</span>
            <Button
              icon="pi pi-times"
              severity="danger"
              text
              rounded
              size="small"
              @click="removeAccount(acct, i)"
            />
          </div>
          <div v-if="!accounts.length" class="no-accounts">No account IDs yet.</div>
        </div>
        <div class="add-account">
          <InputText
            v-model="newAccountNumber"
            placeholder="Add account ID…"
            @keydown.enter.prevent="addAccount"
          />
          <Button label="Add" icon="pi pi-plus" size="small" @click="addAccount" />
        </div>
      </div>
    </div>

    <template #footer>
      <Button label="Cancel" text @click="$emit('update:visible', false)" />
      <Button label="Save" :loading="saving" @click="save" />
    </template>
  </Dialog>
</template>

<style scoped>
.client-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding-top: 0.5rem;
}

.client-form label {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.85rem;
  font-weight: 500;
  color: #475569;
}

.req {
  color: #ef4444;
}

.accounts-section {
  border-top: 1px solid #e2e8f0;
  padding-top: 0.75rem;
}

.accounts-header {
  margin-bottom: 0.5rem;
}

.accounts-title {
  font-size: 0.85rem;
  font-weight: 500;
  color: #475569;
}

.account-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 0.75rem;
}

.account-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.4rem 0.75rem;
  background: #f8fafc;
  border-radius: 6px;
  font-size: 0.875rem;
}

.no-accounts {
  color: #94a3b8;
  font-size: 0.85rem;
  font-style: italic;
}

.add-account {
  display: flex;
  gap: 0.5rem;
}
</style>
