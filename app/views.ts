// views.ts — server-rendered HTML (no client framework).
// Dark "control panel" aesthetic to match a homelab dashboard; dependency-free
// (no external fonts/CDN) so it stays fast on the LAN.

import { escape } from "@std/html";
import { BattleReport, Build } from "../db/db.ts";
import { Category, Field, FieldType, STAT_SCHEMA } from "./stat_schema.ts";
import { formatNum, type NumUnit } from "./num_format.ts";

function fmtDuration(s: number | null): string {
  if (!s) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h && `${h}h`, m && `${m}m`, `${sec}s`].filter(Boolean).join(" ");
}

// HTML-escape any value before it goes into markup. Backed by @std/html's
// `escape` (escapes & < > " '), so we're not maintaining our own escaper.
//
// SAFETY CONVENTION — esc() only protects two contexts: element text and
// DOUBLE-QUOTED attribute values. It is NOT context-aware. So, without
// exception in this file:
//   1. Every attribute that holds user/DB data must be double-quoted: value="${esc(x)}".
//   2. User/DB data must NEVER reach a URL (href/src), <script>, an inline
//      event handler (onclick=...), or a style="..." context — esc() does not
//      neutralize javascript: schemes or JS/CSS string breakouts.
// Interpolated `base` is env-controlled and numeric IDs are numbers, so those
// are safe in href/style today. Keep it that way.
function esc(v: unknown): string {
  return escape(String(v ?? ""));
}

const STYLE = `
  :root {
    --bg: #0e1116; --panel: #161b22; --line: #232a34;
    --ink: #d7dde5; --muted: #8b97a7; --accent: #e8b450; --accent-dim: #7a6230;
    --mono: ui-monospace, "JetBrains Mono", "SFMono-Regular", Menlo, monospace;
    --body: system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--ink); font-family: var(--body);
    line-height: 1.5; padding: 1.25rem; max-width: 880px; margin-inline: auto;
  }
  header { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem;
    border-bottom: 1px solid var(--line); padding-bottom: .75rem; margin-bottom: 1.25rem; }
  h1 { font-family: var(--mono); font-size: 1.15rem; letter-spacing: .04em; margin: 0;
    color: var(--accent); text-transform: uppercase; }
  nav a { color: var(--muted); text-decoration: none; font-family: var(--mono);
    font-size: .8rem; margin-left: 1rem; }
  nav a:hover { color: var(--ink); }
  fieldset { border: 1px solid var(--line); border-radius: 8px; background: var(--panel);
    margin: 0 0 1rem; padding: 1rem 1.1rem 1.2rem; }
  legend { font-family: var(--mono); font-size: .78rem; letter-spacing: .05em;
    text-transform: uppercase; color: var(--accent); padding: 0 .4rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: .75rem; }
  label { display: block; font-size: .72rem; color: var(--muted); margin-bottom: .25rem;
    font-family: var(--mono); }
  input, select, textarea {
    width: 100%; background: #0b0e13; color: var(--ink); border: 1px solid var(--line);
    border-radius: 6px; padding: .45rem .55rem; font-family: var(--mono); font-size: .9rem;
  }
  input:focus, select:focus, textarea:focus { outline: 2px solid var(--accent); outline-offset: 2px; border-color: var(--accent); }
  .meta { display: grid; grid-template-columns: 1fr 2fr; gap: .75rem; margin-bottom: 1rem; }
  .actions { display: flex; gap: .75rem; align-items: center; margin-top: .5rem; }
  button { background: var(--accent); color: #1a1408; border: 0; border-radius: 6px;
    padding: .55rem 1.1rem; font-family: var(--mono); font-weight: 600; cursor: pointer; }
  button:hover { filter: brightness(1.08); }
  .hint { color: var(--muted); font-size: .78rem; }
  table { width: 100%; border-collapse: collapse; font-size: .9rem; }
  th, td { text-align: left; padding: .5rem .4rem; border-bottom: 1px solid var(--line); }
  th { font-family: var(--mono); font-size: .72rem; text-transform: uppercase; color: var(--muted); }
  td a { color: var(--accent); text-decoration: none; }
  pre { background: var(--panel); border: 1px solid var(--line); border-radius: 8px;
    padding: 1rem; overflow: auto; font-family: var(--mono); font-size: .82rem; }
  .paired-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; align-items: start; }
  .col-hdr { font-family: var(--mono); font-size: .68rem; letter-spacing: .04em;
    text-transform: uppercase; color: var(--accent-dim);
    padding-bottom: .3rem; border-bottom: 1px solid var(--line); }
`;

