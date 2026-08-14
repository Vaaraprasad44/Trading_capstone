// Demo data + math ported from the HTML prototype. Hard-wired on purpose —
// this is the mock dataset until the dashboard is wired to /api.

export type FundKey = "alpha" | "sip" | "swing";

export type Holding = {
  ticker: string;
  name: string;
  qty: number;
  avg: number;
  ltp: number;
  day: number;
};

export type ComputedHolding = Holding & {
  buyValue: number;
  presentValue: number;
  pnl: number;
  pnlPct: number;
  allocation: number;
};

export type ClosedTrade = {
  ticker: string;
  dir: "Long" | "Short";
  entry: number;
  exit: number;
  qty: number;
  inDate: string;
  outDate: string;
  days: number;
  pnl: number;
  ret: number;
};

export const COLORS = [
  "#4e4feb", "#189e6a", "#e8911c", "#e0413a", "#0ea5e9", "#a855f7", "#ec4899",
  "#14b8a6", "#f59e0b", "#6366f1", "#84cc16", "#f43f5e", "#06b6d4", "#8b5cf6",
];

export const alphaHoldings: Holding[] = [
  { ticker: "NVDA", name: "NVIDIA Corp", qty: 313.37, avg: 147.63, ltp: 192.53, day: -1.64 },
  { ticker: "MSFT", name: "Microsoft Corp", qty: 259.03, avg: 415.95, ltp: 372.97, day: 5.71 },
  { ticker: "META", name: "Meta Platforms Inc", qty: 223.2, avg: 600.28, ltp: 550.25, day: 1.36 },
  { ticker: "GOOGL", name: "Alphabet Inc", qty: 220.93, avg: 175.07, ltp: 337.39, day: -1.84 },
  { ticker: "AMZN", name: "Amazon.com Inc", qty: 273.6, avg: 209.72, ltp: 232.69, day: 2.5 },
  { ticker: "LLY", name: "Eli Lilly and Co", qty: 46.85, avg: 819.0, ltp: 1208.12, day: 7.13 },
  { ticker: "TSM", name: "Taiwan Semiconductor", qty: 87.25, avg: 186.81, ltp: 432.35, day: -0.61 },
  { ticker: "AMD", name: "Advanced Micro Devices", qty: 49.82, avg: 123.83, ltp: 521.58, day: -2.06 },
  { ticker: "PANW", name: "Palo Alto Networks", qty: 116.6, avg: 173.85, ltp: 304.2, day: 3.79 },
  { ticker: "UNH", name: "UnitedHealth Group", qty: 71.09, avg: 307.22, ltp: 427.89, day: 2.97 },
  { ticker: "NVO", name: "Novo Nordisk A/S", qty: 766.02, avg: 66.41, ltp: 48.07, day: 0.9 },
  { ticker: "CRWD", name: "Crowdstrike Holdings", qty: 44.48, avg: 423.54, ltp: 701.09, day: 3.31 },
];

export const sipHoldings: Holding[] = [
  { ticker: "VOO", name: "Vanguard S&P 500 ETF", qty: 62.4, avg: 430.1, ltp: 512.3, day: 0.62 },
  { ticker: "QQQ", name: "Invesco QQQ Trust", qty: 28.1, avg: 388.4, ltp: 472.1, day: 0.94 },
  { ticker: "MSFT", name: "Microsoft Corp", qty: 18.5, avg: 360.2, ltp: 372.97, day: 5.71 },
  { ticker: "AAPL", name: "Apple Inc", qty: 40.2, avg: 178.3, ltp: 192.45, day: 0.8 },
  { ticker: "JNJ", name: "Johnson & Johnson", qty: 22.0, avg: 152.1, ltp: 161.4, day: 0.34 },
];

export const swingOpen: Holding[] = [
  { ticker: "TSLA", name: "Tesla Inc", qty: 120, avg: 179.4, ltp: 188.2, day: 3.4 },
  { ticker: "RKLB", name: "Rocket Lab", qty: 900, avg: 71.2, ltp: 84.54, day: 4.77 },
  { ticker: "COIN", name: "Coinbase Global", qty: 60, avg: 241.1, ltp: 228.7, day: -2.1 },
];

