'use client'

import { useState, useRef, useEffect } from 'react'
import type { MediaPlanInputs, MediaPlan } from '@/lib/types'
import { formatINR } from '@/lib/format'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  changes?: Record<string, unknown>
  diff?: { field: string; from: string; to: string }[]
  timestamp: number
}

interface PlanVersion {
  inputs: MediaPlanInputs
  plan: MediaPlan
  label: string
  timestamp: number
}

interface Props {
  inputs: MediaPlanInputs
  plan: MediaPlan
  onApplyChanges: (changes: Record<string, unknown>) => void
  versions: PlanVersion[]
  onRestore: (index: number) => void
}

export default function ChatPanel({ inputs, plan, onApplyChanges, versions, onRestore }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [showVersions, setShowVersions] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || streaming) return
    const userMsg: ChatMessage = { role: 'user', content: input.trim(), timestamp: Date.now() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setStreaming(true)

    // Add placeholder assistant message
    const assistantMsg: ChatMessage = { role: 'assistant', content: '', timestamp: Date.now() }
    setMessages([...newMessages, assistantMsg])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          currentInputs: inputs,
          currentPlan: plan,
        }),
      })

      if (!res.ok) throw new Error('Chat request failed')

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            if (parsed.text) {
              fullText += parsed.text
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = { ...updated[updated.length - 1], content: fullText }
                return updated
              })
            }
          } catch { /* skip malformed chunks */ }
        }
      }

      // Parse changes from the completed response
      const changesMatch = fullText.match(/<changes>\s*([\s\S]*?)\s*<\/changes>/)
      if (changesMatch) {
        try {
          const changes = JSON.parse(changesMatch[1])
          const diff = computeDiff(inputs, changes)

          // Update the assistant message with changes and diff
          setMessages(prev => {
            const updated = [...prev]
            const cleanContent = fullText.replace(/<changes>[\s\S]*?<\/changes>/, '').trim()
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: cleanContent,
              changes,
              diff,
            }
            return updated
          })

          // Apply changes
          onApplyChanges(changes)
        } catch { /* changes parse failed, that's ok */ }
      }
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: `Error: ${err instanceof Error ? err.message : 'Something went wrong'}`,
        }
        return updated
      })
    } finally {
      setStreaming(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Plan Chat</span>
          <span className="text-[8px] px-1.5 py-0.5 rounded bg-violet-900/50 text-violet-400 font-bold uppercase">AI</span>
        </div>
        <div className="flex items-center gap-2">
          {versions.length > 1 && (
            <button onClick={() => setShowVersions(!showVersions)}
              className="text-[10px] text-zinc-500 hover:text-white transition-colors">
              {showVersions ? 'Hide' : `${versions.length} versions`}
            </button>
          )}
        </div>
      </div>

      {/* Version History Dropdown */}
      {showVersions && versions.length > 1 && (
        <div className="border-b border-zinc-800 bg-zinc-900/50 px-4 py-2 space-y-1 max-h-40 overflow-y-auto">
          {versions.map((v, i) => (
            <button key={v.timestamp} onClick={() => { onRestore(i); setShowVersions(false) }}
              className={`w-full text-left px-2 py-1.5 rounded text-[10px] transition-colors ${
                i === versions.length - 1 ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'
              }`}>
              <span className="font-medium">v{i + 1}</span>
              <span className="ml-2 text-zinc-600">{v.label}</span>
              <span className="float-right text-zinc-700">{new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-zinc-600 text-xs mb-3">Ask anything about the plan or tell me what to change</p>
            <div className="space-y-1.5">
              {[
                'Why is CPA unsustainable in M1?',
                'Change Meta:Google split to 50:50',
                'Scale spend to ₹15L/month',
                'What if margins were 60%?',
                'Make it more aggressive',
              ].map(s => (
                <button key={s} onClick={() => { setInput(s); inputRef.current?.focus() }}
                  className="block mx-auto text-[10px] text-zinc-500 hover:text-violet-400 bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800/50 rounded-full px-3 py-1 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-last' : ''}`}>
              {/* Message bubble */}
              <div className={`rounded-xl px-3 py-2 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-red-700/20 text-zinc-200 border border-red-800/30'
                  : 'bg-zinc-900 text-zinc-300 border border-zinc-800'
              }`}>
                {msg.content || (streaming && i === messages.length - 1 && (
                  <span className="text-zinc-600 animate-pulse">Thinking...</span>
                ))}
              </div>

              {/* Diff chips */}
              {msg.diff && msg.diff.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {msg.diff.map((d, j) => (
                    <span key={j} className="inline-flex items-center gap-1 text-[9px] bg-zinc-900 border border-zinc-800 rounded-md px-2 py-1">
                      <span className="text-zinc-500 font-medium">{d.field}</span>
                      <span className="text-red-400/70 line-through">{d.from}</span>
                      <span className="text-zinc-600">→</span>
                      <span className="text-emerald-400">{d.to}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-zinc-800 px-4 py-3">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Ask about the plan or request changes..."
            disabled={streaming}
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-700 focus:outline-none focus:border-zinc-600 transition-colors disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || streaming}
            className="px-3 py-2 bg-violet-700 hover:bg-violet-600 disabled:bg-zinc-800 disabled:text-zinc-700 text-white text-[10px] font-bold rounded-lg uppercase tracking-wider transition-colors"
          >
            {streaming ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Diff computation ───

const FIELD_LABELS: Record<string, string> = {
  brandName: 'Brand', industry: 'Industry', brandType: 'Type', quarter: 'Quarter',
  monthlyRevenue: 'Revenue/mo', monthlyAdSpend: 'Ad Spend/mo', aov: 'AOV',
  grossMargin: 'Margin', currentRoas: 'ROAS', monthlyTraffic: 'Traffic',
  emailListSize: 'Email List', skuCount: 'SKUs', repeatPurchaseRate: 'Repeat Rate',
  avgDiscount: 'Discount', pixelMaturity: 'Pixel', creativeCapacity: 'Creative Cap',
  inventoryValue: 'Inventory', spendGrowthRate: 'Growth Rate',
  platformSplitOverride: 'Meta:Google Split',
}

function formatValue(key: string, val: unknown): string {
  if (val === null || val === undefined) return 'auto'
  if (key === 'platformSplitOverride' && typeof val === 'object') {
    const s = val as { meta: number; google: number }
    return `${Math.round(s.meta * 100)}:${Math.round(s.google * 100)}`
  }
  if (key === 'grossMargin' || key === 'repeatPurchaseRate' || key === 'avgDiscount') {
    return `${Math.round((val as number) * 100)}%`
  }
  if (key === 'spendGrowthRate') {
    return `${Math.round((val as number) * 100 - 100)}%/mo`
  }
  if (key === 'monthlyRevenue' || key === 'monthlyAdSpend' || key === 'aov' || key === 'inventoryValue') {
    return formatINR(val as number)
  }
  if (key === 'currentRoas') return `${val}x`
  if (key === 'monthlyTraffic') return `${((val as number) / 1000).toFixed(0)}K`
  return String(val)
}

function computeDiff(currentInputs: MediaPlanInputs, changes: Record<string, unknown>): { field: string; from: string; to: string }[] {
  const diff: { field: string; from: string; to: string }[] = []

  for (const [key, newVal] of Object.entries(changes)) {
    const oldVal = (currentInputs as unknown as Record<string, unknown>)[key]
    const label = FIELD_LABELS[key] || key
    diff.push({
      field: label,
      from: formatValue(key, oldVal),
      to: formatValue(key, newVal),
    })
  }

  return diff
}
