// fields.tsx — the schema-driven form pieces: a single input (Field) and the
// three category layouts (flat grid / paired upgrade+enhancement / grouped
// columns), each wrapped in a collapsible <details> section with a filled-count.
// Labels/titles/placeholders go through ctx.t (defaulting to the schema labels).

import { formatNum, type NumUnit } from "../num_format.ts";
import type { Category, Field as SchemaField, FieldType } from "../stat_schema.ts";
import { type Formula, levelFromValue } from "../stat_formula.ts";
import { findModule, modulesByType, type ModuleType } from "../module_catalog.ts";
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

type InputField = {
  key: string;
  type: FieldType;
  unit?: NumUnit;
  options?: string[];
  formula?: Formula;
};

// Translatable label for a stat/enhancement field (default = its schema label).
const statLabel = (t: TFunc, catKey: string, key: string, label: string) =>
  t(`stat.${catKey}.${key}`, { default: label });

const hasValue = (v: unknown) => v !== undefined && v !== null && v !== "";

export function Field(
  { ctx, cat, f, value, invalid, ariaLabel }: {
    ctx: RequestContext;
    cat: Category;
    f: InputField;
    value: unknown;
    invalid?: boolean;
    // Set when the visible <label> belongs to a parent row (e.g. a substat
    // slot's shared "Substat N" label) so this control still names itself.
    ariaLabel?: string;
  },
) {
  const name = `${cat.key}.${f.key}`;
  const v = value ?? "";

  if (f.type === "select") {
    // title shows the full selected value on hover (long substat options can
    // otherwise be clipped by a narrow select).
    return (
      <select id={name} name={name} title={v ? String(v) : undefined} aria-label={ariaLabel}>
        <option value="">—</option>
        {(f.options ?? []).map((o) => <option value={o} selected={o === v}>{o}</option>)}
      </select>
    );
  }
  if (f.type === "bool") {
    return <input id={name} type="checkbox" name={name} checked={!!v} aria-label={ariaLabel} />;
  }
  if (f.type === "text") {
    return <input id={name} type="text" name={name} value={String(v)} aria-label={ariaLabel} />;
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

// A small "level → value" input rendered ahead of a formula-backed field's
// value box. The companion client script (level_compute.ts) reads data-formula
// and writes the computed value into the value field (id = data-target). The
// level itself is posted as `<cat>.<key>_lvl` and recomputed server-side on save.
function LevelInput(
  { ctx, cat, f, level }: {
    ctx: RequestContext;
    cat: Category;
    f: InputField & { label: string; formula: Formula };
    level: unknown;
  },
) {
  const label = statLabel(ctx.t, cat.key, f.key, f.label);
  const lvlId = `${cat.key}.${f.key}_lvl`;
  return (
    <>
      <input
        type="text"
        inputmode="numeric"
        autocomplete="off"
        class="level"
        id={lvlId}
        name={lvlId}
        value={level === null || level === undefined ? "" : String(level)}
        data-formula={JSON.stringify(f.formula)}
        data-target={`${cat.key}.${f.key}`}
        data-unit={f.unit ?? "num"}
        placeholder={ctx.t("buildForm.levelPlaceholder", {
          default: "lvl 0–{max}",
          max: f.formula.maxLevel,
        })}
        aria-label={ctx.t("buildForm.levelFor", { default: "{stat} level", stat: label })}
      />
      {/* Most stats sit at max; one tap fills the level + computes the value. */}
      <button
        type="button"
        class="max-btn"
        data-max={lvlId}
        title={ctx.t("buildForm.maxLevelFor", { default: "Set {stat} to max level", stat: label })}
        aria-label={ctx.t("buildForm.maxLevelFor", {
          default: "Set {stat} to max level",
          stat: label,
        })}
      >
        {ctx.t("buildForm.maxLevel", { default: "Max" })}
      </button>
    </>
  );
}

function labelledField(
  ctx: RequestContext,
  cat: Category,
  f: InputField & { label: string },
  catData: Record<string, unknown>,
  invalid?: Set<string>,
) {
  const valueField = (
    <Field
      ctx={ctx}
      cat={cat}
      f={f}
      value={catData[f.key]}
      invalid={invalid?.has(`${cat.key}.${f.key}`)}
    />
  );
  // Formula-backed: prefill the level from the stored `_lvl`, or derive it from
  // a stored value (so builds saved before this feature still show a level).
  let body = valueField;
  if (f.formula) {
    const stored = catData[`${f.key}_lvl`];
    const v = catData[f.key];
    const level = stored ?? (typeof v === "number" ? levelFromValue(f.formula, v) : null);
    body = (
      <div class="level-field">
        <LevelInput ctx={ctx} cat={cat} f={{ ...f, formula: f.formula }} level={level} />
        {valueField}
      </div>
    );
  }
  return (
    <div>
      <label for={`${cat.key}.${f.key}`}>{statLabel(ctx.t, cat.key, f.key, f.label)}</label>
      {body}
    </div>
  );
}

// A module's Name field: a free-text input backed by a <datalist> of the named
// modules for its type (Cannon/Armor/…), plus a derived block showing the chosen
// module's Main Effect stat and Unique Effect — auto-filled from the catalog so
// the player never types them. The companion script (module_autofill.ts) keeps
// the derived block in sync as the name changes; this is its server-rendered
// initial state. Unknown/custom names simply show nothing (manual entry).
function moduleNameField(
  ctx: RequestContext,
  cat: Category,
  type: ModuleType,
  f: SchemaField,
  catData: Record<string, unknown>,
) {
  const id = `${cat.key}.${f.key}`;
  const listId = `mods-${type}`;
  const value = catData[f.key];
  const current = typeof value === "string" ? value : "";
  const mod = findModule(current);
  const label = statLabel(ctx.t, cat.key, f.key, f.label);
  const mainLabel = ctx.t("buildForm.moduleMainEffect", { default: "Main effect" });
  return (
    <div>
      <label for={id}>{label}</label>
      <input
        id={id}
        name={id}
        type="text"
        list={listId}
        autocomplete="off"
        value={current}
        data-module-name
        data-derived={`${id}__derived`}
      />
      <datalist id={listId}>
        {modulesByType(type).map((m) => <option value={m.name} />)}
      </datalist>
      <div class="mod-derived" id={`${id}__derived`}>
        <div class="mod-main">{mod?.mainEffect ? `${mainLabel}: ${mod.mainEffect}` : ""}</div>
        <div class="mod-uniq">{mod?.unique ?? ""}</div>
      </div>
    </div>
  );
}

// Render a module column's fields. The leading `_name` field becomes a catalog
// picker (datalist + derived effects); the six substat slots — each a
// `_sub<n>_rarity` + `_sub<n>_type` + `_sub<n>_val` triple — fold into one
// "Substat N" row and collapse into an optional <details> (substats are rolled
// noise for progression, so they're tucked away). Remaining head fields (rarity,
// level, main-effect value) render normally.
function groupFieldRows(
  ctx: RequestContext,
  cat: Category,
  groupKey: string,
  fields: SchemaField[],
  catData: Record<string, unknown>,
  invalid?: Set<string>,
) {
  const out = [];
  const substats = [];
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (f.key.endsWith("_name")) {
      out.push(moduleNameField(ctx, cat, groupKey as ModuleType, f, catData));
      continue;
    }
    const type = fields[i + 1];
    const val = fields[i + 2];
    if (/_sub\d+_rarity$/.test(f.key) && type && val) {
      const rowLabel = statLabel(ctx.t, cat.key, f.key, f.label);
      substats.push(
        <div>
          <label for={`${cat.key}.${f.key}`}>{rowLabel}</label>
          <div class="substat-row">
            <Field
              ctx={ctx}
              cat={cat}
              f={f}
              value={catData[f.key]}
              ariaLabel={`${rowLabel} rarity`}
            />
            <Field
              ctx={ctx}
              cat={cat}
              f={type}
              value={catData[type.key]}
              ariaLabel={`${rowLabel} effect`}
            />
            <Field
              ctx={ctx}
              cat={cat}
              f={val}
              value={catData[val.key]}
              ariaLabel={`${rowLabel} value`}
            />
          </div>
        </div>,
      );
      i += 2; // consumed the effect + value fields
    } else {
      out.push(labelledField(ctx, cat, f, catData, invalid));
    }
  }
  if (substats.length > 0) {
    // Open the collapse if any substat already holds data, so existing builds
    // don't hide their rolls.
    const filled = substats.length > 0 &&
      fields.some((f) => /_sub\d+_/.test(f.key) && hasValue(catData[f.key]));
    out.push(
      <details class="substats" open={filled}>
        <summary>{ctx.t("buildForm.substats", { default: "Substats (optional)" })}</summary>
        {substats}
      </details>,
    );
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
            {groupFieldRows(ctx, cat, k, g.fields, catData, invalid)}
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
  // Two stacked groups mirroring the in-game Upgrade / Enhance tabs: all
  // upgrades first (a full grid, no sparse gaps), then just the enhancements.
  // DOM order keeps upgrades tab-first, matching the in-game screen.
  const enhanced = cat.fields.filter((f) => f.enhancement);
  return (
    <>
      <div class="sub-hdr">{t("buildForm.upgrade")}</div>
      <div class="grid">
        {cat.fields.map((f) => labelledField(ctx, cat, f, catData, invalid))}
      </div>
      {enhanced.length > 0
        ? (
          <>
            <div class="sub-hdr enh">{t("buildForm.enhancement")}</div>
            <div class="grid">
              {enhanced.map((f) => labelledField(ctx, cat, f.enhancement!, catData, invalid))}
            </div>
          </>
        )
        : null}
    </>
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

  // Section-level "Max all" — only where there are formula-backed fields to max
  // (most stats sit at max level, so this is the common one-tap path).
  const hasFormula = cat.fields.some((f) => f.formula || f.enhancement?.formula);

  // Open sections that already hold data; collapse empty ones so a fresh form
  // isn't a wall of inputs.
  return (
    <details class="section" open={filled > 0}>
      <summary>
        <span>{title}</span>
        <span class="count">{filled}/{keys.length}</span>
      </summary>
      <div class="section-body">
        {hasFormula
          ? (
            <div class="section-tools">
              <button type="button" class="max-btn" data-max-section>
                {t("buildForm.maxAll", { default: "Max all" })}
              </button>
            </div>
          )
          : null}
        {body}
      </div>
    </details>
  );
}
