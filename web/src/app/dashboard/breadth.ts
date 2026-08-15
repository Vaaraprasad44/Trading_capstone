// Market-breadth data model. Live snapshots come from /api/breadth (real
// SPDR sector-ETF quotes, one per SECTORS entry); the random-walk simulator
// below remains only as the fallback when that feed is unavailable.

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

export type SectorBreadth = { symbol: string; dayPct: number; relVolume: number }

// Real snapshot from the 11 sector ETFs (/api/breadth, same order as
// SECTORS). Every particle in a sector carries the sector's actual move —
// ×3 display gain because ETF day moves are compressed vs the single-stock
// ±8% scale the particle color/radius mapping was tuned for. The chips
// (advancers/decliners/up-volume) use the unscaled real values.
export function snapshotFromSectors(sectors: SectorBreadth[], count = BREADTH_COUNT): BreadthSnapshot {
  const stocks: BreadthStock[] = Array.from({ length: count }, (_, i) => {
    const s = sectors[i % sectors.length]
    return {
      sector: i % sectors.length,
      changePct: clamp(s.dayPct * 3, -8, 8),
      relVolume: clamp(s.relVolume, 0.2, 3),
    }
  })
  let advancers = 0
  let decliners = 0
  let upVol = 0
  let totalVol = 0
  for (const s of sectors) {
    if (s.dayPct > 0.05) advancers++
    else if (s.dayPct < -0.05) decliners++
    if (s.dayPct > 0) upVol += s.relVolume
    totalVol += s.relVolume
  }
  const avg = sectors.reduce((sum, s) => sum + s.dayPct, 0) / Math.max(1, sectors.length)
  return {
    stocks,
    advancers,
    decliners,
    upVolumePct: totalVol > 0 ? (upVol / totalVol) * 100 : 50,
    mood: clamp(avg, -1, 1),
  }
}

export function moodLabel(snapshot: BreadthSnapshot): string {
  const ratio = snapshot.advancers / Math.max(1, snapshot.advancers + snapshot.decliners);
  if (ratio > 0.72) return "Broad advance";
  if (ratio > 0.58) return "Risk-on";
  if (ratio < 0.28) return "Broad decline";
  if (ratio < 0.42) return "Risk-off";
  return "Mixed";
}
