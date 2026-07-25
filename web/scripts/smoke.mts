// End-to-end smoke: fresh DB → seed → REAL `next dev` server → publish card →
// sync fills → verified stamp + omission flag → close → exit reconciled.
import { spawn, execSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { PrismaClient } from '@prisma/client'
import { seed } from '../prisma/seed.js'

const BASE = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/meridian'
const SMOKE_URL = BASE.replace(/\/[^/]*$/, '/meridian_smoke')
const PORT = 4123

const admin = new PrismaClient({ datasourceUrl: BASE.replace(/\/[^/]*$/, '/postgres') })
await admin.$executeRawUnsafe('DROP DATABASE IF EXISTS meridian_smoke WITH (FORCE)')
await admin.$executeRawUnsafe('CREATE DATABASE meridian_smoke')
await admin.$disconnect()
execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: SMOKE_URL }, stdio: 'pipe' })

const db = new PrismaClient({ datasourceUrl: SMOKE_URL })
await seed(db)
await db.$disconnect()

const server = spawn('npx', ['next', 'dev', '-p', String(PORT)], {
  env: { ...process.env, DATABASE_URL: SMOKE_URL },
  detached: true, // own process group, so we can kill next's children too
  stdio: 'ignore',
})
const kill = () => {
  try {
    process.kill(-server.pid!, 'SIGTERM')
  } catch {}
}
process.on('exit', kill)

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`http://127.0.0.1:${PORT}/api${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { status: res.status, body: (await res.json().catch(() => null)) as any }
}

let up = false
for (let i = 0; i < 120; i++) {
  try {
    if ((await api('GET', '/health')).status === 200) {
      up = true
      break
    }
  } catch {}
  await new Promise((r) => setTimeout(r, 500))
}
assert.ok(up, 'next dev did not come up on :' + PORT)

try {
  assert.equal((await api('GET', '/funds')).body.length, 3)

  // publish gate: no stop/exit → friendly 400, never a published row
  const blocked = await api('POST', '/trade-cards', {
    fund: 'alpha', symbol: 'NVDA', entry_price: 100, position_pct: 10, thesis_md: 'x', publish: true,
  })
  assert.equal(blocked.status, 400, 'publish without stop must 400')

  // legal publish
  const card = await api('POST', '/trade-cards', {
    fund: 'alpha', symbol: 'NVDA', direction: 'long', entry_price: 100, position_pct: 10,
    thesis_md: 'AI capex supercycle', stop_price: 90, exit_rules_md: 'Exit at 130 or stop.', publish: true,
  })
  assert.equal(card.status, 201)
  assert.equal(card.body.status, 'published')

  // sync: matching fill, SIP fill, and an unpublished fill (omission)
  const now = new Date().toISOString()
  const sync = await api('POST', '/feed/sync', {
    fills: [
      { snaptrade_txn_id: 'smoke-nvda', symbol: 'NVDA', side: 'buy', quantity: 100, price: 100.5, executed_at: now },
      { snaptrade_txn_id: 'smoke-voo', symbol: 'VOO', side: 'buy', quantity: 2, price: 500, executed_at: now },
      { snaptrade_txn_id: 'smoke-amd', symbol: 'AMD', side: 'buy', quantity: 50, price: 150, executed_at: now },
    ],
  })
  assert.equal(sync.status, 200)
  assert.equal(sync.body.sync.status, 'ok')
  assert.equal(sync.body.reconciliation.matched, 2, 'NVDA card + VOO sip plan should match')
  assert.equal(sync.body.reconciliation.unmatched_fill, 1, 'AMD fill is an omission')

  // idempotent re-ingest: same txn ids → nothing new
  const resync = await api('POST', '/feed/sync', {
    fills: [{ snaptrade_txn_id: 'smoke-nvda', symbol: 'NVDA', side: 'buy', quantity: 100, price: 100.5, executed_at: now }],
  })
  assert.equal(resync.body.sync.fills_ingested, 0)

  // verified stamp on the open position
  const positions = await api('GET', '/funds/alpha/positions')
  assert.equal(positions.body.length, 1)
  assert.equal(positions.body[0].entry_verification, 'verified')
  assert.equal(positions.body[0].symbol, 'NVDA')

  // omission flag is queryable and resolvable
  const flags = await api('GET', '/reconciliations?status=unmatched_fill&unresolved=true')
  assert.equal(flags.body.length, 1)
  assert.equal(flags.body[0].broker_fills.raw_symbol, 'AMD')
  const resolved = await api('POST', `/reconciliations/${flags.body[0].id}/resolve`)
  assert.ok(resolved.body.resolved_at)

  // close the card, then reconcile the exit fill against the close event
  const closed = await api('POST', `/trade-cards/${card.body.id}/events`, {
    event_type: 'closed', payload: { exit_price: 120, qty_pct: 100 },
  })
  assert.equal(closed.status, 201)
  const exitSync = await api('POST', '/feed/sync', {
    fills: [{ snaptrade_txn_id: 'smoke-nvda-exit', symbol: 'NVDA', side: 'sell', quantity: 100, price: 119.8, executed_at: now }],
  })
  assert.equal(exitSync.body.reconciliation.matched, 1, 'exit fill matches the close event')

  const detail = await api('GET', `/trade-cards/${card.body.id}`)
  assert.equal(detail.body.status, 'closed')
  assert.equal(detail.body.entry_verification, 'verified')
  assert.equal((await api('GET', '/funds/alpha/positions')).body.length, 0, 'closed card leaves positions')

  // SIP plan endpoint serves the seeded month
  assert.equal((await api('GET', '/funds/sip/sip-plan')).status, 200)

  console.log('SMOKE PASSED')
} finally {
  kill()
}
