'use client'

import { useState, useRef, useEffect } from 'react'
import type { MediaPlanInputs, MediaPlan, Industry, Quarter, BrandType, PixelMaturity, CreativeCapacity } from '@/lib/types'
import { generateMediaPlan } from '@/lib/calculator'
import { INDUSTRY_LABELS, DEFAULT_MARGIN, DEFAULT_REPEAT_RATE, DEFAULT_GROWTH_RATE } from '@/lib/constants'
import { fetchWindsorAccounts, type WindsorAccount } from '@/lib/windsor'
import { formatINR } from '@/lib/format'
import ProjectionTable from '@/components/ProjectionTable'
import CampaignTable from '@/components/CampaignTable'
import CreativeMatrix from '@/components/CreativeMatrix'
import Warnings from '@/components/Warnings'
import AssumptionsBox from '@/components/AssumptionsBox'
import ScenarioTable from '@/components/ScenarioTable'
import PrintLayout from '@/components/PrintLayout'
import { BudgetSplitChart, RevenueChart } from '@/components/Charts'
import ChatPanel from '@/components/ChatPanel'

const STAGE_LABELS = ['', 'PMF (₹0-3L)', 'Performance Scale (₹3-30L)', 'Optimization (₹30-60L)', 'Amplification (₹60L+)']

function getCurrentQuarter(): Quarter {
  const m = new Date().getMonth()
  if (m < 3) return 'Q1'
  if (m < 6) return 'Q2'
  if (m < 9) return 'Q3'
  return 'Q4'
}

type AppMode = 'landing' | 'generating' | 'review' | 'plan'

interface GenerationResult {
  windsor: Record<string, unknown> | null
  site: Record<string, unknown> | null
  recommendation: {
    spendGrowthRate: number
    growthReasoning: string
    overallStrategy: string
    warnings: string[]
    confidence: 'high' | 'medium' | 'low'
  } | null
}

