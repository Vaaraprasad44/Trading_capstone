import { z } from 'zod'
import { db } from '@/lib/db'
import { entryVerification, fundByCode } from '@/lib/domain'
import { handle, json, query } from '@/lib/http'

// Trade feed / closed-trade history (PRD 3.2, 3.3, 1.5)
export const GET = handle(async (req: Request, ctx: { params: Promise<{ code: string }> }) => {
  const fund = await fundByCode((await ctx.params).code)
  const q = z.object({ status: z.enum(['published', 'closed']).optional() }).parse(query(req))
  const cards = await db.trade_cards.findMany({
    where: { fund_id: fund.id, status: q.status ?? { not: 'draft' } },
    orderBy: { published_at: 'desc' },
    include: { instruments: true, reconciliations: true, trade_card_events: { orderBy: { created_at: 'asc' } } },
  })
  return json(cards.map((c) => ({ ...c, entry_verification: entryVerification(c.reconciliations) })))
})
