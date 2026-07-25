import { z } from 'zod'
import { db } from '@/lib/db'
import { Ticker } from '@/lib/domain'
import { handle, json, query } from '@/lib/http'

// AI-ranked news for the drill-down page (PRD 4.3)
export const GET = handle(async (req: Request, ctx: { params: Promise<{ symbol: string }> }) => {
  const instrument = await db.instruments.findUniqueOrThrow({
    where: { symbol: Ticker.parse((await ctx.params).symbol) },
  })
  const q = z.object({ relevance: z.enum(['high', 'med', 'low']).optional() }).parse(query(req))
  const news = await db.news_items.findMany({
    where: { instrument_id: instrument.id, relevance: q.relevance },
    orderBy: { published_at: 'desc' },
    take: 20,
  })
  return json(news)
})