const makeInputs = (): MediaPlanInputs => ({
  brandName: '',
  industry: 'fashion',
  brandType: 'existing',
  quarter: getCurrentQuarter(),
  monthlyRevenue: 0,
  monthlyAdSpend: 0,
  aov: 0,
  grossMargin: DEFAULT_MARGIN['fashion'],
  currentRoas: null,
  monthlyTraffic: null,
  emailListSize: 0,
  skuCount: 50,
  repeatPurchaseRate: DEFAULT_REPEAT_RATE['fashion'],
  avgDiscount: 0.10,
  pixelMaturity: 'mature',
  creativeCapacity: 'medium',
  inventoryValue: null,
  spendGrowthRate: DEFAULT_GROWTH_RATE['existing'],
  platformSplitOverride: null,
  dataMode: 'benchmark',
  windsorOverrides: null,
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Main App
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function Home() {
  const [mode, setMode] = useState<AppMode>('landing')
  const [inputs, setInputs] = useState<MediaPlanInputs>(makeInputs)
  const [plan, setPlan] = useState<MediaPlan | null>(null)
  const [autoFilled, setAutoFilled] = useState<Record<string, boolean>>({})
  const dashboardRef = useRef<HTMLDivElement>(null)

  // Landing
  const [siteUrl, setSiteUrl] = useState('')
  const [windsorAccounts, setWindsorAccounts] = useState<WindsorAccount[]>([])
  const [selectedMeta, setSelectedMeta] = useState('')
  const [selectedGoogle, setSelectedGoogle] = useState('')

  // Generation
  const [genStep, setGenStep] = useState(0) // 0=idle 1=windsor 2=site 3=claude
  const [genResult, setGenResult] = useState<GenerationResult | null>(null)

  // Chat & Versions
  const [chatOpen, setChatOpen] = useState(true)
  const [planVersions, setPlanVersions] = useState<{ inputs: MediaPlanInputs; plan: MediaPlan; label: string; timestamp: number }[]>([])
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    fetchWindsorAccounts().then(setWindsorAccounts).catch(() => {})
  }, [])

  const metaAccounts = windsorAccounts.filter(a => a.connector === 'facebook')
  const googleAccounts = windsorAccounts.filter(a => a.connector === 'google_ads')

  // ─── Generate ───
  const handleGenerate = async () => {
    if (!siteUrl && !selectedMeta && !selectedGoogle) return
    setMode('generating')
    setGenStep(1)

    try {
      const res = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl: siteUrl || undefined,
          metaAccountId: selectedMeta || undefined,
          googleAccountId: selectedGoogle || undefined,
        }),
      })
      setGenStep(3)
      const result = await res.json()
      setGenResult(result)

      // Populate inputs
      const next = makeInputs()
      const filled: Record<string, boolean> = {}

      if (result.site) {
        const s = result.site
        if (s.brandName) { next.brandName = s.brandName; filled.brandName = true }
        if (s.industry && Object.keys(INDUSTRY_LABELS).includes(s.industry)) {
          next.industry = s.industry as Industry
          next.grossMargin = s.grossMargin ?? DEFAULT_MARGIN[s.industry as Industry]
          next.repeatPurchaseRate = DEFAULT_REPEAT_RATE[s.industry as Industry]
          filled.industry = true; filled.grossMargin = true
        }
        if (s.skuCount) { next.skuCount = s.skuCount; filled.skuCount = true }
        if (s.aov) { next.aov = s.aov; filled.aov = true }
        if (s.avgDiscount != null) { next.avgDiscount = s.avgDiscount; filled.avgDiscount = true }
        if (s.grossMargin != null) { next.grossMargin = s.grossMargin; filled.grossMargin = true }
      }

      if (result.windsor) {
        const w = result.windsor
        next.dataMode = 'windsor'
        if (w.blended) {
          if (w.blended.monthlySpend > 0) { next.monthlyAdSpend = Math.round(w.blended.monthlySpend); filled.monthlyAdSpend = true }
          if (w.blended.monthlyRevenue > 0) { next.monthlyRevenue = Math.round(w.blended.monthlyRevenue); filled.monthlyRevenue = true }
          if (w.blended.roas > 0) { next.currentRoas = Math.round(w.blended.roas * 10) / 10; filled.currentRoas = true }
          if (w.blended.aov) { next.aov = w.blended.aov; filled.aov = true }
        }
        if (w.inferred) {
          next.pixelMaturity = w.inferred.pixelMaturity; filled.pixelMaturity = true
          next.brandType = w.inferred.brandType; filled.brandType = true
        }
        if (w.meta || w.google) {
          next.windsorOverrides = {
            metaCpm: w.meta?.cpm ?? 0, metaCpc: w.meta?.cpc ?? 0,
            metaCtr: w.meta?.ctr ?? 0, metaConvRate: w.meta?.convRate ?? 0,
            metaRoas: w.meta?.roas ?? 0, metaCpa: w.meta?.cpa ?? 0,
            googleCpc: w.google?.cpc ?? 0, googleCtr: w.google?.ctr ?? 0,
            googleConvRate: w.google?.convRate ?? 0, googleRoas: w.google?.roas ?? 0,
            actualPlatformSplit: w.blended?.platformSplit ?? { meta: 0.5, google: 0.5 },
            avgFrequency: w.meta?.frequency ?? 0,
            dataQuality: (w.meta && w.google) ? 'strong' : 'partial',
          }
        }
      }

      if (result.recommendation) {
        next.spendGrowthRate = result.recommendation.spendGrowthRate
        filled.spendGrowthRate = true
      }

      setInputs(next)
      setAutoFilled(filled)

      // Auto-generate plan if we have enough data
      if (next.brandName && next.monthlyAdSpend && next.aov) {
        const newPlan = generateMediaPlan(next)
        setPlan(newPlan)
        setPlanVersions([{ inputs: { ...next }, plan: newPlan, label: 'Initial plan', timestamp: Date.now() }])
        setMode('plan')
      } else {
        setMode('review')
      }
    } catch (err) {
      console.error('Generation failed:', err)
      setMode('review')
    }
  }

  const handleBuildPlan = () => {
    if (!inputs.brandName || !inputs.monthlyAdSpend || !inputs.aov) return
    const newPlan = generateMediaPlan(inputs)
    setPlan(newPlan)
    setPlanVersions([{ inputs: { ...inputs }, plan: newPlan, label: 'Initial plan', timestamp: Date.now() }])
    setMode('plan')
  }

  const handleChatChanges = (changes: Record<string, unknown>) => {
    // Save current version before applying changes
    if (plan) {
      setPlanVersions(prev => [...prev, { inputs: { ...inputs }, plan, label: 'Before refinement', timestamp: Date.now() }])
    }
    const next = { ...inputs, ...changes } as MediaPlanInputs
    setInputs(next)
    const newPlan = generateMediaPlan(next)
    setPlan(newPlan)
  }

  const handleRestoreVersion = (index: number) => {
    const v = planVersions[index]
    setInputs(v.inputs)
    setPlan(v.plan)
  }

  const handleStartOver = () => {
    setMode('landing')
    setInputs(makeInputs())
    setPlan(null)
    setAutoFilled({})
    setGenResult(null)
    setGenStep(0)
    setSiteUrl('')
    setSelectedMeta('')
    setSelectedGoogle('')
    setShowSettings(false)
    setPlanVersions([])
  }

  const set = <K extends keyof MediaPlanInputs>(key: K, val: MediaPlanInputs[K]) => {
    const next = { ...inputs, [key]: val }
    if (key === 'industry') {
      const ind = val as Industry
      next.grossMargin = DEFAULT_MARGIN[ind]
      next.repeatPurchaseRate = DEFAULT_REPEAT_RATE[ind]
    }
    if (key === 'brandType') {
      next.spendGrowthRate = DEFAULT_GROWTH_RATE[val as string] ?? 1.2
    }
    setInputs(next)
  }

  // ━━━ LANDING ━━━
  if (mode === 'landing') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
        <Nav />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md space-y-5">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold mb-1">Generate a Media Plan</h2>
              <p className="text-zinc-500 text-xs">Enter a website and connect ad accounts. AI handles the rest.</p>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-500 mb-1.5 uppercase tracking-wider">Website URL</label>
              <input type="url" value={siteUrl} onChange={e => setSiteUrl(e.target.value)}
                placeholder="https://brand.com"
                className="w-full bg-zinc-900/80 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-zinc-600 transition-colors"
                onKeyDown={e => e.key === 'Enter' && handleGenerate()}
              />
            </div>

            {windsorAccounts.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {metaAccounts.length > 0 && (
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 mb-1.5 uppercase tracking-wider">Meta Ads</label>
                    <select value={selectedMeta} onChange={e => setSelectedMeta(e.target.value)}
                      className="w-full bg-zinc-900/80 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-zinc-600 transition-colors">
                      <option value="">Select account</option>
                      {metaAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                )}
                {googleAccounts.length > 0 && (
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 mb-1.5 uppercase tracking-wider">Google Ads</label>
                    <select value={selectedGoogle} onChange={e => setSelectedGoogle(e.target.value)}
                      className="w-full bg-zinc-900/80 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-zinc-600 transition-colors">
                      <option value="">Select account</option>
                      {googleAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}

            <button onClick={handleGenerate}
              disabled={!siteUrl && !selectedMeta && !selectedGoogle}
              className="w-full py-3 bg-red-700 hover:bg-red-600 disabled:bg-zinc-800/50 disabled:text-zinc-700 text-white font-bold rounded-lg text-xs uppercase tracking-widest transition-colors mt-2">
              Generate Plan
            </button>

            <button onClick={() => setMode('review')}
              className="w-full text-center text-[10px] text-zinc-700 hover:text-zinc-500 transition-colors">
              enter inputs manually
            </button>
          </div>
        </main>
      </div>
    )
  }

  // ━━━ GENERATING ━━━
  if (mode === 'generating') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="w-full max-w-xs space-y-4 text-center">
          <div className="w-8 h-8 border-2 border-red-700 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-zinc-300">
            {genStep === 1 && 'Pulling ad performance data...'}
            {genStep === 2 && 'Analyzing website...'}
            {genStep === 3 && 'Building your plan...'}
          </p>
          <p className="text-[10px] text-zinc-600">This takes 10-20 seconds</p>
        </div>
      </div>
    )
  }

  // ━━━ REVIEW (missing data — need manual input) ━━━
  if (mode === 'review' && !plan) {
    const rec = genResult?.recommendation
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
        <Nav right={<button onClick={handleStartOver} className="text-xs text-zinc-500 hover:text-white transition-colors">Start Over</button>} />

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">

            {/* AI Strategy Banner */}
            {rec && rec.confidence !== 'low' && (
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-900/60 text-violet-300 uppercase">AI Strategy</span>
                  <span className="text-[9px] text-zinc-600">{rec.confidence} confidence</span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">{rec.overallStrategy}</p>
                {rec.warnings.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {rec.warnings.map((w, i) => (
                      <span key={i} className="text-[9px] text-amber-500/80 bg-amber-900/20 px-2 py-0.5 rounded">⚠ {w}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Auto-filled summary */}
            {Object.keys(autoFilled).length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {autoFilled.brandName && <Chip label="Brand" value={inputs.brandName} />}
                {autoFilled.industry && <Chip label="Industry" value={INDUSTRY_LABELS[inputs.industry]} />}
                {autoFilled.monthlyAdSpend && <Chip label="Ad Spend/mo" value={formatINR(inputs.monthlyAdSpend)} />}
                {autoFilled.monthlyRevenue && <Chip label="Revenue/mo" value={formatINR(inputs.monthlyRevenue)} />}
                {autoFilled.currentRoas && <Chip label="ROAS" value={`${inputs.currentRoas}x`} />}
                {autoFilled.aov && <Chip label="AOV" value={formatINR(inputs.aov)} />}
                {autoFilled.pixelMaturity && <Chip label="Pixel" value={inputs.pixelMaturity} />}
                {autoFilled.brandType && <Chip label="Type" value={inputs.brandType} />}
              </div>
            )}

            <div className="border-t border-zinc-800/50 pt-6">
              <h3 className="text-sm font-bold text-zinc-300 mb-4">
                {Object.keys(autoFilled).length > 0 ? 'Complete the missing fields' : 'Enter plan details'}
              </h3>

              <div className="grid grid-cols-2 gap-4">
                {!autoFilled.brandName && (
                  <InputField label="Brand Name" value={inputs.brandName} onChange={v => set('brandName', v)} placeholder="e.g. Blissclub" />
                )}
                {!autoFilled.industry && (
                  <SelectField label="Industry" value={inputs.industry} onChange={v => set('industry', v as Industry)}
                    options={Object.entries(INDUSTRY_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
                )}
                {!autoFilled.monthlyAdSpend && (
                  <InputField label="Monthly Ad Spend (₹)" type="number" value={inputs.monthlyAdSpend || ''} onChange={v => set('monthlyAdSpend', Number(v))} placeholder="500000" />
                )}
                {!autoFilled.aov && (
                  <InputField label="AOV (₹)" type="number" value={inputs.aov || ''} onChange={v => set('aov', Number(v))} placeholder="1800" />
                )}
                {!autoFilled.monthlyRevenue && (
                  <InputField label="Monthly Revenue (₹)" type="number" value={inputs.monthlyRevenue || ''} onChange={v => set('monthlyRevenue', Number(v))} placeholder="0 for pre-launch" />
                )}
                {!autoFilled.grossMargin && (
                  <InputField label={`Gross Margin (${Math.round(inputs.grossMargin * 100)}%)`} type="range" value={inputs.grossMargin * 100}
                    onChange={v => set('grossMargin', Number(v) / 100)} min={10} max={80} />
                )}
              </div>
            </div>

            <button onClick={handleBuildPlan}
              disabled={!inputs.brandName || !inputs.monthlyAdSpend || !inputs.aov}
              className="w-full py-3 bg-red-700 hover:bg-red-600 disabled:bg-zinc-800/50 disabled:text-zinc-700 text-white font-bold rounded-lg text-xs uppercase tracking-widest transition-colors">
              Generate Media Plan
            </button>
          </div>
        </main>
      </div>
    )
  }

  // ━━━ PLAN ━━━
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Nav right={
        <div className="flex items-center gap-3">
          <button onClick={() => setChatOpen(!chatOpen)}
            className={`text-xs transition-colors ${chatOpen ? 'text-violet-400 hover:text-violet-300' : 'text-zinc-500 hover:text-white'}`}>
            {chatOpen ? 'Hide Chat' : 'Chat'}
          </button>
          <button onClick={() => setShowSettings(!showSettings)}
            className="text-xs text-zinc-500 hover:text-white transition-colors">
            {showSettings ? 'Hide Settings' : 'Edit Inputs'}
          </button>
          <button onClick={handleStartOver} className="text-xs text-zinc-500 hover:text-white transition-colors">New Plan</button>
          {plan && plan.dataMode === 'windsor' && (
            <span className="text-[9px] font-bold px-2 py-1 rounded bg-emerald-900/50 text-emerald-400 uppercase">Live Data</span>
          )}
          <button onClick={() => window.print()}
            className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-xs font-bold rounded-lg uppercase tracking-wider transition-colors">
            Export PDF
          </button>
        </div>
      } />

      {/* Collapsible Settings Drawer */}
      {showSettings && (
        <div className="border-b border-zinc-800 bg-zinc-900/30 no-print">
          <div className="max-w-6xl mx-auto px-6 py-4">
            {/* AI Strategy */}
            {genResult?.recommendation && genResult.recommendation.confidence !== 'low' && (
              <div className="mb-4 p-3 rounded-lg border border-zinc-800 bg-zinc-900/50">
                <p className="text-[10px] text-violet-300 font-bold uppercase mb-1">AI Strategy</p>
                <p className="text-xs text-zinc-400">{genResult.recommendation.overallStrategy}</p>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              <EditableChip label="Brand" value={inputs.brandName} onChange={v => set('brandName', v)} auto={autoFilled.brandName} />
              <div>
                <label className="block text-[9px] font-bold text-zinc-600 uppercase mb-1">Industry</label>
                <select value={inputs.industry} onChange={e => set('industry', e.target.value as Industry)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none">
                  {Object.entries(INDUSTRY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <EditableChip label="Ad Spend/mo" value={inputs.monthlyAdSpend} onChange={v => set('monthlyAdSpend', Number(v))} auto={autoFilled.monthlyAdSpend} type="number" />
              <EditableChip label="Revenue/mo" value={inputs.monthlyRevenue} onChange={v => set('monthlyRevenue', Number(v))} auto={autoFilled.monthlyRevenue} type="number" />
              <EditableChip label="AOV" value={inputs.aov} onChange={v => set('aov', Number(v))} auto={autoFilled.aov} type="number" />
              <EditableChip label="ROAS" value={inputs.currentRoas ?? ''} onChange={v => set('currentRoas', v ? Number(v) : null)} auto={autoFilled.currentRoas} type="number" />
              <div>
                <label className="block text-[9px] font-bold text-zinc-600 uppercase mb-1">Quarter</label>
                <div className="flex gap-1">
                  {(['Q1','Q2','Q3','Q4'] as Quarter[]).map(q => (
                    <button key={q} onClick={() => set('quarter', q)}
                      className={`flex-1 py-1 rounded text-[10px] font-bold ${inputs.quarter === q ? 'bg-red-700 text-white' : 'bg-zinc-800 text-zinc-500'}`}>{q}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-bold text-zinc-600 uppercase mb-1">Brand Type</label>
                <select value={inputs.brandType} onChange={e => set('brandType', e.target.value as BrandType)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none">
                  <option value="existing">Existing</option>
                  <option value="preLaunch">Pre-Launch</option>
                  <option value="vcBacked">VC-Backed</option>
                </select>
              </div>
              <EditableChip label={`Margin ${Math.round(inputs.grossMargin*100)}%`} value={Math.round(inputs.grossMargin*100)} onChange={v => set('grossMargin', Number(v)/100)} type="number" />
              <EditableChip label={`Growth ${Math.round(inputs.spendGrowthRate*100-100)}%/mo`} value={Math.round(inputs.spendGrowthRate*100)} onChange={v => set('spendGrowthRate', Number(v)/100)} type="number" />
              <div>
                <label className="block text-[9px] font-bold text-zinc-600 uppercase mb-1">Pixel</label>
                <div className="flex gap-1">
                  {(['fresh','learning','mature'] as PixelMaturity[]).map(p => (
                    <button key={p} onClick={() => set('pixelMaturity', p)}
                      className={`flex-1 py-1 rounded text-[10px] font-bold capitalize ${inputs.pixelMaturity === p ? 'bg-red-700 text-white' : 'bg-zinc-800 text-zinc-500'}`}>{p}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-bold text-zinc-600 uppercase mb-1">Creative Cap</label>
                <div className="flex gap-1">
                  {(['low','medium','high'] as CreativeCapacity[]).map(c => (
                    <button key={c} onClick={() => set('creativeCapacity', c)}
                      className={`flex-1 py-1 rounded text-[10px] font-bold capitalize ${inputs.creativeCapacity === c ? 'bg-red-700 text-white' : 'bg-zinc-800 text-zinc-500'}`}>{c[0].toUpperCase()}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <button onClick={() => { setPlan(generateMediaPlan(inputs)); setShowSettings(false) }}
                className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-xs font-bold rounded-lg uppercase tracking-wider transition-colors">
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard + Chat */}
      {plan && (
        <>
          <div className="flex no-print" style={{ height: 'calc(100vh - 49px)' }}>
            {/* Plan Content */}
            <main className={`flex-1 overflow-y-auto p-6 transition-all ${chatOpen ? '' : ''}`} ref={dashboardRef}>
              <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex items-baseline justify-between">
                  <div>
                    <h2 className="text-xl font-bold">{plan.brand}</h2>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      {INDUSTRY_LABELS[plan.industry]} · Stage {plan.stage}: {STAGE_LABELS[plan.stage]} · {plan.quarter} · {plan.brandType === 'preLaunch' ? 'Pre-Launch' : plan.brandType === 'vcBacked' ? 'VC-Backed' : 'Existing'}
                    </p>
                  </div>
                </div>

                <AssumptionsBox assumptions={plan.assumptions} dataMode={plan.dataMode} />

                <Warnings warnings={plan.warnings} pixelStrategy={plan.pixelStrategy}
                  sustainableCPA={plan.sustainableCPA} ltvMultiplier={plan.ltvMultiplier} effectiveAOV={plan.effectiveAOV} />

                <ProjectionTable projection={plan.projection} seasonalityNote={plan.seasonalityNote} />
                <ScenarioTable scenarios={plan.scenarios} />

                <div className="grid grid-cols-2 gap-4">
                  <BudgetSplitChart meta={plan.platformSplit.meta} google={plan.platformSplit.google} />
                  <RevenueChart projection={plan.projection} />
                </div>

                <CampaignTable title="Meta Campaigns" color="bg-blue-500" campaigns={plan.metaCampaigns} />
                <CampaignTable title="Google Campaigns" color="bg-green-500" campaigns={plan.googleCampaigns} />
                <CreativeMatrix matrix={plan.creativeMatrix} />
              </div>
            </main>

            {/* Chat Panel */}
            {chatOpen && (
              <aside className="w-96 min-w-96 border-l border-zinc-800 bg-[#0a0a0a]">
                <ChatPanel
                  inputs={inputs}
                  plan={plan}
                  onApplyChanges={handleChatChanges}
                  versions={planVersions}
                  onRestore={handleRestoreVersion}
                />
              </aside>
            )}
          </div>

          {/* Chat toggle if closed */}
          {!chatOpen && (
            <button onClick={() => setChatOpen(true)}
              className="fixed bottom-6 right-6 w-12 h-12 bg-violet-700 hover:bg-violet-600 rounded-full flex items-center justify-center shadow-lg shadow-violet-900/30 transition-colors no-print z-50">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </button>
          )}

          <PrintLayout plan={plan} />
        </>
      )}
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Shared Components
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function Nav({ right }: { right?: React.ReactNode }) {
  return (
    <header className="border-b border-zinc-800/50 px-6 py-3 flex items-center justify-between no-print">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hovers-logo.svg" alt="Hovers" className="h-7" />
        <div className="border-l border-zinc-800 pl-3 ml-1">
          <h1 className="text-xs font-bold tracking-wider uppercase text-zinc-300">Media Plan Generator</h1>
          <p className="text-[9px] text-zinc-600">v3 — AI-Powered</p>
        </div>
      </div>
      {right}
    </header>
  )
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg px-3 py-2">
      <p className="text-[9px] font-bold text-zinc-600 uppercase">{label}</p>
      <p className="text-sm text-white font-medium mt-0.5 truncate">{value}</p>
    </div>
  )
}

function EditableChip({ label, value, onChange, auto, type = 'text' }: {
  label: string; value: string | number; onChange: (v: string) => void; auto?: boolean; type?: string
}) {
  return (
    <div>
      <label className="flex items-center gap-1 text-[9px] font-bold text-zinc-600 uppercase mb-1">
        {label}
        {auto && <span className="text-[7px] px-1 py-px rounded bg-emerald-900/50 text-emerald-500">AUTO</span>}
      </label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-500 transition-colors" />
    </div>
  )
}

function InputField({ label, value, onChange, placeholder, type = 'text', min, max }: {
  label: string; value: string | number; onChange: (v: string) => void; placeholder?: string; type?: string; min?: number; max?: number
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1.5">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        min={min} max={max}
        className="w-full bg-zinc-900/80 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-zinc-600 transition-colors" />
    </div>
  )
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1.5">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-zinc-900/80 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-zinc-600 transition-colors">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
