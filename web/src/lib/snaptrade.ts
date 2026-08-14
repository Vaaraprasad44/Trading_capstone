import { createHmac } from 'node:crypto'

// SnapTrade client — manual HMAC signing per docs.snaptrade.com.
// The official SDK mis-signs personal-flow requests (SPIKE-SNAPTRADE.md §7),
// so we sign ourselves; personal (PERS-) keys need no userSecret.
const BASE = 'https://api.snaptrade.com/api/v1'

export function snaptradeConfigured(): boolean {
  return Boolean(process.env.SNAPTRADE_CLIENT_ID && process.env.SNAPTRADE_CONSUMER_KEY)
}

async function call<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const q = new URLSearchParams({
    clientId: process.env.SNAPTRADE_CLIENT_ID!,
    timestamp: String(Math.floor(Date.now() / 1000)),
    userId: process.env.SNAPTRADE_USER_ID ?? '',
    userSecret: '',
    ...params,
  }).toString()
  const payload = JSON.stringify(
    Object.fromEntries(Object.entries({ content: null, path: `/api/v1${path}`, query: q }).sort()),
  )
  const signature = createHmac('sha256', process.env.SNAPTRADE_CONSUMER_KEY!).update(payload).digest('base64')
  const res = await fetch(`${BASE}${path}?${q}`, { headers: { Signature: signature } })
  if (!res.ok) throw new Error(`SnapTrade ${path} ${res.status}: ${(await res.text()).slice(0, 300)}`)
  return res.json() as Promise<T>
}

const account = () => {
  const id = process.env.SNAPTRADE_ACCOUNT_ID
  if (!id) throw new Error('SNAPTRADE_ACCOUNT_ID not set')
  return id
}

export type SnapActivity = {
  id: string
  type: string // BUY | SELL | DIVIDEND | REI | CONTRIBUTION | WITHDRAWAL | INTEREST | FEE | ...
  symbol: { symbol: string; raw_symbol: string; description?: string } | null
  description: string
  amount: number | null
  price: number | null
  units: number | null
  fee: number | null
  trade_date: string | null
  settlement_date: string | null
  institution: string
}

export type SnapOrder = {
  brokerage_order_id: string
  status: string // EXECUTED | NONE | ...
  action: string // BUY | SELL
  universal_symbol: { symbol: string; raw_symbol: string } | null
  total_quantity: string | null
  filled_quantity: string | null
  execution_price: string | null
  limit_price: string | null
  order_type: string | null
  time_placed: string | null
  time_executed: string | null
}

// NOTE: the older /positions and /holdings endpoints are 410-gone on newer
// accounts — /positions/all is the live one. Numerics arrive as strings;
// cost_basis is the TOTAL cost of the lot, not per-share.
export type SnapPosition = {
  instrument: { kind: string; symbol: string; raw_symbol: string; description: string | null } | null
  units: string | null
  price: string | null
  cost_basis: string | null
  currency: string | null
}

export type SnapAccount = {
  id: string
  name: string
  institution_name: string
  balance: { total: { amount: number; currency: string } | null }
  sync_status: {
    holdings?: { last_successful_sync: string | null }
    transactions?: { last_successful_sync: string | null }
  }
}

export const snaptrade = {
  listAccounts: () => call<SnapAccount[]>('/accounts'),
  getBalances: () => call<{ cash: number; buying_power: number }[]>(`/accounts/${account()}/balances`),
  getPositions: async () => {
    const res = await call<{ results: SnapPosition[] }>(`/accounts/${account()}/positions/all`)
    return res.results
  },
  getOrders: () => call<SnapOrder[]>(`/accounts/${account()}/orders`),
  // NOTE: the global /activities endpoint is 410-gone; per-account is the live one.
  getActivities: async (startDate: string, endDate: string) => {
    const res = await call<{ data: SnapActivity[] }>(`/accounts/${account()}/activities`, {
      startDate,
      endDate,
    })
    return res.data
  },
}
