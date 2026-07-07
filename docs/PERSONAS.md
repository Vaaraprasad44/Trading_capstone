# Personas — Who We're Building Meridian Capital For (v1)

> Companion to [PRODUCT-BRIEF.md](PRODUCT-BRIEF.md). The brief defines three risk personas served by one trader; this document expands each into a full persona to guide product, copy, and AI-assistant design decisions.
>
> **Status: hypothesis-stage.** These personas are synthesized from the founder Q&A behind the product brief, not from user interviews or survey data. Every persona below should be validated against real members of the ~1,000-person reachable audience before v1 launch (see §6, Validation Plan).

---

## How to read these personas

Each persona maps 1:1 to a fund (Alpha / Smart SIP / Swing). They are **risk personalities, not demographics** — a 45-year-old can be a Quick-Return Seeker and a 25-year-old can be a Compounder. The demographic sketches are illustrative anchors; the segmenting variables that actually matter are:

1. **Capital available** (determines how relevant copy-sizing is)
2. **Time horizon & patience** (determines which fund they follow)
3. **What "trust" requires for them** (determines which proof surface converts them)
4. **Emotional relationship with losses** (determines drawdown-month churn risk)

---

## Persona 1 — "Rajesh" · The Compounder (Alpha fund)

*"I don't need more stock tips. I need to know the person behind the tips isn't lying about their returns."*

### Demographics & profile
- **Age range:** 32–48
- **Role:** Mid-to-senior professional (engineering, medicine, law, finance-adjacent) or small-business owner
- **Investable capital:** $50K–$500K, mostly parked in index funds / 401(k)
- **Investing experience:** 5–15 years; has owned individual stocks; reads earnings summaries but doesn't model
- **Where he is today:** Follows 2–3 finance voices on X/YouTube; lurks, rarely comments; has been pitched (and declined) several paid Discord groups

### Behavioral profile
- Checks his portfolio weekly, not daily. Allergic to hype language ("100x", rocket emojis).
- Willing to allocate a **satellite slice (5–15%) of his portfolio** to conviction picks — the core stays indexed.
- Does his own second read before acting on any pick; a signal is an input, not an order.
- Has capital, so a single good year of alpha is worth thousands of dollars to him — and a fake track record could cost him the same.

### Primary job-to-be-done
> **When** I have capital compounding in index funds and I see a trader claiming market-beating returns, **I want to** verify the record is real and understand the reasoning behind each position, **so I can** confidently allocate a satellite slice to conviction picks without becoming a full-time analyst.

- **Frequency:** Evaluates the trader continuously; acts on trades a few times per quarter (Alpha is low-turnover).
- **Success criterion:** His satellite allocation beats the S&P over a rolling year, and he can explain *why* each position is held.

### Top 3 pain points
1. **Unverifiable track records (severity: dealbreaker).** Every signal seller shows screenshots and cherry-picked wins. He has no way to distinguish a real edge from survivorship bias, so he defaults to trusting no one — and stays fully indexed even when he wants more.
2. **No allocation guidance (severity: high).** Even when he trusts a pick, "buy TSLA" tells him nothing about whether it should be 2% or 10% of his satellite slice, or how it fits with the positions he already copied.
3. **Reasoning is hidden (severity: high).** Signal channels give tickers, not theses. Without the entry logic and exit plan, he can't hold through volatility — he ends up selling winners early because he never understood why they were bought.

### Top 3 desired gains
1. **Provable, live performance vs. S&P** — a read-only brokerage-verified feed he can audit himself. This is what converts him; nothing else does.
2. **Sized allocation math for his capital** — the copy-sizing assistant translating "trader put 8% into TSLA" into "for your $40K satellite at moderate risk, that's ~$3,200, and here's the math."
3. **Learning compounding alongside capital compounding** — every explained trade makes him a slightly better investor; he's paying for education disguised as signals.

### One unexpected insight
**Rajesh will follow many trades without copying them — and that's fine.** His engagement metric is *verification visits* (checking the live record, reading theses), not copy-rate. He treats the first 3–6 months as an extended audit; he may pay $10.99/mo purely to watch before allocating a dollar. **Product implication:** don't treat low copy-activity as churn risk for Alpha subscribers — treat *declining record-checking* as the real warning sign. The track-record page, not the trade feed, is his home screen.

