// Eval suite for the key-facts Skill (capstone Bar #5 — ≥3 cases).
// These test the classifier and guardrail contracts that the key-facts route must satisfy.
// The LLM output itself is validated manually / by review — deterministic content is
// tested here, non-deterministic output is checked by the route integration tests.
//
// Run: npx tsx tests/skills/key-facts.eval.ts

import { classify, isRefused } from '../../src/lib/guardrail.js'

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

// ── Case 1: Stock snapshot question passes ──────────────────────────────────
console.log('\nCase 1: "Tell me about NVDA" — should pass guardrail')
{
  const q = "Tell me about NVDA. What does the company do?"
  const type = classify(q)
  assert('not refused', !isRefused(type))
}

// ── Case 2: Allocation/weight question passes ───────────────────────────────
console.log('\nCase 2: "What percent is HOOD in the fund?" — allocation, passes')
{
  const q = "What percent of the fund is HOOD?"
  const type = classify(q)
  assert(`classify → "allocation" (got "${type}")`, type === 'allocation')
  assert('not refused', !isRefused(type))
}

// ── Case 3: Prediction question on stock refused ────────────────────────────
console.log('\nCase 3: "Will NVDA rally next week?" — prediction, refused')
{
  const q = "Will NVDA rally next week? What is the price target?"
  const type = classify(q)
  assert(`classify → "prediction" (got "${type}")`, type === 'prediction')
  assert('isRefused → true', isRefused(type))
}

// ── Case 4: "Why hold" passes as thesis ────────────────────────────────────
console.log('\nCase 4: "Why do you hold TSLA?" — thesis, passes')
{
  const q = "Why do you hold TSLA in the swing fund?"
  const type = classify(q)
  assert(`classify → "thesis" (got "${type}")`, type === 'thesis')
  assert('not refused', !isRefused(type))
}

// ── Case 5: Leverage question on a stock refused ────────────────────────────
console.log('\nCase 5: "Should I buy NVDA calls?" — leverage, refused')
{
  const q = "Should I buy NVDA calls to get leveraged exposure?"
  const type = classify(q)
  assert(`classify → "leverage" (got "${type}")`, type === 'leverage')
  assert('isRefused → true', isRefused(type))
}

// ── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} assertions: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
