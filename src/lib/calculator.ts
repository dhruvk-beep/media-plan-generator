import type {
  MediaPlanInputs, MediaPlan, MonthProjection,
  MetaCampaignRow, GoogleCampaignRow, CampaignMonth,
  CreativeMonthMatrix, MetaCampaignName, GoogleCampaignName, DynamicFunnel,
} from './types'
import {
  PLATFORM_SPLIT, getStage, ROAS_TARGETS,
  META_FUNNEL_ALLOCATION, GOOGLE_ALLOCATION,
  META_BENCHMARKS, GOOGLE_BENCHMARKS,
  SEASONALITY_CONV, SEASONALITY_CPM,
  getCreativeVolume, CREATIVE_FUNNEL, FORMAT_SPLIT,
  getCpaStatus, getSustainableCPA,
  CREATIVE_CAPS, PIXEL_CONFIG,
} from './constants'

const SPEND_SCALE = 1.4
const AVG_RETARGETING_CPC = 15 // ₹ average CPC for retargeting campaigns

export function generateMediaPlan(inputs: MediaPlanInputs): MediaPlan {
  const {
    brandName, industry, monthlyRevenue, monthlyAdSpend, aov,
    quarter, brandType, grossMargin, currentRoas,
    monthlyTraffic, emailListSize, skuCount, repeatPurchaseRate,
    avgDiscount, pixelMaturity, creativeCapacity, inventoryValue,
  } = inputs

  const warnings: string[] = []

  // ─── Step 1: Stage & Platform Split ───
  const stage = getStage(monthlyRevenue)
  const split = PLATFORM_SPLIT[stage]

  // ─── Step 2: Seasonality ───
  const convMult = SEASONALITY_CONV[industry]?.[quarter] ?? 1.0
  const cpmMult = SEASONALITY_CPM[industry]?.[quarter] ?? 1.0
  const seasonalityNote = convMult !== 1.0
    ? `${quarter} ${convMult > 1 ? 'tailwind' : 'headwind'} — conv rates ${convMult > 1 ? '+' : ''}${Math.round((convMult - 1) * 100)}% for ${industry}`
    : 'No seasonality adjustment for this quarter'

  // ─── Step 3: ROAS Targets (anchored to current ROAS) ───
  const roasKey = brandType === 'preLaunch' ? 'preLaunch' : 'existing'
  const industryRoas = ROAS_TARGETS[industry][roasKey].map(r => r * convMult) as [number, number, number]

  let roasTargets: [number, number, number]
  if (currentRoas !== null && brandType !== 'preLaunch') {
    const m1 = Math.max(currentRoas + 0.3, industryRoas[0])
    const m2 = Math.max(m1 * 1.3, industryRoas[1])
    const m3 = Math.max(m2 * 1.2, industryRoas[2])
    roasTargets = [m1, m2, m3]

    if (currentRoas + 0.3 < industryRoas[0]) {
      warnings.push(`Current ROAS (${currentRoas.toFixed(1)}x) is below industry average. M1 target set to industry benchmark ${industryRoas[0].toFixed(1)}x.`)
    }
  } else {
    roasTargets = [...industryRoas] as [number, number, number]
  }

  if (brandType === 'vcBacked') {
    roasTargets[0] = Math.max(0.5, roasTargets[0] - 0.5)
    roasTargets[1] = Math.max(0.8, roasTargets[1] - 0.5)
  }

  // ─── Step 4: Effective AOV ───
  const effectiveAOV = aov * (1 - avgDiscount)
  if (avgDiscount > 0.25) {
    warnings.push(`High average discount (${Math.round(avgDiscount * 100)}%) significantly reduces effective AOV from ${aov} to ${Math.round(effectiveAOV)}.`)
  }

  // ─── Step 5: Spend Trajectory (with inventory cap) ───
  const rawSpends = [
    monthlyAdSpend,
    monthlyAdSpend * SPEND_SCALE,
    monthlyAdSpend * SPEND_SCALE * SPEND_SCALE,
  ]
  const inventoryCapped = [false, false, false]

  if (inventoryValue) {
    const maxMonthlyRevenue = inventoryValue * 0.4
    for (let i = 0; i < 3; i++) {
      const maxSpend = roasTargets[i] > 0 ? maxMonthlyRevenue / roasTargets[i] : rawSpends[i]
      if (rawSpends[i] > maxSpend) {
        rawSpends[i] = maxSpend
        inventoryCapped[i] = true
      }
    }
    if (inventoryCapped.some(Boolean)) {
      warnings.push(`Spend capped by inventory value (₹${(inventoryValue / 100000).toFixed(1)}L). Scale requires restocking.`)
    }
  }

  // ─── Step 6: Dynamic Funnel Allocation ───
  const dynamicFunnel: DynamicFunnel = {
    tof: 0.40, mof: 0.15, bof: 0.20, test: 0.11, evergreen: 0.14,
    bofCappedReason: null,
  }

  if (monthlyTraffic !== null) {
    const retargetingPool = monthlyTraffic * 0.30
    const maxBOFSpendMonthly = retargetingPool * AVG_RETARGETING_CPC * 4
    const metaSpendM1 = rawSpends[0] * split.meta
    let bofPct = Math.min(0.20, metaSpendM1 > 0 ? maxBOFSpendMonthly / metaSpendM1 : 0.20)

    if (skuCount < 10) {
      bofPct *= 0.5
      warnings.push(`Only ${skuCount} SKUs — DPA allocation halved. Consider expanding catalog for better retargeting.`)
    }

    if (bofPct < 0.15) {
      dynamicFunnel.bofCappedReason = `Low traffic (${(monthlyTraffic / 1000).toFixed(0)}K/mo)`
      warnings.push(`Website traffic (${(monthlyTraffic / 1000).toFixed(0)}K/mo) limits retargeting pool. BOF capped at ${Math.round(bofPct * 100)}% until TOF builds audience.`)
    }

    const bofDelta = 0.20 - bofPct
    dynamicFunnel.bof = bofPct
    dynamicFunnel.tof = 0.40 + bofDelta // TOF absorbs what BOF can't use
  } else if (skuCount < 10) {
    dynamicFunnel.bof = 0.10
    dynamicFunnel.tof = 0.50
    warnings.push(`Only ${skuCount} SKUs — DPA allocation halved. Excess moved to prospecting.`)
  }

  // ─── Step 7: Pixel Maturity ───
  const pixelConfig = PIXEL_CONFIG[pixelMaturity]
  const tofCampaignName = pixelConfig.tofCampaign
  let pixelStrategy: string

  if (pixelMaturity === 'fresh') {
    pixelStrategy = 'Interest + Lookalike in M1 (no ASC). ASC unlocks M2 after pixel accumulates data.'
    warnings.push('Fresh pixel — M1 uses Interest targeting instead of ASC. Smart bidding unavailable until 50+ conversions/week.')
  } else if (pixelMaturity === 'learning') {
    pixelStrategy = 'ASC from M1 with lowest cost. Cost cap bidding from M2.'
  } else {
    pixelStrategy = 'Full ASC + cost cap bidding from M1.'
  }

  // ─── Step 8: LTV-Adjusted CPA ───
  const ltvMultiplier = 1 + repeatPurchaseRate * 2
  const sustainableCPA = getSustainableCPA(effectiveAOV, grossMargin, repeatPurchaseRate)

  if (repeatPurchaseRate > 0.2) {
    warnings.push(`High repeat rate (${Math.round(repeatPurchaseRate * 100)}%) — LTV-adjusted CPA is ₹${Math.round(sustainableCPA)} vs single-purchase ₹${Math.round(effectiveAOV * grossMargin / 2)}. M1 loss may be acceptable.`)
  }

  // ─── Step 9: Revenue Projections (with repeat + retention) ───
  const cumulativeCustomers: number[] = []
  const projection = rawSpends.map((totalSpend, i) => {
    const metaSpend = totalSpend * split.meta
    const googleSpend = totalSpend * split.google
    const roas = roasTargets[i]
    const newCustomerRevenue = totalSpend * roas
    const newPurchases = Math.round(newCustomerRevenue / effectiveAOV)

    // Repeat revenue from previous months' customers
    let repeatRevenue = 0
    for (let prev = 0; prev < i; prev++) {
      repeatRevenue += cumulativeCustomers[prev] * repeatPurchaseRate * effectiveAOV
    }

    // Retention revenue from email/SMS list
    const retentionRevenue = emailListSize * 0.02 * effectiveAOV

    const totalRevenue = newCustomerRevenue + repeatRevenue + retentionRevenue
    const totalPurchases = Math.round(totalRevenue / effectiveAOV)
    const cpa = totalPurchases > 0 ? totalSpend / totalPurchases : 0

    cumulativeCustomers.push(newPurchases)

    const creativesNeeded = getCreativeVolume(metaSpend)
    const creatives = Math.min(creativesNeeded, CREATIVE_CAPS[creativeCapacity])

    return {
      month: (i + 1) as 1 | 2 | 3,
      metaSpend,
      googleSpend,
      totalSpend,
      roas,
      newCustomerRevenue,
      repeatRevenue,
      retentionRevenue,
      totalRevenue,
      purchases: totalPurchases,
      cpa,
      cpaStatus: getCpaStatus(cpa, sustainableCPA),
      sustainableCPA,
      creatives,
      creativesNeeded,
      inventoryCapped: inventoryCapped[i],
    } satisfies MonthProjection
  }) as [MonthProjection, MonthProjection, MonthProjection]

  // ─── Step 12: Creative capacity warning ───
  const maxNeeded = Math.max(...projection.map(p => p.creativesNeeded))
  const cap = CREATIVE_CAPS[creativeCapacity]
  if (maxNeeded > cap) {
    warnings.push(`Creative bottleneck — plan needs ${maxNeeded}/mo but capacity is ${cap}. Prioritize TOF Reels.`)
  }

  // ─── Step 10: Meta Campaign Breakdown ───
  const metaCampaignDefs: { name: MetaCampaignName; funnel: string; getPct: (month: number) => number }[] = [
    {
      name: tofCampaignName as MetaCampaignName,
      funnel: 'TOF',
      getPct: (m) => {
        // If fresh pixel, switch from Interest to ASC in M2+
        if (pixelMaturity === 'fresh' && m >= 1) {
          return dynamicFunnel.tof // keep same allocation, just different campaign name label
        }
        return dynamicFunnel.tof
      },
    },
    { name: 'Engagement Retargeting', funnel: 'MOF', getPct: () => dynamicFunnel.mof },
    { name: 'DPA + Cart Recovery', funnel: 'BOF', getPct: () => dynamicFunnel.bof },
    { name: 'Creative Testing', funnel: 'TEST', getPct: () => dynamicFunnel.test },
    { name: 'Remarketing', funnel: 'RET', getPct: () => dynamicFunnel.evergreen },
  ]

  const metaCampaigns: MetaCampaignRow[] = metaCampaignDefs.map(def => {
    const benchmarks = META_BENCHMARKS[def.name] ?? META_BENCHMARKS['ASC + Broad']

    const months = [0, 1, 2].map(i => {
      const pct = def.getPct(i)
      const budget = projection[i].metaSpend * pct
      const b = benchmarks[i]
      const adjCpm = b.cpm * cpmMult
      const adjConvRate = b.convRate * convMult
      const impressions = adjCpm > 0 ? budget * 1000 / adjCpm : 0
      const clicks = impressions * b.ctr
      const cpc = clicks > 0 ? budget / clicks : 0
      const orders = Math.round(adjConvRate * clicks)
      const campaignAov = effectiveAOV * b.aovMultiplier
      const revenue = campaignAov * orders
      const roas = budget > 0 ? revenue / budget : 0

      return { budget, impressions, clicks, ctr: b.ctr, cpc, cpm: adjCpm, convRate: adjConvRate, orders, aov: campaignAov, revenue, roas } satisfies CampaignMonth
    }) as [CampaignMonth, CampaignMonth, CampaignMonth]

    return { campaign: def.name, funnel: def.funnel, budgetPct: def.getPct(0), months }
  })

  // ─── Step 11: Google Campaign Breakdown ───
  const googleCampaignNames = Object.keys(GOOGLE_ALLOCATION) as GoogleCampaignName[]
  const googleCampaigns: GoogleCampaignRow[] = googleCampaignNames.map(name => {
    const allocations = GOOGLE_ALLOCATION[name]
    const benchmarks = GOOGLE_BENCHMARKS[name]

    const months = [0, 1, 2].map(i => {
      const budget = projection[i].googleSpend * allocations[i]
      const b = benchmarks[i]
      const adjCpc = b.cpc * cpmMult
      const adjConvRate = b.convRate * convMult
      const clicks = adjCpc > 0 ? budget / adjCpc : 0
      const impressions = b.ctr > 0 ? clicks / b.ctr : 0
      const orders = Math.round(adjConvRate * clicks)
      const campaignAov = effectiveAOV * b.aovMultiplier
      const revenue = campaignAov * orders
      const roas = budget > 0 ? revenue / budget : 0

      return { budget, impressions, clicks, ctr: b.ctr, cpc: adjCpc, cpm: impressions > 0 ? (budget / impressions) * 1000 : 0, convRate: adjConvRate, orders, aov: campaignAov, revenue, roas } satisfies CampaignMonth
    }) as [CampaignMonth, CampaignMonth, CampaignMonth]

    return { campaign: name, funnel: 'Conversion', months }
  })

  // ─── Step 13 (Creative matrix — uses capped volume) ───
  const creativeMatrix = [0, 1, 2].map(i => {
    const total = projection[i].creatives
    const [staticPct, reelsPct] = FORMAT_SPLIT[i]
    const distribute = (funnelPct: number) => ({
      static: Math.round(total * funnelPct * staticPct),
      reels: Math.round(total * funnelPct * reelsPct),
    })
    return {
      month: (i + 1) as 1 | 2 | 3,
      total,
      tof: distribute(CREATIVE_FUNNEL.tof),
      mof: distribute(CREATIVE_FUNNEL.mof),
      bof: distribute(CREATIVE_FUNNEL.bof),
    } satisfies CreativeMonthMatrix
  }) as [CreativeMonthMatrix, CreativeMonthMatrix, CreativeMonthMatrix]

  return {
    brand: brandName,
    industry,
    stage,
    quarter,
    brandType,
    platformSplit: split,
    seasonalityConv: convMult,
    seasonalityCpm: cpmMult,
    seasonalityNote,
    effectiveAOV,
    sustainableCPA,
    ltvMultiplier,
    dynamicFunnel,
    pixelStrategy,
    warnings,
    projection,
    metaCampaigns,
    googleCampaigns,
    creativeMatrix,
  }
}
