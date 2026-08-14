import { handle, json } from '@/lib/http'

// Validate the admin token against the env var.
// Client stores the token in sessionStorage; every admin API call sends it as
// Authorization: Bearer <token>. This route lets the login form verify it
// without the client ever seeing the actual env var value.
export const POST = handle(async (req: Request) => {
  const { token } = await req.json().catch(() => ({ token: '' }))
  const expected = process.env.ADMIN_TOKEN
  if (!expected) return json({ error: 'ADMIN_TOKEN not configured' }, { status: 503 })
  if (token !== expected) return json({ error: 'invalid token' }, { status: 401 })
  return json({ ok: true })
})