const closedRaw = [
  { ticker: "NVDA", dir: "Long", entry: 172.3, exit: 191.8, qty: 80, inDate: "02 Jun", outDate: "09 Jun", days: 7 },
  { ticker: "SOFI", dir: "Long", entry: 16.4, exit: 18.33, qty: 1200, inDate: "28 May", outDate: "05 Jun", days: 8 },
  { ticker: "PLTR", dir: "Long", entry: 38.1, exit: 35.9, qty: 400, inDate: "24 May", outDate: "30 May", days: 6 },
  { ticker: "AMD", dir: "Long", entry: 148.5, exit: 171.2, qty: 90, inDate: "18 May", outDate: "27 May", days: 9 },
  { ticker: "HOOD", dir: "Long", entry: 82.1, exit: 93.04, qty: 300, inDate: "12 May", outDate: "21 May", days: 9 },
  { ticker: "INTC", dir: "Short", entry: 34.2, exit: 31.1, qty: 500, inDate: "09 May", outDate: "15 May", days: 6 },
  { ticker: "TSLA", dir: "Long", entry: 168.0, exit: 162.4, qty: 100, inDate: "02 May", outDate: "07 May", days: 5 },
  { ticker: "MSTR", dir: "Long", entry: 1280.0, exit: 1455.0, qty: 8, inDate: "25 Apr", outDate: "06 May", days: 11 },
] as const;

export const swingClosed: ClosedTrade[] = closedRaw.map((t) => {
  const pnl = (t.dir === "Short" ? t.entry - t.exit : t.exit - t.entry) * t.qty;
  const ret = (t.dir === "Short" ? (t.entry - t.exit) / t.entry : (t.exit - t.entry) / t.entry) * 100;
  return { ...t, pnl, ret };
});

export type Activity = {
  type: "buy" | "sell";
  logo: string;
  color: string;
  action: string;
  qty: string;
  ticker: string;
  price: string;
  alloc: string;
  date: string;
};

export const activity: Activity[] = [
  { type: "sell", logo: "HOOD", color: "#0ea5e9", action: "Sold", qty: "110", ticker: "HOOD", price: "$93.04", alloc: "0%", date: "18 Jun 2026" },
  { type: "sell", logo: "SOFI", color: "#6366f1", action: "Sold", qty: "475", ticker: "SOFI", price: "$18.33", alloc: "0%", date: "14 Jun 2026" },
  { type: "buy", logo: "LLY", color: "#e0413a", action: "Bought", qty: "12", ticker: "LLY", price: "$1,150", alloc: "4.5%", date: "05 Jun 2026" },
  { type: "buy", logo: "NVDA", color: "#189e6a", action: "Bought", qty: "50", ticker: "NVDA", price: "$180.20", alloc: "9.1%", date: "02 Jun 2026" },
];

export type StockInfo = {
  sector: string;
  mcap: string;
  pe: string;
  eps: string;
  div: string;
  hi: string;
  lo: string;
  roce: string;
  roe: string;
  beta: string;
  facts: string[];
  news: { r: "high" | "med" | "low"; h: string; s: string }[];
};

