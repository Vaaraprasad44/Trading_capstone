import { db } from '@/lib/db'
import { Ticker } from '@/lib/domain'
import { handle, json } from '@/lib/http'

// Cached key-facts Skill output (PRD 4.2)
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ symbol: string }> }) => {
  const instrument = await db.instruments.findUniqueOrThrow({
    where: { symbol: Ticker.parse((await ctx.params).symbol) },
  })
  const facts = await db.ai_key_facts_cache.findUnique({ where: { instrument_id: instrument.id } })
  if (!facts) return json({ error: 'no key facts cached yet' }, { status: 404 })
  return json(facts)
})
