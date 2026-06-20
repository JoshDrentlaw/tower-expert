// build_lineage_test.ts — pure lineage grouping (no DB, no env).
//
// Run: deno test app/build_lineage_test.ts

import { assertEquals } from "@std/assert";
import { buildLines, type BuildNode, lineContaining } from "./build_lineage.ts";

const b = (id: number, parent: number | null, day: number, label = "Main Farm"): BuildNode => ({
  id,
  label,
  parent_build_id: parent,
  created_at: `2026-06-${String(day).padStart(2, "0")}T00:00:00Z`,
});

Deno.test("buildLines: a linear chain collapses to one line, head = newest", () => {
  const lines = buildLines([b(1, null, 1), b(2, 1, 2), b(3, 2, 3)]);
  assertEquals(lines.length, 1);
  assertEquals(lines[0].count, 3);
  assertEquals(lines[0].head.id, 3);
  assertEquals(lines[0].rootId, 1);
});

Deno.test("buildLines: versions run oldest→newest (root = v1)", () => {
  const lines = buildLines([b(1, null, 1), b(2, 1, 2), b(3, 2, 3)]);
  // snapshots are newest-first
  assertEquals(lines[0].snapshots.map((s) => [s.id, s.version]), [[3, 3], [2, 2], [1, 1]]);
});

Deno.test("buildLines: separate roots are separate lines, newest-active first", () => {
  const lines = buildLines([
    b(1, null, 1, "Cell Push"),
    b(2, 1, 2, "Cell Push"),
    b(10, null, 5, "Main Farm"),
  ]);
  assertEquals(lines.length, 2);
  assertEquals(lines[0].head.id, 10); // Main Farm head is newer (day 5) → first
  assertEquals(lines[1].head.id, 2);
});

Deno.test("buildLines: a build whose parent is outside the set starts its own line", () => {
  // parent 99 not present (beyond the fetched cap) → 5 is treated as a root.
  const lines = buildLines([b(5, 99, 3), b(6, 5, 4)]);
  assertEquals(lines.length, 1);
  assertEquals(lines[0].rootId, 5);
  assertEquals(lines[0].head.id, 6);
});

Deno.test("lineContaining: finds the line holding a given snapshot", () => {
  const builds = [b(1, null, 1), b(2, 1, 2), b(3, 2, 3)];
  assertEquals(lineContaining(builds, 2)?.head.id, 3);
  assertEquals(lineContaining(builds, 99), undefined);
});
