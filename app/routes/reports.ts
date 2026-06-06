// routes/reports.ts — request handlers for battle report lifecycle.

import { getReport, insertBattleReport, listBuilds, listReports } from "../../db/db.ts";
import { parseReport } from "../report_parser.ts";
import { layout, reportDetail, reportForm, reportsList } from "../views.ts";

// Hard limit on pasted battle report text. Game reports are ~2–4 KB in practice;
// 256 KB gives enormous headroom while blocking memory/DB abuse.
const MAX_RAW_BYTES = 256 * 1024; // 256 KB

function html(base: string, title: string, body: string, status = 200): Response {
  return new Response(layout(base, title, body), {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function handleReportList(base: string): Promise<Response> {
  const reports = await listReports();
  return html(base, "Tower // Reports", reportsList(base, reports));
}

export async function handleReportNew(base: string): Promise<Response> {
  const builds = await listBuilds();
  return html(base, "Tower // Log Run", reportForm(base, builds));
}

export async function handleReportSave(base: string, req: Request): Promise<Response> {
  const form = await req.formData();
  const raw = (form.get("raw") as string | null)?.trim();
  const buildRaw = form.get("build_id") as string | null;
  const build_id = buildRaw && /^\d+$/.test(buildRaw) ? Number(buildRaw) : null;

  if (!raw) {
    const builds = await listBuilds();
    return html(
      base,
      "Tower // Log Run",
      reportForm(base, builds, {
        buildId: buildRaw ?? undefined,
        error: "Paste is required.",
      }),
      400,
    );
  }

  if (new TextEncoder().encode(raw).length > MAX_RAW_BYTES) {
    const builds = await listBuilds();
    return html(
      base,
      "Tower // Log Run",
      reportForm(base, builds, {
        buildId: buildRaw ?? undefined,
        error: `Paste is too large (max ${
          Math.round(MAX_RAW_BYTES / 1024)
        } KB). Make sure you copied only the after-run report.`,
      }),
      413,
    );
  }

  const p = parseReport(raw);

  // Detect a meaningless parse: all scalar fields are null AND every section
  // object is empty. Saving this would insert a ghost record with no data and
  // silently report success.
  const hasScalars = p.tier !== null || p.wave !== null || p.coins !== null;
  const hasSectionData = Object.values(p.parsed).some(
    (sec) => Object.keys(sec).length > 0,
  );
  if (!hasScalars && !hasSectionData) {
    const builds = await listBuilds();
    return html(
      base,
      "Tower // Log Run",
      reportForm(base, builds, {
        raw,
        buildId: buildRaw ?? undefined,
        error:
          "Could not find battle report data in that paste — make sure you copied the full after-run report from the game.",
      }),
      422,
    );
  }

  // p.occurred_at is null when "Battle Date" was missing or unparseable.
  // Fall back to now() so the NOT NULL DB constraint is satisfied; the
  // date_inferred computed column (occurred_at ≈ created_at) will flag these rows.
  const id = await insertBattleReport({
    build_id,
    occurred_at: p.occurred_at ?? new Date().toISOString(),
    tier: p.tier,
    wave: p.wave,
    coins: p.coins,
    duration_s: p.duration_s,
    parsed: p.parsed,
    raw,
  });

  return Response.redirect(new URL(`${base}/reports/${id}`, req.url), 303);
}

export async function handleReportDetail(base: string, id: number): Promise<Response> {
  const report = await getReport(id);
  if (!report) return html(base, "Not found", `<p class="hint">No report #${id}.</p>`, 404);
  return html(base, `Tower // Report #${id}`, reportDetail(base, report));
}
