import { PrismaClient } from '@prisma/client'

export async function seed(db: PrismaClient, { demo = true }: { demo?: boolean } = {}) {
  const funds = [
    { id: 1, code: 'alpha', name: '$1M Alpha Fund', description: 'Long-term conviction picks vs. the S&P.', badge: 'Long-term investing' },
    { id: 2, code: 'sip', name: 'Smart SIP', description: 'A disciplined monthly plan for small, regular contributions.', badge: 'Monthly plan' },
    { id: 3, code: 'swing', name: 'Swing Fund', description: 'Days-to-weeks trades with published stops and exits.', badge: 'Short-term swings' },
  ] as const
  for (const f of funds) {
    await db.funds.upsert({
      where: { id: f.id },
      create: { ...f, inception_date: new Date('2026-01-01') },
      update: { name: f.name, description: f.description, badge: f.badge },
    })
  }

  for (const s of [
    { symbol: 'NVDA', name: 'NVIDIA Corp', asset_type: 'equity' },
    { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', asset_type: 'etf' },
    { symbol: 'SPY', name: 'SPDR S&P 500 ETF', asset_type: 'etf' },
  ]) {
    await db.instruments.upsert({ where: { symbol: s.symbol }, create: s, update: {} })
  }

  // Published sizing formulas (PRD 5.2) — the copy-sizing Skill applies these
  const methodologies = [
    { fund_id: 1, body_md: 'Alpha: allocate position % of your satellite slice; no leverage.', params: { max_position_pct: 10 } },
    { fund_id: 2, body_md: 'SIP: split your monthly contribution by the published plan percentages.', params: {} },
    { fund_id: 3, body_md: 'Swing: risk 1–2% per trade; position = risk $ ÷ (entry − stop).', params: { risk_pct_min: 1, risk_pct_max: 2 } },
  ]
  for (const m of methodologies) {
    await db.sizing_methodologies.upsert({
      where: { fund_id_version: { fund_id: m.fund_id, version: 1 } },
      create: { ...m, version: 1 },
      update: {},
    })
  }

  if ((await db.disclosure_versions.count()) === 0) {
    await db.disclosure_versions.create({
      data: { body_md: 'Not financial advice. Past performance does not guarantee future results.' },
    })
  }

  // Current month's SIP plan so DCA fills have a claim to reconcile against
  const now = new Date()
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  await db.sip_plans.upsert({
    where: { fund_id_month: { fund_id: 2, month } },
    create: {
      fund_id: 2,
      month,
      plan_md: 'This month: 100% VOO — stay the course.',
      breakdown: [{ symbol: 'VOO', pct: 100 }],
      published_at: new Date(),
    },
    update: {},
  })

  if (demo) await seedDemoContent(db)
}

// ---------------------------------------------------------------------------
// Demo content so the frontend has something real to consume: verified trade
// cards, an omission flag, NAV/benchmark history, news, key facts.
// Fake numbers, real reconciliation mechanics. Runs only on an empty DB.
// ---------------------------------------------------------------------------
async function seedDemoContent(db: PrismaClient) {
  if ((await db.trade_cards.count()) > 0) return

  const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 3600e3)
  const dateOnly = (n: number) => {
    const d = daysAgo(n)
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  }

  const instrument = async (symbol: string, name: string) =>
    db.instruments.upsert({ where: { symbol }, create: { symbol, name }, update: {} })

  const ids: Record<string, bigint> = {}
  for (const [symbol, name] of [
    ['NVDA', 'NVIDIA Corp'], ['MSFT', 'Microsoft Corp'], ['LLY', 'Eli Lilly and Co'],
    ['AMD', 'Advanced Micro Devices'], ['TSLA', 'Tesla Inc'], ['PLTR', 'Palantir Technologies'],
    ['HOOD', 'Robinhood Markets'], ['VOO', 'Vanguard S&P 500 ETF'],
  ] as const) {
    ids[symbol] = (await instrument(symbol, name)).id
  }

  // A published card whose entry fill reconciles → public ✓ verified stamp
  const verifiedCard = async (opts: {
    fund: number; symbol: string; entry: number; pct: number; stop: number;
    thesis: string; exits: string; publishedDaysAgo: number; fillPrice: number; qty: number;
  }) => {
    const card = await db.trade_cards.create({
      data: {
        fund_id: opts.fund, instrument_id: ids[opts.symbol], direction: 'long',
        entry_price: opts.entry, position_pct: opts.pct, thesis_md: opts.thesis,
        stop_price: opts.stop, exit_rules_md: opts.exits,
        status: 'published', published_at: daysAgo(opts.publishedDaysAgo),
      },
    })
    const fill = await db.broker_fills.create({
      data: {
        snaptrade_txn_id: `demo-${opts.symbol}-${opts.publishedDaysAgo}`,
        instrument_id: ids[opts.symbol], raw_symbol: opts.symbol, side: 'buy',
        quantity: opts.qty, price: opts.fillPrice, fees: 0.12,
        executed_at: daysAgo(opts.publishedDaysAgo), raw: { demo: true },
      },
    })
    await db.reconciliations.create({
      data: { kind: 'entry', status: 'matched', trade_card_id: card.id, broker_fill_id: fill.id },
    })
    return card
  }

  // Alpha fund — three verified open positions
  await verifiedCard({ fund: 1, symbol: 'NVDA', entry: 147.63, pct: 10, stop: 120, qty: 313, fillPrice: 147.9, publishedDaysAgo: 40, thesis: 'AI capex supercycle; data-center demand still compounding.', exits: 'Trim above $190; exit on thesis break or stop.' })
  await verifiedCard({ fund: 1, symbol: 'MSFT', entry: 415.95, pct: 8, stop: 370, qty: 259, fillPrice: 416.4, publishedDaysAgo: 25, thesis: 'Copilot attach rate + Azure AI workloads.', exits: 'Reassess at $470; stop at $370.' })
  await verifiedCard({ fund: 1, symbol: 'LLY', entry: 819.0, pct: 5, stop: 700, qty: 47, fillPrice: 820.15, publishedDaysAgo: 12, thesis: 'GLP-1 franchise expansion; supply constraints easing.', exits: 'Hold through next earnings; stop at $700.' })

  // Swing fund — one verified open position
  await verifiedCard({ fund: 3, symbol: 'TSLA', entry: 179.4, pct: 4, stop: 165, qty: 120, fillPrice: 179.55, publishedDaysAgo: 5, thesis: 'Momentum + oversold RSI; days-to-weeks swing.', exits: 'Target $205; stop $165.' })

  // A closed, fully reconciled round trip (entry + exit both verified)
  const closedTrip = async (opts: {
    fund: number; symbol: string; entry: number; exit: number; pct: number; stop: number;
    qty: number; openedDaysAgo: number; closedDaysAgo: number; thesis: string;
  }) => {
    const card = await db.trade_cards.create({
      data: {
        fund_id: opts.fund, instrument_id: ids[opts.symbol], direction: 'long',
        entry_price: opts.entry, position_pct: opts.pct, thesis_md: opts.thesis,
        stop_price: opts.stop, exit_rules_md: 'Published exit rules for the demo trade.',
        status: 'closed', published_at: daysAgo(opts.openedDaysAgo),
      },
    })
    const entryFill = await db.broker_fills.create({
      data: {
        snaptrade_txn_id: `demo-${opts.symbol}-entry-${opts.openedDaysAgo}`,
        instrument_id: ids[opts.symbol], raw_symbol: opts.symbol, side: 'buy',
        quantity: opts.qty, price: opts.entry, fees: 0.1, executed_at: daysAgo(opts.openedDaysAgo), raw: { demo: true },
      },
    })
    await db.reconciliations.create({
      data: { kind: 'entry', status: 'matched', trade_card_id: card.id, broker_fill_id: entryFill.id },
    })
    const closeEvent = await db.trade_card_events.create({
      data: { trade_card_id: card.id, event_type: 'closed', payload: { exit_price: opts.exit, qty_pct: 100 }, created_at: daysAgo(opts.closedDaysAgo) },
    })
    const exitFill = await db.broker_fills.create({
      data: {
        snaptrade_txn_id: `demo-${opts.symbol}-exit-${opts.closedDaysAgo}`,
        instrument_id: ids[opts.symbol], raw_symbol: opts.symbol, side: 'sell',
        quantity: opts.qty, price: opts.exit, fees: 0.15, executed_at: daysAgo(opts.closedDaysAgo), raw: { demo: true },
      },
    })
    await db.reconciliations.create({
      data: { kind: 'exit', status: 'matched', trade_card_event_id: closeEvent.id, broker_fill_id: exitFill.id },
    })
  }

  await closedTrip({ fund: 3, symbol: 'AMD', entry: 148.5, exit: 171.2, pct: 4, stop: 135, qty: 90, openedDaysAgo: 60, closedDaysAgo: 51, thesis: 'MI300 ramp momentum trade.' })
  await closedTrip({ fund: 3, symbol: 'PLTR', entry: 38.1, exit: 35.9, pct: 3, stop: 34, qty: 400, openedDaysAgo: 45, closedDaysAgo: 39, thesis: 'Breakout attempt — invalidated, stopped near entry.' })

  // The trust engine's honesty: a fill nobody published → public omission flag
  const omissionFill = await db.broker_fills.create({
    data: {
      snaptrade_txn_id: 'demo-HOOD-omission', instrument_id: ids.HOOD, raw_symbol: 'HOOD',
      side: 'buy', quantity: 50, price: 93.1, executed_at: daysAgo(3), raw: { demo: true },
    },
  })
  await db.reconciliations.create({
    data: { kind: 'entry', status: 'unmatched_fill', broker_fill_id: omissionFill.id },
  })

  // SIP: this month's DCA fill, verified against the published plan
  const plan = await db.sip_plans.findFirst({ where: { fund_id: 2 }, orderBy: { month: 'desc' } })
  if (plan) {
    const sipFill = await db.broker_fills.create({
      data: {
        snaptrade_txn_id: 'demo-VOO-sip', instrument_id: ids.VOO, raw_symbol: 'VOO',
        side: 'buy', quantity: 3.9, price: 512.3, executed_at: daysAgo(10), raw: { demo: true },
      },
    })
    await db.reconciliations.create({
      data: { kind: 'entry', status: 'matched', sip_plan_id: plan.id, broker_fill_id: sipFill.id },
    })
  }

  // 180 days of NAV per fund + SPY benchmark — the equity-curve chart data
  const navRows: { fund_id: number; date: Date; nav: number; invested: number; cash: number }[] = []
  const benchRows: { symbol: string; date: Date; close: number }[] = []
  const funds = [
    { id: 1, base: 1000000, drift: 0.0012, vol: 0.01 },
    { id: 2, base: 54000, drift: 0.0009, vol: 0.004 },
    { id: 3, base: 150000, drift: 0.0015, vol: 0.016 },
  ]
  for (const f of funds) {
    let nav = f.base
    for (let d = 180; d >= 0; d--) {
      nav = nav * (1 + f.drift + Math.sin((180 - d) * 1.3) * f.vol)
      const invested = Math.round(nav * 0.62)
      navRows.push({ fund_id: f.id, date: dateOnly(d), nav: Math.round(nav), invested, cash: Math.round(nav) - invested })
    }
  }
  let spy = 505
  for (let d = 180; d >= 0; d--) {
    spy = spy * (1 + 0.0006 + Math.sin((180 - d) * 0.9) * 0.005)
    benchRows.push({ symbol: 'SPY', date: dateOnly(d), close: +spy.toFixed(2) })
  }
  await db.fund_nav_daily.createMany({ data: navRows, skipDuplicates: true })
  await db.benchmark_prices.createMany({ data: benchRows, skipDuplicates: true })

  // Drill-down content: ranked news + cached key facts
  await db.news_items.createMany({
    skipDuplicates: true,
    data: [
      { instrument_id: ids.NVDA, external_id: 'demo-news-1', headline: 'NVIDIA Blackwell shipments accelerate; Q3 guidance raised', summary: 'Supply ramp ahead of schedule.', url: 'https://example.com/1', published_at: daysAgo(0), relevance: 'high', relevance_reason: 'Directly affects the largest holding’s revenue trajectory.', ranked_at: new Date() },
      { instrument_id: ids.NVDA, external_id: 'demo-news-2', headline: 'Major cloud provider signs multi-year GPU supply deal', summary: 'Multi-billion commitment.', url: 'https://example.com/2', published_at: daysAgo(1), relevance: 'high', relevance_reason: 'Locks in data-center demand.', ranked_at: new Date() },
      { instrument_id: ids.NVDA, external_id: 'demo-news-3', headline: 'Analysts lift price targets ahead of earnings', summary: 'Consensus moving up.', url: 'https://example.com/3', published_at: daysAgo(2), relevance: 'med', relevance_reason: 'Sentiment, not fundamentals.', ranked_at: new Date() },
      { instrument_id: ids.TSLA, external_id: 'demo-news-4', headline: 'Tesla cuts prices in key markets to defend share', summary: 'Margin pressure continues.', url: 'https://example.com/4', published_at: daysAgo(0), relevance: 'high', relevance_reason: 'Margin impact on an open swing position.', ranked_at: new Date() },
    ],
  })
  for (const [symbol, content] of [
    ['NVDA', '**NVIDIA** designs the GPUs powering the AI buildout. Data-center revenue grew ~150% YoY; gross margins near 75%. Key risk: a handful of hyperscalers drive most sales.'],
    ['TSLA', '**Tesla** makes EVs and energy storage. Deliveries face price competition; energy storage and FSD carry the long-term narrative. High-beta name.'],
  ] as const) {
    await db.ai_key_facts_cache.upsert({
      where: { instrument_id: ids[symbol] },
      create: { instrument_id: ids[symbol], content_md: content, model: 'demo-seed' },
      update: {},
    })
  }

  // One completed sync so the staleness banner has a "last verified at"
  await db.feed_syncs.create({
    data: { trigger: 'on_demand', status: 'ok', finished_at: new Date(), fills_ingested: 9 },
  })
}

if (process.argv[1]?.endsWith('seed.ts')) {
  const db = new PrismaClient()
  seed(db)
    .then(() => console.log('seeded'))
    .finally(() => db.$disconnect())
}
