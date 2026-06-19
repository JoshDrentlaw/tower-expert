// Layout.tsx — the full HTML document shell (head, embedded CSS, header/nav).

import type { ComponentChildren } from "preact";
import type { RequestContext } from "../services/ctx.ts";

const STYLE = `
  :root {
    --bg: #0e1116; --panel: #161b22; --line: #232a34;
    --ink: #d7dde5; --muted: #8b97a7;
    --accent: #e8b450;        /* decorative: button bg, borders, focus ring */
    --accent-dim: #b8922a;    /* dim column headers */
    --accent-text: #e8b450;   /* accent used as text/links on the page bg */
    --on-accent: #1a1408;     /* text sitting on an accent (button) bg */
    --field-bg: #0b0e13;      /* input background */
    --error: #e88;
    --mono: ui-monospace, "JetBrains Mono", "SFMono-Regular", Menlo, monospace;
    --body: system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  @media (prefers-color-scheme: light) {
    :root {
      --bg: #f6f7f9; --panel: #ffffff; --line: #d7dde3;
      --ink: #1b2027; --muted: #586273;
      --accent: #e0a93b;       /* gold button bg (with dark --on-accent text) */
      --accent-dim: #7a5e0a;   /* dim headers, readable on white */
      --accent-text: #8a5a00;  /* dark amber, readable as link text on white */
      --on-accent: #1a1408;
      --field-bg: #ffffff;
      --error: #b00020;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--ink); font-family: var(--body);
    line-height: 1.5; padding: 1.25rem; max-width: 880px; margin-inline: auto;
  }
  header { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem;
    border-bottom: 1px solid var(--line); padding-bottom: .75rem; margin-bottom: 1.25rem; }
  h1 { font-family: var(--mono); font-size: 1.15rem; letter-spacing: .04em; margin: 0;
    color: var(--accent-text); text-transform: uppercase; }
  nav { display: flex; flex-wrap: wrap; }
  nav a { color: var(--muted); text-decoration: none; font-family: var(--body);
    font-size: .85rem; margin-left: .75rem; display: inline-block; padding: .4rem .25rem; }
  nav a:hover { color: var(--ink); }
  nav a[aria-current="page"] { color: var(--ink); border-bottom: 2px solid var(--accent-text); }
  fieldset { border: 1px solid var(--line); border-radius: 8px; background: var(--panel);
    margin: 0 0 1rem; padding: 1rem 1.1rem 1.2rem; }
  legend { font-family: var(--mono); font-size: .78rem; letter-spacing: .05em;
    text-transform: uppercase; color: var(--accent-text); padding: 0 .4rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: .75rem; }
  .chart { margin: 0 0 1.5rem; }
  .chart figcaption { font-family: var(--mono); font-size: .78rem; letter-spacing: .05em;
    text-transform: uppercase; color: var(--accent-text); margin-bottom: .4rem; }
  .chart svg { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; }
  label { display: block; font-size: .82rem; color: var(--muted); margin-bottom: .25rem;
    font-family: var(--body); }
  input, select, textarea {
    width: 100%; background: var(--field-bg); color: var(--ink); border: 1px solid var(--line);
    border-radius: 6px; padding: .45rem .55rem; font-family: var(--mono); font-size: .9rem;
  }
  input:focus, select:focus, textarea:focus, button:focus, a:focus, summary:focus {
    outline: 2px solid var(--accent-text); outline-offset: 2px; border-color: var(--accent-text);
  }
  input.changed, select.changed, textarea.changed {
    border-color: var(--accent-text); box-shadow: inset 3px 0 0 var(--accent-text);
  }
  .meta { display: grid; grid-template-columns: 1fr 2fr; gap: .75rem; margin-bottom: 1rem; }
  .actions { display: flex; gap: .75rem; align-items: center; margin-top: .5rem; }
  button { background: var(--accent); color: var(--on-accent); border: 0; border-radius: 6px;
    padding: .55rem 1.1rem; font-family: var(--mono); font-weight: 600; cursor: pointer; }
  button:hover { filter: brightness(1.08); }
  .hint { color: var(--muted); font-size: .8rem; line-height: 1.45; }
  .onboard { border: 1px solid var(--line); border-radius: 10px; background: var(--panel);
    padding: 1.75rem 1.5rem; text-align: center; max-width: 34rem; margin: 1.5rem auto; }
  .onboard h2 { margin: 0 0 .5rem; color: var(--ink); font-family: var(--body); font-size: 1.1rem; }
  .onboard p { color: var(--muted); margin: 0 auto 1.25rem; max-width: 28rem; }
  .onboard-cta { display: flex; gap: 1rem; justify-content: center; align-items: center; flex-wrap: wrap; }
  .onboard-secondary { color: var(--accent-text); text-decoration: none; }
  .btn { display: inline-block; background: var(--accent); color: var(--on-accent); border-radius: 6px;
    padding: .55rem 1.1rem; font-family: var(--mono); font-weight: 600; text-decoration: none; }
  .btn:hover { filter: brightness(1.08); }
  .list-actions { margin-bottom: 1rem; }
  .req { color: var(--accent-text); }
  table { width: 100%; border-collapse: collapse; font-size: .9rem; }
  th, td { text-align: left; padding: .5rem .4rem; border-bottom: 1px solid var(--line); }
  th { font-family: var(--mono); font-size: .72rem; text-transform: uppercase; color: var(--muted); }
  td a { color: var(--accent-text); text-decoration: none; }
  @media (max-width: 560px) {
    table.responsive thead { display: none; }
    table.responsive tbody, table.responsive tr, table.responsive td { display: block; }
    table.responsive tr { border: 1px solid var(--line); border-radius: 8px;
      padding: .3rem .75rem; margin-bottom: .75rem; background: var(--panel); }
    table.responsive td { border: 0; padding: .35rem 0; display: flex;
      justify-content: space-between; gap: 1rem; text-align: right; }
    table.responsive td::before { content: attr(data-label); color: var(--muted);
      font-family: var(--mono); font-size: .68rem; letter-spacing: .03em;
      text-transform: uppercase; text-align: left; flex: none; }
  }
  pre { background: var(--panel); border: 1px solid var(--line); border-radius: 8px;
    padding: 1rem; overflow: auto; font-family: var(--mono); font-size: .82rem; }
  .sub-hdr { font-family: var(--mono); font-size: .68rem; letter-spacing: .04em;
    text-transform: uppercase; color: var(--accent-dim);
    padding-bottom: .3rem; margin-bottom: .65rem; border-bottom: 1px solid var(--line); }
  .sub-hdr.enh { margin-top: 1.2rem; }
  .mod-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
    gap: .9rem 1.25rem; align-items: start; }
  .mod-col > div { margin-bottom: .5rem; }
  .mod-col .col-hdr { margin-bottom: .5rem; }
  .level-field { display: flex; gap: .4rem; align-items: center; }
  .level-field > * { min-width: 0; }
  .level-field input.level { flex: 0 0 4.5rem; }  /* the upgrade-level box */
  .level-field input:not(.level) { flex: 1; }     /* the computed value box */
  .max-btn { flex: 0 0 auto; padding: .35rem .5rem; font-size: .72rem; line-height: 1;
    background: var(--field-bg); color: var(--accent-text); border: 1px solid var(--line);
    border-radius: 6px; cursor: pointer; font-family: var(--mono); text-transform: uppercase;
    letter-spacing: .03em; }
  .max-btn:hover { border-color: var(--accent-text); }
  .section-tools { display: flex; justify-content: flex-end; margin-bottom: .6rem; }
  .substat-row { display: flex; gap: .4rem; align-items: center; }
  .substat-row > * { min-width: 0; }
  .substat-row select:nth-of-type(1) { flex: 1.6; }  /* rarity pill */
  .substat-row select:nth-of-type(2) { flex: 2.2; }  /* effect */
  .substat-row input { flex: 1.3; }                  /* value */
  .col-hdr { font-family: var(--mono); font-size: .68rem; letter-spacing: .04em;
    text-transform: uppercase; color: var(--accent-dim);
    padding-bottom: .3rem; border-bottom: 1px solid var(--line); }
  details.section { border: 1px solid var(--line); border-radius: 8px;
    background: var(--panel); margin: 0 0 1rem; }
  details.section > summary { font-family: var(--mono); font-size: .78rem;
    letter-spacing: .05em; text-transform: uppercase; color: var(--accent-text);
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
    color: var(--on-accent); padding: .5rem 1rem; border-radius: 6px; font-family: var(--mono); }
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
  // Nav holds the two sections; the actions (new build / log run) live as
  // primary buttons on those list pages, not in the nav.
  const builds = path.startsWith(`${base}/builds`);
  const runs = path.startsWith(`${base}/reports`);
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
            <a href={`${base}/reports`} aria-current={cur(runs)}>{t("nav.reports")}</a>
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
