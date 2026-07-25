"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./landing.css";

const ALLOC = [
  { color: "#4e4feb", ticker: "NVDA", pct: "11.8%" },
  { color: "#189e6a", ticker: "MSFT", pct: "10.1%" },
  { color: "#e8911c", ticker: "LLY", pct: "9.4%" },
  { color: "#e0413a", ticker: "META", pct: "8.6%" },
  { color: "#0ea5e9", ticker: "AMZN", pct: "7.2%" },
  { color: "#a855f7", ticker: "GOOGL", pct: "6.9%" },
];

const FUNDS = [
  {
    badge: "Long-term investing",
    badgeStyle: { background: "var(--brand-soft)", color: "var(--brand)" },
    name: "Alpha Fund",
    desc: "High-conviction, long-term compounding. Hefty capital deployed into quality names and left to grow — with concentration and allocation guardrails built in.",
    stats: [
      { l: "Fund size", v: "$1M" },
      { l: "Net P&L", v: "+82%", up: true },
      { l: "Positions", v: "12" },
    ],
  },
  {
    badge: "Systematic monthly",
    badgeStyle: { background: "var(--up-soft)", color: "var(--up)" },
    name: "Smart SIP",
    desc: "Disciplined monthly investing. Dollar-cost average into quality ETFs and blue chips, ride the compounding, and let the SIP coach keep you on schedule.",
    stats: [
      { l: "XIRR", v: "+14.8%", up: true },
      { l: "Months", v: "30" },
      { l: "Monthly", v: "$2K" },
    ],
  },
  {
    badge: "Active swing trading",
    badgeStyle: { background: "var(--amber-soft)", color: "var(--amber)" },
    name: "Swing Trading",
    desc: "Short-term, higher-risk trades captured over days to weeks. Get instant alerts on every entry, a live equity curve, and full closed-trade analytics.",
    stats: [
      { l: "Win rate", v: "71%" },
      { l: "Profit factor", v: "2.4" },
      { l: "Avg hold", v: "8d" },
    ],
  },
];

