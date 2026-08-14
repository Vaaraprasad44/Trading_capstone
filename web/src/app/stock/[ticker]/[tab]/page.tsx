"use client";

import { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { infoFor, pct, usd2 } from "@/app/dashboard/data";
import { STOCK_TABS, colorFor, holdingFor, type StockTab } from "../../data";
import { FinancialsTab } from "../../FinancialsTab";
import { CommunityTab, NewsTab, NotesTab } from "../../tabs";
import "../../stock.css";

export default function StockPage({ params }: { params: Promise<{ ticker: string; tab: string }> }) {
  const p = use(params);
  const ticker = decodeURIComponent(p.ticker).toUpperCase();
  const tab = p.tab as StockTab;
  if (!STOCK_TABS.some((t) => t.tab === tab)) notFound();

  const info = infoFor(ticker);
  const h = holdingFor(ticker);
  const price = h?.ltp ?? (info.hi !== "—" ? parseFloat(info.hi.replace(",", "")) : 100);
  const day = h?.day ?? 0;

  return (
    <div className="stk">
      <nav className="nav">
        <div className="wrap nav-inner">
          <Link className="logo" href="/">
            <div className="logo-mark">M</div> Meridian Capital
          </Link>
          <div className="nav-right">
            <Link className="back-link" href="/dashboard">
              ← Dashboard
            </Link>
            <div className="avatar">PR</div>
          </div>
        </div>
      </nav>

      <div className="page">
        <header className="head">
          <div className="stk-logo" style={{ background: colorFor(ticker) }}>
            {ticker.slice(0, 4)}
          </div>
          <div className="stk-name">
            <h1>{h?.name ?? ticker}</h1>
            <div className="sub">
              {ticker} · {info.sector}
            </div>
            {h && (
              <span className="pos-chip">
                In portfolio · {h.qty.toFixed(2)} sh @ {usd2(h.avg)}
              </span>
            )}
          </div>
          <div className="stk-price">
            <div className="p">{usd2(price)}</div>
            <div className={"d " + (day >= 0 ? "t-up" : "t-dn")}>{pct(day)} today</div>
          </div>
        </header>

        <nav className="tabs" aria-label="Stock sections">
          {STOCK_TABS.map((t) => (
            <Link key={t.tab} href={`/stock/${ticker}/${t.tab}`} className={t.tab === tab ? "on" : ""}>
              {t.icon} {t.label}
            </Link>
          ))}
        </nav>

        <div className="tab-body">
          {tab === "financials" && <FinancialsTab ticker={ticker} />}
          {tab === "news" && <NewsTab ticker={ticker} />}
          {tab === "notes" && <NotesTab ticker={ticker} />}
          {tab === "community" && <CommunityTab ticker={ticker} />}
        </div>

        <div className="foot-note">
          Mock prototype · placeholder data · financials &amp; news will come from the market-data MCP, community from
          the app backend.
        </div>
      </div>
    </div>
  );
}
