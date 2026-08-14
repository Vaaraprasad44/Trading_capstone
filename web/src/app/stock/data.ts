// Mock per-stock content for the dedicated stock pages (financials, news,
// notes, community). Generators are deterministic — seeded by ticker — so
// server and client renders agree. Later this is fed by the market-data MCP
// and the community backend; the page shapes won't change.

import { COLORS, alphaHoldings, infoFor, sipHoldings, swingOpen, type Holding } from "@/app/dashboard/data";

export const STOCK_TABS = [
  { tab: "financials", label: "Financials", icon: "📊" },
  { tab: "news", label: "News", icon: "📰" },
  { tab: "notes", label: "Notes", icon: "📝" },
  { tab: "community", label: "Community", icon: "👥" },
] as const;

export type StockTab = (typeof STOCK_TABS)[number]["tab"];

export function holdingFor(ticker: string): Holding | undefined {
  return [...alphaHoldings, ...sipHoldings, ...swingOpen].find((h) => h.ticker === ticker);
}

export function colorFor(ticker: string): string {
  let s = 0;
  for (const c of ticker) s += c.charCodeAt(0);
  return COLORS[s % COLORS.length];
}

// deterministic per-key rng (no Math.random — SSR/CSR must match)
function rng(key: string) {
  let s = 7;
  for (const c of key) s = (s * 31 + c.charCodeAt(0)) % 997;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/* ===== financials ===== */

export type Financials = {
  years: string[];
  revenue: number[]; // $B
  netIncome: number[]; // $B
  grossMargin: number[]; // %
  netMargin: number[]; // %
  ocf: number[]; // $B
  fcf: number[]; // $B
  balance: { label: string; value: string }[];
  ratios: { label: string; value: string }[];
};

function mcapNum(m: string): number | null {
  const n = parseFloat(m.replace(",", ""));
  if (isNaN(n)) return null;
  return m.endsWith("T") ? n * 1e12 : n * 1e9;
}

export function financialsFor(ticker: string): Financials {
  const info = infoFor(ticker);
  const r = rng("fin:" + ticker);
  const mc = mcapNum(info.mcap) ?? 150e9;
  const years = ["FY22", "FY23", "FY24", "FY25", "FY26"];
  const latestRev = (mc * (0.05 + r() * 0.18)) / 1e9;
  const growth = 0.08 + r() * 0.24;
  const nmLatest = 0.12 + r() * 0.24;
  const gmLatest = Math.min(0.9, nmLatest + 0.28 + r() * 0.2);
  const revenue = years.map((_, i) => +(latestRev / Math.pow(1 + growth, years.length - 1 - i)).toFixed(1));
  const netMargin = years.map((_, i) => +((nmLatest - (years.length - 1 - i) * 0.012) * 100).toFixed(1));
  const grossMargin = years.map((_, i) => +((gmLatest - (years.length - 1 - i) * 0.008) * 100).toFixed(1));
  const netIncome = revenue.map((v, i) => +((v * netMargin[i]) / 100).toFixed(1));
  const ocf = netIncome.map((v) => +(v * (1.15 + r() * 0.3)).toFixed(1));
  const fcf = ocf.map((v) => +(v * (0.55 + r() * 0.3)).toFixed(1));
  const assets = Math.round(latestRev * (1.6 + r() * 1.2));
  const liab = Math.round(assets * (0.35 + r() * 0.25));
  const cash = Math.round(assets * (0.08 + r() * 0.12));
  const debt = Math.round(liab * (0.3 + r() * 0.3));
  const net = cash - debt;
  return {
    years,
    revenue,
    netIncome,
    grossMargin,
    netMargin,
    ocf,
    fcf,
    balance: [
      { label: "Total assets", value: `$${assets}B` },
      { label: "Total liabilities", value: `$${liab}B` },
      { label: "Shareholder equity", value: `$${assets - liab}B` },
      { label: "Cash & equivalents", value: `$${cash}B` },
      { label: "Total debt", value: `$${debt}B` },
      { label: "Net cash (debt)", value: net >= 0 ? `$${net}B` : `-$${-net}B` },
    ],
    ratios: [
      { label: "Market Cap", value: info.mcap === "—" ? "—" : "$" + info.mcap },
      { label: "P/E (TTM)", value: info.pe },
      { label: "EPS (TTM)", value: info.eps === "—" ? "—" : "$" + info.eps },
      { label: "Dividend Yield", value: info.div },
      { label: "ROCE", value: info.roce },
      { label: "ROE", value: info.roe },
      { label: "Beta", value: info.beta },
      { label: "Revenue CAGR (4y)", value: (growth * 100).toFixed(1) + "%" },
    ],
  };
}

/* ===== news ===== */

export type NewsCat = "earnings" | "ma" | "analysts" | "market";
export type NewsItem = { h: string; source: string; time: string; cat: NewsCat; rel: "high" | "med" | "low" };

export const NEWS_FILTERS: { key: NewsCat | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "earnings", label: "Earnings" },
  { key: "ma", label: "Mergers & acquisitions" },
  { key: "analysts", label: "Analysts" },
];

