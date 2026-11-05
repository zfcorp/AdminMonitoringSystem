// Template version config — bump when fields change
export const TEMPLATE_VERSIONS = {
  transmittal: 1,
  borrowed: 1,
  followup: 1,
}

// Field definitions for each template
const TEMPLATE_FIELDS = {
  transmittal: [
    { header: 'Client Name', required: true, sample: 'Juan dela Cruz' },
    { header: 'Client Account ID', required: true, sample: 'ACC-001' },
    { header: 'Date Released', required: false, sample: '2025-01-15' },
    { header: 'Documents Transmitted', required: false, sample: 'Original ORCR' },
    { header: 'Purpose', required: false, sample: 'For client release' },
    { header: 'Date Transmitted', required: false, sample: '2025-01-10' },
    { header: 'Received By', required: false, sample: 'THRU LBC' },
    { header: 'Remarks', required: false, sample: '' },
  ],
  borrowed: [
    { header: 'Client Name', required: true, sample: 'Maria Santos' },
    { header: 'Client Account ID', required: true, sample: 'ACC-002' },
    { header: 'Date Released', required: false, sample: '2025-06-01' },
    { header: 'Documents/Items', required: false, sample: 'Duplicate key' },
    { header: 'Purpose', required: false, sample: 'For duplication' },
    { header: 'Additional Details', required: false, sample: 'Honda Click 125i' },
    { header: 'Borrowing Reason', required: false, sample: 'Client request' },
    { header: 'Date Returned', required: false, sample: '' },
    { header: 'Status', required: false, sample: 'Borrowed' },
    { header: 'Remarks', required: false, sample: '' },
  ],
  followup: [
    { header: 'Parent Reference', required: true, sample: 'TRN-00001' },
    { header: 'Follow-up Date', required: false, sample: '2025-07-01' },
    { header: 'Subject/Concern', required: false, sample: 'Pending ORCR' },
    { header: 'Details', required: false, sample: 'Branch to follow up with client' },
    { header: 'Status', required: false, sample: 'Open' },
    { header: 'Resolved Date', required: false, sample: '' },
    { header: 'Remarks', required: false, sample: '' },
  ],
}

/**
 * Generate and download an Excel template for the specified module.
 * Uses SheetJS (xlsx) with dynamic import.
 * Required fields are marked with * in the header.
 * @param {'transmittal'|'borrowed'|'followup'} module
 */
export async function downloadTemplate(module) {
  const XLSX = await import('xlsx')
  const fields = TEMPLATE_FIELDS[module]
  if (!fields) throw new Error(`Unknown template module: ${module}`)

  // Build header row (required fields marked with *)
  const headers = fields.map((f) => (f.required ? `${f.header} *` : f.header))
  const samples = fields.map((f) => f.sample)

  // Row 1: version metadata
  // Row 2: headers
  // Row 3: sample data
  // Row 4: blank
  // Row 5: instructions
  const aoa = [
    [`Template Version: ${TEMPLATE_VERSIONS[module]}`],
    headers,
    samples,
    [],
    ['Note: Fields marked with * are required. Replace sample data with your actual records.'],
  ]

  const ws = XLSX.utils.aoa_to_sheet(aoa)

  // Set column widths
  ws['!cols'] = fields.map((f) => ({ wch: Math.max(f.header.length + 5, 15) }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, module.charAt(0).toUpperCase() + module.slice(1))
  XLSX.writeFile(wb, `${module}_template_v${TEMPLATE_VERSIONS[module]}.xlsx`)
}

/**
 * Check the template version of an uploaded workbook.
 * Returns the detected version or null if not found.
 * @param {Array<{ sheetName: string, headers: string[], rows: Array<any[]> }>} sheets
 * @param {'transmittal'|'borrowed'|'followup'} module
 * @returns {{ version: number|null, isOutdated: boolean, missingFields: string[] }}
 */
export function checkTemplateVersion(sheets, module) {
  const currentVersion = TEMPLATE_VERSIONS[module] || 1
  const currentFields = TEMPLATE_FIELDS[module] || []
  const currentHeaders = currentFields.map((f) => f.header)

  // Find a sheet that looks like this module (has at least some matching headers)
  let bestSheet = null
  let matchCount = 0
  for (const sheet of sheets) {
    const count = sheet.headers.filter((h) =>
      currentHeaders.some((ch) => ch.toLowerCase() === h.toLowerCase())
    ).length
    if (count > matchCount) {
      matchCount = count
      bestSheet = sheet
    }
  }

  if (!bestSheet || matchCount === 0) {
    return { version: null, isOutdated: false, missingFields: [] }
  }

  // Check for version metadata in row 1 (A1 cell)
  let version = null
  const firstRow = bestSheet.rows[0]
  if (firstRow && firstRow[0]) {
    const match = firstRow[0].toString().match(/Template Version:\s*(\d+)/i)
    if (match) {
      version = Number(match[1])
    }
  }

  // Find missing required fields
  const missingFields = currentFields
    .filter((f) => f.required)
    .filter((f) => !bestSheet.headers.some((h) => h.toLowerCase() === f.header.toLowerCase()))
    .map((f) => f.header)

  return {
    version,
    isOutdated: version !== null && version < currentVersion,
    missingFields,
  }
}
