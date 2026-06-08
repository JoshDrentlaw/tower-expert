// reports.tsx — battle-report form, list, and detail. Chrome goes through ctx.t.

import type { VNode } from "preact";
import type { BattleReport, Build } from "../../db/db.ts";
import type { RequestContext } from "../services/ctx.ts";
import type { TFunc } from "../i18n/index.ts";

// The "date was inferred" marker: a visual (color + short text, hidden from
// assistive tech) plus a screen-reader-only full explanation.
function DateInferred({ t, short }: { t: TFunc; short: boolean }) {
  return (
    <>
      <span
        aria-hidden="true"
        title={t("reportDetail.dateInferredTitle")}
        style="color:#e88;font-size:.8rem;"
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
        ? <p id="form-error" class="hint" style="color:#e88" role="alert">{opts.error}</p>
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
      <div class="actions">
        <button type="submit">{t("reportForm.save")}</button>
      </div>
    </form>
  );
}

export function ReportsList({ ctx, reports }: { ctx: RequestContext; reports: BattleReport[] }) {
  const { base, t, fmt } = ctx;
  if (reports.length === 0) {
    return (
      <p class="hint">
        {t("reportsList.empty")}{" "}
        <a href={`${base}/reports/new`} style="color:var(--accent)">{t("reportsList.logRun")}</a>
      </p>
    );
  }
  return (
    <table>
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
            <td>
              <a href={`${base}/reports/${r.id}`}>#{r.id}</a>
            </td>
            <td class="hint">
              {fmt.dateTime(r.occurred_at)}
              {r.date_inferred ? <DateInferred t={t} short /> : null}
            </td>
            <td>{r.tier?.toString() ?? "—"}</td>
            <td>{fmt.integer(r.wave)}</td>
            <td>{fmt.num(r.coins)}</td>
            <td class="hint">{fmt.duration(r.duration_s)}</td>
            <td>
              {r.build_id
                ? <a href={`${base}/builds/${r.build_id}`}>#{r.build_id} {r.build_label ?? ""}</a>
                : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
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
          <a href={`${base}/builds/${r.build_id}`} style="color:var(--accent)">
            #{r.build_id} {r.build_label ?? ""}
          </a>
        </td>
      </tr>,
    );
  }

  return (
    <>
      <table style="width:auto;margin-bottom:1.5rem;font-size:.88rem;">{rows}</table>
      <pre>{JSON.stringify(r.parsed, null, 2)}</pre>
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
