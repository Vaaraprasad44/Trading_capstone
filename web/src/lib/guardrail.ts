// Question classifier + guardrail for the copy-sizing assistant (PRD 5.3).
// Regex-first; no LLM tokens spent on refusals.

export type QuestionType =
  | 'sizing'
  | 'thesis'
  | 'allocation'
  | 'activity'
  | 'general'
  // refused types:
  | 'exit_now'
  | 'personal_advice'
  | 'prediction'
  | 'leverage'
  | 'personal_context'

const REFUSED: QuestionType[] = ['exit_now', 'personal_advice', 'prediction', 'leverage', 'personal_context']

// Order matters — refused patterns checked first so "should I sell?" doesn't
// slip through into the 'activity' bucket.
const RULES: { type: QuestionType; pattern: RegExp }[] = [
  { type: 'exit_now',        pattern: /\b(exit|sell|close|get out|bail|cut).{0,20}(now|today|asap|immediately|position)\b|\bshould i (sell|exit|hold|close)\b/i },
  { type: 'personal_advice', pattern: /\b(is this|right for me|good for me|fit me|my situation|advise|recommend me|what should i)\b/i },
  { type: 'prediction',      pattern: /\b(predict|forecast|will.{0,10}(go up|go down|rise|fall|rally|crash)|price target|where.{0,6}(headed|going))\b/i },
  { type: 'leverage',        pattern: /\b(leverage|margin|options|calls|puts|2x|3x|etf.{0,6}lever)\b/i },
  { type: 'personal_context',pattern: /\b(my (other )?holding|my (other )?portfolio|my goal|my tax|my debt|my income|my salary|my total net)\b/i },
  { type: 'sizing',          pattern: /\b(siz|how much|for me|my amount|match|adjust|mirror|copy|invest|position size|dollar|how many shares)\b/i },
  { type: 'thesis',          pattern: /\b(why|thesis|reason|rationale|case for|story behind|what.{0,10}think)\b/i },
  { type: 'allocation',      pattern: /\b(alloc|weight|percent|concentrat|largest|biggest|top.{0,6}position)\b/i },
  { type: 'activity',        pattern: /\b(recent|activit|bought|sold|buy|sell|trade|summar|last.{0,6}(buy|sell|trade))\b/i },
]

export function classify(question: string): QuestionType {
  for (const { type, pattern } of RULES) {
    if (pattern.test(question)) return type
  }
  return 'general'
}

export function isRefused(type: QuestionType): boolean {
  return REFUSED.includes(type)
}

const REFUSAL_REDIRECTS: Record<string, string> = {
  exit_now:         "I can show sizing math and the published exit rules for any open position, but I can't tell you when to act. Check the trade card for the trader's published stop and exit conditions.",
  personal_advice:  "I can explain the published sizing formulas and fund methodology, but I can't give personalized advice. The formulas are public — apply them to your own numbers.",
  prediction:       "I don't forecast prices. The published exit rules tell you the conditions under which the trader plans to exit — that's the closest thing to a price target this fund publishes.",
  leverage:         "This fund doesn't use leverage, options, or margin. The copy-sizing formula applies to straightforward equity positions only.",
  personal_context: "I only work with the numbers you provide right now — I don't store or reason about your other holdings, taxes, or broader financial picture. For holistic advice, consult a licensed advisor.",
}

export function refusalText(type: QuestionType): string {
  const redirect = REFUSAL_REDIRECTS[type] ?? "I can't help with that one. Ask me about sizing, allocations, or the thesis behind a position."
  return `${redirect}\n\n_Educational only — not financial advice. Past performance ≠ future results._`
}
