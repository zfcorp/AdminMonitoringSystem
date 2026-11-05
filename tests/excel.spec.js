import { describe, it, expect } from 'vitest'
import { mapRows, TRANSMITTAL_FIELDS, BORROWED_FIELDS } from '../src/utils/excel'

describe('mapRows', () => {
  it('maps raw rows to system field keys using column mapping', () => {
    const headers = ['Date Transmitted', 'Client Name', 'Account ID', 'Received By']
    const rows = [
      ['2025-01-15', 'Juan dela Cruz', 'ACC-001', 'THRU LBC'],
      ['2025-02-20', 'Maria Santos', 'ACC-002', 'Personal pickup'],
    ]
    const mapping = { 0: 'date_transmitted', 1: 'client_name', 2: 'client_account_id', 3: 'received_by' }

    const result = mapRows(rows, headers, mapping)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      _rowNumber: 2,
      date_transmitted: '2025-01-15',
      client_name: 'Juan dela Cruz',
      client_account_id: 'ACC-001',
      received_by: 'THRU LBC',
    })
    expect(result[1]._rowNumber).toBe(3)
  })

  it('skips columns mapped to _skip', () => {
    const rows = [['Juan', 'ACC-001', 'extra']]
    const mapping = { 0: 'client_name', 1: 'client_account_id', 2: '_skip' }

    const result = mapRows(rows, [], mapping)

    expect(result[0]).toHaveProperty('client_name', 'Juan')
    expect(result[0]).toHaveProperty('client_account_id', 'ACC-001')
    expect(result[0]).not.toHaveProperty('_skip')
  })

  it('handles empty cells as empty strings', () => {
    const rows = [['Juan', '', 'ACC-001']]
    const mapping = { 0: 'client_name', 1: 'purpose', 2: 'client_account_id' }

    const result = mapRows(rows, [], mapping)

    expect(result[0].client_name).toBe('Juan')
    expect(result[0].purpose).toBe('')
    expect(result[0].client_account_id).toBe('ACC-001')
  })
})

describe('TRANSMITTAL_FIELDS', () => {
  it('includes required fields client_name and client_account_id', () => {
    const required = TRANSMITTAL_FIELDS.filter((f) => f.required)
    const keys = required.map((f) => f.key)
    expect(keys).toContain('client_name')
    expect(keys).toContain('client_account_id')
  })

  it('includes the _skip option', () => {
    expect(TRANSMITTAL_FIELDS.some((f) => f.key === '_skip')).toBe(true)
  })
})

describe('BORROWED_FIELDS', () => {
  it('includes borrowed-specific fields', () => {
    const keys = BORROWED_FIELDS.map((f) => f.key)
    expect(keys).toContain('documents_items')
    expect(keys).toContain('borrowing_reason')
    expect(keys).toContain('date_returned')
    expect(keys).toContain('status')
  })
})
