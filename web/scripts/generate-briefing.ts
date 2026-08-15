// Daily AI market briefing generator.
//
// Claude (with web search) writes the prose — pulse, stories, bottom line — and
// picks the day's featured stock + dashboard movers. yahoo-finance2 supplies
// every number: live quote, stats grid, and real price series per chart range.
// Output: data/briefing/latest.json + data/briefing/archive/YYYY-MM-DD.json,
// matching the shape the /briefing page and dashboard strip render.
//
// Fails loudly (exit 1) on any error so the workflow keeps yesterday's JSON.
//
// Run: npx tsx --env-file=.env scripts/generate-briefing.ts   (local)
//      npx tsx scripts/generate-briefing.ts                   (CI, env var set)

import fs from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import YahooFinance from "yahoo-finance2";
import { z } from "zod";

const RANGES = ["1D", "5D", "1M", "6M", "YTD", "1Y", "5Y", "MAX"] as const;
type Range = (typeof RANGES)[number];

// ---------- 1. Claude writes the prose ----------

const Prose = z.object({
  date: z.string(), // "Friday, August 15, 2026"
  dateShort: z.string(), // "Fri, Aug 15"
  marketStatus: z.string(), // "Premarket" | "Market open" | "After hours" | "Closed"
  pulse: z.string(),
  pulseSources: z.array(z.string()),
  sections: z
    .array(
      z.object({
        title: z.string(),
        paragraphs: z.array(z.string()).min(1),
        whyItMatters: z.string(),
        whatNext: z.string(),
        sources: z.array(z.string()),
      }),
    )
    .min(4)
    .max(8),
  bottomLine: z.string(),
  bannerHeadlines: z.array(z.string()).min(3).max(5),
  featured: z.object({ ticker: z.string(), name: z.string() }),
  movers: z.array(z.object({ ticker: z.string() })).length(3),
});
type ProseT = z.infer<typeof Prose>;

async function generateProse(todayLong: string): Promise<ProseT> {
  const client = new Anthropic();
  const tools = [{ type: "web_search_20260209" as const, name: "web_search" as const, max_uses: 12 }];
  const system =
    "You are the research desk behind Meridian Capital's 'AI + Markets Daily Briefing'. " +
    "You write a sharp, factual premarket briefing about AI and the markets for retail investors. " +
    "Use web search to verify every number and headline — never rely on memory for prices, moves, or dates.";
  const user = `Today is ${todayLong} (US Central time). Research and write today's briefing.

Cover: the biggest AI news, market-moving announcements, notable stock moves (with real % figures), the macro backdrop, and one "Important-person trading watch" section on notable insider (SEC Form 4), fund-manager, or public-official trading activity.

Respond with ONLY a JSON object (no markdown fence, no commentary) of this exact shape:
{
  "date": "Friday, August 15, 2026",
  "dateShort": "Fri, Aug 15",
  "marketStatus": "Premarket",              // Premarket | Market open | After hours | Closed
  "pulse": "2-4 sentence market overview.", // **bold** the key numbers
  "pulseSources": ["Publisher names"],
  "sections": [                              // 5-6 stories; the insider-watch story LAST
    {
      "title": "Punchy headline",
      "paragraphs": ["1-2 paragraphs, **bold** key figures"],
      "whyItMatters": "1-3 sentences",
      "whatNext": "1-2 sentences on the next catalyst",
      "sources": ["Publisher names, not URLs"]
    }
  ],
  "bottomLine": "2-3 sentence takeaway with **bold** emphasis",
  "bannerHeadlines": ["3-4 compressed headlines for a dashboard ticker, <90 chars each"],
  "featured": { "ticker": "XXXX", "name": "Company name" },  // today's most newsworthy liquid US-listed stock
  "movers": [{ "ticker": "A" }, { "ticker": "B" }, { "ticker": "C" }]  // 3 US-listed tickers central to today's stories
}

Text fields are markdown-lite: **bold** only, no links or other markdown. All tickers must be plain US exchange symbols (usable with Yahoo Finance).`;

  let messages: Anthropic.MessageParam[] = [{ role: "user", content: user }];
  let response: Anthropic.Message;
  // web search runs server-side; pause_turn means "re-send to continue"
  for (let attempt = 0; ; attempt++) {
    const stream = client.messages.stream({
      model: "claude-opus-5",
      max_tokens: 32000,
      system,
      tools,
      messages,
    });
    response = await stream.finalMessage();
    if (response.stop_reason !== "pause_turn") break;
    if (attempt >= 5) throw new Error("Model never finished (pause_turn loop)");
    messages = [...messages, { role: "assistant", content: response.content }];
  }
  if (response.stop_reason === "refusal") throw new Error("Model refused the briefing request");

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error(`Model did not return JSON:\n${text.slice(0, 500)}`);
  return Prose.parse(JSON.parse(text.slice(start, end + 1)));
}

// ---------- 2. Yahoo Finance supplies the numbers ----------

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const DAY = 24 * 60 * 60 * 1000;
const RANGE_QUERY: Record<Range, { period1: Date; interval: "5m" | "30m" | "1d" | "1wk" | "1mo" }> = {
  "1D": { period1: new Date(Date.now() - 5 * DAY), interval: "5m" }, // trimmed to last session below
  "5D": { period1: new Date(Date.now() - 9 * DAY), interval: "30m" },
  "1M": { period1: new Date(Date.now() - 32 * DAY), interval: "1d" },
  "6M": { period1: new Date(Date.now() - 186 * DAY), interval: "1d" },
  YTD: { period1: new Date(new Date().getFullYear(), 0, 1), interval: "1d" },
  "1Y": { period1: new Date(Date.now() - 366 * DAY), interval: "1d" },
  "5Y": { period1: new Date(Date.now() - 5 * 366 * DAY), interval: "1wk" },
  MAX: { period1: new Date("1980-01-01"), interval: "1mo" },
};

