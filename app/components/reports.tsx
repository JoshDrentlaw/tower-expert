// reports.tsx — battle-report form, list, and detail.
// Ported 1:1 from views.ts (reportForm, reportsList, reportDetail).

import type { VNode } from "preact";
import type { BattleReport, Build } from "../../db/db.ts";
import type { RequestContext } from "../services/ctx.ts";

const DATE_INFERRED_TITLE = "Battle Date missing or unparseable — using insert time";

export function ReportForm(
  { ctx, builds, opts = {} }: {
    ctx: RequestContext;
    builds: Build[];
    opts?: { raw?: string; buildId?: string | number; error?: string };
  },
) {
  const { base } = ctx;
  const selectedBuildId = opts.buildId != null ? String(opts.buildId) : "";
  return (
    <form method="post" action={`${base}/reports`}>
      {opts.error ? <p class="hint" style="color:#e88" role="alert">{opts.error}</p> : null}
      <p class="hint">
        Paste your after-run battle report below. Tier, wave, coins, and duration are extracted
        automatically.
      </p>
      <div class="meta">
        <div>
          <label for="build_id">Build (optional)</label>
          <select id="build_id" name="build_id">
            <option value="">— no build linked —</option>
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
        <label for="raw">Battle Report Paste</label>
        <textarea
          id="raw"
          name="raw"
          rows={22}
          placeholder="Paste your after-run report here..."
          style="font-size:.78rem;line-height:1.5;resize:vertical;"
        >
          {opts.raw ?? ""}
        </textarea>
      </div>
      <div class="actions">
        <button type="submit">Save report</button>
      </div>
    </form>
  );
}

export function ReportsList({ ctx, reports }: { ctx: RequestContext; reports: BattleReport[] }) {
  const { base, fmt } = ctx;
  if (reports.length === 0) {
    return (
      <p class="hint">
        No reports yet. <a href={`${base}/reports/new`} style="color:var(--accent)">Log a run →</a>
      </p>
    );
  }
  return (
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Date</th>
          <th>Tier</th>
          <th>Wave</th>
          <th>Coins</th>
          <th>Duration</th>
          <th>Build</th>
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
              {r.date_inferred
                ? (
                  <span title={DATE_INFERRED_TITLE} style="color:#e88;font-size:.7rem;">
                    {" [?]"}
                  </span>
                )
                : null}
            </td>
            <td>{r.tier?.toString() ?? "—"}</td>
            <td>{r.wave?.toLocaleString() ?? "—"}</td>
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
  const { base, fmt } = ctx;
  const br = r.parsed["battle_report"] ?? {};
  const th = "width:160px;font-weight:normal";

  const rows: VNode[] = [
    <tr>
      <th style={th}>Occurred</th>
      <td>
        {fmt.dateTime(r.occurred_at)}
        {r.date_inferred
          ? (
            <span title={DATE_INFERRED_TITLE} style="color:#e88;font-size:.8rem;">
              {" [date inferred]"}
            </span>
          )
          : null}
      </td>
    </tr>,
    <tr>
      <th style={th}>Tier</th>
      <td>{r.tier?.toString() ?? "—"}</td>
    </tr>,
    <tr>
      <th style={th}>Wave</th>
      <td>{r.wave?.toLocaleString() ?? "—"}</td>
    </tr>,
    <tr>
      <th style={th}>Coins Earned</th>
      <td>{br["Coins Earned"] ?? fmt.num(r.coins)}</td>
    </tr>,
    <tr>
      <th style={th}>Coins / Hour</th>
      <td>{br["Coins Per Hour"] ?? "—"}</td>
    </tr>,
    <tr>
      <th style={th}>Cells Earned</th>
      <td>{br["Cells Earned"] ?? "—"}</td>
    </tr>,
    <tr>
      <th style={th}>Real Time</th>
      <td>{br["Real Time"] ?? fmt.duration(r.duration_s)}</td>
    </tr>,
    <tr>
      <th style={th}>Killed By</th>
      <td>{br["Killed By"] ?? "—"}</td>
    </tr>,
  ];
  if (r.build_id) {
    rows.push(
      <tr>
        <th style={th}>Build</th>
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
              raw paste
            </summary>
            <pre style="margin-top:.5rem">{r.raw}</pre>
          </details>
        )
        : null}
    </>
  );
}
