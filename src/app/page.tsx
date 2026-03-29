'use client'

import { useState, useRef } from 'react'
import type { MediaPlanInputs, MediaPlan } from '@/lib/types'
import { generateMediaPlan } from '@/lib/calculator'
import { INDUSTRY_LABELS, DEFAULT_MARGIN, DEFAULT_REPEAT_RATE } from '@/lib/constants'
import InputForm from '@/components/InputForm'
import ProjectionTable from '@/components/ProjectionTable'
import CampaignTable from '@/components/CampaignTable'
import CreativeMatrix from '@/components/CreativeMatrix'
import Warnings from '@/components/Warnings'
import PrintLayout from '@/components/PrintLayout'
import { BudgetSplitChart, RevenueChart } from '@/components/Charts'

const STAGE_LABELS = ['', 'PMF (₹0-3L)', 'Performance Scale (₹3-30L)', 'Optimization (₹30-60L)', 'Amplification (₹60L+)']

export default function Home() {
  const [inputs, setInputs] = useState<MediaPlanInputs>({
    brandName: '',
    industry: 'fashion',
    brandType: 'existing',
    quarter: 'Q1',
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
  })
  const [plan, setPlan] = useState<MediaPlan | null>(null)
  const dashboardRef = useRef<HTMLDivElement>(null)

  const handleGenerate = () => {
    if (!inputs.brandName || !inputs.monthlyAdSpend || !inputs.aov) return
    setPlan(generateMediaPlan(inputs))
  }

  const handleExportPDF = () => {
    window.print()
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hovers-logo.svg" alt="Hovers" className="h-8" />
          <div className="border-l border-zinc-700 pl-3 ml-1">
            <h1 className="text-sm font-bold tracking-wider uppercase">Media Plan Generator</h1>
          </div>
        </div>
        {plan && (
          <button onClick={handleExportPDF}
            className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-xs font-bold rounded-lg uppercase tracking-wider transition-colors">
            Download PDF
          </button>
        )}
      </header>

      <div className="flex no-print">
        <aside className="w-80 min-w-80 border-r border-zinc-800 p-4 overflow-y-auto h-[calc(100vh-57px)]">
          <InputForm inputs={inputs} onChange={setInputs} onGenerate={handleGenerate} />
        </aside>

        <main className="flex-1 overflow-y-auto h-[calc(100vh-57px)] p-6">
          {!plan ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-6xl mb-4 opacity-10">📊</div>
                <p className="text-zinc-600 text-sm">Fill in the inputs and click Generate</p>
              </div>
            </div>
          ) : (
            <div ref={dashboardRef} className="space-y-6 max-w-6xl">
              <div>
                <h2 className="text-xl font-bold">{plan.brand}</h2>
                <p className="text-xs text-zinc-500 mt-1">
                  {INDUSTRY_LABELS[plan.industry]} · Stage {plan.stage}: {STAGE_LABELS[plan.stage]} · {plan.quarter} · {plan.brandType === 'preLaunch' ? 'Pre-Launch' : plan.brandType === 'vcBacked' ? 'VC-Backed' : 'Existing Brand'}
                </p>
              </div>

              <Warnings
                warnings={plan.warnings}
                pixelStrategy={plan.pixelStrategy}
                sustainableCPA={plan.sustainableCPA}
                ltvMultiplier={plan.ltvMultiplier}
                effectiveAOV={plan.effectiveAOV}
              />

              <ProjectionTable projection={plan.projection} seasonalityNote={plan.seasonalityNote} />

              <div className="grid grid-cols-2 gap-4">
                <BudgetSplitChart meta={plan.platformSplit.meta} google={plan.platformSplit.google} />
                <RevenueChart projection={plan.projection} />
              </div>

              <CampaignTable title="Meta Campaigns" color="bg-blue-500" campaigns={plan.metaCampaigns} />
              <CampaignTable title="Google Campaigns" color="bg-green-500" campaigns={plan.googleCampaigns} />
              <CreativeMatrix matrix={plan.creativeMatrix} />
            </div>
          )}
        </main>
      </div>

      {/* Print-only layout: dense 1-page design */}
      {plan && <PrintLayout plan={plan} />}
    </div>
  )
}
