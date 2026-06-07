// fields.tsx — the schema-driven form pieces: a single input (Field) and the
// three category layouts (flat grid / paired upgrade+enhancement / grouped
// columns). Ported 1:1 from views.ts (fieldInput, renderSection,
// renderGroupedSection); JSX handles escaping.

import { formatNum, type NumUnit } from "../num_format.ts";
import type { Category, Field as SchemaField, FieldType } from "../stat_schema.ts";

// Hint shown in empty numeric inputs, by unit — teaches the accepted shorthand.
const NUM_PLACEHOLDER: Record<NumUnit, string> = {
  num: "e.g. 869.03M",
  mult: "e.g. ×1.012",
  pct: "e.g. 56.4%",
  sec: "e.g. 14s",
};

type InputField = { key: string; type: FieldType; unit?: NumUnit; options?: string[] };

export function Field({ cat, f, value }: { cat: Category; f: InputField; value: unknown }) {
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

  // Numeric (int/number): a TEXT input that accepts game shorthand; the stored
  // value is echoed back in the same human format.
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
      inputmode="text"
      autocomplete="off"
      autocapitalize="off"
      spellcheck={false}
      name={name}
      value={display}
      placeholder={NUM_PLACEHOLDER[unit]}
    />
  );
}

function GroupedSection({ cat, catData }: { cat: Category; catData: Record<string, unknown> }) {
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
      <legend>{cat.title}</legend>
      <div class="mod-grid">
        {order.map((k) => {
          const g = byGroup.get(k)!;
          return (
            <div class="mod-col">
              <div class="col-hdr">{g.label}</div>
              {g.fields.map((f) => (
                <div>
                  <label for={`${cat.key}.${f.key}`}>{f.label}</label>
                  <Field cat={cat} f={f} value={catData[f.key]} />
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
  { cat, data }: { cat: Category; data: Record<string, Record<string, unknown>> },
) {
  const catData = (data[cat.key] as Record<string, unknown> | undefined) ?? {};

  if (cat.fields.some((f) => f.group)) return <GroupedSection cat={cat} catData={catData} />;

  const hasEnhancements = cat.fields.some((f) => f.enhancement);
  if (!hasEnhancements) {
    return (
      <fieldset>
        <legend>{cat.title}</legend>
        <div class="grid">
          {cat.fields.map((f) => (
            <div>
              <label for={`${cat.key}.${f.key}`}>{f.label}</label>
              <Field cat={cat} f={f} value={catData[f.key]} />
            </div>
          ))}
        </div>
      </fieldset>
    );
  }

  // Upgrades in col 1 (DOM-first = tab-first), enhancements in col 2.
  return (
    <fieldset>
      <legend>{cat.title}</legend>
      <div class="paired-grid">
        <div class="col-hdr" style="grid-column:1;grid-row:1">Upgrade</div>
        <div class="col-hdr" style="grid-column:2;grid-row:1">Enhancement ×</div>
        {cat.fields.map((f, i) => (
          <div style={`grid-column:1;grid-row:${i + 2}`}>
            <label for={`${cat.key}.${f.key}`}>{f.label}</label>
            <Field cat={cat} f={f} value={catData[f.key]} />
          </div>
        ))}
        {cat.fields.map((f, i) =>
          f.enhancement
            ? (
              <div style={`grid-column:2;grid-row:${i + 2}`}>
                <label for={`${cat.key}.${f.enhancement.key}`}>{f.enhancement.label}</label>
                <Field cat={cat} f={f.enhancement} value={catData[f.enhancement.key]} />
              </div>
            )
            : null
        )}
      </div>
    </fieldset>
  );
}
