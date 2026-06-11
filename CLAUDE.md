# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

**Tower — build tracker.** A small Deno + TypeScript web app that stores **versioned snapshots** of
a player's build in the game _The Tower_, plus pasted battle reports. **Currently** server-rendered
HTML with **minimal** client-side JS — only the build-form helpers
(`app/components/draft_autosave.ts` for localStorage drafts, `changed_highlight.ts` for live
edit-highlighting) — and no build step, deployed single-user on a homelab behind Caddy + Tailscale
(no public ingress, no auth).

**Direction — read this before making tooling decisions.** The no-build-step / no-client-JS /
single-user posture is the project's _current state_, **not a hard constraint**. That rule was
inherited from the chore-app template Tower was scaffolded from and does **not** bind this project.
Tower is intended to grow into a tool shared with The Tower community, so internationalization
(i18n), thorough accessibility (a11y), and eventually richer UI (charts) are on the roadmap. A build
step, a client framework (HTMX → Fresh), JSX templating, or Tailwind are all fair game when they pay
for themselves — do **not** reject a library or approach _solely_ because it adds a build step.
Rough graduation triggers: hand-rolled `<script>` appearing in 3+ views, an HTML-escaping near-miss,
i18n threading making view signatures unwieldy, _interactive_ (not static-SVG) charts, or
multi-user/auth. The cheapest pre-emptive move is migrating `views.ts` string templates to JSX
components at the start of the first big i18n/UI push — before that surface grows large.

Core design idea: a respec is a _new_ snapshot (history is preserved). Every stat value lives in
`builds.data` (jsonb), so changing what you track never requires a DB migration —
`app/stat_schema.ts` is the application's schema, not the database's. A build can also be **edited
in place** (`updateBuild`) — that's for leveling up an existing build, distinct from a respec, which
clones into a new snapshot.

## Game data — ALWAYS use the Fandom MediaWiki Action API, never fetch pages directly

The authoritative source for _The Tower_ game data (stats, formulas, units, modules, enemies) is the
**Fandom wiki**, and it is the backbone of the "expert" features as they grow. There is exactly one
correct way to read it:

- **Use the MediaWiki Action API:** `https://the-tower-idle-tower-defense.fandom.com/api.php`
  (MediaWiki 1.43+). Always pass `format=json&formatversion=2`.
- **Do NOT `WebFetch` the human article URLs** (`/wiki/<Page>`). Fandom returns **503** to that path
  — it is blocked, not flaky. Retrying or using a different prompt will not help. The `api.php`
  endpoint is the supported path and works.

Typical flow (titles are per-stat pages like `Critical Hits`, `Defense Percent`, `Attack Speed` —
there is no single `Workshop` page):

```
# 1. Find the page title
GET api.php?action=query&list=search&srsearch=<terms>&srlimit=10&format=json&formatversion=2
# 2. Read its source
GET api.php?action=parse&page=<Title>&prop=wikitext&format=json&formatversion=2
# Sanity-check the endpoint:
GET api.php?action=query&meta=siteinfo&siprop=general&format=json&formatversion=2
```

Notes:

- **Read-only.** Query/parse/search freely. No login, no edits, no writes to the community wiki.
- `WebFetch` runs the API response through a summarizer, so it is **not byte-exact** — ask it to
  quote specific fields (e.g. an exact wikitext value) rather than trusting a paraphrase.
- This convention is **not optional** and applies everywhere in this project — any agent, any task
  that needs game data goes through `api.php`.

## Layout

```
main.ts                  HTTP server + router (URLPattern), BASE_PATH-aware; builds the per-request ctx.
app/
  stat_schema.ts         Single source of truth for the build form (categories/fields). EDIT ME to change tracked stats.
  num_format.ts          Pure number parse/format (game magnitude suffixes, %, ×, s).
  report_parser.ts       Pure text → ParsedReport parser for pasted battle reports.
  components/            Preact/JSX server-rendered views (.tsx): Layout, fields, builds, reports.
  services/             ctx.ts (RequestContext), render.tsx (renderPage), format.ts (Formatter).
  i18n/                  index.ts (t() + locale resolution) + per-locale catalogs (en.json, es.json).
  routes/builds.tsx      GET list/new/detail, POST save. Coerces form data via STAT_SCHEMA.
  routes/reports.tsx     GET list/new/detail, POST save. Parses paste, rejects meaningless input.
db/
  db.ts                  postgres.js data-access layer (Build/BattleReport CRUD).
  migrations/001_init.sql Single migration: builds + battle_reports tables (jsonb columns).
docker-compose.yml       Local dev Postgres (runs 001_init.sql on first volume init only).
```

Views are **Preact components** rendered to a string (`preact-render-to-string`); JSX auto-escapes,
so there is no hand-rolled `esc()`. The old `app/views.ts` string-template layer is gone.

## Commands

```bash
deno task dev      # run with --watch (needs .env with DATABASE_URL)
deno task start    # run once
deno check main.ts # type-check (clean)
deno fmt           # format (lineWidth 100, configured in deno.json)
deno test app/     # run tests (pure modules + a component render test; no DB needed)
```

Requires a `.env` with `DATABASE_URL`. `BASE_PATH` defaults to `/tower`.

## Routes (all prefixed with `BASE_PATH`, default `/tower`)

