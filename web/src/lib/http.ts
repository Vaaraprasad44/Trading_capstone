import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'

// ponytail: BigInt ids stay far below 2^53 in v1 — plain Number for JSON
export function json(data: unknown, init?: ResponseInit) {
  return new Response(
    JSON.stringify(data, (_k, v) => (typeof v === 'bigint' ? Number(v) : v)),
    { ...init, headers: { 'content-type': 'application/json', ...init?.headers } },
  )
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>

// Error boundary for every route handler. The DB triggers/CHECKs are the last
// line of defense (DB-SCHEMA.md §1) — surface their refusals as 409s.
export function handle<C>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx)
    } catch (err) {
      if (err instanceof ZodError) return json({ error: 'invalid request', issues: err.issues }, { status: 400 })
      if (err instanceof SyntaxError) return json({ error: 'invalid JSON body' }, { status: 400 })
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2025') return json({ error: 'not found' }, { status: 404 })
        if (err.code === 'P2002') return json({ error: 'already exists' }, { status: 409 })
        if (err.code === 'P2003') return json({ error: 'related record not found' }, { status: 404 })
      }
      const msg = err instanceof Error ? err.message : String(err)
      if (/append-only|immutable|never deleted|check constraint/i.test(msg)) {
        return json({ error: msg.split('\n').at(-1)?.trim() ?? 'refused by database' }, { status: 409 })
      }
      console.error(err)
      return json({ error: 'internal error' }, { status: 500 })
    }
  }
}

export function query(req: Request): Record<string, string> {
  return Object.fromEntries(new URL(req.url).searchParams)
}
