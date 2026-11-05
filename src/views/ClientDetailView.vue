<script setup>
import { onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Timeline from 'primevue/timeline'
import Button from 'primevue/button'
import { useClientTimeline } from '../composables/useClientTimeline'
import { format, parseISO } from 'date-fns'

const route = useRoute()
const router = useRouter()
const { timeline, loading, client, accounts, load } = useClientTimeline()

const clientId = computed(() => Number(route.params.id))

onMounted(() => {
  if (clientId.value) {
    load(clientId.value)
  }
})

function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy')
  } catch {
    return dateStr
  }
}

function moduleClass(module) {
  return module.toLowerCase().replace('-', '')
}

function goToRecord(event) {
  if (event.recordType === 'transmittal') {
    router.push({ name: 'transmittal-edit', params: { id: event.recordId } })
  } else if (event.recordType === 'borrowed') {
    router.push({ name: 'borrowed-edit', params: { id: event.recordId } })
  } else if (event.recordType === 'followup') {
    router.push({ name: 'followup-edit', params: { id: event.recordId } })
  }
}
</script>

<template>
  <div>
    <Button label="Back to Clients" icon="pi pi-arrow-left" text @click="router.push({ name: 'clients' })" />

    <div v-if="loading" class="loading">Loading…</div>

    <div v-else-if="client">
      <div class="client-header">
        <h1>{{ client.name }}</h1>
        <div class="account-chips">
          <span v-for="acct in accounts" :key="acct.id" class="account-chip">
            {{ acct.account_number }}
          </span>
          <span v-if="!accounts.length" class="no-accounts">No account IDs</span>
        </div>
      </div>

      <h2 class="timeline-title">Activity Timeline</h2>

      <div v-if="!timeline.length" class="empty-timeline">
        No activity records found for this client.
      </div>

      <Timeline v-else :value="timeline" layout="vertical">
        <template #opposite="slotProps">
          <div class="timeline-date">
            {{ formatDate(slotProps.item.date) }}
          </div>
        </template>
        <template #content="slotProps">
          <div class="timeline-event" @click="goToRecord(slotProps.item)">
            <span class="module-badge" :class="moduleClass(slotProps.item.module)">
              {{ slotProps.item.module }}
            </span>
            <div class="event-ref">{{ slotProps.item.ref }}</div>
            <div class="event-desc">{{ slotProps.item.description }}</div>
            <div class="event-meta">
              <span v-if="slotProps.item.accountId" class="event-account">
                Account: {{ slotProps.item.accountId }}
              </span>
              <span v-if="slotProps.item.status" class="event-status">{{ slotProps.item.status }}</span>
            </div>
          </div>
        </template>
      </Timeline>
    </div>

    <div v-else class="loading">Client not found.</div>
  </div>
</template>

<style scoped>
.loading {
  padding: 2rem;
  text-align: center;
  color: #94a3b8;
}

.client-header {
  margin: 1rem 0;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e2e8f0;
}

.client-header h1 {
  font-size: 1.75rem;
  color: #1e293b;
  margin-bottom: 0.5rem;
}

.account-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.account-chip {
  padding: 0.25rem 0.75rem;
  background: #e0f2fe;
  color: #0369a1;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 500;
}

.no-accounts {
  color: #94a3b8;
  font-size: 0.85rem;
  font-style: italic;
}

.timeline-title {
  font-size: 1.25rem;
  color: #334155;
  margin: 1.5rem 0 1rem;
}

.empty-timeline {
  color: #94a3b8;
  padding: 2rem 0;
}

.timeline-date {
  font-size: 0.8rem;
  color: #64748b;
  font-weight: 500;
}

.timeline-event {
  cursor: pointer;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  transition: background 0.15s;
}

.timeline-event:hover {
  background: #f1f5f9;
}

.module-badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.module-badge.transmittal {
  background: #dbeafe;
  color: #1e40af;
}

.module-badge.borrowed {
  background: #fce7f3;
  color: #9d174d;
}

.module-badge.followup {
  background: #fef3c7;
  color: #92400e;
}

.event-ref {
  font-size: 0.85rem;
  font-weight: 600;
  color: #334155;
}

.event-desc {
  font-size: 0.85rem;
  color: #64748b;
  margin: 0.2rem 0;
}

.event-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.75rem;
}

.event-account {
  color: #94a3b8;
}

.event-status {
  color: #475569;
  font-weight: 500;
}
</style>
