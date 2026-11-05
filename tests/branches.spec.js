import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: {
    from: vi.fn(),
    auth: {},
  },
}))

vi.mock('../src/lib/supabase', () => ({
  supabase: mockSupabase,
}))

import { useBranchesStore } from '../src/stores/branches'

/**
 * Creates a chainable mock matching the Supabase query-builder API.
 * - `await chain` (thenable) resolves to { data, error }
 * - `chain.single()` resolves to { data, error }
 */
function mockChain(data = [], error = null) {
  const result = { data, error }
  const chain = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    single: vi.fn(() =>
      Promise.resolve({ data: Array.isArray(data) ? data[0] ?? null : data, error })
    ),
  }
  chain.then = (onFulfilled) => Promise.resolve(result).then(onFulfilled)
  return chain
}

describe('Branches Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('fetch populates the branches list', async () => {
    const testData = [{ id: 1, name: 'Quezon City' }, { id: 2, name: 'Makati' }]
    mockSupabase.from.mockReturnValue(mockChain(testData))

    const store = useBranchesStore()
    const { error } = await store.fetch()

    expect(error).toBeNull()
    expect(store.branches).toEqual(testData)
    expect(store.loading).toBe(false)
  })

  it('create inserts a branch and refreshes the list', async () => {
    const insertChain = mockChain({ id: 3, name: 'Cebu' })
    const fetchChain = mockChain([{ id: 1, name: 'Quezon City' }, { id: 3, name: 'Cebu' }])

    mockSupabase.from
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(fetchChain)

    const store = useBranchesStore()
    await store.create('Cebu')

    expect(insertChain.insert).toHaveBeenCalledWith({ name: 'Cebu' })
    expect(store.branches).toEqual([{ id: 1, name: 'Quezon City' }, { id: 3, name: 'Cebu' }])
  })

  it('update modifies a branch and refreshes the list', async () => {
    const updateChain = mockChain({ id: 1, name: 'Makati CBD' })
    const fetchChain = mockChain([{ id: 1, name: 'Makati CBD' }])

    mockSupabase.from
      .mockReturnValueOnce(updateChain)
      .mockReturnValueOnce(fetchChain)

    const store = useBranchesStore()
    await store.update(1, 'Makati CBD')

    expect(updateChain.update).toHaveBeenCalledWith({ name: 'Makati CBD' })
    expect(updateChain.eq).toHaveBeenCalledWith('id', 1)
    expect(store.branches).toEqual([{ id: 1, name: 'Makati CBD' }])
  })

  it('remove deletes a branch and refreshes the list', async () => {
    const deleteChain = mockChain(null)
    const fetchChain = mockChain([{ id: 1, name: 'Quezon City' }])

    mockSupabase.from
      .mockReturnValueOnce(deleteChain)
      .mockReturnValueOnce(fetchChain)

    const store = useBranchesStore()
    await store.remove(2)

    expect(deleteChain.delete).toHaveBeenCalled()
    expect(deleteChain.eq).toHaveBeenCalledWith('id', 2)
    expect(store.branches).toEqual([{ id: 1, name: 'Quezon City' }])
  })

  it('getById returns the branch with matching id from cached list', async () => {
    mockSupabase.from.mockReturnValue(
      mockChain([{ id: 1, name: 'QC' }, { id: 2, name: 'Makati' }])
    )

    const store = useBranchesStore()
    await store.fetch()

    expect(store.getById(1)).toEqual({ id: 1, name: 'QC' })
    expect(store.getById(99)).toBeUndefined()
  })

  it('getReferenceCount returns 0 when referenced tables do not exist yet', async () => {
    const countChain = mockChain(null, { message: 'relation does not exist' })

    mockSupabase.from.mockReturnValue(countChain)

    const store = useBranchesStore()
    const count = await store.getReferenceCount(1)

    expect(count).toBe(0)
  })
})
