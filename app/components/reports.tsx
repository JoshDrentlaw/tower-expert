// reports.tsx — battle-report form, list, and detail. Chrome goes through ctx.t.

import type { VNode } from "preact";
import type { BattleReport, Build } from "../../db/db.ts";
import type { RequestContext } from "../services/ctx.ts";
import type { TFunc } from "../i18n/index.ts";
import { mostFarmedTier, tiersOf, toRunPoints } from "../progression.ts";
import { UPLOT_CSS, UPLOT_JS } from "../vendor/uplot_asset.ts";
import { PROGRESSION_JS } from "./progression_chart.ts";
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

export function ReportsProgression(
  { ctx, reports }: { ctx: RequestContext; reports: BattleReport[] },
) {
  const { base, t } = ctx;
  const points = toRunPoints(reports);
  const tiers = tiersOf(points);
  const defaultTier = mostFarmedTier(points);
  const hasAny = points.some((p) => p.wave != null || p.coins != null || p.cph != null);

  if (!hasAny) {
    return (
      <Onboard
        title={t("onboarding.reportsTitle")}
        body={t("progression.empty")}
        primary={{ href: `${base}/reports/new`, label: t("onboarding.reportsCta") }}
        secondary={{ href: `${base}/reports`, label: t("progression.backToList") }}
      />
    );
  }

  // Everything uPlot needs, serialized for the client. `<`-escaped so no value
  // (e.g. a build label) can break out of the <script>.
  const payload = JSON.stringify({
    points,
    tiers,
    defaultTier,
    i18n: {
      cph: t("progression.cph"),
      wave: t("reportsList.thWave"),
      coins: t("reportsList.thCoins"),
      tier: t("reportsList.thTier"),
      noData: t("progression.noData"),
    },
  }).replace(/</g, "\\u003c");

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: UPLOT_CSS }} />
      <div class="list-actions">
        <a class="btn" href={`${base}/reports`}>{t("progression.backToList")}</a>
        <a class="btn" href={`${base}/reports/new`}>{t("list.logRun")}</a>
      </div>
      <p class="hint">{t("progression.lead")}</p>
      <figure class="chart">
        <figcaption>{t("progression.cph")}</figcaption>
        <p class="hint">{t("progression.cphNote")}</p>
        <div id="chart-cph" class="uchart"></div>
      </figure>
      <figure class="chart">
        <figcaption>{t("reportsList.thWave")}</figcaption>
        <p class="hint">{t("progression.waveNote")}</p>
        <div id="wave-tiers" class="tier-tabs"></div>
        <div id="chart-wave" class="uchart"></div>
      </figure>
      <figure class="chart">
        <figcaption>{t("reportsList.thCoins")}</figcaption>
        <div id="chart-coins" class="uchart"></div>
      </figure>
      <script dangerouslySetInnerHTML={{ __html: `window.__progression=${payload};` }} />
      <script dangerouslySetInnerHTML={{ __html: UPLOT_JS }} />
      <script dangerouslySetInnerHTML={{ __html: PROGRESSION_JS }} />
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
