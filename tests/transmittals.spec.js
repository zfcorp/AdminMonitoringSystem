import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: { from: vi.fn(), auth: {} },
}))

vi.mock('../src/lib/supabase', () => ({ supabase: mockSupabase }))

import { useTransmittalsStore } from '../src/stores/transmittals'

/**
 * Comprehensive chainable mock supporting all Supabase query-builder
 * methods used by the transmittals store.
 */
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
    order: vi.fn(() => chain),
    range: vi.fn(() => chain),
    single: vi.fn(() =>
      Promise.resolve({ data: Array.isArray(data) ? data[0] ?? null : data, error })
    ),
  }
  chain.then = (onFulfilled) => Promise.resolve(result).then(onFulfilled)
  return chain
}

describe('Transmittals Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('fetch populates transmittals list and totalCount', async () => {
    const testData = [
      { id: 1, reference_number: 'TRN-00001', clients: { name: 'Juan' } },
      { id: 2, reference_number: 'TRN-00002', clients: { name: 'Maria' } },
    ]
    mockSupabase.from.mockReturnValue(mockChain(testData, null, 2))

    const store = useTransmittalsStore()
    const { error, count } = await store.fetch()

    expect(error).toBeNull()
    expect(store.transmittals).toEqual(testData)
    expect(store.totalCount).toBe(2)
  })

  it('fetch with search queries clients first, then filters transmittals', async () => {
    const transmittalChain = mockChain([{ id: 1, reference_number: 'TRN-00001' }], null, 1)
    const clientChain = mockChain([{ id: 1 }])

    // Store calls from('transmittals') first, then from('clients') for search
    mockSupabase.from
      .mockReturnValueOnce(transmittalChain) // first from(): transmittals query
      .mockReturnValueOnce(clientChain)     // second from(): clients search

    const store = useTransmittalsStore()
    await store.fetch({ filters: { search: 'Juan' } })

    expect(store.transmittals).toHaveLength(1)
    expect(transmittalChain.or).toHaveBeenCalled()
  })

  it('fetch with no matching clients searches reference_number only', async () => {
    const transmittalChain = mockChain([], null, 0)
    const clientChain = mockChain([])

    mockSupabase.from
      .mockReturnValueOnce(transmittalChain) // first from(): transmittals query
      .mockReturnValueOnce(clientChain)     // second from(): clients search

    const store = useTransmittalsStore()
    await store.fetch({ filters: { search: 'xyz' } })

    expect(transmittalChain.ilike).toHaveBeenCalledWith('reference_number', '%xyz%')
  })

  it('create inserts a transmittal and returns it with relations', async () => {
    const created = {
      id: 1,
      reference_number: 'TRN-00001',
      clients: { name: 'Juan' },
      client_accounts: { account_number: 'ACC-001' },
      branches: { name: 'QC' },
    }
    mockSupabase.from.mockReturnValue(mockChain(created))

    const store = useTransmittalsStore()
    const { data, error } = await store.create({
      client_id: 1,
      client_account_id: 1,
      branch_id: 1,
      date_released: '2025-01-15',
    })

    expect(error).toBeNull()
    expect(data.reference_number).toBe('TRN-00001')
  })

  it('getById returns a single transmittal', async () => {
    const record = { id: 1, reference_number: 'TRN-00001', clients: { name: 'Juan' } }
    mockSupabase.from.mockReturnValue(mockChain(record))

    const store = useTransmittalsStore()
    const { data, error } = await store.getById(1)

    expect(error).toBeNull()
    expect(data).toEqual(record)
  })

  it('update modifies a transmittal', async () => {
    const updated = { id: 1, reference_number: 'TRN-00001', remarks: 'Updated' }
    mockSupabase.from.mockReturnValue(mockChain(updated))

    const store = useTransmittalsStore()
    const { data, error } = await store.update(1, { remarks: 'Updated' })

    expect(error).toBeNull()
    expect(data.remarks).toBe('Updated')
  })

  it('remove deletes a transmittal', async () => {
    mockSupabase.from.mockReturnValue(mockChain(null))

    const store = useTransmittalsStore()
    const { error } = await store.remove(1)

    expect(error).toBeNull()
  })
})
