/**
 * Reads an Excel file (.xlsx or .xls) and returns an array of worksheet
 * objects with their headers and row data.
 *
 * @param {File} file - the uploaded file from an <input type="file"> or FileUpload
 * @returns {Promise<Array<{ sheetName: string, headers: string[], rows: Array<any[]> }>>}
 */
export async function readWorkbook(file) {
  const XLSX = await import('xlsx')
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        // Yield before heavy XLSX parsing so the browser can update the UI
        await new Promise((r) => setTimeout(r, 10))

        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array', cellDates: true })

        const sheets = workbook.SheetNames.map((sheetName) => {
          const sheet = workbook.Sheets[sheetName]
          const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

          // Detect and skip the template version metadata row.
          // The version row looks like: ["Template Version: N", "", "", ...]
          // The real header row follows immediately after.
          let headerRowIndex = 0
          if (
            allRows[0]?.[0] &&
            String(allRows[0][0]).trim().match(/^Template Version:/i)
          ) {
            headerRowIndex = 1
          }

          // Strip the trailing " *" required-field marker from header names
          const headers = (allRows[headerRowIndex] || []).map((h) =>
            String(h || '').trim().replace(/\s*\*$/, '')
          )
          const rows = allRows.slice(headerRowIndex + 1).filter((r) =>
            r.some((cell) => cell !== '' && cell !== null && cell !== undefined)
          )
          return { sheetName, headers, rows }
        })

        resolve(sheets)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * System fields available for column mapping, per target module.
 * Keys must match what buildPayload() reads in imports.js.
 */
export const TRANSMITTAL_FIELDS = [
  { key: 'client_name',            label: 'Client Name',            required: true  },
  { key: 'client_account_id',      label: 'Client Account ID',      required: false },
  { key: 'branch',                 label: 'Branch',                 required: false },
  { key: 'date_released',          label: 'Date Released',          required: false },
  { key: 'documents_transmitted',  label: 'Documents Transmitted',  required: false },
  { key: 'purpose_status',         label: 'Purpose / Status',       required: false },
  { key: 'date_transmitted',       label: 'Date Transmitted',       required: false },
  { key: 'received_by',            label: 'Received By',            required: false },
  { key: 'remarks',                label: 'Remarks',                required: false },
  { key: '_skip',                  label: '— Skip —',               required: false },
]

export const BORROWED_FIELDS = [
  { key: 'client_name',       label: 'Client Name',       required: true  },
  { key: 'client_account_id', label: 'Client Account ID', required: false },
  { key: 'branch',            label: 'Branch',            required: false },
  { key: 'date_released',     label: 'Date Released',     required: false },
  { key: 'documents_items',   label: 'Documents/Items',   required: false },
  { key: 'purpose_status',    label: 'Purpose / Status',  required: false },
  { key: 'date_returned',     label: 'Date Returned',     required: false },
  { key: 'remarks',           label: 'Remarks',           required: false },
  { key: '_skip',             label: '— Skip —',          required: false },
]

/**
 * Transform raw Excel rows into system-field-shaped objects using
 * the provided column mapping.
 *
 * @param {Array<any[]>} rows - raw rows from readWorkbook
 * @param {string[]} headers - column headers
 * @param {Object} mapping - { columnIndex: systemFieldKey }
 * @returns {Array<{ _rowNumber: number, [field]: any }>}
 */
export function mapRows(rows, headers, mapping) {
  return rows.map((row, index) => {
    const mapped = { _rowNumber: index + 2 } // +2 because row 1 is headers, row 0 in array is first data row

    for (const [colIndexStr, fieldKey] of Object.entries(mapping)) {
      if (fieldKey === '_skip' || !fieldKey) continue
      const colIndex = Number(colIndexStr)
      const value = row[colIndex]
      mapped[fieldKey] = value !== '' && value !== null && value !== undefined ? value : ''
    }

    return mapped
  })
}

// Archive import uses the same fields as the live modules
export const ARCHIVE_TRANSMITTAL_FIELDS = TRANSMITTAL_FIELDS
export const ARCHIVE_BORROWED_FIELDS = BORROWED_FIELDS
