import { z } from 'zod'
import { db } from '@/lib/db'
import { Ticker, fundByCode } from '@/lib/domain'
import { handle, json, query } from '@/lib/http'

// Publish a month's SIP plan — the trader's public commitment ("what we're
// buying and why"); reconciliation matches plan-symbol buys against it.
// Create-only: a published plan is never edited (trust invariant).
export const POST = handle(async (req: Request, ctx: { params: Promise<{ code: string }> }) => {
  const fund = await fundByCode((await ctx.params).code)
  const body = z
    .object({
      month: z.coerce.date().optional(),
      plan_md: z.string().min(1),
      breakdown: z
        .array(z.object({ symbol: Ticker, pct: z.number().positive().max(100), amount: z.number().positive().optional() }))
        .min(1),
    })
    .parse(await req.json())
  const at = body.month ?? new Date()
  const month = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1))
  const plan = await db.sip_plans.create({
    data: {
      fund_id: fund.id,
      month,
      plan_md: body.plan_md,
      breakdown: body.breakdown,
      published_at: new Date(),
    },
  })
  return json(plan, { status: 201 })
})

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
