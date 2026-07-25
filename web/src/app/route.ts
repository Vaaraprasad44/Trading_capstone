import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// ponytail: interim frontend — the HTML prototype served as-is. Replaced
// page-by-page with real React components fed by /api when the UI is built.
export async function GET() {
  const html = await readFile(join(process.cwd(), 'src/html/landing.html'), 'utf8')
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}
