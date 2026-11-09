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
const mode = ref('login') // 'login' | 'forgot'
const resetSent = ref(false)
const showPassword = ref(false)

async function handleLogin() {
  if (!email.value || !password.value) {
    toast.add({ severity: 'warn', summary: 'Missing Information', detail: 'Please enter both email and password.', life: 3000 })
    return
  }
  loading.value = true
  const { error } = await authStore.signIn(email.value, password.value)
  loading.value = false
  if (error) {
    toast.add({ severity: 'error', summary: 'Login Failed', detail: error.message || 'Invalid email or password.', life: 5000 })
    return
  }
  const redirect = route.query.redirect
  router.push(redirect || '/')
}

async function handleResetPassword() {
  if (!email.value) {
    toast.add({ severity: 'warn', summary: 'Required', detail: 'Please enter your email address.', life: 3000 })
    return
  }
  loading.value = true
  const { error } = await authStore.resetPassword(email.value)
  loading.value = false
  if (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 5000 })
    return
  }
  resetSent.value = true
}

function switchMode(m) {
  mode.value = m
  resetSent.value = false
  password.value = ''
}
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <h1>Zurich Finance Corp.</h1>
      <p>Admin Monitoring &amp; Transmittal System</p>

      <!-- Login form -->
      <form v-if="mode === 'login'" class="login-form" @submit.prevent="handleLogin">
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
        <button type="button" class="forgot-link" @click="switchMode('forgot')">
          Forgot password?
        </button>
      </form>

      <!-- Forgot password form -->
      <div v-else class="login-form">
        <div v-if="!resetSent">
          <p class="reset-hint">Enter your email and we'll send you a reset link.</p>
          <label>
            Email
            <input v-model="email" type="email" placeholder="admin@zurichfinance.com" autocomplete="email" :disabled="loading" />
          </label>
          <button type="button" class="login-btn" :disabled="loading" @click="handleResetPassword">
            {{ loading ? 'Sending…' : 'Send Reset Link' }}
          </button>
        </div>
        <div v-else class="reset-success">
          <i class="pi pi-check-circle" style="font-size:2rem; color:#10b981"></i>
          <p>Reset link sent! Check your email inbox.</p>
        </div>
        <button type="button" class="forgot-link" @click="switchMode('login')">
          ← Back to Sign In
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.reset-hint {
  font-size: 0.85rem;
  color: #64748b;
  margin-bottom: 1rem;
}
.reset-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1.5rem 0;
  text-align: center;
  color: #065f46;
  font-size: 0.9rem;
}
.forgot-link {
  background: none;
  border: none;
  color: #3b82f6;
  font-size: 0.82rem;
  cursor: pointer;
  padding: 0.5rem 0 0;
  text-align: center;
  width: 100%;
  transition: color 0.15s;
}
.forgot-link:hover { color: #2563eb; text-decoration: underline; }

.password-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.password-wrap input { padding-right: 2.5rem; width: 100%; }
.pw-toggle {
  position: absolute;
  right: 0.6rem;
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0;
  display: flex;
  align-items: center;
}
.pw-toggle:hover { color: #475569; }
</style>
