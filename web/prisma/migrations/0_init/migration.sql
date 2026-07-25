CREATE TYPE fund_code AS ENUM ('alpha', 'sip', 'swing');
CREATE TYPE trade_direction AS ENUM ('long', 'short');  -- 'short' unreachable on Robinhood today; kept because PRD 2.1 specifies the field
CREATE TYPE card_status AS ENUM ('draft', 'published', 'closed');

CREATE TABLE funds (
  id               smallint PRIMARY KEY,
  code             fund_code UNIQUE NOT NULL,
  name             text NOT NULL,                  -- "$1M Alpha Fund"
  description      text NOT NULL,
  badge            text NOT NULL,                  -- "Long-term investing"
  benchmark_symbol text NOT NULL DEFAULT 'SPY',
  inception_date   date NOT NULL
);

CREATE TABLE instruments (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  symbol     text UNIQUE NOT NULL,                 -- "NVDA"
  name       text NOT NULL,
  asset_type text NOT NULL DEFAULT 'equity'
             CHECK (asset_type IN ('equity', 'etf'))
);

-- Published sizing formulas per fund (PRD 5.2). Versioned: transcripts and
-- eval cases must be able to reference the exact formula in force at the time.
CREATE TABLE sizing_methodologies (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fund_id      smallint NOT NULL REFERENCES funds(id),
  version      int NOT NULL,
  body_md      text NOT NULL,        -- human-readable published methodology
  params       jsonb NOT NULL,       -- machine-usable: {"risk_pct_min":1,"risk_pct_max":2,...}
  published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fund_id, version)
);
CREATE TABLE trade_cards (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id       smallint NOT NULL REFERENCES funds(id),
  instrument_id bigint NOT NULL REFERENCES instruments(id),
  direction     trade_direction NOT NULL,
  entry_price   numeric(18,4) NOT NULL CHECK (entry_price > 0),
  position_pct  numeric(6,3) NOT NULL CHECK (position_pct > 0 AND position_pct <= 100),
  thesis_md     text NOT NULL,
  stop_price    numeric(18,4),
  exit_rules_md text,
  status        card_status NOT NULL DEFAULT 'draft',
  published_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- PRD 2.2: publishing is blocked without stop + exit rules. No exceptions,
  -- and not only in the UI — the database refuses.
  CONSTRAINT published_requires_exits CHECK (
    status = 'draft'
    OR (stop_price IS NOT NULL AND exit_rules_md IS NOT NULL AND published_at IS NOT NULL)
  )
);

CREATE INDEX ON trade_cards (fund_id, published_at DESC) WHERE status <> 'draft';

-- PRD 2.3: after publish, the ONLY legal change is published -> closed with
-- every other column frozen, and published cards are never deleted. Enforced
-- here, not just in the app — the immutability claim is DDL, not discipline.
CREATE FUNCTION trade_cards_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'draft' THEN
    RETURN COALESCE(NEW, OLD);       -- drafts are freely editable and deletable
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'published trade cards are never deleted';
  END IF;
  IF NOT (OLD.status = 'published' AND NEW.status = 'closed'
          AND (NEW.fund_id, NEW.instrument_id, NEW.direction, NEW.entry_price,
               NEW.position_pct, NEW.thesis_md, NEW.stop_price, NEW.exit_rules_md,
               NEW.published_at, NEW.created_at)
              IS NOT DISTINCT FROM
              (OLD.fund_id, OLD.instrument_id, OLD.direction, OLD.entry_price,
               OLD.position_pct, OLD.thesis_md, OLD.stop_price, OLD.exit_rules_md,
               OLD.published_at, OLD.created_at)) THEN
    RAISE EXCEPTION 'published trade cards are immutable — append a trade_card_event instead';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trade_cards_immutable
  BEFORE UPDATE OR DELETE ON trade_cards
  FOR EACH ROW EXECUTE FUNCTION trade_cards_guard();

