import { PrismaClient } from '@prisma/client'

export async function seed(db: PrismaClient) {
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
}

if (process.argv[1]?.endsWith('seed.ts')) {
  const db = new PrismaClient()
  seed(db)
    .then(() => console.log('seeded'))
    .finally(() => db.$disconnect())
}
