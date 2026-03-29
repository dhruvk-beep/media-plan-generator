'use client'

import { Fragment } from 'react'
import type { MediaPlan } from '@/lib/types'
import { formatINR, formatRoas, formatNum } from '@/lib/format'
import { INDUSTRY_LABELS } from '@/lib/constants'

const STAGE_LABELS = ['', 'PMF', 'Performance Scale', 'Optimization', 'Amplification']

// Colors
const C = {
  bg: '#0f0f0f',
  card: '#161616',
  border: '#2a2a2a',
  borderLight: '#222',
  text: '#e4e4e4',
  textMuted: '#888',
  textDim: '#555',
  red: '#b20f00',
  green: '#34d399',
  greenDim: '#22c55e',
  orange: '#f59e0b',
  blue: '#60a5fa',
}

const S = {
  page: { width: '100%', height: '100%', background: C.bg, color: C.text, fontFamily: 'Outfit, sans-serif', padding: '16px 22px', boxSizing: 'border-box' as const, display: 'flex', flexDirection: 'column' as const },
  row: { display: 'flex', gap: '8px', width: '100%' },
  flex1: { flex: 1, minWidth: 0 },
  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: '5px', overflow: 'hidden' },
  th: { padding: '5px 8px', fontSize: '8.5px', color: C.textMuted, fontWeight: 600, textAlign: 'center' as const, borderBottom: `1px solid ${C.border}` },
  thLeft: { padding: '5px 8px', fontSize: '8.5px', color: C.textMuted, fontWeight: 600, textAlign: 'left' as const, borderBottom: `1px solid ${C.border}` },
  td: { padding: '4px 8px', fontSize: '9.5px', fontFamily: 'monospace', textAlign: 'center' as const, borderBottom: `1px solid ${C.borderLight}`, color: C.text },
  tdLeft: { padding: '4px 8px', fontSize: '9.5px', textAlign: 'left' as const, borderBottom: `1px solid ${C.borderLight}`, color: '#ccc' },
  tdBold: { fontWeight: 700 },
  sectionLabel: { fontSize: '9px', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase' as const, marginBottom: '4px' },
}

function roasColor(r: number) { return r >= 2 ? C.green : r >= 1 ? C.orange : '#ef4444' }
function cpaColor(s: string) { return s === 'sustainable' ? C.green : s === 'warning' ? C.orange : '#ef4444' }

