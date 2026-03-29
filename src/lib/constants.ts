import type { Industry, Stage, Quarter, GoogleCampaignName, PixelMaturity, CreativeCapacity } from './types'

// ─── 1. Platform Split — now industry + stage aware ───
// Industries with high search intent get more Google from Day 1
export const INDUSTRY_GOOGLE_BOOST: Record<Industry, number> = {
  education: 0.25,    // search-intent dominant
  jewelry: 0.15,      // high product search volume
  electronics: 0.15,  // comparison shoppers
  health: 0.10,       // symptom/solution searches
  skincare: 0.05,
  fashion: 0.0,
  fmcg: 0.0,
  accessories: 0.0,
  lifestyle: 0.0,
}

const BASE_PLATFORM_SPLIT: Record<Stage, { meta: number; google: number }> = {
  1: { meta: 0.85, google: 0.15 },
  2: { meta: 0.75, google: 0.25 },
  3: { meta: 0.70, google: 0.30 },
  4: { meta: 0.65, google: 0.35 },
}

export function getPlatformSplit(stage: Stage, industry: Industry): { meta: number; google: number } {
  const base = BASE_PLATFORM_SPLIT[stage]
  const boost = INDUSTRY_GOOGLE_BOOST[industry]
  const google = Math.min(0.50, base.google + boost) // cap at 50% Google
  return { meta: 1 - google, google }
}

export function getStage(monthlyRevenue: number): Stage {
  if (monthlyRevenue < 300000) return 1
  if (monthlyRevenue < 3000000) return 2
  if (monthlyRevenue < 6000000) return 3
  return 4
}

// ─── 2. Industry-Specific ROAS Trajectories (India-calibrated) ───
// Indian CPMs are 1/3-1/5 of US → ROAS targets are higher
export const ROAS_TARGETS: Record<Industry, { existing: [number, number, number]; preLaunch: [number, number, number] }> = {
  fashion:     { existing: [2.5, 3.5, 4.5],   preLaunch: [1.2, 2.0, 3.0] },
  skincare:    { existing: [2.25, 3.0, 4.0],  preLaunch: [1.0, 1.8, 2.75] },
  fmcg:        { existing: [1.75, 2.25, 3.0], preLaunch: [0.8, 1.5, 2.25] },
  accessories: { existing: [2.5, 3.5, 4.5],   preLaunch: [1.2, 2.0, 3.0] },
  health:      { existing: [2.0, 2.75, 3.5],  preLaunch: [1.0, 1.75, 2.5] },
  electronics: { existing: [1.75, 2.25, 3.0], preLaunch: [0.8, 1.5, 2.25] },
  education:   { existing: [2.0, 2.75, 3.5],  preLaunch: [1.0, 1.75, 2.5] },
  jewelry:     { existing: [3.0, 4.0, 5.5],   preLaunch: [1.5, 2.75, 3.75] },
  lifestyle:   { existing: [2.25, 3.0, 4.0],  preLaunch: [1.0, 1.8, 2.75] },
}

// ─── 3. Default Industry Values ───
export const DEFAULT_MARGIN: Record<Industry, number> = {
  jewelry: 0.70, skincare: 0.65, fashion: 0.55, accessories: 0.55,
  health: 0.50, lifestyle: 0.50, education: 0.80, fmcg: 0.30, electronics: 0.25,
}

export const DEFAULT_REPEAT_RATE: Record<Industry, number> = {
  fmcg: 0.40, skincare: 0.35, health: 0.30, fashion: 0.15,
  accessories: 0.10, lifestyle: 0.15, electronics: 0.05, jewelry: 0.05, education: 0.0,
}

// ─── 4. Spend Growth Rate by Brand Type ───
export const DEFAULT_GROWTH_RATE: Record<string, number> = {
  existing: 1.2,
  preLaunch: 1.3,
  vcBacked: 1.4,
}

