// progression.ts — pure data-shaping for the run-progression charts.
//
// uPlot (client-side) handles scaling/drawing now, so this module's job is just
// to turn battle reports into the per-run points the charts consume, plus the
// small derived bits the view needs (coins/hour, the tier list, the default
// tier for the wave filter). No I/O, no imports — pure and unit-tested.

// Minimal shape we need from a battle report (BattleReport satisfies it). Kept
// local so this module has no runtime dependency on db.ts.
export interface RunInput {
  id: number;
  occurred_at: string;
  tier: number | null;
  wave: number | null;
  coins: number | null;
  duration_s: number | null;
  build_id: number | null;
  build_label?: string | null;
}

// A run as the charts see it. `t` is epoch SECONDS (uPlot's time axis unit).
export interface RunPoint {
  id: number;
  t: number;
  tier: number | null;
  buildId: number | null;
  buildLabel: string | null;
  wave: number | null;
  coins: number | null;
  cph: number | null; // coins per hour — the tier-comparable farming KPI
}

// Coins earned per hour of real run time. null when either input is missing or
// the duration is non-positive (avoids divide-by-zero / Infinity).
export function coinsPerHour(coins: number | null, durationS: number | null): number | null {
  if (coins == null || durationS == null || durationS <= 0) return null;
  return coins / (durationS / 3600);
}

// Reports → chart points, sorted ascending by time (stable on id for ties).
export function toRunPoints(reports: RunInput[]): RunPoint[] {
  return reports
    .map((r) => ({
      id: r.id,
      t: Math.floor(new Date(r.occurred_at).getTime() / 1000),
      tier: r.tier,
      buildId: r.build_id,
      buildLabel: r.build_label ?? null,
      wave: r.wave,
      coins: r.coins,
      cph: coinsPerHour(r.coins, r.duration_s),
    }))
    .sort((a, b) => a.t - b.t || a.id - b.id);
}

// Distinct tiers present (ascending) — for the wave chart's tier selector.
export function tiersOf(points: RunPoint[]): number[] {
  const s = new Set<number>();
  for (const p of points) if (p.tier != null) s.add(p.tier);
  return [...s].sort((a, b) => a - b);
}

// The tier with the most wave-bearing runs — the sensible default for the wave
// chart, since plotting wave across mixed tiers is meaningless. null when none.
export function mostFarmedTier(points: RunPoint[]): number | null {
  const count = new Map<number, number>();
  for (const p of points) {
    if (p.tier != null && p.wave != null) count.set(p.tier, (count.get(p.tier) ?? 0) + 1);
  }
  let best: number | null = null;
  let bestN = 0;
  for (const [tier, n] of count) {
    if (n > bestN) {
      best = tier;
      bestN = n;
    }
  }
  return best;
}
