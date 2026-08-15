import { marketdata } from '@/lib/marketdata'
import { snaptrade, snaptradeConfigured } from '@/lib/snaptrade'
import { handle, json } from '@/lib/http'

// Live holdings of the connected brokerage account, shaped as the dashboard's
// Holding type: qty/avg from the broker (SnapTrade), ltp/day% live from Yahoo.
// ponytail: whole account = the Alpha Fund for now (one connected account);
// per-fund attribution returns when a second account/fund exists.
export const GET = handle(async () => {
  if (!snaptradeConfigured()) return json({ error: 'SnapTrade not configured' }, { status: 503 })

  const positions = await snaptrade.getPositions()
  const rows = positions.flatMap((p) => {
    if (!p.instrument || p.units == null || Number(p.units) <= 0) return []
    const qty = Number(p.units)
    return [{
      ticker: p.instrument.symbol,
      name: p.instrument.description ?? p.instrument.symbol,
      qty,
      // cost_basis arrives as the PER-SHARE average cost (verified against
      // Robinhood's own position screen), despite the old total-lot comment
      avg: p.cost_basis != null ? Number(p.cost_basis) : null,
      brokerPrice: p.price != null ? Number(p.price) : null,
    }]
  })

  // live quotes best-effort: a Yahoo hiccup on one symbol must not sink the
  // table — fall back to the broker's last price for that row
  const quotes = await Promise.allSettled(rows.map((r) => marketdata.getQuote(r.ticker)))
  return json(
    rows.flatMap(({ brokerPrice, ...r }, i) => {
      const q = quotes[i]
      const quote = q.status === 'fulfilled' ? q.value : null
      const ltp = quote?.price ?? brokerPrice
      if (ltp == null) return [] // priceless row would poison every derived value
      // ponytail: missing cost basis → avg = ltp so P&L reads 0, not Infinity
      return [{ ...r, avg: r.avg != null ? +r.avg.toFixed(4) : ltp, ltp, day: quote?.dayPct ?? 0 }]
    }),
  )
})
