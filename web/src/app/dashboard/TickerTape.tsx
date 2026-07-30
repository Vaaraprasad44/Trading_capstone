"use client";

import { useEffect, useState } from "react";

// Mock broad-market tape, same presentation-only pattern as data.ts: fixed
// seed values (stable for server prerender), drifted client-side on a timer.
type Quote = { sym: string; name: string; value: number; pct: number };

const SEED: Quote[] = [
  { sym: "SPX", name: "S&P 500", value: 6874.21, pct: 0.42 },
  { sym: "NDX", name: "Nasdaq 100", value: 25310.68, pct: 0.68 },
  { sym: "DJI", name: "Dow Jones", value: 48120.44, pct: -0.11 },
  { sym: "RUT", name: "Russell 2000", value: 2418.9, pct: 0.25 },
  { sym: "VIX", name: "CBOE Volatility", value: 14.82, pct: -3.18 },
  { sym: "US10Y", name: "10-Yr Treasury", value: 4.02, pct: 0.9 },
  { sym: "GOLD", name: "Gold", value: 2987.5, pct: 0.31 },
  { sym: "WTI", name: "Crude Oil", value: 71.64, pct: -1.38 },
  { sym: "BTC", name: "Bitcoin", value: 132402, pct: 2.14 },
  { sym: "DXY", name: "Dollar Index", value: 101.23, pct: -0.18 },
];

const TICK_MS = 2500; // matches the holdings drift interval

function drift(qs: Quote[]): Quote[] {
  return qs.map((q) => {
    const d = (Math.random() + Math.random() + Math.random() - 1.5) * 0.14;
    return {
      ...q,
      pct: Math.max(-9, Math.min(9, q.pct + d)),
      value: q.value * (1 + d / 100),
    };
  });
}

function fmtVal(v: number) {
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function TickerTape() {
  const [quotes, setQuotes] = useState(SEED);

  useEffect(() => {
    const id = setInterval(() => setQuotes(drift), TICK_MS);
    return () => clearInterval(id);
  }, []);

  // the row is rendered twice so the -50% translate loops seamlessly
  const row = (hidden: boolean) => (
    <div className="tape-row" aria-hidden={hidden}>
      {quotes.map((q) => (
        <span className="tape-item" key={q.sym} title={q.name}>
          <b>{q.sym}</b>
          <span className="tape-val">{fmtVal(q.value)}</span>
          <span className={q.pct >= 0 ? "tape-up" : "tape-dn"}>
            {q.pct >= 0 ? "▲" : "▼"} {Math.abs(q.pct).toFixed(2)}%
          </span>
        </span>
      ))}
    </div>
  );

  return (
    <div className="tape">
      <div className="tape-track">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
