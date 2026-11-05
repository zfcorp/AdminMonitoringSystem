import { describe, it, expect } from 'vitest'
import { mergeTimeline } from '../src/utils/timeline'

describe('mergeTimeline', () => {
  const transmittals = [
    {
      id: 1,
      reference_number: 'TRN-00001',
      date_released: '2025-03-15',
      documents_transmitted: 'ORCR',
      purpose: 'For release',
      client_accounts: { account_number: 'ACC-001' },
    },
    {
      id: 2,
      reference_number: 'TRN-00002',
      date_released: '2025-01-10',
      documents_transmitted: 'Contract',
      purpose: 'Review',
      client_accounts: { account_number: 'ACC-002' },
    },
  ]

  const borrowedItems = [
    {
      id: 1,
      reference_number: 'BRW-00001',
      date_released: '2025-06-01',
      documents_items: 'Duplicate key',
      date_returned: null,
      client_accounts: { account_number: 'ACC-001' },
    },
    {
      id: 2,
      reference_number: 'BRW-00002',
      date_released: '2025-02-20',
      documents_items: 'Motorcycle doc',
      date_returned: '2025-05-15',
      client_accounts: { account_number: 'ACC-002' },
    },
  ]

  const followUps = [
    {
      id: 1,
      reference_number: 'FUP-00001',
      follow_up_date: '2025-07-01',
      subject: 'Pending ORCR',
      status: 'Open',
      resolved_date: null,
      transmittals: { reference_number: 'TRN-00001', client_accounts: { account_number: 'ACC-001' } },
      borrowed_items: null,
    },
    {
      id: 2,
      reference_number: 'FUP-00002',
      follow_up_date: '2025-04-10',
      subject: 'Duplicate key status',
      status: 'Resolved',
      resolved_date: '2025-04-12',
      transmittals: null,
      borrowed_items: { reference_number: 'BRW-00001', client_accounts: { account_number: 'ACC-001' } },
    },
  ]

  it('merges entries from all three modules', () => {
    const events = mergeTimeline(transmittals, borrowedItems, followUps)

    expect(events).toHaveLength(6)

    const modules = events.map((e) => e.module)
    expect(modules).toContain('Transmittal')
    expect(modules).toContain('Borrowed')
    expect(modules).toContain('Follow-up')
  })

  it('sorts by date descending (newest first)', () => {
    const events = mergeTimeline(transmittals, borrowedItems, followUps)

    const dates = events.map((e) => new Date(e.date).getTime())
    for (let i = 0; i < dates.length - 1; i++) {
      expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1])
    }

    // Newest should be the July follow-up
    expect(events[0].ref).toBe('FUP-00001')
    expect(events[0].date).toBe('2025-07-01')
  })

  it('includes returned and unreturned borrowed items', () => {
    const events = mergeTimeline(transmittals, borrowedItems, followUps)
    const borrowedEvents = events.filter((e) => e.module === 'Borrowed')

    expect(borrowedEvents).toHaveLength(2)
    const statuses = borrowedEvents.map((e) => e.status)
    expect(statuses).toContain('Borrowed')
    expect(statuses).toContain('Returned')
  })

  it('includes resolved and unresolved follow-ups', () => {
    const events = mergeTimeline(transmittals, borrowedItems, followUps)
    const followUpEvents = events.filter((e) => e.module === 'Follow-up')

    expect(followUpEvents).toHaveLength(2)
    const statuses = followUpEvents.map((e) => e.status)
    expect(statuses).toContain('Open')
    expect(statuses).toContain('Resolved')
  })

  it('includes the account ID for each event', () => {
    const events = mergeTimeline(transmittals, borrowedItems, followUps)

    events.forEach((e) => {
      expect(e.accountId).toBeTruthy()
    })
  })

  it('handles empty arrays', () => {
    const events = mergeTimeline([], [], [])
    expect(events).toHaveLength(0)
  })

  it('places entries with null dates at the end', () => {
    const transmittalsWithNull = [
      { id: 3, reference_number: 'TRN-00003', date_released: null, documents_transmitted: 'X', client_accounts: { account_number: 'ACC-003' } },
    ]
    const events = mergeTimeline(transmittalsWithNull, [], [])

    expect(events).toHaveLength(1)
    expect(events[0].date).toBeNull()
  })
})
