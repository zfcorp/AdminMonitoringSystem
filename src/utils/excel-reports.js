/**
 * Generate and download an Excel error report for a specific import.
 * Uses SheetJS (xlsx) with dynamic import.
 * @param {Array} errorRows - import_errors rows from the database
 * @param {string} filename - base filename for the report
 */
export async function downloadErrorReport(errorRows, filename = 'import_errors') {
  const XLSX = await import('xlsx')

  const headers = ['Worksheet', 'Row Number', 'Client Name', 'Account ID', 'Error Details', 'Suggested Correction']

  const aoa = [headers]

  if (errorRows && errorRows.length) {
    errorRows.forEach((err) => {
      aoa.push([
        err.worksheet_name || '',
        err.row_number || '',
        err.client_name || '',
        err.account_id || '',
        err.error_details || '',
        err.suggested_correction || '',
      ])
    })
  } else {
    aoa.push(['No errors found for this import.'])
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = [
    { wch: 20 }, { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 40 }, { wch: 25 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Error Report')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}
