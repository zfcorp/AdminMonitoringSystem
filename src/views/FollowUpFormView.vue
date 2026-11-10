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
import { supabase } from '../lib/supabase'
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
  { label: 'Record (Borrowed/Transmittal)', value: 'record' },
]

const form = ref({
  parentType:     null,
  record_id:      null,
  follow_up_date: null,
  subject:        '',
  details:        '',
  status:         '',
  resolved_date:  null,
  remarks:        '',
})

const selectedParent    = ref(null)
const parentSuggestions = ref([])
const saving            = ref(false)

function deriveParentType(data) {
  if (data.records?.module === 'transmittal') return 'transmittal'
  if (data.records?.module === 'borrowed')    return 'borrowed'
  return 'record'
}

onMounted(async () => {
  if (editingId.value) {
    const { data, error } = await followUpsStore.getById(editingId.value)
    if (error || !data) {
      toast.add({ severity: 'error', summary: 'Not Found', detail: 'Follow-up not found.', life: 5000 })
      router.push({ name: 'follow-ups' })
      return
    }

    const parentType = deriveParentType(data)

    form.value = {
      parentType:     parentType,
      record_id:      data.record_id        || null,
      follow_up_date: data.follow_up_date   ? parseISO(data.follow_up_date)  : null,
      subject:        data.subject          || '',
      details:        data.details          || '',
      status:         data.status           || '',
      resolved_date:  data.resolved_date    ? parseISO(data.resolved_date)   : null,
      remarks:        data.remarks          || '',
    }

    // Pre-fill the autocomplete display value
    if (data.records) {
      selectedParent.value = { id: data.record_id, reference_number: data.records.reference_number }
    }
  } else {
    // Pre-select from query params
    const pType = route.query.parentType
    const pId   = route.query.parentId
    const pRef  = route.query.parentRef

    if (pType && pId) {
      form.value.parentType  = pType
      form.value.record_id   = Number(pId)
      if (pRef) selectedParent.value = { id: Number(pId), reference_number: pRef }
    }
  }
})

// ── Autocomplete search ───────────────────────────────────────
async function onParentSearch(event) {
  if (!form.value.parentType) return
  const query = event.query?.trim()
  if (!query) { parentSuggestions.value = []; return }

  if (form.value.parentType === 'record') {
    // Search the records table by reference_number or client name
    const { data: matchingClients } = await supabase
      .from('clients').select('id').ilike('name', `%${query}%`).limit(10)
    const clientIds = (matchingClients || []).map((c) => c.id)

    let q = supabase
      .from('records')
      .select('id, reference_number, module, clients(name)')
      .eq('is_archived', false)
      .order('reference_number')
      .limit(10)

    if (clientIds.length) {
      q = q.or(`reference_number.ilike.%${query}%,client_id.in.(${clientIds.join(',')})`)
    } else {
      q = q.ilike('reference_number', `%${query}%`)
    }

    const { data } = await q
    parentSuggestions.value = (data || []).map((r) => ({
      ...r,
      // Show reference + client name in the autocomplete
      reference_number: `${r.reference_number} — ${r.clients?.name ?? ''}`,
    }))
  } else {
    const { data } = await followUpsStore.searchParents(form.value.parentType || 'transmittal', query)
    parentSuggestions.value = (data || []).map((r) => ({
      ...r,
      reference_number: `${r.reference_number} — ${r.clients?.name ?? ''}`,
    }))
  }
}

// ── Sync selected parent to form FK ──────────────────────────
watch(selectedParent, (val) => {
  if (!val || typeof val !== 'object' || !val.id) return
  form.value.record_id = val.id
})

// ── Save ─────────────────────────────────────────────────────
async function save() {
  if (!form.value.record_id) {
    toast.add({ severity: 'warn', summary: 'Required', detail: 'Select a parent record.', life: 3000 })
    return
  }

  saving.value = true

  const payload = {
    record_id:      form.value.record_id,
    follow_up_date: form.value.follow_up_date  ? format(form.value.follow_up_date,  'yyyy-MM-dd') : null,
    subject:        form.value.subject   || null,
    details:        form.value.details   || null,
    status:         form.value.status    || null,
    resolved_date:  form.value.resolved_date ? format(form.value.resolved_date, 'yyyy-MM-dd') : null,
    remarks:        form.value.remarks   || null,
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
            :disabled="!form.parentType || isEditing"
            placeholder="Type reference number or client name…"
            empty-search-message=" "
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
