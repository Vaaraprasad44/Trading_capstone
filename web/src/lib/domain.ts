import { z } from 'zod'
import { db } from './db'

export const FundCode = z.enum(['alpha', 'sip', 'swing'])
export const Ticker = z.string().min(1).max(12).transform((s) => s.toUpperCase())
export const CardId = z.string().uuid()

export function fundByCode(code: string) {
  return db.funds.findUniqueOrThrow({ where: { code: FundCode.parse(code) } })
}

// A card entry is "✓ verified" iff every entry reconciliation matched
// (partial fills produce several rows); no rows yet = pending. Mirrors the
// current_positions view logic (DB-SCHEMA.md §3.4).
export function entryVerification(recs: { kind: string; status: string }[]): 'verified' | 'flagged' | 'pending' {
  const entries = recs.filter((r) => r.kind === 'entry')
  if (entries.length === 0) return 'pending'
  return entries.every((r) => r.status === 'matched') ? 'verified' : 'flagged'
}
