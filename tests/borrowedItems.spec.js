import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: { from: vi.fn(), auth: {} },
}))

vi.mock('../src/lib/supabase', () => ({ supabase: mockSupabase }))

import { useBorrowedItemsStore } from '../src/stores/borrowedItems'

function mockChain(data = [], error = null, count = null) {
  const result = { data, error, count: count ?? (Array.isArray(data) ? data.length : 0) }
  const chain = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    ilike: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    or: vi.fn(() => chain),
    is: vi.fn(() => chain),
    not: vi.fn(() => chain),
    order: vi.fn(() => chain),
    range: vi.fn(() => chain),
    single: vi.fn(() =>
      Promise.resolve({ data: Array.isArray(data) ? data[0] ?? null : data, error })
    ),
  }
  chain.then = (onFulfilled) => Promise.resolve(result).then(onFulfilled)
  return chain
}

describe('Borrowed Items Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('fetch populates borrowed items list and totalCount', async () => {
    const testData = [
      { id: 1, reference_number: 'BRW-00001', clients: { name: 'Juan' } },
      { id: 2, reference_number: 'BRW-00002', clients: { name: 'Maria' } },
    ]
    mockSupabase.from.mockReturnValue(mockChain(testData, null, 2))

    const store = useBorrowedItemsStore()
    const { error, count } = await store.fetch()

    expect(error).toBeNull()
    expect(store.borrowedItems).toEqual(testData)
    expect(store.totalCount).toBe(2)
  })

  it('fetch with status=borrowed filters for date_returned IS NULL', async () => {
    const chain = mockChain([], null, 0)
    mockSupabase.from.mockReturnValue(chain)

    const store = useBorrowedItemsStore()
    await store.fetch({ filters: { status: 'borrowed' } })

    expect(chain.is).toHaveBeenCalledWith('date_returned', null)
  })

  it('fetch with status=returned filters for date_returned IS NOT NULL', async () => {
    const chain = mockChain([], null, 0)
    mockSupabase.from.mockReturnValue(chain)

    const store = useBorrowedItemsStore()
    await store.fetch({ filters: { status: 'returned' } })

    expect(chain.not).toHaveBeenCalledWith('date_returned', 'is', null)
  })

  it('create inserts and returns a borrowed item', async () => {
    const created = {
      id: 1,
      reference_number: 'BRW-00001',
      clients: { name: 'Juan' },
    }
    mockSupabase.from.mockReturnValue(mockChain(created))

    const store = useBorrowedItemsStore()
    const { data, error } = await store.create({
      client_id: 1,
      client_account_id: 1,
      branch_id: 1,
    })

    expect(error).toBeNull()
    expect(data.reference_number).toBe('BRW-00001')
  })

  it('getById returns a single borrowed item', async () => {
    const record = { id: 1, reference_number: 'BRW-00001', clients: { name: 'Juan' } }
    mockSupabase.from.mockReturnValue(mockChain(record))

    const store = useBorrowedItemsStore()
    const { data, error } = await store.getById(1)

    expect(error).toBeNull()
    expect(data).toEqual(record)
  })

  it('update modifies a borrowed item', async () => {
    const updated = { id: 1, reference_number: 'BRW-00001', status: 'Returned' }
    mockSupabase.from.mockReturnValue(mockChain(updated))

    const store = useBorrowedItemsStore()
    const { data, error } = await store.update(1, { status: 'Returned' })

    expect(error).toBeNull()
    expect(data.status).toBe('Returned')
  })

  it('remove deletes a borrowed item', async () => {
    mockSupabase.from.mockReturnValue(mockChain(null))

    const store = useBorrowedItemsStore()
    const { error } = await store.remove(1)

    expect(error).toBeNull()
  })
})
