// fields.tsx — the schema-driven form pieces: a single input (Field) and the
// three category layouts (flat grid / paired upgrade+enhancement / grouped
// columns), each wrapped in a collapsible <details> section with a filled-count.
// Labels/titles/placeholders go through ctx.t (defaulting to the schema labels).

import { formatNum, type NumUnit } from "../num_format.ts";
import type { Category, Field as SchemaField, FieldType } from "../stat_schema.ts";
import type { RequestContext } from "../services/ctx.ts";
import type { TFunc } from "../i18n/index.ts";

// Default (English) hint shown in empty numeric inputs, by unit.
const NUM_PLACEHOLDER: Record<NumUnit, string> = {
  num: "e.g. 869.03M",
  mult: "e.g. ×1.012",
  pct: "e.g. 56.4%",
  sec: "e.g. 14s",
};

// Mobile keyboard per unit: "num" carries a letter suffix (K/M/B…) so it needs
// the full keyboard; the others are pure decimals.
const INPUTMODE: Record<NumUnit, string> = {
  num: "text",
  mult: "decimal",
  pct: "decimal",
  sec: "decimal",
};

type InputField = { key: string; type: FieldType; unit?: NumUnit; options?: string[] };

// Translatable label for a stat/enhancement field (default = its schema label).
const statLabel = (t: TFunc, catKey: string, key: string, label: string) =>
  t(`stat.${catKey}.${key}`, { default: label });

const hasValue = (v: unknown) => v !== undefined && v !== null && v !== "";

export function Field(
  { ctx, cat, f, value, invalid }: {
    ctx: RequestContext;
    cat: Category;
    f: InputField;
    value: unknown;
    invalid?: boolean;
  },
) {
  const name = `${cat.key}.${f.key}`;
  const v = value ?? "";

  if (f.type === "select") {
    // title shows the full selected value on hover (long substat options can
    // otherwise be clipped by a narrow select).
    return (
      <select id={name} name={name} title={v ? String(v) : undefined}>
        <option value="">—</option>
        {(f.options ?? []).map((o) => <option value={o} selected={o === v}>{o}</option>)}
      </select>
    );
  }
  if (f.type === "bool") {
    return <input id={name} type="checkbox" name={name} checked={!!v} />;
  }
  if (f.type === "text") {
    return <input id={name} type="text" name={name} value={String(v)} />;
  }

  const unit = f.unit ?? "num";
  let display = "";
  if (hasValue(value)) {
    const n = typeof value === "number" ? value : Number(value);
    display = Number.isFinite(n) ? formatNum(n, unit) : String(value);
  }
  return (
    <input
      id={name}
      type="text"
      inputmode={INPUTMODE[unit]}
      autocomplete="off"
      autocapitalize="off"
      spellcheck={false}
      name={name}
      value={display}
      placeholder={ctx.t(`placeholder.${unit}`, { default: NUM_PLACEHOLDER[unit] })}
      aria-invalid={invalid ? "true" : undefined}
      aria-describedby={invalid ? "form-error" : undefined}
    />
  );
}

function labelledField(
  ctx: RequestContext,
  cat: Category,
  f: InputField & { label: string },
  catData: Record<string, unknown>,
  invalid?: Set<string>,
) {
  return (
    <div>
      <label for={`${cat.key}.${f.key}`}>{statLabel(ctx.t, cat.key, f.key, f.label)}</label>
      <Field
        ctx={ctx}
        cat={cat}
        f={f}
        value={catData[f.key]}
        invalid={invalid?.has(`${cat.key}.${f.key}`)}
      />
    </div>
  );
}

// Render a module column's fields. A substat slot is a `_sub<n>_type` select
// immediately followed by its `_sub<n>_val` text input — render them as one
// paired row under a single "Substat N" label.
function groupFieldRows(
  ctx: RequestContext,
  cat: Category,
  fields: SchemaField[],
  catData: Record<string, unknown>,
  invalid?: Set<string>,
) {
  const out = [];
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (/_sub\d+_type$/.test(f.key) && fields[i + 1]) {
      const val = fields[i + 1];
      out.push(
        <div>
          <label for={`${cat.key}.${f.key}`}>{statLabel(ctx.t, cat.key, f.key, f.label)}</label>
          <div class="substat-row">
            <Field ctx={ctx} cat={cat} f={f} value={catData[f.key]} />
            <Field ctx={ctx} cat={cat} f={val} value={catData[val.key]} />
          </div>
        </div>,
      );
      i++; // consumed the value field
    } else {
      out.push(labelledField(ctx, cat, f, catData, invalid));
    }
  }
  return out;
}

