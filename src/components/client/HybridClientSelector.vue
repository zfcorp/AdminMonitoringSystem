<script setup>
import { ref, watch } from 'vue'
import AutoComplete from 'primevue/autocomplete'
import { useClientsStore } from '../../stores/clients'

const props = defineProps({
  clientId: { type: [String, null], default: null },
  accountId: { type: [String, null], default: null },
})
const emit = defineEmits(['update:clientId', 'update:accountId'])

const clientsStore = useClientsStore()

// v-model values for AutoComplete: object when selected from suggestions,
// string when the user types without selecting (new entry).
const selectedClient = ref(null)
const selectedAccount = ref(null)
const clientSuggestions = ref([])
const accountSuggestions = ref([])
const accounts = ref([]) // accounts for the currently selected client

// ---- Pre-population when editing (clientId / accountId provided) ----
watch(
  () => props.clientId,
  async (id) => {
    if (id && !(selectedClient.value && typeof selectedClient.value === 'object' && selectedClient.value.id)) {
      const { data } = await clientsStore.getById(id)
      if (data) {
        selectedClient.value = data
        await loadAccounts(id)
      }
    }
  },
  { immediate: true }
)

watch(
  () => props.accountId,
  async (id) => {
    if (id && accounts.value.length) {
      // Compare as strings to avoid bigint vs string mismatch
      const acct = accounts.value.find((a) => String(a.id) === String(id))
      if (acct) {
        selectedAccount.value = acct
      }
    }
  },
  { immediate: true }
)

// Re-run account selection once accounts are loaded (handles timing issue)
watch(accounts, (list) => {
  if (props.accountId && list.length && !(selectedAccount.value && typeof selectedAccount.value === 'object')) {
    const acct = list.find((a) => String(a.id) === String(props.accountId))
    if (acct) selectedAccount.value = acct
  }
})

// ---- Client search (autocomplete) ----
async function onClientSearch(event) {
  const query = event.query
  if (!query.trim()) {
    clientSuggestions.value = []
    return
  }
  const { data } = await clientsStore.search(query)
  clientSuggestions.value = data || []
}

// ---- React to client selection / typing ----
watch(selectedClient, async (val) => {
  if (typeof val === 'object' && val?.id) {
    // Existing client selected
    emit('update:clientId', val.id)
    await loadAccounts(val.id)
    selectedAccount.value = null
  } else if (typeof val === 'string') {
    // New client name typed (not yet created)
    emit('update:clientId', null)
    accounts.value = []
    accountSuggestions.value = []
    selectedAccount.value = null
  }
})

async function loadAccounts(clientId) {
  const { data } = await clientsStore.getAccounts(clientId)
  accounts.value = data || []
}

// ---- Account search (autocomplete, filtered by selected client's accounts) ----
function onAccountSearch(event) {
  const query = event.query.toLowerCase()
  if (!accounts.value.length) {
    accountSuggestions.value = []
    return
  }
  accountSuggestions.value = accounts.value.filter((a) =>
    a.account_number.toLowerCase().includes(query)
  )
}

// ---- React to account selection / typing ----
watch(selectedAccount, (val) => {
  if (typeof val === 'object' && val?.id) {
    emit('update:accountId', val.id)
  } else if (typeof val === 'string') {
    // New account typed (will be created on save)
    emit('update:accountId', null)
  }
})

// ---- Create new client / account if typed but not selected ----
async function ensureCreated() {
  // Create client if it's a new string
  if (typeof selectedClient.value === 'string' && selectedClient.value.trim()) {
    const { data, error } = await clientsStore.create(selectedClient.value.trim())
    if (!error && data) {
      selectedClient.value = data
      emit('update:clientId', data.id)
    }
  }

  // Create account if it's a new string and we have a client
  if (
    typeof selectedAccount.value === 'string' &&
    selectedAccount.value.trim() &&
    typeof selectedClient.value === 'object' &&
    selectedClient.value?.id
  ) {
    const { data, error } = await clientsStore.createAccount(
      selectedClient.value.id,
      selectedAccount.value.trim()
    )
    if (!error && data) {
      selectedAccount.value = data
      emit('update:accountId', data.id)
    }
  }

  // Return the resolved IDs so the parent can use them immediately
  return {
    clientId: typeof selectedClient.value === 'object' ? selectedClient.value?.id : null,
    accountId: typeof selectedAccount.value === 'object' ? selectedAccount.value?.id : null,
  }
}

defineExpose({ ensureCreated })
</script>

<template>
  <div class="hybrid-selector">
    <div class="hybrid-selector__field">
      <label>
        NAME OF CLIENT <span class="required">*</span>
        <AutoComplete
          v-model="selectedClient"
          :suggestions="clientSuggestions"
          :force-selection="false"
          option-label="name"
          placeholder="Type to search or enter new client…"
          empty-search-message=" "
          @complete="onClientSearch"
        />
      </label>
    </div>
    <div class="hybrid-selector__field">
      <label>
        Account <span class="required">*</span>
        <AutoComplete
          v-model="selectedAccount"
          :suggestions="accountSuggestions"
          :force-selection="false"
          option-label="account_number"
          :disabled="!selectedClient || (typeof selectedClient === 'object' && !selectedClient?.id && !selectedClient)"
          placeholder="Type to search or enter new account…"
          empty-search-message=" "
          @complete="onAccountSearch"
        />
      </label>
    </div>
  </div>
</template>

<style scoped>
.hybrid-selector {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.hybrid-selector__field {
  flex: 1;
  min-width: 200px;
}

.hybrid-selector__field label {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.85rem;
  font-weight: 500;
  color: #475569;
}

.hybrid-selector__field :deep(.p-autocomplete),
.hybrid-selector__field :deep(.p-autocomplete-input) {
  width: 100%;
}

.required {
  color: #ef4444;
}
</style>
