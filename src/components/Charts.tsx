'use client'

import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { MonthProjection } from '@/lib/types'
import { formatINR } from '@/lib/format'

interface SplitProps {
  meta: number
  google: number
}

export function BudgetSplitChart({ meta, google }: SplitProps) {
  const data = [
    { name: 'Meta', value: meta, color: '#3b82f6' },
    { name: 'Google', value: google, color: '#22c55e' },
  ]

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Platform Split</h4>
      <div className="flex items-center gap-4">
        <ResponsiveContainer width={100} height={100}>
          <PieChart>
            <Pie data={data} dataKey="value" cx="50%" cy="50%" outerRadius={45} strokeWidth={0}>
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-2">
          {data.map(d => (
            <div key={d.name} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="text-xs text-zinc-400">{d.name}</span>
              <span className="text-xs text-white font-bold">{Math.round(d.value * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

interface RevenueProps {
  projection: [MonthProjection, MonthProjection, MonthProjection]
}

export function RevenueChart({ projection }: RevenueProps) {
  const data = projection.map(p => ({
    name: `M${p.month}`,
    spend: p.totalSpend,
    revenue: p.totalRevenue,
  }))

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
      <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Revenue Trajectory</h4>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#71717a' }} axisLine={false} tickFormatter={v => formatINR(v)} width={60} />
          <Tooltip
            contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }}
            formatter={(value) => [formatINR(Number(value))]}
            labelStyle={{ color: '#a1a1aa' }}
          />
          <Line type="monotone" dataKey="spend" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 4 }} name="Spend" />
          <Line type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e', r: 4 }} name="Revenue" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
