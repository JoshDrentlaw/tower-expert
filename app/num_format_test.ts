// num_format_test.ts — parsing + formatting of human-entered build numbers.
//
// Run: deno test app/num_format_test.ts
// (No DB, no env vars — num_format.ts is pure.)

import { assertAlmostEquals, assertEquals } from "@std/assert";
import { formatNum, parseHuman } from "./num_format.ts";

// ---------------------------------------------------------------------------
// parseHuman — magnitude shorthand ("num")
// ---------------------------------------------------------------------------

Deno.test("parseHuman num: plain integer", () => {
  assertEquals(parseHuman("42"), 42);
});

Deno.test("parseHuman num: decimal", () => {
  assertEquals(parseHuman("3.9"), 3.9);
});

Deno.test("parseHuman num: 869.03M → 869030000", () => {
  assertEquals(parseHuman("869.03M"), 869_030_000);
});

Deno.test("parseHuman num: thousands separators stripped", () => {
  assertEquals(parseHuman("12,345"), 12_345);
});

Deno.test("parseHuman num: whitespace around value tolerated", () => {
  assertEquals(parseHuman("  1.5K  "), 1500);
});

// Suffixes are CASE-SENSITIVE — this is the dangerous collision.
Deno.test("parseHuman num: lowercase q is 1e15", () => {
  assertEquals(parseHuman("2q"), 2e15);
});

Deno.test("parseHuman num: uppercase Q is 1e18", () => {
  assertEquals(parseHuman("2Q"), 2e18);
});

Deno.test("parseHuman num: lowercase s is 1e21, not seconds", () => {
  assertEquals(parseHuman("3s"), 3e21);
});

Deno.test("parseHuman num: uppercase S is 1e24", () => {
  assertEquals(parseHuman("3S"), 3e24);
});

Deno.test("parseHuman: null → null", () => {
  assertEquals(parseHuman(null), null);
});

Deno.test("parseHuman: empty string → null", () => {
  assertEquals(parseHuman(""), null);
});

Deno.test("parseHuman: whitespace-only → null", () => {
  assertEquals(parseHuman("   "), null);
});

Deno.test("parseHuman num: garbage → null", () => {
  assertEquals(parseHuman("abc"), null);
});

Deno.test("parseHuman num: unknown suffix → null", () => {
  assertEquals(parseHuman("5G"), null);
});

// ---------------------------------------------------------------------------
// parseHuman — units strip the game's decorations
// ---------------------------------------------------------------------------

Deno.test("parseHuman pct: trailing % stripped", () => {
  assertEquals(parseHuman("56.4%", "pct"), 56.4);
});

Deno.test("parseHuman pct: bare number works too", () => {
  assertEquals(parseHuman("56.4", "pct"), 56.4);
});

Deno.test("parseHuman sec: trailing s stripped", () => {
  assertEquals(parseHuman("14.00s", "sec"), 14);
});

Deno.test("parseHuman mult: leading × stripped", () => {
  assertEquals(parseHuman("×1.01234", "mult"), 1.01234);
});

Deno.test("parseHuman mult: ascii x stripped", () => {
  assertEquals(parseHuman("x1.5", "mult"), 1.5);
});

Deno.test("parseHuman mult: per-meter /m suffix stripped", () => {
  assertEquals(parseHuman("×1.012 / m", "mult"), 1.012);
});

// ---------------------------------------------------------------------------
// formatNum — render canonical numbers per unit
// ---------------------------------------------------------------------------

Deno.test("formatNum num: 869030000 → 869.03M", () => {
  assertEquals(formatNum(869_030_000), "869.03M");
});

Deno.test("formatNum num: small number uses locale string", () => {
  assertEquals(formatNum(42), "42");
});

Deno.test("formatNum num: null → em dash", () => {
  assertEquals(formatNum(null), "—");
});

Deno.test("formatNum pct: 56.4 → 56.4%", () => {
  assertEquals(formatNum(56.4, "pct"), "56.4%");
});

Deno.test("formatNum sec: 14 → 14s", () => {
  assertEquals(formatNum(14, "sec"), "14s");
});

Deno.test("formatNum mult: 1.012 → ×1.012", () => {
  assertEquals(formatNum(1.012, "mult"), "×1.012");
});

Deno.test("formatNum mult: trailing zeros trimmed", () => {
  assertEquals(formatNum(1.01, "mult"), "×1.01");
});

// ---------------------------------------------------------------------------
// round-trip — what you see is what re-parses (at display precision)
// ---------------------------------------------------------------------------

Deno.test("round-trip num: 869.03M survives format→parse", () => {
  assertEquals(parseHuman(formatNum(869_030_000, "num"), "num"), 869_030_000);
});

Deno.test("round-trip pct: 56.4 survives format→parse", () => {
  assertAlmostEquals(parseHuman(formatNum(56.4, "pct"), "pct")!, 56.4);
});

