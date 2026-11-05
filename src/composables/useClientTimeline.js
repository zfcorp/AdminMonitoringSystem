import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { mergeTimeline } from '../utils/timeline'

/**
 * Composable that loads a client's complete activity timeline
 * by fetching transmittals, borrowed items, and follow-ups, then
 * merging them into a single chronological view.
 *
 * @returns {{ timeline, loading, client, accounts, load }}
 */
export function useClientTimeline() {
  const timeline = ref([])
  const loading = ref(false)
  const client = ref(null)
  const accounts = ref([])

  async function load(clientId) {
    loading.value = true

    // Fetch client info
    const { data: clientData } = await supabase
      .from('clients')
      .select('id, name')
      .eq('id', clientId)
      .single()
    client.value = clientData

    // Fetch accounts
    const { data: accountData } = await supabase
      .from('client_accounts')
      .select('id, account_number')
      .eq('client_id', clientId)
      .order('account_number')
    accounts.value = accountData || []

    // Fetch transmittals
    const { data: transmittals } = await supabase
      .from('transmittals')
      .select('id, reference_number, date_released, documents_transmitted, purpose, client_accounts(account_number)')
      .eq('client_id', clientId)

    // Fetch borrowed items
    const { data: borrowedItems } = await supabase
      .from('borrowed_items')
      .select('id, reference_number, date_released, documents_items, status, date_returned, client_accounts(account_number)')
      .eq('client_id', clientId)

    // Fetch follow-ups linked to this client's records
    const tIds = (transmittals || []).map((t) => t.id)
    const bIds = (borrowedItems || []).map((b) => b.id)

    let followUps = []
    if (tIds.length) {
      const { data } = await supabase
        .from('follow_ups')
        .select('id, reference_number, follow_up_date, subject, status, resolved_date, transmittals(reference_number, client_accounts(account_number))')
        .in('transmittal_id', tIds)
      followUps = followUps.concat(data || [])
    }
    if (bIds.length) {
      const { data } = await supabase
        .from('follow_ups')
        .select('id, reference_number, follow_up_date, subject, status, resolved_date, borrowed_items(reference_number, client_accounts(account_number))')
        .in('borrowed_item_id', bIds)
      followUps = followUps.concat(data || [])
    }

    // Merge into a single sorted timeline
    timeline.value = mergeTimeline(transmittals || [], borrowedItems || [], followUps)
    loading.value = false
  }

  return { timeline, loading, client, accounts, load }
}
