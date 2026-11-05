// Global test setup for Vitest
// This file is referenced by vite.config.js → test.setupFiles

// Silence expected console warnings in tests (e.g. missing env vars)
const originalWarn = console.warn
console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('[Supabase]')) return
  originalWarn(...args)
}
