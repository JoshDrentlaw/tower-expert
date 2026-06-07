// report_parser_test.ts — regression + behavior-pinning tests for report_parser.ts
//
// Run: deno test app/report_parser_test.ts
// (No DB, no env vars needed — report_parser.ts is pure.)

import { assertEquals, assertNotEquals } from "@std/assert";
import { expandNumber, parseReport } from "./report_parser.ts";

// ---------------------------------------------------------------------------
// expandNumber
// ---------------------------------------------------------------------------

Deno.test("expandNumber: plain integer", () => {
  assertEquals(expandNumber("42"), 42);
});

Deno.test("expandNumber: comma-separated number", () => {
  assertEquals(expandNumber("1,234"), 1234);
});

Deno.test("expandNumber: multi-group comma number", () => {
  assertEquals(expandNumber("1,234,567"), 1234567);
});

Deno.test("expandNumber: decimal without suffix", () => {
  assertEquals(expandNumber("1.5"), 1.5);
});

Deno.test("expandNumber: suffix K", () => {
  assertEquals(expandNumber("1K"), 1e3);
});

Deno.test("expandNumber: suffix M", () => {
  assertEquals(expandNumber("1M"), 1e6);
});

Deno.test("expandNumber: suffix B", () => {
  assertEquals(expandNumber("1B"), 1e9);
});

Deno.test("expandNumber: suffix T", () => {
  assertEquals(expandNumber("1T"), 1e12);
});

Deno.test("expandNumber: suffix q (1e15)", () => {
  assertEquals(expandNumber("1q"), 1e15);
});

Deno.test("expandNumber: suffix Q (1e18)", () => {
  assertEquals(expandNumber("1Q"), 1e18);
});

Deno.test("expandNumber: suffix s (1e21)", () => {
  assertEquals(expandNumber("1s"), 1e21);
});

Deno.test("expandNumber: suffix S (1e24)", () => {
  assertEquals(expandNumber("1S"), 1e24);
});

Deno.test("expandNumber: suffix O (1e27)", () => {
  assertEquals(expandNumber("1O"), 1e27);
});

Deno.test("expandNumber: suffix N (1e30)", () => {
  assertEquals(expandNumber("1N"), 1e30);
});

Deno.test("expandNumber: decimal with suffix (1.5K)", () => {
  assertEquals(expandNumber("1.5K"), 1500);
});

Deno.test("expandNumber: comma + suffix (2.5M)", () => {
  assertEquals(expandNumber("2.5M"), 2500000);
});

Deno.test("expandNumber: trailing garbage returns null", () => {
  assertEquals(expandNumber("1,234 coins"), null);
});

Deno.test("expandNumber: plain text returns null", () => {
  assertEquals(expandNumber("abc"), null);
});

Deno.test("expandNumber: empty string returns null", () => {
  assertEquals(expandNumber(""), null);
});

// ---------------------------------------------------------------------------
// parseReport — full realistic paste
// ---------------------------------------------------------------------------

const FULL_PASTE = `Battle Date  2024-03-15 20:30:00
Tier  5
Wave  1,234
Coins Earned  2.5M
Real Time  1h 23m 45s

Enemies
Fast Enemy  500
Tank Enemy  100

Income
Cash Per Wave  1,000
`;

Deno.test("parseReport full paste: tier", () => {
  assertEquals(parseReport(FULL_PASTE).tier, 5);
});

Deno.test("parseReport full paste: wave strips commas", () => {
  assertEquals(parseReport(FULL_PASTE).wave, 1234);
});

Deno.test("parseReport full paste: coins expanded", () => {
  assertEquals(parseReport(FULL_PASTE).coins, 2500000);
});

Deno.test("parseReport full paste: duration_s 1h 23m 45s = 5025", () => {
  assertEquals(parseReport(FULL_PASTE).duration_s, 5025);
});

Deno.test("parseReport full paste: occurred_at is ISO string", () => {
  const r = parseReport(FULL_PASTE);
  // Must be non-null and a valid ISO string
  assertNotEquals(r.occurred_at, null);
  assertNotEquals(isNaN(new Date(r.occurred_at!).getTime()), true);
});

