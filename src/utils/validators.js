/**
 * Validates a single mapped import row.
 * Checks required fields (Client Name, Account ID) and basic date formats.
 *
 * @param {object} row - mapped row with system field keys
 * @param {string} targetModule - 'transmittal' or 'borrowed'
 * @returns {{ valid: boolean, errors: Array<{ field: string, message: string }> }}
 */
export function validateImportRow(row, targetModule) {
  const errors = []

  // Required fields for all modules
  if (!row.client_name?.toString().trim()) {
    errors.push({ field: 'client_name', message: 'Missing Client Name' })
  }
  if (!row.client_account_id?.toString().trim()) {
    errors.push({ field: 'client_account_id', message: 'Missing Account ID' })
  }

  // Date validation — check that date fields contain parseable dates
  const dateFields = ['date_released', 'date_transmitted', 'date_returned']
  for (const field of dateFields) {
    const val = row[field]
    if (val && val.toString().trim()) {
      if (!isValidDate(val)) {
        errors.push({ field, message: `Invalid date format: ${val}` })
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Check if a value is a valid date.
 * Accepts Date objects, ISO strings, and common date formats.
 * @param {any} val
 * @returns {boolean}
 */
export function isValidDate(val) {
  if (val instanceof Date) {
    return !isNaN(val.getTime())
  }
  const str = val.toString().trim()
  if (!str) return true // empty is OK (optional field)

  // Try Date.parse
  const d = new Date(str)
  if (!isNaN(d.getTime())) return true

  // Try common formats: MM/DD/YYYY, MM-DD-YYYY
  const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashMatch) {
    const m = Number(slashMatch[1])
    const d = Number(slashMatch[2])
    if (m < 1 || m > 12 || d < 1 || d > 31) return false
    return true
  }

  const dashMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (dashMatch) {
    const m = Number(dashMatch[2])
    const d = Number(dashMatch[3])
    if (m < 1 || m > 12 || d < 1 || d > 31) return false
    return true
  }

  return false
}
