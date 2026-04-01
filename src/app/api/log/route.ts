import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { logActivity } from '@/lib/activity-log'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { action, metadata } = await req.json()
  if (!action) {
    return NextResponse.json({ error: 'Action required' }, { status: 400 })
  }

  await logActivity(session.user.email ?? '', session.user.name ?? '', action, metadata ?? {})
  return NextResponse.json({ ok: true })
}
