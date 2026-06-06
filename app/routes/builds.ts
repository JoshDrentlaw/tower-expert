// routes/builds.ts — request handlers for the build lifecycle.

import { Build, getBuild, getLatestBuild, insertBuild, listBuilds } from "../../db/db.ts";
import { coerce, STAT_SCHEMA } from "../stat_schema.ts";
import { buildDetail, buildForm, buildsList, layout } from "../views.ts";

function html(base: string, title: string, body: string, status = 200): Response {
  return new Response(layout(base, title, body), {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

// GET {base}/builds  — history
export async function handleList(base: string): Promise<Response> {
  const builds = await listBuilds();
  return html(base, "Tower // Builds", buildsList(base, builds));
}

// GET {base}/builds/new          — blank form
// GET {base}/builds/new?from=latest | ?from=<id>  — prefilled for respec
export async function handleNew(base: string, url: URL): Promise<Response> {
  const from = url.searchParams.get("from");
  let build: Build | undefined;
  if (from === "latest") build = await getLatestBuild();
  else if (from && /^\d+$/.test(from)) build = await getBuild(Number(from));

  return html(
    base,
    "Tower // New Build",
    buildForm(base, build ? { build, parentId: build.id } : {}),
  );
}

// POST {base}/builds  — save a new snapshot
export async function handleSave(base: string, req: Request): Promise<Response> {
  const form = await req.formData();

  const label = (form.get("label") as string | null)?.trim();
  if (!label) {
    return html(
      base,
      "Tower // New Build",
      `<p class="hint" style="color:#e88">Label is required.</p>` + buildForm(base),
      400,
    );
  }

  const note = (form.get("note") as string | null)?.trim() || null;
  const parentRaw = form.get("parent_build_id") as string | null;
  const parent_build_id = parentRaw && /^\d+$/.test(parentRaw) ? Number(parentRaw) : null;

  // Assemble data[category][field] from the schema so we only persist known
  // fields and coerce each to its declared type.
  const data: Record<string, Record<string, unknown>> = {};
  for (const cat of STAT_SCHEMA) {
    const section: Record<string, unknown> = {};
    for (const f of cat.fields) {
      const raw = form.get(`${cat.key}.${f.key}`) as string | null;
      const value = coerce(f.type, raw);
      if (value !== null) section[f.key] = value;

      if (f.enhancement) {
        const enhRaw = form.get(`${cat.key}.${f.enhancement.key}`) as string | null;
        const enhValue = coerce(f.enhancement.type, enhRaw);
        if (enhValue !== null) section[f.enhancement.key] = enhValue;
      }
    }
    if (Object.keys(section).length > 0) data[cat.key] = section;
  }

  const id = await insertBuild({ label, note, parent_build_id, data });
  return Response.redirect(new URL(`${base}/builds/${id}`, req.url), 303);
}

// GET {base}/builds/:id  — detail (raw snapshot for now)
export async function handleDetail(base: string, id: number): Promise<Response> {
  const build = await getBuild(id);
  if (!build) return html(base, "Not found", `<p class="hint">No build #${id}.</p>`, 404);
  return html(base, `Tower // #${id} ${build.label}`, buildDetail(base, build));
}
