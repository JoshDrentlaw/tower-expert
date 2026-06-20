// progression_test.ts — pure data-shaping (no DB, no env).
//
// Run: deno test app/progression_test.ts

import { assertEquals } from "@std/assert";
import {
  coinsPerHour,
  mostFarmedTier,
  type RunInput,
  tiersOf,
  toRunPoints,
} from "./progression.ts";

const run = (over: Partial<RunInput> & { id: number; occurred_at: string }): RunInput => ({
  tier: null,
  wave: null,
  coins: null,
  duration_s: null,
  build_id: null,
  build_label: null,
  ...over,
});

// ---------------------------------------------------------------------------
// coinsPerHour
// ---------------------------------------------------------------------------

Deno.test("coinsPerHour: coins over a duration", () => {
  assertEquals(coinsPerHour(100, 3600), 100); // 100 coins in 1h
  assertEquals(coinsPerHour(100, 1800), 200); // 100 coins in 30m → 200/h
});

Deno.test("coinsPerHour: missing inputs or non-positive duration → null", () => {
  assertEquals(coinsPerHour(null, 3600), null);
  assertEquals(coinsPerHour(100, null), null);
  assertEquals(coinsPerHour(100, 0), null);
  assertEquals(coinsPerHour(100, -5), null);
});

// ---------------------------------------------------------------------------
// toRunPoints
// ---------------------------------------------------------------------------

Deno.test("toRunPoints: sorts ascending by time and computes cph + epoch seconds", () => {
  const pts = toRunPoints([
    run({ id: 1, occurred_at: "2026-06-02T00:00:00Z", coins: 7.2e12, duration_s: 3600 }),
    run({ id: 2, occurred_at: "2026-06-01T00:00:00Z", coins: null, duration_s: 3600 }),
  ]);
  assertEquals(pts.map((p) => p.id), [2, 1]); // earlier first
  assertEquals(pts[0].cph, null); // no coins → null cph
  assertEquals(pts[1].cph, 7.2e12); // 7.2T in 1h
  assertEquals(pts[1].t, Math.floor(Date.parse("2026-06-02T00:00:00Z") / 1000));
});

Deno.test("toRunPoints: carries tier/build through", () => {
  const [p] = toRunPoints([
    run({ id: 5, occurred_at: "2026-06-01T00:00:00Z", tier: 12, build_id: 3, build_label: "Farm" }),
  ]);
  assertEquals(p.tier, 12);
  assertEquals(p.buildId, 3);
  assertEquals(p.buildLabel, "Farm");
});

// ---------------------------------------------------------------------------
// tiersOf / mostFarmedTier
// ---------------------------------------------------------------------------

Deno.test("tiersOf: distinct tiers ascending, ignoring nulls", () => {
  const pts = toRunPoints([
    run({ id: 1, occurred_at: "2026-06-01T00:00:00Z", tier: 12 }),
    run({ id: 2, occurred_at: "2026-06-02T00:00:00Z", tier: 11 }),
    run({ id: 3, occurred_at: "2026-06-03T00:00:00Z", tier: 12 }),
    run({ id: 4, occurred_at: "2026-06-04T00:00:00Z", tier: null }),
  ]);
  assertEquals(tiersOf(pts), [11, 12]);
});

Deno.test("mostFarmedTier: the tier with the most wave-bearing runs", () => {
  const pts = toRunPoints([
    run({ id: 1, occurred_at: "2026-06-01T00:00:00Z", tier: 11, wave: 8000 }),
    run({ id: 2, occurred_at: "2026-06-02T00:00:00Z", tier: 12, wave: 4500 }),
    run({ id: 3, occurred_at: "2026-06-03T00:00:00Z", tier: 11, wave: 8100 }),
    run({ id: 4, occurred_at: "2026-06-04T00:00:00Z", tier: 11, wave: null }), // no wave → ignored
  ]);
  assertEquals(mostFarmedTier(pts), 11);
});

Deno.test("mostFarmedTier: null when no wave-bearing runs", () => {
  const pts = toRunPoints([run({ id: 1, occurred_at: "2026-06-01T00:00:00Z", tier: 11 })]);
  assertEquals(mostFarmedTier(pts), null);
});
