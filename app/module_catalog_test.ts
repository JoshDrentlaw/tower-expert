// module_catalog_test.ts — pure catalog invariants (no DB, no env).
//
// Run: deno test app/module_catalog_test.ts

import { assertEquals } from "@std/assert";
import { findModule, MODULE_CATALOG, modulesByType } from "./module_catalog.ts";

Deno.test("MODULE_CATALOG: 24 modules, 6 per type", () => {
  assertEquals(MODULE_CATALOG.length, 24);
  for (const type of ["cannon", "armor", "generator", "core"] as const) {
    assertEquals(modulesByType(type).length, 6, `${type} should have 6 modules`);
  }
});

Deno.test("MODULE_CATALOG: names are unique and every module has a unique effect", () => {
  const names = MODULE_CATALOG.map((m) => m.name);
  assertEquals(new Set(names).size, names.length, "duplicate module names");
  for (const m of MODULE_CATALOG) {
    assertEquals(m.unique.trim().length > 0, true, `${m.name} missing unique effect`);
  }
});

Deno.test("findModule: case-insensitive, trims, and rejects unknown/empty", () => {
  assertEquals(findModule("Amplifying Strike")?.type, "cannon");
  assertEquals(findModule("  amplifying strike  ")?.name, "Amplifying Strike");
  assertEquals(findModule("Galaxy Compressor")?.mainEffect, "Coin Bonus");
  assertEquals(findModule("Not A Real Module"), undefined);
  assertEquals(findModule(""), undefined);
  assertEquals(findModule(null), undefined);
});
