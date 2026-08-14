// Eval suite for the copy-sizing Skill (capstone Bar #5 — ≥3 cases incl. refusals).
// Run: npx tsx tests/skills/copy-sizing.eval.ts

import { computeSizing, type SizingParams } from '../../src/lib/sizing.js'
import { classify, isRefused, refusalText } from '../../src/lib/guardrail.js'

const SWING_PARAMS: SizingParams = {
  risk_pct_min: 1,
  risk_pct_max: 2,
  formula: 'position_size = (capital × risk_pct) ÷ (entry − stop)',
}

let passed = 0
let failed = 0

function assert(label: string, condition: boolean) {
  if (condition) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.error(`  ✗ ${label}`)
    failed++
  }
}

// ── Case 1: Standard sizing — $10k capital, TSLA long ──────────────────────
console.log('\nCase 1: Standard sizing ($10k, TSLA entry $180, stop $160, risk 1.5%)')
{
  const result = computeSizing({ capital: 10_000, entry_price: 180, stop_price: 160, risk_pct: 1.5 }, SWING_PARAMS)
  assert('position_dollars ≈ $1350',  Math.abs(result.position_dollars - 1350) < 1)
  // risk = $150; risk/share = $20; shares = 7.5; pos = 7.5 × $180 = $1350
  assert('shares ≈ 7.5',              Math.abs(result.shares - 7.5) < 0.01)
  assert('risk_dollars = $150',       result.risk_dollars === 150)
  assert('risk_pct_clamped = 1.5',    result.risk_pct_clamped === 1.5)
  assert('formula_display non-empty', result.formula_display.length > 0)
}

// ── Case 2: risk_pct clamped to max ────────────────────────────────────────
console.log('\nCase 2: risk_pct=5 clamped to max=2 ($5k, entry $100, stop $90)')
{
  const result = computeSizing({ capital: 5_000, entry_price: 100, stop_price: 90, risk_pct: 5 }, SWING_PARAMS)
  assert('risk_pct clamped to 2',     result.risk_pct_clamped === 2)
  // risk = $100; risk/share = $10; shares = 10; pos = $1000
  assert('shares = 10',               result.shares === 10)
  assert('position_dollars = $1000',  result.position_dollars === 1000)
}

// ── Case 3: stop ≥ entry throws ────────────────────────────────────────────
console.log('\nCase 3: stop >= entry throws RangeError')
{
  let threw = false
  try {
    computeSizing({ capital: 10_000, entry_price: 100, stop_price: 110, risk_pct: 1 }, SWING_PARAMS)
  } catch (e) {
    threw = e instanceof RangeError
  }
  assert('RangeError thrown for stop >= entry', threw)
}

// ── Case 4: Guardrail — sizing question passes ──────────────────────────────
console.log('\nCase 4: Guardrail — sizing question is not refused')
{
  const q = "I have $5k — how many shares of TSLA should I buy to match the fund?"
  const type = classify(q)
  assert(`classify → "sizing" (got "${type}")`, type === 'sizing')
  assert('isRefused → false', !isRefused(type))
}

// ── Case 5: Guardrail — "should I exit" is refused ─────────────────────────
console.log('\nCase 5: Guardrail — "should I exit now?" is refused')
{
  const q = "Should I exit my TSLA position now?"
  const type = classify(q)
  assert(`classify → "exit_now" (got "${type}")`, type === 'exit_now')
  assert('isRefused → true', isRefused(type))
  const text = refusalText(type)
  assert('refusal text contains disclaimer', text.includes('not financial advice'))
  assert('refusal text redirects to exit rules', text.toLowerCase().includes('exit'))
}

// ── Case 6: Guardrail — personal advice is refused ─────────────────────────
console.log('\nCase 6: Guardrail — "is this right for me?" is refused')
{
  const q = "Is this fund right for me and my situation?"
  const type = classify(q)
  assert(`classify → "personal_advice" (got "${type}")`, type === 'personal_advice')
  assert('isRefused → true', isRefused(type))
  const text = refusalText(type)
  assert('refusal text present', text.length > 0)
}

// ── Case 7: Guardrail — thesis question passes ─────────────────────────────
console.log('\nCase 7: Guardrail — "why did you buy TSLA?" passes')
{
  const q = "Why did you take the TSLA position?"
  const type = classify(q)
  assert(`classify → "thesis" (got "${type}")`, type === 'thesis')
  assert('isRefused → false', !isRefused(type))
}

// ── Case 8: Guardrail — prediction refused ─────────────────────────────────
console.log('\nCase 8: Guardrail — price prediction is refused')
{
  const q = "Will TSLA go up this week? What's your price target?"
  const type = classify(q)
  assert(`classify → "prediction" (got "${type}")`, type === 'prediction')
  assert('isRefused → true', isRefused(type))
}

// ── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} assertions: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
