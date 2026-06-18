// render.tsx — turn a Preact element into an HTML Response.
//
// Replaces the old html()/layout() string wrapping. Components render the full
// <html> document (see components/Layout.tsx); we just prepend the doctype.

import { renderToString } from "preact-render-to-string";
import type { VNode } from "preact";

export function renderPage(vnode: VNode, status = 200, headers?: HeadersInit): Response {
  const body = "<!doctype html>" + renderToString(vnode);
  const h = new Headers(headers);
  h.set("content-type", "text/html; charset=utf-8");
  // Server-rendered pages are cheap and always reflect current data + the
  // current STAT_SCHEMA. Forbid caching so a browser/proxy can't serve a stale
  // form (e.g. an edit page from before a schema change, which made the edit
  // form look like it had fewer fields than the new-build form).
  if (!h.has("cache-control")) h.set("cache-control", "no-store");
  return new Response(body, { status, headers: h });
}
