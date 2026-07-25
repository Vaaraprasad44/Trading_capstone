import { db } from '@/lib/db'
import { handle, json } from '@/lib/http'

// Feed health / staleness banner source (PRD 1.6)
export const GET = handle(async () => {
  return json(await db.feed_syncs.findMany({ orderBy: { started_at: 'desc' }, take: 20 }))
})
