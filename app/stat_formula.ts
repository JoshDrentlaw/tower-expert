// stat_formula.ts — pure level→value scaling for Workshop stats.
//
// Many Workshop upgrades (and their enhancement multipliers) scale linearly:
//   value(level) = base + increment * level,  level ∈ [0, maxLevel].
// A schema Field that carries a `Formula` lets the build form take an upgrade
// *level* and compute the displayed value, instead of the player hand-
// transcribing it off their phone. Stats whose in-game scaling is tiered /
// non-linear (e.g. Damage, Health — thousands of levels with shifting
// increments) carry no formula and fall back to manual entry.
//
// No I/O, no imports — pure and unit-tested. The same arithmetic is mirrored in
// app/components/level_compute.ts for the live in-browser preview; the server
// recompute here is authoritative on save.

export interface Formula {
  base: number; // value at level 0 (the unlocked baseline)
  increment: number; // amount added per level
  maxLevel: number; // highest purchasable level
}

// Round away binary-float noise (0.1 * 150 → 16.200000000000003) to the display
// precision used by num_format, so a computed value equals the same value typed
// by hand. Formula-backed stats are all small-magnitude, so 6 dp is ample.
function clean(n: number): number {
  return Number(n.toFixed(6));
}

// Compute the stat value for a given level, clamped to [0, maxLevel]. Returns
// null for a non-integer, negative, or non-finite level.
export function valueFromLevel(f: Formula, level: number): number | null {
  if (!Number.isInteger(level) || level < 0) return null;
  const l = Math.min(level, f.maxLevel);
  return clean(f.base + f.increment * l);
}

// Inverse: the level that produces a stored value, for prefilling the level box
// from a saved build (incl. legacy builds saved before this feature, which only
// stored the value). Rounds to the nearest level and clamps to [0, maxLevel].
// Returns null when there is no inverse (increment 0) or the value is unusable.
export function levelFromValue(f: Formula, value: number): number | null {
  if (!Number.isFinite(value) || f.increment === 0) return null;
  const l = Math.round((value - f.base) / f.increment);
  return Math.max(0, Math.min(l, f.maxLevel));
}
