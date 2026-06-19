// stat_formula_test.ts — pure level→value scaling (no DB, no env).
//
// Run: deno test app/stat_formula_test.ts

import { assertEquals } from "@std/assert";
import { type Formula, levelFromValue, valueFromLevel } from "./stat_formula.ts";
import { STAT_SCHEMA } from "./stat_schema.ts";

// A representative linear formula (Attack Speed: 1.00 + 0.05/level, max 99).
const AS: Formula = { base: 1, increment: 0.05, maxLevel: 99 };

// ---------------------------------------------------------------------------
// valueFromLevel
// ---------------------------------------------------------------------------

Deno.test("valueFromLevel: level 0 → base", () => {
  assertEquals(valueFromLevel(AS, 0), 1);
});

Deno.test("valueFromLevel: mid level → base + increment*level", () => {
  assertEquals(valueFromLevel(AS, 20), 2); // 1 + 0.05*20
});

Deno.test("valueFromLevel: max level → documented max", () => {
  assertEquals(valueFromLevel(AS, 99), 5.95);
});

Deno.test("valueFromLevel: above max clamps to maxLevel", () => {
  assertEquals(valueFromLevel(AS, 9999), 5.95);
});

Deno.test("valueFromLevel: cleans binary-float noise (1.2 + 0.1*150 = 16.2)", () => {
  assertEquals(valueFromLevel({ base: 1.2, increment: 0.1, maxLevel: 150 }, 150), 16.2);
});

Deno.test("valueFromLevel: negative level → null", () => {
  assertEquals(valueFromLevel(AS, -1), null);
});

Deno.test("valueFromLevel: non-integer level → null", () => {
  assertEquals(valueFromLevel(AS, 3.5), null);
});

// ---------------------------------------------------------------------------
// levelFromValue — inverse used to prefill the level box from a stored value
// ---------------------------------------------------------------------------

Deno.test("levelFromValue: inverts valueFromLevel exactly", () => {
  for (let lvl = 0; lvl <= AS.maxLevel; lvl++) {
    const v = valueFromLevel(AS, lvl)!;
    assertEquals(levelFromValue(AS, v), lvl);
  }
});

Deno.test("levelFromValue: rounds to the nearest level", () => {
  // 2.98 sits between level 39 (2.95) and 40 (3.00) → nearer 40.
  assertEquals(levelFromValue(AS, 2.98), 40);
  // 2.96 is nearer 39 (2.95).
  assertEquals(levelFromValue(AS, 2.96), 39);
});

Deno.test("levelFromValue: clamps below 0 and above maxLevel", () => {
  assertEquals(levelFromValue(AS, -100), 0);
  assertEquals(levelFromValue(AS, 999), AS.maxLevel);
});

Deno.test("levelFromValue: zero increment has no inverse → null", () => {
  assertEquals(levelFromValue({ base: 5, increment: 0, maxLevel: 10 }, 5), null);
});

// ---------------------------------------------------------------------------
// Schema integrity — guards against a typo'd constant. Every formula-backed
// field's value(maxLevel) is asserted against the value documented on the wiki.
// (WebFetch summaries aren't byte-exact, so this pins the numbers we shipped.)
// ---------------------------------------------------------------------------

// Keyed `<cat>.<field>` → expected value at maxLevel.
const EXPECTED_MAX: Record<string, number> = {
  "workshop_attack.attack_speed": 5.95,
  "workshop_attack.crit_chance": 80,
  "workshop_attack.crit_factor": 16.2,
  "workshop_attack.multishot_chance": 49.5,
  "workshop_attack.multishot_targets": 9,
  "workshop_attack.damage_enh": 5,
  "workshop_attack.attack_speed_enh": 1.75,
  "workshop_attack.crit_factor_enh": 5,
};

Deno.test("STAT_SCHEMA: every formula's value(maxLevel) matches the documented max", () => {
  const seen = new Set<string>();
  const check = (id: string, formula: Formula | undefined) => {
    if (!formula) return;
    seen.add(id);
    const expected = EXPECTED_MAX[id];
    assertEquals(
      expected !== undefined,
      true,
      `${id} has a formula but no expected-max in the test (add it)`,
    );
    assertEquals(valueFromLevel(formula, formula.maxLevel), expected, `${id} max mismatch`);
  };
  for (const cat of STAT_SCHEMA) {
    for (const f of cat.fields) {
      check(`${cat.key}.${f.key}`, f.formula);
      if (f.enhancement) check(`${cat.key}.${f.enhancement.key}`, f.enhancement.formula);
    }
  }
  // Every expected entry must correspond to a real formula field (no stale rows).
  for (const id of Object.keys(EXPECTED_MAX)) {
    assertEquals(seen.has(id), true, `${id} is in EXPECTED_MAX but no longer a formula field`);
  }
});
