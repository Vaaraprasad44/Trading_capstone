import { z } from 'zod'
import { db } from '@/lib/db'
import { handle, json, query } from '@/lib/http'

export const GET = handle(async (req: Request) => {
  const q = z
    .object({
      status: z.enum(['matched', 'mismatched', 'unmatched_fill', 'unmatched_card']).optional(),
      unresolved: z.enum(['true', 'false']).optional(),
    })
    .parse(query(req))
  const rows = await db.reconciliations.findMany({
    where: { status: q.status, resolved_at: q.unresolved === 'true' ? null : undefined },
    orderBy: { created_at: 'desc' },
    include: { broker_fills: true, trade_cards: true, sip_plans: true },
  })
  return json(rows)
})
