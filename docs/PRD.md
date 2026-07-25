# Product Requirements Document: Meridian Capital v1

**Author**: Vaaraprasad
**Date**: 2026-07-07
**Status**: Draft
**Companion docs**: [PRODUCT-BRIEF.md](PRODUCT-BRIEF.md) · [PERSONAS.md](PERSONAS.md) · [../web/src/html/dashboard.html](../web/src/html/dashboard.html) (interactive mock, served at `/dashboard`)

---

## 1. Executive Summary

Meridian Capital v1 is a $10.99/mo trade-signal subscription where one credible trader publishes a **provably live, brokerage-verified track record** across three risk-based funds (Alpha, Smart SIP, Swing), and every subscriber gets an **AI copy-sizing assistant** that translates the trader's moves into general, self-serve sizing math for their own capital and risk band. It replaces screenshot-based signal channels with proof, and replaces noisy chat with a personal calculator that teaches. v1 stays strictly in the **publisher/newsletter lane** — impersonal, same feed to all, no personalized advice — and doubles as the capstone submission (bars mapped in §9).

## 2. Background & Context

Retail investors who follow traders online cannot verify track records (screenshots, cherry-picked wins) and cannot translate a trader's position into a sane size for their own account — sizing errors, not bad picks, are what blow up small accounts (see PERSONAS.md, Marcus). The founder has a ~1,000-person reachable audience and trades manually on **Robinhood**. v1 is validation-stage: the goal is proof of edge, retention through a drawdown, and a verified public record that compounds trust — not income.

Key structural decisions already made:

- **Verification model — publish first, verify after.** The trader trades manually in the Robinhood app, immediately publishes a trade card (thesis + entry + required exit rules), and a background agent reconciles the card against a **SnapTrade read-only feed** within 24h. Unpublished fills are flagged — cherry-picking is structurally impossible. No unofficial Robinhood APIs (ToS risk; feed outage = trust catastrophe).
- **Sizing stays general.** The copy-sizing assistant is a self-serve calculator: deterministic, published formulas in code; session-only user inputs (no stored risk profile in v1); the LLM explains, never recommends.
- **Regulatory posture.** v1 leans on the publisher exclusion. A securities attorney must confirm the design pre-launch (hard gate). All assistant transcripts are logged as the attorney's evidence pack.

## 3. Objectives & Success Metrics

**Goals**
1. Publish a live, independently verifiable track record for 3 funds with 100% of trades reconciled against the brokerage feed.
2. Convert ≥3% of the reachable audience to paid and retain them past month 3.
3. Make the copy-sizing assistant the habit: used by a majority of active subscribers.
4. Survive the first drawdown month with proactive communication, not silence.
5. Satisfy all capstone bars (§9).

**Non-Goals (v1)**
1. ❌ Managed accounts / trading on users' behalf — v2, RIA-gated.
2. ❌ Auto-execution or brokerage integration for copying — subscribers re-enter trades manually.
3. ❌ Personalized advice of any kind — keeps v1 in the publisher lane.
4. ❌ HNI tiers, TradingView-depth data, day-trade/scalp latency.
5. ❌ Stored user risk profiles — session-only inputs until attorney guidance says otherwise.

**Success Metrics**

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Paying subscribers retained > 3 months (north star) | 0 | 30–50 subs, >60% past month 3 | Stripe cohort data |
| Audience → paid conversion | — | ≥ 3% | signups ÷ reachable audience |
| Track record verified & live | No | 100% of trades reconciled ≤ 24h | reconciliation agent logs |
| Copy-sizing usage | — | ≥ 50% of active subs use it ≥ 1×/month | assistant transcript logs |
| Churn through a drawdown month | — | ≤ 1.5× baseline churn | Stripe churn by cohort month |

## 4. Target Users & Segments

Three risk personas, one trader (full detail in [PERSONAS.md](PERSONAS.md)):