function GroupedBody(
  { ctx, cat, catData, invalid }: {
    ctx: RequestContext;
    cat: Category;
    catData: Record<string, unknown>;
    invalid?: Set<string>;
  },
) {
  const { t } = ctx;
  const order: string[] = [];
  const byGroup = new Map<string, { label: string; fields: SchemaField[] }>();
  for (const f of cat.fields) {
    const g = f.group!;
    if (!byGroup.has(g.key)) {
      byGroup.set(g.key, { label: g.label, fields: [] });
      order.push(g.key);
    }
    byGroup.get(g.key)!.fields.push(f);
  }
  return (
    <div class="mod-grid">
      {order.map((k) => {
        const g = byGroup.get(k)!;
        return (
          <div class="mod-col">
            <div class="col-hdr">{t(`mod.${k}`, { default: g.label })}</div>
            {groupFieldRows(ctx, cat, g.fields, catData, invalid)}
          </div>
        );
      })}
    </div>
  );
}

function FlatBody(
  { ctx, cat, catData, invalid }: {
    ctx: RequestContext;
    cat: Category;
    catData: Record<string, unknown>;
    invalid?: Set<string>;
  },
) {
  return (
    <div class="grid">{cat.fields.map((f) => labelledField(ctx, cat, f, catData, invalid))}</div>
  );
}

function PairedBody(
  { ctx, cat, catData, invalid }: {
    ctx: RequestContext;
    cat: Category;
    catData: Record<string, unknown>;
    invalid?: Set<string>;
  },
) {
  const { t } = ctx;
  // Upgrades in col 1 (DOM-first = tab-first), enhancements in col 2.
  return (
    <div class="paired-grid">
      <div class="col-hdr" style="grid-column:1;grid-row:1">{t("buildForm.upgrade")}</div>
      <div class="col-hdr" style="grid-column:2;grid-row:1">{t("buildForm.enhancement")}</div>
      {cat.fields.map((f, i) => (
        <div style={`grid-column:1;grid-row:${i + 2}`}>
          {labelledField(ctx, cat, f, catData, invalid)}
        </div>
      ))}
      {cat.fields.map((f, i) =>
        f.enhancement
          ? (
            <div style={`grid-column:2;grid-row:${i + 2}`}>
              {labelledField(ctx, cat, f.enhancement, catData, invalid)}
            </div>
          )
          : null
      )}
    </div>
  );
}

export function Section(
  { ctx, cat, data, invalid }: {
    ctx: RequestContext;
    cat: Category;
    data: Record<string, Record<string, unknown>>;
    invalid?: Set<string>;
  },
) {
  const { t } = ctx;
  const catData = (data[cat.key] as Record<string, unknown> | undefined) ?? {};
  const title = t(`cat.${cat.key}`, { default: cat.title });

  // Filled-count across every input (field + enhancement) in the category.
  const keys: string[] = [];
  for (const f of cat.fields) {
    keys.push(f.key);
    if (f.enhancement) keys.push(f.enhancement.key);
  }
  const filled = keys.reduce((n, k) => n + (hasValue(catData[k]) ? 1 : 0), 0);

  const body = cat.fields.some((f) => f.group)
    ? <GroupedBody ctx={ctx} cat={cat} catData={catData} invalid={invalid} />
    : cat.fields.some((f) => f.enhancement)
    ? <PairedBody ctx={ctx} cat={cat} catData={catData} invalid={invalid} />
    : <FlatBody ctx={ctx} cat={cat} catData={catData} invalid={invalid} />;

  // Open sections that already hold data; collapse empty ones so a fresh form
  // isn't a wall of inputs.
  return (
    <details class="section" open={filled > 0}>
      <summary>
        <span>{title}</span>
        <span class="count">{filled}/{keys.length}</span>
      </summary>
      <div class="section-body">{body}</div>
    </details>
  );
}