const NEWS_SOURCES = ["Reuters", "Bloomberg", "CNBC", "WSJ", "Barron's", "MarketWatch"];
const NEWS_TIMES = ["2h ago", "5h ago", "9h ago", "yesterday", "yesterday", "2 days ago", "3 days ago", "4 days ago", "last week", "last week"];

export function newsFor(ticker: string): NewsItem[] {
  const info = infoFor(ticker);
  const name = holdingFor(ticker)?.name ?? ticker;
  const r = rng("news:" + ticker);
  const own: NewsItem[] = info.news.map((n, i) => {
    const [source, time] = n.s.split(" · ");
    return { h: n.h, source, time: time ?? NEWS_TIMES[i], cat: "market", rel: n.r };
  });
  const tpl: { h: string; cat: NewsCat; rel: NewsItem["rel"] }[] = [
    { h: `${name} beats on revenue and EPS; raises full-year guidance`, cat: "earnings", rel: "high" },
    { h: `${ticker} earnings call: management flags AI-driven demand and capacity constraints`, cat: "earnings", rel: "med" },
    { h: `Analysts lift ${ticker} price targets after results; consensus turns constructive`, cat: "analysts", rel: "med" },
    { h: `${name} initiated at Overweight with a Street-high target`, cat: "analysts", rel: "low" },
    { h: `${name} reportedly in talks over bolt-on acquisition to expand its platform`, cat: "ma", rel: "med" },
    { h: `Deal chatter: ${ticker} named as a potential consolidator in sector M&A wave`, cat: "ma", rel: "low" },
    { h: `${name} announces expanded buyback authorization`, cat: "market", rel: "low" },
  ];
  const extra: NewsItem[] = tpl.map((t, i) => ({
    ...t,
    source: NEWS_SOURCES[Math.floor(r() * NEWS_SOURCES.length)],
    time: NEWS_TIMES[Math.min(i + own.length, NEWS_TIMES.length - 1)],
  }));
  return [...own, ...extra];
}

/* ===== notes (fund manager's trade journal) ===== */

export type Note = {
  date: string;
  action: "Entry" | "Add" | "Trim";
  title: string;
  body: string[];
  tags: string[];
  image?: { src: string; alt: string; caption: string };
};

