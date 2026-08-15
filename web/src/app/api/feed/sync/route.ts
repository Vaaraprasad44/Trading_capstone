import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { Ticker } from '@/lib/domain'
import { reconcile } from '@/lib/reconcile'
import { handle, json } from '@/lib/http'

const Fill = z.object({
  snaptrade_txn_id: z.string().min(1),
  symbol: Ticker.optional(),
  activity_type: z.enum(['trade', 'dividend', 'interest', 'transfer', 'split', 'fee', 'other']).default('trade'),
  side: z.enum(['buy', 'sell']).optional(),
  quantity: z.number().positive().optional(),
  price: z.number().positive().optional(),
  amount: z.number().optional(),
  fees: z.number().min(0).default(0),
  executed_at: z.coerce.date(),
  raw: z.record(z.string(), z.unknown()).default({}),
})

// ponytail: body-supplied fills stand in for the SnapTrade Portfolio MCP —
// swap the source when the M1 spike lands; ingest + reconciliation are real.
export const POST = handle(async (req: Request) => {
  const body = z
    .object({
      trigger: z.enum(['schedule', 'on_demand', 'webhook']).default('on_demand'),
      fills: z.array(Fill).default([]),
    })
    .parse(await req.json().catch(() => ({})))

  const sync = await db.feed_syncs.create({ data: { trigger: body.trigger } })
  try {
    let ingested = 0
    for (const f of body.fills) {
      const instrument = f.symbol
        ? await db.instruments.upsert({
            where: { symbol: f.symbol },
            create: { symbol: f.symbol, name: f.symbol },
            update: {},
          })
        : null
      const result = await db.broker_fills.createMany({
        data: [
          {
            snaptrade_txn_id: f.snaptrade_txn_id,
            instrument_id: instrument?.id,
            raw_symbol: f.symbol,
            activity_type: f.activity_type,
            side: f.side,
            quantity: f.quantity,
            price: f.price,
            amount: f.amount,
            fees: f.fees,
            executed_at: f.executed_at,
            raw: f.raw as Prisma.InputJsonValue,
          },
        ],
        skipDuplicates: true, // snaptrade_txn_id = idempotent ingest
      })
      ingested += result.count
    }
    const reconciliation = await reconcile()
    const done = await db.feed_syncs.update({
      where: { id: sync.id },
      data: { status: 'ok', finished_at: new Date(), fills_ingested: ingested },
    })
    return json({ sync: done, reconciliation })
  } catch (err) {
    await db.feed_syncs.update({
      where: { id: sync.id },
      data: { status: 'error', finished_at: new Date(), error: String(err) },
    })
    throw err
  }
})