export default function Landing() {
  // scroll reveal, as in the prototype
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12 },
    );
    document.querySelectorAll(".landing .reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="landing">
      <nav className="nav">
        <div className="wrap nav-inner">
          <div className="logo">
            <div className="logo-mark">M</div> Meridian Capital
          </div>
          <div className="nav-links">
            <a href="#funds">Funds</a>
            <Link href="/dashboard">Dashboard</Link>
          </div>
          <div className="nav-right">
            <ThemeToggle className="icon-btn" />
            <Link className="btn btn-primary" href="/dashboard">
              Open dashboard →
            </Link>
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="wrap">
          <span className="eyebrow">
            <span className="dot" /> AI-powered · multi-fund investing
          </span>
          <h1>
            Your portfolio, with an <span className="accent">analyst that never sleeps.</span>
          </h1>
          <p className="sub">
            Meridian runs three strategies in one dashboard — long-term compounding, systematic SIPs, and active swing
            trades — each with live data and AI insights on every holding.
          </p>
          <div className="hero-cta">
            <Link className="btn btn-primary btn-lg" href="/dashboard">
              Open the dashboard →
            </Link>
            <a className="btn btn-ghost btn-lg" href="#funds">
              See the funds
            </a>
          </div>
          <div className="hero-note">No card required · mock prototype · explore with sample funds</div>

          <div className="preview reveal">
            <div className="preview-card">
              <div className="pv-bar">
                <span className="pv-dot" style={{ background: "var(--dn)" }} />
                <span className="pv-dot" style={{ background: "var(--amber)" }} />
                <span className="pv-dot" style={{ background: "var(--up)" }} />
                <span className="pv-title">meridian.capital / alpha-fund</span>
                <span className="pv-live">
                  <span className="live-dot" /> Live · updated 1s ago
                </span>
              </div>
              <div className="pv-body">
                <div className="pv-kpis">
                  <div className="pv-kpi">
                    <div className="l">Invested</div>
                    <div className="v">$623,326</div>
                  </div>
                  <div className="pv-kpi">
                    <div className="l">Current</div>
                    <div className="v">$758,940</div>
                  </div>
                  <div className="pv-kpi">
                    <div className="l">Net P&L</div>
                    <div className="v" style={{ color: "var(--up)" }}>
                      +$512K
                    </div>
                    <span className="pill up">+82.2%</span>
                  </div>
                  <div className="pv-kpi">
                    <div className="l">Win rate</div>
                    <div className="v">71%</div>
                    <span className="pill up">5/7 trades</span>
                  </div>
                </div>
                <div className="pv-panel">
                  <h4>
                    Allocation <span className="muted">12 positions</span>
                  </h4>
                  <div className="alloc-mini alloc-2col">
                    {ALLOC.map((a) => (
                      <div className="alloc-row" key={a.ticker}>
                        <span className="sq" style={{ background: a.color }} />
                        {a.ticker}
                        <span className="pct">{a.pct}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="ai-strip">
                  <div className="ai-ico">⚡</div>
                  <div>
                    <div className="tag">Daily AI briefing</div>
                    <div className="msg">
                      NVDA is your largest position and a top gainer; NVO (-27.6%) is the weakest holding and worth a
                      thesis review. Tech concentration is above 60%.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="trust">
        <div className="wrap">
          <p>Live market data &amp; fundamentals powered by</p>
          <div className="trust-row">
            <span>Market·MCP</span>
            <span>NewsRank AI</span>
            <span>Chart.js</span>
            <span>Skill Engine</span>
            <span>UAE&nbsp;4.5%</span>
          </div>
        </div>
      </section>

      <section className="sec" id="funds">
        <div className="wrap">
          <div className="sec-head reveal">
            <div className="sec-tag">Three strategies, one login</div>
            <h2>Pick the fund that fits how you invest</h2>
            <p>Switch between funds instantly. Each has its own dashboard, metrics, and AI coach tuned to the strategy.</p>
          </div>
          <div className="funds">
            {FUNDS.map((f) => (
              <div className="fund-card reveal" key={f.name}>
                <span className="fund-badge" style={f.badgeStyle}>
                  {f.badge}
                </span>
                <h3>{f.name}</h3>
                <p className="desc">{f.desc}</p>
                <div className="fund-stats">
                  {f.stats.map((s) => (
                    <div className="fund-stat" key={s.l}>
                      <div className="l">{s.l}</div>
                      <div className="v" style={s.up ? { color: "var(--up)" } : undefined}>
                        {s.v}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="foot">
        <div className="wrap">
          <div className="foot-grid">
            <div className="foot-col">
              <div className="logo">
                <div className="logo-mark">M</div> Meridian Capital
              </div>
              <p className="blurb">
                An AI-powered multi-fund dashboard concept. Long-term compounding, systematic SIPs, and active swing
                trades — with insight on every holding.
              </p>
            </div>
            <div className="foot-col">
              <h5>Product</h5>
              <a href="#funds">Funds</a>
              <Link href="/dashboard">Dashboard</Link>
            </div>
            <div className="foot-col">
              <h5>Company</h5>
              <a href="#">About</a>
              <a href="#">Blog</a>
              <a href="#">Careers</a>
              <a href="#">Contact</a>
            </div>
            <div className="foot-col">
              <h5>Legal</h5>
              <a href="#">Terms</a>
              <a href="#">Privacy</a>
              <a href="#">Disclosures</a>
              <a href="#">Security</a>
            </div>
          </div>
          <div className="foot-bottom">
            <span>© 2026 Meridian Capital · Mock prototype</span>
            <span className="disc">
              Fake data for demonstration only. Not investment advice. Markets involve risk; past performance does not
              guarantee future results.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