export default function PrintLayout({ plan }: { plan: MediaPlan }) {
  const p = plan.projection

  return (
    <div className="print-layout hidden">
      <div style={S.page}>

        {/* ── HEADER ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div>
              <span style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '0.5px' }}>{plan.brand.toUpperCase()}</span>
              <span style={{ fontSize: '10px', color: C.textMuted, marginLeft: 10 }}>
                {INDUSTRY_LABELS[plan.industry]} · Stage {plan.stage}: {STAGE_LABELS[plan.stage]} · {plan.quarter} · {plan.brandType === 'preLaunch' ? 'Pre-Launch' : plan.brandType === 'vcBacked' ? 'VC-Backed' : 'Existing'}
              </span>
              <div style={{ fontSize: '8px', color: C.textDim, marginTop: '2px' }}>3-Month Media Plan · Generated {new Date().toLocaleDateString('en-IN')}</div>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hovers-logo.svg" alt="Hovers" style={{ height: '28px' }} />
        </div>
        <div style={{ height: 2, background: `linear-gradient(90deg, ${C.red} 40%, transparent)`, marginBottom: '10px' }} />

        {/* ── ROW 1: KPIs + Projection ── */}
        <div style={{ ...S.row, marginBottom: '8px' }}>
          {/* KPI strip */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', width: '155px', flexShrink: 0 }}>
            {[
              { label: 'Effective AOV', value: formatINR(plan.effectiveAOV), color: C.text },
              { label: 'Sustainable CPA', value: formatINR(plan.sustainableCPA), color: C.green },
              { label: 'LTV Multiplier', value: `${plan.ltvMultiplier.toFixed(2)}x`, color: C.blue },
              { label: 'Meta / Google', value: `${Math.round(plan.platformSplit.meta * 100)}% / ${Math.round(plan.platformSplit.google * 100)}%`, color: C.text },
            ].map((kpi, i) => (
              <div key={i} style={{ ...S.card, padding: '6px 10px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: '7px', color: C.textDim, textTransform: 'uppercase', letterSpacing: '1px', lineHeight: 1 }}>{kpi.label}</div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: kpi.color, lineHeight: 1.3, marginTop: '2px' }}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Projection table */}
          <div style={{ ...S.card, ...S.flex1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...S.thLeft, width: '22%' }}></th>
                  <th style={{ ...S.th, color: C.red, fontWeight: 800, fontSize: '10px' }}>Month 1 — Foundation</th>
                  <th style={{ ...S.th, color: C.orange, fontWeight: 800, fontSize: '10px' }}>Month 2 — Optimize</th>
                  <th style={{ ...S.th, color: C.green, fontWeight: 800, fontSize: '10px' }}>Month 3 — Scale</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Total Ad Spend', vals: p.map(m => formatINR(m.totalSpend)), bold: true },
                  { label: 'Meta / Google', vals: p.map(m => `${formatINR(m.metaSpend)} / ${formatINR(m.googleSpend)}`) },
                  { label: 'Target ROAS', vals: p.map(m => formatRoas(m.roas)), colorFn: (i: number) => roasColor(p[i].roas) },
                  { label: 'New Customer Revenue', vals: p.map(m => formatINR(m.newCustomerRevenue)), colorFn: () => C.green },
                  ...(p.some(m => m.repeatRevenue > 0) ? [{ label: '  + Repeat Revenue', vals: p.map(m => m.repeatRevenue > 0 ? formatINR(m.repeatRevenue) : '—'), colorFn: () => '#86efac' }] : []),
                  ...(p.some(m => m.retentionRevenue > 0) ? [{ label: '  + Retention (Email)', vals: p.map(m => m.retentionRevenue > 0 ? formatINR(m.retentionRevenue) : '—'), colorFn: () => '#86efac' }] : []),
                  { label: 'Total Revenue', vals: p.map(m => formatINR(m.totalRevenue)), bold: true, colorFn: () => C.green },
                  { label: 'Purchases / mo', vals: p.map(m => formatNum(m.purchases)) },
                  { label: 'Target CPA', vals: p.map(m => formatINR(m.cpa)), colorFn: (i: number) => cpaColor(p[i].cpaStatus) },
                  { label: 'Creatives / mo', vals: p.map(m => `${m.creatives}${m.creativesNeeded > m.creatives ? ` (need ${m.creativesNeeded})` : ''}`), bold: true },
                ].map((row, ri) => (
                  <tr key={ri} style={row.bold ? { background: '#1a1a1a' } : undefined}>
                    <td style={{ ...S.tdLeft, ...(row.bold ? S.tdBold : {}), color: row.bold ? C.text : '#aaa', fontSize: '9px' }}>{row.label}</td>
                    {row.vals.map((v, i) => (
                      <td key={i} style={{ ...S.td, ...(row.bold ? S.tdBold : {}), color: row.colorFn ? row.colorFn(i) : C.text, fontSize: '9.5px' }}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── ROW 2: Meta Campaigns (full width) ── */}
        <div style={{ marginBottom: '8px' }}>
          <div style={{ ...S.sectionLabel, color: C.blue }}>Meta Campaigns</div>
          <div style={S.card}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#1a1a1a' }}>
                  <th style={{ ...S.thLeft, width: '16%' }}>Campaign</th>
                  {['M1', 'M2', 'M3'].map(m => (
                    <Fragment key={m}>
                      <th style={{ ...S.th, borderLeft: `1px solid ${C.borderLight}` }}>Budget</th>
                      <th style={S.th}>Orders</th>
                      <th style={S.th}>Revenue</th>
                      <th style={S.th}>ROAS</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plan.metaCampaigns.map((c, ci) => (
                  <tr key={ci}>
                    <td style={{ ...S.tdLeft, fontSize: '9px', fontWeight: 600 }}>
                      <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: C.blue, marginRight: 4, verticalAlign: 'middle' }} />
                      {c.campaign}
                    </td>
                    {c.months.map((m, mi) => (
                      <Fragment key={mi}>
                        <td style={{ ...S.td, borderLeft: `1px solid ${C.borderLight}`, color: '#aaa', fontSize: '9px' }}>{formatINR(m.budget)}</td>
                        <td style={{ ...S.td, fontSize: '9px' }}>{formatNum(m.orders)}</td>
                        <td style={{ ...S.td, color: C.greenDim, fontSize: '9px' }}>{formatINR(m.revenue)}</td>
                        <td style={{ ...S.td, fontWeight: 700, color: roasColor(m.roas), fontSize: '9.5px' }}>{formatRoas(m.roas)}</td>
                      </Fragment>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── ROW 3: Google + Creative Matrix side-by-side ── */}
        <div style={{ ...S.row, marginBottom: '8px', flex: 1 }}>
          {/* Google */}
          <div style={S.flex1}>
            <div style={{ ...S.sectionLabel, color: C.greenDim }}>Google Campaigns</div>
            <div style={S.card}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#1a1a1a' }}>
                    <th style={{ ...S.thLeft, width: '20%' }}>Campaign</th>
                    {['M1', 'M2', 'M3'].map(m => (
                      <Fragment key={m}>
                        <th style={{ ...S.th, borderLeft: `1px solid ${C.borderLight}` }}>Budget</th>
                        <th style={S.th}>Revenue</th>
                        <th style={S.th}>ROAS</th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {plan.googleCampaigns.filter(c => c.months.some(m => m.budget > 0)).map((c, ci) => (
                    <tr key={ci}>
                      <td style={{ ...S.tdLeft, fontSize: '7px', fontWeight: 600 }}>
                        <span style={{ display: 'inline-block', width: 4, height: 4, borderRadius: '50%', background: C.greenDim, marginRight: 4, verticalAlign: 'middle' }} />
                        {c.campaign}
                      </td>
                      {c.months.map((m, mi) => (
                        <Fragment key={mi}>
                          <td style={{ ...S.td, borderLeft: `1px solid ${C.borderLight}`, color: '#aaa', fontSize: '9px' }}>{m.budget > 0 ? formatINR(m.budget) : '\u2014'}</td>
                          <td style={{ ...S.td, color: C.greenDim, fontSize: '7px' }}>{m.revenue > 0 ? formatINR(m.revenue) : '—'}</td>
                          <td style={{ ...S.td, fontWeight: 700, color: m.budget > 0 ? roasColor(m.roas) : C.textDim, fontSize: '7.5px' }}>{m.budget > 0 ? formatRoas(m.roas) : '—'}</td>
                        </Fragment>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Creative */}
          <div style={{ width: '280px', flexShrink: 0 }}>
            <div style={{ ...S.sectionLabel, color: C.textMuted }}>Creative Volume</div>
            <div style={S.card}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#1a1a1a' }}>
                    <th style={{ ...S.thLeft, width: '18%' }}></th>
                    {plan.creativeMatrix.map((m, i) => (
                      <th key={i} colSpan={2} style={{ ...S.th, borderLeft: `1px solid ${C.borderLight}`, color: i === 0 ? C.red : i === 1 ? C.orange : C.green, fontWeight: 800, fontSize: '9px' }}>M{m.month} ({m.total})</th>
                    ))}
                  </tr>
                  <tr>
                    <th style={S.thLeft}></th>
                    {[0, 1, 2].map(i => (
                      <Fragment key={i}>
                        <th style={{ ...S.th, borderLeft: `1px solid ${C.borderLight}`, fontSize: '7px' }}>Static</th>
                        <th style={{ ...S.th, fontSize: '7px' }}>Reels</th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(['tof', 'mof', 'bof'] as const).map(funnel => {
                    const bg = funnel === 'tof' ? 'rgba(239,68,68,0.06)' : funnel === 'mof' ? 'rgba(245,158,11,0.06)' : 'rgba(34,197,94,0.06)'
                    return (
                      <tr key={funnel} style={{ background: bg }}>
                        <td style={{ ...S.tdLeft, fontWeight: 800, textTransform: 'uppercase', fontSize: '9px', color: C.textMuted }}>{funnel}</td>
                        {plan.creativeMatrix.map((m, i) => (
                          <Fragment key={i}>
                            <td style={{ ...S.td, borderLeft: `1px solid ${C.borderLight}`, fontWeight: 700, fontSize: '10px' }}>{m[funnel].static}</td>
                            <td style={{ ...S.td, fontWeight: 700, fontSize: '10px' }}>{m[funnel].reels}</td>
                          </Fragment>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── ROW 4: Insights ── */}
        {plan.warnings.length > 0 && (
          <div style={{ ...S.card, borderColor: 'rgba(245,158,11,0.2)', padding: '7px 12px', marginBottom: '8px' }}>
            <div style={{ fontSize: '8px', fontWeight: 800, color: C.orange, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '3px' }}>Insights</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px' }}>
              {plan.warnings.slice(0, 4).map((w, i) => (
                <div key={i} style={{ fontSize: '8px', color: '#999', display: 'flex', gap: '4px' }}>
                  <span style={{ color: C.orange }}>!</span> {w}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── FOOTER ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${C.border}`, paddingTop: '6px', marginTop: 'auto' }}>
          <div style={{ fontSize: '7.5px', color: C.textDim }}>Confidential — {plan.brand} × Hovers · {plan.seasonalityNote}</div>
          <a href="https://www.hovers.in" target="_blank" rel="noopener noreferrer" style={{ fontSize: '8px', color: C.red, textDecoration: 'none', fontWeight: 700, letterSpacing: '0.5px' }}>www.hovers.in</a>
        </div>
      </div>
    </div>
  )
}
