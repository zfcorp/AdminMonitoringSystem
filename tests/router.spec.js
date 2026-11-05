import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent } from 'vue'

// Minimal stub components so we can mount the AppLayout + RouterView
const Stub = defineComponent({ template: '<div class="stub"><slot /></div>' })

const routes = [
  { path: '/', name: 'dashboard', component: { template: '<div>Dashboard</div>' }, meta: { title: 'Dashboard' } },
  { path: '/transmittals', name: 'transmittals', component: { template: '<div>Transmittals</div>' } },
  { path: '/borrowed', name: 'borrowed', component: { template: '<div>Borrowed</div>' } },
  { path: '/follow-ups', name: 'follow-ups', component: { template: '<div>Follow-ups</div>' } },
  { path: '/clients', name: 'clients', component: { template: '<div>Clients</div>' } },
  { path: '/import', name: 'import', component: { template: '<div>Import</div>' } },
  { path: '/import/history', name: 'import-history', component: { template: '<div>Import History</div>' } },
  { path: '/branches', name: 'branches', component: { template: '<div>Branches</div>' } },
  { path: '/login', name: 'login', component: { template: '<div>Login</div>' }, meta: { public: true } },
]

function createTestRouter() {
  const router = createRouter({ history: createMemoryHistory(), routes })
  return router
}

describe('Router', () => {
  it('navigates to each defined route', async () => {
    const router = createTestRouter()
    await router.push('/')
    await router.isReady()
    expect(router.currentRoute.value.name).toBe('dashboard')

    await router.push('/transmittals')
    expect(router.currentRoute.value.name).toBe('transmittals')

    await router.push('/borrowed')
    expect(router.currentRoute.value.name).toBe('borrowed')

    await router.push('/follow-ups')
    expect(router.currentRoute.value.name).toBe('follow-ups')

    await router.push('/clients')
    expect(router.currentRoute.value.name).toBe('clients')

    await router.push('/import')
    expect(router.currentRoute.value.name).toBe('import')

    await router.push('/import/history')
    expect(router.currentRoute.value.name).toBe('import-history')

    await router.push('/branches')
    expect(router.currentRoute.value.name).toBe('branches')

    await router.push('/login')
    expect(router.currentRoute.value.name).toBe('login')
  })

  it('has meta title on dashboard route', async () => {
    const router = createTestRouter()
    await router.push('/')
    await router.isReady()
    expect(router.currentRoute.value.meta.title).toBe('Dashboard')
  })
})
