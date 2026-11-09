<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import AutoComplete from 'primevue/autocomplete'
import { useAuthStore } from '../../stores/auth'
import { supabase } from '../../lib/supabase'

const router = useRouter()
const authStore = useAuthStore()

const userEmail = computed(() => authStore.user?.email ?? '')
const userInitial = computed(() => userEmail.value?.[0]?.toUpperCase() ?? '?')
const isAdmin = computed(() => authStore.isAdmin())

const searchQuery = ref(null)
const searchResults = ref([])
const searching = ref(false)
const menuOpen = ref(false)

async function onSearch(event) {
  const query = event.query?.trim()
  if (!query) { searchResults.value = []; return }
  searching.value = true

  const { data: matchingClients } = await supabase
    .from('clients').select('id').ilike('name', `%${query}%`).limit(20)
  const { data: matchingAccounts } = await supabase
    .from('client_accounts').select('id').ilike('account_number', `%${query}%`).limit(20)

  const clientIds  = (matchingClients  || []).map((c) => c.id)
  const accountIds = (matchingAccounts || []).map((a) => a.id)

  if (!clientIds.length && !accountIds.length) {
    searchResults.value = []
    searching.value = false
    return
  }

  const orParts = []
  if (clientIds.length)  orParts.push(`client_id.in.(${clientIds.join(',')})`)
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
  menuOpen.value = false
  await authStore.signOut()
  router.push({ name: 'login' })
}

function toggleMenu() { menuOpen.value = !menuOpen.value }
function closeMenu() { menuOpen.value = false }
</script>

<template>
  <header class="app-header">
    <div class="app-header__title">{{ $route.meta?.title ?? 'Admin Monitoring' }}</div>
    <div class="app-header__right">
      <!-- Global search -->
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

      <!-- User menu -->
      <div class="user-menu" v-if="userEmail" v-click-outside="closeMenu">
        <button class="user-menu__trigger" @click="toggleMenu">
          <span class="user-avatar">{{ userInitial }}</span>
          <span class="user-email">{{ userEmail }}</span>
          <i :class="['pi', menuOpen ? 'pi-chevron-up' : 'pi-chevron-down', 'user-chevron']" />
        </button>

        <div v-if="menuOpen" class="user-menu__dropdown">
          <div class="user-menu__header">
            <div class="user-avatar user-avatar--lg">{{ userInitial }}</div>
            <div>
              <div class="user-menu__email">{{ userEmail }}</div>
              <div class="user-menu__role">{{ isAdmin ? 'Administrator' : 'User' }}</div>
            </div>
          </div>
          <div class="user-menu__divider" />
          <button class="user-menu__item" @click="router.push({ name: 'settings' }); closeMenu()">
            <i class="pi pi-cog" /> Settings
          </button>
          <div class="user-menu__divider" />
          <button class="user-menu__item user-menu__item--danger" @click="handleSignOut">
            <i class="pi pi-sign-out" /> Sign Out
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-header__right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.global-search :deep(.p-autocomplete) { width: 280px; }

.search-option { display: flex; flex-direction: column; gap: 0.1rem; padding: 0.1rem 0; }
.search-option__label { font-size: 0.875rem; font-weight: 500; color: #1e293b; }
.search-option__sub { font-size: 0.75rem; color: #94a3b8; }

/* User menu */
.user-menu {
  position: relative;
}

.user-menu__trigger {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.3rem 0.65rem 0.3rem 0.4rem;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
}
.user-menu__trigger:hover { background: #f8fafc; border-color: #cbd5e1; }

.user-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #1e293b;
  color: #fff;
  font-size: 0.78rem;
  font-weight: 700;
  flex-shrink: 0;
}
.user-avatar--lg {
  width: 36px;
  height: 36px;
  font-size: 0.9rem;
}

.user-email {
  font-size: 0.82rem;
  color: #334155;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-chevron {
  font-size: 0.7rem;
  color: #94a3b8;
}

.user-menu__dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 220px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.10);
  z-index: 100;
  overflow: hidden;
}

.user-menu__header {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.85rem 1rem;
  background: #f8fafc;
}

.user-menu__email {
  font-size: 0.82rem;
  font-weight: 600;
  color: #1e293b;
  word-break: break-all;
}

.user-menu__role {
  font-size: 0.72rem;
  color: #64748b;
  margin-top: 0.1rem;
}

.user-menu__divider {
  height: 1px;
  background: #f1f5f9;
}

.user-menu__item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.65rem 1rem;
  background: none;
  border: none;
  font-size: 0.85rem;
  color: #334155;
  cursor: pointer;
  text-align: left;
  transition: background 0.12s;
}
.user-menu__item:hover { background: #f8fafc; }
.user-menu__item .pi { font-size: 0.85rem; color: #64748b; }
.user-menu__item--danger { color: #dc2626; }
.user-menu__item--danger:hover { background: #fef2f2; }
.user-menu__item--danger .pi { color: #dc2626; }
</style>
