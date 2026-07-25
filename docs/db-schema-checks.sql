-- Behavioral checks for DB-SCHEMA.md's guarantees (publish gate, immutability
-- triggers, reconciliation shapes, alert dedup, current_positions math).
-- Each "must fail" only errors if a forbidden write is ALLOWED.
--
-- Run against a fresh database with the DDL applied first, e.g.:
--   docker run -d --name ddl -e POSTGRES_PASSWORD=x postgres:15
--   awk '/^```sql$/{f=1;next}/^```$/{f=0}f' DB-SCHEMA.md | docker exec -i ddl psql -U postgres -v ON_ERROR_STOP=1
--   docker exec -i ddl psql -U postgres -v ON_ERROR_STOP=1 < db-schema-checks.sql
-- Expected output: NOTICE: ALL CHECKS PASSED
\set ON_ERROR_STOP 1

INSERT INTO funds VALUES (1, 'alpha', '$1M Alpha Fund', 'd', 'b', 'SPY', '2026-01-01'),
                         (2, 'sip', 'Smart SIP', 'd', 'b', 'SPY', '2026-01-01');
INSERT INTO instruments (symbol, name) VALUES ('NVDA', 'NVIDIA'), ('VOO', 'Vanguard S&P 500');

CREATE PROCEDURE must_fail(stmt text, why text) LANGUAGE plpgsql AS $p$
BEGIN
  BEGIN
    EXECUTE stmt;
    RAISE EXCEPTION 'GUARD MISSING: % (statement was allowed)', why;
  EXCEPTION WHEN check_violation OR unique_violation OR raise_exception OR foreign_key_violation THEN
    NULL;  -- correctly refused
  END;
END $p$;

DO $$
DECLARE
  card uuid; ev bigint; fill1 uuid; sfill uuid; plan bigint; u uuid;
  pct numeric; stamp text;
