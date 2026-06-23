// builds.tsx — build form, history list, and schema-driven detail view.
// All chrome + game labels go through ctx.t.

import type { VNode } from "preact";
import type { Build } from "../../db/db.ts";
import { type Category, type Field as SchemaField, STAT_SCHEMA } from "../stat_schema.ts";
import { type BuildLine, buildLines } from "../build_lineage.ts";
import type { NumUnit } from "../num_format.ts";
import type { RequestContext } from "../services/ctx.ts";
import type { Formatter } from "../services/format.ts";
import { Section } from "./fields.tsx";
import { Onboard } from "./onboard.tsx";
import { AUTOSAVE_JS } from "./draft_autosave.ts";
import { HIGHLIGHT_JS } from "./changed_highlight.ts";
import { LEVEL_COMPUTE_JS } from "./level_compute.ts";
import { MODULE_AUTOFILL_JS } from "./module_autofill.ts";
import { AI_ANALYZE_JS } from "./ai_analyze.ts";
import { AI_MODELS, DEFAULT_MODEL } from "../services/ai.ts";
import { findModule, MODULE_CATALOG } from "../module_catalog.ts";

// Inline client-side draft autosave for the build form (the app's only client
// JS). Banner strings are passed via window.__draftI18n so they stay
// translatable. JSON is `<`-escaped so a translation can't break out of <script>.
function DraftAutosave({ ctx }: { ctx: RequestContext }) {
  const { t } = ctx;
  const i18n = JSON.stringify({
    prompt: t("draft.prompt"),
    restore: t("draft.restore"),
    discard: t("draft.discard"),
  }).replace(/</g, "\\u003c");
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: `window.__draftI18n=${i18n};` }} />
      <script dangerouslySetInnerHTML={{ __html: AUTOSAVE_JS }} />
    </>
  );
}

// Serialize the named-module catalog + its one label to the client so
// module_autofill.ts can fill a module's Main/Unique Effect from its name. JSON
// is `<`-escaped so catalog text can't break out of the <script>.
function ModuleCatalog({ ctx }: { ctx: RequestContext }) {
  const data = JSON.stringify(MODULE_CATALOG).replace(/</g, "\\u003c");
  const i18n = JSON.stringify({
    mainLabel: ctx.t("buildForm.moduleMainEffect", { default: "Main effect" }),
  }).replace(/</g, "\\u003c");
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `window.__moduleCatalog=${data};window.__moduleI18n=${i18n};`,
      }}
    />
  );
}

