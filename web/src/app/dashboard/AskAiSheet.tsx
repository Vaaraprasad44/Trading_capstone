"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { activity, infoFor, usd, type ComputedHolding } from "./data";

// Right-docked "Ask AI" sheet. Presentation-only: `answer()` is a rule-based
// mock brain that computes real numbers from the mock portfolio (allocation,
// activity, copy-sizing math). Swap `answer()` for the Agent SDK runner when
// the AI phase lands — the sheet UX stays identical.

type Item =
  | { id: number; kind: "user" | "ai"; node: ReactNode }
  | { id: number; kind: "divider"; node: ReactNode };

type Ctx = {
  ticker: string | null;
  holdings: ComputedHolding[];
  fundLabel: string;
  capital: number | null; // remembered from earlier messages
};

const pctf = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

/* ---------- mock brain ---------- */

function parseCapital(raw: string): number | null {
  const q = raw.replace(/,/g, "");
  let m = q.match(/\$\s*(\d+(?:\.\d+)?)\s*([kK])?/);
  if (!m) m = q.match(/\b(\d+(?:\.\d+)?)\s*[kK]\b/);
  if (!m) {
    const ctx = q.match(/(?:have|capital|portfolio|total|worth|invest)\D{0,12}(\d{3,})/i);
    if (ctx) m = [ctx[0], ctx[1], ""] as unknown as RegExpMatchArray;
  }
  if (!m) return null;
  const n = parseFloat(m[1]) * (/k/i.test(m[2] ?? "") ? 1000 : 1);
  return n >= 100 ? n : null;
}

function findTicker(q: string, holdings: ComputedHolding[]): string | null {
  const words = q.toUpperCase();
  for (const h of holdings) {
    if (new RegExp(`\\b${h.ticker}\\b`).test(words) || words.includes(h.name.toUpperCase())) return h.ticker;
  }
  return null;
}

function SizeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="ai-size-row">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function sizingAnswer(capital: number, ticker: string | null, ctx: Ctx): ReactNode {
  const total = ctx.holdings.reduce((s, h) => s + h.presentValue, 0);
  if (ticker) {
    const h = ctx.holdings.find((x) => x.ticker === ticker)!;
    const dollars = (h.allocation / 100) * capital;
    const shares = dollars / h.ltp;
    const trade = activity.find((a) => a.ticker === ticker);
    const tradeVal = trade ? parseFloat(trade.price.replace(/[$,]/g, "")) * parseFloat(trade.qty) : null;
    return (
      <>
        <p>
          Matching our book: <b>{ticker}</b> is <b>{h.allocation.toFixed(2)}%</b> of the {ctx.fundLabel} (
          {usd(h.presentValue)} of {usd(total)}). Scaled to your <b>{usd(capital)}</b>:
        </p>
        <div className="ai-size-card">
          <SizeRow label={`Your ${ticker} position`} value={usd(dollars)} />
          <SizeRow label={`≈ shares at ${usd(h.ltp)} LTP`} value={shares.toFixed(2)} />
          <SizeRow label="Target weight (same as ours)" value={`${h.allocation.toFixed(2)}%`} />
          {trade && tradeVal != null && (
            <SizeRow
              label={`Our last trade (${trade.action} ${trade.qty} on ${trade.date}) scaled to you`}
              value={usd(tradeVal * (capital / total))}
            />
          )}
        </div>
        <p className="ai-small">I&apos;ll remember your {usd(capital)} — ask about any other holding and I&apos;ll size it instantly.</p>
      </>
    );
  }
  const top = [...ctx.holdings].sort((a, b) => b.allocation - a.allocation).slice(0, 5);
  return (
    <>
      <p>
        Mirroring the {ctx.fundLabel} ({usd(total)}) at your <b>{usd(capital)}</b> — top 5 positions:
      </p>
      <div className="ai-size-card">
        {top.map((h) => (
          <SizeRow key={h.ticker} label={`${h.ticker} · ${h.allocation.toFixed(1)}%`} value={usd((h.allocation / 100) * capital)} />
        ))}
      </div>
      <p className="ai-small">Ask about a specific stock for share counts and our latest trade scaled to you.</p>
    </>
  );
}