### Product fit assessment
- **Fit:** Strongest long-term fit. The verified-record thesis is built precisely for his dealbreaker pain, and he has enough capital that copy-sizing produces meaningfully different numbers than the trader's.
- **Friction / unmet needs:**
  - Alpha's low trade frequency means weeks of silence — he may question the subscription's value between trades. (Mitigation: v1.x financial-strength checks and ranked news give the dashboard a pulse between trades.)
  - He will ask portfolio-level questions ("how do these five positions overlap with my index funds?") that drift toward personalized advice — the assistant must deflect these to general math to stay in the publisher lane (brief §8).
  - $10.99/mo is trivially cheap for him — he'd pay 5–10× more, which is margin left on the table until v2 tiers.

---

## Persona 2 — "Priya" · The Disciplined Saver (Smart SIP fund)

*"I can save $400 a month. I just want someone credible to tell me the plan — and tell me to keep going when everything's red."*

### Demographics & profile
- **Age range:** 23–34
- **Role:** Early-career professional (analyst, teacher, nurse, developer); first stable paycheck
- **Investable capital:** $2K–$20K accumulated; adds **$200–$600/month**
- **Investing experience:** 0–4 years; has a robo-advisor or target-date fund; bought 1–2 meme stocks and regretted it
- **Where she is today:** Gets investing content from Instagram/YouTube shorts; finds most of it either patronizing or casino-adjacent

### Behavioral profile
- Invests on a **monthly rhythm tied to payday** — her key moment is "salary landed, what do I buy?"
- Loss-averse more than risk-averse: a -15% month doesn't make her sell, it makes her *stop contributing* and avoid opening the app.
- Wants rules and rituals, not options. Choice overload is what pushed her to a target-date fund.
- Values encouragement genuinely — streaks, "you stayed invested through the dip" messages land with her, not as gimmicks.

### Primary job-to-be-done
> **When** my paycheck lands each month, **I want** a simple, credible plan for exactly what to buy with my contribution, **so I can** build long-term wealth on autopilot without second-guessing every purchase or abandoning the plan during downturns.

- **Frequency:** One core decision per month (payday), plus reassurance-seeking visits during volatile weeks.
- **Success criterion:** Twelve consecutive months of contributions made without skipping; portfolio growing without her having to think.

### Top 3 pain points
1. **Monthly decision paralysis (severity: high).** Every payday she faces "what do I actually buy this month?" Generic advice says "index funds," influencers say ten conflicting tickers. The decision cost makes her delay, and delayed cash sits idle.
2. **No one credible talks to small accounts (severity: high).** All trading content assumes $10K+ positions. "I invested $25,000 in NVDA" is useless to someone deploying $400 — she can't translate it, so she assumes the product isn't for her.
3. **She abandons plans in drawdowns (severity: dealbreaker for outcomes).** Her history: starts a plan, market drops, contributions stop, plan dies. Nothing in her current tools addresses the emotional moment — the exact moment cost-averaging matters most.

### Top 3 desired gains
1. **A concrete monthly plan** — "this month's SIP contribution, split like this, here's why" — that turns payday from a decision into a ritual.
2. **Copy-sizing that respects small numbers** — the assistant translating fund moves into $400-sized actions without condescension, including fractional-share math.
3. **Encouragement with receipts** — "savers who stayed in through the last three dips are up X%" — evidence-backed reassurance that keeps her contributing when it's red.

### One unexpected insight
**Priya churns from silence, not from losses.** The intuitive fear is that a drawdown month kills her subscription — but her actual pattern is that she disengages when the product goes quiet and nobody notices she skipped a contribution. A drawdown *with* a calm, explained "here's what we're doing and why we're not panicking" message is a **retention event** — it's the moment the subscription proves it's worth more than a YouTube video. **Product implication:** the brief's "churn through a drawdown month" metric (§9) is won or lost on proactive communication cadence, and the background alert agents (§12) matter more for her than for anyone.

