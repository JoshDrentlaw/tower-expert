// stat_schema_test.ts — regression + behavior-pinning tests for stat_schema.ts
//
// Run: deno test app/stat_schema_test.ts
// (No DB, no env vars needed — stat_schema.ts is pure.)

import { assertEquals } from "@std/assert";
import { coerce, STAT_SCHEMA } from "./stat_schema.ts";

// ---------------------------------------------------------------------------
// coerce — null and empty string (all types)
// ---------------------------------------------------------------------------

Deno.test("coerce int: null → null", () => {
  assertEquals(coerce("int", null), null);
});

Deno.test("coerce int: empty string → null", () => {
  assertEquals(coerce("int", ""), null);
});

Deno.test("coerce number: null → null", () => {
  assertEquals(coerce("number", null), null);
});

Deno.test("coerce number: empty string → null", () => {
  assertEquals(coerce("number", ""), null);
});

Deno.test("coerce bool: null → null", () => {
  assertEquals(coerce("bool", null), null);
});

Deno.test("coerce bool: empty string → null", () => {
  assertEquals(coerce("bool", ""), null);
});

Deno.test("coerce text: null → null", () => {
  assertEquals(coerce("text", null), null);
});

Deno.test("coerce text: empty string → null", () => {
  assertEquals(coerce("text", ""), null);
});

Deno.test("coerce select: null → null", () => {
  assertEquals(coerce("select", null), null);
});

Deno.test("coerce select: empty string → null", () => {
  assertEquals(coerce("select", ""), null);
});

// ---------------------------------------------------------------------------
// coerce — int
// ---------------------------------------------------------------------------

Deno.test("coerce int: integer string → integer", () => {
  assertEquals(coerce("int", "42"), 42);
});

// Numeric fields now accept the game's magnitude shorthand and keep decimals
// (no truncation) — that's the whole point of the human-number change.
Deno.test("coerce int: keeps decimals now (3.9 → 3.9, no truncation)", () => {
  assertEquals(coerce("int", "3.9"), 3.9);
});

Deno.test("coerce int: negative integer", () => {
  assertEquals(coerce("int", "-5"), -5);
});

Deno.test("coerce int: negative decimal kept (-3.9 → -3.9)", () => {
  assertEquals(coerce("int", "-3.9"), -3.9);
});

Deno.test("coerce int: magnitude shorthand 869.03M → 869030000", () => {
  assertEquals(coerce("int", "869.03M"), 869030000);
});

Deno.test("coerce int: thousands separators tolerated (12,345 → 12345)", () => {
  assertEquals(coerce("int", "12,345"), 12345);
});

Deno.test("coerce int: non-numeric string → null", () => {
  assertEquals(coerce("int", "abc"), null);
});

// The whitespace footgun is gone: the shorthand parser trims first, so a field
// that's blank-but-not-empty yields null instead of silently writing 0.
Deno.test("coerce int: whitespace-only '   ' → null (parser trims first)", () => {
  assertEquals(coerce("int", "   "), null);
});

// Hex and scientific notation are NOT part of the game's number syntax, so the
// magnitude parser rejects them (no longer the old Number() coercion).
Deno.test("coerce int: hex string '0x10' → null (not game shorthand)", () => {
  assertEquals(coerce("int", "0x10"), null);
});

Deno.test("coerce int: scientific notation '1e2' → null (not game shorthand)", () => {
  assertEquals(coerce("int", "1e2"), null);
});

// ---------------------------------------------------------------------------
// coerce — unit-aware numeric input (the decorations the game shows)
// ---------------------------------------------------------------------------

Deno.test("coerce pct: strips trailing % (56.4% → 56.4)", () => {
  assertEquals(coerce("number", "56.4%", "pct"), 56.4);
});

Deno.test("coerce mult: strips leading × (×1.012 → 1.012)", () => {
  assertEquals(coerce("number", "×1.012", "mult"), 1.012);
});

Deno.test("coerce sec: strips trailing s (14.00s → 14)", () => {
  assertEquals(coerce("number", "14.00s", "sec"), 14);
});

// ---------------------------------------------------------------------------
// coerce — number (float, no truncation)
// ---------------------------------------------------------------------------

Deno.test("coerce number: float string → float (no truncation)", () => {
  assertEquals(coerce("number", "3.9"), 3.9);
});

Deno.test("coerce number: integer string → integer value", () => {
  assertEquals(coerce("number", "42"), 42);
});

