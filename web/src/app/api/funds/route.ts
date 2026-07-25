import { db } from '@/lib/db'
import { handle, json } from '@/lib/http'

export const GET = handle(async () => {
  const [funds, latestNav] = await Promise.all([
    db.funds.findMany({ orderBy: { id: 'asc' } }),
    db.fund_nav_daily.findMany({ orderBy: [{ fund_id: 'asc' }, { date: 'desc' }], distinct: ['fund_id'] }),
  ])
  return json(funds.map((f) => ({ ...f, latest_nav: latestNav.find((n) => n.fund_id === f.id) ?? null })))
})
