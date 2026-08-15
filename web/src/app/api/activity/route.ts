import { z } from 'zod'
import { snaptrade, snaptradeConfigured } from '@/lib/snaptrade'
import { handle, json, query } from '@/lib/http'

// Recent real buys/sells straight from the SnapTrade activity feed, newest
// first — the dashboard's "Recent buy & sell" card. ponytail: reads the feed
// directly; the old DB-backed route needed the ingest worker reverted in #16.
export const GET = handle(async (req: Request) => {
  if (!snaptradeConfigured()) return json({ error: 'SnapTrade not configured' }, { status: 503 })
  const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(50).default(8) }).parse(query(req))

  const today = new Date().toISOString().slice(0, 10)
  const acts = await snaptrade.getActivities('2000-01-01', today)
  const trades = acts
    .filter((a) => (a.type === 'BUY' || a.type === 'SELL') && a.symbol)
    .sort((a, b) => (b.trade_date ?? '').localeCompare(a.trade_date ?? ''))
    .slice(0, limit)

  return json(
    trades.map((a) => ({
      side: a.type as 'BUY' | 'SELL',
      ticker: a.symbol!.symbol,
      qty: a.units != null ? Math.abs(a.units) : null,
      price: a.price,
      date: a.trade_date,
    })),
  )
})
