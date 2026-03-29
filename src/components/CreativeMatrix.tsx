'use client'

import type { CreativeMonthMatrix } from '@/lib/types'

const MONTH_COLORS = ['border-red-500', 'border-orange-400', 'border-green-500']
const MONTH_TEXT = ['text-red-500', 'text-orange-400', 'text-green-500']

interface Props {
  matrix: [CreativeMonthMatrix, CreativeMonthMatrix, CreativeMonthMatrix]
}

export default function CreativeMatrix({ matrix }: Props) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Creative Volume</h3>
      </div>

      <div className="grid grid-cols-3 gap-3 p-4">
        {matrix.map((m, i) => (
          <div key={i} className={`border-t-2 ${MONTH_COLORS[i]} bg-zinc-800/30 rounded-lg p-3`}>
            <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${MONTH_TEXT[i]}`}>
              Month {m.month} — {m.total} creatives
            </div>

            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left text-zinc-500 pb-1"></th>
                  <th className="text-center text-zinc-500 pb-1 font-medium">Static</th>
                  <th className="text-center text-zinc-500 pb-1 font-medium">Reels</th>
                </tr>
              </thead>
              <tbody>
                {([
                  { label: 'TOF', data: m.tof, bg: 'bg-red-500/10' },
                  { label: 'MOF', data: m.mof, bg: 'bg-yellow-500/10' },
                  { label: 'BOF', data: m.bof, bg: 'bg-green-500/10' },
                ] as const).map(row => (
                  <tr key={row.label}>
                    <td className="py-1 text-zinc-400 font-medium">{row.label}</td>
                    <td className={`text-center py-1 rounded ${row.bg} text-white font-bold`}>{row.data.static}</td>
                    <td className={`text-center py-1 rounded ${row.bg} text-white font-bold`}>{row.data.reels}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  )
}
