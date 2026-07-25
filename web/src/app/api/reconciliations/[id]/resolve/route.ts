import { z } from 'zod'
import { db } from '@/lib/db'
import { handle, json } from '@/lib/http'

// Trader addressed a flag (PRD 1.4: unresolved omissions surface publicly)
export const POST = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const id = z.coerce.bigint().parse((await ctx.params).id)
  const row = await db.reconciliations.update({ where: { id }, data: { resolved_at: new Date() } })
  return json(row)
})
