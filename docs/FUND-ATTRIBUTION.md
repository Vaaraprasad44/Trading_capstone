# Fund attribution — how a trade gets its fund

**Status**: design note for review, written 2026-08-01 · no code changes yet
**Context**: SnapTrade ingest is live (branch `feature/snaptrade-trust-engine`); fills land in `broker_fills` with **no fund_id, by design**. Question raised: should an AI agent classify each pulled fill into Alpha / SIP / Swing based on ticker, price, and other factors?
**Companion**: [PRD.md](PRD.md) §5 Epics 1–2, 9.2/9.3 · [DB-SCHEMA.md](DB-SCHEMA.md) §5 · [SPIKE-SNAPTRADE.md](SPIKE-SNAPTRADE.md)

## The layering (current, deliberate)

| Layer | Table | Fund? | Who sees it |
|---|---|---|---|
| Raw brokerage record | `broker_fills` | **none** | private audit layer only |
| Trader's public commitment | `trade_cards` | `fund_id`, declared at publish | subscribers, per-fund surfaces |
| The binding | `reconciliations` | inherits via card | verification stamps, omission flags |

One Robinhood account, no sub-accounts → *the card claims the fund; the fill claims nothing; reconciliation binds them.* All subscriber surfaces (`/api/funds/[code]/trades`, `/positions`, dashboard) are card-driven, so fund separation already works.

Note: access is **not** fund-gated — PRD 6.1 is flat all-access, and guardrail 9.2 mandates the same impersonal feed to all subscribers (a load-bearing compliance decision). Members *follow* funds via `alert_preferences` and per-fund views. Fund-tiered membership would be a product change (pricing, Epic 6 access control, re-check of the 9.2 publisher-lane argument) — decide explicitly, don't drift into it.

## Proposal considered: AI decides the fund from the fill

**Rejected.** Four reasons:

1. **Inverts publish-first, verify-after.** Fund assignment on a public, timestamped card *before* the feed corroborates it is the commitment device that makes cherry-picking structurally impossible. Post-hoc classification is retroactive and revisable — the exact failure the product exists to prevent. ("So the AI put your loser in the fund nobody follows?")
2. **Indefensible in the attorney pack.** Per-fund performance claims are held to SEC Marketing Rule standards (PRD 9.3). "Fund membership determined post-hoc by a model" makes the per-fund record unauditable.
3. **Violates the PRD's AI rule.** "LLM explains, never decides; hard rules live in code." A wrong AI fund call on a public verified record is a trust catastrophe, and classifiers are wrong sometimes.
4. **The signal isn't in the fill.** A $500 NVDA buy is indistinguishable between Alpha conviction and a Swing entry; the distinguishing facts (horizon, stop, exits) exist only in the trader's head — which is what the card captures.

## Adopted direction: AI suggests at publish time, trader commits

Keep assignment as the trader's declaration; spend AI on making the declaration near-zero effort:

- The reconciliation worker's stage 1 already detects executed-but-unpublished orders within ~10 min. Extend into the Epic 2 admin page: nudge opens a **prefilled draft card** — ticker, entry price, quantity from the order, plus a *suggested* fund. One tap to confirm keeps the <2-minute publish budget (PRD 2.1).
- Suggestion ladder, deterministic first:
  1. Symbol in this month's published SIP plan → **SIP**
  2. Recurring small fractional buy of an existing SIP holding → **SIP**
  3. Ticker already held by exactly one fund (open card) → **that fund**
  4. Ambiguous rest → LLM suggestion from published patterns (typical Swing entry size, prior cards on the name) — presented as a default, never auto-committed
- Failure mode degrades to "suggestion was wrong, trader tapped a different fund" instead of "the public track record is wrong."

## Related but separate: cash-flow attribution

Dividends, REI (dividend reinvestment), and contributions in `broker_fills` need fund attribution for `fund_cash_flows` / net-of-fees math. These CAN be rule-assigned with no judgment: a dividend belongs to whichever fund's card holds the position; SIP contributions follow the published monthly plan. Deterministic code, no AI.