const ET = "America/New_York";
function label(range: Range, d: Date): string {
  if (range === "1D") return d.toLocaleTimeString("en-US", { timeZone: ET, hour: "numeric", minute: "2-digit" });
  if (range === "5D")
    return d.toLocaleString("en-US", { timeZone: ET, weekday: "short", hour: "numeric", minute: "2-digit" });
  if (range === "5Y" || range === "MAX")
    return d.toLocaleDateString("en-US", { timeZone: ET, month: "short", year: "numeric" });
  return d.toLocaleDateString("en-US", { timeZone: ET, month: "short", day: "numeric" });
}

function downsample<T>(arr: T[], max = 64): T[] {
  if (arr.length <= max) return arr;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(arr[Math.round((i * (arr.length - 1)) / (max - 1))]);
  return out;
}

async function series(ticker: string, range: Range): Promise<{ labels: string[]; points: number[] }> {
  const { period1, interval } = RANGE_QUERY[range];
  const result = await yf.chart(ticker, { period1, interval });
  let quotes = result.quotes.filter((q) => q.close != null);
  if (range === "1D") {
    // keep only the most recent session
    const lastDay = new Date(quotes[quotes.length - 1].date).toLocaleDateString("en-US", { timeZone: ET });
    quotes = quotes.filter((q) => new Date(q.date).toLocaleDateString("en-US", { timeZone: ET }) === lastDay);
  }
  quotes = downsample(quotes);
  return {
    labels: quotes.map((q) => label(range, new Date(q.date))),
    points: quotes.map((q) => Number(q.close!.toFixed(2))),
  };
}

function fmtBig(n: number | undefined): string {
  if (n == null) return "—";
  if (n >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  return n.toLocaleString("en-US");
}
const fmt2 = (n: number | undefined) => (n == null ? "—" : n.toFixed(2));

async function buildFeatured(ticker: string, fallbackName: string) {
  const q = await yf.quote(ticker);
  const allRanges = await Promise.all(RANGES.map(async (r) => [r, await series(ticker, r)] as const));
  const time = q.regularMarketTime ? new Date(q.regularMarketTime) : new Date();
  return {
    ticker,
    name: q.longName ?? q.shortName ?? fallbackName,
    price: q.regularMarketPrice ?? 0,
    change: q.regularMarketChange ?? 0,
    changePct: q.regularMarketChangePercent ?? 0,
    asOf: time.toLocaleDateString("en-US", { timeZone: ET, month: "short", day: "numeric" }),
    afterHours:
      q.postMarketPrice != null
        ? { price: q.postMarketPrice, change: q.postMarketChange ?? 0, changePct: q.postMarketChangePercent ?? 0 }
        : null,
    stats: [
      { label: "Open", value: fmt2(q.regularMarketOpen) },
      { label: "Day Low", value: fmt2(q.regularMarketDayLow) },
      { label: "Day High", value: fmt2(q.regularMarketDayHigh) },
      { label: "Volume", value: fmtBig(q.regularMarketVolume) },
      { label: "Year Low", value: fmt2(q.fiftyTwoWeekLow) },
      { label: "Year High", value: fmt2(q.fiftyTwoWeekHigh) },
      { label: "Market Cap (TTM)", value: fmtBig(q.marketCap) },
      { label: "EPS (TTM)", value: fmt2(q.epsTrailingTwelveMonths) },
      { label: "P/E Ratio (TTM)", value: fmt2(q.trailingPE) },
    ],
    series: Object.fromEntries(allRanges) as Record<Range, { labels: string[]; points: number[] }>,
  };
}

// ---------- 3. Compose + write ----------

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");

  const CT = "America/Chicago";
  const now = new Date();
  const todayLong = now.toLocaleDateString("en-US", {
    timeZone: CT,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  console.log("Generating prose with Claude…");
  const prose = await generateProse(todayLong);
  console.log(`Featured: ${prose.featured.ticker}, movers: ${prose.movers.map((m) => m.ticker).join(", ")}`);

  console.log("Fetching market data from Yahoo Finance…");
  const [featured, moverQuotes] = await Promise.all([
    buildFeatured(prose.featured.ticker, prose.featured.name),
    Promise.all(prose.movers.map((m) => yf.quote(m.ticker))),
  ]);

  const briefing = {
    generatedAt: now.toISOString(),
    date: prose.date,
    dateShort: prose.dateShort,
    marketStatus: prose.marketStatus,
    pulse: prose.pulse,
    pulseSources: prose.pulseSources,
    sections: prose.sections,
    bottomLine: prose.bottomLine,
    banner: {
      headlines: prose.bannerHeadlines,
      movers: moverQuotes.map((q) => ({
        ticker: q.symbol,
        chg: Number((q.regularMarketChangePercent ?? 0).toFixed(2)),
      })),
    },
    featured,
  };

  const dir = path.join(process.cwd(), "data", "briefing");
  await fs.mkdir(path.join(dir, "archive"), { recursive: true });
  const json = JSON.stringify(briefing, null, 2) + "\n";
  await fs.writeFile(path.join(dir, "latest.json"), json);
  const ymd = now.toLocaleDateString("en-CA", { timeZone: CT }); // YYYY-MM-DD
  await fs.writeFile(path.join(dir, "archive", `${ymd}.json`), json);
  console.log(`Wrote data/briefing/latest.json + archive/${ymd}.json (${prose.sections.length} stories)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