// ─── 5. Learning Phase Efficiency Multipliers ───
// Fresh pixel/pre-launch: M1 at 60%, M2 at 80%, M3 at 100%
// Existing with data: M1 at 85%, M2 at 95%, M3 at 100%
export function getEfficiencyMultipliers(brandType: string, pixelMaturity: PixelMaturity): [number, number, number] {
  if (brandType === 'preLaunch' || pixelMaturity === 'fresh') {
    return [0.60, 0.80, 1.0]
  }
  if (pixelMaturity === 'learning') {
    return [0.75, 0.90, 1.0]
  }
  // Mature pixel, existing brand
  return [0.85, 0.95, 1.0]
}

// ─── 6. Meta Campaign Funnel Allocation ───
export const META_FUNNEL_ALLOCATION: Record<string, { pct: number; funnel: string }> = {
  'ASC + Broad':              { pct: 0.40, funnel: 'TOF' },
  'Interest + Lookalike':     { pct: 0.40, funnel: 'TOF' },
  'Engagement Retargeting':   { pct: 0.15, funnel: 'MOF' },
  'DPA + Cart Recovery':      { pct: 0.20, funnel: 'BOF' },
  'Creative Testing':         { pct: 0.11, funnel: 'TEST' },
  'Remarketing':              { pct: 0.14, funnel: 'RET' },
}

// ─── 7. Google Campaign Allocation — Shopping from Day 1, PMax ramps up ───
export const GOOGLE_ALLOCATION: Record<GoogleCampaignName, [number, number, number]> = {
  'Brand Search':    [0.25, 0.20, 0.15],
  'Category Search': [0.30, 0.25, 0.20],
  'Shopping':        [0.25, 0.25, 0.25],  // was 0% in M1 — now active from Day 1
  'PMax':            [0.20, 0.30, 0.40],  // was 40% in M1 — now ramps from 20%
}

// ─── 8. Meta Campaign Benchmarks (India-calibrated) ───
// Indian Meta CPMs: TOF ₹80-150, MOF ₹120-180, BOF/Retargeting ₹150-300
interface MetaBenchmark { cpm: number; ctr: number; convRate: number; aovMultiplier: number }

export const META_BENCHMARKS: Record<string, [MetaBenchmark, MetaBenchmark, MetaBenchmark]> = {
  'ASC + Broad': [
    { cpm: 120, ctr: 0.018, convRate: 0.030, aovMultiplier: 1.0 },
    { cpm: 110, ctr: 0.020, convRate: 0.038, aovMultiplier: 1.1 },
    { cpm: 105, ctr: 0.022, convRate: 0.045, aovMultiplier: 1.1 },
  ],
  'Interest + Lookalike': [
    { cpm: 130, ctr: 0.016, convRate: 0.025, aovMultiplier: 1.0 },
    { cpm: 120, ctr: 0.018, convRate: 0.032, aovMultiplier: 1.0 },
    { cpm: 115, ctr: 0.020, convRate: 0.038, aovMultiplier: 1.1 },
  ],
  'Engagement Retargeting': [
    { cpm: 160, ctr: 0.025, convRate: 0.040, aovMultiplier: 1.0 },
    { cpm: 155, ctr: 0.026, convRate: 0.048, aovMultiplier: 1.1 },
    { cpm: 150, ctr: 0.028, convRate: 0.055, aovMultiplier: 1.1 },
  ],
  'DPA + Cart Recovery': [
    { cpm: 200, ctr: 0.022, convRate: 0.045, aovMultiplier: 1.0 },
    { cpm: 190, ctr: 0.024, convRate: 0.052, aovMultiplier: 1.1 },
    { cpm: 180, ctr: 0.025, convRate: 0.058, aovMultiplier: 1.1 },
  ],
  'Creative Testing': [
    { cpm: 100, ctr: 0.015, convRate: 0.020, aovMultiplier: 1.0 },
    { cpm: 95, ctr: 0.016, convRate: 0.025, aovMultiplier: 1.0 },
    { cpm: 90, ctr: 0.017, convRate: 0.030, aovMultiplier: 1.0 },
  ],
  'Remarketing': [
    { cpm: 250, ctr: 0.028, convRate: 0.060, aovMultiplier: 1.0 },
    { cpm: 240, ctr: 0.030, convRate: 0.065, aovMultiplier: 1.15 },
    { cpm: 230, ctr: 0.030, convRate: 0.068, aovMultiplier: 1.2 },
  ],
}

