'use client'

import type { MetaCampaignRow, GoogleCampaignRow } from '@/lib/types'
import { formatINR, formatNum, formatPct, formatRoas } from '@/lib/format'

interface Props {
  title: string
  color: string
  campaigns: (MetaCampaignRow | GoogleCampaignRow)[]
}

export default function CampaignTable({ title, color, campaigns }: Props) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">{title}</h3>
      </div>

      {[0, 1, 2].map(monthIdx => (
        <div key={monthIdx} className="border-b border-zinc-800 last:border-0">
          <div className="px-4 py-2 bg-zinc-800/40">
            <span className={`text-xs font-bold uppercase tracking-wider ${
              monthIdx === 0 ? 'text-red-500' : monthIdx === 1 ? 'text-orange-400' : 'text-green-500'
            }`}>
              Month {monthIdx + 1}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800/50">
                  <th className="text-left px-3 py-2 text-zinc-500 font-medium">Campaign</th>
                  <th className="text-right px-2 py-2 text-zinc-500 font-medium">Budget</th>
                  <th className="text-right px-2 py-2 text-zinc-500 font-medium">Impr.</th>
                  <th className="text-right px-2 py-2 text-zinc-500 font-medium">Clicks</th>
                  <th className="text-right px-2 py-2 text-zinc-500 font-medium">CTR</th>
                  <th className="text-right px-2 py-2 text-zinc-500 font-medium">Conv%</th>
                  <th className="text-right px-2 py-2 text-zinc-500 font-medium">Orders</th>
                  <th className="text-right px-2 py-2 text-zinc-500 font-medium">Revenue</th>
                  <th className="text-right px-2 py-2 text-zinc-500 font-medium">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c, ci) => {
                  const m = c.months[monthIdx]
                  if (m.budget === 0) return null
                  return (
                    <tr key={ci} className="border-b border-zinc-800/30 hover:bg-zinc-800/20">
                      <td className="px-3 py-2 text-white font-medium">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full mr-2 ${color}`}></span>
                        {c.campaign}
                      </td>
                      <td className="text-right px-2 py-2 text-zinc-300 font-mono">{formatINR(m.budget)}</td>
                      <td className="text-right px-2 py-2 text-zinc-400 font-mono">{formatNum(Math.round(m.impressions))}</td>
                      <td className="text-right px-2 py-2 text-zinc-400 font-mono">{formatNum(Math.round(m.clicks))}</td>
                      <td className="text-right px-2 py-2 text-zinc-400 font-mono">{formatPct(m.ctr)}</td>
                      <td className="text-right px-2 py-2 text-zinc-400 font-mono">{formatPct(m.convRate)}</td>
                      <td className="text-right px-2 py-2 text-white font-mono font-medium">{formatNum(m.orders)}</td>
                      <td className="text-right px-2 py-2 text-green-400 font-mono">{formatINR(m.revenue)}</td>
                      <td className={`text-right px-2 py-2 font-mono font-bold ${m.roas >= 2 ? 'text-green-400' : m.roas >= 1 ? 'text-orange-400' : 'text-red-400'}`}>
                        {formatRoas(m.roas)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