function answer(q: string, ctx: Ctx): { node: ReactNode; capital: number | null } {
  const lq = q.toLowerCase();
  const mentioned = findTicker(q, ctx.holdings);
  const ticker = mentioned ?? ctx.ticker;
  const h = ticker ? ctx.holdings.find((x) => x.ticker === ticker) : undefined;
  const said = parseCapital(q);
  const capital = said ?? ctx.capital;
  const wantsSize = /siz|how much|for me|my amount|match|adjust|mirror|copy|invest/.test(lq) || said != null;

  if (wantsSize) {
    if (capital == null) {
      return {
        node: <p>Happy to size it for you — what&apos;s your total capital? (e.g. &quot;I have $5k&quot;)</p>,
        capital,
      };
    }
    return { node: sizingAnswer(capital, ticker, ctx), capital };
  }

  if (h && /why|thesis|reason|rationale/.test(lq)) {
    const info = infoFor(h.ticker);
    return {
      capital,
      node: (
        <>
          <p>
            <b>{h.ticker}</b> ({info.sector}) is a {h.allocation.toFixed(1)}% position, currently {pctf(h.pnlPct)} on
            cost. The thesis:
          </p>
          <ul>{info.facts.map((f, i) => <li key={i}>{f}</li>)}</ul>
        </>
      ),
    };
  }

  if (/recent|activit|bought|sold|buy|sell|trade|summar/.test(lq)) {
    const rows = ticker ? activity.filter((a) => a.ticker === ticker) : activity;
    if (!rows.length) {
      return {
        capital,
        node: (
          <p>
            No trades in <b>{ticker}</b> recently — it&apos;s been a hold. Latest fund activity:{" "}
            {activity.map((a) => `${a.action} ${a.qty} ${a.ticker} (${a.date})`).join("; ")}.
          </p>
        ),
      };
    }
    return {
      capital,
      node: (
        <>
          <p>{ticker ? `Recent ${ticker} activity:` : "Recent fund activity:"}</p>
          <ul>
            {rows.map((a, i) => (
              <li key={i}>
                <b>{a.action}</b> {a.qty} {a.ticker} @ {a.price} on {a.date} → now {a.alloc} of the book
              </li>
            ))}
          </ul>
        </>
      ),
    };
  }

  if (/alloc|weight|percent|concentrat|largest|biggest/.test(lq)) {
    const sorted = [...ctx.holdings].sort((a, b) => b.allocation - a.allocation);
    if (h) {
      const rank = sorted.findIndex((x) => x.ticker === h.ticker) + 1;
      return {
        capital,
        node: (
          <p>
            <b>{h.ticker}</b> is <b>{h.allocation.toFixed(2)}%</b> of the {ctx.fundLabel} — {usd(h.presentValue)},
            position #{rank} of {sorted.length} by weight.
          </p>
        ),
      };
    }
    const top3 = sorted.slice(0, 3);
    const c = top3.reduce((s, x) => s + x.allocation, 0);
    return {
      capital,
      node: (
        <p>
          Top weights: {top3.map((x) => `${x.ticker} ${x.allocation.toFixed(1)}%`).join(", ")} — together{" "}
          {c.toFixed(1)}% of the book.
        </p>
      ),
    };
  }

  if (h) {
    return {
      capital,
      node: (
        <p>
          <b>{h.ticker}</b> ({h.name}): {h.qty.toFixed(2)} shares, avg {usd(h.avg)}, LTP {usd(h.ltp)},{" "}
          {pctf(h.pnlPct)} P&amp;L, {h.allocation.toFixed(2)}% of the fund. Ask me <i>why we hold it</i>, about{" "}
          <i>recent trades</i>, or <i>size it for your capital</i>.
        </p>
      ),
    };
  }
  return {
    capital,
    node: (
      <p>
        I can explain <i>why a trade was made</i>, show <i>recent buys and sells</i>, break down <i>allocations</i>,
        or <i>size our positions to your capital</i>. Click any holding row to focus on that stock.
      </p>
    ),
  };
}

/* ---------- sheet ---------- */

