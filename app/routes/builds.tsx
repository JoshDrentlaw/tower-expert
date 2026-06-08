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

function page(
  ctx: RequestContext,
  title: string,
  body: VNode,
  status = 200,
  heading?: string,
): Response {
  return renderPage(
    <Layout ctx={ctx} title={title} heading={heading}>{body}</Layout>,
    status,
    // Persist the resolved locale so a one-time ?lang= sticks.
    { "set-cookie": `lang=${ctx.locale}; Path=${ctx.base || "/"}; Max-Age=31536000; SameSite=Lax` },
  );
}

// GET {base}/builds  — history
export async function handleList(ctx: RequestContext): Promise<Response> {
  const builds = await listBuilds();
  return page(
    ctx,
    ctx.t("title.builds"),
    <BuildsList ctx={ctx} builds={builds} />,
    200,
    ctx.t("heading.builds"),
  );
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
    ctx.t("title.newBuild"),
    <BuildForm ctx={ctx} opts={build ? { build, parentId: build.id } : {}} />,
    200,
    ctx.t("heading.newBuild"),
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
  // is non-empty but unparseable is collected (label for the message, key for
  // aria-invalid) and echoed back rather than silently dropped.
  const data: Record<string, Record<string, unknown>> = {};
  const failed: string[] = [];
  const failedKeys: string[] = [];
  for (const cat of STAT_SCHEMA) {
    const section: Record<string, unknown> = {};
    const take = (key: string, type: FieldType, unit: NumUnit | undefined, label: string) => {
      const raw = form.get(`${cat.key}.${key}`) as string | null;
      const value = coerce(type, raw, unit);
      if (value !== null) {
        section[key] = value;
      } else if (isNumeric(type) && raw !== null && raw.trim() !== "") {
        failed.push(ctx.t(`stat.${cat.key}.${key}`, { default: label }));
        failedKeys.push(`${cat.key}.${key}`);
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
    errors.push(ctx.t("error.labelRequired"));
  } else if (labelRaw.length > MAX_LABEL_LENGTH) {
    errors.push(ctx.t("error.labelTooLong", { max: MAX_LABEL_LENGTH }));
  }
  if (failed.length > 0) {
    errors.push(ctx.t("error.couldntRead", { fields: failed.join(", ") }));
  }

  if (errors.length > 0) {
    const status = labelRaw && failed.length === 0 ? 422 : 400;
    return page(
      ctx,
      ctx.t("title.newBuild"),
      <BuildForm
        ctx={ctx}
        opts={{
          parentId: parent_build_id ?? undefined,
          error: errors.join(" "),
          submittedLabel: labelRaw ?? "",
          submittedNote: note ?? "",
          submittedData: data,
          invalidKeys: failedKeys,
        }}
      />,
      status,
      ctx.t("heading.newBuild"),
    );
  }

  const id = await insertBuild({ label: labelRaw!, note, parent_build_id, data });
  return Response.redirect(new URL(`${ctx.base}/builds/${id}`, req.url), 303);
}

// GET {base}/builds/:id  — detail
export async function handleDetail(ctx: RequestContext, id: number): Promise<Response> {
  const build = await getBuild(id);
  if (!build) {
    return page(
      ctx,
      ctx.t("title.notFound"),
      <p class="hint">{ctx.t("buildDetail.notFound", { id })}</p>,
      404,
      ctx.t("heading.notFound"),
    );
  }
  return page(
    ctx,
    ctx.t("title.build", { id, label: build.label }),
    <BuildDetail ctx={ctx} b={build} />,
    200,
    ctx.t("heading.build", { id, label: build.label }),
  );
}
