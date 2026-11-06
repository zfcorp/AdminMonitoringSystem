<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import AutoComplete from 'primevue/autocomplete'
import { useAuthStore } from '../../stores/auth'
import { supabase } from '../../lib/supabase'

const router = useRouter()
const authStore = useAuthStore()

const userEmail = computed(() => authStore.user?.email ?? '')

const searchQuery = ref(null)
const searchResults = ref([])
const searching = ref(false)

async function onSearch(event) {
  const query = event.query?.trim()
  if (!query) { searchResults.value = []; return }

  searching.value = true

  // Search clients by name
  const { data: matchingClients } = await supabase
    .from('clients')
    .select('id')
    .ilike('name', `%${query}%`)
    .limit(20)

  // Search accounts by account number
  const { data: matchingAccounts } = await supabase
    .from('client_accounts')
    .select('id')
    .ilike('account_number', `%${query}%`)
    .limit(20)

  const clientIds = (matchingClients || []).map((c) => c.id)
  const accountIds = (matchingAccounts || []).map((a) => a.id)

  if (!clientIds.length && !accountIds.length) {
    searchResults.value = []
    searching.value = false
    return
  }

  const orParts = []
  if (clientIds.length) orParts.push(`client_id.in.(${clientIds.join(',')})`)
  if (accountIds.length) orParts.push(`client_account_id.in.(${accountIds.join(',')})`)

  const { data: records } = await supabase
    .from('records')
    .select('id, reference_number, module, clients(name), client_accounts(account_number)')
    .or(orParts.join(','))
    .order('created_at', { ascending: false })
    .limit(15)

  searchResults.value = (records || []).map((r) => ({
    id: r.id,
    label: `${r.clients?.name} — ${r.client_accounts?.account_number}`,
    sub: `${r.reference_number} · ${r.module === 'borrowed' ? 'Borrowed' : 'Transmittal'}`,
    module: r.module,
  }))

  searching.value = false
}

function onSelect(event) {
  const item = event.value
  if (item?.id) {
    const routeName = item.module === 'transmittal' ? 'transmittal-detail' : 'record-detail'
    router.push({ name: routeName, params: { id: item.id } })
    searchQuery.value = null
  }
}

async function handleSignOut() {
  await authStore.signOut()
  router.push({ name: 'login' })
}
</script>

<template>
  <header class="app-header">
    <div class="app-header__title">{{ $route.meta?.title ?? 'Admin Monitoring' }}</div>
    <div class="app-header__right">
      <div class="global-search">
        <AutoComplete
          v-model="searchQuery"
          :suggestions="searchResults"
          :force-selection="false"
          option-label="label"
          placeholder="Search name or account ID…"
          empty-search-message=" "
          @complete="onSearch"
          @item-select="onSelect"
        >
          <template #option="{ option }">
            <div class="search-option">
              <div class="search-option__label">{{ option.label }}</div>
              <div class="search-option__sub">{{ option.sub }}</div>
            </div>
          </template>
        </AutoComplete>
      </div>
      <span v-if="userEmail" class="app-header__user">{{ userEmail }}</span>
      <button v-if="userEmail" class="app-header__signout" @click="handleSignOut">Sign Out</button>
    </div>
  </header>
</template>

<style scoped>
.app-header__user {
  font-size: 0.85rem;
  color: #475569;
  white-space: nowrap;
}

.app-header__signout {
  padding: 0.35rem 0.85rem;
  font-size: 0.8rem;
  font-weight: 500;
  color: #475569;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}
.app-header__signout:hover {
  background: #e2e8f0;
  color: #1e293b;
}

.global-search :deep(.p-autocomplete) {
  width: 280px;
}

.search-option {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.1rem 0;
}
.search-option__label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #1e293b;
}
.search-option__sub {
  font-size: 0.75rem;
  color: #94a3b8;
}
</style>
