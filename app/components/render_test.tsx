// render_test.tsx — the component layer renders the schema correctly, with no
// server or DB. Guards the JSX migration (and future schema/layout changes).

import { assert, assertStringIncludes } from "@std/assert";
import { renderToString } from "preact-render-to-string";
import { makeFormatter } from "../services/format.ts";
import { makeT } from "../i18n/index.ts";
import type { RequestContext } from "../services/ctx.ts";
import type { Build } from "../../db/db.ts";
import { BuildDetail, BuildForm } from "./builds.tsx";
import { Layout } from "./Layout.tsx";

function ctxFor(locale: string, path = "/tower/builds/new"): RequestContext {
  return { base: "/tower", locale, path, t: makeT(locale), fmt: makeFormatter(locale) };
}
const ctx = ctxFor("en");

Deno.test("BuildForm renders the schema: fields, all 9 UW sections, module columns", () => {
  const html = renderToString(<BuildForm ctx={ctx} opts={{}} />);
  assertStringIncludes(html, 'action="/tower/builds"');
  assertStringIncludes(html, 'name="workshop_attack.damage"');
  assertStringIncludes(html, "UW — Golden Tower");
  assertStringIncludes(html, "UW — Chrono Field"); // the 9th, newly-added UW
  assertStringIncludes(html, 'class="mod-col"');
  assertStringIncludes(html, 'name="modules.cannon_sub6_type"'); // 6th substat picker
  assertStringIncludes(html, 'name="modules.cannon_sub6_val"'); // its value field
  assertStringIncludes(html, 'class="substat-row"');
  assertStringIncludes(html, '<option value="Crit Chance">'); // cannon substat pool option
});

Deno.test("BuildForm echoes a submitted value back in the field's human format", () => {
  const html = renderToString(
    <BuildForm ctx={ctx} opts={{ submittedData: { workshop_attack: { damage: 869030000 } } }} />,
  );
  assertStringIncludes(html, 'value="869.03M"');
});

Deno.test("BuildForm shows an error banner with role=alert", () => {
  const html = renderToString(<BuildForm ctx={ctx} opts={{ error: "Label is required." }} />);
  assertStringIncludes(html, 'role="alert"');
  assertStringIncludes(html, "Label is required.");
});

Deno.test("BuildForm: sections collapse by default, open when they hold data", () => {
  const empty = renderToString(<BuildForm ctx={ctx} opts={{}} />);
  assertStringIncludes(empty, 'class="section"');
  assertStringIncludes(empty, 'class="count"');
  assert(
    !empty.includes('<details class="section" open>'),
    "empty new build: all sections collapsed",
  );

  const withData = renderToString(
    <BuildForm ctx={ctx} opts={{ submittedData: { workshop_attack: { damage: 1000000 } } }} />,
  );
  assertStringIncludes(withData, '<details class="section" open>');
});

Deno.test("BuildForm enables change-highlighting only on a prefilled (edit/respec) form", () => {
  const build = {
    id: 7,
    label: "x",
    note: null,
    parent_build_id: null,
    data: {},
    created_at: "",
  } as unknown as Build;
  assertStringIncludes(
    renderToString(<BuildForm ctx={ctx} opts={{ build, editId: 7 }} />),
    'data-highlight-changes="1"',
  );
  assertStringIncludes(
    renderToString(<BuildForm ctx={ctx} opts={{ build, parentId: 7 }} />),
    'data-highlight-changes="1"',
  );
  // (the script body references the attribute selector, so check the rendered
  // attribute form specifically)
  assert(
    !renderToString(<BuildForm ctx={ctx} opts={{}} />).includes('data-highlight-changes="1"'),
    "blank new build should not highlight",
  );
});

Deno.test("BuildForm injects the draft-autosave script with translatable banner strings", () => {
  const en = renderToString(<BuildForm ctx={ctx} opts={{}} />);
  assertStringIncludes(en, "window.__draftI18n");
  assertStringIncludes(en, "tower:draft:"); // the autosave script body
  assertStringIncludes(en, '"restore":"Restore"');
  const es = renderToString(<BuildForm ctx={ctxFor("es")} opts={{}} />);
  assertStringIncludes(es, '"restore":"Restaurar"');
});

Deno.test("BuildDetail marks changed stats and shows the diff legend (respec)", () => {
  const b = {
    id: 2,
    label: "Resp",
    note: null,
    parent_build_id: 1,
    data: { workshop_attack: { damage: 2000000 } },
    created_at: "",
  } as unknown as Build;
  const html = renderToString(
    <BuildDetail ctx={ctx} b={b} changed={new Set(["workshop_attack.damage"])} parentId={1} />,
  );
  assertStringIncludes(html, "changed from build #1");
  assertStringIncludes(html, "●");
});

Deno.test("Layout: nav omits respec and marks the active section", () => {
  const html = renderToString(
    <Layout ctx={ctxFor("en", "/tower/builds")} title="t" heading="Builds">
      <p>x</p>
    </Layout>,
  );
  assert(!html.includes('href="/tower/builds/new?from=latest"'), "respec link removed from nav");
  assertStringIncludes(html, 'href="/tower/builds" aria-current="page"');
});

Deno.test("Layout: skip link, <main> landmark, labeled nav, sr-only heading", () => {
  const html = renderToString(
    <Layout ctx={ctx} title="t" heading="Builds">
      <p>x</p>
    </Layout>,
  );
  assertStringIncludes(html, 'class="skip-link"');
  assertStringIncludes(html, '<main id="main-content"');
  assertStringIncludes(html, 'aria-label="Main navigation"');
  assertStringIncludes(html, 'class="sr-only">Builds</h2>');
});

Deno.test("BuildForm: parse-failed fields are aria-invalid and point at the error banner", () => {
  const html = renderToString(
    <BuildForm ctx={ctx} opts={{ error: "bad", invalidKeys: ["workshop_attack.damage"] }} />,
  );
  assertStringIncludes(html, 'id="form-error"');
  assertStringIncludes(html, 'aria-invalid="true"');
  assertStringIncludes(html, 'aria-describedby="form-error"');
});

Deno.test("BuildForm in edit mode posts to the build, prefills label/note, drops parent input", () => {
  const build = {
    id: 7,
    label: "Mixed",
    note: "leveling",
    parent_build_id: null,
    data: {},
    created_at: "",
  } as unknown as Build;
  const html = renderToString(<BuildForm ctx={ctx} opts={{ build, editId: 7 }} />);
  assertStringIncludes(html, 'action="/tower/builds/7"');
  assertStringIncludes(html, 'value="Mixed"'); // label prefilled, no "(respec)" suffix
  assertStringIncludes(html, 'value="leveling"'); // existing note prefilled
  assertStringIncludes(html, "Save changes");
  assert(!html.includes('name="parent_build_id"'), "edit mode must not emit parent_build_id");
});

Deno.test("BuildForm renders translated chrome + game labels under es locale", () => {
  const html = renderToString(<BuildForm ctx={ctxFor("es")} opts={{}} />);
  assertStringIncludes(html, "Guardar snapshot"); // buildForm.save
  assertStringIncludes(html, "Daño"); // stat label translated
  assertStringIncludes(html, "Taller — Ataque"); // category title translated
  assertStringIncludes(html, "Cañón"); // module group label translated
  // Untranslated stat keys fall back to the English schema label:
  assertStringIncludes(html, "Rend Armor Chance");
});
