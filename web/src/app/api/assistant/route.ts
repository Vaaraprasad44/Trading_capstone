import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { classify, isRefused, refusalText } from '@/lib/guardrail'
import { computeSizing } from '@/lib/sizing'
import { handle, json } from '@/lib/http'

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001'

const client = new Anthropic()

const Body = z.object({
  question:       z.string().min(1).max(2000),
  session_id:     z.string().uuid().optional(),    // null = open a new session
  fund:           z.enum(['alpha', 'sip', 'swing']).default('swing'),
  trade_card_id:  z.string().uuid().optional(),
  // sizing context provided by the client when a specific card is in view
  entry_price:    z.number().positive().optional(),
  stop_price:     z.number().positive().optional(),
  capital:        z.number().positive().optional(),
  risk_pct:       z.number().positive().optional(),
  // holdings summary for portfolio-level answers
  holdings: z.array(z.object({
    ticker:     z.string(),
    name:       z.string(),
    allocation: z.number(),
    ltp:        z.number(),
    avg:        z.number(),
    qty:        z.number(),
  })).default([]),
})

export const POST = handle(async (req: Request) => {
  const body = Body.parse(await req.json())
  const question_type = classify(body.question)

  // ── Guardrail: refuse immediately, no LLM call ───────────────────────────
  if (isRefused(question_type)) {
    const sid = await logMessages(body.session_id, body.fund, body.trade_card_id, [
      { role: 'user',      content: body.question,              question_type, refused: false },
      { role: 'assistant', content: refusalText(question_type), question_type, refused: true },
    ])
    return json({
      text: refusalText(question_type),
      session_id: sid,
      question_type,
      refused: true,
      disclaimer: '',
    })
  }

  // ── Load fund methodology for sizing questions ───────────────────────────
  const fund = await db.funds.findUniqueOrThrow({ where: { code: body.fund } })
  const methodology = await db.sizing_methodologies.findFirst({
    where: { fund_id: fund.id },
    orderBy: { version: 'desc' },
  })

  // ── Build LLM system prompt ──────────────────────────────────────────────
  const holdingsSummary = body.holdings.length
    ? body.holdings.map((h) => `${h.ticker} (${h.name}): ${h.allocation.toFixed(1)}% of fund, LTP $${h.ltp}, avg $${h.avg}, qty ${h.qty}`).join('\n')
    : 'No holdings data provided.'

  let sizingBlock = ''
  let skillInputs: Record<string, unknown> = {}
  let methodologyId: bigint | undefined

  if (question_type === 'sizing' && methodology) {
    const params = methodology.params as { risk_pct_min?: number; risk_pct_max?: number }
    methodologyId = methodology.id
    const riskMin = params.risk_pct_min ?? 1
    const riskMax = params.risk_pct_max ?? 2

    if (body.capital && body.entry_price && body.stop_price) {
      try {
        const sizing = computeSizing(
          {
            capital:     body.capital,
            entry_price: body.entry_price,
            stop_price:  body.stop_price,
            risk_pct:    body.risk_pct ?? riskMin,
          },
          { risk_pct_min: riskMin, risk_pct_max: riskMax, formula: methodology.body_md },
        )
        sizingBlock = `\nDeterministic sizing result (DO NOT recalculate — present these numbers):\n${sizing.formula_display}`
        skillInputs = { capital: body.capital, entry_price: body.entry_price, stop_price: body.stop_price, risk_pct: body.risk_pct ?? riskMin }
      } catch {
        sizingBlock = '\n(Sizing calculation skipped: stop price must be below entry price.)'
      }
    } else if (body.capital) {
      // Capital known but no specific trade — portfolio mirror sizing
      const total = body.holdings.reduce((s, h) => s + h.ltp * h.qty, 0)
      if (total > 0) {
        const scaled = body.holdings
          .map((h) => `${h.ticker}: ${h.allocation.toFixed(1)}% → $${((h.allocation / 100) * body.capital!).toFixed(0)} (≈${((h.allocation / 100) * body.capital! / h.ltp).toFixed(2)} shares at $${h.ltp})`)
          .join('\n')
        sizingBlock = `\nPortfolio mirror sizing at $${body.capital.toLocaleString()}:\n${scaled}`
        skillInputs = { capital: body.capital }
      }
    }
  }

  const systemPrompt = `You are the Meridian Capital copy-sizing assistant. Your ONLY job is to explain published fund data and deterministic sizing math in plain English. You NEVER give buy/sell/hold recommendations, predict prices, or provide personalized financial advice.

Published methodology for ${fund.name}: ${methodology?.body_md ?? 'not available'}

Current holdings:
${holdingsSummary}
${sizingBlock}

Rules:
- Write in plain text only. No markdown: no asterisks, no hashes, no backticks, no bullet dashes. Use line breaks to separate sections.
- If sizing numbers are provided above, present them exactly — never recalculate. Present each number on its own line.
- If no sizing context was provided but the user asks to be sized, ask for their capital amount.
- Keep answers concise: 3-5 sentences for factual questions; a short breakdown for sizing questions.
- Never say "I recommend", "you should", "this is a good trade", or any variant.`

  // ── LLM call ────────────────────────────────────────────────────────────
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: 'user', content: body.question }],
  })

  const text = message.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('')

  // ── Log transcript ───────────────────────────────────────────────────────
  const sid = await logMessages(body.session_id, body.fund, body.trade_card_id, [
    { role: 'user',      content: body.question, question_type, refused: false, skillInputs, methodologyId },
    { role: 'assistant', content: text,           question_type, refused: false, skillInvoked: 'copy-sizing', methodologyId },
  ])

  return json({ text, session_id: sid, question_type, refused: false, disclaimer: '' })
})

// ── Transcript logging — returns session id for client continuity ────────────
async function logMessages(
  sessionId: string | undefined,
  fundCode: string,
  tradeCardId: string | undefined,
  messages: {
    role: 'user' | 'assistant'
    content: string
    question_type: string
    refused: boolean
    skillInvoked?: string
    skillInputs?: Record<string, unknown>
    methodologyId?: bigint
  }[],
): Promise<string | undefined> {
  try {
    const fund = await db.funds.findUnique({ where: { code: fundCode as 'alpha' | 'sip' | 'swing' } })

    let session = sessionId
      ? await db.assistant_sessions.findUnique({ where: { id: sessionId } })
      : null

    if (!session) {
      session = await db.assistant_sessions.create({
        data: {
          user_id:       DEMO_USER_ID,
          fund_id:       fund?.id ?? null,
          trade_card_id: tradeCardId ?? null,
        },
      })
    }

    for (const m of messages) {
      await db.assistant_messages.create({
        data: {
          session_id:     session.id,
          role:           m.role,
          content:        m.content,
          question_type:  m.question_type,
          refused:        m.refused,
          skill_invoked:  m.skillInvoked ?? null,
          skill_inputs:   m.skillInputs as Prisma.InputJsonValue | undefined,
          methodology_id: m.methodologyId ?? null,
        },
      })
    }
    return session.id
  } catch (err) {
    console.error('[assistant] transcript log failed:', err)
    return undefined
  }
}
