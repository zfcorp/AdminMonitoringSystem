<script setup>
import { ref, onMounted } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { useImportsStore } from '../stores/imports'
import { useToast } from 'primevue/usetoast'
import { format, parseISO } from 'date-fns'

const importsStore = useImportsStore()
const toast = useToast()

const showDetails = ref(false)
const showUndoDialog = ref(false)
const undoTargetId = ref(null)
const undoing = ref(false)

onMounted(() => {
  importsStore.fetchHistory()
})

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy h:mm a')
  } catch {
    return dateStr
  }
}

async function viewDetails(importId) {
  await importsStore.fetchImportDetails(importId)
  showDetails.value = true
}

async function openUndoDialog(importId) {
  undoTargetId.value = importId
  await importsStore.fetchImportDetails(importId)
  showUndoDialog.value = true
}

function getManuallyEditedCount() {
  return importsStore.importDetails?.records?.filter((r) => r.manually_edited).length || 0
}

async function confirmUndo() {
  undoing.value = true
  await importsStore.undoImport(undoTargetId.value)
  undoing.value = false
  showUndoDialog.value = false
  toast.add({
    severity: 'success',
    summary: 'Undone',
    detail: 'Import has been reversed. Created records deleted, updated records restored.',
    life: 5000,
  })
}
</script>

<template>
  <div>
    <div class="page-header">
      <h1>Import History</h1>
    </div>

    <DataTable :value="importsStore.importHistory" stripedRows>
      <Column field="filename" header="Filename" sortable />
      <Column field="imported_at" header="Date" sortable style="width: 160px">
        <template #body="slotProps">{{ formatDate(slotProps.data.imported_at) }}</template>
      </Column>
      <Column field="total_records" header="Total" sortable style="width: 70px" />
      <Column field="imported_count" header="Imported" sortable style="width: 80px" />
      <Column field="updated_count" header="Updated" sortable style="width: 80px" />
      <Column field="skipped_count" header="Skipped" sortable style="width: 80px" />
      <Column field="error_count" header="Errors" sortable style="width: 70px" />
      <Column header="Status" style="width: 100px">
        <template #body="slotProps">
          <span v-if="slotProps.data.undone" class="badge badge--undone">Undone</span>
          <span v-else class="badge badge--done">Completed</span>
        </template>
      </Column>
      <Column header="Actions" style="width: 180px">
        <template #body="slotProps">
          <Button
            label="Details"
            icon="pi pi-eye"
            severity="secondary"
            text
            size="small"
            @click="viewDetails(slotProps.data.id)"
          />
          <Button
            v-if="!slotProps.data.undone"
            label="Undo"
            icon="pi pi-undo"
            severity="warn"
            text
            size="small"
            @click="openUndoDialog(slotProps.data.id)"
          />
        </template>
      </Column>
    </DataTable>

    <!-- Details Dialog -->
    <Dialog v-model:visible="showDetails" header="Import Details" :modal="true" style="width: 700px">
      <div v-if="importsStore.importDetails">
        <h4>Affected Records ({{ importsStore.importDetails.records.length }})</h4>
        <DataTable :value="importsStore.importDetails.records" stripedRows size="small">
          <Column field="table_name" header="Table" />
          <Column field="record_id" header="Record ID" />
          <Column field="action" header="Action" />
          <Column header="Manually Edited After Import">
            <template #body="slotProps">
              <span v-if="slotProps.data.manually_edited" class="badge badge--warn">Yes — review before undo</span>
              <span v-else class="badge badge--ok">No</span>
            </template>
          </Column>
        </DataTable>

        <h4 v-if="importsStore.importDetails.errors.length" style="margin-top: 1rem">
          Error Rows ({{ importsStore.importDetails.errors.length }})
        </h4>
        <DataTable v-if="importsStore.importDetails.errors.length" :value="importsStore.importDetails.errors" stripedRows size="small">
          <Column field="worksheet_name" header="Worksheet" />
          <Column field="row_number" header="Row" />
          <Column field="client_name" header="Client" />
          <Column field="error_details" header="Error" />
        </DataTable>
      </div>
    </Dialog>

    <!-- Undo Review Dialog -->
    <Dialog v-model:visible="showUndoDialog" header="Undo Import — Safety Check" :modal="true" style="width: 700px">
      <div v-if="importsStore.importDetails">
        <div v-if="getManuallyEditedCount() > 0" class="undo-warning">
          <i class="pi pi-exclamation-triangle"></i>
          <strong>{{ getManuallyEditedCount() }} record(s) were manually edited after this import.</strong>
          Reversing will overwrite those newer changes. Review carefully before proceeding.
        </div>
        <div v-else class="undo-safe">
          No records were manually edited after this import. It is safe to undo.
        </div>

        <DataTable :value="importsStore.importDetails.records" stripedRows size="small" style="margin-top: 1rem">
          <Column field="table_name" header="Table" />
          <Column field="record_id" header="Record ID" />
          <Column field="action" header="Action" />
          <Column header="Edited After Import">
            <template #body="slotProps">
              <span v-if="slotProps.data.manually_edited" class="badge badge--warn">Yes</span>
              <span v-else>—</span>
            </template>
          </Column>
        </DataTable>

        <div class="undo-actions">
          <Button label="Cancel" text @click="showUndoDialog = false" />
          <Button
            :label="getManuallyEditedCount() > 0 ? 'Undo Anyway (Overwrite Newer Changes)' : 'Confirm Undo'"
            severity="danger"
            :loading="undoing"
            @click="confirmUndo"
          />
        </div>
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
.page-header {
  margin-bottom: 1rem;
}

.page-header h1 {
  font-size: 1.5rem;
  color: #1e293b;
}

.badge {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.badge--done {
  background: #d1fae5;
  color: #065f46;
}

.badge--undone {
  background: #f1f5f9;
  color: #64748b;
}

.badge--ok {
  background: #d1fae5;
  color: #065f46;
}

.badge--warn {
  background: #fef3c7;
  color: #92400e;
}

.undo-warning {
  background: #fef3c7;
  color: #92400e;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.undo-safe {
  background: #d1fae5;
  color: #065f46;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.85rem;
}

.undo-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}
</style>
