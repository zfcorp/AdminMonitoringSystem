import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'

export const useClientsStore = defineStore('clients', () => {
  const clients = ref([])
  const loading = ref(false)

  /**
   * Fetch all clients with their accounts nested.
   * @param {string} [search] - optional name filter (case-insensitive)
   */
  async function fetch(search = '') {
    loading.value = true
    let query = supabase
      .from('clients')
      .select('*, client_accounts(*)')
      .order('name')

    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    const { data, error } = await query
    if (!error) {
      clients.value = data
    }
    loading.value = false
    return { data, error }
  }

  /**
   * Lightweight search for autocomplete suggestions.
   * Returns id + name only, limited to 10 results.
   * @param {string} query
   */
  async function search(query) {
    const { data, error } = await supabase
      .from('clients')
      .select('id, name')
      .ilike('name', `%${query}%`)
      .order('name')
      .limit(10)

    return { data, error }
  }

  /**
   * Get a single client by ID.
   * @param {number} id
   */
  async function getById(id) {
    const { data, error } = await supabase
      .from('clients')
      .select('id, name')
      .eq('id', id)
      .single()

    return { data, error }
  }

  /**
   * Create a new client.
   * @param {string} name
   */
  async function create(name) {
    const { data, error } = await supabase
      .from('clients')
      .insert({ name })
      .select('id, name')
      .single()

    return { data, error }
  }

  /**
   * Update a client's name.
   * @param {number} id
   * @param {string} name
   */
  async function update(id, name) {
    const { data, error } = await supabase
      .from('clients')
      .update({ name })
      .eq('id', id)
      .select('id, name')
      .single()

    return { data, error }
  }

  /**
   * Delete a client (cascades to client_accounts via FK).
   * @param {number} id
   */
  async function remove(id) {
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id)

    return { error }
  }

  /**
   * Get all accounts for a client.
   * @param {number} clientId
   */
  async function getAccounts(clientId) {
    const { data, error } = await supabase
      .from('client_accounts')
      .select('id, account_number')
      .eq('client_id', clientId)
      .order('account_number')

    return { data, error }
  }

  /**
   * Create a new account for a client.
   * @param {number} clientId
   * @param {string} accountNumber
   */
  async function createAccount(clientId, accountNumber) {
    const { data, error } = await supabase
      .from('client_accounts')
      .insert({ client_id: clientId, account_number: accountNumber })
      .select('id, account_number')
      .single()

    return { data, error }
  }

  /**
   * Delete an account.
   * @param {number} accountId
   */
  async function removeAccount(accountId) {
    const { error } = await supabase
      .from('client_accounts')
      .delete()
      .eq('id', accountId)

    return { error }
  }

  return {
    clients,
    loading,
    fetch,
    search,
    getById,
    create,
    update,
    remove,
    getAccounts,
    createAccount,
    removeAccount,
  }
})