export function notesFor(ticker: string): Note[] {
  if (ticker === "NVDA") {
    return [
      {
        date: "28 Jul 2026",
        action: "Entry",
        title: "Bought the channel-support retest",
        body: [
          "Entered here because NVDA was in an oversold place — the daily RSI printed sub-30 while price tagged the lower boundary of the 18-month ascending channel, then reclaimed the 50-day EMA within two sessions.",
          "Structure: the higher-lows channel from the May 2025 bottom is intact, and the $200–215 consolidation shelf has flipped to support. Invalidation is a daily close below the channel, around $188.",
          "Sized at ~9% of book. First target is the channel mid-line near $245; will reassess into the next earnings print.",
        ],
        tags: ["RSI oversold", "Channel support", "50 EMA reclaim", "Higher lows"],
        image: {
          src: "/notes/nvda-entry.png",
          alt: "NVDA daily chart with ascending channel and annotated entry",
          caption: "Daily chart at entry — ascending channel, entry annotated at channel support",
        },
      },
      {
        date: "02 Jun 2026",
        action: "Add",
        title: "Added 50 shares into the Blackwell ramp",
        body: [
          "Added on the post-earnings dip: data-center revenue keeps compounding and the sell-off was multiple compression, not a demand problem.",
          "Average cost moves to $147.63. Same invalidation as the core position.",
        ],
        tags: ["Earnings dip", "Thesis intact"],
      },
    ];
  }
  const info = infoFor(ticker);
  const h = holdingFor(ticker);
  const name = h?.name ?? ticker;
  return [
    {
      date: "14 Jul 2026",
      action: "Entry",
      title: `Why we own ${name}`,
      body: [...(h ? [`Position opened at an average of $${h.avg.toFixed(2)}. The core thesis:`] : []), ...info.facts],
      tags: [info.sector, "Fundamentals", "Manager note"],
    },
  ];
}

/* ===== community ===== */

export type Sentiment = "Bullish" | "Bearish" | "Neutral";
export type Comment = {
  user: string;
  color: string;
  time: string;
  sentiment: Sentiment;
  text: string;
  likes: number;
  replies: number;
};
export type Community = { bullishPct: number; total: number; comments: Comment[] };

const USERS = ["Maya T.", "Arjun V.", "Dana K.", "Leo M.", "Sofia R.", "Chris P.", "Nikhil S.", "Emma W."];
const C_TIMES = ["12m ago", "48m ago", "2h ago", "5h ago", "yesterday", "yesterday", "2 days ago", "3 days ago"];

const bullTexts = (t: string, name: string) => [
  `Adding to my ${t} position here — the risk/reward at this level is the best it's been all quarter.`,
  `${name} keeps executing. As long as the growth story holds I'm not selling a single share.`,
  `The pullback in ${t} is a gift. Fundamentals didn't change, only the multiple did.`,
];
const bearTexts = (t: string) => [
  `Valuation on ${t} assumes perfection. One soft guide and this re-rates hard.`,
  `Trimmed my ${t} today — crowded trade, and the recent insider selling doesn't help.`,
];
const neutralTexts = (t: string, name: string) => [
  `Waiting for ${t} earnings before doing anything. Interesting setup but I want confirmation.`,
  `Anyone have a view on how rates affect ${name} from here? Feels rangebound short term.`,
];

export function communityFor(ticker: string): Community {
  const r = rng("comm:" + ticker);
  const name = holdingFor(ticker)?.name ?? ticker;
  const bullishPct = 38 + Math.floor(r() * 50);
  const pools: [Sentiment, string[]][] = [
    ["Bullish", bullTexts(ticker, name)],
    ["Bearish", bearTexts(ticker)],
    ["Neutral", neutralTexts(ticker, name)],
  ];
  const comments: Comment[] = [];
  let u = Math.floor(r() * USERS.length);
  for (const [sentiment, texts] of pools) {
    for (const text of texts) {
      comments.push({
        user: USERS[u % USERS.length],
        color: COLORS[u % COLORS.length],
        time: C_TIMES[(u + comments.length) % C_TIMES.length],
        sentiment,
        text,
        likes: Math.floor(r() * 40),
        replies: Math.floor(r() * 8),
      });
      u++;
    }
  }
  comments.sort((a, b) => C_TIMES.indexOf(a.time) - C_TIMES.indexOf(b.time));
  return { bullishPct, total: 24 + Math.floor(r() * 90), comments };
}

// Recent comments across the fund's holdings — feeds the dashboard's
// Community activity card (replaces the Alpha ask box).
export type ActivityItem = Comment & { ticker: string };

export function recentCommunity(): ActivityItem[] {
  const tickers = ["NVDA", "AMD", "LLY", "NVO"];
  const times = ["8m ago", "32m ago", "1h ago", "3h ago"];
  return tickers.map((t, i) => {
    const c = communityFor(t);
    const cmt = c.comments[i % c.comments.length];
    return { ...cmt, ticker: t, time: times[i] };
  });
}
