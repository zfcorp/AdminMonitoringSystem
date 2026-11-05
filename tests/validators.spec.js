import { describe, it, expect } from 'vitest'
import { validateImportRow, isValidDate } from '../src/utils/validators'

describe('validateImportRow', () => {
  it('returns valid when required fields are present', () => {
    const row = {
      client_name: 'Juan dela Cruz',
      client_account_id: 'ACC-001',
      date_released: '2025-01-15',
    }
    const result = validateImportRow(row, 'transmittal')
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('returns error when client_name is missing', () => {
    const row = { client_name: '', client_account_id: 'ACC-001' }
    const result = validateImportRow(row, 'transmittal')
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual({
      field: 'client_name',
      message: 'Missing Client Name',
    })
  })

  it('returns error when client_account_id is missing', () => {
    const row = { client_name: 'Juan', client_account_id: '' }
    const result = validateImportRow(row, 'transmittal')
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual({
      field: 'client_account_id',
      message: 'Missing Account ID',
    })
  })

  it('returns error for invalid date format', () => {
    const row = {
      client_name: 'Juan',
      client_account_id: 'ACC-001',
      date_released: 'not-a-date',
    }
    const result = validateImportRow(row, 'transmittal')
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.field === 'date_released')).toBe(true)
  })

  it('allows empty optional date fields', () => {
    const row = {
      client_name: 'Juan',
      client_account_id: 'ACC-001',
      date_released: '',
      date_transmitted: '',
    }
    const result = validateImportRow(row, 'transmittal')
    expect(result.valid).toBe(true)
  })

  it('works for borrowed module fields', () => {
    const row = {
      client_name: 'Maria',
      client_account_id: 'ACC-002',
      date_returned: '2025-05-15',
      status: 'Returned',
    }
    const result = validateImportRow(row, 'borrowed')
    expect(result.valid).toBe(true)
  })
})

describe('isValidDate', () => {
  it('accepts ISO date strings', () => {
    expect(isValidDate('2025-01-15')).toBe(true)
    expect(isValidDate('2025-12-31')).toBe(true)
  })

  it('accepts slash dates', () => {
    expect(isValidDate('01/15/2025')).toBe(true)
    expect(isValidDate('12/31/2025')).toBe(true)
  })

  it('accepts Date objects', () => {
    expect(isValidDate(new Date('2025-01-15'))).toBe(true)
  })

  it('rejects invalid dates', () => {
    expect(isValidDate('not-a-date')).toBe(false)
    expect(isValidDate('2025-13-45')).toBe(false)
  })

  it('accepts empty strings (optional fields)', () => {
    expect(isValidDate('')).toBe(true)
  })
})
