// num_format.ts — shared, pure number parsing + formatting for build stats.
//
// No I/O, no DB, no imports. Used by views.ts (display) and stat_schema.ts
// (coercion on save), so the value you type round-trips through the value you
// see: parseHuman(formatNum(n, unit), unit) ≈ n at display precision.
//
// Magnitude suffixes mirror the game's number format and are CASE-SENSITIVE:
//   q = 1e15 vs Q = 1e18,  s = 1e21 vs S = 1e24.
// That collision is why "14.00s" (seconds) can't be parsed the same as a big
// number — the *field's* unit disambiguates it, not the text.

// A numeric field's real-world unit, which drives both how a typed string is
// parsed and how a stored number is rendered. "num" is a plain magnitude value.
export type NumUnit = "num" | "mult" | "pct" | "sec";

// Descending so the largest matching threshold wins when formatting.
const SUFFIXES: [number, string][] = [
  [1e30, "N"],
  [1e27, "O"],
  [1e24, "S"],
  [1e21, "s"],
  [1e18, "Q"],
  [1e15, "q"],
  [1e12, "T"],
  [1e9, "B"],
  [1e6, "M"],
  [1e3, "K"],
];

const SUFFIX_VALUE: Record<string, number> = Object.fromEntries(
  SUFFIXES.map(([v, s]) => [s, v]),
);

// Parse a magnitude string like "869.03M", "1.5q", "12,345" → a number.
// Case-sensitive on the suffix. Returns null on anything it can't read.
function expandMagnitude(s: string): number | null {
  const m = s.match(/^(-?[\d,]+\.?\d*)\s*([KMBTqQsSON])?$/);
  if (!m) return null;
  const base = parseFloat(m[1].replace(/,/g, ""));
  if (!Number.isFinite(base)) return null;
  return m[2] ? base * SUFFIX_VALUE[m[2]] : base;
}

function parsePlain(s: string): number | null {
  const n = parseFloat(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

// Parse a human-typed value into its canonical stored number, per unit.
// Tolerates the decorations the game shows: a leading "×"/"x", a trailing "%",
// a trailing unit "s", and a "/m" suffix on per-meter multipliers.
// Longest legitimate input: "-999.99N" (8 chars) plus decoration ("×", "%", "/meter" etc.).
// 50 characters is generous headroom; anything beyond that is garbage or abuse.
const MAX_FIELD_LEN = 50;

export function parseHuman(raw: string | null, unit: NumUnit = "num"): number | null {
  if (raw === null) return null;
  if (raw.length > MAX_FIELD_LEN) return null;
  let s = raw.trim();
  if (s === "") return null;
  s = s.replace(/^[x×]\s*/i, ""); // tolerate a leading multiplier marker anywhere

  switch (unit) {
    case "pct":
      return parsePlain(s.replace(/%\s*$/, "").trim());
    case "sec":
      return parsePlain(s.replace(/s\s*$/i, "").trim());
    case "mult":
      return parsePlain(s.replace(/\s*\/\s*m(eter)?\s*$/i, "").trim());
    default:
      return expandMagnitude(s);
  }
}

// Drop trailing zeros from a fixed-precision float: 1.01000 → "1.01", 56.40 → "56.4".
function trimFloat(n: number, maxDp = 5): string {
  return Number(n.toFixed(maxDp)).toString();
}

function formatMagnitude(n: number): string {
  const abs = Math.abs(n);
  for (const [threshold, suffix] of SUFFIXES) {
    if (abs >= threshold) return (n / threshold).toFixed(2) + suffix;
  }
  return n.toLocaleString();
}

// Render a canonical stored number the way the game shows it, per unit.
// Mirrors parseHuman: "num" → "869.03M", "mult" → "×1.012",
// "pct" → "56.4%", "sec" → "14s".
export function formatNum(n: number | null | undefined, unit: NumUnit = "num"): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  switch (unit) {
    case "pct":
      return trimFloat(n) + "%";
    case "sec":
      return trimFloat(n) + "s";
    case "mult":
      return "×" + trimFloat(n);
    default:
      return formatMagnitude(n);
  }
}
