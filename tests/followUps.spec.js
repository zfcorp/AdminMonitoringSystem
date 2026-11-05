import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: { from: vi.fn(), auth: {} },
}))

vi.mock('../src/lib/supabase', () => ({ supabase: mockSupabase }))

import { useFollowUpsStore } from '../src/stores/followUps'

function mockChain(data = [], error = null, count = null) {
  const result = { data, error, count: count ?? (Array.isArray(data) ? data.length : 0) }
  const chain = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    not: vi.fn(() => chain),
    order: vi.fn(() => chain),
    range: vi.fn(() => chain),
    ilike: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn(() =>
      Promise.resolve({ data: Array.isArray(data) ? data[0] ?? null : data, error })
    ),
  }
  chain.then = (onFulfilled) => Promise.resolve(result).then(onFulfilled)
  return chain
}

describe('Follow-ups Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('fetch populates follow-ups list', async () => {
    const testData = [
      { id: 1, reference_number: 'FUP-00001', transmittals: { reference_number: 'TRN-00001' } },
    ]
    mockSupabase.from.mockReturnValue(mockChain(testData, null, 1))

    const store = useFollowUpsStore()
    const { error, count } = await store.fetch()

    expect(error).toBeNull()
    expect(store.followUps).toEqual(testData)
    expect(store.totalCount).toBe(1)
  })

  it('fetch with status=pending filters for resolved_date IS NULL', async () => {
    const chain = mockChain([], null, 0)
    mockSupabase.from.mockReturnValue(chain)

    const store = useFollowUpsStore()
    await store.fetch({ filters: { status: 'pending' } })

    expect(chain.is).toHaveBeenCalledWith('resolved_date', null)
  })

  it('fetch with status=resolved filters for resolved_date IS NOT NULL', async () => {
    const chain = mockChain([], null, 0)
    mockSupabase.from.mockReturnValue(chain)

    const store = useFollowUpsStore()
    await store.fetch({ filters: { status: 'resolved' } })

    expect(chain.not).toHaveBeenCalledWith('resolved_date', 'is', null)
  })

  it('fetchByParent queries by the correct FK column', async () => {
    mockSupabase.from.mockReturnValue(mockChain([]))

    const store = useFollowUpsStore()
    await store.fetchByParent('transmittal', 5)

    expect(mockSupabase.from).toHaveBeenCalledWith('follow_ups')
  })

  it('create inserts a follow-up linked to a transmittal', async () => {
    const created = { id: 1, reference_number: 'FUP-00001', transmittal_id: 5 }
    mockSupabase.from.mockReturnValue(mockChain(created))

    const store = useFollowUpsStore()
    const { data, error } = await store.create({
      transmittal_id: 5,
      borrowed_item_id: null,
      subject: 'Pending ORCR',
    })

    expect(error).toBeNull()
    expect(data.reference_number).toBe('FUP-00001')
  })

  it('markResolved sets status and resolved_date', async () => {
    const resolved = { id: 1, status: 'Resolved', resolved_date: '2025-11-04' }
    mockSupabase.from.mockReturnValue(mockChain(resolved))

    const store = useFollowUpsStore()
    const { data, error } = await store.markResolved(1)

    expect(error).toBeNull()
    expect(data.status).toBe('Resolved')
    expect(data.resolved_date).toBeTruthy()
  })

  it('update modifies a follow-up', async () => {
    const updated = { id: 1, subject: 'Updated subject' }
    mockSupabase.from.mockReturnValue(mockChain(updated))

    const store = useFollowUpsStore()
    const { data, error } = await store.update(1, { subject: 'Updated subject' })

    expect(error).toBeNull()
    expect(data.subject).toBe('Updated subject')
  })

  it('remove deletes a follow-up', async () => {
    mockSupabase.from.mockReturnValue(mockChain(null))

    const store = useFollowUpsStore()
    const { error } = await store.remove(1)

    expect(error).toBeNull()
  })

  it('searchParents queries the correct table', async () => {
    mockSupabase.from.mockReturnValue(mockChain([
      { id: 5, reference_number: 'TRN-00005', clients: { name: 'Juan' } },
    ]))

    const store = useFollowUpsStore()
    const { data } = await store.searchParents('transmittal', 'TRN')

    expect(data).toHaveLength(1)
    expect(mockSupabase.from).toHaveBeenCalledWith('transmittals')
  })
})
