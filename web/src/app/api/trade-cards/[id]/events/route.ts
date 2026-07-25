import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { CardId } from '@/lib/domain'
import { handle, json } from '@/lib/http'

// PRD 2.3: everything after entry is an append-only event; 'closed' also
// flips the card status (the only transition the DB trigger allows).
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const id = CardId.parse((await ctx.params).id)
  const body = z
    .object({
      event_type: z.enum(['stop_moved', 'partial_exit', 'closed', 'note']),
      payload: z.record(z.string(), z.unknown()).default({}),
      note_md: z.string().optional(),
    })
    .parse(await req.json())
  const event = await db.$transaction(async (tx) => {
    const ev = await tx.trade_card_events.create({
      data: {
        trade_card_id: id,
        event_type: body.event_type,
        payload: body.payload as Prisma.InputJsonValue,
        note_md: body.note_md,
      },
    })
    if (body.event_type === 'closed') {
      await tx.trade_cards.update({ where: { id }, data: { status: 'closed' } })
    }
    return ev
  })
  return json(event, { status: 201 })
})
