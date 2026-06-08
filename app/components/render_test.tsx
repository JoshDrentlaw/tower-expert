// render_test.tsx — the component layer renders the schema correctly, with no
// server or DB. Guards the JSX migration (and future schema/layout changes).

import { assertStringIncludes } from "@std/assert";
import { renderToString } from "preact-render-to-string";
import { makeFormatter } from "../services/format.ts";
import { makeT } from "../i18n/index.ts";
import type { RequestContext } from "../services/ctx.ts";
import { BuildForm } from "./builds.tsx";
import { Layout } from "./Layout.tsx";

function ctxFor(locale: string): RequestContext {
  return { base: "/tower", locale, t: makeT(locale), fmt: makeFormatter(locale) };
}
const ctx = ctxFor("en");

Deno.test("BuildForm renders the schema: fields, all 9 UW sections, module columns", () => {
  const html = renderToString(<BuildForm ctx={ctx} opts={{}} />);
  assertStringIncludes(html, 'action="/tower/builds"');
  assertStringIncludes(html, 'name="workshop_attack.damage"');
  assertStringIncludes(html, "UW — Golden Tower");
  assertStringIncludes(html, "UW — Chrono Field"); // the 9th, newly-added UW
  assertStringIncludes(html, 'class="mod-col"');
  assertStringIncludes(html, 'name="modules.cannon_sub6"'); // 6th substat slot
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

Deno.test("BuildForm renders translated chrome + game labels under es locale", () => {
  const html = renderToString(<BuildForm ctx={ctxFor("es")} opts={{}} />);
  assertStringIncludes(html, "Guardar snapshot"); // buildForm.save
  assertStringIncludes(html, "Daño"); // stat label translated
  assertStringIncludes(html, "Taller — Ataque"); // category title translated
  assertStringIncludes(html, "Cañón"); // module group label translated
  // Untranslated stat keys fall back to the English schema label:
  assertStringIncludes(html, "Rend Armor Chance");
});
