import type { Prisma } from '@prisma/client'
import { db } from './db'
import { reconcile, type ReconcileOpts } from './reconcile'
import { snaptrade, snaptradeConfigured, type SnapActivity } from './snaptrade'

export type FillInput = {
  snaptrade_txn_id: string
  symbol?: string
  name?: string
  activity_type: string
  side?: 'buy' | 'sell'
  quantity?: number
  price?: number
  amount?: number
  fees?: number
  executed_at: Date
  raw: Record<string, unknown>
}

// SnapTrade activity type → broker_fills.activity_type (DB CHECK values).
// REI (dividend reinvestment) is a broker-initiated buy the trader never
// placed — anything but 'trade', or omission detection flags every one.
const TYPE_MAP: Record<string, string> = {
  BUY: 'trade',
  SELL: 'trade',
  DIVIDEND: 'dividend',
  REI: 'other',
  CONTRIBUTION: 'transfer',
  WITHDRAWAL: 'transfer',
  TRANSFER: 'transfer',
  INTEREST: 'interest',
  FEE: 'fee',
}

export function mapActivity(a: SnapActivity): FillInput | null {
  const executed_at = a.trade_date ?? a.settlement_date
  if (!executed_at) return null
  const type = TYPE_MAP[a.type] ?? 'other'
  return {
    snaptrade_txn_id: a.id,
    symbol: a.symbol?.raw_symbol?.toUpperCase(),
    name: a.symbol?.description,
    activity_type: type,
    side: type === 'trade' ? (a.type === 'BUY' ? 'buy' : 'sell') : undefined,
    quantity: a.units != null ? Math.abs(a.units) : undefined,
    price: a.price ?? undefined,
    amount: a.amount ?? undefined,
    fees: a.fee ?? 0,
    executed_at: new Date(executed_at),
    raw: a as unknown as Record<string, unknown>,
  }
}

export async function ingestFills(fills: FillInput[]): Promise<number> {
  let ingested = 0
  for (const f of fills) {
    const instrument = f.symbol
      ? await db.instruments.upsert({
          where: { symbol: f.symbol },
          create: { symbol: f.symbol, name: f.name ?? f.symbol },
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
          fees: f.fees ?? 0,
          executed_at: f.executed_at,
          raw: f.raw as Prisma.InputJsonValue,
        },
      ],
      skipDuplicates: true, // snaptrade_txn_id = idempotent ingest
    })
    ingested += result.count
  }
  return ingested
}

// The record starts at the earliest fund inception — the trader's pre-launch
// personal history is not part of the track record (and would flood omission
// detection). Re-pull a 7-day overlap so late-arriving fills are never missed.
async function pullWindow(): Promise<{ startDate: string; endDate: string }> {
  const [{ min }] = await db.$queryRaw<{ min: Date | null }[]>`SELECT min(inception_date) FROM funds`
  const lastOk = await db.feed_syncs.findFirst({ where: { status: 'ok' }, orderBy: { started_at: 'desc' } })
  const overlap = lastOk ? new Date(lastOk.started_at.getTime() - 7 * 86400e3) : null
  const start = overlap && min && overlap > min ? overlap : (min ?? new Date())
  return { startDate: start.toISOString().slice(0, 10), endDate: new Date().toISOString().slice(0, 10) }
}

// One sync run: fills from the request body (tests/manual) or live from
// SnapTrade, then reconcile. feed_syncs row is the audit trail either way.
export async function runSync(trigger: string, bodyFills?: FillInput[], opts: ReconcileOpts = {}) {
  const sync = await db.feed_syncs.create({ data: { trigger } })
  try {
    let fills: FillInput[]
    if (bodyFills?.length) {
      fills = bodyFills
    } else if (snaptradeConfigured()) {
      const { startDate, endDate } = await pullWindow()
      fills = (await snaptrade.getActivities(startDate, endDate))
        .map(mapActivity)
        .filter((f): f is FillInput => f !== null)
    } else {
      throw new Error('no fills in body and SnapTrade is not configured')
    }
    const ingested = await ingestFills(fills)
    const reconciliation = await reconcile(opts)
    const done = await db.feed_syncs.update({
      where: { id: sync.id },
      data: { status: 'ok', finished_at: new Date(), fills_ingested: ingested },
    })
    return { sync: done, reconciliation }
  } catch (err) {
    await db.feed_syncs.update({
      where: { id: sync.id },
      data: { status: 'error', finished_at: new Date(), error: String(err) },
    })
    throw err
  }
}
