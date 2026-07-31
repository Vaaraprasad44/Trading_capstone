"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  COLORS,
  HERO,
  activity,
  computeHoldings,
  infoFor,
  pct,
  usd,
  usd2,
  type ClosedTrade,
  type ComputedHolding,
  type FundKey,
  type Holding,
} from "./data";
import { AllocDonut, EquityChart, PerfChart, SipChart, SparkChart } from "./charts";
import { HoldingsGrid } from "./HoldingsGrid";

type Ask = (q: string) => void;
type OpenStock = (ticker: string) => void;

/* ============ small builders ============ */

export function Kpi({ label, value, pill, up }: { label: string; value: string; pill?: string | null; up?: boolean | null }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className={"value" + (up === true ? " t-up" : up === false ? " t-dn" : "")}>{value}</div>
      {pill && <span className={"pill " + (up ? "up" : "dn")}>{pill}</span>}
    </div>
  );
}

function CashCell({ label, value, note, cls }: { label: string; value: string; note: string; cls?: string }) {
  return (
    <div className="cash-cell">
      <div className="label">{label}</div>
      <div className={"value " + (cls ?? "")}>{value}</div>
      <div className="note">{note}</div>
    </div>
  );
}

function AiStrip({ tag, msg, fund, onAsk }: { tag: string; msg: string; fund: FundKey; onAsk: Ask }) {
  return (
    <div className="ai-strip" onClick={() => onAsk(`Give me a full AI analysis of the ${fund} fund.`)}>
      <div className="ai-ico">⚡</div>
      <div className="ai-body">
        <div className="tag">{tag}</div>
        <div className="msg">{msg}</div>
      </div>
      <div className="ai-cta">Full analysis →</div>
    </div>
  );
}

function AiHint() {
  return (
    <div className="ai-hint">
      <span className="ai-hint-ico">⚡</span>
      <span>
        <b>Click any row</b> to open AI-powered insights — fundamentals, AI-ranked news &amp; key facts for that stock.
      </span>
    </div>
  );
}

function AskBox({ onAsk }: { onAsk: Ask }) {
  const [q, setQ] = useState("");
  const submit = () => q.trim() && onAsk(q.trim());
  return (
    <div className="card card-pad">
      <div className="section-head">
        <h2>Ask the portfolio</h2>
        <span className="muted">AI-powered</span>
      </div>
      <div className="ask-row">
        <input
          type="text"
          placeholder="e.g. Which holdings are beating the S&P 500?"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button className="ask-btn" onClick={submit}>
          Ask
        </button>
      </div>
      <div className="chips">
        <span className="chip" onClick={() => onAsk("Am I too concentrated in any single stock?")}>Concentration risk?</span>
        <span className="chip" onClick={() => onAsk("Which holdings are beating the market?")}>Beating the market?</span>
        <span className="chip" onClick={() => onAsk("Summarize this month's activity.")}>Summarize this month</span>
      </div>
    </div>
  );
}

function ActivityList() {
  return (
    <>
      {activity.map((a, i) => (
        <div className="act" key={i}>
          <div className="act-logo" style={{ background: a.color }}>{a.logo.slice(0, 4)}</div>
          <div className="act-main">
            <span className={"act-tag " + a.type}>{a.type.toUpperCase()}</span>
            {a.action} <b>{a.qty}</b> {a.ticker} at avg <b>{a.price}</b>. Allocation → <b>{a.alloc}</b>.
            <div className="act-date">{a.date}</div>
          </div>
        </div>
      ))}
    </>
  );
}

