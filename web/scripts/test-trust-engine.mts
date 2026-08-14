// Trust-engine test suite: SnapTrade client signing, live-pull ingest,
// reconciliation, worker (nudges, dedup, feedback re-planning), webhook gating.
// SnapTrade is mocked at the fetch boundary — deterministic, runs offline.
// Run: npm run test:trust  (needs local Postgres, like smoke)
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { execSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'
import { seed } from '../prisma/seed.js'

// ---- scratch DB (smoke.mts pattern) ----
const BASE = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/meridian'
const TEST_URL = BASE.replace(/\/[^/]*$/, '/meridian_trust_test')
const admin = new PrismaClient({ datasourceUrl: BASE.replace(/\/[^/]*$/, '/postgres') })
await admin.$executeRawUnsafe('DROP DATABASE IF EXISTS meridian_trust_test WITH (FORCE)')
await admin.$executeRawUnsafe('CREATE DATABASE meridian_trust_test')
await admin.$disconnect()
execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: TEST_URL }, stdio: 'pipe' })

// env BEFORE importing app modules (db reads DATABASE_URL at import)
process.env.DATABASE_URL = TEST_URL
process.env.SNAPTRADE_CLIENT_ID = 'PERS-TESTCLIENT'
process.env.SNAPTRADE_CONSUMER_KEY = 'test-consumer-key'
process.env.SNAPTRADE_USER_ID = 'test@example.com'
process.env.SNAPTRADE_ACCOUNT_ID = 'acct-1'

// ---- SnapTrade mock at the fetch boundary ----
const HOUR = 3600e3
const now = Date.now()
const iso = (msAgo: number) => new Date(now - msAgo).toISOString()
const sym = (s: string) => ({ symbol: s, raw_symbol: s, description: `${s} Inc.` })
const act = (id: string, type: string, symbol: string | null, extra: object = {}) => ({
  id, type, symbol: symbol ? sym(symbol) : null, description: '', amount: 100, price: 100.5,
  units: type === 'SELL' ? -1 : 1, fee: 0, trade_date: iso(2 * HOUR), settlement_date: iso(HOUR),
  institution: 'Robinhood', ...extra,
})

const canned: Record<string, unknown> = {
  '/accounts': [
    { id: 'acct-1', name: 'Robinhood Individual', institution_name: 'Robinhood',
      balance: { total: { amount: 7500.25, currency: 'USD' } }, sync_status: {} },
  ],
  '/accounts/acct-1/activities': {
    data: [
      act('t-nvda', 'BUY', 'NVDA'),          // matches the published card → matched
      act('t-amd', 'BUY', 'AMD'),            // no card → omission flag
      act('t-rei', 'REI', 'NVDA'),           // broker-initiated buy → never flagged
      act('t-div', 'DIVIDEND', 'NVDA'),
      act('t-dep', 'CONTRIBUTION', null),
    ],
  },
  '/accounts/acct-1/orders': [
    { brokerage_order_id: 'ord-tsla', status: 'EXECUTED', action: 'BUY', universal_symbol: sym('TSLA'),
      total_quantity: '1', filled_quantity: '1', execution_price: '250.10', limit_price: null,
      order_type: 'Market', time_placed: iso(2 * HOUR), time_executed: iso(HOUR) },
    { brokerage_order_id: 'ord-old', status: 'EXECUTED', action: 'BUY', universal_symbol: sym('MSFT'),
      total_quantity: '1', filled_quantity: '1', execution_price: '400.00', limit_price: null,
      order_type: 'Market', time_placed: iso(50 * HOUR), time_executed: iso(49 * HOUR) }, // >24h → ignored
    { brokerage_order_id: 'ord-pending', status: 'NONE', action: 'BUY', universal_symbol: sym('SPY'),
      total_quantity: '1', filled_quantity: '0', execution_price: null, limit_price: '600',
      order_type: 'Market', time_placed: iso(HOUR), time_executed: null }, // not executed → ignored
  ],
  '/accounts/acct-1/balances': [{ cash: 111.11, buying_power: 110.0 }],
  '/accounts/acct-1/positions/all': {
    results: [
      { instrument: { kind: 'etf', symbol: 'VOO', raw_symbol: 'VOO', description: 'Test S&P 500 ETF' }, units: '2.5', price: '500.00', cost_basis: '1200.00', currency: 'USD' },
      { instrument: { kind: 'stock', symbol: 'MRK', raw_symbol: 'MRK', description: 'Test Pharma' }, units: '5', price: '130.00', cost_basis: '667.50', currency: 'USD' },
      { instrument: null, units: null, price: null, cost_basis: null, currency: null },
    ],
  },
}

