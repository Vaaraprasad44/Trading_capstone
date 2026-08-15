"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { BannerStrip } from "@/app/briefing/data";
import { alphaHoldings, computeHoldings, sipHoldings, swingClosed, swingOpen, type FundKey, type Holding } from "./data";
import { AlphaView, Hero, SipView, StockDrawer, SwingView } from "./views";
import { BreadthPanel } from "./BreadthCore";
import { TickerTape } from "./TickerTape";
import { AskAiSheet } from "./AskAiSheet";
import "./dashboard.css";

const FUNDS: { key: FundKey; label: string }[] = [
  { key: "alpha", label: "Alpha Fund" },
  { key: "sip", label: "Smart SIP" },
  { key: "swing", label: "Swing Trading" },
];

function drift(holdings: Holding[]): Holding[] {
  const t = Date.now() / 1000;
  return holdings.map((h, i) => ({ ...h, ltp: Math.max(1, h.ltp + Math.sin((t + i) * 0.9) * h.ltp * 0.0008) }));
}

export default function Dashboard({ banner }: { banner: BannerStrip }) {
  const [fund, setFund] = useState<FundKey>("alpha");
  const [themeTick, setThemeTick] = useState(0);
  const [stock, setStock] = useState<string | null>(null);
  // null = still loading live data — Alpha renders a loading card, never the
  // mock; the mock only lands as fallback if the feed itself fails.
  const [alpha, setAlpha] = useState<Holding[] | null>(null);
  const [alphaLive, setAlphaLive] = useState(false);
  const [sip, setSip] = useState(sipHoldings);
  const [open, setOpen] = useState(swingOpen);

  // Ask AI sheet: one common agent for the fund, opened from the table header
  // button or any Ask box — not scoped to a single row
  const [aiOpen, setAiOpen] = useState(false);
  const [pendingQ, setPendingQ] = useState<{ text: string; id: number } | null>(null);

  // Alpha = the connected SnapTrade account: broker qty/avg, Yahoo ltp/day%.
  // Poll cadence matches the server's 60s quote cache; the mock data stays if
  // the feed is unconfigured (503) or down.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/holdings");
        if (!res.ok) throw new Error(String(res.status));
        const rows: Holding[] = await res.json();
        if (!cancelled && rows.length) {
          setAlpha(rows);
          setAlphaLive(true);
        }
      } catch {
        // feed down/unconfigured: mock fallback, but never overwrite live data
        if (!cancelled) setAlpha((cur) => cur ?? alphaHoldings);
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // fake price tick, as in the prototype — mock funds only; live alpha
  // updates come from the poll above
  useEffect(() => {
    const id = setInterval(() => {
      if (!alphaLive) setAlpha((cur) => (cur ? drift(cur) : cur));
      setSip(drift);
      setOpen(drift);
    }, 2500);
    return () => clearInterval(id);
  }, [alphaLive]);

  // Esc closes the AI sheet and the drill-down drawer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAiOpen(false);
        setStock(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const openStock = useCallback((t: string) => setStock(t), []);
  const openAi = useCallback(() => setAiOpen(true), []);

  const ask = useCallback((q: string) => {
    setAiOpen(true);
    setPendingQ((p) => ({ text: q, id: (p?.id ?? 0) + 1 }));
  }, []);

  const fundHoldings = fund === "alpha" ? (alpha ?? []) : fund === "sip" ? sip : open;
  const fundLabel = FUNDS.find((f) => f.key === fund)!.label;

  return (
    <div className={"dash" + (aiOpen ? " ai-open" : "")}>
      <nav className="nav">
        <div className="wrap nav-inner">
          <Link className="logo" href="/">
            <div className="logo-mark">M</div> Meridian Capital
          </Link>
          <div className="nav-right">
            <div className="fund-switch">
              {FUNDS.map((f) => (
                <button key={f.key} className={fund === f.key ? "on" : ""} onClick={() => setFund(f.key)}>
                  {f.label}
                </button>
              ))}
            </div>
            <ThemeToggle className="icon-btn" onToggle={() => setThemeTick((t) => t + 1)} />
            <div className="avatar">PR</div>
          </div>
        </div>
      </nav>

      <div className="wrap">
        <div className="hero-row">
          <div className="hero-col">
            <Hero fund={fund} />
            <TickerTape />
          </div>
          <BreadthPanel />
        </div>
        {fund === "alpha" &&
          (alpha ? (
            <AlphaView holdings={alpha} banner={banner} themeTick={themeTick} onOpen={openStock} onAsk={ask} onAskAi={openAi} />
          ) : (
            <div className="card section" style={{ marginTop: 18, padding: 28, textAlign: "center", color: "var(--text-2)" }}>
              Loading live holdings…
            </div>
          ))}
        {fund === "sip" && (
          <SipView holdings={sip} themeTick={themeTick} onOpen={openStock} onAsk={ask} onAskAi={openAi} />
        )}
        {fund === "swing" && (
          <SwingView open={open} closed={swingClosed} themeTick={themeTick} onOpen={openStock} onAsk={ask} />
        )}
        <div className="foot">
          Mock prototype · fake data · Meridian Capital multi-fund concept · click any holding row to open the AI stock
          drill-down
        </div>
      </div>

      <StockDrawer
        ticker={stock}
        allHoldings={[...(alpha ?? []), ...sip, ...open]}
        themeTick={themeTick}
        onClose={() => setStock(null)}
        onAsk={ask}
      />

      <AskAiSheet
        open={aiOpen}
        ticker={null}
        holdings={computeHoldings(fundHoldings)}
        fundLabel={fundLabel}
        pending={pendingQ}
        onClose={() => setAiOpen(false)}
      />
    </div>
  );
}
