import type { CSSProperties } from "react";

// Marketing copy + demo numbers for the landing sections. Placeholder
// content — swap freely as the real landing design lands.

export const ALLOC = [
  { color: "#4e4feb", ticker: "NVDA", pct: "11.8%" },
  { color: "#189e6a", ticker: "MSFT", pct: "10.1%" },
  { color: "#e8911c", ticker: "LLY", pct: "9.4%" },
  { color: "#e0413a", ticker: "META", pct: "8.6%" },
  { color: "#0ea5e9", ticker: "AMZN", pct: "7.2%" },
  { color: "#a855f7", ticker: "GOOGL", pct: "6.9%" },
];

export type FundCard = {
  badge: string;
  badgeStyle: CSSProperties;
  name: string;
  desc: string;
  stats: { l: string; v: string; up?: boolean }[];
};

export const FUNDS: FundCard[] = [
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
