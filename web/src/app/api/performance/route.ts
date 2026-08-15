import { z } from 'zod'
import { marketdata } from '@/lib/marketdata'
import { snaptrade, snaptradeConfigured } from '@/lib/snaptrade'
import { handle, json, query } from '@/lib/http'

// % return of the live account vs the S&P 500 (^GSPC), daily closes rebased
// to 0 at the window start. ponytail: assumes today's quantities were held
// through the whole window — real time-weighted returns need the account's
// transaction history; revisit when the activity feed lands.
export const GET = handle(async (req: Request) => {
  if (!snaptradeConfigured()) return json({ error: 'SnapTrade not configured' }, { status: 503 })
  const { range } = z.object({ range: z.enum(['1mo', '3mo', '6mo', '1y']).default('6mo') }).parse(query(req))

  const positions = await snaptrade.getPositions()
  const qty = new Map<string, number>()
  for (const p of positions) {
    if (p.instrument && p.units != null && Number(p.units) > 0)
      qty.set(p.instrument.symbol, (qty.get(p.instrument.symbol) ?? 0) + Number(p.units))
  }
  const symbols = [...qty.keys()]

  const [spx, ...closes] = await Promise.all([
    marketdata.getDailyCloses('^GSPC', range),
    ...symbols.map((s) => marketdata.getDailyCloses(s, range)),
  ])
  const bySymbol = closes.map((c) => new Map(c.map((d) => [d.date, d.close])))
  const spxBy = new Map(spx.map((d) => [d.date, d.close]))

  // only dates where every holding has a close — a missing day on one symbol
  // would show up as a fake portfolio drop
  const labels = spx.map((d) => d.date).filter((date) => bySymbol.every((m) => m.has(date)))
  if (!labels.length) return json({ labels: [], portfolio: [], spx: [] })

  const value = (date: string) => symbols.reduce((s, sym, i) => s + qty.get(sym)! * bySymbol[i].get(date)!, 0)
  const p0 = value(labels[0])
  const s0 = spxBy.get(labels[0])!
  return json({
    labels,
    portfolio: labels.map((d) => +((value(d) / p0 - 1) * 100).toFixed(2)),
    spx: labels.map((d) => +((spxBy.get(d)! / s0 - 1) * 100).toFixed(2)),
  })
})