export function layout(base: string, title: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${STYLE}</style>
</head><body>
<header>
  <h1>Tower // Builds</h1>
  <nav>
    <a href="${base}/builds">builds</a>
    <a href="${base}/builds/new">new build</a>
    <a href="${base}/builds/new?from=latest">respec</a>
    <a href="${base}/reports">reports</a>
    <a href="${base}/reports/new">log run</a>
  </nav>
</header>
${body}
</body></html>`;
}

// Hint shown in empty numeric inputs, by unit — teaches the accepted shorthand.
const NUM_PLACEHOLDER: Record<NumUnit, string> = {
  num: "e.g. 869.03M",
  mult: "e.g. ×1.012",
  pct: "e.g. 56.4%",
  sec: "e.g. 14s",
};

function fieldInput(
  cat: Category,
  f: { key: string; type: FieldType; unit?: NumUnit; options?: string[] },
  value: unknown,
): string {
  const name = `${cat.key}.${f.key}`;
  const v = value ?? "";
  if (f.type === "select") {
    const opts = (f.options ?? [])
      .map((o) => `<option value="${esc(o)}"${o === v ? " selected" : ""}>${esc(o)}</option>`)
      .join("");
    return `<select id="${esc(name)}" name="${
      esc(name)
    }"><option value="">—</option>${opts}</select>`;
  }
  if (f.type === "bool") {
    return `<input id="${esc(name)}" type="checkbox" name="${esc(name)}"${v ? " checked" : ""}>`;
  }
  if (f.type === "text") {
    return `<input id="${esc(name)}" type="text" name="${esc(name)}" value="${esc(v)}">`;
  }
  // Numeric (int/number): a TEXT input — not type=number, which hard-blocks
  // decimals and the magnitude shorthand the game shows ("869.03M"). The stored
  // value is echoed back in the same human format, so prefill/respec and
  // validation-error re-renders read the way you'd type them.
  const unit = f.unit ?? "num";
  let display = "";
  if (value !== null && value !== undefined && value !== "") {
    const n = typeof value === "number" ? value : Number(value);
    display = Number.isFinite(n) ? formatNum(n, unit) : String(value);
  }
  return `<input id="${esc(name)}" type="text" inputmode="text" autocomplete="off" ` +
    `autocapitalize="off" spellcheck="false" name="${esc(name)}" value="${esc(display)}" ` +
    `placeholder="${esc(NUM_PLACEHOLDER[unit])}">`;
}

