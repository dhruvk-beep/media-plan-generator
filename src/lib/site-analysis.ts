// Client-side helper for the site analysis API

import type { Industry } from './types'

export interface SiteAnalysis {
  brandName: string
  industry: Industry
  estimatedSkuCount: number | null
  estimatedAov: number | null
  estimatedAvgDiscount: number | null
  estimatedGrossMargin: number | null
  marginReasoning: string
  industryReasoning: string
  brandDescription: string
  priceRange: { min: number; max: number } | null
  targetAudience: string
  productUrlsFound: number
  sitemapProductCount: number | null
  pricesExtracted: number[]
  source: string
  error?: string
}

const VALID_INDUSTRIES: Industry[] = [
  'fashion', 'skincare', 'fmcg', 'accessories', 'health',
  'electronics', 'education', 'jewelry', 'lifestyle',
]

export async function analyzeSite(url: string): Promise<SiteAnalysis> {
  const res = await fetch('/api/analyze-site', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }

  const data = await res.json()

  // Validate industry is one of our supported types
  if (data.industry && !VALID_INDUSTRIES.includes(data.industry)) {
    data.industry = 'lifestyle' // safe fallback
  }

  return data as SiteAnalysis
}