### Product fit assessment
- **Fit:** Strong fit with the largest underserved-market angle — nobody credible serves $400/month savers. Likely the highest-volume persona and the best word-of-mouth engine ("this actually tells me what to do with my $400").
- **Friction / unmet needs:**
  - $10.99/mo is **2–5% of her monthly investable capital** — she will (rationally) ask whether the fee eats her returns. The product must make the math visibly worth it, or she's the most price-sensitive churn risk.
  - Manual re-entry of trades (no brokerage integration in v1, brief §6) hits her hardest — a monthly-ritual user wants one-tap execution; friction here breaks the ritual the product depends on.
  - She most needs what v1 must not give: "is this right *for me*?" personalized reassurance. The assistant's general-math framing must still *feel* personal enough to comfort her, which is a hard copywriting problem, not an AI problem.

---

## Persona 3 — "Marcus" · The Quick-Return Seeker (Swing fund)

*"I've paid for three signal groups. Every one of them posted the wins and deleted the losses. Show me the exits, not just the entries."*

### Demographics & profile
- **Age range:** 19–30
- **Role:** Student, gig worker, or junior employee; investing is part income-hope, part hobby, part entertainment
- **Investable capital:** $500–$5,000 of genuinely risk-tolerant money
- **Investing experience:** 1–3 intense years; options-curious; has blown up at least one small account; active on Discord/Telegram/Reddit
- **Where he is today:** In (or recently burned by) 1–3 paid signal channels; screenshots of gains got him in, undisclosed losses pushed him out