function renderSection(cat: Category, data: Record<string, Record<string, unknown>>): string {
  const catData = (data[cat.key] as Record<string, unknown> | undefined) ?? {};
  const hasEnhancements = cat.fields.some((f) => f.enhancement);

  if (!hasEnhancements) {
    const cells = cat.fields.map((f) =>
      `<div><label for="${esc(`${cat.key}.${f.key}`)}">${esc(f.label)}</label>${
        fieldInput(cat, f, catData[f.key])
      }</div>`
    ).join("");
    return `<fieldset><legend>${
      esc(cat.title)
    }</legend><div class="grid">${cells}</div></fieldset>`;
  }

  // Upgrades in col 1 (DOM-first = tab-first), enhancements in col 2 (DOM-second).
  // Explicit grid-row on every cell keeps visual rows aligned without interleaving tab stops.
  const upgradeCells = cat.fields.map((f, i) =>
    `<div style="grid-column:1;grid-row:${i + 2}">
      <label for="${esc(`${cat.key}.${f.key}`)}">${esc(f.label)}</label>${
      fieldInput(cat, f, catData[f.key])
    }
    </div>`
  ).join("");

  const enhCells = cat.fields.map((f, i) => {
    if (!f.enhancement) return "";
    return `<div style="grid-column:2;grid-row:${i + 2}">
      <label for="${esc(`${cat.key}.${f.enhancement.key}`)}">${esc(f.enhancement.label)}</label>${
      fieldInput(cat, f.enhancement, catData[f.enhancement.key])
    }
    </div>`;
  }).join("");

  return `<fieldset><legend>${esc(cat.title)}</legend>
    <div class="paired-grid">
      <div class="col-hdr" style="grid-column:1;grid-row:1">Upgrade</div>
      <div class="col-hdr" style="grid-column:2;grid-row:1">Enhancement ×</div>
      ${upgradeCells}
      ${enhCells}
    </div>
  </fieldset>`;
}

// `build` prefills the form (used for respec / clone-and-edit).
// `error` displays a validation error banner (role="alert") above the form.
// `submittedLabel`, `submittedNote`, and `submittedData` repopulate the form
//   after a failed save so no user input is lost. These take priority over the
//   `build` prefill values when present.
export function buildForm(
  base: string,
  opts: {
    build?: Build;
    parentId?: number;
    error?: string;
    submittedLabel?: string;
    submittedNote?: string;
    submittedData?: Record<string, Record<string, unknown>>;
  } = {},
): string {
  // submittedData takes priority over build.data so validation-error re-renders
  // echo back exactly what the user submitted.
  const data: Record<string, Record<string, unknown>> = opts.submittedData ?? opts.build?.data ??
    {};
  const parentId = opts.parentId ?? "";
  // On a validation-error re-render, submittedLabel takes priority so the bad
  // value is echoed back; on a respec prefill, derive the default from the source build.
  const labelValue = opts.submittedLabel !== undefined
    ? opts.submittedLabel
    : (opts.build ? `${opts.build.label} (respec)` : "");
  const noteValue = opts.submittedNote ?? "";

  const sections = STAT_SCHEMA.map((cat) => renderSection(cat, data)).join("");

  const errorBanner = opts.error
    ? `<p class="hint" style="color:#e88" role="alert">${esc(opts.error)}</p>`
    : "";

  // Show the respec note only when prefilling from an actual saved build (not
  // on a validation-error re-render where submittedData is supplied instead).
  const respecNote = opts.build && !opts.submittedData
    ? `<p class="hint">Cloned from build #${opts.build.id} — change only what moved, then save as a new snapshot. Untouched fields carry forward.</p>`
    : `<p class="hint">A new snapshot. Or start from your last build via <a href="${base}/builds/new?from=latest" style="color:var(--accent)">respec</a>.</p>`;

  return `
<form method="post" action="${base}/builds">
  <input type="hidden" name="parent_build_id" value="${esc(parentId)}">
  ${errorBanner}
  ${respecNote}
  <div class="meta">
    <div><label for="label">Label</label><input id="label" type="text" name="label" value="${
    esc(labelValue)
  }" placeholder="fire crit v3" required></div>
    <div><label for="note">Note</label><input id="note" type="text" name="note" value="${
    esc(noteValue)
  }" placeholder="optional context"></div>
  </div>
  ${sections}
  <div class="actions"><button type="submit">Save snapshot</button></div>
</form>`;
}

