// routes/ai.tsx — AI analysis proxy (bring-your-own-key).
//
// The browser sends the user's Anthropic key in the `x-anthropic-key` HEADER
// (never the body or query string — keeps it out of access logs and browser
// history). We forward one request to Anthropic with it and discard it; nothing
// is stored, and errors are sanitized so the key's request context never lands
// in a log line. Returns JSON, not HTML — this endpoint is fetched by the
// client-side analyze widget, not navigated to.

import Anthropic from "@anthropic-ai/sdk";
import { getBuild, listReportsForBuild } from "../../db/db.ts";
import type { RequestContext } from "../services/ctx.ts";
import { AiError, analyzeBuild, DEFAULT_MODEL, isAllowedModel } from "../services/ai.ts";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function err(ctx: RequestContext, key: string, fallback: string, status: number): Response {
  return json({ error: ctx.t(key, { default: fallback }) }, status);
}

export async function handleAiAnalyze(ctx: RequestContext, req: Request): Promise<Response> {
  const apiKey = req.headers.get("x-anthropic-key")?.trim();
  if (!apiKey) {
    return err(ctx, "ai.error.noKey", "Add your Anthropic API key to use analysis.", 400);
  }

  let body: { kind?: unknown; id?: unknown; model?: unknown };
  try {
    body = await req.json();
  } catch {
    return err(ctx, "ai.error.badRequest", "Malformed request.", 400);
  }

  const id = Number(body.id);
  if (body.kind !== "build" || !Number.isInteger(id) || id <= 0) {
    return err(ctx, "ai.error.badRequest", "Malformed request.", 400);
  }
  const model = typeof body.model === "string" && isAllowedModel(body.model)
    ? body.model
    : DEFAULT_MODEL;

  const build = await getBuild(id);
  if (!build) return err(ctx, "ai.error.notFound", "Build not found.", 404);
  // The build's recent runs are the feedback signal the analysis reasons over.
  const reports = await listReportsForBuild(id);

  try {
    const { text, model: served } = await analyzeBuild(apiKey, model, build, reports);
    if (!text) return err(ctx, "ai.error.empty", "The model returned no analysis. Try again.", 502);
    return json({ text, model: served });
  } catch (e) {
    return mapError(ctx, e);
  }
}

// Map Anthropic SDK errors (and our refusal signal) to clean, user-facing
// messages + status. These errors don't carry the API key, but we still avoid
// logging raw error text — only the error name, for diagnosis.
function mapError(ctx: RequestContext, e: unknown): Response {
  if (e instanceof Anthropic.AuthenticationError) {
    return err(ctx, "ai.error.auth", "That API key was rejected. Check it and try again.", 401);
  }
  if (e instanceof Anthropic.PermissionDeniedError) {
    return err(ctx, "ai.error.permission", "This key can't use the selected model.", 403);
  }
  if (e instanceof Anthropic.RateLimitError) {
    return err(
      ctx,
      "ai.error.rateLimit",
      "Your key hit its rate limit. Wait a moment and retry.",
      429,
    );
  }
  if (e instanceof AiError && e.kind === "refusal") {
    return err(ctx, "ai.error.refusal", "The model declined to analyze this build.", 422);
  }
  if (e instanceof Anthropic.APIConnectionError) {
    return err(ctx, "ai.error.network", "Couldn't reach the model API. Try again.", 502);
  }
  console.error("[ai] analysis failed:", e instanceof Error ? e.name : "unknown");
  return err(ctx, "ai.error.generic", "Analysis failed. Try again.", 502);
}
