import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import AppSidebar from '../src/components/layout/AppSidebar.vue'

const expectedNavLabels = [
  'Dashboard',
  'Transmittal Monitoring',
  'Borrowed Documents & Items',
  'Follow-up Monitoring',
  'Clients',
  'Excel Import',
  'Import History',
  'Branches',
]

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/transmittals', component: { template: '<div />' } },
      { path: '/borrowed', component: { template: '<div />' } },
      { path: '/follow-ups', component: { template: '<div />' } },
      { path: '/clients', component: { template: '<div />' } },
      { path: '/import', component: { template: '<div />' } },
      { path: '/import/history', component: { template: '<div />' } },
      { path: '/branches', component: { template: '<div />' } },
    ],
  })
}

describe('AppSidebar', () => {
  it('renders all navigation links', () => {
    const router = createTestRouter()
    const wrapper = mount(AppSidebar, { global: { plugins: [router] } })

    const links = wrapper.findAll('.app-sidebar__link')
    expect(links).toHaveLength(expectedNavLabels.length)

    const labels = links.map((l) => l.text())
    expectedNavLabels.forEach((label) => {
      expect(labels).toContain(label)
    })
  })

  it('renders the system title', () => {
    const router = createTestRouter()
    const wrapper = mount(AppSidebar, { global: { plugins: [router] } })

    expect(wrapper.find('.app-sidebar__title').text()).toContain('Zurich Finance')
  })
})
