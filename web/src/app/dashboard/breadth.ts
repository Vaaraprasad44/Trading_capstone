// Mock market-breadth simulator. Hard-wired on purpose, same as data.ts —
// a single "mood" random walk plus per-sector offsets stands in for a real
// per-symbol feed until an /api/breadth source lands. Presentation only.

export type BreadthStock = {
  sector: number; // index into SECTORS, fixed per stock
  changePct: number; // -8..+8
  relVolume: number; // volume vs its own average, ~0.2..3
};

export type BreadthSnapshot = {
  stocks: BreadthStock[];
  advancers: number;
  decliners: number;
  upVolumePct: number; // share of volume in advancing stocks, 0..100
  mood: number; // -1..+1, the market regime driver
};

export const SECTORS = [
  "Tech", "Financials", "Health", "Energy", "Industrials", "Staples",
  "Discretionary", "Utilities", "Materials", "Comms", "Real Estate",
];

export const BREADTH_COUNT = 3000;

// sum of three uniforms ≈ gaussian, cheap and good enough for noise
function gauss() {
  return Math.random() + Math.random() + Math.random() - 1.5;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export type BreadthSim = { tick: () => BreadthSnapshot };

export function createBreadthSim(count = BREADTH_COUNT): BreadthSim {
  let mood = gauss() * 0.3;
  const sectorMood = SECTORS.map(() => gauss() * 0.25);
  const stocks: BreadthStock[] = Array.from({ length: count }, (_, i) => ({
    sector: i % SECTORS.length,
    changePct: 0,
    relVolume: 1,
  }));

  function tick(): BreadthSnapshot {
    // regime drifts slowly; the rare jump fakes a news shock
    mood = clamp(mood + gauss() * 0.08, -1, 1);
    if (Math.random() < 0.03) mood = clamp(mood + gauss() * 0.7, -1, 1);
    for (let s = 0; s < sectorMood.length; s++) {
      sectorMood[s] = clamp(sectorMood[s] * 0.97 + gauss() * 0.06, -0.9, 0.9);
    }

    let advancers = 0;
    let decliners = 0;
    let upVol = 0;
    let totalVol = 0;
    for (const st of stocks) {
      const target = mood * 2.2 + sectorMood[st.sector] * 1.8 + gauss() * 2.6;
      st.changePct = clamp(st.changePct * 0.55 + target * 0.45, -8, 8);
      // heavy volume tends to ride the big movers
      const volTarget = 0.5 + Math.abs(st.changePct) * 0.35 + Math.random() * 0.6;
      st.relVolume = clamp(st.relVolume * 0.7 + volTarget * 0.3, 0.2, 3);

      if (st.changePct > 0.05) advancers++;
      else if (st.changePct < -0.05) decliners++;
      if (st.changePct > 0) upVol += st.relVolume;
      totalVol += st.relVolume;
    }

    return {
      // fresh objects so React state consumers see a new reference per tick
      stocks: stocks.map((s) => ({ ...s })),
      advancers,
      decliners,
      upVolumePct: totalVol > 0 ? (upVol / totalVol) * 100 : 50,
      mood,
    };
  }

  return { tick };
}

export function moodLabel(snapshot: BreadthSnapshot): string {
  const ratio = snapshot.advancers / Math.max(1, snapshot.advancers + snapshot.decliners);
  if (ratio > 0.72) return "Broad advance";
  if (ratio > 0.58) return "Risk-on";
  if (ratio < 0.28) return "Broad decline";
  if (ratio < 0.42) return "Risk-off";
  return "Mixed";
}
