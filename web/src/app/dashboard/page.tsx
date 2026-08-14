"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { computeHoldings, swingClosed, swingOpen, type Holding } from "./data";
import { Hero, StockDrawer, SwingView } from "./views";
import { BreadthPanel } from "./BreadthCore";
import { TickerTape } from "./TickerTape";
import { AskAiSheet } from "./AskAiSheet";
import "./dashboard.css";

function drift(holdings: Holding[]): Holding[] {
  const t = Date.now() / 1000;
  return holdings.map((h, i) => ({ ...h, ltp: Math.max(1, h.ltp + Math.sin((t + i) * 0.9) * h.ltp * 0.0008) }));
}

export default function Dashboard() {
  const [themeTick, setThemeTick] = useState(0);
  const [stock, setStock] = useState<string | null>(null);
  const [open, setOpen] = useState(swingOpen);
  const [aiOpen, setAiOpen] = useState(false);
  const [pendingQ, setPendingQ] = useState<{ text: string; id: number } | null>(null);

  // Wire live holdings from SnapTrade; keep mock data on error
  useEffect(() => {
    fetch("/api/holdings")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((rows: { symbol: string; name: string; qty: number; avg: number | null; price: number | null; dayPct: number | null }[]) => {
        if (!rows.length) return;
        setOpen(rows.map((h) => ({ ticker: h.symbol, name: h.name, qty: h.qty, avg: h.avg ?? 0, ltp: h.price ?? 0, day: h.dayPct ?? 0 })));
      })
      .catch(() => {});
  }, []);

  // live price tick
  useEffect(() => {
    const id = setInterval(() => setOpen(drift), 2500);
    return () => clearInterval(id);
  }, []);

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

  return (
    <div className={"dash" + (aiOpen ? " ai-open" : "")}>
      <nav className="nav">
        <div className="wrap nav-inner">
          <Link className="logo" href="/">
            <div className="logo-mark">M</div> Meridian Capital
          </Link>
          <div className="nav-right">
            <ThemeToggle className="icon-btn" onToggle={() => setThemeTick((t) => t + 1)} />
            <div className="avatar">PR</div>
          </div>
        </div>
      </nav>

      <div className="wrap">
        <div className="hero-row">
          <div className="hero-col">
            <Hero fund="swing" />
            <TickerTape />
          </div>
          <BreadthPanel />
        </div>
        <SwingView open={open} closed={swingClosed} themeTick={themeTick} onOpen={openStock} onAsk={ask} />
        <div className="foot">
          Live positions via SnapTrade · Meridian Capital swing trading
        </div>
      </div>

      <StockDrawer
        ticker={stock}
        allHoldings={open}
        themeTick={themeTick}
        onClose={() => setStock(null)}
        onAsk={ask}
      />

      <AskAiSheet
        open={aiOpen}
        ticker={null}
        holdings={computeHoldings(open)}
        fundLabel="Swing Trading Fund"
        pending={pendingQ}
        onClose={() => setAiOpen(false)}
      />
    </div>
  );
}
