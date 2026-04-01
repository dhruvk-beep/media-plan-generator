import { auth } from '@/lib/auth'
import { getActivityLog, ensureTable } from '@/lib/activity-log'
import { redirect } from 'next/navigation'
import ChatLogExpander from './ChatLogExpander'

const ACTION_LABELS: Record<string, string> = {
  generate_plan: 'Generated Plan',
  chat_message: 'Chat Message',
  refine_plan: 'Refined Plan',
  download_pdf: 'Downloaded PDF',
}

const ACTION_COLORS: Record<string, string> = {
  generate_plan: 'bg-red-900/50 text-red-400',
  chat_message: 'bg-violet-900/50 text-violet-400',
  refine_plan: 'bg-amber-900/50 text-amber-400',
  download_pdf: 'bg-blue-900/50 text-blue-400',
}

const ADMIN_EMAILS = ['dhruv.k@hovers.in', 'alan@hovers.in']

export default async function AdminPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (!ADMIN_EMAILS.includes(session.user.email ?? '')) redirect('/')

  await ensureTable()
  const logs = await getActivityLog(200)

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="border-b border-zinc-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hovers-logo.svg" alt="Hovers" className="h-7" />
          <div className="border-l border-zinc-800 pl-3 ml-1">
            <h1 className="text-xs font-bold tracking-wider uppercase text-zinc-300">Activity Log</h1>
            <p className="text-[9px] text-zinc-600">{logs.length} actions recorded</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-zinc-500">{session.user.name}</span>
          <a href="/" className="text-xs text-zinc-500 hover:text-white transition-colors">Back to Tool</a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6">
        {logs.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-zinc-600 text-sm">No activity yet. Generate a plan to see it here.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map(log => {
              const meta = typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata
              // created_at is UTC from DB, convert to IST (+5:30)
              const utc = new Date(log.created_at)
              const istMs = utc.getTime() + (5.5 * 60 * 60 * 1000)
              const ist = new Date(istMs)
              const day = ist.getUTCDate()
              const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
              const mon = months[ist.getUTCMonth()]
              const h = ist.getUTCHours()
              const m = ist.getUTCMinutes().toString().padStart(2, '0')
              const ampm = h >= 12 ? 'PM' : 'AM'
              const h12 = h % 12 || 12

              return (
                <div key={log.id} className="px-4 py-3 rounded-lg hover:bg-zinc-900/50 transition-colors">
                  <div className="flex items-start gap-3">
                    {/* Time */}
                    <div className="text-[10px] text-zinc-700 w-24 shrink-0 pt-0.5">
                      {day} {mon} {h12}:{m} {ampm}
                    </div>

                    {/* User */}
                    <div className="w-32 shrink-0">
                      <p className="text-xs text-zinc-300 truncate">{log.user_name}</p>
                      <p className="text-[9px] text-zinc-700 truncate">{log.user_email}</p>
                    </div>

                    {/* Action badge */}
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase shrink-0 ${ACTION_COLORS[log.action] ?? 'bg-zinc-800 text-zinc-400'}`}>
                      {ACTION_LABELS[log.action] ?? log.action}
                    </span>

                    {/* Metadata */}
                    <div className="flex-1 min-w-0">
                      {meta.brandName && (
                        <span className="text-[10px] text-zinc-400">{meta.brandName}</span>
                      )}
                      {meta.siteUrl && (
                        <span className="text-[10px] text-zinc-600 ml-2">{meta.siteUrl}</span>
                      )}
                      {meta.message && !meta.fullConversation && (
                        <p className="text-[10px] text-zinc-500 truncate">&ldquo;{meta.message}&rdquo;</p>
                      )}
                      {meta.feedback && (
                        <p className="text-[10px] text-zinc-500 truncate">&ldquo;{meta.feedback}&rdquo;</p>
                      )}
                      {meta.conversationLength && (
                        <span className="text-[9px] text-zinc-600 ml-1">({meta.conversationLength} messages)</span>
                      )}
                    </div>
                  </div>

                  {/* Expandable chat conversation */}
                  {meta.fullConversation && (
                    <ChatLogExpander conversation={meta.fullConversation} />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
