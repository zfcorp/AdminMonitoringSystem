<script setup>
import { useRoute } from 'vue-router'

const route = useRoute()

const navItems = [
  { label: 'Dashboard',            to: '/',                     icon: 'pi pi-home' },
  { label: 'Borrowed',             to: '/borrowed-records',     icon: 'pi pi-inbox' },
  { label: 'Transmittal',          to: '/transmittal-records',  icon: 'pi pi-send' },
  { label: 'Follow-up Monitoring', to: '/follow-ups',           icon: 'pi pi-bell' },
  { label: 'Reports',              to: '/reports',              icon: 'pi pi-chart-bar' },
  { label: 'Excel Import',         to: '/import',               icon: 'pi pi-upload' },
  { label: 'Import History',       to: '/import/history',       icon: 'pi pi-history' },
  { label: 'Settings',             to: '/settings',             icon: 'pi pi-cog' },
]

function isActive(to) {
  if (to === '/') return route.path === '/'
  return route.path.startsWith(to)
}
</script>

<template>
  <aside class="app-sidebar">
    <div class="app-sidebar__title">Zurich Finance</div>
    <div class="app-sidebar__subtitle">Admin Monitoring System</div>
    <ul class="app-sidebar__nav">
      <li v-for="item in navItems" :key="item.to">
        <RouterLink
          :to="item.to"
          :class="['app-sidebar__link', { 'app-sidebar__link--active': isActive(item.to) }]"
        >
          <i :class="[item.icon, 'nav-icon']" />
          {{ item.label }}
        </RouterLink>
      </li>
    </ul>
  </aside>
</template>

<style scoped>
.nav-icon {
  font-size: 0.85rem;
  width: 16px;
  margin-right: 0.5rem;
  flex-shrink: 0;
}
</style>
