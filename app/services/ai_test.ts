// ai_test.ts — server-owned model allowlist contract. No network/DB: this only
// exercises the pure validation surface the route relies on to reject a
// client-supplied model it didn't sanction.

import { assert, assertEquals } from "@std/assert";
import { AI_MODELS, DEFAULT_MODEL, isAllowedModel, isGoal } from "./ai.ts";

Deno.test("DEFAULT_MODEL is the first (lead) model in the allowlist", () => {
  assertEquals(DEFAULT_MODEL, AI_MODELS[0].id);
});

Deno.test("isAllowedModel accepts every sanctioned model id", () => {
  for (const m of AI_MODELS) assert(isAllowedModel(m.id));
});

Deno.test("isAllowedModel rejects anything off the allowlist", () => {
  assert(!isAllowedModel("claude-opus-4-8-evil"));
  assert(!isAllowedModel("gpt-4o"));
  assert(!isAllowedModel(""));
  assert(!isAllowedModel("../../etc/passwd"));
});

Deno.test("isGoal accepts only the two stated goals", () => {
  assert(isGoal("farming"));
  assert(isGoal("pushing"));
});

Deno.test("isGoal rejects auto / unknown / non-strings (treated as auto upstream)", () => {
  assert(!isGoal("auto"));
  assert(!isGoal("economy"));
  assert(!isGoal(""));
  assert(!isGoal(undefined));
  assert(!isGoal(42));
});
