import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// ponytail: interim frontend — the HTML prototype served as-is (hard-wired
// demo data). Replace with a React page fed by /api/funds + /api/funds/:code/*.
export async function GET() {
  const html = await readFile(join(process.cwd(), 'src/html/dashboard.html'), 'utf8')
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}