// ─── 9. Google Campaign Benchmarks (India-calibrated) ───
// Indian Google CPCs: Brand ₹5-15, Category ₹15-40, Shopping ₹8-20, PMax ₹10-25
interface GoogleBenchmark { cpc: number; ctr: number; convRate: number; aovMultiplier: number }

export const GOOGLE_BENCHMARKS: Record<GoogleCampaignName, [GoogleBenchmark, GoogleBenchmark, GoogleBenchmark]> = {
  'Brand Search': [
    { cpc: 8, ctr: 0.20, convRate: 0.12, aovMultiplier: 1.5 },
    { cpc: 8, ctr: 0.22, convRate: 0.14, aovMultiplier: 1.6 },
    { cpc: 9, ctr: 0.25, convRate: 0.16, aovMultiplier: 1.7 },
  ],
  'Category Search': [
    { cpc: 25, ctr: 0.04, convRate: 0.025, aovMultiplier: 1.2 },
    { cpc: 22, ctr: 0.05, convRate: 0.030, aovMultiplier: 1.3 },
    { cpc: 20, ctr: 0.06, convRate: 0.035, aovMultiplier: 1.4 },
  ],
  'Shopping': [
    { cpc: 12, ctr: 0.03, convRate: 0.030, aovMultiplier: 1.3 },
    { cpc: 11, ctr: 0.035, convRate: 0.035, aovMultiplier: 1.4 },
    { cpc: 10, ctr: 0.04, convRate: 0.040, aovMultiplier: 1.5 },
  ],
  'PMax': [
    { cpc: 18, ctr: 0.02, convRate: 0.015, aovMultiplier: 1.5 },
    { cpc: 15, ctr: 0.025, convRate: 0.020, aovMultiplier: 1.6 },
    { cpc: 13, ctr: 0.03, convRate: 0.028, aovMultiplier: 1.7 },
  ],
}

// ─── 10. Seasonality Multipliers (India-specific) ───
type SeasonalityKey = Industry | 'general'

export const SEASONALITY_CONV: Record<SeasonalityKey, Record<Quarter, number>> = {
  fashion:     { Q1: 0.85, Q2: 0.90, Q3: 1.10, Q4: 1.30 },  // Q3=Myntra EOSS, Q4=Diwali+BBD
  skincare:    { Q1: 0.90, Q2: 0.95, Q3: 1.05, Q4: 1.20 },
  electronics: { Q1: 0.85, Q2: 0.90, Q3: 1.00, Q4: 1.35 },  // Q4=BBD+Diwali heavy
  health:      { Q1: 1.20, Q2: 1.00, Q3: 0.90, Q4: 0.95 },  // Q1=New Year resolutions
  fmcg:        { Q1: 1.00, Q2: 0.95, Q3: 1.05, Q4: 1.10 },
  accessories: { Q1: 0.85, Q2: 0.95, Q3: 1.05, Q4: 1.25 },
  jewelry:     { Q1: 0.80, Q2: 1.10, Q3: 0.90, Q4: 1.35 },  // Q2=Akshaya Tritiya, Q4=Dhanteras
  lifestyle:   { Q1: 1.00, Q2: 1.00, Q3: 1.05, Q4: 1.10 },
  education:   { Q1: 1.15, Q2: 1.10, Q3: 0.85, Q4: 0.90 },  // Q1-Q2=admission season
  general:     { Q1: 1.00, Q2: 1.00, Q3: 1.00, Q4: 1.00 },
}

