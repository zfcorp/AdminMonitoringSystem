import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock supabase (needed for store init, not for generatePreview test)
vi.mock('../src/lib/supabase', () => ({
  supabase: { from: vi.fn(), auth: {} },
}))

import { useImportsStore } from '../src/stores/imports'

describe('Imports Store', () => {
  let store

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useImportsStore()
    store.reset()
  })

  it('generatePreview transforms rows and validates required fields', () => {
    // Manually set up the store state (simulating after loadFile)
    store.sheets = [
      {
        sheetName: '2025',
        headers: ['Client Name', 'Account ID', 'Date Released', 'Documents'],
        rows: [
          ['Juan dela Cruz', 'ACC-001', '2025-01-15', 'ORCR'],
          ['', 'ACC-002', '2025-02-20', 'Contract'], // missing client name
          ['Maria Santos', '', '2025-03-10', 'Key'], // missing account id
        ],
      },
    ]
    store.selectedSheetNames = ['2025']
    store.sheetConfigs = {
      '2025': {
        targetModule: 'transmittal',
        mapping: { 0: 'client_name', 1: 'client_account_id', 2: 'date_released', 3: 'documents_transmitted' },
      },
    }

    store.generatePreview()

    expect(store.previewRows).toHaveLength(3)

    // Row 1: valid (all required fields present)
    expect(store.previewRows[0]._valid).toBe(true)
    expect(store.previewRows[0].client_name).toBe('Juan dela Cruz')
    expect(store.previewRows[0].client_account_id).toBe('ACC-001')
    expect(store.previewRows[0]._rowNumber).toBe(2)

    // Row 2: invalid (missing client name)
    expect(store.previewRows[1]._valid).toBe(false)
    expect(store.previewRows[1]._errors.some((e) => e.message.includes('Client Name'))).toBe(true)

    // Row 3: invalid (missing account id)
    expect(store.previewRows[2]._valid).toBe(false)
    expect(store.previewRows[2]._errors.some((e) => e.message.includes('Account ID'))).toBe(true)
  })

  it('generatePreview supports partial import (valid rows alongside invalid)', () => {
    store.sheets = [
      {
        sheetName: 'Test',
        headers: ['Client Name', 'Account ID'],
        rows: [
          ['Valid Client', 'ACC-001'],
          ['Another Valid', 'ACC-002'],
          ['Missing Account', ''],
        ],
      },
    ]
    store.selectedSheetNames = ['Test']
    store.sheetConfigs = {
      'Test': {
        targetModule: 'transmittal',
        mapping: { 0: 'client_name', 1: 'client_account_id' },
      },
    }

    store.generatePreview()

    const valid = store.previewRows.filter((r) => r._valid)
    const invalid = store.previewRows.filter((r) => !r._valid)

    expect(valid).toHaveLength(2)
    expect(invalid).toHaveLength(1)
  })

  it('setDuplicateDecision updates the decision for a specific row', () => {
    store.previewRows = [
      { _duplicate: { id: 1 }, _duplicateDecision: 'keep', _valid: true },
      { _duplicate: null, _duplicateDecision: 'create', _valid: true },
    ]

    store.setDuplicateDecision(0, 'update')
    expect(store.previewRows[0]._duplicateDecision).toBe('update')

    store.setDuplicateDecision(1, 'keep')
    expect(store.previewRows[1]._duplicateDecision).toBe('keep')
  })

  it('reset clears all session state', () => {
    store.fileName = 'test.xlsx'
    store.sheets = [{ sheetName: 'test' }]
    store.previewRows = [{ _valid: true }]
    store.importSummary = { imported: 5 }

    store.reset()

    expect(store.fileName).toBe('')
    expect(store.sheets).toHaveLength(0)
    expect(store.previewRows).toHaveLength(0)
    expect(store.importSummary).toBeNull()
  })
})