export function buildsList(base: string, builds: Build[]): string {
  if (builds.length === 0) {
    return `<p class="hint">No builds yet. <a href="${base}/builds/new" style="color:var(--accent)">Create one →</a></p>`;
  }
  const rows = builds.map((b) => `
    <tr>
      <td><a href="${base}/builds/${b.id}">#${b.id} ${esc(b.label)}</a></td>
      <td>${b.parent_build_id ? "#" + b.parent_build_id : "—"}</td>
      <td class="hint">${esc(b.note ?? "")}</td>
      <td class="hint">${esc(new Date(b.created_at).toLocaleString())}</td>
    </tr>`).join("");
  return `<table>
    <thead><tr><th>Build</th><th>Respec of</th><th>Note</th><th>Saved</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

// Render one stored value the way the game shows it: numbers through formatNum
// (per unit), everything else as escaped text. Returns null for absent values
// so the caller can skip the row entirely.
function displayValue(
  f: { type: FieldType; unit?: NumUnit },
  value: unknown,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (f.type === "int" || f.type === "number") {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? formatNum(n, f.unit ?? "num") : esc(String(value));
  }
  if (f.type === "bool") return value ? "yes" : "no";
  return esc(String(value));
}

// A read-only, schema-driven view of one category's stored stats. Only fields
// that actually have a value are shown; an empty category renders nothing.
function detailSection(cat: Category, data: Record<string, Record<string, unknown>>): string {
  const catData = (data[cat.key] as Record<string, unknown> | undefined) ?? {};
  const rows: string[] = [];
  for (const f of cat.fields as Field[]) {
    const v = displayValue(f, catData[f.key]);
    if (v !== null) {
      rows.push(
        `<tr><th style="width:200px;font-weight:normal;color:var(--muted)">${
          esc(f.label)
        }</th><td style="font-family:var(--mono)">${v}</td></tr>`,
      );
    }
    if (f.enhancement) {
      const ev = displayValue(f.enhancement, catData[f.enhancement.key]);
      if (ev !== null) {
        rows.push(
          `<tr><th style="width:200px;font-weight:normal;color:var(--muted)">${
            esc(f.enhancement.label)
          }</th><td style="font-family:var(--mono)">${ev}</td></tr>`,
        );
      }
    }
  }
  if (rows.length === 0) return "";
  return `<fieldset><legend>${esc(cat.title)}</legend>
    <table style="width:auto;font-size:.88rem;">${rows.join("")}</table>
  </fieldset>`;
}

export function buildDetail(base: string, b: Build): string {
  const sections = STAT_SCHEMA.map((cat) => detailSection(cat, b.data)).join("");
  const body = sections ||
    `<p class="hint">This snapshot has no stored stats.</p>`;
  return `
    <p><a href="${base}/builds/new?from=${b.id}" style="color:var(--accent);font-family:var(--mono)">→ respec from this build</a></p>
    ${body}
    <details style="margin-top:1rem;"><summary class="hint" style="cursor:pointer;font-family:var(--mono);font-size:.78rem;">raw data</summary><pre style="margin-top:.5rem">${
    esc(JSON.stringify(b.data, null, 2))
  }</pre></details>`;
}

export function reportForm(
  base: string,
  builds: Build[],
  opts: { raw?: string; buildId?: string | number; error?: string } = {},
): string {
  const selectedBuildId = opts.buildId != null ? String(opts.buildId) : "";
  const buildOptions = builds
    .map((b) => {
      const sel = String(b.id) === selectedBuildId ? " selected" : "";
      return `<option value="${b.id}"${sel}>#${b.id} ${esc(b.label)}</option>`;
    })
    .join("");
  const errorBanner = opts.error
    ? `<p class="hint" style="color:#e88" role="alert">${esc(opts.error)}</p>`
    : "";
  return `
<form method="post" action="${base}/reports">
  ${errorBanner}
  <p class="hint">Paste your after-run battle report below. Tier, wave, coins, and duration are extracted automatically.</p>
  <div class="meta">
    <div>
      <label for="build_id">Build (optional)</label>
      <select id="build_id" name="build_id">
        <option value="">— no build linked —</option>
        ${buildOptions}
      </select>
    </div>
    <div></div>
  </div>
  <div style="margin-bottom:1rem;">
    <label for="raw">Battle Report Paste</label>
    <textarea id="raw" name="raw" rows="22" placeholder="Paste your after-run report here..." style="font-size:.78rem;line-height:1.5;resize:vertical;">${
    esc(opts.raw ?? "")
  }</textarea>
  </div>
  <div class="actions"><button type="submit">Save report</button></div>
</form>`;
}