export const SEASONALITY_CPM: Record<SeasonalityKey, Record<Quarter, number>> = {
  fashion:     { Q1: 0.85, Q2: 0.90, Q3: 1.10, Q4: 1.30 },
  skincare:    { Q1: 0.90, Q2: 0.95, Q3: 1.00, Q4: 1.15 },
  electronics: { Q1: 0.85, Q2: 0.90, Q3: 1.00, Q4: 1.35 },
  health:      { Q1: 1.05, Q2: 1.00, Q3: 0.95, Q4: 1.00 },
  fmcg:        { Q1: 1.00, Q2: 1.00, Q3: 1.00, Q4: 1.10 },
  accessories: { Q1: 0.85, Q2: 0.95, Q3: 1.00, Q4: 1.20 },
  jewelry:     { Q1: 0.80, Q2: 1.05, Q3: 0.95, Q4: 1.30 },
  lifestyle:   { Q1: 1.00, Q2: 1.00, Q3: 1.00, Q4: 1.05 },
  education:   { Q1: 1.10, Q2: 1.05, Q3: 0.90, Q4: 0.90 },
  general:     { Q1: 1.00, Q2: 1.00, Q3: 1.00, Q4: 1.00 },
}

// ─── 11. Creative Volume ───
export function getCreativeVolume(metaSpend: number): number {
  if (metaSpend < 300000) return 7
  if (metaSpend < 500000) return 10
  if (metaSpend < 1000000) return 16
  if (metaSpend < 2000000) return 25
  return 35
}

export const CREATIVE_FUNNEL = { tof: 0.425, mof: 0.225, bof: 0.35 }

export const FORMAT_SPLIT: [number, number][] = [
  [0.55, 0.45],
  [0.50, 0.50],
  [0.45, 0.55],
]

// ─── 12. Creative Capacity Caps ───
export const CREATIVE_CAPS: Record<CreativeCapacity, number> = {
  low: 10,
  medium: 20,
  high: 40,
}

// ─── 13. Pixel Maturity Config ───
export const PIXEL_CONFIG: Record<PixelMaturity, {
  tofCampaign: 'ASC + Broad' | 'Interest + Lookalike'
  biddingNote: string
  ascUnlocksMonth: number
}> = {
  fresh:    { tofCampaign: 'Interest + Lookalike', biddingNote: 'Lowest cost (no cap)', ascUnlocksMonth: 2 },
  learning: { tofCampaign: 'ASC + Broad', biddingNote: 'Lowest cost M1, cost cap from M2', ascUnlocksMonth: 1 },
  mature:   { tofCampaign: 'ASC + Broad', biddingNote: 'Cost cap from M1', ascUnlocksMonth: 0 },
}

// ─── 14. CPA — margin + LTV based ───
export function getSustainableCPA(effectiveAOV: number, margin: number, repeatRate: number): number {
  const singlePurchaseCPA = effectiveAOV * margin / 2
  const ltvMultiplier = 1 + repeatRate * 2
  return singlePurchaseCPA * ltvMultiplier
}

export function getCpaStatus(cpa: number, sustainableCPA: number): 'sustainable' | 'warning' | 'unsustainable' {
  if (cpa < sustainableCPA) return 'sustainable'
  if (cpa < sustainableCPA * 1.3) return 'warning'
  return 'unsustainable'
}

// ─── 15. Scenario Multipliers ───
export const SCENARIO_CONFIG = {
  conservative: { label: 'Conservative', roasMultiplier: 0.75 },
  base:         { label: 'Base',         roasMultiplier: 1.0 },
  aggressive:   { label: 'Aggressive',   roasMultiplier: 1.25 },
} as const

// ─── 16. Display labels ───
export const INDUSTRY_LABELS: Record<Industry, string> = {
  fashion: 'Fashion / Apparel',
  skincare: 'Skincare / Beauty',
  fmcg: 'FMCG',
  accessories: 'Accessories',
  health: 'Health & Wellness',
  electronics: 'Electronics',
  education: 'Education / Lead Gen',
  jewelry: 'Jewelry',
  lifestyle: 'Lifestyle',
}