Deno.test("round-trip mult: 1.01234 survives format→parse", () => {
  assertAlmostEquals(parseHuman(formatNum(1.01234, "mult"), "mult")!, 1.01234);
});

Deno.test("round-trip sec: 14 survives format→parse", () => {
  assertEquals(parseHuman(formatNum(14, "sec"), "sec"), 14);
});

// ---------------------------------------------------------------------------
// parseHuman — negative values
// ---------------------------------------------------------------------------

Deno.test("parseHuman num: negative integer", () => {
  assertEquals(parseHuman("-5"), -5);
});

Deno.test("parseHuman num: negative with magnitude suffix -5M", () => {
  assertEquals(parseHuman("-5M"), -5_000_000);
});

Deno.test("parseHuman sec: negative seconds -14s", () => {
  assertEquals(parseHuman("-14s", "sec"), -14);
});

Deno.test("parseHuman pct: negative percent -56.4%", () => {
  assertEquals(parseHuman("-56.4%", "pct"), -56.4);
});

// ---------------------------------------------------------------------------
// parseHuman — malformed / pathological input
// ---------------------------------------------------------------------------

Deno.test("parseHuman num: embedded space '1 . 5' → null", () => {
  // The regex requires a contiguous digit block; an embedded space breaks it.
  assertEquals(parseHuman("1 . 5"), null);
});

Deno.test("parseHuman num: bare '.' → null", () => {
  assertEquals(parseHuman("."), null);
});

Deno.test("parseHuman num: 'M' alone (no digits) → null", () => {
  assertEquals(parseHuman("M"), null);
});

Deno.test("parseHuman num: '%' alone → null", () => {
  assertEquals(parseHuman("%"), null);
});

Deno.test("parseHuman mult: '×' alone (no digits after stripping) → null", () => {
  assertEquals(parseHuman("×", "mult"), null);
});

Deno.test("parseHuman mult: 'x' alone → null", () => {
  assertEquals(parseHuman("x", "mult"), null);
});

// ---------------------------------------------------------------------------
// parseHuman — pct/sec/mult given a magnitude suffix (silent-truncation audit)
// ---------------------------------------------------------------------------
// These parsers use parsePlain (not expandMagnitude), so JS parseFloat stops at
// the first non-numeric character. The magnitude letter is ignored silently rather
// than causing an error. This is pinned behavior: if it changes, these tests catch it.

Deno.test("parseHuman pct: '5M%' — M is swallowed by parseFloat, yields 5 not 5e6", () => {
  // parsePlain('5M') = parseFloat('5M') = 5 (JS parseFloat stops at 'M')
  assertEquals(parseHuman("5M%", "pct"), 5);
});

Deno.test("parseHuman sec: '100Ms' — M before s, yields 100 not 1e8", () => {
  assertEquals(parseHuman("100Ms", "sec"), 100);
});

Deno.test("parseHuman mult: '5M' — M swallowed, yields 5 not 5e6", () => {
  assertEquals(parseHuman("5M", "mult"), 5);
});

// sec parser strips /s$/i so uppercase S is consumed as a seconds marker.
Deno.test("parseHuman sec: '14S' — uppercase S stripped as seconds suffix, yields 14", () => {
  assertEquals(parseHuman("14S", "sec"), 14);
});

// ---------------------------------------------------------------------------
// formatNum — zero, negative, NaN/Infinity, boundary at 1e3
// ---------------------------------------------------------------------------

Deno.test("formatNum num: 0 → '0' (below threshold, locale string)", () => {
  assertEquals(formatNum(0), "0");
});

Deno.test("formatNum pct: 0 → '0%'", () => {
  assertEquals(formatNum(0, "pct"), "0%");
});

Deno.test("formatNum sec: 0 → '0s'", () => {
  assertEquals(formatNum(0, "sec"), "0s");
});

Deno.test("formatNum mult: 0 → '×0'", () => {
  assertEquals(formatNum(0, "mult"), "×0");
});

Deno.test("formatNum num: 999 — below K threshold, plain locale string", () => {
  assertEquals(formatNum(999), "999");
});

Deno.test("formatNum num: 1000 — exactly at K threshold", () => {
  assertEquals(formatNum(1000), "1.00K");
});

Deno.test("formatNum num: 999.9 — just below K threshold", () => {
  assertEquals(formatNum(999.9), "999.9");
});

Deno.test("formatNum num: negative -1500 → '-1.50K'", () => {
  assertEquals(formatNum(-1500), "-1.50K");
});

Deno.test("formatNum num: negative -1e9 → '-1.00B'", () => {
  assertEquals(formatNum(-1e9), "-1.00B");
});

Deno.test("formatNum num: NaN → em dash", () => {
  assertEquals(formatNum(NaN), "—");
});

Deno.test("formatNum num: Infinity → em dash", () => {
  assertEquals(formatNum(Infinity), "—");
});

Deno.test("formatNum num: -Infinity → em dash", () => {
  assertEquals(formatNum(-Infinity), "—");
});

