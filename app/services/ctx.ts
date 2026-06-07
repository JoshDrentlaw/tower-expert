// ctx.ts — per-request context, threaded through components instead of
// prop-drilling `base`. Built once per request in main.ts.
//
// `base` is the BASE_PATH prefix (env-controlled). `locale` is fixed to "en"
// in this foundation step; the i18n step resolves it from the request and adds
// a `t()` translator here.

import { type Formatter, makeFormatter } from "./format.ts";

export interface RequestContext {
  base: string;
  locale: string;
  fmt: Formatter;
}

export function makeContext(base: string, _req: Request): RequestContext {
  const locale = "en";
  return { base, locale, fmt: makeFormatter(locale) };
}
