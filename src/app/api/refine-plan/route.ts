import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })

export async function POST(req: NextRequest) {
  const { feedback, currentInputs } = await req.json()

  if (!feedback || !currentInputs) {
    return NextResponse.json({ error: 'Feedback and current inputs are required' }, { status: 400 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 })
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are a performance marketing strategist for Indian D2C brands. The user wants to adjust their media plan.

Current plan inputs:
${JSON.stringify(currentInputs, null, 2)}

User says: "${feedback}"

Interpret what they want and return a JSON object with the fields to change. You can change ANY of these fields:

BRAND & BASICS:
- brandName (string)
- industry: "fashion"|"skincare"|"fmcg"|"accessories"|"health"|"electronics"|"education"|"jewelry"|"lifestyle"
- brandType: "existing"|"preLaunch"|"vcBacked"
- quarter: "Q1"|"Q2"|"Q3"|"Q4"

FINANCIALS:
- monthlyRevenue (number, INR)
- monthlyAdSpend (number, INR)
- aov (number, INR)
- grossMargin (0-1, e.g. 0.55 = 55%)
- currentRoas (number or null)

BRAND INTELLIGENCE:
- monthlyTraffic (number or null)
- emailListSize (number)
- skuCount (number)
- repeatPurchaseRate (0-1)
- avgDiscount (0-1)
- pixelMaturity: "fresh"|"learning"|"mature"
- creativeCapacity: "low"|"medium"|"high"
- inventoryValue (number or null)

GROWTH & STRATEGY:
- spendGrowthRate (1.0-1.6, e.g. 1.3 = 30%/mo growth)
- platformSplitOverride: { "meta": 0-1, "google": 0-1 } or null (meta+google must equal 1.0)

IMPORTANT RULES:
- platformSplitOverride controls Meta vs Google budget split. e.g. "40% Meta 60% Google" → { "meta": 0.4, "google": 0.6 }
- If they say "more Google" without a specific number, shift 15-20% toward Google from current split
- If they give a target ROAS, adjust currentRoas to that value (the plan will project growth from there)
- If they say "scale aggressively", increase spendGrowthRate to 1.4-1.5
- If they mention specific spend amounts, update monthlyAdSpend
- You can change multiple fields at once if the feedback implies it

Return ONLY valid JSON:
{
  "changes": { ...only fields that need to change... },
  "reasoning": "1-2 sentence explanation of what you changed"
}`
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      return NextResponse.json({ error: 'Could not parse response' }, { status: 500 })
    }

    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json(parsed)
  } catch (err) {
    console.error('Refine error:', err)
    return NextResponse.json({ error: 'Failed to process feedback', detail: String(err) }, { status: 500 })
  }
}
