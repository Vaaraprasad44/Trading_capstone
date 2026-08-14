import { db } from '@/lib/db'
import { marketdata } from '@/lib/marketdata'
import { snaptrade, snaptradeConfigured } from '@/lib/snaptrade'
import { handle, json } from '@/lib/http'

// Live holdings of the fund account: broker-reported qty/avg/P&L (SnapTrade)
// merged with day-% (Yahoo). ponytail: whole account = the SIP fund for the
// one-fund prototype (docs/FUND-ATTRIBUTION.md); per-fund holdings return
// with fund #2 via plan/card attribution.
export const GET = handle(async () => {
  if (!snaptradeConfigured()) return json({ error: 'SnapTrade not configured' }, { status: 503 })

  const positions = await snaptrade.getPositions()
  const plan = await db.sip_plans.findFirst({ orderBy: { month: 'desc' }, where: { published_at: { not: null } } })
  const planSymbols = new Set(
    Array.isArray(plan?.breakdown) ? (plan.breakdown as { symbol?: string }[]).map((b) => b.symbol) : [],
  )

  const rows = positions.flatMap((p) => {
    if (!p.instrument || p.units == null) return []
    const qty = Number(p.units)
    const price = p.price != null ? Number(p.price) : null
    const costBasis = p.cost_basis != null ? Number(p.cost_basis) : null // total cost of the lot
    return [{
      symbol: p.instrument.symbol,
      name: p.instrument.description ?? p.instrument.symbol,
      qty,
      avg: costBasis != null && qty > 0 ? +(costBasis / qty).toFixed(4) : null,
      price,
      open_pnl: price != null && costBasis != null ? +(qty * price - costBasis).toFixed(2) : null,
      in_plan: planSymbols.has(p.instrument.symbol),
    }]
  })

  // day-% best-effort: a Yahoo hiccup on one symbol must not sink the table
  const quotes = await Promise.allSettled(rows.map((r) => marketdata.getQuote(r.symbol)))
  return json(
    rows.map((r, i) => ({
      ...r,
      dayPct: quotes[i].status === 'fulfilled' ? (quotes[i] as PromiseFulfilledResult<{ dayPct: number | null }>).value.dayPct : null,
    })),
  )
})
