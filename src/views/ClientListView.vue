<script setup>
import { ref, onMounted } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { useClientsStore } from '../stores/clients'
import ClientFormDialog from '../components/client/ClientFormDialog.vue'

const clientsStore = useClientsStore()
const confirm = useConfirm()
const toast = useToast()

const searchQuery = ref('')
const showDialog = ref(false)
const editingClient = ref(null)
const expandedRows = ref([])

onMounted(() => {
  loadClients()
})

async function loadClients() {
  await clientsStore.fetch(searchQuery.value)
}

function onSearch() {
  loadClients()
}

function openAddDialog() {
  editingClient.value = null
  showDialog.value = true
}

function openEditDialog(client) {
  editingClient.value = client
  showDialog.value = true
}

async function onSaved() {
  await loadClients()
}

function confirmDelete(client) {
  confirm.require({
    message: `Delete client "${client.name}" and all their account IDs? This cannot be undone.`,
    header: 'Confirm Delete',
    acceptClass: 'p-button-danger',
    accept: async () => {
      const { error } = await clientsStore.remove(client.id)
      if (error) {
        toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 5000 })
        return
      }
      toast.add({ severity: 'success', summary: 'Deleted', detail: 'Client deleted.', life: 3000 })
      await loadClients()
    },
  })
}
</script>

<template>
  <div>
    <div class="page-header">
      <Button label="New Client" icon="pi pi-plus" @click="openAddDialog" />
    </div>

    <div class="search-bar">
      <InputText
        v-model="searchQuery"
        placeholder="Search by client name…"
        @keydown.enter="onSearch"
      />
      <Button label="Search" @click="onSearch" />
    </div>

    <DataTable
      :value="clientsStore.clients"
      :loading="clientsStore.loading"
      v-model:expanded-rows="expandedRows"
      stripedRows
    >
      <Column header="Client Name" field="name" sortable />
      <Column header="Actions" style="width: 200px">
        <template #body="slotProps">
          <Button label="Edit" icon="pi pi-pencil" severity="secondary" text @click="openEditDialog(slotProps.data)" />
          <Button label="Delete" icon="pi pi-trash" severity="danger" text @click="confirmDelete(slotProps.data)" />
        </template>
      </Column>

      <template #expansion="slotProps">
        <div class="account-expansion">
          <strong>Account IDs for {{ slotProps.data.name }}:</strong>
          <div v-if="slotProps.data.client_accounts?.length" class="account-chips">
            <span v-for="acct in slotProps.data.client_accounts" :key="acct.id" class="account-chip">
              {{ acct.account_number }}
            </span>
          </div>
          <span v-else class="no-accounts">No account IDs.</span>
        </div>
      </template>
    </DataTable>

    <ClientFormDialog
      v-model:visible="showDialog"
      :client="editingClient"
      @saved="onSaved"
    />
  </div>
</template>

<style scoped>
.account-expansion {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  color: #475569;
}

.account-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.account-chip {
  padding: 0.25rem 0.75rem;
  background: #e0f2fe;
  color: #0369a1;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 500;
}

.no-accounts {
  color: #94a3b8;
  font-style: italic;
  margin-left: 0.5rem;
}
</style>
