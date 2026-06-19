// reports.tsx — battle-report form, list, and detail. Chrome goes through ctx.t.

import type { VNode } from "preact";
import type { BattleReport, Build } from "../../db/db.ts";
import type { RequestContext } from "../services/ctx.ts";
import type { TFunc } from "../i18n/index.ts";
import { buildChart, type Sample } from "../progression.ts";
import type { NumUnit } from "../num_format.ts";
import { Onboard } from "./onboard.tsx";

// The "date was inferred" marker: a visual (color + short text, hidden from
// assistive tech) plus a screen-reader-only full explanation.
function DateInferred({ t, short }: { t: TFunc; short: boolean }) {
  return (
    <>
      <span
        aria-hidden="true"
        title={t("reportDetail.dateInferredTitle")}
        style="color:var(--error);font-size:.8rem;"
      >
        {" "}
        {short ? t("reportDetail.dateInferredShort") : t("reportDetail.dateInferred")}
      </span>
      <span class="sr-only">{t("reportDetail.dateInferredTitle")}</span>
    </>
  );
}

export function ReportForm(
  { ctx, builds, opts = {} }: {
    ctx: RequestContext;
    builds: Build[];
    opts?: { raw?: string; buildId?: string | number; error?: string };
  },
) {
  const { base, t } = ctx;
  const selectedBuildId = opts.buildId != null ? String(opts.buildId) : "";
  return (
    <form method="post" action={`${base}/reports`}>
      {opts.error
        ? <p id="form-error" class="hint" style="color:var(--error)" role="alert">{opts.error}</p>
        : null}
      <p class="hint">{t("reportForm.hint")}</p>
      <div class="meta">
        <div>
          <label for="build_id">{t("reportForm.buildOptional")}</label>
          <select id="build_id" name="build_id">
            <option value="">{t("reportForm.noBuild")}</option>
            {builds.map((b) => (
              <option value={String(b.id)} selected={String(b.id) === selectedBuildId}>
                #{b.id} {b.label}
              </option>
            ))}
          </select>
        </div>
        <div></div>
      </div>
      <div style="margin-bottom:1rem;">
        <label for="raw">{t("reportForm.pasteLabel")}</label>
        <textarea
          id="raw"
          name="raw"
          rows={22}
          placeholder={t("reportForm.pastePlaceholder")}
          style="font-size:.78rem;line-height:1.5;resize:vertical;"
        >
          {opts.raw ?? ""}
        </textarea>
      </div>
      <div class="actions sticky">
        <button type="submit">{t("reportForm.save")}</button>
      </div>
    </form>
  );
}

