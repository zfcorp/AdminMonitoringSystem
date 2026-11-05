<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Calendar from 'primevue/calendar'
import Dropdown from 'primevue/dropdown'
import AutoComplete from 'primevue/autocomplete'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { useFollowUpsStore } from '../stores/followUps'
import { format, parseISO } from 'date-fns'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const followUpsStore = useFollowUpsStore()

const editingId = computed(() => (route.params.id ? Number(route.params.id) : null))
const isEditing = computed(() => !!editingId.value)

const parentTypeOptions = [
  { label: 'Transmittal', value: 'transmittal' },
  { label: 'Borrowed Item', value: 'borrowed' },
]

const form = ref({
  parentType: null,
  transmittal_id: null,
  borrowed_item_id: null,
  follow_up_date: null,
  subject: '',
  details: '',
  status: '',
  resolved_date: null,
  remarks: '',
})

const selectedParent = ref(null)
const parentSuggestions = ref([])
const saving = ref(false)

onMounted(async () => {
  if (editingId.value) {
    const { data, error } = await followUpsStore.getById(editingId.value)
    if (error || !data) {
      toast.add({ severity: 'error', summary: 'Not Found', detail: 'Follow-up not found.', life: 5000 })
      router.push({ name: 'follow-ups' })
      return
    }

    form.value = {
      parentType: data.transmittal_id ? 'transmittal' : 'borrowed',
      transmittal_id: data.transmittal_id,
      borrowed_item_id: data.borrowed_item_id,
      follow_up_date: data.follow_up_date ? parseISO(data.follow_up_date) : null,
      subject: data.subject || '',
      details: data.details || '',
      status: data.status || '',
      resolved_date: data.resolved_date ? parseISO(data.resolved_date) : null,
      remarks: data.remarks || '',
    }

    // Set selected parent for display
    if (data.transmittals) {
      selectedParent.value = data.transmittals
    } else if (data.borrowed_items) {
      selectedParent.value = data.borrowed_items
    }
  } else {
    // Check for query params (pre-selected parent from another view)
    const pType = route.query.parentType
    const pId = route.query.parentId
    const pRef = route.query.parentRef

    if (pType && pId) {
      form.value.parentType = pType
      if (pType === 'transmittal') {
        form.value.transmittal_id = Number(pId)
      } else {
        form.value.borrowed_item_id = Number(pId)
      }
      if (pRef) {
        selectedParent.value = { id: Number(pId), reference_number: pRef }
      }
    }
  }
})

async function onParentSearch(event) {
  if (!form.value.parentType) return
  const { data } = await followUpsStore.searchParents(form.value.parentType, event.query)
  parentSuggestions.value = data || []
}

watch(selectedParent, (val) => {
  if (val && typeof val === 'object' && val?.id) {
    if (form.value.parentType === 'transmittal') {
      form.value.transmittal_id = val.id
      form.value.borrowed_item_id = null
    } else {
      form.value.borrowed_item_id = val.id
      form.value.transmittal_id = null
    }
  }
})

async function save() {
  if (!form.value.parentType) {
    toast.add({ severity: 'warn', summary: 'Required', detail: 'Select a parent record type.', life: 3000 })
    return
  }
  if (!form.value.transmittal_id && !form.value.borrowed_item_id) {
    toast.add({ severity: 'warn', summary: 'Required', detail: 'Select a parent record.', life: 3000 })
    return
  }

  saving.value = true

  const payload = {
    transmittal_id: form.value.parentType === 'transmittal' ? form.value.transmittal_id : null,
    borrowed_item_id: form.value.parentType === 'borrowed' ? form.value.borrowed_item_id : null,
    follow_up_date: form.value.follow_up_date ? format(form.value.follow_up_date, 'yyyy-MM-dd') : null,
    subject: form.value.subject || null,
    details: form.value.details || null,
    status: form.value.status || null,
    resolved_date: form.value.resolved_date ? format(form.value.resolved_date, 'yyyy-MM-dd') : null,
    remarks: form.value.remarks || null,
  }

  const { data, error } = isEditing.value
    ? await followUpsStore.update(editingId.value, payload)
    : await followUpsStore.create(payload)

  saving.value = false

  if (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: error.message, life: 5000 })
    return
  }

  toast.add({
    severity: 'success',
    summary: isEditing.value ? 'Updated' : 'Created',
    detail: `Follow-up ${data?.reference_number || ''} ${isEditing.value ? 'updated' : 'created'} successfully.`,
    life: 3000,
  })
  router.push({ name: 'follow-ups' })
}

function cancel() {
  router.push({ name: 'follow-ups' })
}
</script>

<template>
  <div>
    <div class="page-header">
      <h1>{{ isEditing ? 'Edit Follow-up' : 'New Follow-up' }}</h1>
    </div>

    <div class="form-card">
      <div class="form-row form-row--two">
        <label>
          Parent Record Type <span class="req">*</span>
          <Dropdown
            v-model="form.parentType"
            :options="parentTypeOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Select type…"
            :disabled="isEditing"
          />
        </label>
        <label>
          Parent Record <span class="req">*</span>
          <AutoComplete
            v-model="selectedParent"
            :suggestions="parentSuggestions"
            :force-selection="false"
            optionLabel="reference_number"
            :disabled="!form.parentType"
            placeholder="Type reference number to search…"
            @complete="onParentSearch"
          />
        </label>
      </div>

      <div class="form-row">
        <label>
          Follow-up Date
          <Calendar v-model="form.follow_up_date" dateFormat="yy-mm-dd" showIcon placeholder="Select date" />
        </label>
      </div>

      <div class="form-row">
        <label>
          Subject / Concern
          <InputText v-model="form.subject" placeholder="e.g., Pending ORCR, Duplicate key pending" />
        </label>
      </div>

      <div class="form-row">
        <label>
          Details
          <Textarea v-model="form.details" rows="3" placeholder="What was done, outcome reported by branch personnel…" />
        </label>
      </div>

      <div class="form-row form-row--two">
        <label>
          Status
          <InputText v-model="form.status" placeholder="e.g., Open, Pending, Resolved" />
        </label>
        <label>
          Resolved Date
          <Calendar v-model="form.resolved_date" dateFormat="yy-mm-dd" showIcon placeholder="Leave blank if not resolved" />
        </label>
      </div>

      <div class="form-row">
        <label>
          Remarks
          <Textarea v-model="form.remarks" rows="2" placeholder="Additional notes" />
        </label>
      </div>

      <div class="form-actions">
        <Button label="Cancel" text @click="cancel" />
        <Button
          :label="isEditing ? 'Update Follow-up' : 'Save Follow-up'"
          icon="pi pi-check"
          :loading="saving"
          @click="save"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.resolve-note {
  background: #fef3c7;
  color: #92400e;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
