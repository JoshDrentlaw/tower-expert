// builds.tsx — build form, history list, and schema-driven detail view.
// All chrome + game labels go through ctx.t.

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
  // When set, the form edits this build in place (UPDATE) instead of creating
  // a new snapshot — used when leveling up, not respeccing.
  editId?: number;
  error?: string;
  submittedLabel?: string;
  submittedNote?: string;
  submittedData?: Record<string, Record<string, unknown>>;
  // Field names (`${cat.key}.${field.key}`) that failed to parse — marked
  // aria-invalid and pointed at the error banner.
  invalidKeys?: string[];
}

export function BuildForm({ ctx, opts = {} }: { ctx: RequestContext; opts?: BuildFormOpts }) {
  const { base, t } = ctx;
  const isEdit = opts.editId !== undefined;
  const action = isEdit ? `${base}/builds/${opts.editId}` : `${base}/builds`;
  const data: Record<string, Record<string, unknown>> = opts.submittedData ?? opts.build?.data ??
    {};
  const parentId = opts.parentId ?? "";
  const invalid = opts.invalidKeys ? new Set(opts.invalidKeys) : undefined;
  const labelValue = opts.submittedLabel !== undefined
    ? opts.submittedLabel
    : isEdit
    ? (opts.build?.label ?? "")
    : (opts.build ? `${opts.build.label} (respec)` : "");
  const noteValue = opts.submittedNote !== undefined
    ? opts.submittedNote
    : (isEdit ? (opts.build?.note ?? "") : "");

  const introNote = isEdit
    ? <p class="hint">{t("buildForm.editing", { id: opts.editId! })}</p>
    : opts.build && !opts.submittedData
    ? <p class="hint">{t("buildForm.cloned", { id: opts.build.id })}</p>
    : (
      <p class="hint">
        {t("buildForm.newSnapshotLead")}{" "}
        <a href={`${base}/builds/new?from=latest`} style="color:var(--accent)">
          {t("buildForm.respec")}
        </a>.
      </p>
    );

  return (
    <form method="post" action={action}>
      {isEdit ? null : <input type="hidden" name="parent_build_id" value={String(parentId)} />}
      {opts.error
        ? <p id="form-error" class="hint" style="color:#e88" role="alert">{opts.error}</p>
        : null}
      {introNote}
      <p class="hint">{t("buildForm.shorthandHint")}</p>
      <div class="meta">
        <div>
          <label for="label">
            {t("buildForm.label")} <span class="req" aria-hidden="true">*</span>
          </label>
          <input
            id="label"
            type="text"
            name="label"
            value={labelValue}
            placeholder={t("buildForm.labelPlaceholder")}
            required
            aria-required="true"
          />
        </div>
        <div>
          <label for="note">{t("buildForm.note")}</label>
          <input
            id="note"
            type="text"
            name="note"
            value={noteValue}
            placeholder={t("buildForm.notePlaceholder")}
          />
        </div>
      </div>
      {STAT_SCHEMA.map((cat) => <Section ctx={ctx} cat={cat} data={data} invalid={invalid} />)}
      <div class="actions sticky">
        <button type="submit">{t(isEdit ? "buildForm.saveEdit" : "buildForm.save")}</button>
      </div>
    </form>
  );
}

export function BuildsList({ ctx, builds }: { ctx: RequestContext; builds: Build[] }) {
  const { base, t, fmt } = ctx;
  if (builds.length === 0) {
    return (
      <p class="hint">
        {t("buildsList.empty")}{" "}
        <a href={`${base}/builds/new`} style="color:var(--accent)">{t("buildsList.createOne")}</a>
      </p>
    );
  }
  return (
    <table>
      <caption class="sr-only">{t("buildsList.caption")}</caption>
      <thead>
        <tr>
          <th scope="col">{t("buildsList.thBuild")}</th>
          <th scope="col">{t("buildsList.thRespecOf")}</th>
          <th scope="col">{t("buildsList.thNote")}</th>
          <th scope="col">{t("buildsList.thSaved")}</th>
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
  const { t } = ctx;
  const catData = (data[cat.key] as Record<string, unknown> | undefined) ?? {};
  const rows: VNode[] = [];
  const th = "width:200px;font-weight:normal;color:var(--muted)";
  for (const f of cat.fields as SchemaField[]) {
    const v = displayValue(ctx.fmt, f, catData[f.key]);
    if (v !== null) {
      const base = t(`stat.${cat.key}.${f.key}`, { default: f.label });
      const label = f.group
        ? `${t(`mod.${f.group.key}`, { default: f.group.label })} — ${base}`
        : base;
      rows.push(
        <tr>
          <th scope="row" style={th}>{label}</th>
          <td style="font-family:var(--mono)">{v}</td>
        </tr>,
      );
    }
    if (f.enhancement) {
      const ev = displayValue(ctx.fmt, f.enhancement, catData[f.enhancement.key]);
      if (ev !== null) {
        const elabel = t(`stat.${cat.key}.${f.enhancement.key}`, { default: f.enhancement.label });
        rows.push(
          <tr>
            <th scope="row" style={th}>{elabel}</th>
            <td style="font-family:var(--mono)">{ev}</td>
          </tr>,
        );
      }
    }
  }
  if (rows.length === 0) return null;
  return (
    <fieldset>
      <legend>{t(`cat.${cat.key}`, { default: cat.title })}</legend>
      <table style="width:auto;font-size:.88rem;">{rows}</table>
    </fieldset>
  );
}

export function BuildDetail({ ctx, b }: { ctx: RequestContext; b: Build }) {
  const { base, t } = ctx;
  const sections = STAT_SCHEMA
    .map((cat) => <DetailSection ctx={ctx} cat={cat} data={b.data} />)
    .filter((s): s is VNode => s !== null);
  return (
    <>
      <p style="display:flex;gap:1.25rem;flex-wrap:wrap;font-family:var(--mono)">
        <a href={`${base}/builds/${b.id}/edit`} style="color:var(--accent)">
          {t("buildDetail.edit")}
        </a>
        <a href={`${base}/builds/new?from=${b.id}`} style="color:var(--accent)">
          {t("buildDetail.respecFrom")}
        </a>
      </p>
      {sections.length ? sections : <p class="hint">{t("buildDetail.noStats")}</p>}
      <details style="margin-top:1rem;">
        <summary class="hint" style="cursor:pointer;font-family:var(--mono);font-size:.78rem;">
          {t("buildDetail.rawData")}
        </summary>
        <pre style="margin-top:.5rem">{JSON.stringify(b.data, null, 2)}</pre>
      </details>
    </>
  );
}
