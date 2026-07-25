import { z } from 'zod'
import { db } from '@/lib/db'
import { fundByCode } from '@/lib/domain'
import { handle, json, query } from '@/lib/http'

// Equity curve + benchmark for the vs-S&P chart (PRD 1.2, 3.1)
export const GET = handle(async (req: Request, ctx: { params: Promise<{ code: string }> }) => {
  const fund = await fundByCode((await ctx.params).code)
  const q = z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional() }).parse(query(req))
  const range = { gte: q.from, lte: q.to }
  const [nav, benchmark] = await Promise.all([
    db.fund_nav_daily.findMany({ where: { fund_id: fund.id, date: range }, orderBy: { date: 'asc' } }),
    db.benchmark_prices.findMany({
      where: { symbol: fund.benchmark_symbol, date: range },
      orderBy: { date: 'asc' },
    }),
  ])
  return json({ fund: fund.code, benchmark_symbol: fund.benchmark_symbol, nav, benchmark })
})
