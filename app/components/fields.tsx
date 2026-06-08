// fields.tsx — the schema-driven form pieces: a single input (Field) and the
// three category layouts (flat grid / paired upgrade+enhancement / grouped
// columns). Labels/titles/placeholders go through ctx.t (defaulting to the
// schema's English labels), so every game term is translatable.

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
    return (
      <select id={name} name={name}>
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
  if (value !== null && value !== undefined && value !== "") {
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

function GroupedSection(
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
    <fieldset>
      <legend>{t(`cat.${cat.key}`, { default: cat.title })}</legend>
      <div class="mod-grid">
        {order.map((k) => {
          const g = byGroup.get(k)!;
          return (
            <div class="mod-col">
              <div class="col-hdr">{t(`mod.${k}`, { default: g.label })}</div>
              {g.fields.map((f) => (
                <div>
                  <label for={`${cat.key}.${f.key}`}>{statLabel(t, cat.key, f.key, f.label)}</label>
                  <Field
                    ctx={ctx}
                    cat={cat}
                    f={f}
                    value={catData[f.key]}
                    invalid={invalid?.has(`${cat.key}.${f.key}`)}
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </fieldset>
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

  if (cat.fields.some((f) => f.group)) {
    return <GroupedSection ctx={ctx} cat={cat} catData={catData} invalid={invalid} />;
  }

  const hasEnhancements = cat.fields.some((f) => f.enhancement);
  if (!hasEnhancements) {
    return (
      <fieldset>
        <legend>{title}</legend>
        <div class="grid">
          {cat.fields.map((f) => (
            <div>
              <label for={`${cat.key}.${f.key}`}>{statLabel(t, cat.key, f.key, f.label)}</label>
              <Field
                ctx={ctx}
                cat={cat}
                f={f}
                value={catData[f.key]}
                invalid={invalid?.has(`${cat.key}.${f.key}`)}
              />
            </div>
          ))}
        </div>
      </fieldset>
    );
  }

  // Upgrades in col 1 (DOM-first = tab-first), enhancements in col 2.
  return (
    <fieldset>
      <legend>{title}</legend>
      <div class="paired-grid">
        <div class="col-hdr" style="grid-column:1;grid-row:1">{t("buildForm.upgrade")}</div>
        <div class="col-hdr" style="grid-column:2;grid-row:1">{t("buildForm.enhancement")}</div>
        {cat.fields.map((f, i) => (
          <div style={`grid-column:1;grid-row:${i + 2}`}>
            <label for={`${cat.key}.${f.key}`}>{statLabel(t, cat.key, f.key, f.label)}</label>
            <Field
              ctx={ctx}
              cat={cat}
              f={f}
              value={catData[f.key]}
              invalid={invalid?.has(`${cat.key}.${f.key}`)}
            />
          </div>
        ))}
        {cat.fields.map((f, i) =>
          f.enhancement
            ? (
              <div style={`grid-column:2;grid-row:${i + 2}`}>
                <label for={`${cat.key}.${f.enhancement.key}`}>
                  {statLabel(t, cat.key, f.enhancement.key, f.enhancement.label)}
                </label>
                <Field
                  ctx={ctx}
                  cat={cat}
                  f={f.enhancement}
                  value={catData[f.enhancement.key]}
                  invalid={invalid?.has(`${cat.key}.${f.enhancement.key}`)}
                />
              </div>
            )
            : null
        )}
      </div>
    </fieldset>
  );
}
