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

function page(
  ctx: RequestContext,
  title: string,
  body: VNode,
  status = 200,
  heading?: string,
): Response {
  return renderPage(<Layout ctx={ctx} title={title} heading={heading}>{body}</Layout>, status, {
    "set-cookie": `lang=${ctx.locale}; Path=${ctx.base || "/"}; Max-Age=31536000; SameSite=Lax`,
  });
}

export async function handleReportList(ctx: RequestContext): Promise<Response> {
  const reports = await listReports();
  return page(
    ctx,
    ctx.t("title.reports"),
    <ReportsList ctx={ctx} reports={reports} />,
    200,
    ctx.t("heading.reports"),
  );
}

export async function handleReportNew(ctx: RequestContext): Promise<Response> {
  const builds = await listBuilds();
  return page(
    ctx,
    ctx.t("title.logRun"),
    <ReportForm ctx={ctx} builds={builds} />,
    200,
    ctx.t("heading.logRun"),
  );
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
      ctx.t("title.logRun"),
      <ReportForm
        ctx={ctx}
        builds={builds}
        opts={{ buildId: buildRaw ?? undefined, error: ctx.t("error.pasteRequired") }}
      />,
      400,
    );
  }

  if (new TextEncoder().encode(raw).length > MAX_RAW_BYTES) {
    const builds = await listBuilds();
    return page(
      ctx,
      ctx.t("title.logRun"),
      <ReportForm
        ctx={ctx}
        builds={builds}
        opts={{
          buildId: buildRaw ?? undefined,
          error: ctx.t("error.pasteTooLarge", { kb: Math.round(MAX_RAW_BYTES / 1024) }),
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
      ctx.t("title.logRun"),
      <ReportForm
        ctx={ctx}
        builds={builds}
        opts={{ raw, buildId: buildRaw ?? undefined, error: ctx.t("error.noReportData") }}
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
  if (!report) {
    return page(
      ctx,
      ctx.t("title.notFound"),
      <p class="hint">{ctx.t("reportDetail.notFound", { id })}</p>,
      404,
      ctx.t("heading.notFound"),
    );
  }
  return page(
    ctx,
    ctx.t("title.report", { id }),
    <ReportDetail ctx={ctx} r={report} />,
    200,
    ctx.t("heading.report", { id }),
  );
}
