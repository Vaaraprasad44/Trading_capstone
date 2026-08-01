// Reconciliation agent — the background worker (PRD 1.3/1.4/7.2, capstone Bar #2).
//
// Two-stage verification (SPIKE-SNAPTRADE.md §7):
//   stage 1, every cycle (~10 min): recent-orders lane — any EXECUTED order with
//     no published trade card within the window → detection nudge to the trader.
//   stage 2, every few hours: transactions lane — full ingest + formal
//     reconciliation stamps (matched / mismatched / omission).
//
// Re-planning (Bar #2): every cycle re-reads agent_feedback; the trader's
// adjustments (poll cadence, price tolerance, match window) take effect on the
// next cycle — schedule, manual feedback, and source events all change behavior.
// Run modes: `npm run worker` (loop) · `npm run worker -- --once` (single cycle).
import { pathToFileURL } from 'node:url'
import { db } from '../src/lib/db.js'
import { runSync } from '../src/lib/feed.js'
import { snaptrade, snaptradeConfigured } from '../src/lib/snaptrade.js'

const DEFAULTS = { poll_minutes: 10, sync_every_hours: 6, price_tolerance_pct: 2, window_hours: 48 }

export async function plan(): Promise<typeof DEFAULTS & { applied: string[] }> {
  const feedback = await db.agent_feedback.findMany({
    where: { agent: 'reconciliation' },
    orderBy: { created_at: 'asc' },
  })
  const cfg = { ...DEFAULTS, applied: [] as string[] }
  for (const f of feedback) {
    if (!f.adjustment || typeof f.adjustment !== 'object') continue
    for (const [k, v] of Object.entries(f.adjustment as Record<string, unknown>)) {
      if (k in DEFAULTS && typeof v === 'number' && v > 0) {
        cfg[k as keyof typeof DEFAULTS] = v
        cfg.applied.push(`${k}=${v} (feedback #${f.id})`)
      }
    }
  }
  return cfg
}

// Stage 1: same-day corroboration off the orders lane. Executed orders with no
// published card inside the window = the "publish your card" nudge (PRD 1.4's
// early warning). Stateless by design: the list empties itself once the card
// is published; the formal omission flag comes from stage 2's fills.
// ponytail: summary-only until Epic 7.1 builds alert delivery — notifications'
// kind CHECK has no nudge kind yet, and nothing sends email/push today.
export async function checkOrders(cfg: typeof DEFAULTS) {
  const windowMs = cfg.window_hours * 3600e3
  const orders = (await snaptrade.getOrders()).filter(
    (o) => o.status === 'EXECUTED' && o.time_executed && Date.now() - Date.parse(o.time_executed) < 86400e3,
  )
  const unpublished: { order_id: string; symbol: string; action: string }[] = []
  for (const o of orders) {
    const symbol = o.universal_symbol?.raw_symbol?.toUpperCase()
    if (!symbol) continue
    const executed = Date.parse(o.time_executed!)
    const card = await db.trade_cards.findFirst({
      where: {
        status: { not: 'draft' },
        instruments: { symbol },
        published_at: { gte: new Date(executed - windowMs), lte: new Date(executed + windowMs) },
      },
    })
    if (!card) unpublished.push({ order_id: o.brokerage_order_id, symbol, action: o.action })
  }
  return { orders_checked: orders.length, unpublished }
}

async function equitySnapshot() {
  const accounts = await snaptrade.listAccounts()
  return accounts.map((a) => ({ account: a.name, equity: a.balance.total?.amount ?? null }))
}

export async function cycle(trigger: string) {
  const cfg = await plan()
  const run = await db.agent_runs.create({ data: { agent: 'reconciliation', trigger } })
  const summary: Record<string, unknown> = { plan: cfg }
  try {
    summary.stage1 = await checkOrders(cfg)
    const lastOk = await db.feed_syncs.findFirst({ where: { status: 'ok' }, orderBy: { started_at: 'desc' } })
    if (!lastOk || Date.now() - lastOk.started_at.getTime() > cfg.sync_every_hours * 3600e3) {
      const { sync, reconciliation } = await runSync('schedule', undefined, {
        windowMs: cfg.window_hours * 3600e3,
        priceTolerance: cfg.price_tolerance_pct / 100,
      })
      summary.stage2 = { fills_ingested: sync.fills_ingested, ...reconciliation }
    }
    // whole-account equity, recorded per run. Per-fund NAV stays open until the
    // fund-attribution decision (DB-SCHEMA §5) — never fabricate a split.
    summary.equity = await equitySnapshot()
    await db.agent_runs.update({
      where: { id: run.id },
      data: { status: 'ok', finished_at: new Date(), summary: JSON.parse(JSON.stringify(summary)) },
    })
    console.log(new Date().toISOString(), 'cycle ok', JSON.stringify(summary))
  } catch (err) {
    await db.agent_runs.update({
      where: { id: run.id },
      data: { status: 'error', finished_at: new Date(), summary: { ...summary, error: String(err) } },
    })
    console.error(new Date().toISOString(), 'cycle failed:', err)
  }
  return cfg
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  if (!snaptradeConfigured()) {
    console.error('SNAPTRADE_CLIENT_ID / SNAPTRADE_CONSUMER_KEY not set — worker cannot run')
    process.exit(1)
  }
  if (process.argv.includes('--once')) {
    await cycle('on_demand')
    await db.$disconnect()
  } else {
    let stopped = false
    process.on('SIGTERM', () => (stopped = true))
    process.on('SIGINT', () => (stopped = true))
    while (!stopped) {
      const cfg = await cycle('schedule')
      await new Promise((r) => setTimeout(r, cfg.poll_minutes * 60e3))
    }
    await db.$disconnect()
  }
}
