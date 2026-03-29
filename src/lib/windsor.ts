// Windsor.ai integration — fetches actual ad performance data
// and computes benchmark overrides for the media plan generator

export interface WindsorAccount {
  connector: 'facebook' | 'google_ads'
  id: string
  name: string
}

export interface WindsorMetrics {
  // Meta actuals (last 90 days)
  meta: {
    avgCpm: number
    avgCpc: number
    avgCtr: number
    avgConvRate: number
    avgRoas: number
    avgCpa: number
    totalSpend: number
    totalRevenue: number
    totalPurchases: number
    totalImpressions: number
    totalClicks: number
    avgFrequency: number
    reach: number
    // Per-campaign breakdown
    campaigns: {
      name: string
      objective: string
      spend: number
      roas: number
      cpm: number
      cpc: number
      ctr: number
      convRate: number
      purchases: number
    }[]
  } | null

  // Google Ads actuals
  google: {
    avgCpc: number
    avgCtr: number
    avgConvRate: number
    avgRoas: number
    totalSpend: number
    totalRevenue: number
    totalClicks: number
    campaigns: {
      name: string
      type: string
      spend: number
      roas: number
      cpc: number
      ctr: number
      convRate: number
    }[]
  } | null

  // Computed for the plan
  currentBlendedRoas: number
  currentMonthlySpend: number
  currentMonthlyRevenue: number
  platformSplitActual: { meta: number; google: number }
  dataQuality: 'strong' | 'partial' | 'insufficient'
}

const META_FIELDS = [
  'campaign', 'campaign_objective', 'spend', 'impressions', 'clicks',
  'cpm', 'cpc', 'ctr', 'actions_purchase', 'action_values_purchase',
  'frequency', 'reach',
].join(',')

const GOOGLE_FIELDS = [
  'campaign', 'campaign_type', 'spend', 'impressions', 'clicks',
  'cpc', 'ctr', 'conversions', 'conversion_value',
].join(',')

export async function fetchWindsorAccounts(): Promise<WindsorAccount[]> {
  const res = await fetch('/api/windsor/accounts')
  if (!res.ok) return []
  const data = await res.json()
  return data.accounts ?? []
}

export async function fetchWindsorMetrics(
  metaAccountName?: string,
  googleAccountName?: string,
): Promise<WindsorMetrics> {
  const results: WindsorMetrics = {
    meta: null,
    google: null,
    currentBlendedRoas: 0,
    currentMonthlySpend: 0,
    currentMonthlyRevenue: 0,
    platformSplitActual: { meta: 0.5, google: 0.5 },
    dataQuality: 'insufficient',
  }

  const fetches: Promise<void>[] = []

  // Fetch Meta data
  if (metaAccountName) {
    fetches.push(
      fetch(`/api/windsor?connector=facebook&fields=${META_FIELDS}&date_preset=last_90d&account_name=${encodeURIComponent(metaAccountName)}`)
        .then(r => r.json())
        .then(data => {
          if (data?.data?.length) {
            results.meta = computeMetaMetrics(data.data)
          }
        })
        .catch(() => {}),
    )
  }

  // Fetch Google data
  if (googleAccountName) {
    fetches.push(
      fetch(`/api/windsor?connector=google_ads&fields=${GOOGLE_FIELDS}&date_preset=last_90d&account_name=${encodeURIComponent(googleAccountName)}`)
        .then(r => r.json())
        .then(data => {
          if (data?.data?.length) {
            results.google = computeGoogleMetrics(data.data)
          }
        })
        .catch(() => {}),
    )
  }

  await Promise.all(fetches)

  // Compute blended metrics
  const metaSpend = results.meta?.totalSpend ?? 0
  const googleSpend = results.google?.totalSpend ?? 0
  const totalSpend = metaSpend + googleSpend
  const metaRevenue = results.meta?.totalRevenue ?? 0
  const googleRevenue = results.google?.totalRevenue ?? 0
  const totalRevenue = metaRevenue + googleRevenue

  if (totalSpend > 0) {
    results.currentBlendedRoas = totalRevenue / totalSpend
    results.currentMonthlySpend = totalSpend / 3 // 90 days → monthly
    results.currentMonthlyRevenue = totalRevenue / 3
    results.platformSplitActual = {
      meta: metaSpend / totalSpend,
      google: googleSpend / totalSpend,
    }
  }

  // Data quality assessment
  if (results.meta && results.google) {
    results.dataQuality = 'strong'
  } else if (results.meta || results.google) {
    results.dataQuality = 'partial'
  }

  return results
}

