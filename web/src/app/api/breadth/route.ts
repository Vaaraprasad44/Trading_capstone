import { marketdata } from '@/lib/marketdata'
import { handle, json } from '@/lib/http'

// Real sector breadth: one SPDR sector ETF per dashboard sector, in the same
// order as breadth.ts SECTORS (the client maps them by index). ponytail:
// sector-level, not per-stock — true market-wide advancers/decliners aren't
// available from Yahoo's keyless API. No SnapTrade needed; market-wide data.
const SECTOR_ETFS = ['XLK', 'XLF', 'XLV', 'XLE', 'XLI', 'XLP', 'XLY', 'XLU', 'XLB', 'XLC', 'XLRE']

export const GET = handle(async () => {
  const rows = await Promise.all(
    SECTOR_ETFS.map(async (symbol) => {
      const [q, relVolume] = await Promise.all([marketdata.getQuote(symbol), marketdata.getRelVolume(symbol)])
      return { symbol, dayPct: q.dayPct ?? 0, relVolume: +relVolume.toFixed(3) }
    }),
  )
  return json(rows)
})
