// Self-check for the SnapTrade → broker_fills mapping (run: npx tsx scripts/test-feed-map.mts)
import assert from 'node:assert/strict'
import { mapActivity } from '../src/lib/feed.js'
import type { SnapActivity } from '../src/lib/snaptrade.js'

// fixture values are fictional — never paste real account data into tests
const base = {
  symbol: { symbol: 'TEST', raw_symbol: 'test', description: 'Test Corp' },
  description: '',
  amount: 61.73,
  price: 123.45,
  units: -0.5,
  fee: 0,
  trade_date: '2026-03-05T15:30:00Z',
  settlement_date: '2026-03-06T00:00:00Z',
  institution: 'Robinhood',
}

const sell = mapActivity({ ...base, id: '1', type: 'SELL' } as SnapActivity)!
assert.equal(sell.activity_type, 'trade')
assert.equal(sell.side, 'sell')
assert.equal(sell.quantity, 0.5) // units come signed; we store magnitude + side
assert.equal(sell.symbol, 'TEST') // raw_symbol uppercased

// REI is a broker-initiated buy — must NOT be a trade or omission detection fires
const rei = mapActivity({ ...base, id: '2', type: 'REI', units: 0.01 } as SnapActivity)!
assert.equal(rei.activity_type, 'other')
assert.equal(rei.side, undefined)

// cash movements carry no symbol
const dep = mapActivity({ ...base, id: '3', type: 'CONTRIBUTION', symbol: null, units: null } as SnapActivity)!
assert.equal(dep.activity_type, 'transfer')
assert.equal(dep.symbol, undefined)

// date-only stamps (historical backfill) still ingest; both dates missing → skip
assert.ok(mapActivity({ ...base, id: '4', type: 'BUY', trade_date: '2024-03-01T00:00:00Z' } as SnapActivity))
assert.equal(mapActivity({ ...base, id: '5', type: 'BUY', trade_date: null, settlement_date: null } as SnapActivity), null)

// unknown future types never crash ingest
assert.equal(mapActivity({ ...base, id: '6', type: 'OPTIONEXPIRATION' } as SnapActivity)!.activity_type, 'other')

console.log('feed-map self-check passed')
