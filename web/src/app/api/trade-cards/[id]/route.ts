import { db } from '@/lib/db'
import { CardId, entryVerification } from '@/lib/domain'
import { handle, json } from '@/lib/http'

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const card = await db.trade_cards.findUniqueOrThrow({
    where: { id: CardId.parse((await ctx.params).id) },
    include: {
      instruments: true,
      trade_card_events: { orderBy: { created_at: 'asc' }, include: { reconciliations: true } },
      reconciliations: { include: { broker_fills: true } },
    },
  })
  return json({ ...card, entry_verification: entryVerification(card.reconciliations) })
})
