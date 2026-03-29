'use client'

import { useState, useEffect } from 'react'
import type { Industry, Quarter, BrandType, PixelMaturity, CreativeCapacity, MediaPlanInputs } from '@/lib/types'
import { INDUSTRY_LABELS, DEFAULT_MARGIN, DEFAULT_REPEAT_RATE, DEFAULT_GROWTH_RATE } from '@/lib/constants'
import { fetchWindsorAccounts, fetchWindsorMetrics, type WindsorAccount } from '@/lib/windsor'

interface Props {
  inputs: MediaPlanInputs
  onChange: (inputs: MediaPlanInputs) => void
  onGenerate: () => void
}

function Section({ title, defaultOpen, badge, children }: { title: string; defaultOpen?: boolean; badge?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full px-3 py-2.5 flex items-center justify-between bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">{title}</span>
          {badge && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-400 uppercase">{badge}</span>}
        </div>
        <span className="text-zinc-500 text-xs">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="p-3 space-y-4 border-t border-zinc-800">{children}</div>}
    </div>
  )
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wider">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-zinc-600 mt-1">{hint}</p>}
    </div>
  )
}

const inputClass = "w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-red-700 transition-colors"

export default function InputForm({ inputs, onChange, onGenerate }: Props) {
  const [windsorAccounts, setWindsorAccounts] = useState<WindsorAccount[]>([])
  const [selectedMetaAccount, setSelectedMetaAccount] = useState<string>('')
  const [selectedGoogleAccount, setSelectedGoogleAccount] = useState<string>('')
  const [windsorLoading, setWindsorLoading] = useState(false)
  const [windsorStatus, setWindsorStatus] = useState<string>('')

  // Fetch Windsor accounts on mount
  useEffect(() => {
    fetchWindsorAccounts().then(accounts => {
      setWindsorAccounts(accounts)
    }).catch(() => {})
  }, [])

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
    onChange(next)
  }

  const handleFetchWindsor = async () => {
    if (!selectedMetaAccount && !selectedGoogleAccount) return
    setWindsorLoading(true)
    setWindsorStatus('Fetching last 90 days of ad data...')

    try {
      const metrics = await fetchWindsorMetrics(
        selectedMetaAccount || undefined,
        selectedGoogleAccount || undefined,
      )

      if (metrics.dataQuality === 'insufficient') {
        setWindsorStatus('No usable data found. Using benchmarks.')
        set('dataMode', 'benchmark')
        set('windsorOverrides', null)
        return
      }

      // Auto-populate inputs from Windsor data
      const next = { ...inputs }
      next.dataMode = 'windsor'
      next.windsorOverrides = {
        metaCpm: metrics.meta?.avgCpm ?? 0,
        metaCpc: metrics.meta?.avgCpc ?? 0,
        metaCtr: metrics.meta?.avgCtr ?? 0,
        metaConvRate: metrics.meta?.avgConvRate ?? 0,
        metaRoas: metrics.meta?.avgRoas ?? 0,
        metaCpa: metrics.meta?.avgCpa ?? 0,
        googleCpc: metrics.google?.avgCpc ?? 0,
        googleCtr: metrics.google?.avgCtr ?? 0,
        googleConvRate: metrics.google?.avgConvRate ?? 0,
        googleRoas: metrics.google?.avgRoas ?? 0,
        actualPlatformSplit: metrics.platformSplitActual,
        avgFrequency: metrics.meta?.avgFrequency ?? 0,
        dataQuality: metrics.dataQuality,
      }

      // Auto-fill financials from actuals
      if (metrics.currentMonthlySpend > 0) {
        next.monthlyAdSpend = Math.round(metrics.currentMonthlySpend)
      }
      if (metrics.currentMonthlyRevenue > 0) {
        next.monthlyRevenue = Math.round(metrics.currentMonthlyRevenue)
      }
      if (metrics.currentBlendedRoas > 0) {
        next.currentRoas = Math.round(metrics.currentBlendedRoas * 10) / 10
      }

      onChange(next)
      setWindsorStatus(`Connected (${metrics.dataQuality}) — ${metrics.meta ? 'Meta' : ''}${metrics.meta && metrics.google ? ' + ' : ''}${metrics.google ? 'Google' : ''} data loaded`)
    } catch {
      setWindsorStatus('Failed to fetch Windsor data. Using benchmarks.')
    } finally {
      setWindsorLoading(false)
    }
  }

  const metaAccounts = windsorAccounts.filter(a => a.connector === 'facebook')
  const googleAccounts = windsorAccounts.filter(a => a.connector === 'google_ads')
  const hasWindsorAccounts = windsorAccounts.length > 0

  return (
    <div className="space-y-3">
      {/* Section 0: Windsor Data */}
      {hasWindsorAccounts && (
        <Section title="Live Ad Data" badge="Windsor" defaultOpen>
          <p className="text-[10px] text-zinc-500 -mt-2 mb-3">
            Connect client ad accounts to use actual CPMs, ROAS, and CPA instead of benchmarks.
          </p>

          {metaAccounts.length > 0 && (
            <Field label="Meta Ad Account">
              <select value={selectedMetaAccount} onChange={e => setSelectedMetaAccount(e.target.value)} className={inputClass}>
                <option value="">— Select Meta Account —</option>
                {metaAccounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                ))}
              </select>
            </Field>
          )}

          {googleAccounts.length > 0 && (
            <Field label="Google Ads Account">
              <select value={selectedGoogleAccount} onChange={e => setSelectedGoogleAccount(e.target.value)} className={inputClass}>
                <option value="">— Select Google Account —</option>
                {googleAccounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                ))}
              </select>
            </Field>
          )}

          <button
            onClick={handleFetchWindsor}
            disabled={windsorLoading || (!selectedMetaAccount && !selectedGoogleAccount)}
            className="w-full py-2 bg-emerald-800 hover:bg-emerald-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-xs font-bold rounded-lg uppercase tracking-wider transition-colors"
          >
            {windsorLoading ? 'Fetching...' : 'Pull Ad Data'}
          </button>

          {windsorStatus && (
            <p className={`text-[10px] ${inputs.dataMode === 'windsor' ? 'text-emerald-400' : 'text-zinc-500'}`}>
              {windsorStatus}
            </p>
          )}

          {inputs.dataMode === 'windsor' && (
            <button onClick={() => { set('dataMode', 'benchmark'); set('windsorOverrides', null); setWindsorStatus('') }}
              className="text-[10px] text-zinc-500 hover:text-zinc-300 underline">
              Switch back to benchmarks
            </button>
          )}
        </Section>
      )}

      {/* Section 1: Brand Basics */}
      <Section title="Brand Basics" defaultOpen>
        <Field label="Brand Name">
          <input type="text" value={inputs.brandName} onChange={e => set('brandName', e.target.value)} placeholder="e.g. Venecci" className={inputClass} />
        </Field>

        <Field label="Industry">
          <select value={inputs.industry} onChange={e => set('industry', e.target.value as Industry)} className={inputClass}>
            {Object.entries(INDUSTRY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </Field>

        <Field label="Quarter">
          <div className="grid grid-cols-4 gap-1.5">
            {(['Q1', 'Q2', 'Q3', 'Q4'] as Quarter[]).map(q => (
              <button key={q} onClick={() => set('quarter', q)}
                className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${inputs.quarter === q ? 'bg-red-700 text-white' : 'bg-zinc-900 text-zinc-400 border border-zinc-700 hover:border-zinc-500'}`}>
                {q}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Brand Type">
          <div className="space-y-1.5">
            {([
              { value: 'existing', label: 'Existing Brand' },
              { value: 'preLaunch', label: 'Pre-Launch' },
              { value: 'vcBacked', label: 'VC-Backed / Aggressive' },
            ] as { value: BrandType; label: string }[]).map(opt => (
              <button key={opt.value} onClick={() => set('brandType', opt.value)}
                className={`w-full py-1.5 rounded-lg text-xs font-medium text-left px-3 transition-colors ${inputs.brandType === opt.value ? 'bg-red-700/20 text-red-400 border border-red-700' : 'bg-zinc-900 text-zinc-400 border border-zinc-700 hover:border-zinc-500'}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </Field>
      </Section>

      {/* Section 2: Financials */}
      <Section title="Financials" defaultOpen>
        <Field label="Monthly Revenue (₹)" hint={inputs.dataMode === 'windsor' ? 'Auto-filled from Windsor' : '0 for pre-launch brands'}>
          <input type="number" value={inputs.monthlyRevenue || ''} onChange={e => set('monthlyRevenue', Number(e.target.value))} placeholder="0" className={inputClass} />
        </Field>

        <Field label="Monthly Ad Spend (₹)" hint={inputs.dataMode === 'windsor' ? 'Auto-filled from Windsor (monthly avg)' : 'M1 baseline — never drops below this'}>
          <input type="number" value={inputs.monthlyAdSpend || ''} onChange={e => set('monthlyAdSpend', Number(e.target.value))} placeholder="e.g. 500000" className={inputClass} />
        </Field>

        <Field label="AOV (₹)">
          <input type="number" value={inputs.aov || ''} onChange={e => set('aov', Number(e.target.value))} placeholder="e.g. 1800" className={inputClass} />
        </Field>

        <Field label={`Gross Margin — ${Math.round(inputs.grossMargin * 100)}%`} hint="Used for CPA sustainability threshold">
          <input type="range" min="10" max="80" value={inputs.grossMargin * 100} onChange={e => set('grossMargin', Number(e.target.value) / 100)}
            className="w-full accent-red-700" />
        </Field>

        {inputs.brandType !== 'preLaunch' && (
          <Field label="Current ROAS" hint={inputs.dataMode === 'windsor' ? 'Auto-filled from Windsor' : 'Leave empty to use industry average'}>
            <input type="number" step="0.1" value={inputs.currentRoas ?? ''} onChange={e => set('currentRoas', e.target.value ? Number(e.target.value) : null)} placeholder="e.g. 1.5" className={inputClass} />
          </Field>
        )}
      </Section>

      {/* Section 3: Growth Config */}
      <Section title="Growth Config" defaultOpen>
        <Field label={`Monthly Spend Growth — ${Math.round(inputs.spendGrowthRate * 100 - 100)}%/mo`} hint="How fast to scale spend each month">
          <input type="range" min="100" max="160" step="5" value={inputs.spendGrowthRate * 100}
            onChange={e => set('spendGrowthRate', Number(e.target.value) / 100)}
            className="w-full accent-red-700" />
          <div className="flex justify-between text-[9px] text-zinc-600 mt-1">
            <span>Stable (0%)</span>
            <span>Moderate (20%)</span>
            <span>Aggressive (60%)</span>
          </div>
        </Field>
      </Section>

      {/* Section 4: Brand Intelligence */}
      <Section title="Brand Intelligence (Optional)">
        <Field label="Monthly Website Traffic" hint="Determines retargeting pool size">
          <input type="number" value={inputs.monthlyTraffic ?? ''} onChange={e => set('monthlyTraffic', e.target.value ? Number(e.target.value) : null)} placeholder="e.g. 50000" className={inputClass} />
        </Field>

        <Field label="Email/SMS List Size" hint="2% monthly conversion assumed">
          <input type="number" value={inputs.emailListSize || ''} onChange={e => set('emailListSize', Number(e.target.value))} placeholder="e.g. 25000" className={inputClass} />
        </Field>

        <Field label="Number of SKUs" hint="<10 SKUs reduces DPA effectiveness">
          <input type="number" value={inputs.skuCount || ''} onChange={e => set('skuCount', Number(e.target.value))} placeholder="50" className={inputClass} />
        </Field>

        <Field label={`Repeat Purchase Rate — ${Math.round(inputs.repeatPurchaseRate * 100)}%`} hint="Affects LTV-adjusted CPA threshold">
          <input type="range" min="0" max="60" value={inputs.repeatPurchaseRate * 100} onChange={e => set('repeatPurchaseRate', Number(e.target.value) / 100)}
            className="w-full accent-red-700" />
        </Field>

        <Field label={`Avg Discount — ${Math.round(inputs.avgDiscount * 100)}%`} hint="Reduces effective AOV">
          <input type="range" min="0" max="50" value={inputs.avgDiscount * 100} onChange={e => set('avgDiscount', Number(e.target.value) / 100)}
            className="w-full accent-red-700" />
        </Field>

        <Field label="Pixel Maturity">
          <div className="grid grid-cols-3 gap-1.5">
            {([
              { value: 'fresh', label: 'Fresh' },
              { value: 'learning', label: 'Learning' },
              { value: 'mature', label: 'Mature' },
            ] as { value: PixelMaturity; label: string }[]).map(opt => (
              <button key={opt.value} onClick={() => set('pixelMaturity', opt.value)}
                className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${inputs.pixelMaturity === opt.value ? 'bg-red-700 text-white' : 'bg-zinc-900 text-zinc-400 border border-zinc-700 hover:border-zinc-500'}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Creative Capacity">
          <div className="grid grid-cols-3 gap-1.5">
            {([
              { value: 'low', label: 'Low (10)' },
              { value: 'medium', label: 'Med (20)' },
              { value: 'high', label: 'High (40)' },
            ] as { value: CreativeCapacity; label: string }[]).map(opt => (
              <button key={opt.value} onClick={() => set('creativeCapacity', opt.value)}
                className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${inputs.creativeCapacity === opt.value ? 'bg-red-700 text-white' : 'bg-zinc-900 text-zinc-400 border border-zinc-700 hover:border-zinc-500'}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Inventory Value (₹)" hint="Caps scaling if limited stock">
          <input type="number" value={inputs.inventoryValue ?? ''} onChange={e => set('inventoryValue', e.target.value ? Number(e.target.value) : null)} placeholder="Optional" className={inputClass} />
        </Field>
      </Section>

      <button onClick={onGenerate}
        disabled={!inputs.brandName || !inputs.monthlyAdSpend || !inputs.aov}
        className="w-full py-3 bg-red-700 hover:bg-red-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-bold rounded-lg text-sm uppercase tracking-wider transition-colors">
        Generate Media Plan
      </button>
    </div>
  )
}
