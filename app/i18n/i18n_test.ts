// i18n_test.ts — translation lookup + locale resolution.

import { assertEquals } from "@std/assert";
import { makeT, resolveLocale } from "./index.ts";

// ---------------------------------------------------------------------------
// t() — lookup, fallback chain, interpolation
// ---------------------------------------------------------------------------

Deno.test("t: returns the locale's translation when present", () => {
  assertEquals(makeT("es")("nav.reports"), "reportes");
});

Deno.test("t: falls back to English when the locale lacks the key", () => {
  // es.json has no reportForm.hint — should equal the English string.
  assertEquals(makeT("es")("reportForm.hint"), makeT("en")("reportForm.hint"));
});

Deno.test("t: falls back to the provided default when no catalog has the key", () => {
  assertEquals(makeT("en")("stat.workshop_attack.damage", { default: "Damage" }), "Damage");
});

Deno.test("t: es translates a stat label that has an entry", () => {
  assertEquals(makeT("es")("stat.workshop_attack.damage", { default: "Damage" }), "Daño");
});

Deno.test("t: interpolates {params}", () => {
  assertEquals(
    makeT("en")("error.labelTooLong", { max: 200 }),
    "Label is too long (max 200 characters).",
  );
});

Deno.test("t: unknown key with no default returns the key itself", () => {
  assertEquals(makeT("en")("nope.nope"), "nope.nope");
});

// ---------------------------------------------------------------------------
// resolveLocale — precedence: ?lang= > cookie > Accept-Language > default
// ---------------------------------------------------------------------------

const req = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers });

Deno.test("resolveLocale: ?lang= wins", () => {
  assertEquals(resolveLocale(req("http://x/tower/builds?lang=es")), "es");
});

Deno.test("resolveLocale: cookie used when no query", () => {
  assertEquals(resolveLocale(req("http://x/tower/builds", { cookie: "lang=es" })), "es");
});

Deno.test("resolveLocale: Accept-Language used when no query/cookie", () => {
  assertEquals(
    resolveLocale(req("http://x/tower/builds", { "accept-language": "es-MX,es;q=0.9,en;q=0.8" })),
    "es",
  );
});

Deno.test("resolveLocale: query beats cookie and header", () => {
  assertEquals(
    resolveLocale(
      req("http://x/tower/builds?lang=en", { cookie: "lang=es", "accept-language": "es" }),
    ),
    "en",
  );
});

Deno.test("resolveLocale: unsupported value falls back to en", () => {
  assertEquals(
    resolveLocale(req("http://x/tower/builds?lang=fr", { "accept-language": "fr-FR" })),
    "en",
  );
});
