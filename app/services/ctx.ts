// ctx.ts — per-request context, threaded through components instead of
// prop-drilling. Built once per request in main.ts.

import { type Formatter, makeFormatter } from "./format.ts";
import { makeT, resolveLocale, type TFunc } from "../i18n/index.ts";

export interface RequestContext {
  base: string;
  locale: string;
  path: string; // current request pathname, for nav active state
  t: TFunc;
  fmt: Formatter;
}

export function makeContext(base: string, req: Request): RequestContext {
  const locale = resolveLocale(req);
  return {
    base,
    locale,
    path: new URL(req.url).pathname,
    t: makeT(locale),
    fmt: makeFormatter(locale),
  };
}
