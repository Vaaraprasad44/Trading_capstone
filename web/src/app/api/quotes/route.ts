import { z } from 'zod'
import { Ticker } from '@/lib/domain'
import { marketdata } from '@/lib/marketdata'
import { handle, json, query } from '@/lib/http'

// Delayed quotes for holdings LTP / day% and the ticker tape.
// GET /api/quotes?symbols=VOO,QQQ,SPY
export const GET = handle(async (req: Request) => {
  const q = z.object({ symbols: z.string().min(1) }).parse(query(req))
  const symbols = z.array(Ticker).min(1).max(30).parse(q.symbols.split(','))
  const quotes = await Promise.allSettled(symbols.map((s) => marketdata.getQuote(s)))
  return json(
    quotes.map((r, i) =>
      r.status === 'fulfilled' ? r.value : { symbol: symbols[i], error: 'unavailable' },
    ),
  )
})
