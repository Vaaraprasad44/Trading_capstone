# Spike — SnapTrade ↔ Robinhood feed validation

**Status**: paper check done (2026-07-25) · live test **run 2026-08-01** against a real Robinhood connection (personal-flow key) — most questions answered, see §7; still pending: week-long stability (Q1), market-hours detection latency (Q4), webhooks (Q7)
**Owner**: Eng (setup + analysis) · Trader (connection + test trades)
**Companion to**: [PRD.md](PRD.md) §7 open questions, M1 milestone · [DB-SCHEMA.md](DB-SCHEMA.md) §5 open questions
**Timebox**: ~1 hour setup, 1 week of observation, half a day of analysis.

---

## 1. Why this spike exists

Every trust-engine design decision (PRD Epic 1 — the product's differentiator) rests on assumptions about SnapTrade's Robinhood data that nobody has seen live. The spike is deliberately throwaway code with a non-throwaway output: answers. Its second life: the spike script is the seed of the **custom Portfolio MCP server** (capstone Bar #3).

## 2. Questions it must answer

| # | Question | Decides |
|---|---|---|
| Q1 | Does the Robinhood connection work read-only, and does it survive a week without re-auth? | Go/no-go on SnapTrade; frequency of the staleness banner (PRD 1.6); whether the trader has a recurring chore |
| Q2 | Does `/activities` actually populate for Robinhood? (Aggregator support varies per brokerage per endpoint) | Whole reconciliation design |
| Q3 | What does a fill payload contain — and at what **timestamp granularity**? | `broker_fills` columns; same-day disambiguation in reconciliation matching |
| Q4 | Detection latency: minutes-to-visibility in the **recent-orders** lane; hours/days in the **transactions** lane; effect of on-demand refresh | The ≤24h verification SLA (PRD 1.3); two-stage verification design |
| Q5 | Is total account **equity** reported directly, with usable balances? | The NAV question (DB-SCHEMA §5): ingest `fund_nav_daily` vs. compute from fills + cash + EOD prices |
| Q6 | Do non-trade activities (dividends, deposits/withdrawals, fees) come through typed? | `activity_type`, `fund_cash_flows`, net-of-fees performance claims (PRD 9.3) |
| Q7 | Poll vs push in practice: which webhooks fire, how timely; cost of the Trade Detection add-on vs 10-min polling | `agent_runs.trigger` mix; reconciliation agent architecture; plan tier |

## 3. Paper-check findings (done 2026-07-25)

Verified against SnapTrade's docs; live test must confirm the Robinhood-specific parts.

**Confirmed on paper ✓**
- Robinhood is a supported integration, **read-only** ("does not offer the ability to place trades"), OAuth-based, no credential sharing — matches PRD 1.1 zero-write-scopes.
- Activities payload documents everything `broker_fills` needs: `type` (BUY / SELL / DIVIDEND / CONTRIBUTION / WITHDRAWAL / INTEREST / FEE / TRANSFER / option events), `trade_date` (ISO datetime — but "granularity depends on the brokerage" → Q3), `settlement_date`, `units`, `price`, `fee`, signed `amount`, unique `id` (idempotent ingest), `external_reference_id`.
- **Two data lanes with different freshness:**
  - *Recent orders* (intraday): dedicated endpoint; recommended polling floor **once per 10 min per account**; paid **"Trade Detection Subscriptions"** add-on pushes events instead.
  - *Transactions* (formal records): "cached, updated once per day with the daily sync, and delayed by one day. **Intraday transactions are not available**" — on every plan.
- Webhooks exist: `ACCOUNT_TRANSACTIONS_UPDATED`, `ACCOUNT_HOLDINGS_UPDATED` (daily, post-sync), connection events → reconciliation agent can be `source_event`-triggered.
- On-demand refresh endpoint: async, completion signaled by webhook, per-call charges may apply.
- **Personal flow** exists (individual connects own account, Personal API key, no user registration) — ideal for this spike.

**Sources**: [activities reference](https://docs.snaptrade.com/reference/Transactions%20And%20Reporting/TransactionsAndReporting_getActivities) · [syncing & freshness](https://docs.snaptrade.com/docs/syncing) · [realtime-data best practices](https://docs.snaptrade.com/docs/realtime-data) · [webhooks](https://docs.snaptrade.com/docs/webhooks) · [refresh endpoint](https://docs.snaptrade.com/reference/Connections/Connections_refreshBrokerageAuthorization) · [Robinhood integration page](https://snaptrade.com/brokerage-integrations/robinhood-api) · [getting started](https://docs.snaptrade.com/docs/getting-started)

**Design implication already adopted (pending live confirmation)** — *two-stage verification*:
1. Same-day: recent-orders lane (≤ ~10 min, or push with add-on) → "order corroborated ✓" + **detection nudge** (order seen with no published card within 15 min → ping trader).
2. Next-day: transactions lane → formal "✓ verified" stamp with broker-reported fill.
The announcement path is unaffected: publish-first stays (a raw order has no thesis/stop/exits); the feed is auditor + nudge, never the broadcast.

## 4. Trader test package

Sent to the trader 2026-08-01. Full text in [§8](#8-appendix--trader-handoff-text). Summary: create SnapTrade personal account + API key → connect Robinhood read-only (note the flow: OAuth vs credentials, MFA, permissions) → screenshot positions/cash/equity for ground truth → run `snaplog.py` (10-min polling of orders/positions/balances/activities to JSONL) → six scripted test trades (market buy; partial sell; limit order noting placed vs filled; same-ticker same-day pair; small deposit/withdrawal; note any dividend) with an exact written log (time-to-the-minute + TZ, ticker, side, qty, fill price, fee) → one week of passive notes on re-auth/security emails.

**Returns**: `snaplog.jsonl`, filled trade log, screenshots + connection notes, security notes. **Never** the API keys (deleted after the test).

## 5. Analysis plan (when results land)

Compare the trader's written log against `snaplog.jsonl` timestamps:

1. For each test trade: first appearance in recent-orders lane (minutes) and transactions lane (hours) → Q4 latency table.
2. Field-by-field diff of one fill payload against `broker_fills` DDL → Q2/Q3; note timestamp granularity from the same-day pair.
3. Balances snapshots vs screenshots → Q5 (equity direct or computed).
4. Deposit + dividend rows → Q6 typing check.
5. Week-long gap scan of the JSONL for connection errors/re-auth events → Q1.
6. Fill in §7 findings, then propagate: DB-SCHEMA §5 answers, PRD 1.3 SLA wording (24h vs 48h vs two-stage), MCP-AGENTS spec (trigger mix, plan tier).

## 6. Go / no-go criteria

**Go** (build Epic 1 on SnapTrade): connection survives the week; `/activities` populates with usable fields; transactions ≤ 48h; recent-orders lane works for Robinhood.

**Escalate / fall back**, in order:
1. Recent-orders lane weak → price **Trade Detection Subscriptions** add-on; two-stage verification still works with a slower stage 1 (holdings refresh diff).
2. Transactions > 48h or fields unusable → try **Plaid Investments** (same read-only architecture, swap the adapter).
3. Robinhood connection fundamentally flaky on aggregators → **manual-entry fallback** (founder's proposal, 2026-07-25): trader-entered trades on timestamped, append-only, immutable cards; market-data pricing computes P&L; verifiability = public unforgeable commitment ("can't backdate wins"). Honest trust downgrade, stated openly: **no omission detection** — the claim weakens from "this is my whole account" to "every published call tracked honestly." Schema impact: `broker_fills`/`reconciliations` idle; cards + `benchmark_prices` carry the record.
4. Fallback 3 unacceptable for trust positioning → founder decision: migrate trading to an API-first broker (Alpaca / IBKR — true real-time fills, official APIs) at the cost of leaving Robinhood. Recorded as a v2 lever, not a v1 requirement.

## 7. Findings (live test 2026-08-01, personal-flow key against a real Robinhood connection; market closed — Saturday)

- **Q1 connection**: ✅ partial. Read-only Robinhood connection established via dashboard 2026-08-01 16:00Z; initial holdings sync completed within ~5 s of connection. One Robinhood login yields **two accounts under one `brokerage_authorization`** (Individual + Crypto). Week-long re-auth stability still _pending_ (needs the week).
- **Q2 activities for Robinhood**: ✅ yes, richly — with one correction: the **global `/activities` endpoint is dead** (410 "no longer available for your account"); use per-account **`GET /accounts/{id}/activities`** (returns `{data: [...]}`, paginated). Robinhood Individual returned **years of history in one call** — hundreds of activities with BUY / SELL / DIVIDEND / REI / CONTRIBUTION all represented. ⚠️ **Robinhood Crypto returned 0 activities** — crypto transactions don't populate; fine for our equities-only funds, but don't plan on crypto data.
- **Q3 payload fields & timestamp granularity**: ✅ everything `broker_fills` needs: unique `id`, signed `units`, `price`, `fee`, `amount`, `settlement_date`, `institution`, rich symbol object (FIGI, exchange). `trade_date` carries **second-level granularity on recent rows** (roughly a third of rows intraday-stamped) but **midnight-only on older history** — reconciliation matching must tolerate date-only stamps on backfill. `external_reference_id` is `null` on Robinhood. **New activity type not in the paper check: `REI` (dividend reinvestment)** — `activity_type` handling must map it (it's a buy that must not look like an unpublished trade).
- **Q4 latency (orders lane / transactions lane / refresh effect)**: partial — market closed, so detection latency is _pending the next trading day_. But the recent-orders lane is confirmed **richer than hoped**: full lifecycle per order — `time_placed` / `time_updated` / `time_executed` (sub-second), `status` (`EXECUTED`, and `NONE` for a pending after-hours order), `limit_price`, **`execution_price`** — so stage-1 corroboration can price-check immediately, and placed-vs-filled is cleanly distinguishable (observed: an after-hours order carried a placed timestamp that evening and an executed timestamp at next market open). Transactions lane confirmed daily (`last_successful_sync` is date-only, `2026-07-31`). On-demand refresh not exercised (per-call charges).
- **Q5 equity & balances**: ✅ **equity is reported directly** — `accounts[].balance.total` (dollar amount verified live against the Robinhood app) plus per-account `cash` and `buying_power` from `/balances`. → `fund_nav_daily` can be **ingested, not computed**. The one-account→three-funds split stays a publish-time tagging concern exactly as DB-SCHEMA §5 assumed (SnapTrade has no sub-accounts; fills carry no fund).
- **Q6 non-trade activity typing**: ✅ typed in real data: `DIVIDEND`, `CONTRIBUTION`, `REI`. `FEE`/`WITHDRAWAL` absent from this account's history (documented on paper, untested live).
- **Q7 webhooks & add-on pricing**: _pending_ — needs a public webhook receiver; do this when the reconciliation worker skeleton exists. Observed rate limit: **250 req/min**; 10-min polling floor per docs.
- **Auth findings (new, unasked)**: personal-flow (`PERS-`) keys use the same HMAC request signing as partner keys, and **`userSecret` is not required** (empty string accepted) — one fewer secret for the MCP server to hold. ⚠️ The pypi `snaptrade-python-sdk` **mis-signs requests** (403 "credentials not provided") — the Portfolio MCP should sign manually (~15 lines, see spike's `snap.py`) rather than depend on the SDK.
- **Deprecation velocity (update 2026-08-13, second live test on a newly registered account)**: SnapTrade retires endpoints per-account-generation — `GET /accounts/{id}/positions` and `/holdings` return **410 on new accounts** while older accounts keep them. Replacement: **`GET /accounts/{id}/positions/all`** (`{results: […]}`; numerics as strings; `cost_basis` is the lot TOTAL, not per-share; no precomputed P&L). Treat any SnapTrade 410 as "find the successor endpoint," and re-verify the endpoint set whenever the account changes.
- **Verdict & design changes**: **GO** (provisional on Q1's quiet week + Q4's market-hours number). Build Epic 1 on SnapTrade. Changes: (1) ingest via per-account activities, not the dead global endpoint; (2) two-stage verification stands, and stage 1 gains a price check via `execution_price`; (3) map `REI` explicitly so dividend reinvestments don't trip omission detection; (4) matching tolerates date-only `trade_date` on historical backfill; (5) skip the SDK, sign manually.

## 8. Appendix — trader handoff text

The exact package sent to the trader (kept verbatim so findings can be traced to instructions):

> **What this is:** We're testing whether SnapTrade can reliably *read* your Robinhood account (trades, positions, balances). Read-only — it cannot place trades or move money. You'll set up a free account, connect Robinhood, run a small logging script, make a few tiny trades, and keep notes.
>
> **Step 1 — SnapTrade account (10 min).** Sign up at https://dashboard.snaptrade.com (free). Enable two-factor auth. Generate a **Personal API key** → save the `clientId` and `consumerKey` somewhere private. Never put these in email/Slack or commit them anywhere.
>
> **Step 2 — Connect Robinhood (5 min).** In the dashboard, connect your Robinhood account — choose **read** if asked for a connection type. Note: did you log in on a Robinhood page (OAuth) or type your Robinhood password into SnapTrade's page? Was MFA required? How long did it take? Anything surprising in the permissions screen? Immediately after, screenshot in Robinhood: **positions list, cash balance, total account value**.
>
> **Step 3 — Run the logger (10 min).** Python 3.10+: `pip install snaptrade-python-sdk`, save the script below as `snaplog.py`, fill in your two keys, leave it running during market hours (laptop must stay awake).
>
> ```python
> # Polls SnapTrade every 10 minutes and appends raw JSON to snaplog.jsonl.
> # Method names per docs.snaptrade.com/docs/getting-started — if one errors,
> # check that page; the SDK occasionally renames.
> import json, time
> from datetime import datetime, timezone
> from snaptrade_client import SnapTrade
>
> client = SnapTrade(client_id="YOUR_CLIENT_ID", consumer_key="YOUR_CONSUMER_KEY")
>
> def grab(label, fn):
>     try:
>         return {label: fn().body}
>     except Exception as e:
>         return {label: f"ERROR: {e}"}
>
> while True:
>     ts = datetime.now(timezone.utc).isoformat()
>     entry = {"ts": ts}
>     entry.update(grab("accounts", lambda: client.account_information.list_user_accounts()))
>     accounts = entry.get("accounts") or []
>     for a in (accounts if isinstance(accounts, list) else []):
>         aid = a["id"]
>         entry.update(grab(f"orders_{aid}",    lambda: client.account_information.get_user_account_orders(account_id=aid)))
>         entry.update(grab(f"positions_{aid}", lambda: client.account_information.get_all_account_positions(account_id=aid)))
>         entry.update(grab(f"balances_{aid}",  lambda: client.account_information.get_user_account_balance(account_id=aid)))
>     entry.update(grab("activities", lambda: client.transactions_and_reporting.get_activities()))
>     with open("snaplog.jsonl", "a") as f:
>         f.write(json.dumps(entry, default=str) + "\n")
>     print(ts, "logged")
>     time.sleep(600)  # 10 min — SnapTrade's recommended polling floor
> ```
>
> **Step 4 — Test trades (market hours, spread over the week).** Small is fine — one share / a few dollars. For every trade, immediately write down: exact time to the minute (with timezone), ticker, buy/sell, quantity, fill price from the Robinhood confirmation, any fee.
>
> | # | Do this | Why |
> |---|---------|-----|
> | 1 | Market **buy**, liquid stock (e.g. 1 AAPL) | Basic detection speed |
> | 2 | Market **sell** part of an existing position | Sells report correctly |
> | 3 | **Limit order** that fills later — note placed time *and* filled time | Placed vs. filled distinction |
> | 4 | **Two trades, same ticker, same day** (morning + afternoon) | Same-day disambiguation |
> | 5 | Small **deposit or withdrawal** | Cash movements visible |
> | 6 | If a **dividend** lands, note ticker/amount/date | Dividend visibility |
>
> Trade log template: `time (exact, TZ) | ticker | buy/sell | qty | fill price | fee | order type | notes`
>
> **Step 5 — Through the week (passive).** Note any Robinhood security emails ("new login" / "device verification") after connecting; note if SnapTrade ever asks you to reconnect. Otherwise trade normally.
>
> **Send back:** `snaplog.jsonl`, the filled trade log, Step 2 screenshots + connection notes, security notes. **Do not send your API keys** — delete the key in the SnapTrade dashboard after the test.
