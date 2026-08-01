import { ALLOC } from "../_data";

// The mock dashboard "screenshot" under the hero, framed like a product shot:
// a padded, bordered card with an inset ring (Hero 3 style).
export function DashboardPreview() {
  return (
    <div className="rise rise-5 relative mx-auto w-full overflow-hidden rounded-xl border border-border bg-background p-2 shadow-2xl ring-1 ring-border/60">
      <div className="overflow-hidden rounded-lg border border-border bg-card text-left">
        <div className="pv-bar">
          <span className="pv-dot" style={{ background: "var(--dn)" }} />
          <span className="pv-dot" style={{ background: "var(--amber)" }} />
          <span className="pv-dot" style={{ background: "var(--up)" }} />
          <span className="pv-title">meridian.capital / alpha-fund</span>
          <span className="pv-live">
            <span className="live-dot" /> Live · updated 1s ago
          </span>
        </div>
        <div className="pv-body">
          <div className="pv-kpis">
            <div className="pv-kpi">
              <div className="l">Invested</div>
              <div className="v">$623,326</div>
            </div>
            <div className="pv-kpi">
              <div className="l">Current</div>
              <div className="v">$758,940</div>
            </div>
            <div className="pv-kpi">
              <div className="l">Net P&L</div>
              <div className="v" style={{ color: "var(--up)" }}>
                +$512K
              </div>
              <span className="pill up">+82.2%</span>
            </div>
            <div className="pv-kpi">
              <div className="l">Win rate</div>
              <div className="v">71%</div>
              <span className="pill up">5/7 trades</span>
            </div>
          </div>
          <div className="pv-panel">
            <h4>
              Allocation <span className="muted">12 positions</span>
            </h4>
            <div className="alloc-mini alloc-2col">
              {ALLOC.map((a) => (
                <div className="alloc-row" key={a.ticker}>
                  <span className="sq" style={{ background: a.color }} />
                  {a.ticker}
                  <span className="pct">{a.pct}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="ai-strip">
            <div className="ai-ico">⚡</div>
            <div>
              <div className="tag">Daily AI briefing</div>
              <div className="msg">
                NVDA is your largest position and a top gainer; NVO (-27.6%) is the weakest holding and worth a
                thesis review. Tech concentration is above 60%.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
