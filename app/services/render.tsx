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
  return new Response(body, { status, headers: h });
}