Deno.test("parseReport full paste: enemies section populated", () => {
  const r = parseReport(FULL_PASTE);
  assertEquals(r.parsed["enemies"]["Fast Enemy"], "500");
  assertEquals(r.parsed["enemies"]["Tank Enemy"], "100");
});

Deno.test("parseReport full paste: income section populated", () => {
  const r = parseReport(FULL_PASTE);
  assertEquals(r.parsed["income"]["Cash Per Wave"], "1,000");
});

Deno.test("parseReport full paste: battle_report section has raw values", () => {
  const r = parseReport(FULL_PASTE);
  assertEquals(r.parsed["battle_report"]["Tier"], "5");
  assertEquals(r.parsed["battle_report"]["Wave"], "1,234");
});

// ---------------------------------------------------------------------------
// parseReport — tab separator
// ---------------------------------------------------------------------------

Deno.test("parseReport: tab-separated key/value parsed correctly", () => {
  const r = parseReport("Battle Date\t2024-01-01\nTier\t7\n");
  assertEquals(r.tier, 7);
  assertNotEquals(r.occurred_at, null);
});

// ---------------------------------------------------------------------------
// parseReport — prototype-pollution guard (THE key regression target)
// ---------------------------------------------------------------------------

Deno.test("parseReport prototype-pollution: 'constructor' header does not clobber Object.prototype", () => {
  // Before: Object.prototype is clean
  assertEquals((({}) as Record<string, unknown>).polluted, undefined);

  const r = parseReport("constructor\npolluted  yes\n");

  // After: Object.prototype must still be clean
  assertEquals((({}) as Record<string, unknown>).polluted, undefined);
  assertEquals((Object.prototype as Record<string, unknown>).polluted, undefined);

  // The section IS stored under 'constructor' in the null-prototype map — it should
  // be accessible by key but NOT through prototype traversal of a plain object.
  assertEquals(r.parsed["constructor"]["polluted"], "yes");
});

Deno.test("parseReport prototype-pollution: '__proto__' header does not inject into prototype chain", () => {
  const r = parseReport("__proto__\ninjected  yes\n");

  // Object.prototype must be clean
  assertEquals((({}) as Record<string, unknown>).injected, undefined);
  // The __proto__ section normalizes to '__proto__'; check it didn't land on Object.prototype
  // (Note: Object.create(null) map — '__proto__' as a plain key should not escape)
  assertEquals((Object.prototype as Record<string, unknown>).injected, undefined);
  // Silence the unused-var lint — just confirming return is a usable object
  assertNotEquals(r, null);
});

Deno.test("parseReport prototype-pollution: 'hasOwnProperty' header does not replace Object.prototype.hasOwnProperty", () => {
  parseReport("hasOwnProperty\npolluted  yes\n");
  // The built-in hasOwnProperty must still be a function on a fresh object
  assertEquals(typeof ({}).hasOwnProperty, "function");
});

Deno.test("parseReport: returned parsed has null prototype (Object.create(null))", () => {
  const r = parseReport(FULL_PASTE);
  assertEquals(Object.getPrototypeOf(r.parsed), null);
});

// ---------------------------------------------------------------------------
// parseReport — NaN guard on tier/wave
// ---------------------------------------------------------------------------

Deno.test("parseReport NaN guard: non-numeric Tier becomes null, not NaN", () => {
  const r = parseReport("Tier  abc\n");
  assertEquals(r.tier, null);
  // Explicit: must not be NaN
  assertEquals(Number.isNaN(r.tier), false);
});

Deno.test("parseReport NaN guard: non-numeric Wave becomes null, not NaN", () => {
  const r = parseReport("Wave  xyz\n");
  assertEquals(r.wave, null);
  assertEquals(Number.isNaN(r.wave), false);
});

