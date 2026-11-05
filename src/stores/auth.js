import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'

/**
 * Authentication store.
 *
 * Manages the current Supabase user session. Full sign-in / sign-out /
 * route-guard wiring is implemented in Task 2. For now this store
 * provides the reactive `user` ref and hooks into Supabase auth state
 * changes so that downstream stores and components can read it.
 */
export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const loading = ref(true)

  /**
   * Initialise the store by fetching the existing session and
   * subscribing to auth state changes.
   */
  async function init() {
    const { data } = await supabase.auth.getSession()
    user.value = data.session?.user ?? null
    loading.value = false

    supabase.auth.onAuthStateChange((_event, session) => {
      user.value = session?.user ?? null
    })
  }

  /**
   * Sign in with email + password.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{ error: Error | null }>}
   */
  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (!error) {
      user.value = data.user
    }
    return { error }
  }

  /**
   * Sign out the current user.
   * @returns {Promise<{ error: Error | null }>}
   */
  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (!error) {
      user.value = null
    }
    return { error }
  }

  return { user, loading, init, signIn, signOut }
})
