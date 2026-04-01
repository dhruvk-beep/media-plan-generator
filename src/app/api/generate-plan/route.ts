import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@/lib/auth'
import { logActivity } from '@/lib/activity-log'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })
const WINDSOR_API_KEY = process.env.WINDSOR_API_KEY ?? ''
const WINDSOR_BASE = 'https://connectors.windsor.ai'

// Orchestration endpoint: chains Windsor + Site Crawl + Claude Analysis
// into a single call that returns all auto-populated plan inputs

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { siteUrl, metaAccountId, googleAccountId } = body as {
    siteUrl?: string
    metaAccountId?: string
    googleAccountId?: string
  }

  if (!siteUrl && !metaAccountId && !googleAccountId) {
    return NextResponse.json({ error: 'Provide at least a website URL or ad account' }, { status: 400 })
  }

  try {
    // Run Windsor + Site Analysis in parallel
    const [windsorData, siteData] = await Promise.all([
      (metaAccountId || googleAccountId) ? fetchWindsorData(metaAccountId, googleAccountId) : null,
      siteUrl ? fetchSiteAnalysis(siteUrl) : null,
    ])

    // Claude synthesizes all data and recommends growth strategy
    const recommendation = await getClaudeRecommendation(siteData, windsorData)

    // Log activity
    const session = await auth()
    if (session?.user) {
      logActivity(session.user.email ?? '', session.user.name ?? '', 'generate_plan', {
        siteUrl, metaAccountId, googleAccountId,
        brandName: siteData?.brandName,
        industry: siteData?.industry,
      })
    }

    return NextResponse.json({
      windsor: windsorData,
      site: siteData,
      recommendation,
    })
  } catch (err) {
    console.error('Generate plan error:', err)
    return NextResponse.json({ error: 'Failed to generate plan', detail: String(err) }, { status: 500 })
  }
}

// ─── Windsor Data Fetch ───

interface WindsorSummary {
  meta: {
    monthlySpend: number
    monthlyRevenue: number
    roas: number
    cpm: number
    cpc: number
    ctr: number
    convRate: number
    cpa: number
    frequency: number
    totalPurchases: number
    weeklyConversions: number
  } | null
  google: {
    monthlySpend: number
    monthlyRevenue: number
    roas: number
    cpc: number
    ctr: number
    convRate: number
  } | null
  blended: {
    monthlySpend: number
    monthlyRevenue: number
    roas: number
    aov: number | null
    platformSplit: { meta: number; google: number }
  }
  inferred: {
    pixelMaturity: 'fresh' | 'learning' | 'mature'
    brandType: 'existing' | 'preLaunch' | 'vcBacked'
  }
}

