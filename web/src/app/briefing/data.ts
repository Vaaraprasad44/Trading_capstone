// Placeholder briefing content, hand-written to mirror the output shape of the
// ai-markets-briefing headless agent (Claude Code + WebSearch/WebFetch, run on a
// schedule before market open). Once that pipeline exists it will publish this
// same structure daily — via an API route or MCP — and the page renders whatever
// lands here. Text fields are markdown-lite: **bold** only.

export type BriefingSection = {
  title: string;
  paragraphs: string[];
  whyItMatters?: string;
  whatNext?: string;
  sources?: string[];
};

export type FeaturedRange = "1D" | "5D" | "1M" | "6M" | "YTD" | "1Y" | "5Y" | "MAX";

export const FEATURED_RANGES: FeaturedRange[] = ["1D", "5D", "1M", "6M", "YTD", "1Y", "5Y", "MAX"];

export const briefing = {
  date: "Friday, August 7, 2026",
  dateShort: "Fri, Aug 7",
  marketStatus: "Premarket",
  pulse:
    "U.S. futures are modestly higher ahead of Friday's open. Thursday's session ended with the **S&P 500 up 0.7%, Dow up 0.5% and Nasdaq up 1%**, but the headline indexes concealed sharp divergences: **Amazon surged 15.3%** on an AWS re-acceleration, **Apple dropped 7.1%** on soft guidance, **Nvidia gained 3%**, and the semiconductor ETF **SOXX finished flat** after giving back an early rally. The **10-year Treasury yield sits at 4.18%** and oil is steady — today's tone is set by earnings, not macro.",
  pulseSources: ["AP News"],
  sections: [
    {
      title: "Amazon and Apple crystallize the market's new AI rule",
      paragraphs: [
        "Amazon's **15.3% rally** reflected accelerating AWS growth (**+24% y/y**) and evidence that its enormous infrastructure spending is generating revenue and operating profit. Apple's **7.1% decline** followed weaker-than-expected forward guidance and warnings that AI-driven demand for advanced chips and memory is creating supply constraints and margin pressure.",
      ],
      whyItMatters:
        "Investors are no longer treating all AI spending — or all large technology companies — the same. Companies demonstrating near-term cloud revenue and contracted demand are being rewarded, while companies exposed to AI-related costs without clear monetization are being punished.",
      whatNext:
        "Whether AWS can sustain growth as Amazon's capital spending rises, and whether Apple can secure components without sacrificing margins, product availability or pricing.",
      sources: ["The Wall Street Journal", "AP News"],
    },
    {
      title: "DeepSeek ships a stronger agent model as AI competition accelerates",
      paragraphs: [
        "DeepSeek released **DeepSeek-V4-Flash** into public API beta Thursday. The company says the updated model has substantially stronger coding, terminal-use and tool-using capabilities at the same price, and that the full **V4-Pro** release will follow within weeks.",
      ],
      whyItMatters:
        "The market reads cheap, capable open-weight agent models as margin pressure on Western labs' API businesses — and as a demand signal for inference compute. US AI software names traded off on the headline while inference-exposed infrastructure held up.",
      whatNext:
        "Third-party benchmark verification, and whether the big labs respond with price cuts into the fall enterprise procurement cycle.",
      sources: ["DeepSeek API Docs", "Reuters"],
    },
    {
      title: "Micron raises HBM pricing — memory is the AI bottleneck again",
      paragraphs: [
        "Micron notified customers of a **~12% price increase on HBM3E** supply for Q4 delivery, citing fully booked capacity through 2027. **Micron rose 4.2%**; SK Hynix and Samsung both gained in Seoul.",
      ],
      whyItMatters:
        "The market is rewarding scarcity. High-bandwidth memory is the tightest link in the AI-server supply chain, and pricing power there flows straight to gross margin — but it also raises input costs for Nvidia-class accelerators and, eventually, hyperscaler capex budgets.",
      whatNext:
        "Nvidia's next data-center revenue print, and any hyperscaler commentary on whether rising memory costs slow the pace of cluster buildouts.",
      sources: ["Reuters"],
    },
    {
      title: "Macro check: yields drift lower into a quiet data day",
      paragraphs: [
        "The **10-year Treasury yield eased to 4.18%** after Thursday's soft jobless-claims print, and fed-funds futures now price a **~70% chance of a September cut**. **WTI crude sits near $71** with no fresh geopolitical catalyst.",
      ],
      whyItMatters:
        "Lower yields are doing quiet work for the AI trade — long-duration tech multiples are the first beneficiary of easing rate expectations. The key risk is that next week's CPI re-prices the September cut.",
      whatNext: "July CPI next Wednesday; three Fed speakers on the tape today.",
      sources: ["CNBC"],
    },
    {
      title: "Important-person trading watch",
      paragraphs: [
        "One trade stands out in Thursday's Form 4 flow: the **CEO of a mid-cap data-center power supplier bought $2.1M of stock on the open market** (transaction code **P**) after a 30% post-earnings drawdown — a genuine conviction signal, not a grant. Separately, **ARK funds added to their AMD position** for a third straight session; that is fund-manager flow, not insider buying. No notable public-official disclosures hit overnight.",
      ],
      whyItMatters:
        "Open-market insider purchases into weakness are one of the few high-signal trades in the disclosure tape — grants, RSUs and automatic sales are noise by comparison.",
      whatNext:
        "The 13F window opens next week; watch for Q2 position reveals from Berkshire, Appaloosa and Coatue.",
      sources: ["SEC EDGAR", "ARK Trade Notifications"],
    },
  ] as BriefingSection[],
  bottomLine:
    "The market's AI rule is now explicit: **show monetization or get repriced**. The key risk into next week is a hot CPI unwinding the September-cut trade; the next catalysts are Nvidia's data-center print and the opening of the 13F window.",
};