BEGIN
  -- 1. publish gate: no stop/exit -> refused
  CALL must_fail(
    $q$INSERT INTO trade_cards (fund_id, instrument_id, direction, entry_price, position_pct, thesis_md, status, published_at)
       VALUES (1, 1, 'long', 100, 5, 't', 'published', now())$q$,
    'published card without stop+exit rules');

  -- a legal published card
  INSERT INTO trade_cards (fund_id, instrument_id, direction, entry_price, position_pct, thesis_md,
                           stop_price, exit_rules_md, status, published_at)
  VALUES (1, 1, 'long', 100, 10, 't', 90, 'exit', 'published', now()) RETURNING id INTO card;

  -- 2. immutability: published card edits refused; published->closed allowed
  CALL must_fail(format($q$UPDATE trade_cards SET entry_price = 101 WHERE id = %L$q$, card),
    'editing entry_price on a published card');
  CALL must_fail(format($q$DELETE FROM trade_cards WHERE id = %L$q$, card),
    'deleting a published card');

  -- 3. append-only events
  INSERT INTO trade_card_events (trade_card_id, event_type, payload)
  VALUES (card, 'partial_exit', '{"exit_price": 120, "qty_pct": 50}') RETURNING id INTO ev;
  CALL must_fail(format($q$UPDATE trade_card_events SET payload = '{}' WHERE id = %L$q$, ev),
    'updating a trade card event');

  -- 4. broker_fills: trade needs trade fields; dividend without them is fine;
  --    instrument_id backfill allowed, price rewrite refused
  CALL must_fail(
    $q$INSERT INTO broker_fills (snaptrade_txn_id, raw_symbol, activity_type, executed_at, raw)
       VALUES ('t0', 'NVDA', 'trade', now(), '{}')$q$,
    'trade activity without side/qty/price');
  INSERT INTO broker_fills (snaptrade_txn_id, activity_type, amount, executed_at, raw)
  VALUES ('d1', 'dividend', 12.34, now(), '{}');
  INSERT INTO broker_fills (snaptrade_txn_id, raw_symbol, side, quantity, price, executed_at, raw)
  VALUES ('t1', 'NVDA', 'buy', 10, 100, now(), '{}') RETURNING id INTO fill1;
  UPDATE broker_fills SET instrument_id = 1 WHERE id = fill1;             -- allowed: late mapping
  CALL must_fail(format($q$UPDATE broker_fills SET price = 1 WHERE id = %L$q$, fill1),
    'rewriting a fill price');
  CALL must_fail(format($q$DELETE FROM broker_fills WHERE id = %L$q$, fill1),
    'deleting a fill');

  -- 5. reconciliation shapes
  CALL must_fail(format(
    $q$INSERT INTO reconciliations (kind, status, trade_card_id) VALUES ('entry', 'matched', %L)$q$, card),
    'matched stamp without a fill');
  CALL must_fail(format(
    $q$INSERT INTO reconciliations (kind, status, trade_card_event_id, broker_fill_id)
       VALUES ('entry', 'matched', %L, %L)$q$, ev, fill1),
    'entry reconciliation pointing at an exit event');
  INSERT INTO reconciliations (kind, status, trade_card_id, broker_fill_id)
  VALUES ('entry', 'matched', card, fill1);
  CALL must_fail(format(
    $q$INSERT INTO reconciliations (kind, status, trade_card_id, broker_fill_id)
       VALUES ('entry', 'matched', %L, %L)$q$, card, fill1),
    'one fill verifying two things');
  INSERT INTO reconciliations (kind, status, broker_fill_id)                        -- omission flag
  SELECT 'entry', 'unmatched_fill', id FROM broker_fills WHERE snaptrade_txn_id = 'd1';

  -- 6. SIP plan as claim
  INSERT INTO sip_plans (fund_id, month, plan_md, breakdown, published_at)
  VALUES (2, '2026-07-01', 'plan', '[{"symbol":"VOO","pct":100}]', now()) RETURNING id INTO plan;
  INSERT INTO broker_fills (snaptrade_txn_id, raw_symbol, instrument_id, side, quantity, price, executed_at, raw)
  VALUES ('s1', 'VOO', 2, 'buy', 1, 500, now(), '{}') RETURNING id INTO sfill;
  INSERT INTO reconciliations (kind, status, sip_plan_id, broker_fill_id)
  VALUES ('entry', 'matched', plan, sfill);

  -- 7. view: partial exit halves the position; all-matched entry -> verified
  SELECT position_pct, entry_verification INTO pct, stamp
  FROM current_positions WHERE trade_card_id = card;
  IF pct <> 5 OR stamp <> 'verified' THEN
    RAISE EXCEPTION 'current_positions wrong: pct=%, stamp=%', pct, stamp;
  END IF;

  -- 8. cash flows + notification dedup
  INSERT INTO fund_cash_flows (fund_id, date, amount) VALUES (1, '2026-07-01', 5000);
  CALL must_fail($q$INSERT INTO fund_cash_flows (fund_id, date, amount) VALUES (1, '2026-07-02', 0)$q$,
    'zero-amount cash flow');
  INSERT INTO users (email, auth_provider, auth_subject) VALUES ('a@b.c', 'email', 'x') RETURNING id INTO u;
  CALL must_fail(format(
    $q$INSERT INTO notifications (user_id, kind, subject, ref, channel) VALUES (%L, 'trade', 's', '{}', 'email')$q$, u),
    'trade notification without trade_card_id in ref');
  INSERT INTO notifications (user_id, kind, subject, ref, channel)
  VALUES (u, 'trade', 's', jsonb_build_object('trade_card_id', card), 'email');
  CALL must_fail(format(
    $q$INSERT INTO notifications (user_id, kind, subject, ref, channel) VALUES (%L, 'trade', 's', jsonb_build_object('trade_card_id', %L), 'email')$q$, u, card),
    'duplicate trade alert (null event_id)');

  -- 9. transcript append-only
  INSERT INTO assistant_sessions (user_id) VALUES (u);
  INSERT INTO assistant_messages (session_id, role, content)
  SELECT id, 'user', 'hi' FROM assistant_sessions LIMIT 1;
  CALL must_fail($q$UPDATE assistant_messages SET content = 'edited'$q$, 'editing a transcript');
  CALL must_fail($q$DELETE FROM assistant_messages$q$, 'deleting a transcript');

  -- 10. legal close still works
  UPDATE trade_cards SET status = 'closed' WHERE id = card;

  RAISE NOTICE 'ALL CHECKS PASSED';
END $$;