function computeMetaMetrics(rows: Record<string, unknown>[]): WindsorMetrics['meta'] {
  let totalSpend = 0, totalImpressions = 0, totalClicks = 0
  let totalPurchases = 0, totalRevenue = 0
  let totalFrequency = 0, totalReach = 0, freqCount = 0

  const campaignMap = new Map<string, {
    objective: string; spend: number; revenue: number; purchases: number
    impressions: number; clicks: number
  }>()

  for (const row of rows) {
    const spend = num(row.spend)
    const impressions = num(row.impressions)
    const clicks = num(row.clicks)
    const purchases = num(row.actions_purchase)
    const revenue = num(row.action_values_purchase)
    const freq = num(row.frequency)
    const reach = num(row.reach)
    const campaign = String(row.campaign ?? 'Unknown')
    const objective = String(row.campaign_objective ?? '')

    totalSpend += spend
    totalImpressions += impressions
    totalClicks += clicks
    totalPurchases += purchases
    totalRevenue += revenue
    if (freq > 0) { totalFrequency += freq; freqCount++ }
    totalReach += reach

    const existing = campaignMap.get(campaign)
    if (existing) {
      existing.spend += spend
      existing.revenue += revenue
      existing.purchases += purchases
      existing.impressions += impressions
      existing.clicks += clicks
    } else {
      campaignMap.set(campaign, { objective, spend, revenue, purchases, impressions, clicks })
    }
  }

  const campaigns = Array.from(campaignMap.entries())
    .map(([name, d]) => ({
      name,
      objective: d.objective,
      spend: d.spend,
      roas: d.spend > 0 ? d.revenue / d.spend : 0,
      cpm: d.impressions > 0 ? (d.spend / d.impressions) * 1000 : 0,
      cpc: d.clicks > 0 ? d.spend / d.clicks : 0,
      ctr: d.impressions > 0 ? d.clicks / d.impressions : 0,
      convRate: d.clicks > 0 ? d.purchases / d.clicks : 0,
      purchases: d.purchases,
    }))
    .sort((a, b) => b.spend - a.spend)

  return {
    avgCpm: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0,
    avgCpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
    avgCtr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
    avgConvRate: totalClicks > 0 ? totalPurchases / totalClicks : 0,
    avgRoas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
    avgCpa: totalPurchases > 0 ? totalSpend / totalPurchases : 0,
    totalSpend,
    totalRevenue,
    totalPurchases,
    totalImpressions,
    totalClicks,
    avgFrequency: freqCount > 0 ? totalFrequency / freqCount : 0,
    reach: totalReach,
    campaigns,
  }
}

function computeGoogleMetrics(rows: Record<string, unknown>[]): WindsorMetrics['google'] {
  let totalSpend = 0, totalClicks = 0, totalImpressions = 0
  let totalConversions = 0, totalRevenue = 0

  const campaignMap = new Map<string, {
    type: string; spend: number; revenue: number; conversions: number
    clicks: number; impressions: number
  }>()

  for (const row of rows) {
    const spend = num(row.spend)
    const clicks = num(row.clicks)
    const impressions = num(row.impressions)
    const conversions = num(row.conversions)
    const revenue = num(row.conversion_value)
    const campaign = String(row.campaign ?? 'Unknown')
    const type = String(row.campaign_type ?? '')

    totalSpend += spend
    totalClicks += clicks
    totalImpressions += impressions
    totalConversions += conversions
    totalRevenue += revenue

    const existing = campaignMap.get(campaign)
    if (existing) {
      existing.spend += spend
      existing.revenue += revenue
      existing.conversions += conversions
      existing.clicks += clicks
      existing.impressions += impressions
    } else {
      campaignMap.set(campaign, { type, spend, revenue, conversions, clicks, impressions })
    }
  }

  const campaigns = Array.from(campaignMap.entries())
    .map(([name, d]) => ({
      name,
      type: d.type,
      spend: d.spend,
      roas: d.spend > 0 ? d.revenue / d.spend : 0,
      cpc: d.clicks > 0 ? d.spend / d.clicks : 0,
      ctr: d.impressions > 0 ? d.clicks / d.impressions : 0,
      convRate: d.clicks > 0 ? d.conversions / d.clicks : 0,
    }))
    .sort((a, b) => b.spend - a.spend)

  return {
    avgCpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
    avgCtr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
    avgConvRate: totalClicks > 0 ? totalConversions / totalClicks : 0,
    avgRoas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
    totalSpend,
    totalRevenue,
    totalClicks,
    campaigns,
  }
}

function num(val: unknown): number {
  if (typeof val === 'number') return val
  if (typeof val === 'string') return parseFloat(val) || 0
  return 0
}
