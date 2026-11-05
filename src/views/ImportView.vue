<script setup>
import { ref, computed } from 'vue'
import Button from 'primevue/button'
import Dropdown from 'primevue/dropdown'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import { useImportsStore } from '../stores/imports'
import { TRANSMITTAL_FIELDS, BORROWED_FIELDS } from '../utils/excel'
import { downloadTemplate, checkTemplateVersion } from '../utils/excel-templates'

const importsStore = useImportsStore()

const currentStep = ref(1)
const templateWarning = ref(null) // 1=Upload, 2=Select, 3=Map, 4=Preview, 5=Duplicates, 6=Summary

const moduleOptions = [
  { label: 'Transmittal Monitoring', value: 'transmittal' },
  { label: 'Borrowed Documents & Items', value: 'borrowed' },
]

function onFileSelect(event) {
  const file = event.target.files[0]
  if (file) {
    importsStore.loadFile(file).then(() => {
      // Check template version
      const firstConfig = Object.values(importsStore.sheetConfigs)[0]
      if (firstConfig) {
        const result = checkTemplateVersion(importsStore.sheets, firstConfig.targetModule)
        templateWarning.value =
          result.isOutdated || result.missingFields.length > 0 ? result : null
      }
      currentStep.value = 2
    })
  }
}

async function handleDownloadTemplate(module) {
  await downloadTemplate(module)
}

function getFields(module) {
  return module === 'transmittal' ? TRANSMITTAL_FIELDS : BORROWED_FIELDS
}

function getFieldOptions(module) {
  return getFields(module).map((f) => ({ label: f.label, value: f.key }))
}

function updateMapping(sheetName, colIndex, fieldKey) {
  const config = importsStore.sheetConfigs[sheetName]
  if (config) {
    config.mapping[colIndex] = fieldKey
  }
}

function updateModule(sheetName, module) {
  const config = importsStore.sheetConfigs[sheetName]
  if (config) {
    config.targetModule = module
    const sheet = importsStore.sheets.find((s) => s.sheetName === sheetName)
    if (sheet) {
      config.mapping = importsStore.autoMapColumns(sheet.headers, module)
    }
  }
}

async function goToStep(step) {
  if (step === 4) {
    importsStore.generatePreview()
  }
  if (step === 5) {
    importsStore.generatePreview()
    await importsStore.checkDuplicates()
  }
  currentStep.value = step
}

function nextStep() {
  goToStep(currentStep.value + 1)
}

function prevStep() {
  currentStep.value = Math.max(1, currentStep.value - 1)
}

const validCount = computed(() => importsStore.previewRows.filter((r) => r._valid).length)
const errorCount = computed(() => importsStore.previewRows.filter((r) => !r._valid).length)
const duplicateCount = computed(() => importsStore.previewRows.filter((r) => r._duplicate).length)

const duplicateRows = computed(() => importsStore.previewRows
  .map((row, index) => ({ row, index }))
  .filter((item) => item.row._duplicate))

async function confirmImport() {
  await importsStore.saveImport()
  currentStep.value = 6
}

function reset() {
  importsStore.reset()
  currentStep.value = 1
}
</script>