## Open questions

- Per-fund NAV still can't be direct-ingested (SnapTrade reports whole-account equity only — spike Q5); per-fund NAV needs the attribution rules above plus fund cash ledgers. Founder decision on the split methodology before Epic 1.2's equity curve is real.
- Add the suggest-don't-decide rule to the PRD before the attorney conversation.
- Suggestion engine lands with Epic 2 (admin/publish flow), not in the ingest path.

## Next steps to build the application

What exists after the `feature/snaptrade-trust-engine` branch: live SnapTrade ingest
(`POST /api/feed/sync` with no body pulls real fills), the reconciliation agent
(`npm run worker`), the Portfolio MCP server (`.mcp.json`), webhook receiver, and a
test suite (`npm run test:trust`). The dashboard still runs on mock data.

### Frontend (teammate lane) — in order

1. **Wire the dashboard to the real API (Epic 3, P0).** Replace the hardcoded
   `src/app/dashboard/data.ts` with fetches to the existing endpoints:
   `/api/funds`, `/api/funds/[code]/positions` (rows already include
   `entry_verification`), `/api/funds/[code]/trades`, `/api/funds/[code]/nav`,
   `/api/funds/[code]/sip-plan`. Every position/trade row links to its trade card
   (`/api/trade-cards/[id]`). Keep the per-fund views; data is fund-scoped by the API.
2. **Verification UI (Epic 1).** Surface the stamps the API already returns:
   "✓ verified" / "flagged" / "pending" badges on positions and cards, and the
   staleness banner — `GET /api/feed/syncs`, latest ok sync older than 48h →
   "last verified at T" banner (PRD 1.6). Never silently stale.
3. **Public track-record page (PRD 1.5, P0).** Pre-paywall conversion surface:
   closed-trade history per fund with entries, exits, P&L, verification stamps —
   card-driven, from the same endpoints. No signup required.
4. **Trader admin page (Epic 2.5, P0).** Auth-gated, ugly-is-fine: create/publish
   trade cards (publish gate: stop + exit rules required — the API enforces it,
   surface the 400 nicely), append events (stop moved / partial exit / closed),
   omissions queue from `/api/reconciliations?status=unmatched_fill&unresolved=true`
   with a resolve button. This is where the **prefilled-card nudge** from this doc
   lands: the worker's `agent_runs.summary.stage1.unpublished` lists executed orders
   with no card — render as "publish this" shortcuts with the suggested fund
   (ladder above, deterministic rules first).
5. **Ask AI sheet** stays mocked until the copy-sizing Skill exists (below) — the
   swap point is already marked in `AskAiSheet.tsx`.

### Backend / AI (Vaara's lane)

6. **GitHub secret** (blocker for prod feed): repo Settings → Secrets → Actions →
   `SNAPTRADE_CONSUMER_KEY`. Then merge deploys the feed live.
7. **CAPSTONE-SPEC.md** (Bar #1) — one page, no dependencies.
8. **`copy-sizing` Skill + evals + headless runner (Bar #5)** — formulas already
   seeded in `sizing_methodologies`; transcripts go to `assistant_sessions`/
   `assistant_messages`; then swap into the Ask AI sheet.
9. **Cash-flow attribution rules** (this doc, deterministic) → `fund_cash_flows`,
   which unblocks per-fund NAV and the real equity curve (Epic 1.2).
10. **Register the webhook** in the SnapTrade dashboard pointing at
    `/api/feed/webhook` with `SNAPTRADE_WEBHOOK_SECRET` set, closing spike Q7.
    The worker needs a production home (separate container or in-image process) —
    until then, prod stays fresh via webhook + on-demand sync.

### Sequencing

Steps 1–3 need nothing from the backend lane — start immediately; the API is live
and tested. Step 4's nudge shortcut needs worker runs in the same DB (dev: run
`npm run worker` alongside `npm run dev`). Steps 6–8 are independent of all
frontend work.
