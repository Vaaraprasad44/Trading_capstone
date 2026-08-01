import { db } from './db'

// ponytail: naive matcher — per-fill scan, 48h window, 2% price tolerance, no
// quantity accounting across partial fills, SIP match = symbol appears in the
// month's published plan. Upgrade path: the real reconciliation agent (PRD 7.2)
// with qty aggregation and fund attribution, once the SnapTrade spike answers
// DB-SCHEMA.md §5 open question 1.
const WINDOW_MS = 48 * 3600e3
const PRICE_TOLERANCE = 0.02

// Overridable so the reconciliation agent can re-plan on trader feedback
// (agent_feedback.adjustment → these knobs; PRD 7.4).
export type ReconcileOpts = { windowMs?: number; priceTolerance?: number }

export async function reconcile(opts: ReconcileOpts = {}) {
  const windowMs = opts.windowMs ?? WINDOW_MS
  const priceTolerance = opts.priceTolerance ?? PRICE_TOLERANCE
  const pending = await db.broker_fills.findMany({
    where: { activity_type: 'trade', reconciliations: null },
    orderBy: { executed_at: 'asc' },
  })

  const counts = { matched: 0, mismatched: 0, unmatched_fill: 0, unmatched_card: 0 }

  for (const fill of pending) {
    const from = new Date(fill.executed_at.getTime() - windowMs)
    const to = new Date(fill.executed_at.getTime() + windowMs)

    if (fill.instrument_id != null) {
      // entry: a published card on this instrument whose entry side is the fill side
      const card = await db.trade_cards.findFirst({
        where: {
          instrument_id: fill.instrument_id,
          status: { not: 'draft' },
          direction: fill.side === 'buy' ? 'long' : 'short',
          published_at: { gte: from, lte: to },
        },
        orderBy: { published_at: 'asc' },
      })
      if (card) {
        const delta = Math.abs(Number(fill.price) - Number(card.entry_price)) / Number(card.entry_price)
        const ok = delta <= priceTolerance
        await db.reconciliations.create({
          data: {
            kind: 'entry',
            status: ok ? 'matched' : 'mismatched',
            trade_card_id: card.id,
            broker_fill_id: fill.id,
            details: ok ? {} : { price_delta_pct: +(delta * 100).toFixed(2) },
          },
        })
        counts[ok ? 'matched' : 'mismatched']++
        continue
      }

      // exit: a close/partial-exit event on this instrument, opposite side
      const event = await db.trade_card_events.findFirst({
        where: {
          event_type: { in: ['partial_exit', 'closed'] },
          created_at: { gte: from, lte: to },
          trade_cards: {
            instrument_id: fill.instrument_id,
            direction: fill.side === 'sell' ? 'long' : 'short',
          },
        },
        orderBy: { created_at: 'asc' },
      })
      if (event) {
        await db.reconciliations.create({
          data: { kind: 'exit', status: 'matched', trade_card_event_id: event.id, broker_fill_id: fill.id },
        })
        counts.matched++
        continue
      }
    }

    // SIP: a buy whose symbol is in the month's published plan is claimed by the plan
    if (fill.side === 'buy' && fill.raw_symbol) {
      const monthStart = new Date(Date.UTC(fill.executed_at.getUTCFullYear(), fill.executed_at.getUTCMonth(), 1))
      const plan = await db.sip_plans.findFirst({
        where: { month: monthStart, published_at: { not: null } },
      })
      const symbols = Array.isArray(plan?.breakdown)
        ? (plan.breakdown as { symbol?: string }[]).map((b) => b.symbol)
        : []
      if (plan && symbols.includes(fill.raw_symbol)) {
        await db.reconciliations.create({
          data: { kind: 'entry', status: 'matched', sip_plan_id: plan.id, broker_fill_id: fill.id },
        })
        counts.matched++
        continue
      }
    }

    // nobody published this fill — the omission flag (PRD 1.4)
    await db.reconciliations.create({
      data: { kind: fill.side === 'sell' ? 'exit' : 'entry', status: 'unmatched_fill', broker_fill_id: fill.id },
    })
    counts.unmatched_fill++
  }

  // cards published >24h ago with no entry reconciliation at all (PRD 1.3)
  const stale = await db.trade_cards.findMany({
    where: {
      status: { not: 'draft' },
      published_at: { lte: new Date(Date.now() - 24 * 3600e3) },
      reconciliations: { none: { kind: 'entry' } },
    },
  })
  for (const card of stale) {
    await db.reconciliations.create({
      data: { kind: 'entry', status: 'unmatched_card', trade_card_id: card.id },
    })
    counts.unmatched_card++
  }

  return counts
}