| Persona | Fund | Converts on | Churns on | Killer feature |
|---|---|---|---|---|
| **Rajesh, the Compounder** ($50K–500K) | Alpha | Auditable live record | Boredom between trades | Allocation math for a satellite slice |
| **Priya, the Disciplined Saver** ($200–600/mo) | Smart SIP | A plan for small money | Product silence in drawdowns | Monthly plan + evidence-backed encouragement |
| **Marcus, the Quick-Return Seeker** ($500–5K) | Swing | Verified record + published exits | Losing streak | Sizing guardrails + stops up front |

Anti-personas (explicitly not served): HNI delegators, auto-copiers, day-traders/scalpers, advice-seekers.

## 5. Epics & Features

Priorities: **P0** = v1 launch-blocking · **P1** = v1 if time permits, else v1.x · **P2** = v1.x/v2.

### Epic 1 — Verified Track Record (the trust engine)

| # | Feature / User Story | Priority | Acceptance Criteria |
|---|---------------------|----------|---------------------|
| 1.1 | SnapTrade read-only connection to the trader's Robinhood account | P0 | Positions, balances, and fills sync; on-demand refresh available; zero write scopes |
| 1.2 | As Rajesh, I can see live fund performance vs. S&P 500 (net of fees, no cherry-picking) so I can audit before I pay | P0 | Equity curve + benchmark per fund; updates ≤ 24h; methodology note published |
| 1.3 | Reconciliation agent: every published trade card is matched to a brokerage fill within 24h and stamped "✓ verified" with broker-reported price | P0 | Match → public stamp; mismatch → flagged to trader; runs on schedule + on feed events |
| 1.4 | Omission detection: fills with no published trade card are flagged | P0 | Alert to trader within 24h; unresolved omissions surface on the public record |
| 1.5 | Public track-record page (open, pre-paywall) as the conversion surface | P0 | Closed-trade history with entries, exits, P&L per fund; no signup required |
| 1.6 | Feed-outage state: record shows "last verified at T" honestly | P1 | Staleness > 48h displays a visible banner, never silently stale |

### Epic 2 — Trade Cards & Operator Publishing (the trader's side)

| # | Feature / User Story | Priority | Acceptance Criteria |
|---|---------------------|----------|---------------------|
| 2.1 | As the trader, I can publish a trade card in < 2 minutes after a manual fill | P0 | Fields: fund, ticker, direction, entry, position % of fund, thesis, stop, exit rules |
| 2.2 | **Publishing is blocked without exit rules + stop** | P0 | Card cannot be saved as published with empty exit/stop fields — no exceptions |
| 2.3 | Trade updates (stop moved, partial exit, closed) append to the card's timeline | P0 | Original card immutable; updates timestamped; closes reconciled like entries |
| 2.4 | Drawdown-comms flow: AI drafts a calm "what we're doing and why" note from fund data; trader approves and sends | P1 | Draft generated on fund drawdown threshold; requires explicit trader approval; sent to all subs |
| 2.5 | Minimal internal admin page (not public-grade UI) | P0 | Auth-gated; covers 2.1–2.4; ugly is fine, slow is not |

### Epic 3 — Multi-Fund Dashboard (subscriber home)

| # | Feature / User Story | Priority | Acceptance Criteria |
|---|---------------------|----------|---------------------|
| 3.1 | Three-fund overview: equity curve, performance vs S&P, allocation, cash & returns | P0 | Matches mock (dashboard.html); per-fund and combined views |
| 3.2 | Open positions and closed trades tables per fund | P0 | Every row links to its trade card (thesis, exits, verification stamp) |
| 3.3 | Recent buy/sell feed, newest first | P0 | Trade cards appear ≤ 1 min after trader publishes |
| 3.4 | As Priya, I see this month's Smart SIP plan on the fund page | P1 | Monthly contribution breakdown with rationale, published on a fixed monthly date |

### Epic 4 — Stock Drill-Down (AI-assisted context)

