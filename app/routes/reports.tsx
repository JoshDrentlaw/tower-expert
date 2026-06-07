// routes/reports.tsx — request handlers for battle report lifecycle.

import type { VNode } from "preact";
import { getReport, insertBattleReport, listBuilds, listReports } from "../../db/db.ts";
import { parseReport } from "../report_parser.ts";
import type { RequestContext } from "../services/ctx.ts";
import { renderPage } from "../services/render.tsx";
import { Layout } from "../components/Layout.tsx";
import { ReportDetail, ReportForm, ReportsList } from "../components/reports.tsx";

// Hard limit on pasted battle report text. Game reports are ~2–4 KB in practice;
// 256 KB gives enormous headroom while blocking memory/DB abuse.
const MAX_RAW_BYTES = 256 * 1024; // 256 KB

function page(ctx: RequestContext, title: string, body: VNode, status = 200): Response {
  return renderPage(<Layout ctx={ctx} title={title}>{body}</Layout>, status);
}

export async function handleReportList(ctx: RequestContext): Promise<Response> {
  const reports = await listReports();
  return page(ctx, "Tower // Reports", <ReportsList ctx={ctx} reports={reports} />);
}

export async function handleReportNew(ctx: RequestContext): Promise<Response> {
  const builds = await listBuilds();
  return page(ctx, "Tower // Log Run", <ReportForm ctx={ctx} builds={builds} />);
}

export async function handleReportSave(ctx: RequestContext, req: Request): Promise<Response> {
  const form = await req.formData();
  const raw = (form.get("raw") as string | null)?.trim();
  const buildRaw = form.get("build_id") as string | null;
  const build_id = buildRaw && /^\d+$/.test(buildRaw) ? Number(buildRaw) : null;

  if (!raw) {
    const builds = await listBuilds();
    return page(
      ctx,
      "Tower // Log Run",
      <ReportForm
        ctx={ctx}
        builds={builds}
        opts={{ buildId: buildRaw ?? undefined, error: "Paste is required." }}
      />,
      400,
    );
  }

  if (new TextEncoder().encode(raw).length > MAX_RAW_BYTES) {
    const builds = await listBuilds();
    return page(
      ctx,
      "Tower // Log Run",
      <ReportForm
        ctx={ctx}
        builds={builds}
        opts={{
          buildId: buildRaw ?? undefined,
          error: `Paste is too large (max ${
            Math.round(MAX_RAW_BYTES / 1024)
          } KB). Make sure you copied only the after-run report.`,
        }}
      />,
      413,
    );
  }

  const p = parseReport(raw);

  // Detect a meaningless parse: all scalar fields null AND every section empty.
  const hasScalars = p.tier !== null || p.wave !== null || p.coins !== null;
  const hasSectionData = Object.values(p.parsed).some((sec) => Object.keys(sec).length > 0);
  if (!hasScalars && !hasSectionData) {
    const builds = await listBuilds();
    return page(
      ctx,
      "Tower // Log Run",
      <ReportForm
        ctx={ctx}
        builds={builds}
        opts={{
          raw,
          buildId: buildRaw ?? undefined,
          error:
            "Could not find battle report data in that paste — make sure you copied the full after-run report from the game.",
        }}
      />,
      422,
    );
  }

  // p.occurred_at is null when "Battle Date" was missing/unparseable; fall back
  // to now() so the NOT NULL column is satisfied (date_inferred flags these).
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

  return Response.redirect(new URL(`${ctx.base}/reports/${id}`, req.url), 303);
}

export async function handleReportDetail(ctx: RequestContext, id: number): Promise<Response> {
  const report = await getReport(id);
  if (!report) return page(ctx, "Not found", <p class="hint">No report #{id}.</p>, 404);
  return page(ctx, `Tower // Report #${id}`, <ReportDetail ctx={ctx} r={report} />);
}
