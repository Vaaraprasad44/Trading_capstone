"use client";

import { useEffect, useRef, useState } from "react";
import type { ComputedHolding } from "./data";

// Right-docked "Ask AI" sheet. Previously had a rule-based mock brain;
// now calls /api/assistant which classifies → guards → computes → LLM.
// The UX (thread, typing indicator, suggestions, dividers) is unchanged.

type Item =
  | { id: number; kind: "user" | "ai"; text: string }
  | { id: number; kind: "divider"; text: string };

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
    "I have $5k — size the portfolio for me",
    "What's the sizing methodology for this fund?",
  ];
}

export function AskAiSheet({
  open,
  ticker,
  holdings,
  fund = "swing",
  pending,
  onClose,
}: {
  open: boolean;
  ticker: string | null;
  holdings: ComputedHolding[];
  fund?: "alpha" | "sip" | "swing";
  pending: { text: string; id: number } | null;
  onClose: () => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const sessionRef  = useRef<string | undefined>(undefined);
  const idRef       = useRef(1);
  const lastTickerRef   = useRef<string | null>(null);
  const lastPendingRef  = useRef(0);
  const tickerRef   = useRef(ticker);
  const holdingsRef = useRef(holdings);
  const bodyRef     = useRef<HTMLDivElement>(null);

  // Keep refs in sync so submit() closures always read fresh values
  tickerRef.current   = ticker;
  holdingsRef.current = holdings;

  const push = (item: Omit<Item, "id">) =>
    setItems((xs) => [...xs, { ...item, id: idRef.current++ } as Item]);

  const submit = async (text: string) => {
    const q = text.trim();
    if (!q || typing) return;
    push({ kind: "user", text: q });
    setInput("");
    setTyping(true);

    try {
      const focused = tickerRef.current
        ? holdingsRef.current.find((h) => h.ticker === tickerRef.current)
        : undefined;

      const res = await fetch("/api/assistant", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question:    q,
          session_id:  sessionRef.current,
          fund,
          holdings: holdingsRef.current.map((h) => ({
            ticker:     h.ticker,
            name:       h.name,
            allocation: h.allocation,
            ltp:        h.ltp,
            avg:        h.avg,
            qty:        h.qty,
          })),
          // Pass the focused holding's avg as entry proxy; stop unknown until
          // trade cards are threaded through (Phase 5 admin wires this)
          ...(focused ? { entry_price: focused.avg } : {}),
        }),
      });

      const data: { text: string; session_id?: string; refused: boolean; disclaimer: string } =
        await res.json();

      if (data.session_id) sessionRef.current = data.session_id;
      push({ kind: "ai", text: data.text });
    } catch {
      push({ kind: "ai", text: "Something went wrong — please try again." });
    } finally {
      setTyping(false);
    }
  };

  // Divider when the focused stock changes mid-conversation
  useEffect(() => {
    if (!open) return;
    if (ticker && lastTickerRef.current && ticker !== lastTickerRef.current && items.length > 0) {
      push({ kind: "divider", text: `Now discussing ${ticker}` });
    }
    if (ticker) lastTickerRef.current = ticker;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, open]);

  // Questions injected from chips / Ask boxes elsewhere in the app
  useEffect(() => {
    if (pending && pending.id !== lastPendingRef.current) {
      lastPendingRef.current = pending.id;
      submit(pending.text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  // Keyboard shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [items, typing]);

  const reset = () => {
    setItems([]);
    setTyping(false);
    sessionRef.current = undefined; // new session on next message
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
                : <>How can I help you with the {fund === "swing" ? "Swing Fund" : fund} today?</>}
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
                <div key={it.id} className="ai-divider"><span>{it.text}</span></div>
              ) : (
                <div key={it.id} className={`ai-msg ${it.kind}`} style={{ whiteSpace: "pre-wrap" }}>
                  {it.text}
                </div>
              )
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
          onKeyDown={(e) => e.key === "Enter" && !typing && submit(input)}
        />
        <button className="ai-send" onClick={() => submit(input)} disabled={typing} title="Send">↑</button>
      </div>
    </aside>
  );
}
