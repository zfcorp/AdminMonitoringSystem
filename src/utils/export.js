/**
 * Export records to Excel (.xlsx) or CSV.
 * Uses SheetJS (xlsx) — already a project dependency.
 */

const BORROWED_COLS = [
  { key: 'reference_number',    label: 'Reference No.'        },
  { key: 'client_name',         label: 'Client Name'          },
  { key: 'account_number',      label: 'Account ID'           },
  { key: 'branch',              label: 'Branch'               },
  { key: 'date_released',       label: 'Date Released'        },
  { key: 'document_transmitted', label: 'Documents / Items'   },
  { key: 'status',              label: 'Purpose / Status'     },
  { key: 'date_returned',       label: 'Date Returned'        },
  { key: 'remarks',             label: 'Remarks'              },
]

const TRANSMITTAL_COLS = [
  { key: 'reference_number',    label: 'Reference No.'        },
  { key: 'client_name',         label: 'Client Name'          },
  { key: 'account_number',      label: 'Account ID'           },
  { key: 'branch',              label: 'Branch'               },
  { key: 'date_released',       label: 'Date Released'        },
  { key: 'document_transmitted', label: 'Documents Transmitted' },
  { key: 'status',              label: 'Purpose / Status'     },
  { key: 'date_transmitted',    label: 'Date Transmitted'     },
  { key: 'received_by',         label: 'Received By'          },
  { key: 'remarks',             label: 'Remarks'              },
]

function flattenRecord(r) {
  return {
    reference_number:     r.reference_number || '',
    client_name:          r.clients?.name || '',
    account_number:       r.client_accounts?.account_number || '',
    branch:               r.branches?.name || '',
    document_transmitted: r.document_transmitted || '',
    status:               r.statuses?.name || '',
    date_released:        r.date_released || '',
    date_transmitted:     r.date_transmitted || '',
    received_by:          r.received_by || '',
    date_returned:        r.date_returned || '',
    remarks:              r.remarks || '',
  }
}

function buildAoa(records, module) {
  const cols = module === 'transmittal' ? TRANSMITTAL_COLS : BORROWED_COLS
  const headers = cols.map((c) => c.label)
  const rows = records.map((r) => {
    const flat = flattenRecord(r)
    return cols.map((c) => flat[c.key])
  })
  return [headers, ...rows]
}

export async function exportToExcel(records, module = 'borrowed') {
  const XLSX = await import('xlsx')
  const aoa = buildAoa(records, module)
  const ws = XLSX.utils.aoa_to_sheet(aoa)

  // Auto column widths
  ws['!cols'] = aoa[0].map((_, i) => ({
    wch: Math.max(12, ...aoa.map((row) => String(row[i] || '').length)),
  }))

  const wb = XLSX.utils.book_new()
  const sheetName = module === 'transmittal' ? 'Transmittal' : 'Borrowed'
  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  const date = new Date().toISOString().split('T')[0]
  XLSX.writeFile(wb, `${sheetName}_${date}.xlsx`)
}

export async function exportToCsv(records, module = 'borrowed') {
  const XLSX = await import('xlsx')
  const aoa = buildAoa(records, module)
  const ws = XLSX.utils.aoa_to_sheet(aoa)

  const csv = XLSX.utils.sheet_to_csv(ws)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  const sheetName = module === 'transmittal' ? 'Transmittal' : 'Borrowed'
  const date = new Date().toISOString().split('T')[0]
  a.href = url
  a.download = `${sheetName}_${date}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