function AllocationCard({ holdings, unit, themeTick }: { holdings: ComputedHolding[]; unit: string; themeTick: number }) {
  const legend = [...holdings].sort((a, b) => b.allocation - a.allocation);
  return (
    <div className="card card-pad">
      <div className="section-head">
        <h2>Allocation</h2>
        <span className="muted">{holdings.length} {unit}</span>
      </div>
      <div className="alloc-wrap">
        <div style={{ position: "relative", width: 160, height: 160, flexShrink: 0 }}>
          <AllocDonut holdings={holdings} themeTick={themeTick} />
        </div>
        <div className="alloc-legend">
          {legend.map((h) => (
            <div className="alloc-row" key={h.ticker}>
              <span className="dot" style={{ background: COLORS[holdings.indexOf(h) % COLORS.length] }} />
              {h.ticker}
              <span className="pct">{h.allocation.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============ holdings table (AG Grid) ============ */

function HoldingsTable({ holdings, title, onOpen, onAskAi }: {
  holdings: ComputedHolding[];
  title: string;
  onOpen: OpenStock;
  onAskAi: () => void;
}) {
  const [filter, setFilter] = useState("");

  return (
    <div className="card section">
      <div className="table-tools">
        <h2>{title}</h2>
        <div className="table-tools-right">
          <div className="live">
            <span className="live-dot" /> Live · updated 1s ago
          </div>
          <button className="ai-open-btn" onClick={onAskAi}>✦ Ask AI</button>
        </div>
      </div>
      <div className="table-tools" style={{ paddingTop: 0 }}>
        <div className="search">
          🔍{" "}
          <input
            type="text"
            placeholder="Search holdings…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>
      <AiHint />
      <HoldingsGrid holdings={holdings} filter={filter} onOpen={onOpen} />
    </div>
  );
}

/* ============ fund views ============ */

export function AlphaView({ holdings, themeTick, onOpen, onAsk, onAskAi }: { holdings: Holding[]; themeTick: number; onOpen: OpenStock; onAsk: Ask; onAskAi: () => void }) {
  const H = computeHoldings(holdings);
  const FUND_SIZE = 1000000;
  const REALIZED = 376674.63;
  const INT = 17315.81;
  const current = H.reduce((s, h) => s + h.presentValue, 0);
  const invested = H.reduce((s, h) => s + h.buyValue, 0);
  const unreal = current - invested;
  const net = REALIZED + unreal;
  const cash = FUND_SIZE - invested;
  const avail = cash + REALIZED + INT;
  const dep = Math.min(100, (invested / FUND_SIZE) * 100);
  const cp = Math.max(0, 100 - dep);
  const [range, setRange] = useState<"1M" | "3M" | "6M" | "1Y">("6M");

  return (
    <>
      <div className="card section" style={{ marginTop: 18 }}>
        <div className="kpi-grid">
          <Kpi label="Invested" value={usd(invested)} />
          <Kpi label="Current" value={usd(current)} />
          <Kpi label="Realized P&L" value={"+" + usd(REALIZED)} pill={pct((REALIZED / invested) * 100)} up />
          <Kpi label="Unrealized P&L" value={(unreal >= 0 ? "+" : "") + usd(unreal)} pill={pct((unreal / invested) * 100)} up={unreal >= 0} />
          <Kpi label="Net P&L" value={"+" + usd(net)} pill={pct((net / invested) * 100)} up />
        </div>
      </div>
      <AiStrip
        tag="Daily AI briefing"
        msg="NVDA is your largest position and a top gainer; NVO (-27.6%) is the weakest holding and worth a thesis review. Tech concentration is above 60%."
        fund="alpha"
        onAsk={onAsk}
      />
      <div className="card section">
        <div className="card-pad" style={{ paddingBottom: 0 }}>
          <div className="section-head">
            <h2>Cash position &amp; returns</h2>
          </div>
        </div>
        <div className="cash-grid">
          <CashCell label="Cash position" value={(cash < 0 ? "-" : "") + usd(Math.abs(cash))} note="Fund size − invested" cls={cash < 0 ? "t-dn" : ""} />
          <CashCell label="Risk-free return" value="4.5%" note="Savings account (UAE)" cls="t-up" />
          <CashCell label="Available cash" value={usd(avail)} note="Cash + realized + interest" />
          <CashCell label="Accrued interest" value={usd(INT)} note="+1.43% w.r.t investment" />
        </div>
        <div className="split-bar">
          <div className="sd" style={{ width: `${dep}%` }} />
          <div className="sc" style={{ width: `${cp}%` }} />
        </div>
        <div className="split-legend">
          <span>
            <span className="sq" style={{ background: "var(--up)" }} /> Deployed {Math.round(dep)}%
          </span>
          <span>
            <span className="sq" style={{ background: "var(--brand)" }} /> Cash reserve {Math.round(cp)}%
          </span>
        </div>
      </div>
      <div className="section cols">
        <div className="card card-pad">
          <div className="section-head">
            <h2>Performance vs S&amp;P 500</h2>
            <div className="seg-ctrl">
              {(["1M", "3M", "6M", "1Y"] as const).map((r) => (
                <button key={r} className={range === r ? "on" : ""} onClick={() => setRange(r)}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div style={{ position: "relative", height: 230 }}>
            <PerfChart range={range} themeTick={themeTick} />
          </div>
        </div>
        <AllocationCard holdings={H} unit="positions" themeTick={themeTick} />
      </div>
      <HoldingsTable holdings={H} title="Stock holdings" onOpen={onOpen} onAskAi={onAskAi} />
      <div className="section cols">
        <div className="card card-pad">
          <div className="section-head">
            <h2>Recent buy &amp; sell</h2>
          </div>
          <ActivityList />
        </div>
        <AskBox onAsk={onAsk} />
      </div>
    </>
  );
}

export function SipView({ holdings, themeTick, onOpen, onAsk, onAskAi }: { holdings: Holding[]; themeTick: number; onOpen: OpenStock; onAsk: Ask; onAskAi: () => void }) {
  const H = computeHoldings(holdings);
  const monthly = 2000;
  const months = 30;
  const current = H.reduce((s, h) => s + h.presentValue, 0);
  const invested = H.reduce((s, h) => s + h.buyValue, 0);
  const totalRet = (current / invested - 1) * 100;

  return (
    <>
      <div className="card section" style={{ marginTop: 18 }}>
        <div className="kpi-grid">
          <Kpi label="Total invested" value={usd(invested)} />
          <Kpi label="Current value" value={usd(current)} />
          <Kpi label="XIRR" value="+14.8%" up />
          <Kpi label="Total return" value={"+" + totalRet.toFixed(1) + "%"} up />
          <Kpi label="Monthly SIP" value={usd(monthly)} />
        </div>
      </div>
      <AiStrip
        tag="SIP coach"
        msg={`You've invested ${months} months straight — staying the course beat lump-sum timing by ~3.2%. Next auto-buy of ${usd(monthly)} is scheduled for 1 Jul 2026.`}
        fund="sip"
        onAsk={onAsk}
      />
      <div className="card section">
        <div className="cash-grid">
          <CashCell label="Months invested" value={String(months)} note="Since Jan 2024" />
          <CashCell label="Avg monthly cost" value={usd2(invested / months)} note="Per contribution" />
          <CashCell label="Next SIP date" value="1 Jul 2026" note={"Auto-buy " + usd(monthly)} cls="t-up" />
          <CashCell label="Units accumulated" value={H.reduce((s, h) => s + h.qty, 0).toFixed(1)} note={`Across ${H.length} funds`} />
        </div>
      </div>
      <div className="card section card-pad">
        <div className="section-head">
          <h2>Invested vs current value</h2>
          <span className="muted">monthly contributions, {months} months</span>
        </div>
        <div style={{ position: "relative", height: 250 }}>
          <SipChart months={months} monthly={monthly} themeTick={themeTick} />
        </div>
      </div>
      <div className="section cols">
        <AllocationCard holdings={H} unit="funds" themeTick={themeTick} />
        <AskBox onAsk={onAsk} />
      </div>
      <HoldingsTable holdings={H} title="SIP holdings" onOpen={onOpen} onAskAi={onAskAi} />
    </>
  );
}

export function SwingView({ open, closed, themeTick, onOpen, onAsk }: { open: Holding[]; closed: ClosedTrade[]; themeTick: number; onOpen: OpenStock; onAsk: Ask }) {
  const O = computeHoldings(open);
  const wins = closed.filter((t) => t.pnl > 0);
  const winRate = (wins.length / closed.length) * 100;
  const grossP = wins.reduce((s, t) => s + t.pnl, 0);
  const grossL = Math.abs(closed.filter((t) => t.pnl < 0).reduce((s, t) => s + t.pnl, 0));
  const pf = grossL ? grossP / grossL : grossP;
  const realized = closed.reduce((s, t) => s + t.pnl, 0);
  const avgHold = Math.round(closed.reduce((s, t) => s + t.days, 0) / closed.length);
  const openVal = O.reduce((s, h) => s + h.presentValue, 0);

  return (
    <>
      <div className="card section" style={{ marginTop: 18 }}>
        <div className="kpi-grid">
          <Kpi label="Realized P&L" value={"+" + usd(realized)} up />
          <Kpi label="Win rate" value={winRate.toFixed(0) + "%"} pill={`${wins.length}/${closed.length} trades`} up={winRate >= 50} />
          <Kpi label="Profit factor" value={pf.toFixed(2)} pill="gross win / loss" up={pf >= 1} />
          <Kpi label="Avg hold" value={avgHold + " days"} />
          <Kpi label="Open exposure" value={usd(openVal)} pill={`${O.length} positions`} up />
        </div>
      </div>
      <AiStrip
        tag="Trade signal"
        msg="New swing entered: TSLA long @ $179.40 (sized 4% of book). Subscribers copying this fund were alerted instantly. Momentum + oversold RSI thesis."
        fund="swing"
        onAsk={onAsk}
      />
      <div className="card section card-pad">
        <div className="section-head">
          <h2>Equity curve</h2>
          <span className="muted">realized P&L, last {closed.length} trades</span>
        </div>
        <div style={{ position: "relative", height: 220 }}>
          <EquityChart closed={closed} themeTick={themeTick} />
        </div>
      </div>
      <div className="card section">
        <div className="table-tools">
          <h2>Closed trades</h2>
          <span className="muted">
            win rate {winRate.toFixed(0)}% · PF {pf.toFixed(2)}
          </span>
        </div>
        <AiHint />
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Ticker</th>
                <th style={{ textAlign: "left" }}>Dir</th>
                <th>Entry</th>
                <th>Exit</th>
                <th>Qty</th>
                <th>In</th>
                <th>Out</th>
                <th>Hold</th>
                <th>Return</th>
                <th>P&L</th>
              </tr>
            </thead>
            <tbody>
              {closed.map((t, i) => (
                <tr key={i} onClick={() => onOpen(t.ticker)}>
                  <td>{t.ticker}</td>
                  <td style={{ textAlign: "left", color: "var(--text-2)" }}>{t.dir}</td>
                  <td>{usd2(t.entry)}</td>
                  <td>{usd2(t.exit)}</td>
                  <td>{t.qty}</td>
                  <td>{t.inDate}</td>
                  <td>{t.outDate}</td>
                  <td>{t.days}d</td>
                  <td className={t.ret >= 0 ? "t-up" : "t-dn"}>{pct(t.ret)}</td>
                  <td className={t.pnl >= 0 ? "t-up" : "t-dn"}>{(t.pnl >= 0 ? "+" : "") + usd(t.pnl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="section cols">
        <div className="card">
          <div className="table-tools">
            <h2>Open positions</h2>
            <span className="live">
              <span className="live-dot" /> live
            </span>
          </div>
          <AiHint />
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Ticker</th>
                  <th>Avg</th>
                  <th>LTP</th>
                  <th>Value</th>
                  <th>P&L %</th>
                  <th>Day %</th>
                </tr>
              </thead>
              <tbody>
                {O.map((h) => (
                  <tr key={h.ticker} onClick={() => onOpen(h.ticker)}>
                    <td>
                      <span className="tkr">
                        {h.ticker} <span className="chev">›</span>
                      </span>
                    </td>
                    <td>{usd2(h.avg)}</td>
                    <td>{usd2(h.ltp)}</td>
                    <td>{usd(h.presentValue)}</td>
                    <td className={h.pnlPct >= 0 ? "t-up" : "t-dn"}>{pct(h.pnlPct)}</td>
                    <td className={h.day >= 0 ? "t-up" : "t-dn"}>{pct(h.day)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <AskBox onAsk={onAsk} />
      </div>
    </>
  );
}

/* ============ drill-down drawer ============ */

export function StockDrawer({ ticker, allHoldings, themeTick, onClose, onAsk }: { ticker: string | null; allHoldings: Holding[]; themeTick: number; onClose: () => void; onAsk: Ask }) {
  const open = ticker !== null;
  const info = ticker ? infoFor(ticker) : null;
  const h = ticker ? allHoldings.find((x) => x.ticker === ticker) : undefined;
  const price = h ? h.ltp : info && info.hi !== "—" ? parseFloat(info.hi) : 100;
  const day = h?.day ?? 0;

  let body: ReactNode = null;
  if (ticker && info) {
    body = (
      <>
        <div className="dd-card">
          <h3>
            <span className="ai-badge">Key facts ✨</span> AI summary
          </h3>
          {info.facts.map((f, i) => (
            <div className="fact" key={i}>
              <span className="b">›</span>
              <span>{f}</span>
            </div>
          ))}
        </div>
        <div className="dd-card">
          <h3>Price · last 30 sessions</h3>
          <div style={{ position: "relative", height: 120 }}>
            <SparkChart price={price} up={day >= 0} themeTick={themeTick} />
          </div>
        </div>
        <div className="dd-card">
          <h3>
            Fundamentals <span className="muted" style={{ fontWeight: 400 }}>via market-data MCP</span>
          </h3>
          <div className="fund-grid">
            <div className="fund-item"><span className="k">Market cap</span><span className="v">{info.mcap}</span></div>
            <div className="fund-item"><span className="k">P/E (TTM)</span><span className="v">{info.pe}</span></div>
            <div className="fund-item"><span className="k">EPS</span><span className="v">{info.eps}</span></div>
            <div className="fund-item"><span className="k">Div yield</span><span className="v">{info.div}</span></div>
            <div className="fund-item"><span className="k">52w high</span><span className="v">{info.hi}</span></div>
            <div className="fund-item"><span className="k">52w low</span><span className="v">{info.lo}</span></div>
          </div>
        </div>
        {h && (
          <div className="dd-card">
            <h3>Your position</h3>
            <div className="fund-grid">
              <div className="fund-item"><span className="k">Quantity</span><span className="v">{h.qty.toFixed(2)}</span></div>
              <div className="fund-item"><span className="k">Avg buy</span><span className="v">{usd2(h.avg)}</span></div>
              <div className="fund-item"><span className="k">Present value</span><span className="v">{usd(h.qty * h.ltp)}</span></div>
              <div className="fund-item">
                <span className="k">P&L</span>
                <span className={"v " + (h.ltp - h.avg >= 0 ? "t-up" : "t-dn")}>{pct((h.ltp / h.avg - 1) * 100)}</span>
              </div>
            </div>
          </div>
        )}
        <div className="dd-card">
          <h3>
            <span className="ai-badge">Today&apos;s highlights ✨</span> AI-ranked news
          </h3>
          <div className="news">
            {info.news.map((n, i) => (
              <div className="news-item" key={i}>
                <span className={"rel " + n.r}>{n.r.toUpperCase()}</span>
                <div>
                  <div className="h">{n.h}</div>
                  <div className="s">{n.s}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <button
          className="ask-btn"
          style={{ width: "100%", padding: 13 }}
          onClick={() => onAsk(`Tell me more about ${ticker} — should I be worried about my position?`)}
        >
          Ask AI about {ticker} ↗
        </button>
      </>
    );
  }

  return (
    <>
      <div className={"scrim" + (open ? " open" : "")} onClick={onClose} />
      <div className={"drawer" + (open ? " open" : "")}>
        <div className="dd-head">
          <div>
            <div className="dd-tkr">{ticker}</div>
            <div className="dd-name">{ticker && ((h ? h.name : ticker) + " · " + (info?.sector ?? ""))}</div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div>
              <div className="dd-price">{ticker && usd2(price)}</div>
              <div className={day >= 0 ? "t-up" : "t-dn"} style={{ textAlign: "right", fontSize: 12, fontWeight: 600 }}>
                {ticker && pct(day)}
              </div>
            </div>
            <button className="icon-btn" onClick={onClose} title="Close">
              ×
            </button>
          </div>
        </div>
        <div className="dd-body">{body}</div>
      </div>
    </>
  );
}

export function Hero({ fund }: { fund: FundKey }) {
  const h = HERO[fund];
  return (
    <div className="hero">
      <h1>
        {h.pre}
        <span className="accent">{h.accent}</span>
      </h1>
      <p>{h.sub}</p>
      <span className="strat-badge" style={{ background: h.badgeBg, color: h.badgeColor }}>
        {h.badge}
      </span>
    </div>
  );
}