// AiAnalyze — the bring-your-own-key build analysis widget. Both the key form
// and the analyze controls are rendered server-side; ai_analyze.ts toggles
// between them based on whether a key is in this browser's localStorage. The
// key never reaches our server except as a header it forwards once to Anthropic.
// Config + strings ride on window.__ai / window.__aiI18n; JSON is `<`-escaped so
// catalog text can't break out of the <script>.
function AiAnalyze({ ctx, buildId }: { ctx: RequestContext; buildId: number }) {
  const { base, t } = ctx;
  const esc = (o: unknown) => JSON.stringify(o).replace(/</g, "\\u003c");
  const cfg = esc({ endpoint: `${base}/ai/analyze`, buildId, defaultModel: DEFAULT_MODEL });
  const i18n = esc({
    usingKey: t("ai.usingKey", { default: "Using key" }),
    keyRequired: t("ai.keyRequired", { default: "Enter a key." }),
    storeFailed: t("ai.storeFailed", { default: "Couldn't store the key in this browser." }),
    run: t("ai.run", { default: "Analyze this build" }),
    analyzing: t("ai.analyzing", { default: "Analyzing…" }),
    working: t("ai.working", {
      default: "Analyzing your build — this can take up to a minute.",
    }),
    genericError: t("ai.error.generic", { default: "Analysis failed. Try again." }),
    networkError: t("ai.error.network", { default: "Couldn't reach the server. Try again." }),
  });
  return (
    <section class="ai-panel" data-ai-panel aria-labelledby="ai-h">
      <h3 id="ai-h" class="ai-h">{t("ai.heading", { default: "AI analysis" })}</h3>
      <noscript>
        <p class="hint">{t("ai.noscript", { default: "AI analysis needs JavaScript enabled." })}</p>
      </noscript>
      <div data-ai-keyform hidden>
        <p class="hint">
          {t("ai.keyIntro", {
            default:
              "Bring your own Anthropic API key. It's stored only in this browser and forwarded to Anthropic for one request at a time — never saved on this site.",
          })}
        </p>
        <div class="ai-keyrow">
          <input
            type="password"
            data-ai-keyinput
            autocomplete="off"
            spellcheck={false}
            placeholder="sk-ant-…"
            aria-label={t("ai.keyLabel", { default: "Anthropic API key" })}
          />
          <button type="button" data-ai-save>{t("ai.saveKey", { default: "Save key" })}</button>
        </div>
        <p class="hint ai-err" data-ai-keyerror role="alert"></p>
      </div>
      <div data-ai-ready hidden>
        <div class="ai-controls">
          <button type="button" data-ai-run>
            {t("ai.run", { default: "Analyze this build" })}
          </button>
          <select data-ai-model aria-label={t("ai.modelLabel", { default: "Model" })}>
            {AI_MODELS.map((m) => <option value={m.id}>{m.label}</option>)}
          </select>
          <button type="button" class="ai-link" data-ai-forget>
            {t("ai.forgetKey", { default: "Forget key" })}
          </button>
          <span class="hint" data-ai-keyhint></span>
        </div>
        <div class="ai-output" data-ai-output aria-live="polite"></div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: `window.__ai=${cfg};window.__aiI18n=${i18n};` }} />
      <script dangerouslySetInnerHTML={{ __html: AI_ANALYZE_JS }} />
    </section>
  );
}

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
  // "Level up" mode: cloning the current build into the next snapshot in the
  // same line (after a run, when you spend coins). Unlike a respec it carries
  // the name forward unchanged. Carried as a hidden field so it survives POST.
  level?: boolean;
}

