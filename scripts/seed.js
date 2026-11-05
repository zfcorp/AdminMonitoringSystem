/**
 * Seed script — inserts mock data into your Supabase project.
 *
 * Usage:
 *   node scripts/seed.js
 *
 * This script reads VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY
 * from your .env file. The service role key bypasses RLS.
 *
 * You can find your service role key at:
 *   Supabase Dashboard → Project Settings → API → service_role (secret)
 *
 * Alternatively, paste the contents of
 *   supabase/migrations/0007_seed_mock_data.sql
 * directly into the Supabase SQL editor.
 */

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// ── Load .env manually (no dotenv dependency needed) ──────────
const envFile = readFileSync(new URL('../.env', import.meta.url), 'utf8')
const env = Object.fromEntries(
  envFile
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => l.split('=').map((s) => s.trim()))
    .filter(([k]) => k)
)

const SUPABASE_URL = env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL) {
  console.error('❌  VITE_SUPABASE_URL not found in .env')
  process.exit(1)
}
if (!SERVICE_ROLE_KEY) {
  console.warn(
    '⚠️  VITE_SUPABASE_SERVICE_ROLE_KEY not found in .env.\n' +
    '   Add it to .env then re-run, or paste 0007_seed_mock_data.sql\n' +
    '   into the Supabase SQL editor instead.'
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

async function seed() {
  console.log('🌱  Seeding mock data…\n')

  // ── Branches ────────────────────────────────────────────────
  const branches = [
    { id: 1,  name: 'VMSC Lipa' },
    { id: 2,  name: 'VMSC Mataas na Kahoy' },
    { id: 3,  name: 'VMSC Padre Garcia' },
    { id: 4,  name: 'Ventura Honda 3s' },
    { id: 5,  name: 'VMSC Lemery' },
    { id: 6,  name: 'VMSC Ibaan' },
    { id: 7,  name: 'VMSC San Juan' },
    { id: 8,  name: 'VMSC Lobo' },
    { id: 9,  name: 'VMSC Bauan' },
    { id: 10, name: 'VMSC San Pascual' },
    { id: 11, name: 'VMSC Sta. Rita' },
    { id: 12, name: 'VMSC Taysan' },
    { id: 13, name: 'VMSC Rosario' },
    { id: 14, name: 'VMSC Teresa Y3S' },
    { id: 15, name: 'VSMC Pililla' },
    { id: 16, name: 'VMSC Siniloan' },
    { id: 17, name: 'VMSC Infanta' },
    { id: 18, name: 'VMSC Teresa MB' },
    { id: 19, name: 'VSMC San Pablo' },
    { id: 20, name: 'VMSC Calauan' },
    { id: 21, name: 'VMSC Nagcarlan' },
    { id: 22, name: 'VMSC Santa Cruz' },
    { id: 23, name: 'VMSC Bay' },
    { id: 24, name: 'VSMC Carmona' },
    { id: 25, name: 'VMSC Dasma' },
    { id: 26, name: 'VSMC Cabuyao' },
    { id: 27, name: 'VSMSC Salitran' },
    { id: 28, name: 'VMSC Calapan' },
    { id: 29, name: 'VMSC Pinamalayan' },
    { id: 30, name: 'VMSC Puerto Galera' },
    { id: 31, name: 'VMSC Socorro' },
    { id: 32, name: 'VSMC Victoria' },
    { id: 33, name: 'VMSC Mamburao' },
    { id: 34, name: 'VMSC Sablayan' },
    { id: 35, name: 'Ventura Sablayan' },
    { id: 36, name: 'VMSC San Jose' },
    { id: 37, name: 'VMSC Roxas' },
    { id: 38, name: 'VMSC Bongabong' },
    { id: 39, name: 'Lopez' },
    { id: 40, name: 'VMSC Tagkawayan' },
    { id: 41, name: 'VMSC Gumaca' },
    { id: 42, name: 'VMSC Sta. Cruz Marinduque' },
    { id: 43, name: 'VMSC Boac - Marinduque' },
    { id: 44, name: 'VMSC Calauag' },
    { id: 45, name: 'VMSC San Andres' },
    { id: 46, name: 'VMSC Mulanay MB' },
    { id: 47, name: 'Catanauan MB' },
    { id: 48, name: 'VMSC San Narciso' },
    { id: 49, name: 'Ventura Honda Catanauan' },
    { id: 50, name: 'VMSC Mulanay Y3s' },
    { id: 51, name: 'VMSC Pagbilao' },
    { id: 52, name: 'VMSC Gulang-gulang' },
    { id: 53, name: 'VMSC Suzuki Lucena' },
    { id: 54, name: 'VMSC Sariaya' },
    { id: 55, name: 'VMSC Tiaong' },
    { id: 56, name: 'VMSC Candelaria MB/LLC Candelaria' },
    { id: 57, name: 'VMSC Mauban' },
    { id: 58, name: 'VMSC Candelaria Y3s' },
    { id: 59, name: 'Mariveles' },
    { id: 60, name: 'VMSC Orani' },
    { id: 61, name: 'VMSC Limay' },
    { id: 62, name: 'VMSC Dinalupihan' },
  ]
  await upsert('branches', branches)

  // ── Clients ──────────────────────────────────────────────────
  const clients = [
    { id: 1, name: 'Juan dela Cruz' },
    { id: 2, name: 'Maria Santos' },
    { id: 3, name: 'Pedro Reyes' },
    { id: 4, name: 'Ana Gonzales' },
    { id: 5, name: 'Jose Bautista' },
    { id: 6, name: 'Liza Mendoza' },
    { id: 7, name: 'Carlo Villanueva' },
    { id: 8, name: 'Rosa Aquino' },
    { id: 9, name: 'Ernesto Soriano' },
    { id: 10, name: 'Teresita Ramos' },
  ]
  await upsert('clients', clients)

  // ── Client Accounts ──────────────────────────────────────────
  const clientAccounts = [
    { id: 1,  client_id: 1,  account_number: 'ACC-2025-0001' },
    { id: 2,  client_id: 1,  account_number: 'ACC-2025-0002' },
    { id: 3,  client_id: 2,  account_number: 'ACC-2025-0003' },
    { id: 4,  client_id: 3,  account_number: 'ACC-2025-0004' },
    { id: 5,  client_id: 4,  account_number: 'ACC-2025-0005' },
    { id: 6,  client_id: 5,  account_number: 'ACC-2025-0006' },
    { id: 7,  client_id: 6,  account_number: 'ACC-2025-0007' },
    { id: 8,  client_id: 7,  account_number: 'ACC-2025-0008' },
    { id: 9,  client_id: 8,  account_number: 'ACC-2025-0009' },
    { id: 10, client_id: 9,  account_number: 'ACC-2025-0010' },
    { id: 11, client_id: 10, account_number: 'ACC-2025-0011' },
    { id: 12, client_id: 1,  account_number: 'ACC-2026-0001' },
    { id: 13, client_id: 2,  account_number: 'ACC-2026-0002' },
  ]
  await upsert('client_accounts', clientAccounts)

  // ── Transmittals ─────────────────────────────────────────────
  const transmittals = [
    { id: 1,  client_id: 1,  client_account_id: 1,  branch_id: 1, date_released: '2025-01-15', documents_transmitted: 'Original ORCR - Motorcycle',       purpose: 'For client release',             date_transmitted: '2025-01-10', received_by: 'Juan dela Cruz',       remarks: null },
    { id: 2,  client_id: 2,  client_account_id: 3,  branch_id: 2, date_released: '2025-01-20', documents_transmitted: 'Deed of Sale - Vehicle',           purpose: 'For notarization',               date_transmitted: '2025-01-18', received_by: 'THRU LBC',             remarks: 'Document was difficult to locate in archives.' },
    { id: 3,  client_id: 3,  client_account_id: 4,  branch_id: 3, date_released: '2025-02-03', documents_transmitted: 'Insurance Certificate',            purpose: 'Client request',                 date_transmitted: '2025-01-30', received_by: 'Pedro Reyes',          remarks: null },
    { id: 4,  client_id: 4,  client_account_id: 5,  branch_id: 1, date_released: '2025-02-10', documents_transmitted: 'Original Car Title (TCT)',         purpose: 'For bank loan release',          date_transmitted: '2025-02-05', received_by: 'Ana Gonzales',         remarks: null },
    { id: 5,  client_id: 5,  client_account_id: 6,  branch_id: 4, date_released: '2025-02-15', documents_transmitted: 'Chattel Mortgage Agreement',       purpose: 'For financing compliance',       date_transmitted: '2025-02-12', received_by: 'THRU GRAB COURIER',    remarks: 'Client requested urgent release.' },
    { id: 6,  client_id: 1,  client_account_id: 2,  branch_id: 2, date_released: '2025-03-01', documents_transmitted: 'ORCR Duplicate Copy',             purpose: 'For registration renewal',       date_transmitted: '2025-02-25', received_by: 'Juan dela Cruz',       remarks: null },
    { id: 7,  client_id: 6,  client_account_id: 7,  branch_id: 5, date_released: '2025-03-05', documents_transmitted: 'Insurance Policy Document',       purpose: 'For insurance claim',            date_transmitted: '2025-03-03', received_by: 'Liza Mendoza',         remarks: null },
    { id: 8,  client_id: 7,  client_account_id: 8,  branch_id: 6, date_released: '2025-03-12', documents_transmitted: 'Vehicle Sales Invoice',           purpose: 'For LTO registration',           date_transmitted: '2025-03-10', received_by: 'Carlo Villanueva',     remarks: 'Document had a discrepancy in date. Noted in remarks.' },
    { id: 9,  client_id: 8,  client_account_id: 9,  branch_id: 7, date_released: '2025-04-02', documents_transmitted: 'Deed of Chattel Mortgage',        purpose: 'For client file completion',     date_transmitted: '2025-03-28', received_by: 'Rosa Aquino',          remarks: null },
    { id: 10, client_id: 2,  client_account_id: 3,  branch_id: 2, date_released: '2025-04-15', documents_transmitted: 'Original ORCR - Honda City',      purpose: 'For registration renewal',       date_transmitted: '2025-04-10', received_by: 'Maria Santos',         remarks: null },
    { id: 11, client_id: 9,  client_account_id: 10, branch_id: 8, date_released: '2025-05-07', documents_transmitted: 'Insurance Certificate - Renewal', purpose: 'Client follow-up request',       date_transmitted: '2025-05-05', received_by: 'THRU LBC',             remarks: null },
    { id: 12, client_id: 10, client_account_id: 11, branch_id: 1, date_released: '2025-05-20', documents_transmitted: 'Vehicle Inspection Report',       purpose: 'For compliance audit',           date_transmitted: '2025-05-15', received_by: 'Teresita Ramos',       remarks: 'Had to request copy from inspecting office.' },
    { id: 13, client_id: 1,  client_account_id: 12, branch_id: 1, date_released: '2025-06-01', documents_transmitted: 'Original ORCR - Toyota Vios',     purpose: 'For resale transfer',            date_transmitted: '2025-05-28', received_by: 'THRU GRAB COURIER',    remarks: null },
    { id: 14, client_id: 3,  client_account_id: 4,  branch_id: 3, date_released: '2025-06-10', documents_transmitted: 'Chattel Mortgage - Motorcycle',   purpose: 'For financing release',          date_transmitted: '2025-06-07', received_by: 'Pedro Reyes',          remarks: null },
    { id: 15, client_id: 2,  client_account_id: 13, branch_id: 2, date_released: '2025-07-01', documents_transmitted: 'Deed of Sale - Honda Click 125i', purpose: 'Client request',                 date_transmitted: '2025-06-28', received_by: 'Maria Santos',         remarks: null },
    { id: 16, client_id: 4,  client_account_id: 5,  branch_id: 1, date_released: '2025-07-15', documents_transmitted: 'Sales Invoice - Vehicle',         purpose: 'For LTO transfer of ownership',  date_transmitted: '2025-07-12', received_by: 'Ana Gonzales',         remarks: null },
    { id: 17, client_id: 5,  client_account_id: 6,  branch_id: 4, date_released: '2025-08-01', documents_transmitted: 'Insurance Certificate',           purpose: 'For annual renewal',             date_transmitted: '2025-07-29', received_by: 'Jose Bautista',        remarks: null },
    { id: 18, client_id: 6,  client_account_id: 7,  branch_id: 5, date_released: '2025-08-10', documents_transmitted: 'Original ORCR - Suzuki Raider',   purpose: 'For resale',                     date_transmitted: '2025-08-07', received_by: 'THRU LBC',             remarks: null },
    { id: 19, client_id: 7,  client_account_id: 8,  branch_id: 6, date_released: '2025-09-03', documents_transmitted: 'Deed of Chattel Mortgage',        purpose: 'For bank submission',            date_transmitted: '2025-09-01', received_by: 'Carlo Villanueva',     remarks: null },
    { id: 20, client_id: 8,  client_account_id: 9,  branch_id: 7, date_released: '2025-09-20', documents_transmitted: 'ORCR - Yamaha Mio',               purpose: 'For registration renewal',       date_transmitted: '2025-09-17', received_by: 'Rosa Aquino',          remarks: 'ORCR was initially missing. Retrieved from storage.' },
  ]
  await upsert('transmittals', transmittals)

  // Set reference numbers
  await setRefNumbers('transmittals', 'TRN')

  // ── Borrowed Items ───────────────────────────────────────────
  const borrowedItems = [
    { id: 1,  client_id: 1,  client_account_id: 1,  branch_id: 1, date_released: '2025-02-01', documents_items: 'Duplicate Key',             purpose: 'For duplication',   additional_details: 'Honda Click 125i',      borrowing_reason: 'Client needs spare key made',          date_returned: null,         status: 'Borrowed',  remarks: null },
    { id: 2,  client_id: 2,  client_account_id: 3,  branch_id: 2, date_released: '2025-02-15', documents_items: 'Original ORCR',             purpose: 'For LTO renewal',   additional_details: 'Toyota Vios 2022',      borrowing_reason: 'Needed for annual registration',       date_returned: '2025-03-10', status: 'Returned',  remarks: 'Returned in good condition.' },
    { id: 3,  client_id: 3,  client_account_id: 4,  branch_id: 3, date_released: '2025-03-01', documents_items: 'Chattel Mortgage Document', purpose: 'For refinancing',   additional_details: null,                    borrowing_reason: 'Client applying for re-financing',     date_returned: '2025-04-05', status: 'Returned',  remarks: null },
    { id: 4,  client_id: 4,  client_account_id: 5,  branch_id: 1, date_released: '2025-03-20', documents_items: 'Insurance Policy',          purpose: 'For claims filing', additional_details: 'Mitsubishi Montero',    borrowing_reason: 'Filing insurance claim with provider', date_returned: null,         status: 'Borrowed',  remarks: null },
    { id: 5,  client_id: 5,  client_account_id: 6,  branch_id: 4, date_released: '2025-04-01', documents_items: 'Duplicate Key',             purpose: 'For duplication',   additional_details: 'Yamaha Mio 2023',       borrowing_reason: 'Lost original key, needs replacement', date_returned: '2025-04-20', status: 'Returned',  remarks: 'Returned after key duplication completed.' },
    { id: 6,  client_id: 6,  client_account_id: 7,  branch_id: 5, date_released: '2025-04-10', documents_items: 'Original ORCR',             purpose: 'For loan processing',additional_details: 'Honda CBR 150R',        borrowing_reason: 'Bank requirement for additional loan', date_returned: null,         status: 'Borrowed',  remarks: 'Bank still processing the loan.' },
    { id: 7,  client_id: 7,  client_account_id: 8,  branch_id: 6, date_released: '2025-05-01', documents_items: 'Deed of Sale',              purpose: 'For notarization',  additional_details: null,                    borrowing_reason: 'Needs notarized copy for LTO',         date_returned: '2025-05-25', status: 'Returned',  remarks: null },
    { id: 8,  client_id: 8,  client_account_id: 9,  branch_id: 7, date_released: '2025-05-15', documents_items: 'Duplicate Key',             purpose: 'For duplication',   additional_details: 'Suzuki Raider R150',    borrowing_reason: 'Requesting spare key',                 date_returned: '2025-06-01', status: 'Returned',  remarks: null },
    { id: 9,  client_id: 9,  client_account_id: 10, branch_id: 8, date_released: '2025-06-01', documents_items: 'Insurance Certificate',     purpose: 'For claim',         additional_details: null,                    borrowing_reason: 'Vehicle involved in minor accident',   date_returned: null,         status: 'Borrowed',  remarks: 'Insurance company investigating.' },
    { id: 10, client_id: 1,  client_account_id: 2,  branch_id: 1, date_released: '2025-06-10', documents_items: 'Original ORCR',             purpose: 'For resale',        additional_details: 'Honda City 2021',       borrowing_reason: 'Client selling vehicle',               date_returned: null,         status: 'Borrowed',  remarks: 'Waiting for buyer to complete payment.' },
    { id: 11, client_id: 10, client_account_id: 11, branch_id: 1, date_released: '2025-07-01', documents_items: 'Chattel Mortgage Agreement', purpose: 'For bank audit',   additional_details: null,                    borrowing_reason: 'Bank requiring original documents',    date_returned: '2025-07-20', status: 'Returned',  remarks: null },
    { id: 12, client_id: 2,  client_account_id: 13, branch_id: 2, date_released: '2025-07-15', documents_items: 'Duplicate Key',             purpose: 'For duplication',   additional_details: 'Yamaha NMAX 155',       borrowing_reason: 'Second key for family member',         date_returned: '2025-08-01', status: 'Returned',  remarks: null },
  ]
  await upsert('borrowed_items', borrowedItems)
  await setRefNumbers('borrowed_items', 'BRW')

  // ── Follow-ups ───────────────────────────────────────────────
  const followUps = [
    { id: 1,  transmittal_id: 2,  borrowed_item_id: null, follow_up_date: '2025-02-01', subject: 'Follow-up: ORCR for Maria Santos',        details: 'Branch contacted client. Client confirmed LBC delivery received.',                          status: 'Resolved', resolved_date: '2025-02-05', remarks: null },
    { id: 2,  transmittal_id: 5,  borrowed_item_id: null, follow_up_date: '2025-03-01', subject: 'Urgent: Chattel Mortgage not yet received', details: 'Branch reported client has not received document. Re-sent via courier.',                    status: 'Resolved', resolved_date: '2025-03-10', remarks: 'Re-sent via GRAB COURIER.' },
    { id: 3,  transmittal_id: 8,  borrowed_item_id: null, follow_up_date: '2025-04-01', subject: 'Date discrepancy on Sales Invoice',        details: 'Branch verified discrepancy. Correction memo being prepared by Admin.',                     status: 'Open',     resolved_date: null,         remarks: null },
    { id: 4,  transmittal_id: 12, borrowed_item_id: null, follow_up_date: '2025-06-01', subject: 'Compliance audit document pending',        details: 'Teresita Ramos branch has not confirmed receipt. Branch to follow up.',                      status: 'Pending',  resolved_date: null,         remarks: null },
    { id: 5,  transmittal_id: 2,  borrowed_item_id: null, follow_up_date: '2025-04-20', subject: 'Second follow-up: Deed of Sale delivery',  details: 'LBC tracking shows delivered. Waiting for client confirmation.',                           status: 'Resolved', resolved_date: '2025-04-25', remarks: null },
    { id: 6,  transmittal_id: 15, borrowed_item_id: null, follow_up_date: '2025-07-05', subject: 'Follow-up: Honda Click ORCR release',      details: 'Client requested status update on document. Branch to coordinate with LTO.',                 status: 'Pending',  resolved_date: null,         remarks: null },
    { id: 7,  transmittal_id: 20, borrowed_item_id: null, follow_up_date: '2025-10-01', subject: 'Missing ORCR - Yamaha Mio follow-up',      details: 'ORCR retrieved from storage. Client to be notified for pickup.',                           status: 'Open',     resolved_date: null,         remarks: 'ORCR recovered from old filing cabinet.' },
    { id: 8,  transmittal_id: 11, borrowed_item_id: null, follow_up_date: '2025-05-15', subject: 'Insurance renewal confirmation',           details: 'Branch confirmed client received certificate. No further action needed.',                    status: 'Resolved', resolved_date: '2025-05-20', remarks: null },
    { id: 9,  transmittal_id: null, borrowed_item_id: 1,  follow_up_date: '2025-02-10', subject: 'Duplicate key status: Honda Click 125i',   details: 'Branch followed up with client. Key duplication still pending at local shop.',              status: 'Pending',  resolved_date: null,         remarks: null },
    { id: 10, transmittal_id: null, borrowed_item_id: 1,  follow_up_date: '2025-03-01', subject: 'Second follow-up: Honda Click key',        details: 'Client confirmed key duplication done. Returning next week.',                              status: 'Open',     resolved_date: null,         remarks: null },
    { id: 11, transmittal_id: null, borrowed_item_id: 4,  follow_up_date: '2025-04-05', subject: 'Insurance claim: Mitsubishi Montero',      details: 'Insurance company requested additional documents. Branch to advise client.',                 status: 'Pending',  resolved_date: null,         remarks: null },
    { id: 12, transmittal_id: null, borrowed_item_id: 6,  follow_up_date: '2025-05-01', subject: 'Bank loan status: Honda CBR',              details: 'Branch informed Admin that bank is still processing. ETA 2 more weeks.',                    status: 'Pending',  resolved_date: null,         remarks: null },
    { id: 13, transmittal_id: null, borrowed_item_id: 6,  follow_up_date: '2025-06-01', subject: 'Second follow-up: Honda CBR loan',         details: 'Bank denied additional loan. Client to return ORCR immediately.',                          status: 'Open',     resolved_date: null,         remarks: 'Client informed. Awaiting return.' },
    { id: 14, transmittal_id: null, borrowed_item_id: 9,  follow_up_date: '2025-06-15', subject: 'Insurance claim investigation update',     details: 'Insurance company completed investigation. Settlement being processed.',                     status: 'Pending',  resolved_date: null,         remarks: null },
    { id: 15, transmittal_id: null, borrowed_item_id: 10, follow_up_date: '2025-07-01', subject: 'Resale ORCR: Honda City',                  details: 'Buyer completed payment. Client to return ORCR after deed of sale signing.',               status: 'Pending',  resolved_date: null,         remarks: null },
  ]
  await upsert('follow_ups', followUps)
  await setRefNumbers('follow_ups', 'FUP')

  console.log('\n✅  Seeding complete!')
  console.log('   62 branches')
  console.log('   10 clients  (13 account IDs)')
  console.log('   20 transmittals')
  console.log('   12 borrowed items')
  console.log('   15 follow-ups')
}

// ── Helpers ──────────────────────────────────────────────────

async function upsert(table, rows) {
  process.stdout.write(`   Inserting ${table.padEnd(20)} `)
  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' })
  if (error) {
    console.error(`\n❌  Error inserting ${table}:`, error.message)
    process.exit(1)
  }
  console.log(`→  ${rows.length} rows ✓`)
}

async function setRefNumbers(table, prefix) {
  // Fill any rows missing reference_number (trigger should have set them,
  // but upsert bypasses triggers in some Supabase versions)
  const { data, error } = await supabase.from(table).select('id, reference_number')
  if (error) return
  const updates = data.filter((r) => !r.reference_number).map((r) => ({
    id: r.id,
    reference_number: `${prefix}-${r.id.toString().padStart(5, '0')}`,
  }))
  if (updates.length) {
    for (const u of updates) {
      await supabase.from(table).update({ reference_number: u.reference_number }).eq('id', u.id)
    }
  }
}

seed().catch((err) => {
  console.error('❌  Unexpected error:', err)
  process.exit(1)
})
