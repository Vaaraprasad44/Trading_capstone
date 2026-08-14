import { z } from 'zod'
import { db } from '@/lib/db'
import { handle, json, query } from '@/lib/http'

// Recent account activity from the verified SnapTrade feed, newest first —
// the dashboard's live trades panel. ?type=trade narrows to buys/sells.
export const GET = handle(async (req: Request) => {
  const q = z
    .object({
      limit: z.coerce.number().int().min(1).max(100).default(20),
      type: z.enum(['trade', 'dividend', 'transfer', 'other']).optional(),
    })
    .parse(query(req))

  const fills = await db.broker_fills.findMany({
    where: q.type ? { activity_type: q.type } : undefined,
    orderBy: { executed_at: 'desc' },
    take: q.limit,
    include: {
      instruments: { select: { symbol: true, name: true } },
      reconciliations: { select: { kind: true, status: true } },
    },
  })

  return json(
    fills.map((f) => ({
      id: f.id,
      executed_at: f.executed_at,
      activity_type: f.activity_type,
      side: f.side,
      symbol: f.instruments?.symbol ?? f.raw_symbol,
      name: f.instruments?.name,
      quantity: f.quantity,
      price: f.price,
      amount: f.amount,
      verification: f.reconciliations?.status ?? 'pending',
    })),
  )
})
