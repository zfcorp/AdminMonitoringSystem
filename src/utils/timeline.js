/**
 * Merges transmittals, borrowed items, and follow-ups into a single
 * chronological timeline array sorted by date descending (newest first).
 *
 * Each event is normalized to a common shape:
 * { date, module, ref, accountId, description, status, recordId, recordType }
 *
 * @param {array} transmittals - from supabase with client_accounts joined
 * @param {array} borrowedItems - from supabase with client_accounts joined
 * @param {array} followUps - from supabase with parent + client_accounts joined
 * @returns {array} sorted timeline events
 */
export function mergeTimeline(transmittals = [], borrowedItems = [], followUps = []) {
  const events = []

  transmittals.forEach((t) => {
    events.push({
      date: t.date_released,
      module: 'Transmittal',
      ref: t.reference_number,
      accountId: t.client_accounts?.account_number,
      description: t.documents_transmitted || t.purpose || '',
      status: '',
      recordId: t.id,
      recordType: 'transmittal',
    })
  })

  borrowedItems.forEach((b) => {
    events.push({
      date: b.date_released,
      module: 'Borrowed',
      ref: b.reference_number,
      accountId: b.client_accounts?.account_number,
      description: b.documents_items || '',
      status: b.date_returned ? 'Returned' : 'Borrowed',
      recordId: b.id,
      recordType: 'borrowed',
    })
  })

  followUps.forEach((f) => {
    const parent = f.transmittals || f.borrowed_items
    events.push({
      date: f.follow_up_date,
      module: 'Follow-up',
      ref: f.reference_number,
      accountId: parent?.client_accounts?.account_number,
      description: f.subject || '',
      status: f.resolved_date ? 'Resolved' : f.status || 'Open',
      recordId: f.id,
      recordType: 'followup',
    })
  })

  // Sort by date descending (newest first); nulls go to the end
  events.sort((a, b) => {
    const timeA = a.date ? new Date(a.date).getTime() : 0
    const timeB = b.date ? new Date(b.date).getTime() : 0
    return timeB - timeA
  })

  return events
}
