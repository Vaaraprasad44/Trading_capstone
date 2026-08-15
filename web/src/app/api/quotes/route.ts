import { z } from 'zod'
import { marketdata } from '@/lib/marketdata'
import { handle, json, query } from '@/lib/http'

// Delayed quotes for the ticker tape. Accepts Yahoo index/futures/crypto
// symbols (^GSPC, GC=F, BTC-USD), not just equity tickers.
// GET /api/quotes?symbols=^GSPC,^DJI,GC=F
const Sym = z.string().regex(/^[\^A-Z0-9=.\-]{1,12}$/i)

export const GET = handle(async (req: Request) => {
  const q = z.object({ symbols: z.string().min(1) }).parse(query(req))
  const symbols = z.array(Sym).min(1).max(30).parse(q.symbols.split(','))
  const quotes = await Promise.allSettled(symbols.map((s) => marketdata.getQuote(s)))
  return json(
    quotes.map((r, i) =>
      r.status === 'fulfilled' ? r.value : { symbol: symbols[i], error: 'unavailable' },
    ),
  )
})
