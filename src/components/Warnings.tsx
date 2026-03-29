'use client'

interface Props {
  warnings: string[]
  pixelStrategy: string
  sustainableCPA: number
  ltvMultiplier: number
  effectiveAOV: number
}

export default function Warnings({ warnings, pixelStrategy, sustainableCPA, ltvMultiplier, effectiveAOV }: Props) {
  if (warnings.length === 0 && ltvMultiplier <= 1.01) return null

  return (
    <div className="space-y-3">
      {/* Key Metrics Bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Effective AOV</div>
          <div className="text-lg font-bold text-white mt-0.5">₹{Math.round(effectiveAOV).toLocaleString('en-IN')}</div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Sustainable CPA</div>
          <div className="text-lg font-bold text-green-400 mt-0.5">₹{Math.round(sustainableCPA).toLocaleString('en-IN')}</div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Pixel Strategy</div>
          <div className="text-xs font-medium text-zinc-300 mt-1 leading-relaxed">{pixelStrategy}</div>
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-4">
          <h4 className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-2">Insights & Warnings</h4>
          <ul className="space-y-1.5">
            {warnings.map((w, i) => (
              <li key={i} className="text-xs text-zinc-300 flex gap-2">
                <span className="text-orange-400 mt-0.5 shrink-0">!</span>
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
