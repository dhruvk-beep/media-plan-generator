export type Industry =
  | 'fashion'
  | 'skincare'
  | 'fmcg'
  | 'accessories'
  | 'health'
  | 'electronics'
  | 'education'
  | 'jewelry'
  | 'lifestyle'

export type Stage = 1 | 2 | 3 | 4

export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4'

export type BrandType = 'existing' | 'preLaunch' | 'vcBacked'

export type CpaStatus = 'sustainable' | 'warning' | 'unsustainable'

export type PixelMaturity = 'fresh' | 'learning' | 'mature'

export type CreativeCapacity = 'low' | 'medium' | 'high'

export type MetaCampaignName =
  | 'ASC + Broad'
  | 'Interest + Lookalike'  // used when pixel is fresh
  | 'Engagement Retargeting'
  | 'DPA + Cart Recovery'
  | 'Creative Testing'
  | 'Remarketing'

export type GoogleCampaignName =
  | 'Brand Search'
  | 'Category Search'
  | 'Shopping'
  | 'PMax'

// ─── Inputs ───

export interface MediaPlanInputs {
  // Section 1: Brand Basics
  brandName: string
  industry: Industry
  brandType: BrandType
  quarter: Quarter

  // Section 2: Financials
  monthlyRevenue: number
  monthlyAdSpend: number
  aov: number
  grossMargin: number          // 0-1
  currentRoas: number | null   // null for pre-launch

  // Section 3: Brand Intelligence
  monthlyTraffic: number | null  // null = estimate from spend
  emailListSize: number
  skuCount: number
  repeatPurchaseRate: number   // 0-1
  avgDiscount: number          // 0-1
  pixelMaturity: PixelMaturity
  creativeCapacity: CreativeCapacity
  inventoryValue: number | null  // null = no cap
}

// ─── Outputs ───

export interface MonthProjection {
  month: 1 | 2 | 3
  metaSpend: number
  googleSpend: number
  totalSpend: number
  roas: number
  newCustomerRevenue: number
  repeatRevenue: number
  retentionRevenue: number
  totalRevenue: number
  purchases: number
  cpa: number
  cpaStatus: CpaStatus
  sustainableCPA: number
  creatives: number
  creativesNeeded: number   // before capacity cap
  inventoryCapped: boolean
}

export interface CampaignMonth {
  budget: number
  impressions: number
  clicks: number
  ctr: number
  cpc: number
  cpm: number
  convRate: number
  orders: number
  aov: number
  revenue: number
  roas: number
}

export interface MetaCampaignRow {
  campaign: MetaCampaignName
  funnel: string
  budgetPct: number
  months: [CampaignMonth, CampaignMonth, CampaignMonth]
}

export interface GoogleCampaignRow {
  campaign: GoogleCampaignName
  funnel: string
  months: [CampaignMonth, CampaignMonth, CampaignMonth]
}

export interface CreativeMonthMatrix {
  month: 1 | 2 | 3
  total: number
  tof: { static: number; reels: number }
  mof: { static: number; reels: number }
  bof: { static: number; reels: number }
}

export interface DynamicFunnel {
  tof: number
  mof: number
  bof: number
  test: number
  evergreen: number
  bofCappedReason: string | null
}

export interface MediaPlan {
  brand: string
  industry: Industry
  stage: Stage
  quarter: Quarter
  brandType: BrandType
  platformSplit: { meta: number; google: number }
  seasonalityConv: number
  seasonalityCpm: number
  seasonalityNote: string
  effectiveAOV: number
  sustainableCPA: number
  ltvMultiplier: number
  dynamicFunnel: DynamicFunnel
  pixelStrategy: string
  warnings: string[]
  projection: [MonthProjection, MonthProjection, MonthProjection]
  metaCampaigns: MetaCampaignRow[]
  googleCampaigns: GoogleCampaignRow[]
  creativeMatrix: [CreativeMonthMatrix, CreativeMonthMatrix, CreativeMonthMatrix]
}
