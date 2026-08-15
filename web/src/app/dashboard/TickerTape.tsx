"use client";

import { useEffect, useRef, useState } from "react";

// Broad-market tape: live Yahoo quotes via /api/quotes, refreshed every 60s
// (the server's quote-cache TTL). Shows "—" placeholders while loading; the
// static seed values below appear only if the feed itself fails.
type Quote = { sym: string; name: string; value: number | null; pct: number | null };

// Macro anchors shown ahead of the portfolio tickers (^TNX quotes the 10y
// yield directly); the holdings half of the tape comes from /api/holdings,
// which already carries live price + day%.
const ANCHORS: { sym: string; name: string; symbol: string }[] = [
  { sym: "SPX", name: "S&P 500", symbol: "^GSPC" },
  { sym: "NDX", name: "Nasdaq 100", symbol: "^NDX" },
  { sym: "VIX", name: "CBOE Volatility", symbol: "^VIX" },
  { sym: "US10Y", name: "10-Yr Treasury", symbol: "^TNX" },
];

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

// "—" placeholders shown until the first live fetch resolves
const LOADING: Quote[] = ANCHORS.map((t) => ({ sym: t.sym, name: t.name, value: null, pct: null }));

function fmtVal(v: number) {
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function TickerTape() {
  const [quotes, setQuotes] = useState(LOADING);
  const liveRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      // either half may fail without blanking the other
      const [q, h] = await Promise.allSettled([
        fetch(`/api/quotes?symbols=${ANCHORS.map((t) => encodeURIComponent(t.symbol)).join(",")}`).then((r) =>
          r.ok ? (r.json() as Promise<{ price?: number; dayPct?: number | null }[]>) : Promise.reject(),
        ),
        fetch("/api/holdings").then((r) =>
          r.ok ? (r.json() as Promise<{ ticker: string; name: string; ltp: number; day: number | null }[]>) : Promise.reject(),
        ),
      ]);
      const anchors =
        q.status === "fulfilled"
          ? ANCHORS.flatMap((t, i) => {
              const r = q.value[i];
              if (r?.price == null) return []; // one bad symbol shouldn't blank its slot's neighbors
              return [{ sym: t.sym, name: t.name, value: r.price, pct: r.dayPct ?? 0 }];
            })
          : [];
      const holdings =
        h.status === "fulfilled"
          ? h.value.map((row) => ({ sym: row.ticker, name: row.name, value: row.ltp, pct: row.day ?? 0 }))
          : [];
      const next = [...anchors, ...holdings];
      if (cancelled) return;
      if (next.length) {
        liveRef.current = true;
        setQuotes(next);
      } else if (!liveRef.current) {
        // both feeds down: static seed as fallback, never overwriting live data
        setQuotes(SEED);
      }
    };
    load();
    const liveId = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(liveId);
    };
  }, []);

  // the row is rendered twice so the -50% translate loops seamlessly
  const row = (hidden: boolean) => (
    <div className="tape-row" aria-hidden={hidden}>
      {quotes.map((q) => (
        <span className="tape-item" key={q.sym} title={q.name}>
          <b>{q.sym}</b>
          <span className="tape-val">{q.value == null ? "—" : fmtVal(q.value)}</span>
          {q.pct != null && (
            <span className={q.pct >= 0 ? "tape-up" : "tape-dn"}>
              {q.pct >= 0 ? "▲" : "▼"} {Math.abs(q.pct).toFixed(2)}%
            </span>
          )}
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
