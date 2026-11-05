import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: { from: vi.fn(), auth: {} },
}))

vi.mock('../src/lib/supabase', () => ({ supabase: mockSupabase }))

import { useClientsStore } from '../src/stores/clients'

function mockChain(data = [], error = null) {
  const result = { data, error }
  const chain = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    ilike: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    single: vi.fn(() =>
      Promise.resolve({ data: Array.isArray(data) ? data[0] ?? null : data, error })
    ),
  }
  chain.then = (onFulfilled) => Promise.resolve(result).then(onFulfilled)
  return chain
}

describe('Clients Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('fetch populates clients with nested accounts', async () => {
    const testData = [
      { id: 1, name: 'Juan dela Cruz', client_accounts: [{ id: 1, account_number: 'ACC-001' }] },
      { id: 2, name: 'Maria Santos', client_accounts: [] },
    ]
    mockSupabase.from.mockReturnValue(mockChain(testData))

    const store = useClientsStore()
    const { error } = await store.fetch()

    expect(error).toBeNull()
    expect(store.clients).toEqual(testData)
    expect(store.loading).toBe(false)
  })

  it('fetch with search applies ilike filter', async () => {
    const chain = mockChain([{ id: 1, name: 'Juan', client_accounts: [] }])
    mockSupabase.from.mockReturnValue(chain)

    const store = useClientsStore()
    await store.fetch('Juan')

    expect(chain.ilike).toHaveBeenCalledWith('name', '%Juan%')
  })

  it('search returns lightweight results for autocomplete', async () => {
    const results = [{ id: 1, name: 'Juan dela Cruz' }]
    mockSupabase.from.mockReturnValue(mockChain(results))

    const store = useClientsStore()
    const { data } = await store.search('Juan')

    expect(data).toEqual(results)
  })

  it('getById returns a single client', async () => {
    const client = { id: 1, name: 'Juan' }
    mockSupabase.from.mockReturnValue(mockChain(client))

    const store = useClientsStore()
    const { data, error } = await store.getById(1)

    expect(error).toBeNull()
    expect(data).toEqual(client)
  })

  it('create inserts and returns the new client', async () => {
    const newClient = { id: 3, name: 'Pedro' }
    mockSupabase.from.mockReturnValue(mockChain(newClient))

    const store = useClientsStore()
    const { data, error } = await store.create('Pedro')

    expect(error).toBeNull()
    expect(data).toEqual(newClient)
  })

  it('update modifies a client name', async () => {
    const updated = { id: 1, name: 'Updated Name' }
    mockSupabase.from.mockReturnValue(mockChain(updated))

    const store = useClientsStore()
    const { data, error } = await store.update(1, 'Updated Name')

    expect(error).toBeNull()
    expect(data).toEqual(updated)
  })

  it('remove deletes a client', async () => {
    mockSupabase.from.mockReturnValue(mockChain(null))

    const store = useClientsStore()
    const { error } = await store.remove(1)

    expect(error).toBeNull()
  })

  it('createAccount inserts and returns the new account', async () => {
    const newAcct = { id: 5, account_number: 'ACC-100' }
    mockSupabase.from.mockReturnValue(mockChain(newAcct))

    const store = useClientsStore()
    const { data, error } = await store.createAccount(1, 'ACC-100')

    expect(error).toBeNull()
    expect(data).toEqual(newAcct)
  })

  it('getAccounts returns accounts for a client', async () => {
    const accounts = [{ id: 1, account_number: 'ACC-001' }, { id: 2, account_number: 'ACC-002' }]
    mockSupabase.from.mockReturnValue(mockChain(accounts))

    const store = useClientsStore()
    const { data } = await store.getAccounts(1)

    expect(data).toEqual(accounts)
  })

  it('removeAccount deletes an account', async () => {
    mockSupabase.from.mockReturnValue(mockChain(null))

    const store = useClientsStore()
    const { error } = await store.removeAccount(5)

    expect(error).toBeNull()
  })
})