function suggestions(ticker: string | null): string[] {
  if (ticker) {
    return [
      `Why did we take the ${ticker} position?`,
      `Any recent buys or sells in ${ticker}?`,
      `What's ${ticker}'s allocation in the fund?`,
      `I have $5k — what's my right size for ${ticker}?`,
    ];
  }
  return [
    "What did the fund buy or sell recently?",
    "Which holdings have the largest allocation?",
    "Am I too concentrated in any single stock?",
    "I have $5k — size the portfolio for me",
  ];
}

export function AskAiSheet({ open, ticker, holdings, fundLabel, pending, onClose }: {
  open: boolean;
  ticker: string | null;
  holdings: ComputedHolding[];
  fundLabel: string;
  pending: { text: string; id: number } | null;
  onClose: () => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const capitalRef = useRef<number | null>(null);
  const idRef = useRef(1);
  const lastTickerRef = useRef<string | null>(null);
  const lastPendingRef = useRef(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<{ ticker: string | null; holdings: ComputedHolding[]; fundLabel: string }>({ ticker, holdings, fundLabel });
  ctxRef.current = { ticker, holdings, fundLabel };

  const push = (item: Omit<Item, "id">) =>
    setItems((xs) => [...xs, { ...item, id: idRef.current++ } as Item]);

  const submit = (text: string) => {
    const q = text.trim();
    if (!q) return;
    push({ kind: "user", node: q });
    setInput("");
    setTyping(true);
    setTimeout(() => {
      const c = ctxRef.current;
      const res = answer(q, { ...c, capital: capitalRef.current });
      capitalRef.current = res.capital;
      setTyping(false);
      push({ kind: "ai", node: res.node });
    }, 700 + Math.random() * 600);
  };

  // stock context switch → divider in an ongoing thread
  useEffect(() => {
    if (!open) return;
    if (ticker && lastTickerRef.current && ticker !== lastTickerRef.current && items.length > 0) {
      push({ kind: "divider", node: <>Now discussing <b>{ticker}</b></> });
    }
    if (ticker) lastTickerRef.current = ticker;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, open]);

  // questions injected from elsewhere in the app (Ask boxes, chips)
  useEffect(() => {
    if (pending && pending.id !== lastPendingRef.current) {
      lastPendingRef.current = pending.id;
      submit(pending.text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [items, typing]);

  const reset = () => {
    setItems([]);
    setTyping(false);
    capitalRef.current = null;
  };

  return (
    <aside className={"ai-sheet" + (open ? " open" : "")} aria-hidden={!open}>
      <div className="ai-head">
        <h3>✦ Ask AI {ticker && <span className="ai-scope">{ticker}</span>}</h3>
        <button className="ai-icon-btn" title="Start new conversation" onClick={reset}>＋</button>
        <button className="ai-icon-btn" title="Close" onClick={onClose}>✕</button>
      </div>

      <div className="ai-body" ref={bodyRef}>
        {items.length === 0 && !typing ? (
          <div className="ai-hi">
            <h2>Hi!</h2>
            <p>
              {ticker
                ? <>What would you like to know about <b>{ticker}</b>?</>
                : <>How can I help you with the {fundLabel} today?</>}
            </p>
            <div className="ai-cards">
              {suggestions(ticker).map((s) => (
                <button key={s} className="ai-card" onClick={() => submit(s)}>{s}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="ai-thread">
            {items.map((it) =>
              it.kind === "divider" ? (
                <div key={it.id} className="ai-divider"><span>{it.node}</span></div>
              ) : (
                <div key={it.id} className={`ai-msg ${it.kind}`}>{it.node}</div>
              ),
            )}
            {typing && (
              <div className="ai-msg ai ai-typing">
                <span /><span /><span />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="ai-input-row">
        <input
          type="text"
          placeholder={ticker ? `Ask about ${ticker}…` : "Ask anything…"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit(input)}
        />
        <button className="ai-send" onClick={() => submit(input)} title="Send">↑</button>
      </div>
      <div className="ai-note">Educational demo — not investment advice. AI can make mistakes.</div>
    </aside>
  );
}
