import { db } from '@/lib/db'
import { fundByCode } from '@/lib/domain'
import { handle, json } from '@/lib/http'

// Open positions from the current_positions view (claims + verification stamp)
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ code: string }> }) => {
  const fund = await fundByCode((await ctx.params).code)
  const rows = await db.$queryRaw`
    SELECT cp.*, i.symbol FROM current_positions cp
    JOIN instruments i ON i.id = cp.instrument_id
    WHERE cp.fund_id = ${fund.id}`
  return json(rows)
})
