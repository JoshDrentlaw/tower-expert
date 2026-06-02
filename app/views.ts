// views.ts — server-rendered HTML (no client framework).
// Dark "control panel" aesthetic to match a homelab dashboard; dependency-free
// (no external fonts/CDN) so it stays fast on the LAN.

import { Build } from "../db/db.ts";
import { Category, STAT_SCHEMA } from "./stat_schema.ts";

function esc(v: unknown): string {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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
  input:focus, select:focus, textarea:focus { outline: none; border-color: var(--accent-dim); }
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
    <a href="${base}/builds">history</a>
    <a href="${base}/builds/new">new</a>
    <a href="${base}/builds/new?from=latest">respec</a>
  </nav>
</header>
${body}
</body></html>`;
}

function fieldInput(cat: Category, f: Category["fields"][number], value: unknown): string {
  const name = `${cat.key}.${f.key}`;
  const v = value ?? "";
  if (f.type === "select") {
    const opts = (f.options ?? [])
      .map((o) => `<option value="${esc(o)}"${o === v ? " selected" : ""}>${esc(o)}</option>`)
      .join("");
    return `<select name="${esc(name)}"><option value="">—</option>${opts}</select>`;
  }
  if (f.type === "bool") {
    return `<input type="checkbox" name="${esc(name)}"${v ? " checked" : ""}>`;
  }
  const inputType = f.type === "text" ? "text" : "number";
  const step = f.type === "number" ? ' step="any"' : "";
  return `<input type="${inputType}"${step} name="${esc(name)}" value="${esc(v)}">`;
}

// `build` prefills the form (used for respec / clone-and-edit).
export function buildForm(base: string, opts: { build?: Build; parentId?: number } = {}): string {
  const data: Record<string, Record<string, unknown>> = opts.build?.data ?? {};
  const parentId = opts.parentId ?? "";
  const defaultLabel = opts.build ? `${opts.build.label} (respec)` : "";

  const sections = STAT_SCHEMA.map((cat) => {
    const cells = cat.fields.map((f) => {
      const current = (data[cat.key] as Record<string, unknown> | undefined)?.[f.key];
      return `<div><label>${esc(f.label)}</label>${fieldInput(cat, f, current)}</div>`;
    }).join("");
    return `<fieldset><legend>${esc(cat.title)}</legend><div class="grid">${cells}</div></fieldset>`;
  }).join("");

  const respecNote = opts.build
    ? `<p class="hint">Cloned from build #${opts.build.id} — change only what moved, then save as a new snapshot. Untouched fields carry forward.</p>`
    : `<p class="hint">A new snapshot. Or start from your last build via <a href="${base}/builds/new?from=latest" style="color:var(--accent)">respec</a>.</p>`;

  return `
<form method="post" action="${base}/builds">
  <input type="hidden" name="parent_build_id" value="${esc(parentId)}">
  ${respecNote}
  <div class="meta">
    <div><label>Label</label><input type="text" name="label" value="${esc(defaultLabel)}" placeholder="fire crit v3" required></div>
    <div><label>Note</label><input type="text" name="note" placeholder="optional context"></div>
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

export function buildDetail(base: string, b: Build): string {
  return `
    <p><a href="${base}/builds/new?from=${b.id}" style="color:var(--accent);font-family:var(--mono)">→ respec from this build</a></p>
    <pre>${esc(JSON.stringify(b.data, null, 2))}</pre>`;
}
