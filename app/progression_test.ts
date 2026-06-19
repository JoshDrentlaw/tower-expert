// progression_test.ts — pure chart geometry (no DB, no env).
//
// Run: deno test app/progression_test.ts

import { assertAlmostEquals, assertEquals } from "@std/assert";
import { buildChart, type Sample } from "./progression.ts";

const s = (id: number, t: number, value: number, buildId: number | null = null): Sample => ({
  id,
  t,
  value,
  buildId,
});

Deno.test("buildChart: empty input → empty chart", () => {
  const c = buildChart([]);
  assertEquals(c.plotted, []);
  assertEquals(c.polyline, "");
});

Deno.test("buildChart: sorts ascending by time, then id", () => {
  const c = buildChart([s(2, 200, 5), s(1, 100, 3), s(3, 100, 4)]);
  // 100 (id 1), 100 (id 3), 200 (id 2)
  assertEquals(c.plotted.map((p) => p.id), [1, 3, 2]);
});

Deno.test("buildChart: maps time→x and value→y (inverted), within padding", () => {
  const c = buildChart([s(1, 0, 0), s(2, 100, 10)], { w: 100, h: 100, pad: 10 });
  const [a, b] = c.plotted;
  assertEquals(a.cx, 10); // earliest at left pad
  assertEquals(b.cx, 90); // latest at right edge
  assertEquals(a.cy, 90); // smallest value sits low (high y)
  assertEquals(b.cy, 10); // largest value sits high (low y)
});

Deno.test("buildChart: single sample is centered horizontally", () => {
  const c = buildChart([s(1, 500, 7)], { w: 100, h: 100, pad: 10 });
  assertEquals(c.plotted[0].cx, 50);
});

Deno.test("buildChart: equal timestamps distribute evenly by index", () => {
  const c = buildChart([s(1, 50, 1), s(2, 50, 2), s(3, 50, 3)], { w: 100, h: 100, pad: 10 });
  assertEquals(c.plotted.map((p) => p.cx), [10, 50, 90]);
});

Deno.test("buildChart: flat series pads the value axis so the line is centered", () => {
  const c = buildChart([s(1, 0, 5), s(2, 100, 5)], { w: 100, h: 100, pad: 10 });
  // vMin/vMax padded around 5 → both points at mid-height.
  assertEquals(c.vMin < 5 && c.vMax > 5, true);
  assertAlmostEquals(c.plotted[0].cy, 50, 0.01);
});

Deno.test("buildChart: buildChanged flags only when build differs from previous", () => {
  const c = buildChart([
    s(1, 1, 10, 7),
    s(2, 2, 11, 7), // same build → no change
    s(3, 3, 12, 8), // changed → marker
    s(4, 4, 13, 8), // same build → no change
  ]);
  assertEquals(c.plotted.map((p) => p.buildChanged), [false, false, true, false]);
});

Deno.test("buildChart: first sample never flags a build change", () => {
  const c = buildChart([s(1, 1, 10, 7)]);
  assertEquals(c.plotted[0].buildChanged, false);
});

Deno.test("buildChart: null build to a real build counts as a change", () => {
  const c = buildChart([s(1, 1, 10, null), s(2, 2, 11, 5)]);
  assertEquals(c.plotted.map((p) => p.buildChanged), [false, true]);
});

Deno.test("buildChart: polyline matches plotted coordinates", () => {
  const c = buildChart([s(1, 0, 0), s(2, 100, 10)], { w: 100, h: 100, pad: 10 });
  assertEquals(c.polyline, "10,90 90,10");
});
