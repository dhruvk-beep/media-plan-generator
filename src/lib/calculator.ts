import type {
  MediaPlanInputs, MediaPlan, MonthProjection,
  MetaCampaignRow, GoogleCampaignRow, CampaignMonth,
  CreativeMonthMatrix, MetaCampaignName, GoogleCampaignName, DynamicFunnel,
  Assumptions, ScenarioPlan, ScenarioType,
} from './types'
import {
  getPlatformSplit, getStage, ROAS_TARGETS,
  GOOGLE_ALLOCATION,
  META_BENCHMARKS, GOOGLE_BENCHMARKS,
  SEASONALITY_CONV, SEASONALITY_CPM,
  getCreativeVolume, CREATIVE_FUNNEL, FORMAT_SPLIT,
  getCpaStatus, getSustainableCPA,
  CREATIVE_CAPS, PIXEL_CONFIG,
  getEfficiencyMultipliers, SCENARIO_CONFIG,
} from './constants'

const AVG_RETARGETING_CPC = 15

export function generateMediaPlan(inputs: MediaPlanInputs): MediaPlan {
  const {
    brandName, industry, monthlyRevenue, monthlyAdSpend, aov,
    quarter, brandType, grossMargin, currentRoas,
    monthlyTraffic, emailListSize, skuCount, repeatPurchaseRate,
    avgDiscount, pixelMaturity, creativeCapacity, inventoryValue,
    spendGrowthRate, dataMode, windsorOverrides,
  } = inputs

  const warnings: string[] = []

  // ─── Step 1: Stage & Platform Split (now industry-aware) ───
  const stage = getStage(monthlyRevenue)
  let split = getPlatformSplit(stage, industry)

  // If Windsor data available, use actual platform split as reference
  if (dataMode === 'windsor' && windsorOverrides) {
    const actual = windsorOverrides.actualPlatformSplit
    // Blend: 60% actual, 40% recommended (don't just copy, improve)
    split = {
      meta: actual.meta * 0.6 + split.meta * 0.4,
      google: actual.google * 0.6 + split.google * 0.4,
    }
    warnings.push(`Platform split blended from Windsor actuals (${Math.round(actual.meta * 100)}/${Math.round(actual.google * 100)}) and industry recommendation.`)
  }

  // ─── Step 2: Seasonality ───
  const convMult = SEASONALITY_CONV[industry]?.[quarter] ?? 1.0
  const cpmMult = SEASONALITY_CPM[industry]?.[quarter] ?? 1.0
  const seasonalityNote = convMult !== 1.0
    ? `${quarter} ${convMult > 1 ? 'tailwind' : 'headwind'} — conv rates ${convMult > 1 ? '+' : ''}${Math.round((convMult - 1) * 100)}% for ${industry}`
    : 'No seasonality adjustment for this quarter'

  // ─── Step 3: ROAS Targets ───
  const roasKey = brandType === 'preLaunch' ? 'preLaunch' : 'existing'
  const industryRoas = ROAS_TARGETS[industry][roasKey].map(r => r * convMult) as [number, number, number]

  let roasTargets: [number, number, number]
  let roasSource: Assumptions['roasSource'] = 'industry-benchmark'

  if (dataMode === 'windsor' && windsorOverrides && windsorOverrides.metaRoas > 0) {
    // Use Windsor actual ROAS as M1 anchor, project improvement
    const actualRoas = windsorOverrides.metaRoas
    roasTargets = [
      actualRoas * 1.1,
      actualRoas * 1.3,
      actualRoas * 1.5,
    ]
    roasSource = 'windsor'
    warnings.push(`ROAS targets anchored to Windsor actuals (${actualRoas.toFixed(1)}x) with projected improvement.`)
  } else if (currentRoas !== null && brandType !== 'preLaunch') {
    const m1 = Math.max(currentRoas + 0.3, industryRoas[0])
    const m2 = Math.max(m1 * 1.25, industryRoas[1])
    const m3 = Math.max(m2 * 1.15, industryRoas[2])
    roasTargets = [m1, m2, m3]
    roasSource = 'user-input'

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
    warnings.push(`High average discount (${Math.round(avgDiscount * 100)}%) significantly reduces effective AOV from ₹${aov} to ₹${Math.round(effectiveAOV)}.`)
  }

  // ─── Step 5: Learning Phase Efficiency ───
  const efficiencyMultipliers = getEfficiencyMultipliers(brandType, pixelMaturity)

  // ─── Step 6: Spend Trajectory (configurable growth rate) ───
  const growthRate = spendGrowthRate
  const rawSpends = [
    monthlyAdSpend,
    monthlyAdSpend * growthRate,
    monthlyAdSpend * growthRate * growthRate,
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

  // ─── Step 7: Dynamic Funnel Allocation ───
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
    dynamicFunnel.tof = 0.40 + bofDelta
  } else if (skuCount < 10) {
    dynamicFunnel.bof = 0.10
    dynamicFunnel.tof = 0.50
    warnings.push(`Only ${skuCount} SKUs — DPA allocation halved. Excess moved to prospecting.`)
  }

  // ─── Step 8: Pixel Maturity ───
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

  // ─── Step 9: LTV-Adjusted CPA ───
  const ltvMultiplier = 1 + repeatPurchaseRate * 2
  const sustainableCPA = getSustainableCPA(effectiveAOV, grossMargin, repeatPurchaseRate)

  // Break-even calculations
  const breakEvenCpa = effectiveAOV * grossMargin
  const breakEvenRoas = effectiveAOV > 0 ? 1 / grossMargin : 0

  if (repeatPurchaseRate > 0.2) {
    warnings.push(`High repeat rate (${Math.round(repeatPurchaseRate * 100)}%) — LTV-adjusted CPA is ₹${Math.round(sustainableCPA)} vs single-purchase ₹${Math.round(effectiveAOV * grossMargin / 2)}. M1 loss may be acceptable.`)
  }

  // ─── Step 10: Windsor benchmark overrides ───
  const useWindsor = dataMode === 'windsor' && windsorOverrides && windsorOverrides.dataQuality !== 'insufficient'

  // ─── Step 11: Build base projection ───
  function buildProjection(roasTargetsForScenario: [number, number, number]): [MonthProjection, MonthProjection, MonthProjection] {
    const cumulativeCustomers: number[] = []
    const projection = rawSpends.map((totalSpend, i) => {
      const metaSpend = totalSpend * split.meta
      const googleSpend = totalSpend * split.google
      const efficiency = efficiencyMultipliers[i]
      const roas = roasTargetsForScenario[i] * efficiency
      const newCustomerRevenue = totalSpend * roas
      const newPurchases = Math.round(newCustomerRevenue / effectiveAOV)

      let repeatRevenue = 0
      for (let prev = 0; prev < i; prev++) {
        repeatRevenue += cumulativeCustomers[prev] * repeatPurchaseRate * effectiveAOV
      }

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
        efficiencyMultiplier: efficiency,
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

    return projection
  }

  const projection = buildProjection(roasTargets)

  // ─── Step 12: Scenario Modeling ───
  const scenarios: ScenarioPlan[] = (['conservative', 'base', 'aggressive'] as ScenarioType[]).map(type => {
    const config = SCENARIO_CONFIG[type]
    const scenarioRoas = roasTargets.map(r => r * config.roasMultiplier) as [number, number, number]
    return {
      type,
      label: config.label,
      roasMultiplier: config.roasMultiplier,
      projection: buildProjection(scenarioRoas),
    }
  })

  // ─── Step 13: Creative capacity warning ───
  const maxNeeded = Math.max(...projection.map(p => p.creativesNeeded))
  const cap = CREATIVE_CAPS[creativeCapacity]
  if (maxNeeded > cap) {
    warnings.push(`Creative bottleneck — plan needs ${maxNeeded}/mo but capacity is ${cap}. Prioritize TOF Reels.`)
  }

  // ─── Step 14: Meta Campaign Breakdown ───
  const metaCampaignDefs: { name: MetaCampaignName; funnel: string; getPct: (month: number) => number }[] = [
    {
      name: tofCampaignName as MetaCampaignName,
      funnel: 'TOF',
      getPct: () => dynamicFunnel.tof,
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

      // Use Windsor overrides if available, otherwise use benchmarks
      let b = benchmarks[i]
      if (useWindsor && windsorOverrides) {
        b = {
          cpm: windsorOverrides.metaCpm > 0 ? windsorOverrides.metaCpm : b.cpm,
          ctr: windsorOverrides.metaCtr > 0 ? windsorOverrides.metaCtr : b.ctr,
          convRate: windsorOverrides.metaConvRate > 0 ? windsorOverrides.metaConvRate : b.convRate,
          aovMultiplier: b.aovMultiplier,
        }
      }

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

  // ─── Step 15: Google Campaign Breakdown ───
  const googleCampaignNames = Object.keys(GOOGLE_ALLOCATION) as GoogleCampaignName[]
  const googleCampaigns: GoogleCampaignRow[] = googleCampaignNames.map(name => {
    const allocations = GOOGLE_ALLOCATION[name]
    const benchmarks = GOOGLE_BENCHMARKS[name]

    const months = [0, 1, 2].map(i => {
      const budget = projection[i].googleSpend * allocations[i]

      let b = benchmarks[i]
      if (useWindsor && windsorOverrides && windsorOverrides.googleCpc > 0) {
        b = {
          cpc: windsorOverrides.googleCpc,
          ctr: windsorOverrides.googleCtr > 0 ? windsorOverrides.googleCtr : b.ctr,
          convRate: windsorOverrides.googleConvRate > 0 ? windsorOverrides.googleConvRate : b.convRate,
          aovMultiplier: b.aovMultiplier,
        }
      }

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

  // ─── Step 16: Creative matrix ───
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

  // ─── Step 17: Assumptions ───
  const assumptions: Assumptions = {
    spendGrowthRate: growthRate,
    efficiencyPenalty: efficiencyMultipliers,
    roasSource,
    benchmarkSource: useWindsor ? 'windsor-actuals' : 'india-industry',
    platformSplitReason: useWindsor
      ? `Blended: 60% Windsor actuals + 40% industry recommendation for ${industry}`
      : `Industry-adjusted: ${industry} has ${split.google > 0.20 ? 'high' : 'moderate'} search intent`,
    breakEvenRoas: breakEvenRoas,
    breakEvenCpa: breakEvenCpa,
    seasonalityApplied: convMult !== 1.0 || cpmMult !== 1.0,
  }

  // Windsor-specific warnings
  if (useWindsor && windsorOverrides) {
    if (windsorOverrides.avgFrequency > 3) {
      warnings.push(`High ad frequency (${windsorOverrides.avgFrequency.toFixed(1)}x) detected in Windsor data — audience saturation risk. Consider expanding targeting or increasing creative refresh rate.`)
    }
    if (windsorOverrides.dataQuality === 'partial') {
      warnings.push('Windsor data is partial — only one platform connected. Benchmarks used for the other.')
    }
  }

  return {
    brand: brandName,
    industry,
    stage,
    quarter,
    brandType,
    dataMode,
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
    assumptions,
    projection,
    scenarios,
    metaCampaigns,
    googleCampaigns,
    creativeMatrix,
  }
}
