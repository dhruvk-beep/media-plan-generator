export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

const WINDSOR_API_KEY = process.env.WINDSOR_API_KEY ?? ''
const WINDSOR_BASE = 'https://connectors.windsor.ai'

export async function GET() {
  if (!WINDSOR_API_KEY) {
    return NextResponse.json({ error: 'Windsor API key not configured' }, { status: 500 })
  }

  try {
    // Fetch recent data from each connector to discover accounts
    const [fbRes, gaRes] = await Promise.all([
      fetch(`${WINDSOR_BASE}/facebook?api_key=${WINDSOR_API_KEY}&date_preset=last_7d&fields=account_name`).catch(() => null),
      fetch(`${WINDSOR_BASE}/google_ads?api_key=${WINDSOR_API_KEY}&date_preset=last_7d&fields=account_name`).catch(() => null),
    ])

    const accounts: { connector: string; id: string; name: string }[] = []
    const seen = new Set<string>()

    // Extract unique Facebook account names
    if (fbRes?.ok) {
      const fbData = await fbRes.json()
      if (fbData?.data) {
        for (const row of fbData.data) {
          const name = row.account_name
          if (name && !seen.has(`fb:${name}`)) {
            seen.add(`fb:${name}`)
            accounts.push({ connector: 'facebook', id: name, name })
          }
        }
      }
    }

    // Extract unique Google Ads account names
    if (gaRes?.ok) {
      const gaData = await gaRes.json()
      if (gaData?.data) {
        for (const row of gaData.data) {
          const name = row.account_name
          if (name && !seen.has(`ga:${name}`)) {
            seen.add(`ga:${name}`)
            accounts.push({ connector: 'google_ads', id: name, name })
          }
        }
      }
    }

    return NextResponse.json({ accounts })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch accounts', detail: String(err) }, { status: 500 })
  }
}
