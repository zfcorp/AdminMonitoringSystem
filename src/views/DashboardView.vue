<script setup>
import { onMounted, computed } from 'vue'
import Button from 'primevue/button'
import { useDashboardStore } from '../stores/dashboard'
import { format } from 'date-fns'

const dashboardStore = useDashboardStore()

onMounted(() => {
  dashboardStore.fetch()
})

const refreshedText = computed(() => {
  if (!dashboardStore.lastRefreshed) return ''
  return format(dashboardStore.lastRefreshed, 'MMM d, yyyy h:mm a')
})

const metricCards = computed(() => [
  {
    label: 'Total Transmittals',
    value: dashboardStore.metrics.totalTransmittals,
    icon: 'pi pi-file',
    color: 'blue',
  },
  {
    label: 'Currently Borrowed',
    value: dashboardStore.metrics.currentlyBorrowed,
    icon: 'pi pi-clock',
    color: 'amber',
  },
  {
    label: 'Returned Items',
    value: dashboardStore.metrics.returnedItems,
    icon: 'pi pi-check-circle',
    color: 'green',
  },
  {
    label: 'Pending Follow-ups',
    value: dashboardStore.metrics.pendingFollowUps,
    icon: 'pi pi-exclamation-triangle',
    color: 'orange',
  },
  {
    label: 'Resolved Follow-ups',
    value: dashboardStore.metrics.resolvedFollowUps,
    icon: 'pi pi-check',
    color: 'teal',
  },
])
</script>

<template>
  <div>
    <div class="page-header">
      <div class="header-right">
        <span v-if="refreshedText" class="refreshed">Last refreshed: {{ refreshedText }}</span>
        <Button
          label="Refresh"
          icon="pi pi-refresh"
          text
          :loading="dashboardStore.loading"
          @click="dashboardStore.fetch()"
        />
      </div>
    </div>

    <div class="metrics-grid">
      <div
        v-for="card in metricCards"
        :key="card.label"
        class="metric-card"
        :class="`metric-card--${card.color}`"
      >
        <div class="metric-card__icon">
          <i :class="card.icon"></i>
        </div>
        <div class="metric-card__body">
          <div class="metric-card__value">{{ card.value }}</div>
          <div class="metric-card__label">{{ card.label }}</div>
        </div>
      </div>
    </div>

    <div class="dashboard-note">
      Dashboard metrics are based on actual system records and update on refresh.
    </div>
  </div>
</template>

<style scoped>
.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.refreshed {
  font-size: 0.8rem;
  color: #94a3b8;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
}

.metric-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  transition: box-shadow 0.15s;
}

.metric-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}

.metric-card__icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}

.metric-card--blue .metric-card__icon   { background: #dbeafe; color: #1e40af; }
.metric-card--amber .metric-card__icon  { background: #fef3c7; color: #92400e; }
.metric-card--green .metric-card__icon  { background: #d1fae5; color: #065f46; }
.metric-card--orange .metric-card__icon { background: #ffedd5; color: #9a3412; }
.metric-card--teal .metric-card__icon   { background: #ccfbf1; color: #115e59; }

.metric-card__value {
  font-size: 2rem;
  font-weight: 700;
  color: #1e293b;
  line-height: 1;
}

.metric-card__label {
  font-size: 0.8rem;
  color: #64748b;
  margin-top: 0.25rem;
}

.dashboard-note {
  margin-top: 1.5rem;
  font-size: 0.8rem;
  color: #94a3b8;
  text-align: center;
}
</style>
