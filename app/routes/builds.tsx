// routes/builds.tsx — request handlers for the build lifecycle.

import type { VNode } from "preact";
import { type Build, getBuild, getLatestBuild, insertBuild, listBuilds } from "../../db/db.ts";
import { coerce, type FieldType, STAT_SCHEMA } from "../stat_schema.ts";
import type { NumUnit } from "../num_format.ts";
import type { RequestContext } from "../services/ctx.ts";
import { renderPage } from "../services/render.tsx";
import { Layout } from "../components/Layout.tsx";
import { BuildDetail, BuildForm, BuildsList } from "../components/builds.tsx";

const isNumeric = (t: FieldType) => t === "int" || t === "number";

// Maximum character length for a build label. Keeps the DB row sane and
// prevents label text from overflowing list-view table cells.
const MAX_LABEL_LENGTH = 200;

function page(ctx: RequestContext, title: string, body: VNode, status = 200): Response {
  return renderPage(<Layout ctx={ctx} title={title}>{body}</Layout>, status);
}

// GET {base}/builds  — history
export async function handleList(ctx: RequestContext): Promise<Response> {
  const builds = await listBuilds();
  return page(ctx, "Tower // Builds", <BuildsList ctx={ctx} builds={builds} />);
}

// GET {base}/builds/new          — blank form
// GET {base}/builds/new?from=latest | ?from=<id>  — prefilled for respec
export async function handleNew(ctx: RequestContext, url: URL): Promise<Response> {
  const from = url.searchParams.get("from");
  let build: Build | undefined;
  if (from === "latest") build = await getLatestBuild();
  else if (from && /^\d+$/.test(from)) build = await getBuild(Number(from));

  return page(
    ctx,
    "Tower // New Build",
    <BuildForm ctx={ctx} opts={build ? { build, parentId: build.id } : {}} />,
  );
}

// POST {base}/builds  — save a new snapshot
export async function handleSave(ctx: RequestContext, req: Request): Promise<Response> {
  const form = await req.formData();

  const labelRaw = (form.get("label") as string | null)?.trim();
  const note = (form.get("note") as string | null)?.trim() || null;
  const parentRaw = form.get("parent_build_id") as string | null;
  const parent_build_id = parentRaw && /^\d+$/.test(parentRaw) ? Number(parentRaw) : null;

  // Assemble data[category][field] from the schema. A numeric field whose input
  // is non-empty but unparseable is collected in `failed` (and echoed back)
  // rather than silently dropped.
  const data: Record<string, Record<string, unknown>> = {};
  const failed: string[] = [];
  for (const cat of STAT_SCHEMA) {
    const section: Record<string, unknown> = {};
    const take = (key: string, type: FieldType, unit: NumUnit | undefined, label: string) => {
      const raw = form.get(`${cat.key}.${key}`) as string | null;
      const value = coerce(type, raw, unit);
      if (value !== null) {
        section[key] = value;
      } else if (isNumeric(type) && raw !== null && raw.trim() !== "") {
        failed.push(label);
        section[key] = raw; // echo the bad input back into the re-rendered field
      }
    };
    for (const f of cat.fields) {
      take(f.key, f.type, f.unit, f.label);
      if (f.enhancement) {
        take(f.enhancement.key, f.enhancement.type, f.enhancement.unit, f.enhancement.label);
      }
    }
    if (Object.keys(section).length > 0) data[cat.key] = section;
  }

  const errors: string[] = [];
  if (!labelRaw) {
    errors.push("Label is required.");
  } else if (labelRaw.length > MAX_LABEL_LENGTH) {
    errors.push(`Label is too long (max ${MAX_LABEL_LENGTH} characters).`);
  }
  if (failed.length > 0) {
    errors.push(
      `Couldn't read these fields, so nothing was saved for them: ${failed.join(", ")}. ` +
        `Enter values the way the game shows them — e.g. 869.03M, 56.4%, ×1.012, 14s.`,
    );
  }

  if (errors.length > 0) {
    const status = labelRaw && failed.length === 0 ? 422 : 400;
    return page(
      ctx,
      "Tower // New Build",
      <BuildForm
        ctx={ctx}
        opts={{
          parentId: parent_build_id ?? undefined,
          error: errors.join(" "),
          submittedLabel: labelRaw ?? "",
          submittedNote: note ?? "",
          submittedData: data,
        }}
      />,
      status,
    );
  }

  const id = await insertBuild({ label: labelRaw!, note, parent_build_id, data });
  return Response.redirect(new URL(`${ctx.base}/builds/${id}`, req.url), 303);
}

// GET {base}/builds/:id  — detail
export async function handleDetail(ctx: RequestContext, id: number): Promise<Response> {
  const build = await getBuild(id);
  if (!build) return page(ctx, "Not found", <p class="hint">No build #{id}.</p>, 404);
  return page(ctx, `Tower // #${id} ${build.label}`, <BuildDetail ctx={ctx} b={build} />);
}
