"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import "./admin.css";

// ── Types ────────────────────────────────────────────────────────────────────
type Card = {
  id: string;
  status: "draft" | "published" | "closed";
  direction: string;
  entry_price: number;
  position_pct: number;
  thesis_md: string;
  stop_price: number | null;
  exit_rules_md: string | null;
  published_at: string | null;
  entry_verification: "verified" | "flagged" | "pending";
  instruments: { symbol: string; name: string } | null;
  funds: { code: string; name: string } | null;
  trade_card_events: CardEvent[];
};
type CardEvent = { id: number; event_type: string; payload: Record<string, unknown>; note_md: string | null; created_at: string };
type FundCode = "alpha" | "sip" | "swing";

const FUNDS: { code: FundCode; label: string }[] = [
  { code: "alpha", label: "Alpha" },
  { code: "sip",   label: "SIP" },
  { code: "swing", label: "Swing" },
];

// ── Auth gate ────────────────────────────────────────────────────────────────
function useAuth() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const tokenRef = useRef<string>("");

  useEffect(() => {
    const stored = sessionStorage.getItem("admin_token");
    if (stored) { tokenRef.current = stored; setAuthed(true); }
    else setAuthed(false);
  }, []);

  const login = useCallback(async (token: string) => {
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (res.ok) {
      sessionStorage.setItem("admin_token", token);
      tokenRef.current = token;
      setAuthed(true);
      return true;
    }
    return false;
  }, []);

  return { authed, login, token: tokenRef };
}

// ── Login form ───────────────────────────────────────────────────────────────
function LoginForm({ onLogin }: { onLogin: (t: string) => Promise<boolean> }) {
  const [val, setVal] = useState("");
  const [err, setErr] = useState("");
  const submit = async () => {
    const ok = await onLogin(val.trim());
    if (!ok) setErr("Wrong token.");
  };
  return (
    <div className="adm-login">
      <h2>Meridian Admin</h2>
      <input
        type="password"
        placeholder="Admin token"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        autoFocus
      />
      <button onClick={submit}>Unlock</button>
      {err && <p className="adm-err">{err}</p>}
    </div>
  );
}

// ── New card form ─────────────────────────────────────────────────────────────
const EMPTY_FORM = { fund: "swing" as FundCode, symbol: "", direction: "long", entry_price: "", position_pct: "", thesis_md: "", stop_price: "", exit_rules_md: "" };

