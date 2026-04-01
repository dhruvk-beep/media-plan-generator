import { neon } from '@neondatabase/serverless'

function getDb() {
  return neon(process.env.DATABASE_URL!)
}

export async function ensureTable() {
  const sql = getDb()
  await sql`
    CREATE TABLE IF NOT EXISTS activity_log (
      id SERIAL PRIMARY KEY,
      user_email TEXT NOT NULL,
      user_name TEXT NOT NULL,
      action TEXT NOT NULL,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at DESC)`
}

export async function logActivity(
  userEmail: string,
  userName: string,
  action: string,
  metadata: Record<string, unknown> = {},
) {
  try {
    const sql = getDb()
    await sql`
      INSERT INTO activity_log (user_email, user_name, action, metadata)
      VALUES (${userEmail}, ${userName}, ${action}, ${JSON.stringify(metadata)})
    `
  } catch (err) {
    console.error('Failed to log activity:', err)
  }
}

export interface ActivityEntry {
  id: number
  user_email: string
  user_name: string
  action: string
  metadata: Record<string, unknown>
  created_at: string
}

export async function getActivityLog(limit = 100): Promise<ActivityEntry[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT id, user_email, user_name, action, metadata,
      (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::text as created_at
    FROM activity_log
    ORDER BY created_at DESC
    LIMIT ${limit}
  `
  return rows as ActivityEntry[]
}
