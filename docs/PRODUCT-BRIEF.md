# Product Brief — Meridian Capital (v1)
### A transparent, AI-assisted trade-signal subscription

> **Thesis:** A credible trader publishes a verified, live track record across three risk-based strategies. Subscribers pay a low monthly fee to see every trade and — critically — get an **AI copy-sizing assistant** that translates the trader's moves into decisions sized to *their own* capital and risk. It's a finfluencer's audience business, but with proof instead of screenshots and a personal AI instead of a noisy chat.

*Status: first-draft brief, derived from a founder Q&A. Not legal advice — securities-law items flagged for a professional.*

---

## 1. Problem
Retail investors who follow a credible trader rely on screenshots, Telegram messages, and hindsight. They can't verify the track record is real, and even when they trust it, they don't know **how to size the trade to their own account and risk tolerance.** Trust erodes; copying is error-prone and emotional.

## 2. Target users (three risk personas)
The three "funds" are really three risk personalities served by one trader:

| Persona | Profile | Fund | Needs |
|---|---|---|---|
| **The compounder** | Has capital, patient, wants long-term growth | Alpha | Conviction picks, allocation, growth vs. S&P |
| **The disciplined saver** | Limited capital, invests monthly | Smart SIP | A simple monthly plan, cost-averaging, encouragement to stay in |
| **The quick-return seeker** | Small capital, higher risk appetite | Swing | Timely entries/exits, clear rules, position sizing |

## 3. Positioning
"Verified trades + a personal AI that sizes them to you." Not a brokerage (no execution), not an RIA (v1 gives no personalized advice), not a Telegram channel (proof, not screenshots; assistant, not noise).

## 4. Business model
- **v1:** flat subscription, **$10.99/mo**, all tiers see the same impersonal feed.
- Reachable audience today: **~1,000**. At 3–5% conversion → **30–50 paying subs ≈ $350–550/mo.**
- **v1 is validation-stage, not income.** Success = proof of edge + retention + a verified public track record that compounds trust.
- **v2:** managed accounts for HNIs (requires RIA — see §8) and premium AI tiers.

## 5. The AI wedge — copy-sizing assistant (the must-have)
The single capability a subscriber would cancel without:
> "You invested $10,000 in TSLA. I have $3,000 and a moderate risk profile — what should I do?" → the assistant returns a sized, risk-adjusted suggestion, *explains the reasoning* (so the user learns), and references the trader's entry rules.

Supporting AI (nice-to-have, v1.x): plain-English **company financial-strength check** and **ranked "why did my stock move" news**. All powered by the capstone Skills (relevance-filter, key-facts, copy-sizing) over MCP sources.

## 6. v1 scope
**In:**
- Multi-fund dashboard (3 personas), live verified holdings + trades
- Stock drill-down: AI key-facts, fundamentals, AI-ranked news
- **AI copy-sizing assistant**
- Published entry **and exit** rules/stops per trade
- Subscription + auth

**Out (explicit non-goals for v1):**
- ❌ Managed accounts / trading on users' behalf → **v2 (RIA-gated)**
- ❌ Auto-execution / brokerage integration for copying → users re-enter manually
- ❌ Personalized advice to individuals (keeps v1 in publisher lane)
- ❌ Scaling to HNIs / rebuilding TradingView's data depth

## 7. Trust & track record
- Track record must be **provably live**: read-only verified brokerage feed (Robinhood/SnapTrade/Plaid or similar), not screenshots.
- Performance claims must follow disclosure best practice (net-of-fees, no cherry-picking) — treat the SEC Marketing Rule as the bar even as a publisher.

## 8. Regulatory posture (founder decision)
- **v1 = publisher/newsletter branch.** Impersonal, general, same feed to all → leans on the publisher exclusion. Keep it non-personalized; add clear "not financial advice / past performance ≠ future results" disclaimers.
- **v2 = RIA branch.** Managed accounts + personalized advice require registration (state/SEC), Form ADV, custody & marketing compliance.
- ⚠️ **Kill-criterion:** a securities attorney must confirm the v1 design stays in the publisher lane *before launch.* The copy-sizing assistant must give **general, self-serve** sizing math — not personalized recommendations — or it drags v1 toward RIA.

## 9. Success metrics (v1)
- **North star:** paying subscribers retained > 3 months.
- Conversion rate (audience → paid) ≥ 3%.
- Verified track record published and updating live.
- Copy-sizing assistant usage per active subscriber (must-have engagement).
- Churn through a drawdown month (the real retention test).

## 10. Roadmap
| Version | Focus | Gate |
|---|---|---|
| **v1** | Publisher subscription + copy-sizing AI + verified track record | Attorney sign-off; capstone bars |
| **v1.x** | Financial-strength check, ranked news, PDF/email digests | Retention proven |
| **v2** | Managed accounts (RIA), HNI tier, deeper AI/data moat | RIA registration; audience scaled |

## 11. Risks & kill-criteria
| Risk | Mitigation / kill-criterion |
|---|---|
| **Regulatory (existential)** | v1 stays publisher-lane; attorney sign-off is a hard gate |
| **"Signals channel" liability** | Disclosures, verified performance, no undisclosed comp; avoid personalized advice |
| **Copy exit risk** | Publish exits + stops up front; swing horizon is days-to-weeks (latency-tolerant) |
| **Key-person / moat** | Accepted: creator business v1. Moat = trust + verified record + AI assistant. Revisit for v2 |
| **Thin economics** | $10.99 × small audience = validation only; don't over-invest before retention proven |
| **AI = commodity** | Copy-sizing personalization + education is the differentiator, not "AI news" |

## 12. Capstone mapping (quick)
- **Skills:** relevance-filter, key-facts, **copy-sizing** (the wedge) — Bar #5
- **Sources:** market-data MCP, news MCP, custom Portfolio MCP — Bar #3
- **Background agents:** trade-event & news-event alerts — Bar #2
- **Outputs:** dashboard UI, PDF statement, email/audio digest — Bar #4
- **Spec/deploy/observability:** Bars #1, #6, #7

---
*Companion docs: `PRD.md` (epics + features), `PERSONAS.md` (personas), `CAPSTONE-SPEC.md` (submission one-pager, TBD), `CAPSTONE-PLAN.md` (architecture + diagrams, TBD), `../dashboard.html` (interactive mock).*
