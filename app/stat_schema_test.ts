// stat_schema_test.ts — regression + behavior-pinning tests for stat_schema.ts
//
// Run: deno test app/stat_schema_test.ts
// (No DB, no env vars needed — stat_schema.ts is pure.)

import { assertEquals } from "jsr:@std/assert";
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

Deno.test("coerce int: float string truncates (3.9 → 3)", () => {
  assertEquals(coerce("int", "3.9"), 3);
});

Deno.test("coerce int: negative integer", () => {
  assertEquals(coerce("int", "-5"), -5);
});

Deno.test("coerce int: negative float truncates toward zero (-3.9 → -3)", () => {
  // Math.trunc(-3.9) = -3, not -4
  assertEquals(coerce("int", "-3.9"), -3);
});

Deno.test("coerce int: non-numeric string → null", () => {
  assertEquals(coerce("int", "abc"), null);
});

// QUIRK: Number('   ') === 0, so whitespace-only coerces to 0, not null.
// This is a latent footgun — a blank form field that isn't truly empty could
// silently write 0 to the DB. Pinning current behavior; fix if guard is added.
Deno.test("coerce int: whitespace-only '   ' → 0 (quirk: Number('   ') === 0)", () => {
  assertEquals(coerce("int", "   "), 0);
});

// QUIRK: Number('0x10') === 16, so hex strings coerce to their integer value.
// Form inputs in browsers don't produce hex, but this could matter if data
// arrives via copy-paste or an API. Pinning current behavior.
Deno.test("coerce int: hex string '0x10' → 16 (quirk: Number coerces hex)", () => {
  assertEquals(coerce("int", "0x10"), 16);
});

// QUIRK: Number('1e2') === 100, so scientific notation coerces correctly.
// Same caveat as hex — unusual form input, but documents actual behavior.
Deno.test("coerce int: scientific notation '1e2' → 100 (quirk: Number coerces sci notation)", () => {
  assertEquals(coerce("int", "1e2"), 100);
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
