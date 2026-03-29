import type { Industry, Stage, Quarter, MetaCampaignName, GoogleCampaignName, PixelMaturity, CreativeCapacity } from './types'

// ─── 1. Platform Split by D2C Revenue Stage ───
export const PLATFORM_SPLIT: Record<Stage, { meta: number; google: number }> = {
  1: { meta: 0.90, google: 0.10 },
  2: { meta: 0.80, google: 0.20 },
  3: { meta: 0.75, google: 0.25 },
  4: { meta: 0.70, google: 0.30 },
}

export function getStage(monthlyRevenue: number): Stage {
  if (monthlyRevenue < 300000) return 1
  if (monthlyRevenue < 3000000) return 2
  if (monthlyRevenue < 6000000) return 3
  return 4
}

// ─── 2. Industry-Specific ROAS Trajectories ───
export const ROAS_TARGETS: Record<Industry, { existing: [number, number, number]; preLaunch: [number, number, number] }> = {
  fashion:     { existing: [2.0, 2.75, 3.5],  preLaunch: [1.0, 1.75, 2.4] },
  skincare:    { existing: [1.75, 2.25, 3.0],  preLaunch: [0.85, 1.5, 2.15] },
  fmcg:        { existing: [1.35, 1.75, 2.25], preLaunch: [0.65, 1.25, 1.75] },
  accessories: { existing: [2.0, 2.75, 3.5],   preLaunch: [1.0, 1.75, 2.4] },
  health:      { existing: [1.65, 2.25, 2.75], preLaunch: [0.85, 1.5, 2.15] },
  electronics: { existing: [1.35, 1.75, 2.25], preLaunch: [0.65, 1.25, 1.75] },
  education:   { existing: [1.5, 2.0, 2.5],    preLaunch: [0.8, 1.5, 2.0] },
  jewelry:     { existing: [2.25, 3.25, 4.25], preLaunch: [1.25, 2.25, 3.0] },
  lifestyle:   { existing: [1.75, 2.25, 3.0],  preLaunch: [0.85, 1.5, 2.15] },
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

// ─── 4. Meta Campaign Funnel Allocation (default — overridden by dynamic funnel) ───
export const META_FUNNEL_ALLOCATION: Record<string, { pct: number; funnel: string }> = {
  'ASC + Broad':              { pct: 0.40, funnel: 'TOF' },
  'Interest + Lookalike':     { pct: 0.40, funnel: 'TOF' },  // fresh pixel alternative
  'Engagement Retargeting':   { pct: 0.15, funnel: 'MOF' },
  'DPA + Cart Recovery':      { pct: 0.20, funnel: 'BOF' },
  'Creative Testing':         { pct: 0.11, funnel: 'TEST' },
  'Remarketing':              { pct: 0.14, funnel: 'RET' },
}

// ─── 5. Google Campaign Allocation (evolves monthly) ───
export const GOOGLE_ALLOCATION: Record<GoogleCampaignName, [number, number, number]> = {
  'Brand Search':    [0.25, 0.17, 0.15],
  'Category Search': [0.35, 0.23, 0.20],
  'Shopping':        [0.00, 0.27, 0.25],
  'PMax':            [0.40, 0.33, 0.40],
}

// ─── 6. Meta Campaign Benchmarks ───
interface MetaBenchmark { cpm: number; ctr: number; convRate: number; aovMultiplier: number }

export const META_BENCHMARKS: Record<string, [MetaBenchmark, MetaBenchmark, MetaBenchmark]> = {
  'ASC + Broad': [
    { cpm: 180, ctr: 0.018, convRate: 0.035, aovMultiplier: 1.0 },
    { cpm: 180, ctr: 0.018, convRate: 0.040, aovMultiplier: 1.125 },
    { cpm: 180, ctr: 0.018, convRate: 0.045, aovMultiplier: 1.125 },
  ],
  'Interest + Lookalike': [
    { cpm: 195, ctr: 0.016, convRate: 0.032, aovMultiplier: 1.0 },
    { cpm: 190, ctr: 0.017, convRate: 0.037, aovMultiplier: 1.0 },
    { cpm: 185, ctr: 0.018, convRate: 0.042, aovMultiplier: 1.125 },
  ],
  'Engagement Retargeting': [
    { cpm: 200, ctr: 0.020, convRate: 0.040, aovMultiplier: 1.0 },
    { cpm: 200, ctr: 0.020, convRate: 0.045, aovMultiplier: 1.125 },
    { cpm: 200, ctr: 0.020, convRate: 0.050, aovMultiplier: 1.125 },
  ],
  'DPA + Cart Recovery': [
    { cpm: 200, ctr: 0.020, convRate: 0.035, aovMultiplier: 1.0 },
    { cpm: 200, ctr: 0.020, convRate: 0.040, aovMultiplier: 1.125 },
    { cpm: 200, ctr: 0.020, convRate: 0.040, aovMultiplier: 1.125 },
  ],
  'Creative Testing': [
    { cpm: 170, ctr: 0.015, convRate: 0.025, aovMultiplier: 1.0 },
    { cpm: 170, ctr: 0.015, convRate: 0.030, aovMultiplier: 1.0 },
    { cpm: 170, ctr: 0.015, convRate: 0.035, aovMultiplier: 1.0 },
  ],
  'Remarketing': [
    { cpm: 250, ctr: 0.020, convRate: 0.055, aovMultiplier: 1.0 },
    { cpm: 250, ctr: 0.020, convRate: 0.055, aovMultiplier: 1.25 },
    { cpm: 250, ctr: 0.020, convRate: 0.055, aovMultiplier: 1.25 },
  ],
}

// ─── 7. Google Campaign Benchmarks ───
interface GoogleBenchmark { cpc: number; ctr: number; convRate: number; aovMultiplier: number }

export const GOOGLE_BENCHMARKS: Record<GoogleCampaignName, [GoogleBenchmark, GoogleBenchmark, GoogleBenchmark]> = {
  'Brand Search': [
    { cpc: 4, ctr: 0.25, convRate: 0.15, aovMultiplier: 1.875 },
    { cpc: 4, ctr: 0.25, convRate: 0.15, aovMultiplier: 2.0 },
    { cpc: 5, ctr: 0.30, convRate: 0.17, aovMultiplier: 2.125 },
  ],
  'Category Search': [
    { cpc: 8, ctr: 0.05, convRate: 0.03, aovMultiplier: 1.5 },
    { cpc: 7, ctr: 0.06, convRate: 0.04, aovMultiplier: 1.625 },
    { cpc: 7, ctr: 0.07, convRate: 0.05, aovMultiplier: 1.75 },
  ],
  'Shopping': [
    { cpc: 6, ctr: 0.04, convRate: 0.03, aovMultiplier: 1.75 },
    { cpc: 5, ctr: 0.05, convRate: 0.035, aovMultiplier: 1.875 },
    { cpc: 5, ctr: 0.05, convRate: 0.04, aovMultiplier: 2.0 },
  ],
  'PMax': [
    { cpc: 12, ctr: 0.03, convRate: 0.02, aovMultiplier: 2.125 },
    { cpc: 10, ctr: 0.03, convRate: 0.02, aovMultiplier: 2.125 },
    { cpc: 10, ctr: 0.03, convRate: 0.03, aovMultiplier: 2.25 },
  ],
}

// ─── 8. Seasonality Multipliers ───
type SeasonalityKey = Industry | 'general'

export const SEASONALITY_CONV: Record<SeasonalityKey, Record<Quarter, number>> = {
  fashion:     { Q1: 0.85, Q2: 0.90, Q3: 1.00, Q4: 1.25 },
  skincare:    { Q1: 0.90, Q2: 0.95, Q3: 1.00, Q4: 1.15 },
  electronics: { Q1: 0.85, Q2: 0.90, Q3: 0.95, Q4: 1.30 },
  health:      { Q1: 1.15, Q2: 1.00, Q3: 0.90, Q4: 0.95 },
  fmcg:        { Q1: 1.00, Q2: 0.95, Q3: 1.00, Q4: 1.05 },
  accessories: { Q1: 0.85, Q2: 0.95, Q3: 1.00, Q4: 1.20 },
  jewelry:     { Q1: 0.80, Q2: 0.90, Q3: 1.00, Q4: 1.30 },
  lifestyle:   { Q1: 1.00, Q2: 1.00, Q3: 1.00, Q4: 1.10 },
  education:   { Q1: 1.00, Q2: 1.00, Q3: 1.00, Q4: 1.00 },
  general:     { Q1: 1.00, Q2: 1.00, Q3: 1.00, Q4: 1.00 },
}

export const SEASONALITY_CPM: Record<SeasonalityKey, Record<Quarter, number>> = {
  fashion:     { Q1: 0.90, Q2: 0.95, Q3: 1.00, Q4: 1.20 },
  skincare:    { Q1: 0.95, Q2: 1.00, Q3: 1.00, Q4: 1.10 },
  electronics: { Q1: 0.90, Q2: 0.95, Q3: 1.00, Q4: 1.25 },
  health:      { Q1: 1.05, Q2: 1.00, Q3: 0.95, Q4: 1.00 },
  fmcg:        { Q1: 1.00, Q2: 1.00, Q3: 1.00, Q4: 1.05 },
  accessories: { Q1: 0.90, Q2: 0.95, Q3: 1.00, Q4: 1.15 },
  jewelry:     { Q1: 0.85, Q2: 0.95, Q3: 1.00, Q4: 1.25 },
  lifestyle:   { Q1: 1.00, Q2: 1.00, Q3: 1.00, Q4: 1.05 },
  education:   { Q1: 1.00, Q2: 1.00, Q3: 1.00, Q4: 1.00 },
  general:     { Q1: 1.00, Q2: 1.00, Q3: 1.00, Q4: 1.00 },
}

// ─── 9. Creative Volume ───
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

// ─── 10. Creative Capacity Caps ───
export const CREATIVE_CAPS: Record<CreativeCapacity, number> = {
  low: 10,
  medium: 20,
  high: 40,
}

// ─── 11. Pixel Maturity Config ───
export const PIXEL_CONFIG: Record<PixelMaturity, {
  tofCampaign: 'ASC + Broad' | 'Interest + Lookalike'
  biddingNote: string
  ascUnlocksMonth: number  // 0 = from M1, 1 = from M2, etc.
}> = {
  fresh:    { tofCampaign: 'Interest + Lookalike', biddingNote: 'Lowest cost (no cap)', ascUnlocksMonth: 2 },
  learning: { tofCampaign: 'ASC + Broad', biddingNote: 'Lowest cost M1, cost cap from M2', ascUnlocksMonth: 1 },
  mature:   { tofCampaign: 'ASC + Broad', biddingNote: 'Cost cap from M1', ascUnlocksMonth: 0 },
}

// ─── 12. CPA — now margin + LTV based ───
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

// ─── 13. Display labels ───
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