// Pinning actual parseInt partial-parse behavior:
// parseInt("12abc") = 12; Number.isFinite(12) = true → stores 12, not null.
// This is a known quirk of using parseInt — the test documents reality, not ideal behavior.
Deno.test("parseReport NaN guard (quirk): '12abc' partial-parse via parseInt yields 12, not null", () => {
  // QUIRK: parseInt("12abc") = 12 passes Number.isFinite, so tier/wave store 12.
  // If this changes (e.g., a stricter guard like /^\d+$/ is added), update this test.
  const r = parseReport("Tier  12abc\nWave  12abc\n");
  assertEquals(r.tier, 12);
  assertEquals(r.wave, 12);
});

Deno.test("parseReport: wave with comma separator (1,234 → 1234)", () => {
  const r = parseReport("Wave  1,234\n");
  assertEquals(r.wave, 1234);
});

// ---------------------------------------------------------------------------
// parseReport — date handling (key regression: must NOT fabricate current time)
// ---------------------------------------------------------------------------

Deno.test("parseReport date: missing Battle Date → occurred_at is null", () => {
  // THE regression guard: before hardening, this returned new Date().toISOString().
  const r = parseReport("Tier  3\nWave  10\n");
  assertEquals(r.occurred_at, null);
});

Deno.test("parseReport date: unparseable Battle Date → occurred_at is null", () => {
  const r = parseReport("Battle Date  not-a-real-date\n");
  assertEquals(r.occurred_at, null);
});

Deno.test("parseReport date: valid Battle Date → non-null ISO string", () => {
  const r = parseReport("Battle Date  2024-06-01 12:00:00\n");
  assertNotEquals(r.occurred_at, null);
  // Must round-trip through Date without NaN
  assertEquals(isNaN(new Date(r.occurred_at!).getTime()), false);
});

Deno.test("parseReport date: empty Battle Date value → occurred_at is null", () => {
  // A line with 'Battle Date' but no value is treated as a section header (no value part),
  // so top["Battle Date"] is undefined → parseBattleDate("") → null.
  const r = parseReport("Battle Date\n");
  assertEquals(r.occurred_at, null);
});

// ---------------------------------------------------------------------------
// parseReport — duration_s via parseDuration (tested indirectly)
// ---------------------------------------------------------------------------

Deno.test("parseReport duration: seconds only (45s → 45)", () => {
  assertEquals(parseReport("Real Time  45s\n").duration_s, 45);
});

Deno.test("parseReport duration: hours + minutes + seconds (1h 23m 45s → 5025)", () => {
  assertEquals(parseReport("Real Time  1h 23m 45s\n").duration_s, 5025);
});

Deno.test("parseReport duration: days + hours (1d 2h → 93600)", () => {
  assertEquals(parseReport("Real Time  1d 2h\n").duration_s, 93600);
});

Deno.test("parseReport duration: missing Real Time → duration_s is null", () => {
  assertEquals(parseReport("Tier  1\n").duration_s, null);
});

// ---------------------------------------------------------------------------
// parseReport — meaningless / empty input
// ---------------------------------------------------------------------------

Deno.test("parseReport empty string: all scalars null", () => {
  const r = parseReport("");
  assertEquals(r.occurred_at, null);
  assertEquals(r.tier, null);
  assertEquals(r.wave, null);
  assertEquals(r.coins, null);
  assertEquals(r.duration_s, null);
});

Deno.test("parseReport empty string: parsed.battle_report is empty object", () => {
  const r = parseReport("");
  assertEquals(Object.keys(r.parsed["battle_report"]).length, 0);
});

Deno.test("parseReport whitespace-only: all scalars null", () => {
  const r = parseReport("   \n  \n  ");
  assertEquals(r.tier, null);
  assertEquals(r.wave, null);
  assertEquals(r.coins, null);
  assertEquals(r.duration_s, null);
  assertEquals(r.occurred_at, null);
});

Deno.test("parseReport whitespace-only: no extra sections beyond battle_report", () => {
  const r = parseReport("   \n  \n  ");
  assertEquals(Object.keys(r.parsed).length, 1);
});
