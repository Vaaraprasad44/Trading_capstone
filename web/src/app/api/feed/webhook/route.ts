import { z } from 'zod'
import { runSync } from '@/lib/feed'
import { handle, json } from '@/lib/http'

// SnapTrade webhook receiver (spike Q7). SnapTrade authenticates by echoing
// the shared webhookSecret in every payload — that check is the trust
// boundary; no secret configured means the endpoint is off.
export const POST = handle(async (req: Request) => {
  const secret = process.env.SNAPTRADE_WEBHOOK_SECRET
  if (!secret) return json({ error: 'webhooks not configured' }, { status: 503 })

  const body = z
    .object({ webhookSecret: z.string(), eventType: z.string().default('unknown') })
    .loose()
    .parse(await req.json())
  if (body.webhookSecret !== secret) return json({ error: 'bad secret' }, { status: 401 })

  // Only transaction-ish events warrant a pull; ack everything else.
  if (!/TRANSACTIONS|HOLDINGS|CONNECTION/i.test(body.eventType)) return json({ ok: true, ignored: body.eventType })
  return json(await runSync('webhook'))
})
