<script setup>
import { useRoute } from 'vue-router'

const route = useRoute()

const navItems = [
  { label: 'Dashboard',            to: '/',                      icon: 'pi pi-home' },
  { label: 'Borrowed',             to: '/borrowed-records',      icon: 'pi pi-inbox' },
  { label: 'Transmittal',          to: '/transmittal-records',   icon: 'pi pi-send' },
  { label: 'Follow-up Monitoring', to: '/follow-ups',            icon: 'pi pi-bell' },
  { label: 'Reports',              to: '/reports',               icon: 'pi pi-chart-bar' },
]

const archiveItems = [
  { label: 'Borrowed Archive',     to: '/archive/borrowed',      icon: 'pi pi-inbox' },
  { label: 'Transmittal Archive',  to: '/archive/transmittal',   icon: 'pi pi-send' },
]

const bottomItems = [
  { label: 'Excel Import',         to: '/import',                icon: 'pi pi-upload' },
  { label: 'Import History',       to: '/import/history',        icon: 'pi pi-history' },
  { label: 'Settings',             to: '/settings',              icon: 'pi pi-cog' },
]

function isActive(to) {
  if (to === '/') return route.path === '/'
  return route.path.startsWith(to)
}
</script>

<template>
  <aside class="app-sidebar">
    <div class="app-sidebar__title">Zurich Finance Corporation</div>
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

    <!-- Archive section -->
    <div class="app-sidebar__section-label">
      <i class="pi pi-box section-icon" /> Archive
    </div>
    <ul class="app-sidebar__nav">
      <li v-for="item in archiveItems" :key="item.to">
        <RouterLink
          :to="item.to"
          :class="['app-sidebar__link app-sidebar__link--sub', { 'app-sidebar__link--active': isActive(item.to) }]"
        >
          <i :class="[item.icon, 'nav-icon']" />
          {{ item.label }}
        </RouterLink>
      </li>
    </ul>

    <!-- Bottom items -->
    <ul class="app-sidebar__nav app-sidebar__nav--bottom">
      <li v-for="item in bottomItems" :key="item.to">
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

/* Archive section label */
.app-sidebar__section-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.75rem 1.25rem 0.25rem;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #7c3aed;
  border-top: 1px solid #293548;
  margin-top: 0.5rem;
}
.section-icon { font-size: 0.75rem; }

/* Indented sub-links for archive items */
.app-sidebar__link--sub {
  padding-left: 1.75rem;
}

/* Bottom section */
.app-sidebar__nav--bottom {
  border-top: 1px solid #293548;
  padding-top: 0.25rem;
  margin-top: 0.5rem;
}
</style>
