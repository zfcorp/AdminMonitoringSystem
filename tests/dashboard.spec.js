import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: { from: vi.fn(), auth: {} },
}))

vi.mock('../src/lib/supabase', () => ({ supabase: mockSupabase }))

import { useDashboardStore } from '../src/stores/dashboard'

function mockCountChain(count = 0, error = null) {
  const result = { data: null, error, count }
  const chain = {
    select: vi.fn(() => chain),
    is: vi.fn(() => chain),
    not: vi.fn(() => chain),
  }
  chain.then = (onFulfilled) => Promise.resolve(result).then(onFulfilled)
  return chain
}

describe('Dashboard Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('fetch populates all five metrics correctly', async () => {
    // Each call to from() returns a count chain.
    // 5 parallel queries: transmittals, borrowed (not returned), borrowed (returned), follow-ups (pending), follow-ups (resolved)
    mockSupabase.from
      .mockReturnValueOnce(mockCountChain(152))  // total transmittals
      .mockReturnValueOnce(mockCountChain(8))    // currently borrowed
      .mockReturnValueOnce(mockCountChain(45))   // returned items
      .mockReturnValueOnce(mockCountChain(12))   // pending follow-ups
      .mockReturnValueOnce(mockCountChain(30))   // resolved follow-ups

    const store = useDashboardStore()
    await store.fetch()

    expect(store.metrics.totalTransmittals).toBe(152)
    expect(store.metrics.currentlyBorrowed).toBe(8)
    expect(store.metrics.returnedItems).toBe(45)
    expect(store.metrics.pendingFollowUps).toBe(12)
    expect(store.metrics.resolvedFollowUps).toBe(30)
  })

  it('sets lastRefreshed timestamp after fetch', async () => {
    mockSupabase.from.mockReturnValue(mockCountChain(0))

    const store = useDashboardStore()
    expect(store.lastRefreshed).toBeNull()

    await store.fetch()
    expect(store.lastRefreshed).toBeInstanceOf(Date)
  })

  it('sets loading to false after fetch', async () => {
    mockSupabase.from.mockReturnValue(mockCountChain(0))

    const store = useDashboardStore()
    await store.fetch()
    expect(store.loading).toBe(false)
  })

  it('handles errors gracefully (treats as 0)', async () => {
    mockSupabase.from.mockReturnValue(mockCountChain(null, { message: 'table does not exist' }))

    const store = useDashboardStore()
    await store.fetch()

    // Error count is null → 0 via fallback
    expect(store.metrics.totalTransmittals).toBe(0)
  })
})
