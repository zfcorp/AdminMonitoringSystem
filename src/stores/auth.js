import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const user    = ref(null)
  const role    = ref('user')   // 'admin' | 'user'
  const loading = ref(true)

  /**
   * Load the profile row for a given user id and set role.
   */
  async function loadProfile(userId) {
    if (!userId) { role.value = 'user'; return }
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()
    role.value = data?.role ?? 'user'
  }

  /**
   * Initialise the store: fetch existing session, load profile,
   * subscribe to auth state changes.
   */
  async function init() {
    const { data } = await supabase.auth.getSession()
    user.value = data.session?.user ?? null
    await loadProfile(user.value?.id)
    loading.value = false

    supabase.auth.onAuthStateChange(async (_event, session) => {
      user.value = session?.user ?? null
      await loadProfile(user.value?.id)
    })
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) {
      user.value = data.user
      await loadProfile(data.user?.id)
    }
    return { error }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (!error) {
      user.value = null
      role.value = 'user'
    }
    return { error }
  }

  async function resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error }
  }

  const isAdmin = () => role.value === 'admin'

  return { user, role, loading, init, signIn, signOut, resetPassword, isAdmin }
})