-- Shared guard for the append-only trust tables (design decision #2).
CREATE FUNCTION forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END $$;

-- Everything that happens after entry is an append-only event.
CREATE TABLE trade_card_events (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trade_card_id uuid NOT NULL REFERENCES trade_cards(id),
  event_type    text NOT NULL CHECK (event_type IN ('stop_moved', 'partial_exit', 'closed', 'note')),
  payload       jsonb NOT NULL DEFAULT '{}',  -- {"new_stop":..} / {"exit_price":..,"qty_pct":..}
  note_md       text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON trade_card_events (trade_card_id, created_at);

CREATE TRIGGER trade_card_events_append_only
  BEFORE UPDATE OR DELETE ON trade_card_events
  FOR EACH ROW EXECUTE FUNCTION forbid_change();
-- Raw SnapTrade account activity. Append-only; `raw` keeps the full payload so
-- the whole pipeline is replayable if mapping logic changes. Not just trades:
-- dividends, interest, transfers, and splits land here too — NAV needs the cash
-- rows, and split rows let reconciliation adjust pre-split entry prices instead
-- of flagging false mismatches. `fees` (regulatory SEC/TAF on sells; Robinhood
-- charges no commission) feeds the net-of-fees requirement (PRD 9.3).
CREATE TABLE broker_fills (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snaptrade_txn_id text UNIQUE NOT NULL,          -- idempotent ingest
  instrument_id    bigint REFERENCES instruments(id),
  raw_symbol       text,                          -- as reported, even if unmapped; null on cash-only rows
  activity_type    text NOT NULL DEFAULT 'trade' CHECK (activity_type IN
                     ('trade', 'dividend', 'interest', 'transfer', 'split', 'fee', 'other')),
  side             text CHECK (side IN ('buy', 'sell')),
  quantity         numeric(18,6),
  price            numeric(18,4),
  amount           numeric(18,2),                 -- signed cash effect (dividends, transfers, fees)
  fees             numeric(18,2) NOT NULL DEFAULT 0,
  executed_at      timestamptz NOT NULL,
  raw              jsonb NOT NULL,
  synced_at        timestamptz NOT NULL DEFAULT now(),
  -- a trade row carries its trade fields; other activity kinds may not
  CONSTRAINT trade_fields CHECK (
    activity_type <> 'trade'
    OR (side IS NOT NULL AND quantity IS NOT NULL AND price IS NOT NULL AND raw_symbol IS NOT NULL)
  )
);

CREATE INDEX ON broker_fills (executed_at DESC);

-- instrument_id is the one mutable column: late raw_symbol -> instrument
-- mapping is allowed; everything else is frozen at ingest.
CREATE TRIGGER broker_fills_append_only
  BEFORE DELETE OR UPDATE OF snaptrade_txn_id, raw_symbol, activity_type, side,
    quantity, price, amount, fees, executed_at, raw, synced_at
  ON broker_fills
  FOR EACH ROW EXECUTE FUNCTION forbid_change();

-- Every sync attempt, success or failure — powers the "last verified at T"
-- staleness banner (PRD 1.6) and feed-health observability.
CREATE TABLE feed_syncs (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trigger        text NOT NULL CHECK (trigger IN ('schedule', 'on_demand', 'webhook')),
  started_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz,
  status         text NOT NULL DEFAULT 'running'
                 CHECK (status IN ('running', 'ok', 'error')),
  fills_ingested int NOT NULL DEFAULT 0,
  error          text
);

-- The verification join (PRD 1.3/1.4). A card entry — or a close event, or a
-- SIP fill against the month's plan — is "✓ verified" iff a 'matched' row
-- exists pointing at a real fill.
-- 'unmatched_fill' rows ARE the omission flags: a fill nobody published.
CREATE TABLE reconciliations (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind                text NOT NULL CHECK (kind IN ('entry', 'exit')),
  status              text NOT NULL CHECK (status IN
                        ('matched', 'mismatched', 'unmatched_fill', 'unmatched_card')),
  trade_card_id       uuid REFERENCES trade_cards(id),
  trade_card_event_id bigint REFERENCES trade_card_events(id),  -- closes verified too (PRD 2.3)
  sip_plan_id         bigint,                       -- SIP claims; FK added in §3.5 (sip_plans defined there)
  broker_fill_id      uuid REFERENCES broker_fills(id),
  details             jsonb NOT NULL DEFAULT '{}',  -- price/qty deltas on mismatch
  resolved_at         timestamptz,                  -- trader addressed the flag
  created_at          timestamptz NOT NULL DEFAULT now(),
  -- a fill can verify at most one thing
  CONSTRAINT one_match_per_fill UNIQUE (broker_fill_id),
  -- this table is the trust engine: each status has exactly one legal shape —
  -- no 'matched' stamp without a fill, no verification pointing at two claims
  CONSTRAINT status_shape CHECK (
    (status IN ('matched', 'mismatched') AND broker_fill_id IS NOT NULL
       AND num_nonnulls(trade_card_id, trade_card_event_id, sip_plan_id) = 1)
    OR (status = 'unmatched_fill' AND broker_fill_id IS NOT NULL
       AND num_nonnulls(trade_card_id, trade_card_event_id, sip_plan_id) = 0)
    OR (status = 'unmatched_card' AND broker_fill_id IS NULL
       AND num_nonnulls(trade_card_id, trade_card_event_id, sip_plan_id) = 1)
  ),
  -- entries verify cards or SIP plans; exits verify close/partial-exit events
  CONSTRAINT kind_matches_claim CHECK (
    status = 'unmatched_fill'
    OR (kind = 'entry' AND trade_card_event_id IS NULL)
    OR (kind = 'exit' AND trade_card_id IS NULL AND sip_plan_id IS NULL)
  )
);

CREATE INDEX ON reconciliations (status) WHERE resolved_at IS NULL;
-- One row per fund per day — the equity curve. NAV computed by the sync agent
-- from fills + cash; benchmark stored alongside for the vs-S&P chart.
CREATE TABLE fund_nav_daily (
  fund_id  smallint NOT NULL REFERENCES funds(id),
  date     date NOT NULL,
  nav      numeric(18,2) NOT NULL,
  invested numeric(18,2) NOT NULL,
  cash     numeric(18,2) NOT NULL,
  PRIMARY KEY (fund_id, date)
);

CREATE TABLE benchmark_prices (
  symbol text NOT NULL,
  date   date NOT NULL,
  close  numeric(18,4) NOT NULL,
  PRIMARY KEY (symbol, date)
);

-- External cash flows (deposits/withdrawals), dated. Without these the equity
-- curve conflates deposits with gains — an "auditable, no cherry-picking"
-- record (PRD 1.2, 9.3) needs time-weighted returns: this table + fund_nav_daily.
CREATE TABLE fund_cash_flows (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fund_id        smallint NOT NULL REFERENCES funds(id),
  date           date NOT NULL,
  amount         numeric(18,2) NOT NULL CHECK (amount <> 0),  -- + deposit, - withdrawal
  broker_fill_id uuid UNIQUE REFERENCES broker_fills(id),     -- source transfer row, when feed-derived
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Open positions: published CLAIMS, adjusted for partial exits, with the entry
-- verification stamp joined on (decision #1). The claim is what's displayed;
-- the stamp says whether the brokerage record agrees — a card the feed
-- contradicts surfaces as 'flagged', never silently.
CREATE VIEW current_positions AS
SELECT tc.fund_id,
       tc.instrument_id,
       tc.id AS trade_card_id,
       tc.direction,
       tc.entry_price,
       tc.position_pct * (1 - COALESCE(x.exited_pct, 0) / 100.0) AS position_pct,
       tc.published_at,
       COALESCE(v.stamp, 'pending') AS entry_verification
FROM trade_cards tc
LEFT JOIN LATERAL (
  SELECT sum((e.payload->>'qty_pct')::numeric) AS exited_pct
  FROM trade_card_events e
  WHERE e.trade_card_id = tc.id AND e.event_type = 'partial_exit'
) x ON true
LEFT JOIN LATERAL (
  -- verified iff every entry reconciliation matched (partial fills = many rows)
  SELECT CASE WHEN bool_and(r.status = 'matched') THEN 'verified' ELSE 'flagged' END AS stamp
  FROM reconciliations r
  WHERE r.trade_card_id = tc.id AND r.kind = 'entry'
) v ON true
WHERE tc.status = 'published';
-- Priya's monthly plan (PRD 3.4). For the SIP fund the published plan IS the
-- claim: DCA fills reconcile against the month's plan (reconciliations.sip_plan_id),
-- not against trade cards — so index buys don't trip the stop/exit-rules gate
-- (nonsense for buy-and-hold) and don't show up as omission flags (PRD 1.4).
CREATE TABLE sip_plans (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fund_id      smallint NOT NULL REFERENCES funds(id),
  month        date NOT NULL,               -- first of month
  plan_md      text NOT NULL,
  breakdown    jsonb NOT NULL,              -- [{"symbol":"VOO","pct":60},...]
  published_at timestamptz,
  UNIQUE (fund_id, month)
);

-- FK for the column declared in §3.3 (sip_plans didn't exist yet there).
ALTER TABLE reconciliations
  ADD CONSTRAINT reconciliations_sip_plan_fk
  FOREIGN KEY (sip_plan_id) REFERENCES sip_plans(id);

-- PRD 2.4: AI drafts, trader approves, then it goes out. Status gates the flow.
CREATE TABLE drawdown_comms (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fund_id         smallint NOT NULL REFERENCES funds(id),
  trigger_metrics jsonb NOT NULL,           -- {"drawdown_pct":-12.4,"window_days":30}
  draft_md        text NOT NULL,
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'approved', 'sent', 'discarded')),
  approved_at     timestamptz,
  sent_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
-- key-facts Skill output (PRD 4.2). Cache, not record — regenerated on
-- material news; safe to truncate.
CREATE TABLE ai_key_facts_cache (
  instrument_id bigint PRIMARY KEY REFERENCES instruments(id),
  content_md    text NOT NULL,
  model         text NOT NULL,
  generated_at  timestamptz NOT NULL DEFAULT now()
);

-- News from the news MCP with the relevance-filter Skill's verdict attached
-- (PRD 4.3, 7.3).
CREATE TABLE news_items (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  instrument_id bigint NOT NULL REFERENCES instruments(id),
  external_id   text UNIQUE NOT NULL,        -- idempotent ingest
  headline      text NOT NULL,
  summary       text,
  url           text,
  published_at  timestamptz NOT NULL,
  relevance     text CHECK (relevance IN ('high', 'med', 'low')),  -- null = not yet ranked
  relevance_reason text,
  ranked_at     timestamptz
);

CREATE INDEX ON news_items (instrument_id, published_at DESC);
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  auth_provider text NOT NULL,               -- 'email' | 'google' | ...
  auth_subject  text NOT NULL,               -- provider's stable user id
  role          text NOT NULL DEFAULT 'subscriber'
                CHECK (role IN ('subscriber', 'trader')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (auth_provider, auth_subject)
);
-- Deliberately absent: risk_tolerance, account_size, investment_goals.
-- PRD 5.1 — sizing inputs are session-only. Their absence here is a
-- compliance feature; do not add them without attorney sign-off.

-- Disclaimer text is versioned; acceptance binds a user to a specific version
-- at a specific time (PRD 6.3, 9.1) — that pair is the compliance record.
CREATE TABLE disclosure_versions (
  id           int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  body_md      text NOT NULL,
  effective_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE disclosure_acceptances (
  user_id               uuid NOT NULL REFERENCES users(id),
  disclosure_version_id int NOT NULL REFERENCES disclosure_versions(id),
  accepted_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, disclosure_version_id)
);

-- Mirror of Stripe state, maintained ONLY by webhook processing.
CREATE TABLE subscriptions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid UNIQUE NOT NULL REFERENCES users(id),
  stripe_customer_id     text UNIQUE NOT NULL,
  stripe_subscription_id text UNIQUE NOT NULL,
  status                 text NOT NULL,       -- Stripe's vocabulary, verbatim
  current_period_end     timestamptz NOT NULL,
  canceled_at            timestamptz,
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE stripe_webhook_events (
  stripe_event_id text PRIMARY KEY,           -- idempotency key
  event_type      text NOT NULL,
  payload         jsonb NOT NULL,
  processed_at    timestamptz,
  error           text,
  received_at     timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE assistant_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id),
  fund_id       smallint REFERENCES funds(id),        -- context, if opened from a fund
  trade_card_id uuid REFERENCES trade_cards(id),      -- context, if opened from a trade
  started_at    timestamptz NOT NULL DEFAULT now()
);

-- Append-only. This log IS PRD 5.5 — queryable by question type, exportable
-- for the attorney's publisher-lane review. Sizing inputs the user typed
-- (account size, risk band) appear in message content/skill_inputs as part of
-- the conversation record — that is logging, not profiling: nothing outside
-- this log stores them, nothing reads them back into a later session.
CREATE TABLE assistant_messages (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id      uuid NOT NULL REFERENCES assistant_sessions(id),
  role            text NOT NULL CHECK (role IN ('user', 'assistant')),
  content         text NOT NULL,
  question_type   text,       -- tagged by classifier: 'sizing' | 'exit_now' | 'personal_advice' | ...
  refused         boolean NOT NULL DEFAULT false,
  skill_invoked   text,       -- 'copy-sizing' | 'key-facts' | 'relevance-filter'
  skill_inputs    jsonb,      -- session-only sizing inputs, preserved in the record
  methodology_id  bigint REFERENCES sizing_methodologies(id),  -- exact formula version applied
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON assistant_messages (session_id, created_at);
CREATE INDEX ON assistant_messages (question_type) WHERE refused;

CREATE TRIGGER assistant_messages_append_only
  BEFORE UPDATE OR DELETE ON assistant_messages
  FOR EACH ROW EXECUTE FUNCTION forbid_change();
-- If the user-deletion question (§5) lands on redact-not-delete, this trigger
-- gains a narrow redaction path then — not before.
CREATE TABLE alert_preferences (
  user_id      uuid NOT NULL REFERENCES users(id),
  fund_id      smallint NOT NULL REFERENCES funds(id),
  trade_alerts boolean NOT NULL DEFAULT true,
  news_alerts  boolean NOT NULL DEFAULT false,
  channel      text NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'push')),
  PRIMARY KEY (user_id, fund_id)
);

-- Everything sent to anyone. Digests and statement deliveries are kinds here —
-- no separate sent-log tables.
CREATE TABLE notifications (
  id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  kind    text NOT NULL CHECK (kind IN ('trade', 'news', 'drawdown', 'digest', 'statement')),
  subject text NOT NULL,
  ref     jsonb NOT NULL DEFAULT '{}',   -- {"trade_card_id":..} / {"news_item_id":..,"symbol":..}
  channel text NOT NULL CHECK (channel IN ('email', 'push')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  -- the dedup indexes below key on these ref fields; a missing key would
  -- silently opt a row out of dedup (NULLs never collide in a plain unique index)
  CONSTRAINT ref_has_dedup_key CHECK (
    (kind <> 'news' OR ref ? 'symbol')
    AND (kind <> 'trade' OR ref ? 'trade_card_id')
  )
);

-- PRD 7.3: max 1 news alert per ticker per user per day — enforced here,
-- not in application code. (timezone('UTC', ...) because a bare ::date cast
-- is session-timezone-dependent and Postgres rejects it in an index.)
CREATE UNIQUE INDEX one_news_alert_per_ticker_per_day
  ON notifications (user_id, (ref->>'symbol'), ((timezone('UTC', sent_at))::date))
  WHERE kind = 'news';

-- The P0 alert gets the same treatment: a retried send can't double-alert.
-- event_id is null for the initial publish alert (PG15 NULLS NOT DISTINCT).
CREATE UNIQUE INDEX one_trade_alert_per_event
  ON notifications (user_id, (ref->>'trade_card_id'), (ref->>'event_id'))
  NULLS NOT DISTINCT
  WHERE kind = 'trade';

-- Agents are code, not rows — one shared enum instead of drifting CHECK lists.
CREATE TYPE agent_name AS ENUM
  ('reconciliation', 'trade_alert', 'news_alert', 'drawdown_watch', 'statement_gen');

-- Bar #2 observability: every agent run, what triggered it, what it did.
CREATE TABLE agent_runs (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  agent       agent_name NOT NULL,
  trigger     text NOT NULL CHECK (trigger IN
                ('schedule', 'on_demand', 'source_event', 'manual_feedback')),  -- PRD 7.2 incl. on-demand refresh
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status      text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'ok', 'error')),
  summary     jsonb NOT NULL DEFAULT '{}'
);

-- PRD 7.4: trader feedback that re-plans agent behavior (thresholds etc.)
CREATE TABLE agent_feedback (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  agent      agent_name NOT NULL,
  user_id    uuid NOT NULL REFERENCES users(id),   -- trader
  feedback   text NOT NULL,
  adjustment jsonb,                                 -- what the agent changed in response
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE statements (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fund_id      smallint NOT NULL REFERENCES funds(id),
  period_month date NOT NULL,                -- first of month
  pdf_path     text NOT NULL,                -- object-storage key, not a blob
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fund_id, period_month)
);
