'use client'

import { useState } from 'react'

interface Props {
  conversation: { role: string; content: string }[]
}

export default function ChatLogExpander({ conversation }: Props) {
  const [open, setOpen] = useState(false)

  if (!conversation || conversation.length === 0) return null

  return (
    <div className="ml-[156px] mt-1">
      <button onClick={() => setOpen(!open)} className="text-[9px] text-zinc-600 hover:text-zinc-400 transition-colors">
        {open ? 'Hide conversation' : 'View conversation'}
      </button>
      {open && (
        <div className="mt-1.5 space-y-1.5 border-l-2 border-zinc-800 pl-3">
          {conversation.map((msg, i) => (
            <div key={i}>
              <span className={`text-[9px] font-bold uppercase ${msg.role === 'user' ? 'text-red-400/70' : 'text-violet-400/70'}`}>
                {msg.role}
              </span>
              <p className="text-[10px] text-zinc-500 leading-relaxed">{msg.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
