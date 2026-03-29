import { NextRequest, NextResponse } from 'next/server'

const WINDSOR_API_KEY = process.env.WINDSOR_API_KEY ?? ''
const WINDSOR_BASE = 'https://connectors.windsor.ai'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const connector = searchParams.get('connector') ?? 'facebook'
  const fields = searchParams.get('fields') ?? ''
  const datePreset = searchParams.get('date_preset') ?? 'last_90d'
  const accountName = searchParams.get('account_name') ?? ''

  if (!WINDSOR_API_KEY) {
    return NextResponse.json({ error: 'Windsor API key not configured' }, { status: 500 })
  }

  const params = new URLSearchParams({
    api_key: WINDSOR_API_KEY,
    fields,
    date_preset: datePreset,
  })

  // Filter by account name if provided
  if (accountName) {
    params.set('filter', JSON.stringify([['account_name', 'eq', accountName]]))
  }

  const url = `${WINDSOR_BASE}/${connector}?${params.toString()}`

  try {
    const res = await fetch(url)
    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `Windsor API error: ${res.status}`, detail: text }, { status: res.status })
    }
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch from Windsor', detail: String(err) }, { status: 500 })
  }
}
