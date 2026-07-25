import { z } from 'zod'
import { db } from '@/lib/db'
import { fundByCode } from '@/lib/domain'
import { handle, json, query } from '@/lib/http'

// This month's SIP plan (PRD 3.4)
export const GET = handle(async (req: Request, ctx: { params: Promise<{ code: string }> }) => {
  const fund = await fundByCode((await ctx.params).code)
  const q = z.object({ month: z.coerce.date().optional() }).parse(query(req))
  const at = q.month ?? new Date()
  const month = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1))
  const plan = await db.sip_plans.findUnique({ where: { fund_id_month: { fund_id: fund.id, month } } })
  if (!plan) return json({ error: `no SIP plan for ${month.toISOString().slice(0, 7)}` }, { status: 404 })
  return json(plan)
})
