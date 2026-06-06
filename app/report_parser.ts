// report_parser.ts — parse a raw battle report paste into structured data.
//
// The game exports a fixed two-column text format: section headers on their own
// line, key-value pairs separated by 2+ spaces (or a tab). Number suffixes map
// to powers of 10 (K→1e3 … N→1e30); JavaScript floats lose precision above
// ~1e15 but that's acceptable for sorting/charting — exact values stay in `raw`.

export interface ParsedReport {
  occurred_at: string;
  tier: number | null;
  wave: number | null;
  coins: number | null;
  duration_s: number | null;
  parsed: Record<string, Record<string, string>>;
}

const SUFFIXES: Record<string, number> = {
  K: 1e3,
  M: 1e6,
  B: 1e9,
  T: 1e12,
  q: 1e15,
  Q: 1e18,
  s: 1e21,
  S: 1e24,
  O: 1e27,
  N: 1e30,
};

export function expandNumber(val: string): number | null {
  const m = val.trim().match(/^([\d,]+\.?\d*)([KMBTqQsSON])?$/);
  if (!m) return null;
  const base = parseFloat(m[1].replace(/,/g, ""));
  if (isNaN(base)) return null;
  return base * (m[2] ? (SUFFIXES[m[2]] ?? 1) : 1);
}

function parseDuration(val: string): number | null {
  let s = 0;
  const d = val.match(/(\d+)d/);
  if (d) s += +d[1] * 86400;
  const h = val.match(/(\d+)h/);
  if (h) s += +h[1] * 3600;
  const mn = val.match(/(\d+)m\b/);
  if (mn) s += +mn[1] * 60;
  const sc = val.match(/(\d+)s\b/);
  if (sc) s += +sc[1];
  return s > 0 ? s : null;
}

function parseBattleDate(val: string): string {
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export function parseReport(raw: string): ParsedReport {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);

  const parsed: Record<string, Record<string, string>> = {};
  let section = "battle_report";
  parsed[section] = {};

  for (const line of lines) {
    const parts = line.split(/\t| {2,}/);
    const key = parts[0].trim();
    const value = parts.length > 1 ? parts.slice(1).join(" ").trim() : null;

    if (!value) {
      section = key.toLowerCase().replace(/[\s/()+]+/g, "_").replace(/_+$/, "");
      if (!parsed[section]) parsed[section] = {};
    } else {
      parsed[section][key] = value;
    }
  }

  const top = parsed["battle_report"] ?? {};

  return {
    occurred_at: parseBattleDate(top["Battle Date"] ?? ""),
    tier: top["Tier"] ? parseInt(top["Tier"]) : null,
    wave: top["Wave"] ? parseInt(top["Wave"].replace(/,/g, "")) : null,
    coins: top["Coins Earned"] ? expandNumber(top["Coins Earned"]) : null,
    duration_s: top["Real Time"] ? parseDuration(top["Real Time"]) : null,
    parsed,
  };
}
