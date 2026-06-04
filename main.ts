// main.ts — HTTP server + router.
//
// BASE_PATH lets this sit behind a Caddy `handle /tower*` block without
// handle_path stripping: every route and link is prefixed, so assets and
// form actions resolve correctly under the subpath.

import {
  handleDetail,
  handleList,
  handleNew,
  handleSave,
} from "./app/routes/builds.ts";
import {
  handleReportDetail,
  handleReportList,
  handleReportNew,
  handleReportSave,
} from "./app/routes/reports.ts";

const BASE = (Deno.env.get("BASE_PATH") ?? "/tower").replace(/\/+$/, "");
const PORT = Number(Deno.env.get("PORT") ?? 8787);

const buildPattern  = new URLPattern({ pathname: `${BASE}/builds/:id(\\d+)` });
const reportPattern = new URLPattern({ pathname: `${BASE}/reports/:id(\\d+)` });

Deno.serve({ port: PORT }, async (req) => {
  const url = new URL(req.url);
  const { pathname } = url;

  try {
    // Root + bare base → builds history
    if (pathname === BASE || pathname === `${BASE}/` || pathname === "/") {
      return Response.redirect(new URL(`${BASE}/builds`, req.url), 302);
    }

    // Build routes
    if (req.method === "GET"  && pathname === `${BASE}/builds`)     return await handleList(BASE);
    if (req.method === "GET"  && pathname === `${BASE}/builds/new`) return await handleNew(BASE, url);
    if (req.method === "POST" && pathname === `${BASE}/builds`)     return await handleSave(BASE, req);

    const buildMatch = buildPattern.exec(url);
    if (req.method === "GET" && buildMatch) {
      return await handleDetail(BASE, Number(buildMatch.pathname.groups.id));
    }

    // Report routes
    if (req.method === "GET"  && pathname === `${BASE}/reports`)     return await handleReportList(BASE);
    if (req.method === "GET"  && pathname === `${BASE}/reports/new`) return await handleReportNew(BASE);
    if (req.method === "POST" && pathname === `${BASE}/reports`)     return await handleReportSave(BASE, req);

    const reportMatch = reportPattern.exec(url);
    if (req.method === "GET" && reportMatch) {
      return await handleReportDetail(BASE, Number(reportMatch.pathname.groups.id));
    }

    return new Response("Not found", { status: 404 });
  } catch (err) {
    console.error(err);
    return new Response("Internal error", { status: 500 });
  }
});

console.log(`tower listening on :${PORT} (base ${BASE})`);
