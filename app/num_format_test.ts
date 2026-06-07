// num_format_test.ts — parsing + formatting of human-entered build numbers.
//
// Run: deno test app/num_format_test.ts
// (No DB, no env vars — num_format.ts is pure.)

import { assertAlmostEquals, assertEquals } from "jsr:@std/assert";
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