| Method | Path               | Handler (file)                                                   |
| ------ | ------------------ | ---------------------------------------------------------------- |
| GET    | `/builds`          | `handleList` (routes/builds.tsx)                                 |
| GET    | `/builds/new`      | `handleNew` — `?from=latest` or `?from=<id>` to prefill (respec) |
| POST   | `/builds`          | `handleSave`                                                     |
| GET    | `/builds/:id/edit` | `handleEdit` — edit-in-place form (leveling, not respec)         |
| POST   | `/builds/:id`      | `handleUpdate` — update build in place                           |
| GET    | `/builds/:id`      | `handleDetail`                                                   |
| GET    | `/reports`         | `handleReportList` (routes/reports.tsx)                          |
| GET    | `/reports/new`     | `handleReportNew`                                                |
| POST   | `/reports`         | `handleReportSave`                                               |
| GET    | `/reports/:id`     | `handleReportDetail`                                             |

## Architecture notes & conventions

- **`STAT_SCHEMA` drives everything.** The `Section`/`Field` components render the form from it;
  `routes/builds.tsx` reads form fields by iterating it (unknown fields are silently dropped).
  Add/remove a stat by editing only `app/stat_schema.ts`. Fields use dot-keyed names
  (`<category.key>.<field.key>`); paired fields also emit `<category.key>.<enhancement.key>`; fields
  with a `group` render as columns (Modules).
- **`BASE_PATH` rides in the per-request `ctx`** (`app/services/ctx.ts`), threaded to every
  component as `ctx.base` (replacing the old prop-drilled `base` arg). It's env-controlled (never
  user input). The trailing-slash strip in `main.ts` is load-bearing.
- **HTML escaping is automatic** — views are Preact components and JSX escapes text + attribute
  values on render. There is no `esc()`. Keep user/DB data out of `dangerouslySetInnerHTML` (only
  the static CSS in `Layout.tsx` uses it) and out of URL/`<script>` contexts.
- **All user-facing text goes through `ctx.t(key, { default })`** (`app/i18n/`). Catalogs are flat
  key→string maps; `en.json` is the source of truth. Stat/category/module labels pass their schema
  label as `default`, so they render in English until a locale translates them (key shape:
  `stat.<cat>.<field>`, `cat.<cat>`, `mod.<group>`). Game magnitude numbers stay locale-neutral
  (`fmt.num`); counts/dates localize via `fmt.integer`/`fmt.dateTime`. Locale resolves per request
  as `?lang=` → `lang` cookie → `Accept-Language` → `en`, and is persisted as a cookie on render.
- **Localization voice — write for the actual audience, not the textbook.** Translations target real
  users, not formal/neutral "correctness." The Spanish (`es.json`) audience is **US-based,
  predominantly Southern California / Mexican Spanish**: use informal `tú`; Mexican vocabulary
  (`reporte` not `informe`, `ingresar` not `introducir`); keep widely-understood English gaming/tech
  loanwords (`build`, `respec`, `snapshot`, `run`); avoid Castilian forms (`vosotros`, `ordenador`,
  `vale`, …). Apply the same audience-first principle to any future locale — pick the register and
  regional variant your players actually speak.
- **All SQL goes through postgres.js tagged templates** (`sql\`...${val}...\``), which parameterize
  automatically. Never string-concatenate into a query.
- **`db.ts` throws at module load** if `DATABASE_URL` is unset (fail-fast, intentional). This means
  importing it requires the env var even for tests.
- **`report_parser.ts` is pure** (no I/O, no imports) and optimistic — it never throws; unrecognized
  input yields nulls. The route layer is responsible for rejecting a meaningless parse before
  insert. The `raw` paste is always stored for re-parsing.

## Known issues / gotchas

- **No migration runner.** `001_init.sql` uses bare `CREATE TABLE` (no `IF NOT EXISTS`) and only
  runs on a fresh docker volume. Re-applying against a live DB errors. Any future migration must be
  sequenced manually.
- **`listBuilds`/`listReports` hard-cap at 100 rows** with no pagination — older rows silently
  disappear from list views and the report build-picker.
- **Accessibility baseline shipped** (Edna audit → fixes): WCAG-AA contrast, focus ring on all
  interactives, `<main>` + skip link, `<th scope>` + table captions,
  `aria-invalid`/`aria-describedby` on parse-failed fields, per-unit `inputmode`, sr-only page
  headings. **Deferred (documented):** the `.paired-grid` tab order reads all upgrades then all
  enhancements (matches the in-game Workshop screen) rather than interleaving paired rows — a
  meaningful-sequence tradeoff (WCAG 1.3.2) kept on purpose.

## Subagents

This project carries a project-local **bobbie** agent (`.claude/agents/bobbie.md`) — a test writer
pre-configured for this Deno stack (`deno test`, `jsr:@std/assert`, co-located `*_test.ts`). A
broader user-level roster (miller, naomi, amos, edna, etc.) is also available.

## Testing

No test suite exists yet. Use Deno's built-in `deno test` with `jsr:@std/assert`. Co-locate tests as
`*_test.ts` next to source. Highest-value targets are the pure modules — `app/report_parser.ts` and
`app/stat_schema.ts` (`coerce`) — which need no DB or env. Anything importing `db/db.ts` requires
`--allow-net --allow-env --env-file` and a running Postgres. See `.claude/agents/bobbie.md` for the
full testing brief.
