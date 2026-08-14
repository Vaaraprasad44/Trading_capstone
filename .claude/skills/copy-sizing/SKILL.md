---
name: copy-sizing
description: Compute deterministic position size for a swing trade. Given entry price, stop price, capital, and risk%, returns share count, position dollars, and risk dollars using the Meridian formula. Use this to validate sizing before publishing a trade card or to answer subscriber sizing questions during development.
---

# Copy-sizing Skill

Compute position size using the Meridian deterministic formula:

    shares = (capital × risk_pct / 100) / (entry_price − stop_price)
    position_dollars = shares × entry_price

This formula lives in `web/src/lib/sizing.ts`. The LLM only explains pre-computed
numbers — it never runs the formula itself.

## Inputs

| Field | Required | Notes |
|---|---|---|
| `capital` | yes | Fund NAV or subscriber capital in USD |
| `entry_price` | yes | Planned entry price |
| `stop_price` | yes | Hard stop (must be below entry for a long) |
| `risk_pct` | no | % of capital to risk; clamped to fund bounds if given |
| `fund` | no | `alpha` / `sip` / `swing` — sets clamping bounds |

## Steps

1. Collect any missing required inputs (capital, entry, stop).
2. Load `sizing_methodologies` for the fund from the DB, or use defaults (min 1%, max 2%).
3. Call `computeSizing(inputs, params)` from `web/src/lib/sizing.ts`.
4. Present `formula_display`, `shares` (whole number, rounded down), `position_dollars`, `risk_dollars`.
5. Note if `risk_pct` was clamped and to what value.

## Run the eval suite

```bash
cd web && npx tsx --test tests/skills/copy-sizing.eval.ts
```

All 22 assertions must pass before publishing a card with sizing data.

## Guardrails

- `stop_price >= entry_price` → `RangeError` — surface the error, do not proceed.
- "What should my stop be?" is a prediction request — refuse.
- "Should I buy / sell?" is personal advice — refuse.
- Never make a sizing recommendation that bypasses the formula.