const STOCK_INFO: Record<string, StockInfo> = {
  NVDA: {
    sector: "Semiconductors", mcap: "2.15T", pe: "58.4", eps: "3.30", div: "0.02%", hi: "195.95", lo: "86.62",
    roce: "61.2%", roe: "91.5%", beta: "1.68",
    facts: [
      "Data-center revenue grew ~150% YoY on AI accelerator demand; Blackwell ramp is the next catalyst.",
      "Gross margins near 75% — among the highest in large-cap tech.",
      "Customer concentration risk: a handful of hyperscalers drive most data-center sales.",
    ],
    news: [
      { r: "high", h: "NVIDIA Blackwell shipments accelerate; Q3 guidance raised", s: "Reuters · 2h ago" },
      { r: "high", h: "Major cloud provider signs multi-year GPU supply deal", s: "Bloomberg · 6h ago" },
      { r: "med", h: "Analysts lift price targets ahead of earnings", s: "Zacks · 1d ago" },
    ],
  },
  META: {
    sector: "Internet Software", mcap: "1.40T", pe: "24.1", eps: "22.80", div: "0.39%", hi: "638.40", lo: "442.65",
    roce: "26.4%", roe: "34.9%", beta: "1.21",
    facts: [
      "Ad revenue reaccelerating on AI-driven targeting and Reels monetization.",
      "Heavy AI capex ($740B class) pressures near-term free cash flow.",
      "Regulatory overhang: youth-safety laws in AU/US target the platform.",
    ],
    news: [
      { r: "high", h: "US urges Meta AI review; Muse Spark rollout expands", s: "Dow Jones · 6h ago" },
      { r: "high", h: "Australia plans law to block under-16 social media access", s: "Reuters · 7h ago" },
      { r: "med", h: "Meta struck 2,609MW power deals; $21B CoreWeave compute", s: "TradingView · 1d ago" },
    ],
  },
  MSFT: {
    sector: "Software", mcap: "2.77T", pe: "31.5", eps: "11.80", div: "0.78%", hi: "468.35", lo: "366.50",
    roce: "29.8%", roe: "38.5%", beta: "0.90",
    facts: [
      "Azure growth driven by AI workloads and Copilot adoption across the suite.",
      "Diversified revenue: cloud, productivity, gaming reduce single-segment risk.",
      "Capex rising sharply to build out AI data centers.",
    ],
    news: [
      { r: "med", h: "Copilot enterprise seat count crosses new milestone", s: "CNBC · 4h ago" },
      { r: "med", h: "Azure AI region expansion announced", s: "Reuters · 1d ago" },
      { r: "low", h: "Microsoft raises dividend by 10%", s: "Bloomberg · 2d ago" },
    ],
  },
  TSLA: {
    sector: "Automobiles", mcap: "585B", pe: "68.2", eps: "2.68", div: "—", hi: "278.98", lo: "138.80",
    roce: "10.2%", roe: "20.4%", beta: "2.29",
    facts: [
      "Deliveries under pressure from price competition in China and the EU.",
      "Energy storage and FSD are the long-term growth narratives.",
      "High beta — moves sharply on Musk headlines and macro sentiment.",
    ],
    news: [
      { r: "high", h: "Tesla cuts prices in key markets to defend share", s: "Reuters · 3h ago" },
      { r: "med", h: "Robotaxi event date floated by management", s: "Electrek · 1d ago" },
      { r: "low", h: "Energy storage deployments hit record", s: "Bloomberg · 2d ago" },
    ],
  },
  GOOGL: {
    sector: "Interactive Media", mcap: "2.10T", pe: "26.8", eps: "7.50", div: "0.45%", hi: "341.20", lo: "159.40",
    roce: "28.1%", roe: "30.8%", beta: "1.05",
    facts: [
      "Search remains resilient; Gemini integration defends query share.",
      "Cloud profitability inflecting positive.",
      "Antitrust rulings are the key risk to the ad business.",
    ],
    news: [
      { r: "high", h: "Court ruling on ad-tech remedies expected soon", s: "WSJ · 5h ago" },
      { r: "med", h: "Gemini usage climbs across Workspace", s: "The Verge · 1d ago" },
      { r: "low", h: "YouTube ad revenue beats estimates", s: "CNBC · 2d ago" },
    ],
  },
  AMZN: {
    sector: "E-commerce", mcap: "2.45T", pe: "42.0", eps: "5.54", div: "—", hi: "242.50", lo: "151.60",
    roce: "14.9%", roe: "21.9%", beta: "1.15",
    facts: [
      "AWS reacceleration is the main profit driver; retail margins improving.",
      "Advertising is a fast-growing, high-margin third pillar.",
      "Capex elevated for AI infrastructure.",
    ],
    news: [
      { r: "med", h: "AWS announces new AI inference chips", s: "Reuters · 4h ago" },
      { r: "med", h: "Prime membership growth steady", s: "Bloomberg · 1d ago" },
      { r: "low", h: "Logistics network expansion continues", s: "CNBC · 2d ago" },
    ],
  },
  LLY: {
    sector: "Pharmaceuticals", mcap: "1.09T", pe: "58.7", eps: "20.60", div: "0.50%", hi: "1,260.00", lo: "711.40",
    roce: "38.2%", roe: "59.4%", beta: "0.41",
    facts: [
      "GLP-1 franchise (Mounjaro/Zepbound) drives outsized revenue growth; supply is the constraint, not demand.",
      "Pipeline depth in obesity and Alzheimer's supports the premium multiple.",
    ],
    news: [
      { r: "high", h: "Zepbound supply expansion ahead of schedule", s: "Reuters · 5h ago" },
      { r: "med", h: "Oral GLP-1 trial data expected this quarter", s: "Bloomberg · 1d ago" },
    ],
  },
  TSM: {
    sector: "Semiconductors", mcap: "2.24T", pe: "32.5", eps: "13.30", div: "1.05%", hi: "448.00", lo: "134.25",
    roce: "32.6%", roe: "30.1%", beta: "1.28",
    facts: [
      "Effective monopoly on leading-edge AI chip manufacturing; N2 ramp fully booked.",
      "Geopolitical concentration in Taiwan is the structural risk premium.",
    ],
    news: [
      { r: "high", h: "TSMC monthly revenue jumps on AI accelerator demand", s: "Reuters · 8h ago" },
      { r: "med", h: "Arizona fab yields approach Taiwan parity", s: "Nikkei · 2d ago" },
    ],
  },
  AMD: {
    sector: "Semiconductors", mcap: "845B", pe: "96.3", eps: "5.42", div: "—", hi: "552.20", lo: "76.48",
    roce: "8.9%", roe: "9.6%", beta: "1.97",
    facts: [
      "MI-series accelerators are the credible #2 to Nvidia; hyperscaler design wins accelerating.",
      "Valuation prices in significant AI share gains — execution risk is high.",
    ],
    news: [
      { r: "high", h: "AMD lands new hyperscaler MI400 commitment", s: "Reuters · 6h ago" },
      { r: "med", h: "ROCm software stack closes gap with CUDA", s: "The Information · 1d ago" },
    ],
  },
  PANW: {
    sector: "Cybersecurity", mcap: "210B", pe: "58.9", eps: "5.17", div: "—", hi: "318.50", lo: "142.01",
    roce: "11.4%", roe: "21.7%", beta: "1.10",
    facts: [
      "Platformization strategy consolidates security spend onto fewer vendors — PANW is a net winner.",
      "AI-agent security is an emerging product line and TAM expander.",
    ],
    news: [
      { r: "med", h: "Palo Alto expands AI security suite", s: "CNBC · 7h ago" },
      { r: "low", h: "Analyst day sets FY30 platform targets", s: "Barron's · 3d ago" },
    ],
  },
  UNH: {
    sector: "Managed Health", mcap: "396B", pe: "18.9", eps: "22.64", div: "2.05%", hi: "458.10", lo: "234.60",
    roce: "15.8%", roe: "24.3%", beta: "0.55",
    facts: [
      "Medical cost trend is stabilizing after two rough years; margin recovery underway.",
      "Optum remains the structural growth engine; regulatory scrutiny is the overhang.",
    ],
    news: [
      { r: "med", h: "UnitedHealth reaffirms full-year outlook", s: "Reuters · 1d ago" },
      { r: "low", h: "Medicare Advantage rates finalized for 2027", s: "WSJ · 3d ago" },
    ],
  },
  NVO: {
    sector: "Pharmaceuticals", mcap: "214B", pe: "12.4", eps: "3.88", div: "3.60%", hi: "91.20", lo: "42.30",
    roce: "46.1%", roe: "71.2%", beta: "0.87",
    facts: [
      "Wegovy share losses to Lilly compressed the multiple; now trades like a value stock.",
      "Next-gen obesity pipeline (amycretin) is the re-rating catalyst — or the thesis breaker.",
    ],
    news: [
      { r: "high", h: "Novo cuts guidance again on US obesity pricing", s: "Reuters · 4h ago" },
      { r: "med", h: "Amycretin phase 3 enrollment completes", s: "Bloomberg · 2d ago" },
    ],
  },
  CRWD: {
    sector: "Cybersecurity", mcap: "174B", pe: "118.5", eps: "5.92", div: "—", hi: "745.00", lo: "385.10",
    roce: "4.2%", roe: "8.9%", beta: "1.16",
    facts: [
      "Falcon platform ARR compounding ~30%; module attach rates keep rising.",
      "Premium multiple leaves no room for growth deceleration.",
    ],
    news: [
      { r: "med", h: "CrowdStrike ARR beats; NRR ticks up", s: "CNBC · 1d ago" },
      { r: "low", h: "New agentic-AI SOC product announced", s: "TechCrunch · 2d ago" },
    ],
  },
};