// canned Yahoo chart payload (marketdata module) — fictional values
const yahooChart = {
  chart: {
    result: [{
      meta: { symbol: 'SPY', longName: 'Test S&P 500 ETF', regularMarketPrice: 645.5, chartPreviousClose: 640.0,
        fiftyTwoWeekHigh: 700.1, fiftyTwoWeekLow: 500.2 },
      timestamp: [1754352000, 1754438400, 1754524800], // 2025-08-05..07 UTC days
      indicators: { quote: [{ close: [630.25, null, 645.5] }] },
    }],
    error: null,
  },
}

let lastRequest: { path: string; query: string; signature: string } | null = null
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(String(input instanceof Request ? input.url : input))
  if (url.origin === 'https://query1.finance.yahoo.com') {
    assert.match(url.pathname, /^\/v8\/finance\/chart\//)
    return new Response(JSON.stringify(yahooChart), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  assert.equal(url.origin, 'https://api.snaptrade.com', `unexpected fetch target: ${url}`)
  const path = url.pathname.replace('/api/v1', '')
  const headers = new Headers(input instanceof Request ? input.headers : init?.headers)
  lastRequest = { path: url.pathname, query: url.search.slice(1), signature: headers.get('Signature') ?? '' }
  const body = canned[path]
  if (!body) return new Response(JSON.stringify({ detail: 'not mocked' }), { status: 404 })
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
}) as typeof fetch

const { db } = await import('../src/lib/db.js')
const { snaptrade, snaptradeConfigured } = await import('../src/lib/snaptrade.js')
const { runSync, mapActivity } = await import('../src/lib/feed.js')
const { marketdata } = await import('../src/lib/marketdata.js')
const { plan, checkOrders, cycle, writeDaily } = await import('./worker.mjs')

await seed(db, { demo: false })

// ---- 1. client signing: HMAC over {content,path,query} sorted-key JSON ----
{
  await snaptrade.getBalances()
  assert.ok(lastRequest, 'client made a request')
  const { query, signature } = lastRequest!
  const payload = JSON.stringify({ content: null, path: '/api/v1/accounts/acct-1/balances', query })
  const expected = createHmac('sha256', 'test-consumer-key').update(payload).digest('base64')
  assert.equal(signature, expected, 'Signature header must be the spike-proven HMAC construction')
  assert.match(query, /clientId=PERS-TESTCLIENT/, 'clientId in query')
  assert.match(query, /timestamp=\d+/, 'unix timestamp in query')
  console.log('✓ client signs requests correctly')
}

// ---- 2. live-pull sync: mapping, matching, omissions, idempotency ----
{
  // a published card that the NVDA fill should verify against
  const nvda = await db.instruments.upsert({
    where: { symbol: 'NVDA' }, update: {}, create: { symbol: 'NVDA', name: 'NVIDIA' },
  })
  const card = await db.trade_cards.create({
    data: {
      fund_id: 1, instrument_id: nvda.id, direction: 'long', entry_price: 100, position_pct: 10,
      thesis_md: 'test', stop_price: 90, exit_rules_md: 'stop', status: 'published', published_at: new Date(),
    },
  })

  const { sync, reconciliation } = await runSync('on_demand') // no body fills → SnapTrade pull
  assert.equal(sync.status, 'ok')
  assert.equal(sync.fills_ingested, 5, 'all five canned activities ingest')
  assert.equal(reconciliation.matched, 1, 'NVDA fill matches the published card')
  assert.equal(reconciliation.unmatched_fill, 1, 'AMD trade is an omission')

  const rei = await db.broker_fills.findUnique({ where: { snaptrade_txn_id: 't-rei' } })
  assert.equal(rei!.activity_type, 'other', 'REI must not be a trade')
  assert.equal(
    (await db.reconciliations.count({ where: { broker_fills: { snaptrade_txn_id: { in: ['t-rei', 't-div', 't-dep'] } } } })),
    0, 'non-trades never get reconciliation rows',
  )

  const verified = await db.reconciliations.findFirst({ where: { trade_card_id: card.id } })
  assert.equal(verified!.status, 'matched')

  const again = await runSync('on_demand')
  assert.equal(again.sync.fills_ingested, 0, 're-sync is idempotent')
  console.log('✓ live-pull sync: mapping, verified stamp, omission flag, idempotent')
}

// ---- 3. worker stage 1: unpublished executed orders flagged, self-clearing ----
{
  await db.users.create({
    data: { email: 'trader@test', auth_provider: 'test', auth_subject: 't', role: 'trader' },
  })
  const cfg = await plan()
  assert.deepEqual(
    [cfg.poll_minutes, cfg.sync_every_hours, cfg.price_tolerance_pct, cfg.window_hours, cfg.applied],
    [10, 6, 2, 48, []], 'defaults with no feedback',
  )

  const stage1 = await checkOrders(cfg)
  assert.equal(stage1.orders_checked, 1, 'old (>24h) and pending orders are ignored')
  assert.deepEqual(stage1.unpublished, [{ order_id: 'ord-tsla', symbol: 'TSLA', action: 'BUY' }],
    'executed TSLA order has no card → nudge')

  // publishing the card clears the nudge on the next cycle (stateless gauge)
  const tsla = await db.instruments.upsert({
    where: { symbol: 'TSLA' }, update: {}, create: { symbol: 'TSLA', name: 'Tesla' },
  })
  await db.trade_cards.create({
    data: {
      fund_id: 3, instrument_id: tsla.id, direction: 'long', entry_price: 250, position_pct: 5,
      thesis_md: 'test', stop_price: 240, exit_rules_md: 'stop', status: 'published', published_at: new Date(),
    },
  })
  assert.deepEqual((await checkOrders(cfg)).unpublished, [], 'published card clears the nudge')
  console.log('✓ worker stage 1: unpublished order flagged, clears once the card is published')
}

// ---- 4. worker re-planning from trader feedback (Bar #2) ----
{
  const trader = await db.users.findFirstOrThrow({ where: { role: 'trader' } })
  await db.agent_feedback.create({
    data: { agent: 'reconciliation', user_id: trader.id, feedback: 'loosen it',
      adjustment: { price_tolerance_pct: 5, poll_minutes: 30, bogus_knob: 99, window_hours: -1 } },
  })
  const cfg = await plan()
  assert.equal(cfg.price_tolerance_pct, 5, 'feedback adjustment applied')
  assert.equal(cfg.poll_minutes, 30)
  assert.equal(cfg.window_hours, 48, 'non-positive values rejected')
  assert.ok(!('bogus_knob' in cfg), 'unknown knobs ignored')

  const before = await db.agent_runs.count()
  await cycle('on_demand')
  const run = await db.agent_runs.findFirstOrThrow({ orderBy: { id: 'desc' } })
  assert.equal(await db.agent_runs.count(), before + 1)
  assert.equal(run.status, 'ok')
  const summary = run.summary as { plan: { price_tolerance_pct: number }; equity: { equity: number }[] }
  assert.equal(summary.plan.price_tolerance_pct, 5, 'run summary records the re-planned config')
  assert.equal(summary.equity[0].equity, 7500.25, 'equity snapshot recorded per run')
  console.log('✓ worker re-plans from agent_feedback; run audit trail written')
}

// ---- 5. sync route guard & webhook gating (route handlers called directly) ----
{
  const post = (url: string, body: unknown) =>
    new Request(`http://test${url}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

  const { POST: syncPost } = await import('../src/app/api/feed/sync/route.js')
  const saved = process.env.SNAPTRADE_CLIENT_ID
  delete process.env.SNAPTRADE_CLIENT_ID
  assert.equal(snaptradeConfigured(), false)
  assert.equal((await syncPost(post('/api/feed/sync', {}), {})).status, 503, 'no fills + unconfigured → 503')
  process.env.SNAPTRADE_CLIENT_ID = saved

  const { POST: webhookPost } = await import('../src/app/api/feed/webhook/route.js')
  delete process.env.SNAPTRADE_WEBHOOK_SECRET
  assert.equal((await webhookPost(post('/api/feed/webhook', { webhookSecret: 'x' }), {})).status, 503, 'no secret configured → off')
  process.env.SNAPTRADE_WEBHOOK_SECRET = 'hook-secret'
  assert.equal((await webhookPost(post('/api/feed/webhook', { webhookSecret: 'wrong', eventType: 'ACCOUNT_TRANSACTIONS_UPDATED' }), {})).status, 401, 'bad secret → 401')
  const ignored = await webhookPost(post('/api/feed/webhook', { webhookSecret: 'hook-secret', eventType: 'USER_REGISTERED' }), {})
  assert.equal((await ignored.json()).ignored, 'USER_REGISTERED', 'non-transaction events acked, no sync')
  const hooked = await webhookPost(post('/api/feed/webhook', { webhookSecret: 'hook-secret', eventType: 'ACCOUNT_TRANSACTIONS_UPDATED' }), {})
  assert.equal(hooked.status, 200)
  assert.equal((await hooked.json()).sync.trigger, 'webhook', 'valid webhook triggers a sync')
  console.log('✓ sync 503 guard; webhook: off / bad secret / ignored event / real sync')
}

// ---- 6. market data: quote + closes parsing, quotes route ----
{
  const q = await marketdata.getQuote('SPY')
  assert.equal(q.price, 645.5)
  assert.ok(q.dayPct && Math.abs(q.dayPct - 0.859) < 0.01, 'day% from previous close')
  assert.equal(q.wk52High, 700.1)

  const closes = await marketdata.getDailyCloses('SPY', '1mo')
  assert.equal(closes.length, 2, 'null closes dropped')
  assert.deepEqual(closes[0], { date: '2025-08-05', close: 630.25 })

  const { GET: quotesGet } = await import('../src/app/api/quotes/route.js')
  const res = await quotesGet(new Request('http://test/api/quotes?symbols=spy,QQQ'), {})
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.length, 2)
  assert.equal(body[0].price, 645.5)
  console.log('✓ market data: chart parsing, cache, quotes route')
}

// ---- 7. activity + plan-publish routes ----
{
  const { GET: activityGet } = await import('../src/app/api/activity/route.js')
  const res = await activityGet(new Request('http://test/api/activity?type=trade&limit=5'), {})
  const acts = await res.json()
  assert.ok(acts.length >= 2, 'trades present from earlier sync')
  assert.ok(acts.every((a: { activity_type: string }) => a.activity_type === 'trade'))
  assert.ok(acts[0].verification, 'each row carries a verification status')

  const { POST: planPost } = await import('../src/app/api/funds/[code]/sip-plan/route.js')
  const publish = (body: unknown) =>
    planPost(
      new Request('http://test/api/funds/sip/sip-plan', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ code: 'sip' }) },
    )
  const sept = { month: '2026-09-01', plan_md: 'Sept: keep DCA.', breakdown: [{ symbol: 'VOO', pct: 100 }] }
  assert.equal((await publish(sept)).status, 201, 'plan publishes')
  assert.equal((await publish(sept)).status, 409, 'published plan is immutable — no second publish for the month')
  assert.equal((await publish({ ...sept, breakdown: [] })).status, 400, 'empty breakdown rejected')
  console.log('✓ activity route; plan publish + immutability')
}

// ---- 7b. holdings route: broker positions + plan membership + day% ----
{
  const { GET: holdingsGet } = await import('../src/app/api/holdings/route.js')
  const res = await holdingsGet(new Request('http://test/api/holdings'), {})
  assert.equal(res.status, 200)
  const rows = await res.json()
  assert.equal(rows.length, 2, 'null-unit rows dropped')
  const voo = rows.find((r: { symbol: string }) => r.symbol === 'VOO')
  assert.equal(voo.qty, 2.5)
  assert.equal(voo.avg, 480.0, 'avg = total cost_basis / units')
  assert.equal(voo.open_pnl, 50.0, 'P&L computed from price vs cost basis')
  assert.equal(voo.in_plan, true, 'VOO is in the published plan')
  assert.equal(rows.find((r: { symbol: string }) => r.symbol === 'MRK').in_plan, false)
  assert.ok(voo.dayPct != null, 'day% merged from market data')
  console.log('✓ holdings route: positions merged with plan membership and day%')
}

// ---- 8. worker daily bookkeeping: benchmark + whole-account NAV ----
{
  process.env.SNAPTRADE_ACCOUNT_ID = 'acct-1'
  const daily = await writeDaily([{ id: 'acct-1', account: 'Robinhood Individual', equity: 7500.25 }])
  assert.equal(daily.nav, 7500.25)
  assert.equal(await db.benchmark_prices.count({ where: { symbol: 'SPY' } }), 2, 'SPY closes upserted')
  const sip = await db.funds.findUniqueOrThrow({ where: { code: 'sip' } })
  const nav = await db.fund_nav_daily.findFirstOrThrow({ where: { fund_id: sip.id } })
  assert.equal(Number(nav.nav), 7500.25)
  assert.equal(Number(nav.cash), 111.11, 'cash from balances')
  assert.equal(Number(nav.invested), 100, 'invested = positive transfers')
  await writeDaily([{ id: 'acct-1', account: 'x', equity: 7600 }])
  assert.equal(Number((await db.fund_nav_daily.findFirstOrThrow({ where: { fund_id: sip.id } })).nav), 7600, 'same-day upsert')
  console.log('✓ worker daily: SPY benchmark ingest, NAV upsert')
}

// mapActivity edge already covered in test-feed-map.mts; keep one integration sanity here
assert.equal(mapActivity(act('x', 'BUY', 'NVDA', { trade_date: null, settlement_date: null }) as never), null)

await db.$disconnect()
console.log('\nTRUST ENGINE TESTS PASSED')
