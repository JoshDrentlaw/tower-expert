// Vendored, trimmed subset of jsr:@std/assert@^1.
//
// Why this exists: Claude Code's web (remote) environment runs behind a network
// policy that blocks jsr.io (and npm.jsr.io), so `deno test` cannot fetch
// @std/assert from JSR. npm deps still resolve (registry.npmjs.org is allowed),
// so only the assert import needs a local home. deno.json maps "@std/assert" to
// this file so the suite is hermetic — no JSR dependency at test time, which
// also makes CI/homelab runs immune to JSR network flakiness.
//
// `equal.ts` and `assertion_error.ts` are the REAL, unmodified std sources
// (MIT, denoland/std), so equality semantics match upstream exactly. Only the
// five assertion wrappers below are local, and only the FAILURE-message
// rendering is simplified (plain text instead of std's colored diff) — that
// affects how a failure prints, never whether a test passes or fails.
//
// If a test starts needing another assertion (assertThrows, assertRejects, …),
// add a faithful wrapper here rather than reaching back to JSR.

import { AssertionError } from "./assertion_error.ts";
import { equal } from "./equal.ts";

export { AssertionError, equal };

function stringify(v: unknown): string {
  try {
    return typeof v === "string" ? v : JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/** Make an assertion. If `expr` is falsy, throw. */
export function assert(expr: unknown, msg = ""): asserts expr {
  if (!expr) throw new AssertionError(msg);
}

/** Assert deep equality (uses upstream std `equal`). */
export function assertEquals<T>(actual: T, expected: T, msg?: string): void {
  if (equal(actual, expected)) return;
  const detail = `Values are not equal.\n    actual:   ${stringify(actual)}\n    expected: ${
    stringify(expected)
  }`;
  throw new AssertionError(msg ? `${msg}\n${detail}` : detail);
}

/** Assert deep inequality (uses upstream std `equal`). */
export function assertNotEquals<T>(actual: T, expected: T, msg?: string): void {
  if (!equal(actual, expected)) return;
  const detail = `Values should not be equal.\n    actual:   ${stringify(actual)}`;
  throw new AssertionError(msg ? `${msg}\n${detail}` : detail);
}

/** Assert that `actual` contains `expected` as a substring. */
export function assertStringIncludes(actual: string, expected: string, msg?: string): void {
  if (actual.includes(expected)) return;
  const detail = `Expected actual to contain: ${stringify(expected)}\n    actual: ${
    stringify(actual)
  }`;
  throw new AssertionError(msg ? `${msg}\n${detail}` : detail);
}

/**
 * Assert two numbers are within `tolerance` of each other (default 1e-7),
 * matching std's `assertAlmostEquals` semantics (NaN equals NaN; exact-equal
 * passes regardless of tolerance).
 */
export function assertAlmostEquals(
  actual: number,
  expected: number,
  tolerance?: number,
  msg?: string,
): void {
  if (Object.is(actual, expected)) return;
  const delta = Math.abs(actual - expected);
  const tol = tolerance ?? 1e-7;
  if (delta <= tol) return;
  const detail =
    `Expected actual: ${actual} to be close to ${expected} (tolerance ${tol}, delta ${delta})`;
  throw new AssertionError(msg ? `${msg}\n${detail}` : detail);
}