| # | Feature / User Story | Priority | Acceptance Criteria |
|---|---------------------|----------|---------------------|
| 4.1 | Per-stock page: price chart, fundamentals, trader's position + trade history | P0 | Data via market-data MCP; links back to trade cards |
| 4.2 | AI **key-facts** summary (plain-English company snapshot) | P0 | Generated by `key-facts` Skill; cached; regenerates on material news |
| 4.3 | AI-ranked "why did it move" news | P1 | `relevance-filter` Skill ranks news MCP results; top 3 with one-line relevance reasons |
| 4.4 | Financial-strength check (plain-English balance-sheet read) | P2 | v1.x per brief roadmap |

### Epic 5 — AI Copy-Sizing Assistant (the wedge)

| # | Feature / User Story | Priority | Acceptance Criteria |
|---|---------------------|----------|---------------------|
| 5.1 | As Marcus, I enter my account size and risk band for a published trade and get the sized math with the reasoning explained | P0 | Deterministic formula in code (`copy-sizing` Skill); inputs are session-only; output shows formula, inputs, result, and the trader's published rules |
| 5.2 | Published sizing methodology per fund (the formulas themselves are public content) | P0 | E.g. "Swing: risk 1–2% per trade; position = risk $ ÷ (entry − stop)"; assistant only applies published formulas |
| 5.3 | **Guardrails — hard refusal list** | P0 | Refuses + redirects on: buy/sell/exit-now questions; "is this right for me"; user's other holdings/goals/taxes/debts; leverage/options/margin; predictions. Redirect = published rules + general math + disclaimer |
| 5.4 | Every response carries the "not financial advice" disclaimer | P0 | Non-removable; present in 100% of responses |
| 5.5 | Full transcript logging, tagged by question type | P0 | Queryable log; exportable as the attorney's evidence pack |
| 5.6 | Guardrail eval suite (adversarial, Marcus-style prompts) | P0 | ≥ 3 eval cases per Skill incl. refusal cases; runs in CI; capstone Bar #5 |

### Epic 6 — Subscription & Auth

| # | Feature / User Story | Priority | Acceptance Criteria |
|---|---------------------|----------|---------------------|
| 6.1 | Stripe subscription, $10.99/mo flat, all-access | P0 | Subscribe, cancel, card update self-serve; webhook-driven access control |
| 6.2 | Auth + paywall: track record public, trade feed/assistant/drill-downs paid | P0 | Email or OAuth login; paywall enforced server-side |
| 6.3 | Mandatory disclosure acknowledgment at signup | P0 | "Not financial advice / past performance ≠ future results" accepted before first payment |

### Epic 7 — Alerts & Background Agents

| # | Feature / User Story | Priority | Acceptance Criteria |
|---|---------------------|----------|---------------------|
| 7.1 | Trade-event alerts: push/email within 1 min of a published card or update | P0 | Per-fund opt-in; includes entry, stop, exits — never "act now" language |
| 7.2 | Reconciliation agent (see 1.3/1.4) re-plans on source events | P0 | Triggers on schedule, on-demand refresh, and feed webhooks; capstone Bar #2 |
| 7.3 | News-event alerts for held tickers (relevance-filtered) | P1 | Only news passing the `relevance-filter` Skill threshold; max 1/ticker/day |
| 7.4 | Agent re-planning on manual feedback (trader marks alert wrong → thresholds adjust) | P1 | Feedback loop demonstrable; capstone Bar #2 |

### Epic 8 — Statements & Digests (multi-modal outputs)

| # | Feature / User Story | Priority | Acceptance Criteria |
|---|---------------------|----------|---------------------|
| 8.1 | Monthly PDF fund statement (performance, trades, verification summary) | P0 | Auto-generated per fund; downloadable + emailed; capstone Bar #4 |
| 8.2 | Weekly email digest (trades, record update, one educational note) | P1 | Opt-in; assembled from published content only |
| 8.3 | Audio digest | P2 | v1.x |

### Epic 9 — Compliance & Publisher-Lane Guardrails (cross-cutting)