export function infoFor(t: string): StockInfo {
  return (
    STOCK_INFO[t] ?? {
      sector: "Equity", mcap: "—", pe: "—", eps: "—", div: "—", hi: "—", lo: "—",
      roce: "—", roe: "—", beta: "—",
      facts: [
        `AI summary would appear here, generated from the latest filings and price action for ${t}.`,
        "Fundamentals are pulled live from a market-data MCP source.",
        "News relevance is ranked by the AI relevance-filter Skill.",
      ],
      news: [
        { r: "med", h: `Latest headline for ${t} would appear here`, s: "News MCP · today" },
        { r: "low", h: `Second most-relevant story for ${t}`, s: "News MCP · today" },
      ],
    }
  );
}

export const HERO: Record<FundKey, { pre: string; accent: string; sub: string; badge: string; badgeBg: string; badgeColor: string }> = {
  alpha: {
    pre: "Hi preetham, welcome to the ",
    accent: "$1M Alpha Fund",
    sub: "Long-term, high-conviction compounding. Hefty capital deployed and left to grow.",
    badge: "Long-term investing",
    badgeBg: "var(--brand-soft)",
    badgeColor: "var(--brand)",
  },
  sip: {
    pre: "Hi preetham, welcome to the ",
    accent: "Smart SIP Fund",
    sub: "Disciplined monthly investing. Dollar-cost average into quality, ride the compounding.",
    badge: "Systematic monthly investing",
    badgeBg: "var(--up-soft)",
    badgeColor: "var(--up)",
  },
  swing: {
    pre: "Hi preetham, welcome to the ",
    accent: "Swing Trading Fund",
    sub: "Short-term, higher-risk trades. My specialty — captured moves over days to weeks.",
    badge: "Active swing trading",
    badgeBg: "var(--amber-soft)",
    badgeColor: "var(--amber)",
  },
};

/* ============ helpers ============ */
export const usd = (n: number) => "$" + Math.round(n).toLocaleString();
export const usd2 = (n: number) =>
  "$" + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const pct = (n: number) => (n >= 0 ? "+" : "") + Number(n).toFixed(2) + "%";

export function computeHoldings(holdings: Holding[]): ComputedHolding[] {
  const withValues = holdings.map((h) => ({ ...h, buyValue: h.qty * h.avg, presentValue: h.qty * h.ltp }));
  const total = withValues.reduce((s, h) => s + h.presentValue, 0);
  return withValues.map((h) => ({
    ...h,
    pnl: h.presentValue - h.buyValue,
    pnlPct: (h.ltp / h.avg - 1) * 100,
    allocation: (h.presentValue / total) * 100,
  }));
}

// Deterministic mock series (same generator as the prototype)
export function series(points: number, start: number, vol: number, drift: number): number[] {
  const out: number[] = [];
  let v = start;
  for (let i = 0; i < points; i++) {
    v = v * (1 + Math.sin(i * 1.3) * vol + drift);
    out.push(Math.round(v));
  }
  return out;
}
