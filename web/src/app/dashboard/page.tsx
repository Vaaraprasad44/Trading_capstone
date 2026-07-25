"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { alphaHoldings, sipHoldings, swingClosed, swingOpen, type FundKey, type Holding } from "./data";
import { AlphaView, Hero, SipView, StockDrawer, SwingView } from "./views";
import "./dashboard.css";

const FUNDS: { key: FundKey; label: string }[] = [
  { key: "alpha", label: "Alpha Fund" },
  { key: "sip", label: "Smart SIP" },
  { key: "swing", label: "Swing Trading" },
];

// ponytail: alert() stands in for the copy-sizing assistant, as in the
// prototype — wire to the Agent SDK runner when the AI phase lands.
function ask(q: string) {
  alert(`AI question (wired to LLM/Skill in real app):\n\n"${q}"`);
}

function drift(holdings: Holding[]): Holding[] {
  const t = Date.now() / 1000;
  return holdings.map((h, i) => ({ ...h, ltp: Math.max(1, h.ltp + Math.sin((t + i) * 0.9) * h.ltp * 0.0008) }));
}

export default function Dashboard() {
  const [fund, setFund] = useState<FundKey>("alpha");
  const [themeTick, setThemeTick] = useState(0);
  const [stock, setStock] = useState<string | null>(null);
  const [alpha, setAlpha] = useState(alphaHoldings);
  const [sip, setSip] = useState(sipHoldings);
  const [open, setOpen] = useState(swingOpen);

  // live price tick, as in the prototype
  useEffect(() => {
    const id = setInterval(() => {
      setAlpha(drift);
      setSip(drift);
      setOpen(drift);
    }, 2500);
    return () => clearInterval(id);
  }, []);

  // Esc closes the drill-down
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setStock(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const openStock = useCallback((t: string) => setStock(t), []);

  return (
    <div className="dash">
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
        <Hero fund={fund} />
        {fund === "alpha" && <AlphaView holdings={alpha} themeTick={themeTick} onOpen={openStock} onAsk={ask} />}
        {fund === "sip" && <SipView holdings={sip} themeTick={themeTick} onOpen={openStock} onAsk={ask} />}
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
        allHoldings={[...alpha, ...sip, ...open]}
        themeTick={themeTick}
        onClose={() => setStock(null)}
        onAsk={ask}
      />
    </div>
  );
}
