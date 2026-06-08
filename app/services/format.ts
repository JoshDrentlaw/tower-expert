// format.ts — display formatting service, bound to a locale.
//
// Wraps the pure number core (app/num_format.ts) and owns date/duration
// rendering. In this foundation step the locale is unused (output matches the
// previous `new Date(x).toLocaleString()` and fmtDuration exactly); the i18n
// step will make these locale-aware via Intl.

import { formatNum, type NumUnit } from "../num_format.ts";

export interface Formatter {
  /** Game-style magnitude/percent/multiplier/seconds, per unit. Locale-neutral
   *  on purpose — the game's notation (869.03M, ×1.012) is canonical. */
  num(n: number | null | undefined, unit?: NumUnit): string;
  /** A plain count (wave, etc.) with locale-aware grouping; "—" when null. */
  integer(n: number | null | undefined): string;
  /** A duration in seconds → "1h 2m 3s". */
  duration(s: number | null): string;
  /** An ISO timestamp (or Date) → locale-aware date-time. */
  dateTime(v: string | number | Date): string;
}

function fmtDuration(s: number | null): string {
  if (!s) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h && `${h}h`, m && `${m}m`, `${sec}s`].filter(Boolean).join(" ");
}

export function makeFormatter(locale: string): Formatter {
  return {
    num: (n, unit) => formatNum(n, unit),
    integer: (n) =>
      (n === null || n === undefined || !Number.isFinite(n)) ? "—" : n.toLocaleString(locale),
    duration: (s) => fmtDuration(s),
    dateTime: (v) => new Date(v).toLocaleString(locale),
  };
}
