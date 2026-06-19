// main.ts — HTTP server + router.
//
// BASE_PATH lets this sit behind a Caddy `handle /tower*` block without
// handle_path stripping: every route and link is prefixed, so assets and
// form actions resolve correctly under the subpath.

import {
  handleDetail,
  handleEdit,
  handleList,
  handleNew,
  handleSave,
  handleUpdate,
} from "./app/routes/builds.tsx";
import {
  handleReportDetail,
  handleReportList,
  handleReportNew,
  handleReportProgression,
  handleReportSave,
} from "./app/routes/reports.tsx";
import { makeContext } from "./app/services/ctx.ts";

const BASE = (Deno.env.get("BASE_PATH") ?? "/tower").replace(/\/+$/, "");
const PORT = Number(Deno.env.get("PORT") ?? 8787);

const buildPattern = new URLPattern({ pathname: `${BASE}/builds/:id(\\d+)` });
const buildEditPattern = new URLPattern({ pathname: `${BASE}/builds/:id(\\d+)/edit` });
const reportPattern = new URLPattern({ pathname: `${BASE}/reports/:id(\\d+)` });

Deno.serve({ port: PORT }, async (req) => {
  const url = new URL(req.url);
  const { pathname } = url;

  try {
    // Root + bare base → builds history
    if (pathname === BASE || pathname === `${BASE}/` || pathname === "/") {
      return Response.redirect(new URL(`${BASE}/builds`, req.url), 302);
    }

    // Per-request context (base + locale + formatter), threaded to every view.
    const ctx = makeContext(BASE, req);

    // Build routes
    if (req.method === "GET" && pathname === `${BASE}/builds`) return await handleList(ctx);
    if (req.method === "GET" && pathname === `${BASE}/builds/new`) {
      return await handleNew(ctx, url);
    }
    if (req.method === "POST" && pathname === `${BASE}/builds`) return await handleSave(ctx, req);

    const buildEditMatch = buildEditPattern.exec(url);
    if (req.method === "GET" && buildEditMatch) {
      return await handleEdit(ctx, Number(buildEditMatch.pathname.groups.id));
    }

    const buildMatch = buildPattern.exec(url);
    if (req.method === "GET" && buildMatch) {
      return await handleDetail(ctx, Number(buildMatch.pathname.groups.id));
    }
    if (req.method === "POST" && buildMatch) {
      return await handleUpdate(ctx, req, Number(buildMatch.pathname.groups.id));
    }

    // Report routes
    if (req.method === "GET" && pathname === `${BASE}/reports`) return await handleReportList(ctx);
    if (req.method === "GET" && pathname === `${BASE}/reports/progression`) {
      return await handleReportProgression(ctx);
    }
    if (req.method === "GET" && pathname === `${BASE}/reports/new`) {
      return await handleReportNew(ctx);
    }
    if (req.method === "POST" && pathname === `${BASE}/reports`) {
      return await handleReportSave(ctx, req);
    }

    const reportMatch = reportPattern.exec(url);
    if (req.method === "GET" && reportMatch) {
      return await handleReportDetail(ctx, Number(reportMatch.pathname.groups.id));
    }

    return new Response("Not found", { status: 404 });
  } catch (err) {
    console.error(err);
    return new Response("Internal error", { status: 500 });
  }
});

console.log(`tower listening on :${PORT} (base ${BASE})`);