async function fetchWindsorData(metaAccountId?: string, googleAccountId?: string): Promise<WindsorSummary> {
  const META_FIELDS = 'campaign,campaign_objective,spend,impressions,clicks,cpm,cpc,ctr,actions_purchase,action_values_purchase,frequency,reach'
  const GOOGLE_FIELDS = 'campaign,campaign_type,spend,impressions,clicks,cpc,ctr,conversions,conversion_value'

  const fetches: { platform: 'meta' | 'google'; promise: Promise<Response> }[] = []

  if (metaAccountId) {
    const params = new URLSearchParams({
      api_key: WINDSOR_API_KEY,
      fields: META_FIELDS,
      date_preset: 'last_90d',
      filter: JSON.stringify([['account_name', 'eq', metaAccountId]]),
    })
    fetches.push({
      platform: 'meta',
      promise: fetch(`${WINDSOR_BASE}/facebook?${params}`),
    })
  }

  if (googleAccountId) {
    const params = new URLSearchParams({
      api_key: WINDSOR_API_KEY,
      fields: GOOGLE_FIELDS,
      date_preset: 'last_90d',
      filter: JSON.stringify([['account_name', 'eq', googleAccountId]]),
    })
    fetches.push({
      platform: 'google',
      promise: fetch(`${WINDSOR_BASE}/google_ads?${params}`),
    })
  }

  const responses = await Promise.all(
    fetches.map(async f => {
      try {
        const res = await f.promise
        if (!res.ok) return { platform: f.platform, data: null }
        const json = await res.json()
        return { platform: f.platform, data: json.data ?? null }
      } catch {
        return { platform: f.platform, data: null }
      }
    })
  )

  let metaResult: WindsorSummary['meta'] = null
  let googleResult: WindsorSummary['google'] = null

  for (const r of responses) {
    if (!r.data?.length) continue

    if (r.platform === 'meta') {
      let totalSpend = 0, totalRevenue = 0, totalImpressions = 0
      let totalClicks = 0, totalPurchases = 0, totalFreq = 0, freqCount = 0
      for (const row of r.data) {
        totalSpend += num(row.spend)
        totalRevenue += num(row.action_values_purchase)
        totalImpressions += num(row.impressions)
        totalClicks += num(row.clicks)
        totalPurchases += num(row.actions_purchase)
        const f = num(row.frequency)
        if (f > 0) { totalFreq += f; freqCount++ }
      }
      const weeklyConv = totalPurchases / 13
      metaResult = {
        monthlySpend: Math.round(totalSpend / 3),
        monthlyRevenue: Math.round(totalRevenue / 3),
        roas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
        cpm: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0,
        cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
        ctr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
        convRate: totalClicks > 0 ? totalPurchases / totalClicks : 0,
        cpa: totalPurchases > 0 ? totalSpend / totalPurchases : 0,
        frequency: freqCount > 0 ? totalFreq / freqCount : 0,
        totalPurchases,
        weeklyConversions: Math.round(weeklyConv),
      }
    }

    if (r.platform === 'google') {
      let totalSpend = 0, totalRevenue = 0, totalClicks = 0
      let totalImpressions = 0, totalConversions = 0
      for (const row of r.data) {
        totalSpend += num(row.spend)
        totalRevenue += num(row.conversion_value)
        totalClicks += num(row.clicks)
        totalImpressions += num(row.impressions)
        totalConversions += num(row.conversions)
      }
      googleResult = {
        monthlySpend: Math.round(totalSpend / 3),
        monthlyRevenue: Math.round(totalRevenue / 3),
        roas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
        cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
        ctr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
        convRate: totalClicks > 0 ? totalConversions / totalClicks : 0,
      }
    }
  }

  const metaSpend = metaResult?.monthlySpend ?? 0
  const googleSpend = googleResult?.monthlySpend ?? 0
  const totalSpend = metaSpend + googleSpend
  const metaRevenue = metaResult?.monthlyRevenue ?? 0
  const googleRevenue = googleResult?.monthlyRevenue ?? 0
  const totalRevenue = metaRevenue + googleRevenue
  const totalPurchases = (metaResult?.totalPurchases ?? 0)
  const weeklyConv = metaResult?.weeklyConversions ?? 0

  return {
    meta: metaResult,
    google: googleResult,
    blended: {
      monthlySpend: totalSpend,
      monthlyRevenue: totalRevenue,
      roas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
      aov: totalPurchases > 0 ? Math.round((metaRevenue * 3) / totalPurchases) : null,
      platformSplit: totalSpend > 0
        ? { meta: metaSpend / totalSpend, google: googleSpend / totalSpend }
        : { meta: 0.5, google: 0.5 },
    },
    inferred: {
      pixelMaturity: weeklyConv >= 50 ? 'mature' : weeklyConv >= 10 ? 'learning' : 'fresh',
      brandType: totalSpend > 1000000 && (totalRevenue / totalSpend) < 1.5
        ? 'vcBacked'
        : 'existing',
    },
  }
}

// ─── Site Analysis (reuses the analyze-site logic inline) ───

interface SiteSummary {
  brandName: string | null
  industry: string | null
  skuCount: number | null
  aov: number | null
  avgDiscount: number | null
  grossMargin: number | null
  brandDescription: string | null
  priceRange: { min: number; max: number } | null
}