export function ReportsList({ ctx, reports }: { ctx: RequestContext; reports: BattleReport[] }) {
  const { base, t, fmt } = ctx;
  if (reports.length === 0) {
    return (
      <Onboard
        title={t("onboarding.reportsTitle")}
        body={t("onboarding.reportsBody")}
        primary={{ href: `${base}/reports/new`, label: t("onboarding.reportsCta") }}
        secondary={{ href: `${base}/builds/new`, label: t("onboarding.reportsSecondary") }}
      />
    );
  }
  return (
    <>
      <div class="list-actions">
        <a class="btn" href={`${base}/reports/new`}>{t("list.logRun")}</a>
        <a class="btn" href={`${base}/reports/progression`}>{t("progression.view")}</a>
      </div>
      <table class="responsive">
        <caption class="sr-only">{t("reportsList.caption")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("reportsList.thNum")}</th>
            <th scope="col">{t("reportsList.thDate")}</th>
            <th scope="col">{t("reportsList.thTier")}</th>
            <th scope="col">{t("reportsList.thWave")}</th>
            <th scope="col">{t("reportsList.thCoins")}</th>
            <th scope="col">{t("reportsList.thDuration")}</th>
            <th scope="col">{t("reportsList.thBuild")}</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((r) => (
            <tr>
              <td data-label={t("reportsList.thNum")}>
                <a href={`${base}/reports/${r.id}`}>#{r.id}</a>
              </td>
              <td class="hint" data-label={t("reportsList.thDate")}>
                {fmt.dateTime(r.occurred_at)}
                {r.date_inferred ? <DateInferred t={t} short /> : null}
              </td>
              <td data-label={t("reportsList.thTier")}>{r.tier?.toString() ?? "—"}</td>
              <td data-label={t("reportsList.thWave")}>{fmt.integer(r.wave)}</td>
              <td data-label={t("reportsList.thCoins")}>{fmt.num(r.coins)}</td>
              <td class="hint" data-label={t("reportsList.thDuration")}>
                {fmt.duration(r.duration_s)}
              </td>
              <td data-label={t("reportsList.thBuild")}>
                {r.build_id
                  ? <a href={`${base}/builds/${r.build_id}`}>#{r.build_id} {r.build_label ?? ""}</a>
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

// A single static-SVG progression chart: one metric (e.g. wave) plotted against
// time, with a dashed vertical marker wherever the active build changed from the
// previous run — so a reallocation lines up visually with the trend that follows.
// Pure geometry comes from progression.ts; this only renders it.
function ProgressionChart(
  { ctx, title, samples, unit }: {
    ctx: RequestContext;
    title: string;
    samples: Sample[];
    unit: NumUnit;
  },
) {
  const { t, fmt } = ctx;
  const fmtVal = (v: number) => fmt.num(v, unit);
  const c = buildChart(samples, { w: 640, h: 170, pad: 30 });

  if (c.plotted.length === 0) {
    return (
      <figure class="chart">
        <figcaption>{title}</figcaption>
        <p class="hint">{t("progression.noData")}</p>
      </figure>
    );
  }

  const changes = c.plotted.filter((p) => p.buildChanged);
  const last = c.plotted[c.plotted.length - 1];
  const summary = t("progression.summary", {
    metric: title,
    n: c.plotted.length,
    from: fmtVal(c.plotted[0].value),
    to: fmtVal(last.value),
  });

  return (
    <figure class="chart">
      <figcaption>{title}</figcaption>
      <svg
        viewBox={`0 0 ${c.w} ${c.h}`}
        role="img"
        aria-label={summary}
        preserveAspectRatio="none"
        style="width:100%;height:auto;"
      >
        {/* plot frame */}
        <line x1={c.pad} y1={c.pad} x2={c.pad} y2={c.h - c.pad} stroke="var(--line)" />
        <line
          x1={c.pad}
          y1={c.h - c.pad}
          x2={c.w - c.pad}
          y2={c.h - c.pad}
          stroke="var(--line)"
        />
        {/* build-change markers */}
        {changes.map((p) => (
          <line
            x1={p.cx}
            y1={c.pad}
            x2={p.cx}
            y2={c.h - c.pad}
            stroke="var(--muted)"
            stroke-dasharray="3 3"
          />
        ))}
        {/* the metric line + points */}
        <polyline points={c.polyline} fill="none" stroke="var(--accent-text)" stroke-width="2" />
        {c.plotted.map((p) => (
          <circle
            cx={p.cx}
            cy={p.cy}
            r={p.buildChanged ? 4.5 : 2.5}
            fill={p.buildChanged ? "var(--accent-text)" : "var(--bg)"}
            stroke="var(--accent-text)"
          />
        ))}
        {/* value-axis bounds */}
        <text x={c.pad - 4} y={c.pad + 4} text-anchor="end" font-size="10" fill="var(--muted)">
          {fmtVal(c.vMax)}
        </text>
        <text x={c.pad - 4} y={c.h - c.pad} text-anchor="end" font-size="10" fill="var(--muted)">
          {fmtVal(c.vMin)}
        </text>
        {/* time-axis bounds */}
        <text x={c.pad} y={c.h - c.pad + 14} text-anchor="start" font-size="10" fill="var(--muted)">
          {fmt.dateTime(new Date(c.tMin).toISOString())}
        </text>
        <text
          x={c.w - c.pad}
          y={c.h - c.pad + 14}
          text-anchor="end"
          font-size="10"
          fill="var(--muted)"
        >
          {fmt.dateTime(new Date(c.tMax).toISOString())}
        </text>
      </svg>
      <p class="hint">
        {summary}
        {changes.length > 0 ? " " + t("progression.markerNote", { n: changes.length }) : ""}
      </p>
    </figure>
  );
}

export function ReportsProgression(
  { ctx, reports }: { ctx: RequestContext; reports: BattleReport[] },
) {
  const { base, t } = ctx;
  // Reports arrive newest-first; the chart sorts ascending itself.
  const toSamples = (pick: (r: BattleReport) => number | null): Sample[] =>
    reports
      .map((r) => ({
        id: r.id,
        t: new Date(r.occurred_at).getTime(),
        value: pick(r),
        buildId: r.build_id,
      }))
      .filter((s): s is Sample => s.value !== null && Number.isFinite(s.value));

  const waveSamples = toSamples((r) => r.wave);
  const coinSamples = toSamples((r) => r.coins);

  if (waveSamples.length === 0 && coinSamples.length === 0) {
    return (
      <Onboard
        title={t("onboarding.reportsTitle")}
        body={t("progression.empty")}
        primary={{ href: `${base}/reports/new`, label: t("onboarding.reportsCta") }}
        secondary={{ href: `${base}/reports`, label: t("progression.backToList") }}
      />
    );
  }

  return (
    <>
      <div class="list-actions">
        <a class="btn" href={`${base}/reports`}>{t("progression.backToList")}</a>
        <a class="btn" href={`${base}/reports/new`}>{t("list.logRun")}</a>
      </div>
      <p class="hint">{t("progression.lead")}</p>
      <ProgressionChart
        ctx={ctx}
        title={t("reportsList.thWave")}
        samples={waveSamples}
        unit="num"
      />
      <ProgressionChart
        ctx={ctx}
        title={t("reportsList.thCoins")}
        samples={coinSamples}
        unit="num"
      />
    </>
  );
}

export function ReportDetail({ ctx, r }: { ctx: RequestContext; r: BattleReport }) {
  const { base, t, fmt } = ctx;
  const br = r.parsed["battle_report"] ?? {};
  const th = "width:160px;font-weight:normal";

  const rows: VNode[] = [
    <tr>
      <th scope="row" style={th}>{t("reportDetail.occurred")}</th>
      <td>
        {fmt.dateTime(r.occurred_at)}
        {r.date_inferred ? <DateInferred t={t} short={false} /> : null}
      </td>
    </tr>,
    <tr>
      <th scope="row" style={th}>{t("reportDetail.tier")}</th>
      <td>{r.tier?.toString() ?? "—"}</td>
    </tr>,
    <tr>
      <th scope="row" style={th}>{t("reportDetail.wave")}</th>
      <td>{fmt.integer(r.wave)}</td>
    </tr>,
    <tr>
      <th scope="row" style={th}>{t("reportDetail.coinsEarned")}</th>
      <td>{br["Coins Earned"] ?? fmt.num(r.coins)}</td>
    </tr>,
    <tr>
      <th scope="row" style={th}>{t("reportDetail.coinsHour")}</th>
      <td>{br["Coins Per Hour"] ?? "—"}</td>
    </tr>,
    <tr>
      <th scope="row" style={th}>{t("reportDetail.cellsEarned")}</th>
      <td>{br["Cells Earned"] ?? "—"}</td>
    </tr>,
    <tr>
      <th scope="row" style={th}>{t("reportDetail.realTime")}</th>
      <td>{br["Real Time"] ?? fmt.duration(r.duration_s)}</td>
    </tr>,
    <tr>
      <th scope="row" style={th}>{t("reportDetail.killedBy")}</th>
      <td>{br["Killed By"] ?? "—"}</td>
    </tr>,
  ];
  if (r.build_id) {
    rows.push(
      <tr>
        <th scope="row" style={th}>{t("reportDetail.build")}</th>
        <td>
          <a href={`${base}/builds/${r.build_id}`} style="color:var(--accent-text)">
            #{r.build_id} {r.build_label ?? ""}
          </a>
        </td>
      </tr>,
    );
  }

  return (
    <>
      <table style="width:auto;margin-bottom:1.5rem;font-size:.88rem;">{rows}</table>
      <details style="margin-top:1rem;">
        <summary class="hint" style="cursor:pointer;font-family:var(--mono);font-size:.78rem;">
          {t("reportDetail.fullData")}
        </summary>
        <pre style="margin-top:.5rem">{JSON.stringify(r.parsed, null, 2)}</pre>
      </details>
      {r.raw
        ? (
          <details style="margin-top:1rem;">
            <summary class="hint" style="cursor:pointer;font-family:var(--mono);font-size:.78rem;">
              {t("reportDetail.rawPaste")}
            </summary>
            <pre style="margin-top:.5rem">{r.raw}</pre>
          </details>
        )
        : null}
    </>
  );
}
