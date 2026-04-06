import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 })
  }

  const text = await file.text()
  // Send first 500 lines max to Claude (enough to understand structure + get data)
  const lines = text.split('\n')
  const csvPreview = lines.slice(0, 500).join('\n')

  const anthropic = new Anthropic({ apiKey })

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `You are a data analyst. Parse this CSV export and extract advertising/e-commerce metrics.

FILE NAME: ${file.name}
FILE SIZE: ${lines.length} rows

CSV CONTENT (first 500 rows):
${csvPreview}

STEP 1: Identify the platform. Is this from:
- Meta Ads (Facebook/Instagram) — columns like Campaign Name, Amount Spent, Impressions, Clicks, Results, ROAS, Reach, Frequency
- Google Ads — columns like Campaign, Cost, Clicks, Impressions, Conversions, Conv. value
- Shopify — columns like Order, Total, Subtotal, Discount, Product, Customer, Returning customer
- Other / Unknown

STEP 2: Map columns to standard metrics and aggregate across all rows/campaigns.

STEP 3: Return ONLY valid JSON:

{
  "platform": "meta" | "google_ads" | "shopify" | "unknown",
  "dateRange": "e.g. Jan 2026 - Mar 2026 or unknown",
  "totalRows": number,

  "metrics": {
    "totalSpend": number or null (in INR),
    "totalRevenue": number or null (in INR),
    "totalOrders": number or null,
    "totalImpressions": number or null,
    "totalClicks": number or null,
    "blendedRoas": number or null,
    "avgCpm": number or null,
    "avgCpc": number or null,
    "avgCtr": number or null (as decimal, e.g. 0.02),
    "avgConvRate": number or null (as decimal),
    "avgCpa": number or null,
    "avgFrequency": number or null,
    "avgAov": number or null (revenue / orders)
  },

  "shopifyMetrics": {
    "totalOrders": number or null,
    "totalRevenue": number or null,
    "avgAov": number or null,
    "avgDiscount": number or null (as decimal, 0-1),
    "totalProducts": number or null (unique product count),
    "repeatCustomerRate": number or null (as decimal, 0-1),
    "topProducts": ["product name 1", "product name 2"] or null
  } | null,

  "campaigns": [
    {
      "name": "campaign name",
      "spend": number,
      "revenue": number,
      "roas": number,
      "type": "campaign type/objective if known"
    }
  ] | null,

  "columnMapping": {
    "originalColumn": "mappedTo"
  },

  "warnings": ["any data quality issues"],
  "summary": "1-2 sentence summary of what this data shows"
}

IMPORTANT:
- If currency is in INR, use as-is. If USD, note it in warnings.
- Aggregate ALL rows to get totals, don't just sample.
- For percentages stored as "2.5%", convert to decimal (0.025).
- If a metric can't be determined, use null.
- For Shopify, calculate repeat customer rate from unique customer emails/IDs.`
      }],
    })

    const text2 = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text2.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      return NextResponse.json({ error: 'Could not parse CSV data', raw: text2 }, { status: 500 })
    }

    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json(parsed)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to parse CSV', detail: String(err) }, { status: 500 })
  }
}
