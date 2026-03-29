'use client'

import type { ScenarioPlan } from '@/lib/types'
import { formatINR, formatRoas } from '@/lib/format'

interface Props {
  scenarios: ScenarioPlan[]
}

export default function ScenarioTable({ scenarios }: Props) {
  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-zinc-900/50 border-b border-zinc-800">
        <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Scenario Modeling</h3>
        <p className="text-[10px] text-zinc-600 mt-0.5">Conservative (75% ROAS) · Base (100%) · Aggressive (125%)</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="px-3 py-2 text-left text-zinc-500 font-medium">Scenario</th>
              <th className="px-3 py-2 text-right text-zinc-500 font-medium">M1 Revenue</th>
              <th className="px-3 py-2 text-right text-zinc-500 font-medium">M2 Revenue</th>
              <th className="px-3 py-2 text-right text-zinc-500 font-medium">M3 Revenue</th>
              <th className="px-3 py-2 text-right text-zinc-500 font-medium">Q Total Revenue</th>
              <th className="px-3 py-2 text-right text-zinc-500 font-medium">Q Total Spend</th>
              <th className="px-3 py-2 text-right text-zinc-500 font-medium">Blended ROAS</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((s) => {
              const qRevenue = s.projection.reduce((sum, p) => sum + p.totalRevenue, 0)
              const qSpend = s.projection.reduce((sum, p) => sum + p.totalSpend, 0)
              const blendedRoas = qSpend > 0 ? qRevenue / qSpend : 0

              const rowColor = s.type === 'conservative' ? 'text-orange-400'
                : s.type === 'aggressive' ? 'text-emerald-400'
                : 'text-white'

              const bgColor = s.type === 'base' ? 'bg-zinc-800/30' : ''

              return (
                <tr key={s.type} className={`border-b border-zinc-800/50 ${bgColor}`}>
                  <td className={`px-3 py-2.5 font-medium ${rowColor}`}>
                    {s.label}
                    {s.type === 'base' && <span className="text-[9px] text-zinc-500 ml-1.5">(primary)</span>}
                  </td>
                  {s.projection.map((p, i) => (
                    <td key={i} className="px-3 py-2.5 text-right text-zinc-300">{formatINR(p.totalRevenue)}</td>
                  ))}
                  <td className={`px-3 py-2.5 text-right font-medium ${rowColor}`}>{formatINR(qRevenue)}</td>
                  <td className="px-3 py-2.5 text-right text-zinc-400">{formatINR(qSpend)}</td>
                  <td className={`px-3 py-2.5 text-right font-medium ${rowColor}`}>{formatRoas(blendedRoas)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
