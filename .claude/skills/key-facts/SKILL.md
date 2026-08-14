---
name: key-facts
description: Return AI-curated key facts about a ticker from the DB cache, or generate them fresh using the Anthropic SDK. Use this to populate ai_key_facts_cache for open holdings, or to answer subscriber questions about a position. The worker calls this headlessly every cycle; Claude Code calls it interactively during development.
---

# Key-facts Skill

Retrieve or generate 3–5 concise bullet points about a ticker relevant to a swing trader:

- Sector / industry context
- Most recent catalyst or price driver
- Key technical level (support or resistance)
- One forward-looking risk or opportunity

Facts are cached in `ai_key_facts_cache` (keyed by `instrument_id`, refreshed every 24 h).
The API serves them at `GET /api/instruments/[symbol]/key-facts`.
The background worker (`web/scripts/worker.mts`) refreshes them headlessly each cycle.

## Steps

1. Look up the instrument: `db.instruments.findUnique({ where: { symbol } })`.
   Return 404 if not found — do not invent facts for unknown tickers.
2. Check the cache: `db.ai_key_facts_cache.findUnique({ where: { instrument_id } })`.
3. If cache is fresh (< 24 h old), return `content_md` directly — no LLM call.
4. If stale or absent, call the Anthropic SDK:
   - Model: `claude-haiku-4-5-20251001`
   - `max_tokens`: 256
   - System prompt: "You are a stock research assistant for a swing trading fund.
     Write 3–5 bullet points about the given ticker covering: sector/industry
     context, most recent catalyst or price driver, a key technical level
     (support or resistance), and one forward-looking risk or opportunity.
     Plain text only. Each bullet starts with •. Keep the total response
     under 200 words."
   - User message: `"Ticker: ${symbol}. Today: ${date}."`
5. Upsert result to `ai_key_facts_cache` with `model` and `generated_at = now()`.

## Run the eval suite

```bash
cd web && npx tsx --test tests/skills/key-facts.eval.ts
```

All 9 assertions must pass.

## Guardrails

- Never generate price targets or buy/sell recommendations.
- Refuse questions asking for personal advice or leverage strategies.
- If `instruments` table has no row for the symbol, return a 404 — do not hallucinate context.
- If `ANTHROPIC_API_KEY` is absent, return the cached value (even if stale) and log a warning.
