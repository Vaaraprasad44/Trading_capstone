// Market data via Yahoo Finance's public chart API.
// ponytail: unofficial keyless endpoint — prototype-grade by decision
// (docs/FUND-ATTRIBUTION.md). All Yahoo details stay inside this module;
// swapping to Polygon/Finnhub later touches only this file.
const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }

export type Quote = {
  symbol: string
  name: string | null
  price: number
  prevClose: number | null
  dayPct: number | null
  wk52High: number | null
  wk52Low: number | null
}

type ChartMeta = {
  symbol: string
  longName?: string
  shortName?: string
  regularMarketPrice: number
  chartPreviousClose?: number
  previousClose?: number
  fiftyTwoWeekHigh?: number
  fiftyTwoWeekLow?: number
}
type ChartResult = {
  meta: ChartMeta
  timestamp?: number[]
  indicators: { quote: { close: (number | null)[]; volume?: (number | null)[] }[] }
}

// ponytail: in-memory TTL cache — enough to be polite to Yahoo from one
// server process; move to the DB if we ever run many replicas.
const cache = new Map<string, { at: number; data: unknown }>()
async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < ttlMs) return hit.data as T
  const data = await fn()
  cache.set(key, { at: Date.now(), data })
  return data
}

async function chart(symbol: string, range: string, interval = '1d'): Promise<ChartResult> {
  // Yahoo writes class shares as BRK-B, not BRK.B — but only that pattern:
  // index symbols like DX-Y.NYB keep their dot
  const ySymbol = symbol.replace(/^([A-Z]+)\.([A-Z])$/i, '$1-$2')
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySymbol)}?range=${range}&interval=${interval}`
  const res = await fetch(url, { headers: UA })
  if (!res.ok) throw new Error(`yahoo chart ${symbol} ${res.status}`)
  const body = (await res.json()) as { chart: { result: ChartResult[] | null; error: { description?: string } | null } }
  if (body.chart.error || !body.chart.result?.[0]) throw new Error(`yahoo chart ${symbol}: ${body.chart.error?.description ?? 'no result'}`)
  return body.chart.result[0]
}

export function quoteFromChart(r: ChartResult): Quote {
  const m = r.meta
  const prev = m.chartPreviousClose ?? m.previousClose ?? null
  return {
    symbol: m.symbol,
    name: m.longName ?? m.shortName ?? null,
    price: m.regularMarketPrice,
    prevClose: prev,
    dayPct: prev ? ((m.regularMarketPrice - prev) / prev) * 100 : null,
    wk52High: m.fiftyTwoWeekHigh ?? null,
    wk52Low: m.fiftyTwoWeekLow ?? null,
  }
}

export function closesFromChart(r: ChartResult): { date: string; close: number }[] {
  const closes = r.indicators.quote[0]?.close ?? []
  return (r.timestamp ?? []).flatMap((t, i) => {
    const c = closes[i]
    return c == null ? [] : [{ date: new Date(t * 1000).toISOString().slice(0, 10), close: +c.toFixed(4) }]
  })
}

export const marketdata = {
  getQuote: (symbol: string) => cached(`q:${symbol}`, 60e3, async () => quoteFromChart(await chart(symbol, '1d'))),
  getQuotes: (symbols: string[]) => Promise.all(symbols.map((s) => marketdata.getQuote(s))),
  // daily closes, e.g. range '1mo' | '6mo' | '1y'
  getDailyCloses: (symbol: string, range = '1y') =>
    cached(`h:${symbol}:${range}`, 3600e3, async () => closesFromChart(await chart(symbol, range))),
  // today's volume vs the trailing-3mo daily average
  getRelVolume: (symbol: string) =>
    cached(`rv:${symbol}`, 300e3, async () => {
      const r = await chart(symbol, '3mo')
      const vols = (r.indicators.quote[0]?.volume ?? []).filter((v): v is number => v != null && v > 0)
      if (vols.length < 2) return 1
      const today = vols[vols.length - 1]
      const avg = vols.slice(0, -1).reduce((s, v) => s + v, 0) / (vols.length - 1)
      return avg > 0 ? today / avg : 1
    }),
}