| # | Feature / User Story | Priority | Acceptance Criteria |
|---|---------------------|----------|---------------------|
| 9.1 | Disclaimers on every surface (dashboard, cards, assistant, alerts, PDFs, emails) | P0 | Copy reviewed by attorney; consistent everywhere |
| 9.2 | Same impersonal feed to all subscribers — no per-user content variation | P0 | Architecture forbids per-user feed customization; only the self-serve calculator varies by user input |
| 9.3 | Performance-claim standards: net-of-fees, no cherry-picking, SEC Marketing Rule as the bar | P0 | Methodology page published; reconciliation agent enforces completeness |
| 9.4 | **Attorney sign-off package**: assistant transcripts, guardrail evals, disclosure copy, product walkthrough | P0 | Assembled before launch; sign-off is a hard launch gate |

## 6. Solution Overview

- **Flow:** trader fills manually on Robinhood → publishes trade card (exits required) → subscribers alerted ≤ 1 min → subscriber sizes it via the assistant with their own inputs → reconciliation agent verifies the card against the SnapTrade feed ≤ 24h → public "✓ verified" stamp. Subscribers re-enter trades manually in their own brokerages; the swing horizon (days-to-weeks) tolerates that latency.
- **Data:** three MCP sources — market-data MCP, news MCP, and a **custom Portfolio MCP server** wrapping SnapTrade (authored interactively in Claude Code; capstone Bar #3).
- **AI:** three named Skills — `copy-sizing` (deterministic formulas + LLM explanation), `key-facts`, `relevance-filter` — each with prompt + ≥ 3 eval cases; at least one invoked from both Claude Code (dev) and a headless Agent SDK runner (prod; capstone Bar #5). LLM never does arithmetic; formulas live in code.
- **Stack default (unblocked, swappable):** single Next.js app (UI + API route handlers, TypeScript) + Postgres (Prisma ORM) + Stripe; the Agent SDK runner and background agents join as a Node worker process when built (decided 2026-07-25).

## 7. Open Questions

| Question | Owner | Deadline |
|----------|-------|----------|
| Capstone bars #6/#7 (likely deploy + observability) — exact requirements | Founder | Before CAPSTONE-SPEC.md is finalized |
| Securities attorney: does the v1 design (esp. the calculator framing + session-only inputs) stay in the publisher lane? | Founder + attorney | **Hard gate before launch** |
| SnapTrade↔Robinhood connection reliability & sync cadence in practice | Eng (spike, week 1) | Before Epic 1 build |
| Market-data & news MCP provider selection (defaults: Polygon/Alpha Vantage; NewsAPI) | Eng | Epic 4 start |
| Drawdown threshold that triggers the comms flow (2.4) | Founder | Epic 2 build |

## 8. Timeline & Phasing

| Milestone | Scope | Exit criteria |
|---|---|---|
| **M1 — Foundations** | One-page capstone spec (Bar #1); SnapTrade spike; custom Portfolio MCP + market-data/news MCPs (Bar #3); Stripe + auth skeleton | Feed syncing real Robinhood data; MCPs queryable |
| **M2 — Trust engine** | Epics 1–2: trade cards, publish-first flow, reconciliation agent (Bar #2), public track-record page | A real trade published, alerted, and auto-verified end-to-end |
| **M3 — Product surface** | Epics 3–5: dashboard, drill-downs, copy-sizing assistant + guardrails + eval suite (Bar #5) | Guardrail evals green in CI; assistant usable by beta subs |
| **M4 — Launch package** | Epics 7–9: alerts, PDF statement (Bar #4), disclosures, attorney evidence pack; private beta from the ~1,000 audience | Attorney sign-off obtained → public launch |

Dependency chain: M1 → M2 → M3/M4 can overlap. The attorney review starts at M3 (needs real transcripts) so sign-off doesn't serialize behind M4.

---
*Sources: PRODUCT-BRIEF.md (founder Q&A), PERSONAS.md, capstone bars provided by founder 2026-07-07, dashboard.html mock.*
