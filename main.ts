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

const BASE = (Deno.env.get("BASE_PATH") ?? "/tower").replace(/\/+$/, "");
const PORT = Number(Deno.env.get("PORT") ?? 8787);

const detailPattern = new URLPattern({ pathname: `${BASE}/builds/:id(\\d+)` });

Deno.serve({ port: PORT }, async (req) => {
  const url = new URL(req.url);
  const { pathname } = url;

  try {
    // Root + bare base → history
    if (pathname === BASE || pathname === `${BASE}/` || pathname === "/") {
      return Response.redirect(new URL(`${BASE}/builds`, req.url), 302);
    }

    if (req.method === "GET" && pathname === `${BASE}/builds`) {
      return await handleList(BASE);
    }
    if (req.method === "GET" && pathname === `${BASE}/builds/new`) {
      return await handleNew(BASE, url);
    }
    if (req.method === "POST" && pathname === `${BASE}/builds`) {
      return await handleSave(BASE, req);
    }

    const detail = detailPattern.exec(url);
    if (req.method === "GET" && detail) {
      return await handleDetail(BASE, Number(detail.pathname.groups.id));
    }

    return new Response("Not found", { status: 404 });
  } catch (err) {
    console.error(err);
    return new Response("Internal error", { status: 500 });
  }
});

console.log(`tower listening on :${PORT} (base ${BASE})`);
