// routes/reports.ts — request handlers for battle report lifecycle.

import { getReport, insertBattleReport, listBuilds, listReports } from "../../db/db.ts";
import { parseReport } from "../report_parser.ts";
import { layout, reportDetail, reportForm, reportsList } from "../views.ts";

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

  if (!raw) {
    const builds = await listBuilds();
    return html(
      base,
      "Tower // Log Run",
      `<p class="hint" style="color:#e88">Paste is required.</p>` + reportForm(base, builds),
      400,
    );
  }

  const buildRaw = form.get("build_id") as string | null;
  const build_id = buildRaw && /^\d+$/.test(buildRaw) ? Number(buildRaw) : null;

  const p = parseReport(raw);
  const id = await insertBattleReport({
    build_id,
    occurred_at: p.occurred_at,
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