Deno.test("formatNum num: undefined → em dash", () => {
  assertEquals(formatNum(undefined), "—");
});

Deno.test("formatNum mult: negative -1.012 → '×-1.012' (× prefix, then negative digits)", () => {
  // Pinned: the format is ×-1.012, not -×1.012. Confirm round-trip still works.
  assertEquals(formatNum(-1.012, "mult"), "×-1.012");
});

// ---------------------------------------------------------------------------
// round-trip — every suffix boundary value
// ---------------------------------------------------------------------------

Deno.test("round-trip num: 1K boundary (1000)", () => {
  assertEquals(parseHuman(formatNum(1_000, "num"), "num"), 1_000);
});

Deno.test("round-trip num: 0 (below all suffixes)", () => {
  assertEquals(parseHuman(formatNum(0, "num"), "num"), 0);
});

Deno.test("round-trip num: 1q (1e15) — lowercase case-sensitive suffix", () => {
  assertEquals(parseHuman(formatNum(1e15, "num"), "num"), 1e15);
});

Deno.test("round-trip num: 1Q (1e18) — uppercase case-sensitive suffix", () => {
  assertEquals(parseHuman(formatNum(1e18, "num"), "num"), 1e18);
});

Deno.test("round-trip num: 1s (1e21) — lowercase s suffix (not seconds)", () => {
  assertEquals(parseHuman(formatNum(1e21, "num"), "num"), 1e21);
});

Deno.test("round-trip num: 1S (1e24) — uppercase S suffix", () => {
  assertEquals(parseHuman(formatNum(1e24, "num"), "num"), 1e24);
});

Deno.test("round-trip num: 1O (1e27)", () => {
  assertEquals(parseHuman(formatNum(1e27, "num"), "num"), 1e27);
});

Deno.test("round-trip num: 1N (1e30)", () => {
  assertEquals(parseHuman(formatNum(1e30, "num"), "num"), 1e30);
});

Deno.test("round-trip num: negative -5M", () => {
  assertEquals(parseHuman(formatNum(-5_000_000, "num"), "num"), -5_000_000);
});

Deno.test("round-trip mult: negative -1.012 survives format→parse", () => {
  // formatNum gives '×-1.012'; parseHuman strips the leading ×, parsePlain('-1.012') = -1.012
  assertEquals(parseHuman(formatNum(-1.012, "mult"), "mult"), -1.012);
});

Deno.test("round-trip pct: 0 survives format→parse", () => {
  assertEquals(parseHuman(formatNum(0, "pct"), "pct"), 0);
});

Deno.test("round-trip sec: 0 survives format→parse", () => {
  assertEquals(parseHuman(formatNum(0, "sec"), "sec"), 0);
});

Deno.test("round-trip mult: 0 survives format→parse", () => {
  assertEquals(parseHuman(formatNum(0, "mult"), "mult"), 0);
});

// ---------------------------------------------------------------------------
// float precision above 1e15 — documented imprecision is acceptable/tested
// ---------------------------------------------------------------------------

Deno.test("parseHuman num: 1.23S (1.23e24) parses exactly at JS float precision", () => {
  // 1.23e24 is representable in IEEE-754 double; no precision loss here.
  assertEquals(parseHuman("1.23S"), 1.23e24);
});

Deno.test("round-trip num: 1.23e24 (1.23S) — exact at this precision", () => {
  assertEquals(parseHuman(formatNum(1.23e24, "num"), "num"), 1.23e24);
});

Deno.test("parseHuman num: 1.23456789q (1.23456789e15) — 15-digit precision at JS float limit", () => {
  // 1.23456789e15 = 1234567890000000, which JS can represent exactly.
  assertEquals(parseHuman("1.23456789q"), 1_234_567_890_000_000);
});

// ---------------------------------------------------------------------------
// case-sensitivity — full suffix collision table
// ---------------------------------------------------------------------------

Deno.test("parseHuman num: 1K → 1000", () => {
  assertEquals(parseHuman("1K"), 1e3);
});

Deno.test("parseHuman num: 1M → 1e6", () => {
  assertEquals(parseHuman("1M"), 1e6);
});

Deno.test("parseHuman num: 1B → 1e9", () => {
  assertEquals(parseHuman("1B"), 1e9);
});

Deno.test("parseHuman num: 1T → 1e12", () => {
  assertEquals(parseHuman("1T"), 1e12);
});

Deno.test("parseHuman num: lowercase k is NOT a valid suffix → null", () => {
  // Only uppercase K is in the suffix table.
  assertEquals(parseHuman("1k"), null);
});

Deno.test("parseHuman num: lowercase m → null (only uppercase M is valid)", () => {
  assertEquals(parseHuman("1m"), null);
});

Deno.test("parseHuman num: 1O → 1e27 (O is valid)", () => {
  assertEquals(parseHuman("1O"), 1e27);
});

Deno.test("parseHuman num: 1N → 1e30 (N is valid)", () => {
  assertEquals(parseHuman("1N"), 1e30);
});
