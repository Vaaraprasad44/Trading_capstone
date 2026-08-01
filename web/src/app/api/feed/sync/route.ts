import { z } from 'zod'
import { Ticker } from '@/lib/domain'
import { runSync } from '@/lib/feed'
import { snaptradeConfigured } from '@/lib/snaptrade'
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

// No fills in the body → pull live from SnapTrade (PRD 1.1). Body fills stay
// for tests and manual backfill.
export const POST = handle(async (req: Request) => {
  const body = z
    .object({
      trigger: z.enum(['schedule', 'on_demand', 'webhook']).default('on_demand'),
      fills: z.array(Fill).default([]),
    })
    .parse(await req.json().catch(() => ({})))

  if (body.fills.length === 0 && !snaptradeConfigured())
    return json({ error: 'SnapTrade not configured and no fills supplied' }, { status: 503 })

  return json(await runSync(body.trigger, body.fills))
})