Deno.test("coerce number: non-numeric string → null", () => {
  assertEquals(coerce("number", "abc"), null);
});

// ---------------------------------------------------------------------------
// coerce — bool
// ---------------------------------------------------------------------------

Deno.test("coerce bool: 'on' → true (checkbox checked value)", () => {
  assertEquals(coerce("bool", "on"), true);
});

Deno.test("coerce bool: 'true' → true", () => {
  assertEquals(coerce("bool", "true"), true);
});

Deno.test("coerce bool: 'off' → false", () => {
  assertEquals(coerce("bool", "off"), false);
});

Deno.test("coerce bool: 'false' → false", () => {
  assertEquals(coerce("bool", "false"), false);
});

Deno.test("coerce bool: 'yes' → false (only 'on'/'true' are truthy)", () => {
  assertEquals(coerce("bool", "yes"), false);
});

Deno.test("coerce bool: '1' → false (only 'on'/'true' are truthy)", () => {
  assertEquals(coerce("bool", "1"), false);
});

Deno.test("coerce bool: arbitrary string → false", () => {
  assertEquals(coerce("bool", "anything"), false);
});

// ---------------------------------------------------------------------------
// coerce — text and select pass-through
// ---------------------------------------------------------------------------

Deno.test("coerce text: non-empty string passes through unchanged", () => {
  assertEquals(coerce("text", "hello world"), "hello world");
});

Deno.test("coerce select: non-empty string passes through unchanged", () => {
  assertEquals(coerce("select", "Legendary"), "Legendary");
});

// ---------------------------------------------------------------------------
// STAT_SCHEMA structural sanity
// ---------------------------------------------------------------------------

Deno.test("STAT_SCHEMA: every category has a unique key", () => {
  const keys = STAT_SCHEMA.map((c) => c.key);
  const unique = new Set(keys);
  assertEquals(
    unique.size,
    keys.length,
    `Duplicate category keys found: ${keys.filter((k, i) => keys.indexOf(k) !== i)}`,
  );
});

Deno.test("STAT_SCHEMA: every field key is unique within its category", () => {
  for (const cat of STAT_SCHEMA) {
    const keys = cat.fields.map((f) => f.key);
    const unique = new Set(keys);
    assertEquals(
      unique.size,
      keys.length,
      `Category '${cat.key}' has duplicate field keys: ${
        keys.filter((k, i) => keys.indexOf(k) !== i)
      }`,
    );
  }
});

// THE latent-bug regression guard flagged in the review:
// An enhancement.key that equals a sibling field.key in the same category would
// cause the enhancement value to silently overwrite the field value in builds.data
// (both land in data[category][key]). There are no collisions today — this test
// ensures there never will be.
Deno.test(
  "STAT_SCHEMA: no enhancement.key collides with a sibling field.key in same category",
  () => {
    for (const cat of STAT_SCHEMA) {
      const fieldKeys = new Set(cat.fields.map((f) => f.key));
      for (const field of cat.fields) {
        if (field.enhancement) {
          assertEquals(
            fieldKeys.has(field.enhancement.key),
            false,
            `Category '${cat.key}': enhancement key '${field.enhancement.key}' ` +
              `collides with field key '${field.enhancement.key}'`,
          );
        }
      }
    }
  },
);

Deno.test("STAT_SCHEMA: every category has a non-empty title", () => {
  for (const cat of STAT_SCHEMA) {
    assertEquals(
      cat.title.length > 0,
      true,
      `Category '${cat.key}' has empty title`,
    );
  }
});

