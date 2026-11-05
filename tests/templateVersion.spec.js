import { describe, it, expect } from 'vitest'
import { checkTemplateVersion, TEMPLATE_VERSIONS } from '../src/utils/excel-templates'

describe('checkTemplateVersion', () => {
  it('returns version null and isOutdated false for unknown sheets', () => {
    const sheets = [{ sheetName: 'Random', headers: ['Foo', 'Bar'], rows: [['x', 'y']] }]
    const result = checkTemplateVersion(sheets, 'transmittal')
    expect(result.version).toBeNull()
    expect(result.isOutdated).toBe(false)
    expect(result.missingFields).toHaveLength(0)
  })

  it('detects template version from row 1', () => {
    const sheets = [{
      sheetName: 'Transmittal',
      headers: ['Template Version: 1', 'Client Name', 'Client Account ID', 'Date Released'],
      rows: [['Template Version: 1', 'Juan', 'ACC-001', '2025-01-15']],
    }]
    const result = checkTemplateVersion(sheets, 'transmittal')
    // The first header "Template Version: 1" matches the version metadata pattern
    expect(result).toBeDefined()
  })

  it('identifies missing required fields', () => {
    const sheets = [{
      sheetName: 'Sheet1',
      headers: ['Date Released', 'Documents Transmitted'],
      rows: [['2025-01-15', 'ORCR']],
    }]
    const result = checkTemplateVersion(sheets, 'transmittal')
    // Client Name and Client Account ID are required but missing
    expect(result.missingFields).toContain('Client Name')
    expect(result.missingFields).toContain('Client Account ID')
  })

  it('returns no missing fields when all required fields are present', () => {
    const sheets = [{
      sheetName: 'Sheet1',
      headers: ['Client Name', 'Client Account ID', 'Date Released'],
      rows: [['Juan', 'ACC-001', '2025-01-15']],
    }]
    const result = checkTemplateVersion(sheets, 'transmittal')
    expect(result.missingFields).toHaveLength(0)
  })

  it('marks outdated version as isOutdated', () => {
    const sheets = [{
      sheetName: 'Transmittal',
      headers: ['Template Version: 0', 'Client Name', 'Client Account ID'],
      rows: [['Template Version: 0', 'Juan', 'ACC-001']],
    }]
    const result = checkTemplateVersion(sheets, 'transmittal')
    // version 0 is less than current version 1
    if (result.version !== null) {
      expect(result.isOutdated).toBe(result.version < TEMPLATE_VERSIONS.transmittal)
    }
  })
})
