import { z } from 'zod'
import { db } from '@/lib/db'
import { CardId } from '@/lib/domain'
import { handle, json } from '@/lib/http'

// Publish a draft (the DB CHECK is the backstop; this gives a friendly 400)
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const id = CardId.parse((await ctx.params).id)
  const body = z
    .object({ stop_price: z.number().positive().optional(), exit_rules_md: z.string().min(1).optional() })
    .parse(await req.json().catch(() => ({})))
  const existing = await db.trade_cards.findUniqueOrThrow({ where: { id } })
  const stop = body.stop_price ?? existing.stop_price
  const exits = body.exit_rules_md ?? existing.exit_rules_md
  if (stop == null || exits == null) {
    return json({ error: 'publishing requires stop_price and exit_rules_md (PRD 2.2)' }, { status: 400 })
  }
  const card = await db.trade_cards.update({
    where: { id },
    data: { stop_price: stop, exit_rules_md: exits, status: 'published', published_at: new Date() },
  })
  return json(card)
})
