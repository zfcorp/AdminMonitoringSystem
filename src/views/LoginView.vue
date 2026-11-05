<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const loading = ref(false)

async function handleLogin() {
  if (!email.value || !password.value) {
    toast.add({
      severity: 'warn',
      summary: 'Missing Information',
      detail: 'Please enter both email and password.',
      life: 3000,
    })
    return
  }

  loading.value = true
  const { error } = await authStore.signIn(email.value, password.value)
  loading.value = false

  if (error) {
    toast.add({
      severity: 'error',
      summary: 'Login Failed',
      detail: error.message || 'Invalid email or password.',
      life: 5000,
    })
    return
  }

  // Redirect to originally requested route or dashboard
  const redirect = route.query.redirect
  router.push(redirect || '/')
}
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <h1>Zurich Finance Corp.</h1>
      <p>Admin Monitoring &amp; Transmittal System</p>
      <form class="login-form" @submit.prevent="handleLogin">
        <label>
          Email
          <input
            v-model="email"
            type="email"
            placeholder="admin@zurichfinance.com"
            autocomplete="email"
            :disabled="loading"
          />
        </label>
        <label>
          Password
          <input
            v-model="password"
            type="password"
            placeholder="••••••••"
            autocomplete="current-password"
            :disabled="loading"
          />
        </label>
        <button type="submit" class="login-btn" :disabled="loading">
          {{ loading ? 'Signing in…' : 'Sign In' }}
        </button>
      </form>
    </div>
  </div>
</template>