<template>
  <div>
    <div class="page-header">
      <h1>Excel Import</h1>
    </div>

    <!-- Download Templates -->
    <div class="template-section">
      <span class="template-label">Download Templates:</span>
      <Button label="Transmittal" size="small" text @click="handleDownloadTemplate('transmittal')" />
      <Button label="Borrowed" size="small" text @click="handleDownloadTemplate('borrowed')" />
      <Button label="Follow-up" size="small" text @click="handleDownloadTemplate('followup')" />
    </div>

    <!-- Template Version Warning -->
    <div v-if="templateWarning" class="template-warning">
      <i class="pi pi-exclamation-triangle"></i>
      <span>
        This file may use an outdated template
        <template v-if="templateWarning.version">(version {{ templateWarning.version }})</template>.
        Missing required fields: {{ templateWarning.missingFields.join(', ') || 'none detected' }}.
        The column mapping step lets you compensate for any differences.
      </span>
    </div>

    <!-- Step indicator -->
    <div class="step-indicator">
      <div
        v-for="step in [
          { num: 1, label: 'Upload' },
          { num: 2, label: 'Select Sheets' },
          { num: 3, label: 'Map Columns' },
          { num: 4, label: 'Preview' },
          { num: 5, label: 'Duplicates' },
          { num: 6, label: 'Summary' },
        ]"
        :key="step.num"
        :class="['step', { 'step--active': currentStep === step.num, 'step--done': currentStep > step.num }]"
      >
        <span class="step__num">{{ step.num }}</span>
        <span class="step__label">{{ step.label }}</span>
      </div>
    </div>

    <!-- Step 1: Upload -->
    <div v-if="currentStep === 1" class="step-content">
      <p class="step-hint">Select an Excel file (.xlsx or .xls) to import.</p>
      <input type="file" accept=".xlsx,.xls" class="file-input" @change="onFileSelect" />
      <p v-if="importsStore.loading" class="loading-text">Reading file…</p>
    </div>

    <!-- Step 2: Select Worksheets -->
    <div v-if="currentStep === 2" class="step-content">
      <p class="step-hint">Select the worksheets to import.</p>
      <div class="sheet-list">
        <label v-for="sheet in importsStore.sheets" :key="sheet.sheetName" class="sheet-option">
          <input
            type="checkbox"
            :value="sheet.sheetName"
            v-model="importsStore.selectedSheetNames"
          />
          <span class="sheet-name">{{ sheet.sheetName }}</span>
          <span class="sheet-info">{{ sheet.rows.length }} rows, {{ sheet.headers.length }} columns</span>
        </label>
      </div>
      <div class="step-actions">
        <Button label="Back" text @click="prevStep" />
        <Button label="Next" @click="nextStep" :disabled="!importsStore.selectedSheetNames.length" />
      </div>
    </div>

    <!-- Step 3: Column Mapping -->
    <div v-if="currentStep === 3" class="step-content">
      <p class="step-hint">
        Map each Excel column to a system field. Account for inconsistent headers —
        the "Date Transmitted" column may hold different data than its name suggests.
      </p>

      <div v-for="sheetName in importsStore.selectedSheetNames" :key="sheetName" class="mapping-section">
        <div class="mapping-header">
          <h3>{{ sheetName }}</h3>
          <label class="module-select">
            Target Module:
            <Dropdown
              :modelValue="importsStore.sheetConfigs[sheetName]?.targetModule || 'transmittal'"
              :options="moduleOptions"
              optionLabel="label"
              optionValue="value"
              @update:modelValue="(val) => updateModule(sheetName, val)"
            />
          </label>
        </div>

        <table class="mapping-table">
          <thead>
            <tr>
              <th>Excel Column</th>
              <th>Sample Data</th>
              <th>Map To</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(header, colIndex) in importsStore.sheets.find(s => s.sheetName === sheetName)?.headers" :key="colIndex">
              <td>{{ header }}</td>
              <td class="sample">
                {{ importsStore.sheets.find(s => s.sheetName === sheetName)?.rows[0]?.[colIndex] || '—' }}
              </td>
              <td>
                <Dropdown
                  :modelValue="importsStore.sheetConfigs[sheetName]?.mapping[colIndex] || '_skip'"
                  :options="getFieldOptions(importsStore.sheetConfigs[sheetName]?.targetModule || 'transmittal')"
                  optionLabel="label"
                  optionValue="value"
                  @update:modelValue="(val) => updateMapping(sheetName, colIndex, val)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="step-actions">
        <Button label="Back" text @click="prevStep" />
        <Button label="Generate Preview" @click="goToStep(4)" />
      </div>
    </div>

    <!-- Step 4: Preview -->
    <div v-if="currentStep === 4" class="step-content">
      <div class="preview-summary">
        <span class="summary-item">
          <strong>{{ importsStore.previewRows.length }}</strong> total rows
        </span>
        <span class="summary-item summary-item--ok">
          <strong>{{ validCount }}</strong> valid
        </span>
        <span class="summary-item summary-item--err">
          <strong>{{ errorCount }}</strong> with errors
        </span>
      </div>

      <DataTable :value="importsStore.previewRows" stripedRows scrollable scrollHeight="500px">
        <Column field="_sheetName" header="Worksheet" style="width: 120px" />
        <Column field="_rowNumber" header="Row" style="width: 60px" />
        <Column field="client_name" header="Client Name" />
        <Column field="client_account_id" header="Account ID" />
        <Column field="branch" header="Branch" />
        <Column field="date_released" header="Date Released" />
        <Column field="documents_transmitted" header="Documents">
          <template #body="slotProps">
            {{ slotProps.data.documents_transmitted || slotProps.data.documents_items || '' }}
          </template>
        </Column>
        <Column field="_valid" header="Status" style="width: 100px">
          <template #body="slotProps">
            <span v-if="slotProps.data._valid" class="badge badge--ok">Valid</span>
            <span v-else class="badge badge--err" :title="slotProps.data._errors.map(e => e.message).join(', ')">
              {{ slotProps.data._errors.length }} error(s)
            </span>
          </template>
        </Column>
        <Column field="_errors" header="Errors">
          <template #body="slotProps">
            <span v-if="!slotProps.data._valid" class="error-text">
              {{ slotProps.data._errors.map(e => e.message).join('; ') }}
            </span>
          </template>
        </Column>
      </DataTable>

      <div class="step-actions">
        <Button label="Back" text @click="prevStep" />
        <Button label="Start Over" severity="secondary" text @click="reset" />
        <Button
          label="Check Duplicates"
          icon="pi pi-check"
          :disabled="validCount === 0"
          @click="goToStep(5)"
        />
      </div>
    </div>

    <!-- Step 5: Duplicate Review -->
    <div v-if="currentStep === 5" class="step-content">
      <div class="preview-summary">
        <span class="summary-item"><strong>{{ validCount }}</strong> valid rows</span>
        <span class="summary-item summary-item--err"><strong>{{ errorCount }}</strong> with errors (excluded)</span>
        <span class="summary-item"><strong>{{ duplicateCount }}</strong> potential duplicates</span>
      </div>

      <div v-if="duplicateCount === 0" class="no-duplicates">
        No potential duplicates detected. You can proceed to import.
      </div>

      <div v-else>
        <p class="step-hint">
          Review each potential duplicate. Choose whether to keep the existing record
          or update it with the imported data. No records are overwritten automatically.
        </p>
        <DataTable :value="duplicateRows" stripedRows scrollable scrollHeight="400px">
          <Column header="Row" style="width: 60px">
            <template #body="slotProps">{{ slotProps.item.row._rowNumber }}</template>
          </Column>
          <Column header="Client">
            <template #body="slotProps">{{ slotProps.item.row.client_name }}</template>
          </Column>
          <Column header="Account">
            <template #body="slotProps">{{ slotProps.item.row.client_account_id }}</template>
          </Column>
          <Column header="Existing Ref">
            <template #body="slotProps">{{ slotProps.item.row._duplicate?.reference_number || '—' }}</template>
          </Column>
          <Column header="Decision" style="width: 180px">
            <template #body="slotProps">
              <Dropdown
                :modelValue="slotProps.item.row._duplicateDecision"
                :options="[
                  { label: 'Keep Existing (Skip)', value: 'keep' },
                  { label: 'Update Existing', value: 'update' },
                ]"
                optionLabel="label"
                optionValue="value"
                @update:modelValue="(val) => importsStore.setDuplicateDecision(slotProps.item.index, val)"
              />
            </template>
          </Column>
        </DataTable>
      </div>

      <div class="step-actions">
        <Button label="Back" text @click="prevStep" />
        <Button label="Start Over" severity="secondary" text @click="reset" />
        <Button
          label="Confirm Import"
          icon="pi pi-check"
          :loading="importsStore.saving"
          @click="confirmImport"
        />
      </div>
    </div>

    <!-- Step 6: Import Summary -->
    <div v-if="currentStep === 6" class="step-content">
      <div v-if="importsStore.importSummary" class="import-summary">
        <h3>Import Complete</h3>
        <div class="summary-grid">
          <div class="summary-stat">
            <div class="summary-stat__value">{{ importsStore.importSummary.total }}</div>
            <div class="summary-stat__label">Total Processed</div>
          </div>
          <div class="summary-stat summary-stat--ok">
            <div class="summary-stat__value">{{ importsStore.importSummary.imported }}</div>
            <div class="summary-stat__label">Imported (New)</div>
          </div>
          <div class="summary-stat summary-stat--blue">
            <div class="summary-stat__value">{{ importsStore.importSummary.updated }}</div>
            <div class="summary-stat__label">Updated</div>
          </div>
          <div class="summary-stat summary-stat--amber">
            <div class="summary-stat__value">{{ importsStore.importSummary.skipped }}</div>
            <div class="summary-stat__label">Skipped (Kept Existing)</div>
          </div>
          <div class="summary-stat summary-stat--err">
            <div class="summary-stat__value">{{ importsStore.importSummary.errors }}</div>
            <div class="summary-stat__label">Errors (Excluded)</div>
          </div>
        </div>
        <p class="step-hint">
          Invalid rows were excluded and can be corrected and re-imported later.
          View import history to review or undo this import.
        </p>
      </div>
      <div class="step-actions">
        <Button label="Import Another File" @click="reset" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-header {
  margin-bottom: 1.5rem;
}

