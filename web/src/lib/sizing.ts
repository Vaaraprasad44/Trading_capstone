// Deterministic copy-sizing formula for the Swing fund (PRD 5.1, 5.2).
// The LLM never does arithmetic — it only explains these computed numbers.

export type SizingParams = {
  risk_pct_min: number
  risk_pct_max: number
  formula: string
}

export type SizingInputs = {
  capital: number        // subscriber's total capital in USD
  entry_price: number    // trader's entry (or LTP for open positions)
  stop_price: number     // trader's published stop
  risk_pct: number       // subscriber's chosen risk % (clamped to [min, max])
}

export type SizingResult = {
  position_dollars: number
  shares: number
  risk_dollars: number
  risk_pct_clamped: number  // actual % used after clamping
  formula_display: string   // human-readable breakdown for LLM context
}

export function computeSizing(inputs: SizingInputs, params: SizingParams): SizingResult {
  const risk_pct_clamped = Math.min(
    Math.max(inputs.risk_pct, params.risk_pct_min),
    params.risk_pct_max,
  )
  const risk_dollars = (inputs.capital * risk_pct_clamped) / 100
  const price_risk = inputs.entry_price - inputs.stop_price
  if (price_risk <= 0) {
    throw new RangeError('stop_price must be below entry_price for a long position')
  }
  const shares = risk_dollars / price_risk
  const position_dollars = shares * inputs.entry_price

  const formula_display = [
    `Capital: $${inputs.capital.toLocaleString()}`,
    `Risk: ${risk_pct_clamped}% = $${risk_dollars.toFixed(2)}`,
    `Entry: $${inputs.entry_price} | Stop: $${inputs.stop_price} | Risk/share: $${price_risk.toFixed(4)}`,
    `Shares: $${risk_dollars.toFixed(2)} ÷ $${price_risk.toFixed(4)} = ${shares.toFixed(4)}`,
    `Position size: ${shares.toFixed(2)} shares × $${inputs.entry_price} = $${position_dollars.toFixed(2)}`,
  ].join('\n')

  return {
    position_dollars: +position_dollars.toFixed(2),
    shares: +shares.toFixed(4),
    risk_dollars: +risk_dollars.toFixed(2),
    risk_pct_clamped,
    formula_display,
  }
}