export const featured = {
  ticker: "AMZN",
  name: "Amazon.com Inc.",
  price: 271.58,
  change: 35.92,
  changePct: 15.25,
  asOf: "Aug 6",
  afterHours: { price: 270.29, change: -1.29, changePct: -0.47 },
  // column-major: rendered top-to-bottom, then next column (like a quote card)
  stats: [
    { label: "Open", value: "265.00" },
    { label: "Day Low", value: "259.09" },
    { label: "Day High", value: "273.20" },
    { label: "Volume", value: "129.1M" },
    { label: "Year Low", value: "196.00" },
    { label: "Year High", value: "278.56" },
    { label: "Market Cap (TTM)", value: "2.95T" },
    { label: "EPS (TTM)", value: "12.43" },
    { label: "P/E Ratio (TTM)", value: "32.49" },
  ],
};

// Deterministic fake price series per range (no randomness — stable across
// SSR/CSR and re-renders). Every range ends at the featured price.
const RANGE_CFG: Record<FeaturedRange, { n: number; start: number; wobble: number }> = {
  "1D": { n: 48, start: 265.0, wobble: 1.1 },
  "5D": { n: 40, start: 236.2, wobble: 2.4 },
  "1M": { n: 44, start: 228.5, wobble: 3.2 },
  "6M": { n: 52, start: 206.4, wobble: 5.5 },
  YTD: { n: 60, start: 219.3, wobble: 4.8 },
  "1Y": { n: 60, start: 196.0, wobble: 6.5 },
  "5Y": { n: 72, start: 128.7, wobble: 9.0 },
  MAX: { n: 80, start: 18.4, wobble: 12.0 },
};

export function featuredSeries(range: FeaturedRange): { labels: string[]; points: number[] } {
  const cfg = RANGE_CFG[range];
  const end = featured.price;
  const points: number[] = [];
  for (let i = 0; i < cfg.n; i++) {
    const t = i / (cfg.n - 1);
    const base = cfg.start + (end - cfg.start) * Math.pow(t, 0.8);
    const w = (Math.sin(i * 1.9) + Math.sin(i * 0.53 + 2)) * cfg.wobble * (1 - t * 0.5);
    points.push(Number((base + w).toFixed(2)));
  }
  points[points.length - 1] = end;
  const labels = points.map((_, i) => {
    if (range !== "1D") return "";
    const mins = 9 * 60 + 30 + Math.round((i * 390) / (cfg.n - 1));
    const h24 = Math.floor(mins / 60);
    const m = mins % 60;
    const h12 = ((h24 + 11) % 12) + 1;
    return `${h12}:${String(m).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
  });
  return { labels, points };
}

// Teaser shown by the dashboard's Daily AI briefing strip before click-through.
export const banner = {
  tag: "Daily AI briefing",
  dateShort: briefing.dateShort,
  storyCount: briefing.sections.length,
  headlines: [
    "Amazon and Apple crystallize the market's new AI rule",
    "DeepSeek ships a stronger agent model as AI competition accelerates",
    "Micron raises HBM pricing — memory is the AI bottleneck again",
    "Insider watch: a $2.1M open-market CEO buy in data-center power",
  ],
  movers: [
    { ticker: "AMZN", chg: 15.3 },
    { ticker: "AAPL", chg: -7.1 },
    { ticker: "NVDA", chg: 3.0 },
  ],
};