.page-header h1 {
  font-size: 1.5rem;
  color: #1e293b;
}

.step-indicator {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.step {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  background: #f1f5f9;
  color: #94a3b8;
}

.step--active {
  background: #3b82f6;
  color: #fff;
}

.step--done {
  background: #d1fae5;
  color: #065f46;
}

.step__num {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.1);
  font-size: 0.75rem;
  font-weight: 700;
}

.step--active .step__num {
  background: rgba(255, 255, 255, 0.3);
}

.step-content {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 1.5rem;
}

.step-hint {
  color: #64748b;
  font-size: 0.85rem;
  margin-bottom: 1rem;
}

.file-input {
  margin-bottom: 1rem;
}

.loading-text {
  color: #3b82f6;
  font-size: 0.85rem;
}

.sheet-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sheet-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
}

.sheet-name {
  font-weight: 500;
}

.sheet-info {
  font-size: 0.8rem;
  color: #94a3b8;
  margin-left: auto;
}

.mapping-section {
  margin-bottom: 1.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1rem;
}

.mapping-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.mapping-header h3 {
  font-size: 1rem;
  color: #334155;
}

.module-select {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.mapping-table {
  width: 100%;
  border-collapse: collapse;
}

.mapping-table th,
.mapping-table td {
  text-align: left;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #e2e8f0;
  font-size: 0.85rem;
}

.mapping-table th {
  font-weight: 600;
  color: #475569;
  background: #f8fafc;
}

.sample {
  color: #94a3b8;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-summary {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 1rem;
}

.summary-item {
  font-size: 0.9rem;
  color: #475569;
}

.summary-item--ok strong { color: #065f46; }
.summary-item--err strong { color: #dc2626; }

.step-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1.5rem;
  border-top: 1px solid #e2e8f0;
  padding-top: 1rem;
}

.badge {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.badge--ok {
  background: #d1fae5;
  color: #065f46;
}

.badge--err {
  background: #fee2e2;
  color: #991b1b;
}

.error-text {
  font-size: 0.8rem;
  color: #dc2626;
}

.no-duplicates {
  padding: 1.5rem;
  text-align: center;
  color: #065f46;
  background: #d1fae5;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.import-summary h3 {
  font-size: 1.25rem;
  color: #1e293b;
  margin-bottom: 1rem;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.summary-stat {
  text-align: center;
  padding: 1rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.summary-stat__value {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1e293b;
}

.summary-stat__label {
  font-size: 0.75rem;
  color: #64748b;
  margin-top: 0.25rem;
}

.summary-stat--ok .summary-stat__value { color: #065f46; }
.summary-stat--blue .summary-stat__value { color: #1e40af; }
.summary-stat--amber .summary-stat__value { color: #92400e; }
.summary-stat--err .summary-stat__value { color: #dc2626; }

.template-section {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.template-label {
  font-size: 0.85rem;
  font-weight: 500;
  color: #475569;
}

.template-warning {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  background: #fef3c7;
  color: #92400e;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  font-size: 0.85rem;
}
</style>
