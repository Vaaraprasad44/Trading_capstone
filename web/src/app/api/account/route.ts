import { snaptrade, snaptradeConfigured } from '@/lib/snaptrade'
import { handle, json } from '@/lib/http'

// Real account money math, all broker-reported (SnapTrade):
//   realized = cash + open cost basis − net contributions
// Market prices cancel out of that identity, so it needs no quotes; it nets
// every cash-affecting event since account opening — closed trades,
// dividends, interest, fees. Dividends/interest also broken out for display.
export const GET = handle(async () => {
  if (!snaptradeConfigured()) return json({ error: 'SnapTrade not configured' }, { status: 503 })

  const today = new Date().toISOString().slice(0, 10)
  const [positions, balances, activities] = await Promise.all([
    snaptrade.getPositions(),
    snaptrade.getBalances(),
    snaptrade.getActivities('2000-01-01', today),
  ])

  // cost_basis is per-share (see snaptrade.ts) — total = basis × units
  const costBasis = positions.reduce(
    (s, p) => s + (p.cost_basis != null && p.units != null ? Number(p.cost_basis) * Number(p.units) : 0),
    0,
  )
  const cash = balances.reduce((s, b) => s + (b.cash ?? 0), 0)
  const buyingPower = balances.reduce((s, b) => s + (b.buying_power ?? 0), 0)

  // abs() both ways: broker feeds disagree on withdrawal sign conventions
  let net = 0
  let dividends = 0
  let interest = 0
  for (const a of activities) {
    const amt = Math.abs(a.amount ?? 0)
    if (a.type === 'CONTRIBUTION') net += amt
    else if (a.type === 'WITHDRAWAL') net -= amt
    else if (a.type === 'DIVIDEND') dividends += amt
    else if (a.type === 'INTEREST') interest += amt
  }

  return json({
    cash: +cash.toFixed(2),
    buyingPower: +buyingPower.toFixed(2),
    netContributions: +net.toFixed(2),
    realized: +(cash + costBasis - net).toFixed(2),
    dividends: +dividends.toFixed(2),
    interest: +interest.toFixed(2),
  })
})
