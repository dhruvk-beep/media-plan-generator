'use client'

import type { MonthProjection } from '@/lib/types'
import { formatINR, formatRoas } from '@/lib/format'

const MONTH_LABELS = ['Foundation', 'Optimize', 'Scale']
const MONTH_COLORS = ['text-red-500', 'text-orange-400', 'text-green-500']
const MONTH_BG = ['bg-red-500/10', 'bg-orange-400/10', 'bg-green-500/10']

interface Props {
  projection: [MonthProjection, MonthProjection, MonthProjection]
  seasonalityNote: string
}

export default function ProjectionTable({ projection, seasonalityNote }: Props) {
  const hasRepeat = projection.some(p => p.repeatRevenue > 0)
  const hasRetention = projection.some(p => p.retentionRevenue > 0)

  const rows: { label: string; getValue: (p: MonthProjection) => string; bold?: boolean; getColor?: (p: MonthProjection) => string; show?: boolean; indent?: boolean }[] = [
    { label: 'Meta Ads Spend', getValue: p => formatINR(p.metaSpend), show: true },
    { label: 'Google Ads Spend', getValue: p => formatINR(p.googleSpend), show: true },
    { label: 'Total Ad Spend', getValue: p => formatINR(p.totalSpend) + (p.inventoryCapped ? ' *' : ''), bold: true, show: true },
    { label: 'Target ROAS', getValue: p => formatRoas(p.roas), getColor: p => p.roas >= 2 ? 'text-green-400' : 'text-orange-400', show: true },
    { label: 'New Customer Revenue', getValue: p => formatINR(p.newCustomerRevenue), getColor: () => 'text-green-400', show: true },
    { label: '+ Repeat Revenue', getValue: p => formatINR(p.repeatRevenue), getColor: () => 'text-green-300', indent: true, show: hasRepeat },
    { label: '+ Retention (Email/SMS)', getValue: p => formatINR(p.retentionRevenue), getColor: () => 'text-green-300', indent: true, show: hasRetention },
    { label: 'Total Revenue', getValue: p => formatINR(p.totalRevenue), bold: true, getColor: () => 'text-green-400', show: true },
    { label: 'Purchases / mo', getValue: p => p.purchases.toLocaleString('en-IN'), show: true },
    {
      label: 'Target CPA',
      getValue: p => formatINR(p.cpa),
      getColor: p => p.cpaStatus === 'sustainable' ? 'text-green-400' : p.cpaStatus === 'warning' ? 'text-orange-400' : 'text-red-400',
      show: true,
    },
    { label: 'Sustainable CPA', getValue: p => formatINR(p.sustainableCPA), getColor: () => 'text-zinc-500', show: true },
    { label: 'Creatives / mo', getValue: p => `${p.creatives}${p.creativesNeeded > p.creatives ? ` (need ${p.creativesNeeded})` : ''}`, bold: true, show: true },
  ]

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">3-Month Projection</h3>
        {seasonalityNote && <p className="text-xs text-zinc-500 mt-1">{seasonalityNote}</p>}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium w-48"></th>
            {projection.map((_, i) => (
              <th key={i} className={`text-center px-3 py-2.5 ${MONTH_BG[i]}`}>
                <span className={`text-xs font-bold uppercase tracking-wider ${MONTH_COLORS[i]}`}>Month {i + 1}</span>
                <br /><span className="text-[10px] text-zinc-500">{MONTH_LABELS[i]}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.filter(r => r.show !== false).map((row, ri) => (
            <tr key={ri} className={`border-b border-zinc-800/50 ${row.bold ? 'bg-zinc-800/30' : ''}`}>
              <td className={`px-4 py-2 text-zinc-400 ${row.bold ? 'font-bold text-white' : ''} ${row.indent ? 'pl-8 text-xs' : ''}`}>
                {row.label}
              </td>
              {projection.map((p, i) => (
                <td key={i} className={`text-center px-3 py-2 font-mono text-xs ${row.bold ? 'font-bold' : ''} ${row.getColor ? row.getColor(p) : 'text-white'}`}>
                  {row.getValue(p)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
