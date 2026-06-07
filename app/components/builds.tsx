// builds.tsx — build form, history list, and schema-driven detail view.
// Ported 1:1 from views.ts (buildForm, buildsList, buildDetail, detailSection).

import type { VNode } from "preact";
import type { Build } from "../../db/db.ts";
import { type Category, type Field as SchemaField, STAT_SCHEMA } from "../stat_schema.ts";
import type { NumUnit } from "../num_format.ts";
import type { RequestContext } from "../services/ctx.ts";
import type { Formatter } from "../services/format.ts";
import { Section } from "./fields.tsx";

export interface BuildFormOpts {
  build?: Build;
  parentId?: number;
  error?: string;
  submittedLabel?: string;
  submittedNote?: string;
  submittedData?: Record<string, Record<string, unknown>>;
}

export function BuildForm({ ctx, opts = {} }: { ctx: RequestContext; opts?: BuildFormOpts }) {
  const { base } = ctx;
  // submittedData takes priority over build.data so validation-error re-renders
  // echo back exactly what the user submitted.
  const data: Record<string, Record<string, unknown>> = opts.submittedData ?? opts.build?.data ??
    {};
  const parentId = opts.parentId ?? "";
  const labelValue = opts.submittedLabel !== undefined
    ? opts.submittedLabel
    : (opts.build ? `${opts.build.label} (respec)` : "");
  const noteValue = opts.submittedNote ?? "";

  const respecNote = opts.build && !opts.submittedData
    ? (
      <p class="hint">
        Cloned from build #{opts.build.id}{" "}
        — change only what moved, then save as a new snapshot. Untouched fields carry forward.
      </p>
    )
    : (
      <p class="hint">
        A new snapshot. Or start from your last build via{" "}
        <a href={`${base}/builds/new?from=latest`} style="color:var(--accent)">respec</a>.
      </p>
    );

  return (
    <form method="post" action={`${base}/builds`}>
      <input type="hidden" name="parent_build_id" value={String(parentId)} />
      {opts.error ? <p class="hint" style="color:#e88" role="alert">{opts.error}</p> : null}
      {respecNote}
      <div class="meta">
        <div>
          <label for="label">Label</label>
          <input
            id="label"
            type="text"
            name="label"
            value={labelValue}
            placeholder="fire crit v3"
            required
          />
        </div>
        <div>
          <label for="note">Note</label>
          <input
            id="note"
            type="text"
            name="note"
            value={noteValue}
            placeholder="optional context"
          />
        </div>
      </div>
      {STAT_SCHEMA.map((cat) => <Section cat={cat} data={data} />)}
      <div class="actions">
        <button type="submit">Save snapshot</button>
      </div>
    </form>
  );
}

export function BuildsList({ ctx, builds }: { ctx: RequestContext; builds: Build[] }) {
  const { base, fmt } = ctx;
  if (builds.length === 0) {
    return (
      <p class="hint">
        No builds yet. <a href={`${base}/builds/new`} style="color:var(--accent)">Create one →</a>
      </p>
    );
  }
  return (
    <table>
      <thead>
        <tr>
          <th>Build</th>
          <th>Respec of</th>
          <th>Note</th>
          <th>Saved</th>
        </tr>
      </thead>
      <tbody>
        {builds.map((b) => (
          <tr>
            <td>
              <a href={`${base}/builds/${b.id}`}>#{b.id} {b.label}</a>
            </td>
            <td>{b.parent_build_id ? "#" + b.parent_build_id : "—"}</td>
            <td class="hint">{b.note ?? ""}</td>
            <td class="hint">{fmt.dateTime(b.created_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Render one stored value the way the game shows it; null = absent (skip row).
function displayValue(
  fmt: Formatter,
  f: { type: string; unit?: NumUnit },
  value: unknown,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (f.type === "int" || f.type === "number") {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? fmt.num(n, f.unit ?? "num") : String(value);
  }
  if (f.type === "bool") return value ? "yes" : "no";
  return String(value);
}

function DetailSection(
  { ctx, cat, data }: {
    ctx: RequestContext;
    cat: Category;
    data: Record<string, Record<string, unknown>>;
  },
): VNode | null {
  const catData = (data[cat.key] as Record<string, unknown> | undefined) ?? {};
  const rows: VNode[] = [];
  const th = "width:200px;font-weight:normal;color:var(--muted)";
  for (const f of cat.fields as SchemaField[]) {
    const v = displayValue(ctx.fmt, f, catData[f.key]);
    if (v !== null) {
      const label = f.group ? `${f.group.label} — ${f.label}` : f.label;
      rows.push(
        <tr>
          <th style={th}>{label}</th>
          <td style="font-family:var(--mono)">{v}</td>
        </tr>,
      );
    }
    if (f.enhancement) {
      const ev = displayValue(ctx.fmt, f.enhancement, catData[f.enhancement.key]);
      if (ev !== null) {
        rows.push(
          <tr>
            <th style={th}>{f.enhancement.label}</th>
            <td style="font-family:var(--mono)">{ev}</td>
          </tr>,
        );
      }
    }
  }
  if (rows.length === 0) return null;
  return (
    <fieldset>
      <legend>{cat.title}</legend>
      <table style="width:auto;font-size:.88rem;">{rows}</table>
    </fieldset>
  );
}

export function BuildDetail({ ctx, b }: { ctx: RequestContext; b: Build }) {
  const { base } = ctx;
  const sections = STAT_SCHEMA
    .map((cat) => <DetailSection ctx={ctx} cat={cat} data={b.data} />)
    .filter((s): s is VNode => s !== null);
  return (
    <>
      <p>
        <a
          href={`${base}/builds/new?from=${b.id}`}
          style="color:var(--accent);font-family:var(--mono)"
        >
          → respec from this build
        </a>
      </p>
      {sections.length ? sections : <p class="hint">This snapshot has no stored stats.</p>}
      <details style="margin-top:1rem;">
        <summary class="hint" style="cursor:pointer;font-family:var(--mono);font-size:.78rem;">
          raw data
        </summary>
        <pre style="margin-top:.5rem">{JSON.stringify(b.data, null, 2)}</pre>
      </details>
    </>
  );
}
