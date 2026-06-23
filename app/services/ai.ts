// ai.ts — server-side bridge to Claude for build analysis (bring-your-own-key).
//
// SECURITY POSTURE: the user's Anthropic API key never persists here. It arrives
// per request (the browser holds it in localStorage), is used for exactly one
// call, and is then discarded with the function frame. Do not log it, store it,
// echo it back, or place it anywhere durable. The only state this module owns is
// the static list of models the app offers.

import Anthropic from "@anthropic-ai/sdk";
import type { BattleReport, Build } from "../../db/db.ts";
import { STAT_SCHEMA } from "../stat_schema.ts";
import { formatNum } from "../num_format.ts";
import { perHour } from "../progression.ts";

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
You give specific, actionable advice on builds and how they perform in runs.

Two things shape every answer:

1. The player's goal — advice differs sharply between the two:
   - Economy / farming: maximizing coins and cells per hour, usually at a tier the player can sustain.
   - Milestone / pushing: reaching the highest possible tier and wave, where survival (defense, health, \
regen) is the binding constraint.
   Infer the likely goal from the data — a sustained lower tier with high coins/hour suggests farming; \
dying at a wall on a high tier suggests pushing. If it's genuinely ambiguous, state which goal you're \
assuming, or split your advice by goal.

2. The build–run relationship. The build is the input (what the player invested in); a run is the outcome \
(tier and wave reached, coins and cells earned, run duration, what killed them). When run data is \
provided, treat it as the feedback signal: judge the build by what its runs actually produced and find \
the bottleneck they reveal (died early to a specific wave; coins/hour flat despite more investment). When \
no run is provided, reason from the build alone and note that linking a recent run would sharpen the read.

Respond with:
- A short read on what the build is optimized for and how well it's meeting that goal.
- The 2–4 highest-leverage changes to make next, in priority order, each with a one-line reason tied to \
the goal and, when available, the run outcomes.
- Any imbalance or wasted investment relative to the goal.

Lead with the most useful takeaway. Be concrete and tie every point to the specific values shown — skip \
generic idle-game advice. If a critical stat or the goal is unclear from the data, say so briefly rather \
than guessing. You do not have live access to the game wiki, so flag any claim you are unsure about \
rather than stating it as fact.`;

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

// Render this build's recent runs as the feedback signal for the prompt, newest
// first. Prefers the game's own strings from the parsed report (exactly what the
// player saw) and falls back to the promoted columns. Pure; "" when no runs.
function renderRuns(reports: BattleReport[]): string {
  if (reports.length === 0) return "";
  const lines = ["Recent runs on this build (newest first):"];
  for (const r of reports) {
    const br = (r.parsed?.["battle_report"] ?? {}) as Record<string, string>;
    const cphNum = perHour(r.coins, r.duration_s);
    const cph = br["Coins Per Hour"] ?? (cphNum != null ? formatNum(cphNum, "num") : null);
    const coins = br["Coins Earned"] ?? (r.coins != null ? formatNum(r.coins, "num") : null);
    const cells = br["Cells Earned"] ?? (r.cells != null ? formatNum(r.cells, "num") : null);
    const dur = br["Real Time"] ?? (r.duration_s != null ? `${r.duration_s}s` : null);
    const parts = [
      `T${r.tier ?? "?"} wave ${r.wave ?? "?"}`,
      coins ? `${coins} coins${cph ? ` (${cph}/hr)` : ""}` : null,
      cells ? `${cells} cells` : null,
      dur,
      br["Killed By"] ? `killed by ${br["Killed By"]}` : null,
    ].filter((p) => p !== null);
    lines.push(`  - ${parts.join(", ")}`);
  }
  return lines.join("\n");
}

// Run one analysis. Throws Anthropic SDK errors (AuthenticationError,
// RateLimitError, …) for the route to map; throws AiError on a safety refusal.
export async function analyzeBuild(
  apiKey: string,
  model: string,
  build: Build,
  reports: BattleReport[] = [],
): Promise<AnalyzeResult> {
  const client = new Anthropic({ apiKey });
  const stats = renderBuild(build);
  const runs = renderRuns(reports);
  const userText = [
    `Build: ${build.label}`,
    build.note ? `Note: ${build.note}` : null,
    "",
    "Stats:",
    stats || "(no stats recorded)",
    ...(runs ? ["", runs] : []),
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