Deno.test("STAT_SCHEMA: every field has a non-empty label", () => {
  for (const cat of STAT_SCHEMA) {
    for (const field of cat.fields) {
      assertEquals(
        field.label.length > 0,
        true,
        `Field '${cat.key}.${field.key}' has empty label`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// Section-fix structure (PR: utility/UW/modules)
// ---------------------------------------------------------------------------

Deno.test("STAT_SCHEMA: all 9 Ultimate Weapons are present as their own categories", () => {
  const uwKeys = STAT_SCHEMA.filter((c) => c.key.startsWith("uw_")).map((c) => c.key);
  assertEquals(uwKeys.length, 9, `expected 9 UW categories, got ${uwKeys.length}: ${uwKeys}`);
  for (
    const k of ["uw_golden_tower", "uw_poison_swamp", "uw_inner_land_mines", "uw_chrono_field"]
  ) {
    assertEquals(uwKeys.includes(k), true, `missing UW category '${k}'`);
  }
});

Deno.test("STAT_SCHEMA: every Modules field carries a group (column layout)", () => {
  const modules = STAT_SCHEMA.find((c) => c.key === "modules")!;
  const groups = new Set(modules.fields.map((f) => f.group?.key));
  assertEquals(
    modules.fields.every((f) => !!f.group),
    true,
    "a Modules field is missing its group",
  );
  assertEquals([...groups].sort(), ["armor", "cannon", "core", "generator"]);
});

Deno.test("STAT_SCHEMA: each module has 6 structured substat slots (type select + value)", () => {
  const modules = STAT_SCHEMA.find((c) => c.key === "modules")!;
  for (const mod of ["cannon", "armor", "generator", "core"]) {
    const types = modules.fields.filter((f) => new RegExp(`^${mod}_sub\\d+_type$`).test(f.key));
    const vals = modules.fields.filter((f) => new RegExp(`^${mod}_sub\\d+_val$`).test(f.key));
    assertEquals(types.length, 6, `module '${mod}' should have 6 substat-type pickers`);
    assertEquals(vals.length, 6, `module '${mod}' should have 6 substat-value fields`);
    assertEquals(
      types.every((f) => f.type === "select"),
      true,
      `${mod} substat types must be selects`,
    );
    assertEquals(
      types.every((f) => (f.options ?? []).length > 0),
      true,
      `${mod} substat types need a pool`,
    );
    assertEquals(vals.every((f) => f.type === "text"), true, `${mod} substat values must be text`);
  }
});

Deno.test("STAT_SCHEMA: each module substat slot leads with a rarity select", () => {
  const modules = STAT_SCHEMA.find((c) => c.key === "modules")!;
  for (const mod of ["cannon", "armor", "generator", "core"]) {
    const rarities = modules.fields.filter((f) =>
      new RegExp(`^${mod}_sub\\d+_rarity$`).test(f.key)
    );
    assertEquals(rarities.length, 6, `module '${mod}' should have 6 substat-rarity pickers`);
    assertEquals(
      rarities.every((f) => f.type === "select" && (f.options ?? []).includes("Ancestral")),
      true,
      `${mod} substat rarities must be selects over the rarity ladder`,
    );
  }
});

Deno.test("STAT_SCHEMA: each module has a free-text Main Effect field", () => {
  const modules = STAT_SCHEMA.find((c) => c.key === "modules")!;
  for (const mod of ["cannon", "armor", "generator", "core"]) {
    const effect = modules.fields.find((f) => f.key === `${mod}_effect`);
    assertEquals(effect?.type, "text", `module '${mod}' should have a text Main Effect field`);
  }
});

Deno.test("STAT_SCHEMA: substat pools are module-type specific", () => {
  const modules = STAT_SCHEMA.find((c) => c.key === "modules")!;
  const pool = (mod: string) =>
    modules.fields.find((f) => f.key === `${mod}_sub1_type`)!.options ?? [];
  assertEquals(pool("cannon").includes("Crit Chance"), true);
  assertEquals(pool("armor").includes("Lifesteal"), true);
  assertEquals(pool("generator").includes("Interest / Wave"), true);
  assertEquals(pool("core").includes("Golden Tower — Bonus"), true);
  // Cannon's attack pool should not contain a defense effect.
  assertEquals(pool("cannon").includes("Lifesteal"), false);
});

Deno.test("STAT_SCHEMA: module rarity options include the + merge tiers", () => {
  const rarity = STAT_SCHEMA.find((c) => c.key === "modules")!
    .fields.find((f) => f.key === "cannon_rarity")!;
  for (const tier of ["Rare+", "Epic+", "Legendary+", "Mythic+", "Ancestral+"]) {
    assertEquals((rarity.options ?? []).includes(tier), true, `rarity list missing '${tier}'`);
  }
});

Deno.test("STAT_SCHEMA: enemy level skips are workshop fields paired with an (Enh) enhancement", () => {
  const util = STAT_SCHEMA.find((c) => c.key === "workshop_utility")!;
  for (const base of ["enemy_atk_level_skip", "enemy_hp_level_skip"]) {
    const field = util.fields.find((f) => f.key === base)!;
    assertEquals(field?.unit, "pct", `${base} should be a percent`);
    assertEquals(field?.enhancement?.key, `${base}_enh`, `${base} should pair with ${base}_enh`);
    assertEquals(field?.enhancement?.unit, "pct", `${base}_enh should be a percent`);
  }
});
