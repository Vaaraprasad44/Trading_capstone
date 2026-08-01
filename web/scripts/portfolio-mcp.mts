// Portfolio MCP server — the custom MCP wrapping SnapTrade (capstone Bar #3).
// Stdio transport; registered in the repo-root .mcp.json. Read-only by
// construction: the SnapTrade connection itself has zero write scopes.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { snaptrade, snaptradeConfigured } from '../src/lib/snaptrade.js'

if (!snaptradeConfigured()) {
  console.error('SNAPTRADE_CLIENT_ID / SNAPTRADE_CONSUMER_KEY not set')
  process.exit(1)
}

const server = new McpServer({ name: 'portfolio', version: '1.0.0' })

const json = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] })

server.registerTool(
  'get_accounts',
  { description: "Brokerage accounts on the trader's SnapTrade connection: name, equity, sync status" },
  async () => json(await snaptrade.listAccounts()),
)

server.registerTool(
  'get_positions',
  { description: 'Open positions in the fund account: symbol, units, price, open P&L' },
  async () => json(await snaptrade.getPositions()),
)

server.registerTool(
  'get_balances',
  { description: 'Cash and buying power in the fund account' },
  async () => json(await snaptrade.getBalances()),
)

server.registerTool(
  'get_orders',
  {
    description:
      'Recent orders (intraday lane, ~10 min freshness): status, action, quantities, execution price, lifecycle timestamps',
  },
  async () => json(await snaptrade.getOrders()),
)

server.registerTool(
  'get_activities',
  {
    description:
      'Account activities (transactions lane, daily freshness): trades, dividends, reinvestments, contributions. Dates YYYY-MM-DD.',
    inputSchema: {
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    },
  },
  async ({ startDate, endDate }) => json(await snaptrade.getActivities(startDate, endDate)),
)

await server.connect(new StdioServerTransport())
