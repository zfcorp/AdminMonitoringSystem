import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock the supabase client before importing the store
vi.mock('../src/lib/supabase', () => {
  const mockAuth = {
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    onAuthStateChange: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
  }
  return { supabase: { auth: mockAuth } }
})

import { supabase } from '../src/lib/supabase'
import { useAuthStore } from '../src/stores/auth'

describe('Auth Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('signIn populates user on success', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: { email: 'admin@zurichfinance.com' } },
      error: null,
    })

    const store = useAuthStore()
    const { error } = await store.signIn('admin@zurichfinance.com', 'password')

    expect(error).toBeNull()
    expect(store.user).toEqual({ email: 'admin@zurichfinance.com' })
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'admin@zurichfinance.com',
      password: 'password',
    })
  })

  it('signIn returns error and keeps user null on failure', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    })

    const store = useAuthStore()
    const { error } = await store.signIn('wrong@example.com', 'badpass')

    expect(error).toBeTruthy()
    expect(error.message).toBe('Invalid login credentials')
    expect(store.user).toBeNull()
  })

  it('signOut clears user on success', async () => {
    supabase.auth.signOut.mockResolvedValue({ error: null })

    const store = useAuthStore()
    store.user = { email: 'admin@zurichfinance.com' }

    const { error } = await store.signOut()

    expect(error).toBeNull()
    expect(store.user).toBeNull()
  })

  it('signOut keeps user if signOut fails', async () => {
    supabase.auth.signOut.mockResolvedValue({ error: { message: 'Network error' } })

    const store = useAuthStore()
    store.user = { email: 'admin@zurichfinance.com' }

    const { error } = await store.signOut()

    expect(error).toBeTruthy()
    expect(store.user).not.toBeNull()
  })
})
