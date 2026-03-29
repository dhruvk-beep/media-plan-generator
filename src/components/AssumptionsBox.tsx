'use client'

import type { Assumptions, DataMode } from '@/lib/types'
import { formatINR } from '@/lib/format'

interface Props {
  assumptions: Assumptions
  dataMode: DataMode
}

export default function AssumptionsBox({ assumptions, dataMode }: Props) {
  const effLabels = assumptions.efficiencyPenalty.map((e, i) => `M${i + 1}: ${Math.round(e * 100)}%`)

  return (
    <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/30">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Assumptions</h3>
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
          dataMode === 'windsor' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
        }`}>
          {dataMode === 'windsor' ? 'Windsor Actuals' : 'Industry Benchmarks'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[11px]">
        <div className="flex justify-between">
          <span className="text-zinc-500">Spend growth</span>
          <span className="text-zinc-300">{Math.round(assumptions.spendGrowthRate * 100 - 100)}% per month</span>
        </div>

        <div className="flex justify-between">
          <span className="text-zinc-500">ROAS source</span>
          <span className="text-zinc-300">{
            assumptions.roasSource === 'windsor' ? 'Windsor actuals + projected improvement' :
            assumptions.roasSource === 'user-input' ? 'User input + industry trajectory' :
            'India industry benchmark'
          }</span>
        </div>

        <div className="flex justify-between">
          <span className="text-zinc-500">Learning penalty</span>
          <span className="text-zinc-300">{effLabels.join(', ')}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-zinc-500">Platform split</span>
          <span className="text-zinc-300 text-right max-w-[180px] truncate">{assumptions.platformSplitReason}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-zinc-500">Break-even ROAS</span>
          <span className="text-amber-400 font-medium">{assumptions.breakEvenRoas.toFixed(2)}x</span>
        </div>

        <div className="flex justify-between">
          <span className="text-zinc-500">Break-even CPA</span>
          <span className="text-amber-400 font-medium">{formatINR(assumptions.breakEvenCpa)}</span>
        </div>

        {assumptions.seasonalityApplied && (
          <div className="flex justify-between col-span-2">
            <span className="text-zinc-500">Seasonality</span>
            <span className="text-zinc-300">Applied (conversion + CPM adjustments)</span>
          </div>
        )}
      </div>
    </div>
  )
}