export function BuildForm({ ctx, opts = {} }: { ctx: RequestContext; opts?: BuildFormOpts }) {
  const { base, t } = ctx;
  const isEdit = opts.editId !== undefined;
  const action = isEdit ? `${base}/builds/${opts.editId}` : `${base}/builds`;
  // Highlight edited fields only when the form is prefilled (edit / respec),
  // not on a blank new build or a validation re-render.
  const highlight = opts.build !== undefined && !opts.submittedData;
  const data: Record<string, Record<string, unknown>> = opts.submittedData ?? opts.build?.data ??
    {};
  const parentId = opts.parentId ?? "";
  const invalid = opts.invalidKeys ? new Set(opts.invalidKeys) : undefined;
  const labelValue = opts.submittedLabel !== undefined
    ? opts.submittedLabel
    : isEdit
    ? (opts.build?.label ?? "")
    // Leveling keeps the line's name; a respec marks itself as one.
    : (opts.build ? (opts.level ? opts.build.label : `${opts.build.label} (respec)`) : "");
  const noteValue = opts.submittedNote !== undefined
    ? opts.submittedNote
    : (isEdit ? (opts.build?.note ?? "") : "");

  const introNote = isEdit
    ? <p class="hint">{t("buildForm.editing", { id: opts.editId! })}</p>
    : opts.level && opts.build && !opts.submittedData
    ? <p class="hint">{t("buildForm.leveling", { id: opts.build.id })}</p>
    : opts.build && !opts.submittedData
    ? <p class="hint">{t("buildForm.cloned", { id: opts.build.id })}</p>
    : (
      <p class="hint">
        {t("buildForm.newSnapshotLead")}{" "}
        <a href={`${base}/builds/new?from=latest`} style="color:var(--accent-text)">
          {t("buildForm.respec")}
        </a>.
      </p>
    );

  return (
    <>
      <form method="post" action={action} data-highlight-changes={highlight ? "1" : undefined}>
        {isEdit ? null : <input type="hidden" name="parent_build_id" value={String(parentId)} />}
        {opts.level ? <input type="hidden" name="level" value="1" /> : null}
        {opts.error
          ? <p id="form-error" class="hint" style="color:var(--error)" role="alert">{opts.error}</p>
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
      <DraftAutosave ctx={ctx} />
      <script dangerouslySetInnerHTML={{ __html: HIGHLIGHT_JS }} />
      <script dangerouslySetInnerHTML={{ __html: LEVEL_COMPUTE_JS }} />
      <ModuleCatalog ctx={ctx} />
      <script dangerouslySetInnerHTML={{ __html: MODULE_AUTOFILL_JS }} />
    </>
  );
}

export function BuildsList({ ctx, builds }: { ctx: RequestContext; builds: Build[] }) {
  const { base, t, fmt } = ctx;
  if (builds.length === 0) {
    return (
      <Onboard
        title={t("onboarding.buildsTitle")}
        body={t("onboarding.buildsBody")}
        primary={{ href: `${base}/builds/new`, label: t("onboarding.buildsCta") }}
        secondary={{ href: `${base}/reports/new`, label: t("onboarding.buildsSecondary") }}
      />
    );
  }
  const lines = buildLines(builds);
  const noteById = new Map(builds.map((b) => [b.id, b.note]));
  return (
    <>
      <div class="list-actions">
        <a class="btn" href={`${base}/builds/new`}>{t("list.newBuild")}</a>
      </div>
      <table class="responsive">
        <caption class="sr-only">{t("buildsList.caption")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("buildsList.thBuild")}</th>
            <th scope="col">{t("buildsList.thSnapshots")}</th>
            <th scope="col">{t("buildsList.thNote")}</th>
            <th scope="col">{t("buildsList.thSaved")}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr>
              <td data-label={t("buildsList.thBuild")}>
                <a href={`${base}/builds/${line.head.id}`}>
                  {line.head.label} <span class="hint">· v{line.head.version}</span>
                </a>
              </td>
              <td data-label={t("buildsList.thSnapshots")}>{fmt.integer(line.count)}</td>
              <td class="hint" data-label={t("buildsList.thNote")}>
                {noteById.get(line.head.id) ?? ""}
              </td>
              <td class="hint" data-label={t("buildsList.thSaved")}>
                {fmt.dateTime(line.head.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
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
  { ctx, cat, data, changed }: {
    ctx: RequestContext;
    cat: Category;
    data: Record<string, Record<string, unknown>>;
    changed?: Set<string>;
  },
): VNode | null {
  const { t } = ctx;
  const catData = (data[cat.key] as Record<string, unknown> | undefined) ?? {};
  const rows: VNode[] = [];
  const th = "width:200px;font-weight:normal;color:var(--muted)";
  const skip = new Set<string>(); // substat `_type`/`_val` keys folded into their `_rarity` row

  // One detail row, with an accent dot when the value changed from the parent.
  const row = (label: string, value: string, isChanged: boolean) =>
    rows.push(
      <tr>
        <th scope="row" style={th}>
          {isChanged
            ? (
              <>
                <span style="color:var(--accent-text);margin-right:.35rem" aria-hidden="true">
                  ●
                </span>
                <span class="sr-only">{t("buildDetail.changedSr")}</span>
              </>
            )
            : null}
          {label}
        </th>
        <td style="font-family:var(--mono)">{value}</td>
      </tr>,
    );

  for (const f of cat.fields as SchemaField[]) {
    if (skip.has(f.key)) continue;

    // Module substat: fold rarity + effect + value into one row, e.g.
    // "Mythic Defense % +6%". Anchored on the leading `_rarity` field.
    const subMatch = /_sub\d+_rarity$/.test(f.key);
    if (subMatch) {
      const typeKey = f.key.replace(/_rarity$/, "_type");
      const valKey = f.key.replace(/_rarity$/, "_val");
      skip.add(typeKey);
      skip.add(valKey);
      const present = (v: unknown) => v !== undefined && v !== null && v !== "";
      const rarityV = catData[f.key];
      const typeV = catData[typeKey];
      const valV = catData[valKey];
      if (present(rarityV) || present(typeV) || present(valV)) {
        const value = [rarityV, typeV, valV].filter(present).join(" ");
        const label = `${t(`mod.${f.group!.key}`, { default: f.group!.label })} — ${
          t(`stat.${cat.key}.${f.key}`, { default: f.label })
        }`;
        const isChanged = !!changed &&
          (changed.has(`${cat.key}.${f.key}`) || changed.has(`${cat.key}.${typeKey}`) ||
            changed.has(`${cat.key}.${valKey}`));
        row(label, value, isChanged);
      }
      continue;
    }

    const v = displayValue(ctx.fmt, f, catData[f.key]);
    if (v !== null) {
      const base = t(`stat.${cat.key}.${f.key}`, { default: f.label });
      const label = f.group
        ? `${t(`mod.${f.group.key}`, { default: f.group.label })} — ${base}`
        : base;
      row(label, v, !!changed && changed.has(`${cat.key}.${f.key}`));
      // For a catalogued module Name, surface its fixed Unique Effect (derived,
      // not stored) right under the name.
      if (f.key.endsWith("_name")) {
        const mod = findModule(typeof catData[f.key] === "string" ? catData[f.key] as string : "");
        if (mod) {
          row(t("buildDetail.uniqueEffect"), mod.unique, false);
        }
      }
    }
    if (f.enhancement) {
      const ev = displayValue(ctx.fmt, f.enhancement, catData[f.enhancement.key]);
      if (ev !== null) {
        const elabel = t(`stat.${cat.key}.${f.enhancement.key}`, { default: f.enhancement.label });
        row(elabel, ev, !!changed && changed.has(`${cat.key}.${f.enhancement.key}`));
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

function LineHistory({ ctx, b, line }: { ctx: RequestContext; b: Build; line: BuildLine }) {
  const { base, t } = ctx;
  if (line.count < 2) return null;
  return (
    <details class="line-history" open>
      <summary>{t("buildDetail.lineHistory", { count: line.count })}</summary>
      <ol class="line-snaps">
        {line.snapshots.map((s) => (
          <li>
            {s.id === b.id
              ? <strong>v{s.version} · {ctx.fmt.dateTime(s.created_at)} ←</strong>
              : (
                <a href={`${base}/builds/${s.id}`}>
                  v{s.version} · {ctx.fmt.dateTime(s.created_at)}
                </a>
              )}
          </li>
        ))}
      </ol>
    </details>
  );
}

export function BuildDetail(
  { ctx, b, changed, parentId, line }: {
    ctx: RequestContext;
    b: Build;
    changed?: Set<string>;
    parentId?: number;
    line?: BuildLine;
  },
) {
  const { base, t } = ctx;
  const sections = STAT_SCHEMA
    .map((cat) => <DetailSection ctx={ctx} cat={cat} data={b.data} changed={changed} />)
    .filter((s): s is VNode => s !== null);
  return (
    <>
      <p style="display:flex;gap:1.25rem;flex-wrap:wrap;font-family:var(--mono)">
        <a href={`${base}/builds/new?from=${b.id}&level=1`} style="color:var(--accent-text)">
          {t("buildDetail.levelUp")}
        </a>
        <a href={`${base}/builds/new?from=${b.id}`} style="color:var(--accent-text)">
          {t("buildDetail.respecFrom")}
        </a>
        <a href={`${base}/builds/${b.id}/edit`} style="color:var(--accent-text)">
          {t("buildDetail.edit")}
        </a>
      </p>
      {line ? <LineHistory ctx={ctx} b={b} line={line} /> : null}
      {changed && changed.size > 0 && parentId
        ? (
          <p class="hint">
            <span style="color:var(--accent-text)" aria-hidden="true">●</span>{" "}
            {t("buildDetail.changedLegend", { id: parentId })}
          </p>
        )
        : null}
      {sections.length ? sections : <p class="hint">{t("buildDetail.noStats")}</p>}
      <AiAnalyze ctx={ctx} buildId={b.id} />
      <details style="margin-top:1rem;">
        <summary class="hint" style="cursor:pointer;font-family:var(--mono);font-size:.78rem;">
          {t("buildDetail.rawData")}
        </summary>
        <pre style="margin-top:.5rem">{JSON.stringify(b.data, null, 2)}</pre>
      </details>
    </>
  );
}
