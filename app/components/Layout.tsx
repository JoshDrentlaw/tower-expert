// Layout.tsx — the full HTML document shell (head, embedded CSS, header/nav).

import type { ComponentChildren } from "preact";
import type { RequestContext } from "../services/ctx.ts";

const STYLE = `
  :root {
    --bg: #0e1116; --panel: #161b22; --line: #232a34;
    --ink: #d7dde5; --muted: #8b97a7; --accent: #e8b450; --accent-dim: #b8922a;
    --mono: ui-monospace, "JetBrains Mono", "SFMono-Regular", Menlo, monospace;
    --body: system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--ink); font-family: var(--body);
    line-height: 1.5; padding: 1.25rem; max-width: 880px; margin-inline: auto;
  }
  header { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem;
    border-bottom: 1px solid var(--line); padding-bottom: .75rem; margin-bottom: 1.25rem; }
  h1 { font-family: var(--mono); font-size: 1.15rem; letter-spacing: .04em; margin: 0;
    color: var(--accent); text-transform: uppercase; }
  nav { display: flex; flex-wrap: wrap; }
  nav a { color: var(--muted); text-decoration: none; font-family: var(--mono);
    font-size: .8rem; margin-left: .75rem; display: inline-block; padding: .4rem .25rem; }
  nav a:hover { color: var(--ink); }
  nav a[aria-current="page"] { color: var(--ink); border-bottom: 2px solid var(--accent); }
  fieldset { border: 1px solid var(--line); border-radius: 8px; background: var(--panel);
    margin: 0 0 1rem; padding: 1rem 1.1rem 1.2rem; }
  legend { font-family: var(--mono); font-size: .78rem; letter-spacing: .05em;
    text-transform: uppercase; color: var(--accent); padding: 0 .4rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: .75rem; }
  label { display: block; font-size: .72rem; color: var(--muted); margin-bottom: .25rem;
    font-family: var(--mono); }
  input, select, textarea {
    width: 100%; background: #0b0e13; color: var(--ink); border: 1px solid var(--line);
    border-radius: 6px; padding: .45rem .55rem; font-family: var(--mono); font-size: .9rem;
  }
  input:focus, select:focus, textarea:focus, button:focus, a:focus, summary:focus {
    outline: 2px solid var(--accent); outline-offset: 2px; border-color: var(--accent);
  }
  input.changed, select.changed, textarea.changed {
    border-color: var(--accent); box-shadow: inset 3px 0 0 var(--accent);
  }
  .meta { display: grid; grid-template-columns: 1fr 2fr; gap: .75rem; margin-bottom: 1rem; }
  .actions { display: flex; gap: .75rem; align-items: center; margin-top: .5rem; }
  button { background: var(--accent); color: #1a1408; border: 0; border-radius: 6px;
    padding: .55rem 1.1rem; font-family: var(--mono); font-weight: 600; cursor: pointer; }
  button:hover { filter: brightness(1.08); }
  .hint { color: var(--muted); font-size: .78rem; }
  .req { color: var(--accent); }
  table { width: 100%; border-collapse: collapse; font-size: .9rem; }
  th, td { text-align: left; padding: .5rem .4rem; border-bottom: 1px solid var(--line); }
  th { font-family: var(--mono); font-size: .72rem; text-transform: uppercase; color: var(--muted); }
  td a { color: var(--accent); text-decoration: none; }
  pre { background: var(--panel); border: 1px solid var(--line); border-radius: 8px;
    padding: 1rem; overflow: auto; font-family: var(--mono); font-size: .82rem; }
  .paired-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; align-items: start; }
  .mod-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
    gap: .9rem 1.25rem; align-items: start; }
  .mod-col > div { margin-bottom: .5rem; }
  .mod-col .col-hdr { margin-bottom: .5rem; }
  .substat-row { display: flex; gap: .4rem; align-items: center; }
  .substat-row select { flex: 2.4; min-width: 0; }
  .substat-row input { flex: 1; min-width: 0; }
  .col-hdr { font-family: var(--mono); font-size: .68rem; letter-spacing: .04em;
    text-transform: uppercase; color: var(--accent-dim);
    padding-bottom: .3rem; border-bottom: 1px solid var(--line); }
  details.section { border: 1px solid var(--line); border-radius: 8px;
    background: var(--panel); margin: 0 0 1rem; }
  details.section > summary { font-family: var(--mono); font-size: .78rem;
    letter-spacing: .05em; text-transform: uppercase; color: var(--accent);
    padding: .8rem 1.1rem; cursor: pointer; list-style: none;
    display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
  details.section > summary::-webkit-details-marker { display: none; }
  details.section[open] > summary { border-bottom: 1px solid var(--line); }
  details.section .count { color: var(--muted); font-size: .72rem; font-weight: normal; }
  .section-body { padding: 1rem 1.1rem 1.2rem; }
  .actions.sticky { position: sticky; bottom: .5rem; background: var(--panel);
    border: 1px solid var(--line); border-radius: 8px; padding: .75rem; margin-top: 1rem; z-index: 5; }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
  .skip-link { position: absolute; left: -9999px; }
  .skip-link:focus { left: .5rem; top: .5rem; z-index: 999; background: var(--accent);
    color: #1a1408; padding: .5rem 1rem; border-radius: 6px; font-family: var(--mono); }
  @media (prefers-reduced-motion: reduce) {
    * { transition: none !important; animation: none !important; }
  }
`;

export function Layout(
  { ctx, title, heading, children }: {
    ctx: RequestContext;
    title: string;
    heading?: string;
    children: ComponentChildren;
  },
) {
  const { base, t, path } = ctx;
  // Active section (respec lives in-context now, not in the nav).
  const newBuild = path === `${base}/builds/new`;
  const logRun = path === `${base}/reports/new`;
  const builds = path.startsWith(`${base}/builds`) && !newBuild;
  const reports = path.startsWith(`${base}/reports`) && !logRun;
  const cur = (on: boolean) => (on ? "page" : undefined);
  return (
    <html lang={ctx.locale}>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      </head>
      <body>
        <a href="#main-content" class="skip-link">{t("a11y.skipToContent")}</a>
        <header>
          <h1>{t("app.title")}</h1>
          <nav aria-label={t("nav.ariaLabel")}>
            <a href={`${base}/builds`} aria-current={cur(builds)}>{t("nav.builds")}</a>
            <a href={`${base}/builds/new`} aria-current={cur(newBuild)}>{t("nav.newBuild")}</a>
            <a href={`${base}/reports`} aria-current={cur(reports)}>{t("nav.reports")}</a>
            <a href={`${base}/reports/new`} aria-current={cur(logRun)}>{t("nav.logRun")}</a>
          </nav>
        </header>
        <main id="main-content">
          {heading ? <h2 class="sr-only">{heading}</h2> : null}
          {children}
        </main>
      </body>
    </html>
  );
}
