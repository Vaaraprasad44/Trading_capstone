import { z } from 'zod'
import { db } from '@/lib/db'
import { Ticker } from '@/lib/domain'
import { handle, json } from '@/lib/http'

const CreateCard = z
  .object({
    fund: z.enum(['alpha', 'sip', 'swing']),
    symbol: Ticker,
    direction: z.enum(['long', 'short']).default('long'),
    entry_price: z.number().positive(),
    position_pct: z.number().positive().max(100),
    thesis_md: z.string().min(1),
    stop_price: z.number().positive().optional(),
    exit_rules_md: z.string().min(1).optional(),
    publish: z.boolean().default(false),
  })
  .refine((b) => !b.publish || (b.stop_price != null && b.exit_rules_md != null), {
    message: 'publishing requires stop_price and exit_rules_md (PRD 2.2)',
  })

// PRD 2.1: trader publishes in <2 min — unknown symbols are created on the fly
export const POST = handle(async (req: Request) => {
  const body = CreateCard.parse(await req.json())
  const fund = await db.funds.findUniqueOrThrow({ where: { code: body.fund } })
  const instrument = await db.instruments.upsert({
    where: { symbol: body.symbol },
    create: { symbol: body.symbol, name: body.symbol },
    update: {},
  })
  const card = await db.trade_cards.create({
    data: {
      fund_id: fund.id,
      instrument_id: instrument.id,
      direction: body.direction,
      entry_price: body.entry_price,
      position_pct: body.position_pct,
      thesis_md: body.thesis_md,
      stop_price: body.stop_price,
      exit_rules_md: body.exit_rules_md,
      status: body.publish ? 'published' : 'draft',
      published_at: body.publish ? new Date() : null,
    },
  })
  return json(card, { status: 201 })
})