function CardForm({ onSaved }: { onSaved: () => void }) {
  const [f, setF] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  const save = async (publish: boolean) => {
    setBusy(true); setMsg("");
    try {
      const body: Record<string, unknown> = {
        fund: f.fund,
        symbol: f.symbol.toUpperCase(),
        direction: f.direction,
        entry_price: parseFloat(f.entry_price),
        position_pct: parseFloat(f.position_pct),
        thesis_md: f.thesis_md,
        publish,
      };
      if (f.stop_price)     body.stop_price     = parseFloat(f.stop_price);
      if (f.exit_rules_md)  body.exit_rules_md  = f.exit_rules_md;

      const res = await fetch("/api/trade-cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error ?? "Error"); return; }
      setMsg(publish ? `✓ Published ${f.symbol.toUpperCase()}` : `✓ Saved draft`);
      setF(EMPTY_FORM);
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="adm-card">
      <h3>Publish new card</h3>
      <div className="adm-row">
        <label>Fund</label>
        <div className="adm-radios">
          {FUNDS.map((fd) => (
            <label key={fd.code} className="adm-radio">
              <input type="radio" name="fund" value={fd.code} checked={f.fund === fd.code} onChange={() => setF((p) => ({ ...p, fund: fd.code }))} />
              {fd.label}
            </label>
          ))}
        </div>
      </div>
      <div className="adm-row">
        <label>Ticker</label>
        <input className="adm-input sm" value={f.symbol} onChange={set("symbol")} placeholder="TSLA" />
      </div>
      <div className="adm-row">
        <label>Direction</label>
        <div className="adm-radios">
          {["long", "short"].map((d) => (
            <label key={d} className="adm-radio">
              <input type="radio" name="dir" value={d} checked={f.direction === d} onChange={() => setF((p) => ({ ...p, direction: d }))} />
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </label>
          ))}
        </div>
      </div>
      <div className="adm-row">
        <label>Entry price</label>
        <input className="adm-input sm" type="number" step="0.01" value={f.entry_price} onChange={set("entry_price")} placeholder="179.55" />
      </div>
      <div className="adm-row">
        <label>Position % of fund</label>
        <input className="adm-input sm" type="number" step="0.1" min="0" max="100" value={f.position_pct} onChange={set("position_pct")} placeholder="4" />
      </div>
      <div className="adm-row adm-row--col">
        <label>Thesis</label>
        <textarea className="adm-ta" rows={3} value={f.thesis_md} onChange={set("thesis_md")} placeholder="Why we're in this trade…" />
      </div>
      <div className="adm-row">
        <label>Stop price <span className="adm-req">(required to publish)</span></label>
        <input className="adm-input sm" type="number" step="0.01" value={f.stop_price} onChange={set("stop_price")} placeholder="165.00" />
      </div>
      <div className="adm-row adm-row--col">
        <label>Exit rules <span className="adm-req">(required to publish)</span></label>
        <textarea className="adm-ta" rows={2} value={f.exit_rules_md} onChange={set("exit_rules_md")} placeholder="Target $210; exit on close below stop." />
      </div>
      <div className="adm-actions">
        <button className="adm-btn" onClick={() => save(false)} disabled={busy}>Save draft</button>
        <button className="adm-btn adm-btn--primary" onClick={() => save(true)} disabled={busy}>Publish now</button>
      </div>
      {msg && <p className="adm-msg">{msg}</p>}
    </section>
  );
}

// ── Event append drawer (inside a card row) ───────────────────────────────────
const EVENT_TYPES = ["stop_moved", "partial_exit", "closed", "note"] as const;
type EventType = typeof EVENT_TYPES[number];

function EventDrawer({ cardId, onDone }: { cardId: string; onDone: () => void }) {
  const [type, setType] = useState<EventType>("note");
  const [fields, setFields] = useState({ new_stop: "", exit_price: "", qty_pct: "", note_md: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const setF = (k: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields((p) => ({ ...p, [k]: e.target.value }));

  const submit = async () => {
    setBusy(true); setMsg("");
    const payload: Record<string, unknown> = {};
    if (type === "stop_moved")   payload.new_stop   = parseFloat(fields.new_stop);
    if (type === "partial_exit") { payload.exit_price = parseFloat(fields.exit_price); payload.qty_pct = parseFloat(fields.qty_pct); }
    if (type === "closed")       payload.exit_price = parseFloat(fields.exit_price);

    const res = await fetch(`/api/trade-cards/${cardId}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event_type: type, payload, note_md: fields.note_md || undefined }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg(data.error ?? "Error"); setBusy(false); return; }
    setMsg("✓ Event saved");
    setTimeout(() => { onDone(); }, 800);
    setBusy(false);
  };

  return (
    <div className="adm-drawer">
      <div className="adm-row">
        <label>Event type</label>
        <select className="adm-input sm" value={type} onChange={(e) => setType(e.target.value as EventType)}>
          {EVENT_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
        </select>
      </div>
      {type === "stop_moved" && (
        <div className="adm-row">
          <label>New stop</label>
          <input className="adm-input sm" type="number" step="0.01" value={fields.new_stop} onChange={setF("new_stop")} placeholder="170.00" />
        </div>
      )}
      {(type === "partial_exit" || type === "closed") && (
        <div className="adm-row">
          <label>Exit price</label>
          <input className="adm-input sm" type="number" step="0.01" value={fields.exit_price} onChange={setF("exit_price")} placeholder="205.00" />
        </div>
      )}
      {type === "partial_exit" && (
        <div className="adm-row">
          <label>% of position exited</label>
          <input className="adm-input sm" type="number" step="1" min="1" max="99" value={fields.qty_pct} onChange={setF("qty_pct")} placeholder="50" />
        </div>
      )}
      <div className="adm-row adm-row--col">
        <label>Note (optional)</label>
        <textarea className="adm-ta" rows={2} value={fields.note_md} onChange={setF("note_md")} placeholder="Optional context…" />
      </div>
      <div className="adm-actions">
        <button className="adm-btn adm-btn--primary" onClick={submit} disabled={busy}>Save event</button>
      </div>
      {msg && <p className="adm-msg">{msg}</p>}
    </div>
  );
}

// ── Card row (used for both published and draft lists) ────────────────────────
function CardRow({ card, onRefresh }: { card: Card; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [pubMsg, setPubMsg] = useState("");

  const publish = async () => {
    setPublishing(true); setPubMsg("");
    const res = await fetch(`/api/trade-cards/${card.id}/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!res.ok) { setPubMsg(data.error ?? "Error"); setPublishing(false); return; }
    setPubMsg("✓ Published");
    setTimeout(onRefresh, 600);
    setPublishing(false);
  };

  const stamp = card.entry_verification === "verified" ? "✓" : card.entry_verification === "flagged" ? "⚠" : "…";
  const stampClass = card.entry_verification === "verified" ? "adm-stamp--ok" : card.entry_verification === "flagged" ? "adm-stamp--warn" : "adm-stamp--pend";

  return (
    <div className="adm-card-row">
      <div className="adm-card-row__head">
        <span className="adm-ticker">{card.instruments?.symbol ?? "?"}</span>
        <span className="adm-badge">{card.funds?.code}</span>
        <span className="adm-dir">{card.direction}</span>
        <span className="adm-price">${Number(card.entry_price).toFixed(2)}</span>
        {card.stop_price && <span className="adm-stop">stop ${Number(card.stop_price).toFixed(2)}</span>}
        <span className={`adm-stamp ${stampClass}`}>{stamp} {card.entry_verification}</span>
        <span className="adm-pct">{Number(card.position_pct).toFixed(1)}%</span>

        {card.status === "draft" ? (
          <>
            <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={publish} disabled={publishing}>Publish</button>
            {pubMsg && <span className="adm-msg">{pubMsg}</span>}
          </>
        ) : card.status === "published" ? (
          <button className="adm-btn adm-btn--sm" onClick={() => setOpen((v) => !v)}>
            {open ? "Close ×" : "Add event ＋"}
          </button>
        ) : (
          <span className="adm-badge adm-badge--closed">closed</span>
        )}
      </div>

      <p className="adm-thesis">{card.thesis_md}</p>

      {card.trade_card_events.length > 0 && (
        <div className="adm-events">
          {card.trade_card_events.map((ev) => (
            <div key={ev.id} className="adm-event">
              <span className="adm-event-type">{ev.event_type.replace("_", " ")}</span>
              <span className="adm-event-date">{new Date(ev.created_at).toLocaleDateString()}</span>
              {ev.note_md && <span className="adm-event-note">{ev.note_md}</span>}
            </div>
          ))}
        </div>
      )}

      {open && (
        <EventDrawer cardId={card.id} onDone={() => { setOpen(false); onRefresh(); }} />
      )}
    </div>
  );
}

// ── Main admin page ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const { authed, login } = useAuth();
  const [published, setPublished] = useState<Card[]>([]);
  const [drafts,    setDrafts]    = useState<Card[]>([]);
  const [closed,    setClosed]    = useState<Card[]>([]);

  const load = useCallback(async () => {
    const [pub, dra, clo] = await Promise.all([
      fetch("/api/trade-cards?status=published").then((r) => r.json()),
      fetch("/api/trade-cards?status=draft").then((r) => r.json()),
      fetch("/api/trade-cards?status=closed").then((r) => r.json()),
    ]);
    setPublished(Array.isArray(pub) ? pub : []);
    setDrafts(Array.isArray(dra) ? dra : []);
    setClosed(Array.isArray(clo) ? clo : []);
  }, []);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  if (authed === null) return null;
  if (!authed) return <LoginForm onLogin={login} />;

  return (
    <div className="adm">
      <div className="adm-header">
        <h1>Meridian — Trader Admin</h1>
        <a href="/dashboard" className="adm-link">← Dashboard</a>
      </div>

      <CardForm onSaved={load} />

      <section className="adm-card">
        <h3>Open positions ({published.length})</h3>
        {published.length === 0
          ? <p className="adm-empty">No published cards yet.</p>
          : published.map((c) => <CardRow key={c.id} card={c} onRefresh={load} />)}
      </section>

      {drafts.length > 0 && (
        <section className="adm-card">
          <h3>Drafts ({drafts.length})</h3>
          {drafts.map((c) => <CardRow key={c.id} card={c} onRefresh={load} />)}
        </section>
      )}

      {closed.length > 0 && (
        <section className="adm-card">
          <h3>Closed trades ({closed.length})</h3>
          {closed.map((c) => <CardRow key={c.id} card={c} onRefresh={load} />)}
        </section>
      )}
    </div>
  );
}
