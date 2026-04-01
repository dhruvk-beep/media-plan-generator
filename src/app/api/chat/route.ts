import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@/lib/auth'
import { logActivity } from '@/lib/activity-log'

export const maxDuration = 60

const SYSTEM_PROMPT = `You are an expert performance marketing strategist for Indian D2C e-commerce brands, embedded inside a media plan generator tool.

You have two roles:
1. ANSWER questions about the current plan — explain why numbers look a certain way, flag risks, suggest improvements
2. EXECUTE changes — when the user wants to modify the plan, return the exact field changes needed

IMPORTANT RESPONSE FORMAT:
- Always respond naturally in text first (brief, 2-4 sentences max)
- If the user wants to CHANGE something, end your response with a JSON block wrapped in <changes> tags:

<changes>
{"fieldName": newValue, "anotherField": newValue}
</changes>

AVAILABLE FIELDS YOU CAN CHANGE:
- brandName (string)
- industry: "fashion"|"skincare"|"fmcg"|"accessories"|"health"|"electronics"|"education"|"jewelry"|"lifestyle"
- brandType: "existing"|"preLaunch"|"vcBacked"
- quarter: "Q1"|"Q2"|"Q3"|"Q4"
- monthlyRevenue (number, INR)
- monthlyAdSpend (number, INR)
- aov (number, INR)
- grossMargin (0-1)
- currentRoas (number or null)
- monthlyTraffic (number or null)
- emailListSize (number)
- skuCount (number)
- repeatPurchaseRate (0-1)
- avgDiscount (0-1)
- pixelMaturity: "fresh"|"learning"|"mature"
- creativeCapacity: "low"|"medium"|"high"
- inventoryValue (number or null)
- spendGrowthRate (1.0-1.6)
- platformSplitOverride: {"meta": 0-1, "google": 0-1} or null (must sum to 1.0)

RULES:
- For platform split: "40:60 Meta:Google" → platformSplitOverride: {"meta": 0.4, "google": 0.6}
- For ROAS targets: adjust currentRoas (plan projects growth from there)
- For "scale aggressively": increase spendGrowthRate to 1.4-1.5
- For "more conservative": decrease spendGrowthRate to 1.0-1.1
- You can change multiple fields at once
- If the user just asks a question (no change needed), respond with text only — NO <changes> block
- Keep responses concise. This is a working tool, not a report.
- Use ₹ for INR amounts, format large numbers in lakhs (L) or crores (Cr)
- Reference specific months (M1/M2/M3), campaigns, or metrics from the plan when relevant`

export async function POST(req: NextRequest) {
  const { messages, currentInputs, currentPlan } = await req.json()

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Anthropic API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const anthropic = new Anthropic({ apiKey })

  const planContext = buildPlanContext(currentInputs, currentPlan)

  const apiMessages: { role: 'user' | 'assistant'; content: string }[] = []
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (i === 0 && msg.role === 'user') {
      apiMessages.push({
        role: 'user',
        content: `CURRENT PLAN STATE:\n${planContext}\n\n---\n\nUser: ${msg.content}`,
      })
    } else {
      apiMessages.push({ role: msg.role, content: msg.content })
    }
  }

  if (messages.length > 2) {
    const lastIdx = apiMessages.length - 1
    if (apiMessages[lastIdx].role === 'user') {
      apiMessages[lastIdx].content = `[Updated plan state]\n${planContext}\n\n---\n\n${apiMessages[lastIdx].content}`
    }
  }

  // Log chat message (fire-and-forget, never blocks the response)
  auth().then(session => {
    if (session?.user) {
      const lastMsg = messages[messages.length - 1]
      logActivity(session.user.email ?? '', session.user.name ?? '', 'chat_message', {
        message: lastMsg?.content?.slice(0, 500),
        conversationLength: messages.length,
        fullConversation: messages.map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content.slice(0, 500),
        })),
        brandName: currentInputs?.brandName,
      })
    }
  }).catch(() => {})

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: apiMessages,
      stream: true,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of response) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`))
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

function buildPlanContext(inputs: Record<string, unknown>, plan: Record<string, unknown> | null): string {
  if (!plan) return `Inputs: ${JSON.stringify(inputs, null, 2)}\n\nNo plan generated yet.`

  const p = plan as Record<string, unknown>
  const proj = p.projection as Record<string, unknown>[]
  const scenarios = p.scenarios as { type: string; projection: Record<string, unknown>[] }[]
  const meta = p.metaCampaigns as Record<string, unknown>[]
  const google = p.googleCampaigns as Record<string, unknown>[]

  let ctx = `BRAND: ${p.brand} | ${p.industry} | Stage ${p.stage} | ${p.quarter} | ${p.brandType}\n`
  ctx += `SPLIT: Meta ${Math.round((p.platformSplit as { meta: number }).meta * 100)}% / Google ${Math.round((p.platformSplit as { google: number }).google * 100)}%\n`
  ctx += `EFFECTIVE AOV: ₹${p.effectiveAOV} | SUSTAINABLE CPA: ₹${Math.round(p.sustainableCPA as number)} | LTV MULTIPLIER: ${(p.ltvMultiplier as number).toFixed(1)}x\n\n`

  ctx += `3-MONTH PROJECTION:\n`
  for (const m of proj) {
    ctx += `  M${m.month}: Spend ₹${Math.round(m.totalSpend as number).toLocaleString('en-IN')} → Revenue ₹${Math.round(m.totalRevenue as number).toLocaleString('en-IN')} | ROAS ${(m.roas as number).toFixed(2)}x | CPA ₹${Math.round(m.cpa as number)} (${m.cpaStatus}) | ${m.purchases} orders\n`
  }

  ctx += `\nSCENARIOS:\n`
  for (const s of scenarios) {
    const m3 = s.projection[2]
    ctx += `  ${s.type}: M3 ROAS ${(m3.roas as number).toFixed(2)}x, CPA ₹${Math.round(m3.cpa as number)}, Revenue ₹${Math.round(m3.totalRevenue as number).toLocaleString('en-IN')}\n`
  }

  ctx += `\nMETA CAMPAIGNS:\n`
  for (const c of meta) {
    const months = c.months as Record<string, unknown>[]
    ctx += `  ${c.campaign} (${c.funnel}, ${Math.round((c.budgetPct as number) * 100)}%): M1 ROAS ${(months[0].roas as number).toFixed(1)}x → M3 ${(months[2].roas as number).toFixed(1)}x\n`
  }

  ctx += `\nGOOGLE CAMPAIGNS:\n`
  for (const c of google) {
    const months = c.months as Record<string, unknown>[]
    ctx += `  ${c.campaign}: M1 ROAS ${(months[0].roas as number).toFixed(1)}x → M3 ${(months[2].roas as number).toFixed(1)}x\n`
  }

  const warnings = p.warnings as string[]
  if (warnings.length > 0) {
    ctx += `\nWARNINGS:\n`
    for (const w of warnings) ctx += `  - ${w}\n`
  }

  ctx += `\nPIXEL STRATEGY: ${p.pixelStrategy}\n`
  ctx += `\nINPUTS:\n${JSON.stringify(inputs, null, 2)}`

  return ctx
}
