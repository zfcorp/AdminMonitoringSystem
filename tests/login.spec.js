import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

// Mock supabase
vi.mock('../src/lib/supabase', () => {
  const mockAuth = {
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    onAuthStateChange: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
  }
  return { supabase: { auth: mockAuth } }
})

// Mock PrimeVue toast (LoginView uses useToast)
vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: vi.fn() }),
}))

import { supabase } from '../src/lib/supabase'
import LoginView from '../src/views/LoginView.vue'
import { useAuthStore } from '../src/stores/auth'

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'dashboard', component: { template: '<div />' } },
      { path: '/login', name: 'login', component: { template: '<div />' }, meta: { public: true } },
    ],
  })
}

describe('LoginView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('renders email input, password input, and submit button', () => {
    const router = createTestRouter()
    const wrapper = mount(LoginView, { global: { plugins: [router] } })

    expect(wrapper.find('input[type="email"]').exists()).toBe(true)
    expect(wrapper.find('input[type="password"]').exists()).toBe(true)
    expect(wrapper.find('button[type="submit"]').exists()).toBe(true)
  })

  it('calls authStore.signIn with email and password on submit', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: { email: 'admin@zurichfinance.com' } },
      error: null,
    })

    const router = createTestRouter()
    const wrapper = mount(LoginView, { global: { plugins: [router] } })

    await wrapper.find('input[type="email"]').setValue('admin@zurichfinance.com')
    await wrapper.find('input[type="password"]').setValue('secretpass')
    await wrapper.find('form').trigger('submit.prevent')

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'admin@zurichfinance.com',
      password: 'secretpass',
    })
  })

  it('shows loading state on the button while signing in', async () => {
    // Make signIn hang so we can observe the loading state
    supabase.auth.signInWithPassword.mockReturnValue(new Promise(() => {}))

    const router = createTestRouter()
    const wrapper = mount(LoginView, { global: { plugins: [router] } })

    await wrapper.find('input[type="email"]').setValue('admin@zurichfinance.com')
    await wrapper.find('input[type="password"]').setValue('secretpass')
    wrapper.find('form').trigger('submit.prevent')

    // Wait a tick for the loading ref to update
    await new Promise((r) => setTimeout(r, 10))

    const btn = wrapper.find('button[type="submit"]')
    expect(btn.attributes('disabled')).toBeDefined()
    expect(btn.text()).toContain('Signing in')
  })
})
