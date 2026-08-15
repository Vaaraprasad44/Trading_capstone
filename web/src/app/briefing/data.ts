// Daily briefing types + loader. The content is generated each morning by
// scripts/generate-briefing.ts (Claude + Yahoo Finance) via the briefing
// GitHub Action, which commits data/briefing/latest.json. In production we
// fetch that file from raw.githubusercontent so the deployed app picks up the
// day's briefing without a redeploy (bot commits don't trigger deploy.yml);
// the committed copy baked in at build time is the fallback.
// Text fields are markdown-lite: **bold** only.

import committed from "../../../data/briefing/latest.json";

export type BriefingSection = {
  title: string;
  paragraphs: string[];
  whyItMatters?: string;
  whatNext?: string;
  sources?: string[];
};

export type FeaturedRange = "1D" | "5D" | "1M" | "6M" | "YTD" | "1Y" | "5Y" | "MAX";

export const FEATURED_RANGES: FeaturedRange[] = ["1D", "5D", "1M", "6M", "YTD", "1Y", "5Y", "MAX"];

export type RangeSeries = { labels: string[]; points: number[] };

export type Featured = {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  asOf: string;
  afterHours: { price: number; change: number; changePct: number } | null;
  stats: { label: string; value: string }[];
  series: Record<FeaturedRange, RangeSeries>;
};

export type Briefing = {
  generatedAt: string;
  date: string;
  dateShort: string;
  marketStatus: string;
  pulse: string;
  pulseSources: string[];
  sections: BriefingSection[];
  bottomLine: string;
  banner: { headlines: string[]; movers: { ticker: string; chg: number }[] };
  featured: Featured;
};

const RAW_URL =
  "https://raw.githubusercontent.com/Vaaraprasad44/Trading_capstone/main/web/data/briefing/latest.json";

export async function getBriefing(): Promise<Briefing> {
  try {
    const res = await fetch(RAW_URL, { next: { revalidate: 3600 } });
    if (res.ok) return (await res.json()) as Briefing;
  } catch {
    // offline / rate-limited — fall through to the build-time copy
  }
  return committed as unknown as Briefing;
}

// View-model for the dashboard's Daily AI briefing strip.
export function bannerFrom(b: Briefing) {
  return {
    tag: "Daily AI briefing",
    dateShort: b.dateShort,
    storyCount: b.sections.length,
    headlines: b.banner.headlines,
    movers: b.banner.movers,
  };
}

export type BannerStrip = ReturnType<typeof bannerFrom>;
