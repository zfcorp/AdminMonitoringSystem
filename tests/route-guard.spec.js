import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

// Mock supabase
vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(),
    },
  },
}))

import { useAuthStore } from '../src/stores/auth'

/**
 * Creates a fresh router with the same guard logic used in
 * src/router/index.js. Using createMemoryHistory avoids
 * createWebHistory issues in the jsdom test environment.
 */
function createGuardedRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'dashboard', component: { template: '<div />' } },
      { path: '/transmittals', name: 'transmittals', component: { template: '<div />' } },
      { path: '/login', name: 'login', component: { template: '<div />' }, meta: { public: true } },
    ],
  })

  router.beforeEach((to) => {
    const authStore = useAuthStore()
    const isPublic = to.meta?.public === true
    const isAuthenticated = !!authStore.user

    if (!isAuthenticated && !isPublic) {
      return { name: 'login', query: { redirect: to.fullPath } }
    }
    if (isAuthenticated && to.name === 'login') {
      return { name: 'dashboard' }
    }
    return true
  })

  return router
}

describe('Route Guard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('redirects unauthenticated users to login with redirect param', async () => {
    const router = createGuardedRouter()
    useAuthStore().user = null

    await router.push('/transmittals')

    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/transmittals')
  })

  it('allows authenticated users to access protected routes', async () => {
    const router = createGuardedRouter()
    useAuthStore().user = { email: 'admin@zurichfinance.com' }

    await router.push('/transmittals')

    expect(router.currentRoute.value.name).toBe('transmittals')
  })

  it('redirects authenticated users away from login to dashboard', async () => {
    const router = createGuardedRouter()
    useAuthStore().user = { email: 'admin@zurichfinance.com' }

    await router.push('/login')

    expect(router.currentRoute.value.name).toBe('dashboard')
  })

  it('allows unauthenticated users to access the login page', async () => {
    const router = createGuardedRouter()
    useAuthStore().user = null

    await router.push('/login')

    expect(router.currentRoute.value.name).toBe('login')
  })
})
