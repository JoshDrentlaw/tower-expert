// ai.ts — server-side bridge to Claude for build analysis (bring-your-own-key).
//
// SECURITY POSTURE: the user's Anthropic API key never persists here. It arrives
// per request (the browser holds it in localStorage), is used for exactly one
// call, and is then discarded with the function frame. Do not log it, store it,
// echo it back, or place it anywhere durable. The only state this module owns is
// the static list of models the app offers.

import Anthropic from "@anthropic-ai/sdk";
import type { Build } from "../../db/db.ts";
import { STAT_SCHEMA } from "../stat_schema.ts";
import { formatNum } from "../num_format.ts";

// The models the app offers. The SERVER is the source of truth — a request
// naming anything outside this list is rejected (the client picks from this
// list, but never gets to pick a model we didn't sanction). Opus 4.8 leads as
// the default and most capable; Sonnet/Haiku are cheaper options on the user's
// own dime.
export const AI_MODELS = [
  { id: "claude-opus-4-8", label: "Claude Opus 4.8" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
] as const;

export const DEFAULT_MODEL: string = AI_MODELS[0].id;

export function isAllowedModel(id: string): boolean {
  return AI_MODELS.some((m) => m.id === id);
}

// A typed signal for the one non-exception failure mode (a safety refusal),
// so the route layer can map it to a clean status without string-matching.
export class AiError extends Error {
  constructor(readonly kind: "refusal", message: string) {
    super(message);
    this.name = "AiError";
  }
}

export interface AnalyzeResult {
  text: string;
  model: string;
}

const SYSTEM =
  `You are an expert player and theorycrafter for the mobile idle game "The Tower: Idle Tower Defense". \
You give specific, actionable advice on builds — stat allocation, workshop upgrade priorities, module and \
substat choices.

The user tracks a build as a snapshot of stat values. Analyze the build you are given and respond with:
- A short read on what this build is optimized for (farming coins/cells vs. pushing tier/wave, etc.).
- The 2–4 highest-leverage changes to make next, in priority order, each with a one-line reason.
- Any imbalance or wasted investment you notice.

Lead with the most useful takeaway. Be concrete and tie every point to the specific values shown — skip \
generic idle-game advice. If a critical stat is absent from the data, note that briefly rather than \
guessing. You do not have live access to the game wiki, so flag any claim you are unsure about rather than \
stating it as fact.`;

// Render a build's stored stats into labeled plain text for the prompt. Pure;
// uses STAT_SCHEMA for labels and formatNum for game-style notation so the model
// sees values the way the game (and the user) does.
function renderBuild(b: Build): string {
  const out: string[] = [];
  const present = (v: unknown) => v !== undefined && v !== null && v !== "";
  const show = (raw: unknown, unit: Parameters<typeof formatNum>[1]) =>
    typeof raw === "number" ? formatNum(raw, unit) : String(raw);

  for (const cat of STAT_SCHEMA) {
    const catData = (b.data[cat.key] as Record<string, unknown> | undefined) ?? {};
    const rows: string[] = [];
    for (const f of cat.fields) {
      const label = f.group ? `${f.group.label} — ${f.label}` : f.label;
      if (present(catData[f.key])) {
        rows.push(`  - ${label}: ${show(catData[f.key], f.unit ?? "num")}`);
      }
      if (f.enhancement && present(catData[f.enhancement.key])) {
        rows.push(
          `  - ${label} (${f.enhancement.label}): ${
            show(catData[f.enhancement.key], f.enhancement.unit ?? "num")
          }`,
        );
      }
    }
    if (rows.length) {
      out.push(`${cat.title}:`);
      out.push(...rows);
    }
  }
  return out.join("\n");
}

// Run one analysis. Throws Anthropic SDK errors (AuthenticationError,
// RateLimitError, …) for the route to map; throws AiError on a safety refusal.
export async function analyzeBuild(
  apiKey: string,
  model: string,
  build: Build,
): Promise<AnalyzeResult> {
  const client = new Anthropic({ apiKey });
  const stats = renderBuild(build);
  const userText = [
    `Build: ${build.label}`,
    build.note ? `Note: ${build.note}` : null,
    "",
    "Stats:",
    stats || "(no stats recorded)",
  ].filter((l) => l !== null).join("\n");

  const res = await client.messages.create({
    model,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    system: SYSTEM,
    messages: [{ role: "user", content: userText }],
  });

  if (res.stop_reason === "refusal") {
    throw new AiError("refusal", "The model declined to analyze this build.");
  }

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  return { text, model: res.model };
}
