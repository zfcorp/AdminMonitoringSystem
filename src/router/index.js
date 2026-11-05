import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import AppLayout from '../components/layout/AppLayout.vue'

import LoginView from '../views/LoginView.vue'
import DashboardView from '../views/DashboardView.vue'
import RecordsBorrowedView from '../views/RecordsBorrowedView.vue'
import RecordsTransmittalView from '../views/RecordsTransmittalView.vue'
import RecordFormView from '../views/RecordFormView.vue'
import RecordDetailView from '../views/RecordDetailView.vue'
import SettingsView from '../views/SettingsView.vue'
import FollowUpListView from '../views/FollowUpListView.vue'
import FollowUpFormView from '../views/FollowUpFormView.vue'
import ClientListView from '../views/ClientListView.vue'
import ClientDetailView from '../views/ClientDetailView.vue'
import ImportView from '../views/ImportView.vue'
import ReportsView from '../views/ReportsView.vue'
import ImportHistoryView from '../views/ImportHistoryView.vue'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: { title: 'Login', public: true },
  },
  {
    path: '/',
    component: AppLayout,
    children: [
      {
        path: '',
        name: 'dashboard',
        component: DashboardView,
        meta: { title: 'Dashboard' },
      },
      {
        path: 'borrowed-records',
        name: 'borrowed-records',
        component: RecordsBorrowedView,
        meta: { title: 'Borrowed' },
      },
      {
        path: 'borrowed-records/new',
        name: 'record-new',
        component: RecordFormView,
        meta: { title: 'New Borrowed Record' },
      },
      {
        path: 'transmittal-records/new',
        name: 'transmittal-new',
        component: RecordFormView,
        meta: { title: 'New Transmittal Record' },
      },
      {
        path: 'borrowed-records/:id',
        name: 'record-detail',
        component: RecordDetailView,
        meta: { title: 'Record Details' },
      },
      {
        path: 'borrowed-records/:id/edit',
        name: 'record-edit',
        component: RecordFormView,
        meta: { title: 'Edit Record' },
      },
      {
        path: 'transmittal-records',
        name: 'transmittal-records',
        component: RecordsTransmittalView,
        meta: { title: 'Transmittal' },
      },
      {
        path: 'follow-ups',
        name: 'follow-ups',
        component: FollowUpListView,
        meta: { title: 'Follow-up Monitoring' },
      },
      {
        path: 'follow-ups/new',
        name: 'followup-new',
        component: FollowUpFormView,
        meta: { title: 'New Follow-up' },
      },
      {
        path: 'follow-ups/:id/edit',
        name: 'followup-edit',
        component: FollowUpFormView,
        meta: { title: 'Edit Follow-up' },
      },
      {
        path: 'clients',
        name: 'clients',
        component: ClientListView,
        meta: { title: 'Clients' },
      },
      {
        path: 'clients/:id',
        name: 'client-detail',
        component: ClientDetailView,
        meta: { title: 'Client Detail' },
      },
      {
        path: 'reports',
        name: 'reports',
        component: ReportsView,
        meta: { title: 'Reports' },
      },
      {
        path: 'import',
        name: 'import',
        component: ImportView,
        meta: { title: 'Excel Import' },
      },
      {
        path: 'import/history',
        name: 'import-history',
        component: ImportHistoryView,
        meta: { title: 'Import History' },
      },
      {
        path: 'settings',
        name: 'settings',
        component: SettingsView,
        meta: { title: 'Settings' },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const authStore = useAuthStore()
  const isPublic = to.meta?.public === true
  const isAuthenticated = !!authStore.user
  if (!isAuthenticated && !isPublic) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (isAuthenticated && to.name === 'login') {
    return { name: 'dashboard' }
  }
  return true
})

export default router