async function fetchSiteAnalysis(siteUrl: string): Promise<SiteSummary> {
  // Call our own analyze-site endpoint
  // In production, you'd inline this logic, but for now we call the API
  try {
    const baseUrl = typeof process !== 'undefined' && process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'

    const res = await fetch(`${baseUrl}/api/analyze-site`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: siteUrl }),
    })

    if (!res.ok) return { brandName: null, industry: null, skuCount: null, aov: null, avgDiscount: null, grossMargin: null, brandDescription: null, priceRange: null }

    const data = await res.json()
    return {
      brandName: data.brandName ?? null,
      industry: data.industry ?? null,
      skuCount: data.estimatedSkuCount ?? data.sitemapProductCount ?? null,
      aov: data.estimatedAov ?? null,
      avgDiscount: data.estimatedAvgDiscount ?? null,
      grossMargin: data.estimatedGrossMargin ?? null,
      brandDescription: data.brandDescription ?? null,
      priceRange: data.priceRange ?? null,
    }
  } catch {
    return { brandName: null, industry: null, skuCount: null, aov: null, avgDiscount: null, grossMargin: null, brandDescription: null, priceRange: null }
  }
}

// ─── Claude Growth Recommendation ───

interface Recommendation {
  spendGrowthRate: number
  growthReasoning: string
  overallStrategy: string
  warnings: string[]
  confidence: 'high' | 'medium' | 'low'
}

async function getClaudeRecommendation(
  site: SiteSummary | null,
  windsor: WindsorSummary | null,
): Promise<Recommendation> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      spendGrowthRate: 1.2,
      growthReasoning: 'Default moderate growth (Anthropic API key not configured)',
      overallStrategy: 'Configure ANTHROPIC_API_KEY for AI-powered recommendations',
      warnings: [],
      confidence: 'low',
    }
  }

  const prompt = `You are a performance marketing strategist for Indian D2C e-commerce brands.

Based on this data, recommend a monthly spend growth rate and overall strategy. Return ONLY valid JSON.

Brand Data:
${site ? JSON.stringify(site, null, 2) : 'No website data available'}

Ad Performance (last 90 days):
${windsor ? JSON.stringify({
  meta: windsor.meta ? {
    monthlySpend: windsor.meta.monthlySpend,
    roas: Math.round(windsor.meta.roas * 100) / 100,
    cpa: Math.round(windsor.meta.cpa),
    convRate: (windsor.meta.convRate * 100).toFixed(2) + '%',
    cpm: Math.round(windsor.meta.cpm),
    frequency: Math.round(windsor.meta.frequency * 10) / 10,
    weeklyConversions: windsor.meta.weeklyConversions,
    pixelMaturity: windsor.inferred.pixelMaturity,
  } : null,
  google: windsor.google ? {
    monthlySpend: windsor.google.monthlySpend,
    roas: Math.round(windsor.google.roas * 100) / 100,
    convRate: (windsor.google.convRate * 100).toFixed(2) + '%',
  } : null,
  blended: {
    monthlySpend: windsor.blended.monthlySpend,
    monthlyRevenue: windsor.blended.monthlyRevenue,
    roas: Math.round(windsor.blended.roas * 100) / 100,
    aov: windsor.blended.aov,
    platformSplit: windsor.blended.platformSplit,
  },
}, null, 2) : 'No ad data available'}

Return this JSON:
{
  "spendGrowthRate": number between 1.0 and 1.6 (e.g. 1.2 = 20% monthly growth),
  "growthReasoning": "2-3 sentence explanation of why this growth rate",
  "overallStrategy": "2-3 sentence high-level strategy recommendation",
  "warnings": ["any risks or concerns as brief strings"],
  "confidence": "high" | "medium" | "low" (based on data quality)
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      // Clamp growth rate to valid range
      parsed.spendGrowthRate = Math.max(1.0, Math.min(1.6, parsed.spendGrowthRate))
      return parsed as Recommendation
    }
  } catch (err) {
    console.error('Claude recommendation error:', err)
  }

  return {
    spendGrowthRate: 1.2,
    growthReasoning: 'Defaulting to moderate 20% monthly growth',
    overallStrategy: 'Could not generate AI recommendation',
    warnings: [],
    confidence: 'low',
  }
}

function num(val: unknown): number {
  if (typeof val === 'number') return val
  if (typeof val === 'string') return parseFloat(val) || 0
  return 0
}