### Behavioral profile
- Checks markets **multiple times daily**; latency-sensitive; push notifications are his primary interface.
- Position-sizes emotionally: goes too big after wins, revenge-trades after losses. Knows this about himself.
- Sophisticated about *distrust* — he can spot fake screenshots and cherry-picking, because he's been the victim. Verification pitch lands instantly.
- Highest willingness to pay of the three ($10.99 undercuts the $50–$100/mo signal groups he's already paid for), lowest loyalty — he churns the moment he perceives the edge is gone.

### Primary job-to-be-done
> **When** a trader with a verified record enters a swing trade, **I want** the entry, stop, and exit rules immediately, sized to my small account, **so I can** capture the move with defined risk instead of guessing my way into another blown account.

- **Frequency:** Every trade event (days-to-weeks swing horizon); daily check-ins between events.
- **Success criterion:** Positive P&L over a quarter *with no single loss exceeding his stop* — he's learning that survival is the edge.

### Top 3 pain points
1. **Signal sellers hide losses (severity: dealbreaker).** Entries get posted, losing exits get memory-holed. He's paid hundreds for records that don't survive scrutiny and has zero tools to verify before paying.
2. **Position sizing is where he dies (severity: existential to his account).** The signal says "long AMD" — he puts 40% of his account in because the last trade won. No channel he's used tells him what size is sane for a $2,000 account, and sizing errors, not bad picks, blew him up.
3. **Entries without exits (severity: high).** He gets in on the signal, then the channel goes quiet. Did the trader take profit? Move the stop? He's left holding a position with no plan, refreshing a Telegram channel run by someone with no obligation to update him.

### Top 3 desired gains
1. **Exits and stops published up front** (brief §6) — a complete trade plan at entry, so he's never holding a position without knowing the exit conditions.
2. **Sizing guardrails** — the copy-sizing assistant as an impulse-control device: "at your stated risk level, general practice for a $2,000 account is risking 1–2% per trade — that's a $40 max loss, which implies a position of X shares with the published stop."
3. **A record he can throw at skeptics** — the verified feed is also social currency; he *wants* to be the guy in his Discord who found the legit one.

### One unexpected insight
**Marcus values the assistant most as a restraint system, not an amplifier — but he'll test its boundaries hardest.** The persona chasing quick returns is, counterintuitively, best served by a tool that tells him to bet *smaller* — and part of him knows it. Simultaneously, he is the persona most likely to push the assistant toward personalized advice: "should I exit NOW?", "can I use 2x leverage on this?", "what about my other positions?" **Product implication:** he is the primary regulatory stress-test for the publisher-lane constraint (brief §8). The assistant's refusal patterns and general-math framing should be designed against *his* transcripts first, and the attorney reviewing v1 should see Marcus-style conversations, not Rajesh-style ones.

### Product fit assessment
- **Fit:** Fastest to convert (verification pitch matches his exact scar tissue; price undercuts what he already pays) and the most engaged daily user. Swing's days-to-weeks horizon tolerates the manual re-entry latency (brief §11, copy exit risk).
- **Friction / unmet needs:**
  - Loyalty is to the edge, not the product: 2–3 losing swings in a row and he churns loudly. His retention rides entirely on the drawdown-communication playbook and the up-front-exits promise being kept every single trade.
  - No auto-execution (v1 non-goal) will be his #1 feature request; expect it in every feedback channel.
  - He generates the highest support and moderation load per dollar of revenue — worth it for engagement signal in validation stage, worth re-examining at v2.

---

## 4. Cross-persona summary

| Dimension | Rajesh (Compounder) | Priya (Saver) | Marcus (Swing) |
|---|---|---|---|
| **Fund** | Alpha | Smart SIP | Swing |
| **Capital** | $50K–$500K | $2K–$20K (+$200–600/mo) | $500–$5K |
| **What converts them** | Auditable live record | A plan for small money | Verified record + published exits |
| **Killer feature** | Copy-sizing (allocation math) | Monthly plan + encouragement | Sizing guardrails + stops |
| **Visit cadence** | Weekly | Monthly (payday) + dips | Multiple daily |
| **Churn trigger** | Boredom between trades | Product silence in drawdowns | Losing streak / perceived lost edge |
| **Retention lever** | Between-trade content (v1.x) | Proactive drawdown comms | Exit discipline kept every trade |
| **Price sensitivity** | None (underpriced for him) | High (fee vs. small capital) | Low (undercuts signal groups) |
| **Regulatory risk they create** | Portfolio-level advice questions | "Is this right for me?" reassurance | Boundary-pushing on live-trade advice |
| **North-star contribution** | Trust anchor, future v2 HNI | Volume + word of mouth | Engagement + daily activity |

**Shared traits (all three):** follow the same one trader; need the record to be provably live; must re-enter trades manually in v1; receive the same impersonal feed (publisher lane); measure the product against free alternatives (YouTube, Telegram) rather than against paid competitors.

## 5. Anti-personas — who v1 is explicitly *not* for

- **The HNI delegator** ("just manage my money") — requires RIA registration; deferred to v2 (brief §8). Politely waitlist, don't serve.
- **The auto-copier** (wants one-click brokerage mirroring) — auto-execution is a v1 non-goal (brief §6). Manual re-entry is a deliberate line, not a gap.
- **The day-trader / scalper** — needs sub-minute latency; the swing horizon (days-to-weeks) is the fastest cadence offered. They will churn and leave bad reviews; don't market to them.
- **The advice-seeker** ("tell me what *I* should do with *my* situation") — personalized advice drags v1 out of the publisher lane. The assistant gives general, self-serve math only.

## 6. Data gaps & validation plan

These personas are founder hypotheses. Before treating them as ground truth:

1. **Interview 5–8 people per persona** from the ~1,000 reachable audience (screener: capital range + horizon + current signal-source usage). Priority questions: Would Rajesh pay before his audit period ends? Does Priya's fee-vs-capital math survive contact? What did Marcus's last signal-group cancellation actually look like?
2. **Validate the persona split itself** — the audience may skew 80/20 toward one persona, which changes v1 sequencing (e.g., if it's mostly Marcus, drawdown comms and exit discipline are the whole product).
3. **Test willingness to pay** per persona before anchoring on flat $10.99 — Rajesh's indifference and Priya's sensitivity suggest tiering pressure earlier than v2.
4. **Log and review real copy-sizing transcripts** during beta, tagged by persona, as the evidence base for the attorney's publisher-lane review (brief §8 kill-criterion).

---
*Sources: [PRODUCT-BRIEF.md](PRODUCT-BRIEF.md) (founder Q&A synthesis). No primary user research yet — see §6.*