export function reportsList(base: string, reports: BattleReport[]): string {
  if (reports.length === 0) {
    return `<p class="hint">No reports yet. <a href="${base}/reports/new" style="color:var(--accent)">Log a run →</a></p>`;
  }
  const rows = reports.map((r) => `
    <tr>
      <td><a href="${base}/reports/${r.id}">#${r.id}</a></td>
      <td class="hint">${esc(new Date(r.occurred_at).toLocaleString())}${
    r.date_inferred
      ? ' <span title="Battle Date missing or unparseable — using insert time" style="color:#e88;font-size:.7rem;">[?]</span>'
      : ""
  }</td>
      <td>${esc(r.tier?.toString() ?? "—")}</td>
      <td>${esc(r.wave?.toLocaleString() ?? "—")}</td>
      <td>${formatNum(r.coins)}</td>
      <td class="hint">${fmtDuration(r.duration_s)}</td>
      <td>${
    r.build_id
      ? `<a href="${base}/builds/${r.build_id}">#${r.build_id} ${esc(r.build_label ?? "")}</a>`
      : "—"
  }</td>
    </tr>`).join("");
  return `<table>
    <thead><tr><th>#</th><th>Date</th><th>Tier</th><th>Wave</th><th>Coins</th><th>Duration</th><th>Build</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

export function reportDetail(base: string, r: BattleReport): string {
  const br = r.parsed["battle_report"] ?? {};
  const summary: [string, string][] = [
    [
      "Occurred",
      esc(new Date(r.occurred_at).toLocaleString()) +
      (r.date_inferred
        ? ' <span title="Battle Date missing or unparseable — using insert time" style="color:#e88;font-size:.8rem;">[date inferred]</span>'
        : ""),
    ],
    ["Tier", esc(r.tier?.toString() ?? "—")],
    ["Wave", esc(r.wave?.toLocaleString() ?? "—")],
    ["Coins Earned", esc(br["Coins Earned"] ?? formatNum(r.coins))],
    ["Coins / Hour", esc(br["Coins Per Hour"] ?? "—")],
    ["Cells Earned", esc(br["Cells Earned"] ?? "—")],
    ["Real Time", esc(br["Real Time"] ?? fmtDuration(r.duration_s))],
    ["Killed By", esc(br["Killed By"] ?? "—")],
    ...(r.build_id
      ? [
        [
          "Build",
          `<a href="${base}/builds/${r.build_id}" style="color:var(--accent)">#${r.build_id} ${
            esc(r.build_label ?? "")
          }</a>`,
        ] as [string, string],
      ]
      : []),
  ];
  const summaryRows = summary
    .map(([k, v]) => `<tr><th style="width:160px;font-weight:normal">${k}</th><td>${v}</td></tr>`)
    .join("");
  return `
    <table style="width:auto;margin-bottom:1.5rem;font-size:.88rem;">${summaryRows}</table>
    <pre>${esc(JSON.stringify(r.parsed, null, 2))}</pre>
    ${
    r.raw
      ? `<details style="margin-top:1rem;"><summary class="hint" style="cursor:pointer;font-family:var(--mono);font-size:.78rem;">raw paste</summary><pre style="margin-top:.5rem">${
        esc(r.raw)
      }</pre></details>`
      : ""
  }`;
}
