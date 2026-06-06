# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

**Tower — build tracker.** A small Deno + TypeScript web app that stores **versioned
snapshots** of a player's build in the game *The Tower*, plus pasted battle reports.
Server-rendered HTML, no client-side JS, no build step. Single-user, homelab
deployment behind Caddy + Tailscale (no public ingress, no auth).

Core design idea: a respec is a *new* snapshot (history is preserved). Every stat
value lives in `builds.data` (jsonb), so changing what you track never requires a DB
migration — `app/stat_schema.ts` is the application's schema, not the database's.

## Layout

```
main.ts                  HTTP server + router (URLPattern), BASE_PATH-aware
app/
  stat_schema.ts         Single source of truth for the build form (categories/fields). EDIT ME to change tracked stats.
  views.ts               Server-rendered HTML — layout, forms, list, detail. Includes esc() and the embedded CSS.
  report_parser.ts       Pure text → ParsedReport parser for pasted battle reports.
  routes/builds.ts       GET list/new/detail, POST save. Coerces form data via STAT_SCHEMA.
  routes/reports.ts      GET list/new/detail, POST save. Parses paste, rejects meaningless input.
db/
  db.ts                  postgres.js data-access layer (Build/BattleReport CRUD).
  migrations/001_init.sql Single migration: builds + battle_reports tables (jsonb columns).
docker-compose.yml       Local dev Postgres (runs 001_init.sql on first volume init only).
```

## Commands

```bash
deno task dev      # run with --watch (needs .env with DATABASE_URL)
deno task start    # run once
deno check main.ts # type-check (see "Known issues" — 2 pre-existing db.ts errors)
deno fmt           # format (lineWidth 100, configured in deno.json)
deno test          # run tests (none exist yet — see Testing)
```

Requires a `.env` with `DATABASE_URL`. `BASE_PATH` defaults to `/tower`.

## Routes (all prefixed with `BASE_PATH`, default `/tower`)

| Method | Path                  | Handler (file)                          |
|--------|-----------------------|-----------------------------------------|
| GET    | `/builds`             | `handleList` (routes/builds.ts)         |
| GET    | `/builds/new`         | `handleNew` — `?from=latest` or `?from=<id>` to prefill (respec) |
| POST   | `/builds`             | `handleSave`                            |
| GET    | `/builds/:id`         | `handleDetail`                          |
| GET    | `/reports`            | `handleReportList` (routes/reports.ts)  |
| GET    | `/reports/new`        | `handleReportNew`                       |
| POST   | `/reports`            | `handleReportSave`                      |
| GET    | `/reports/:id`        | `handleReportDetail`                    |

## Architecture notes & conventions

- **`STAT_SCHEMA` drives everything.** `views.ts` renders the form from it; `builds.ts`
  reads form fields by iterating it (unknown fields are silently dropped). Add/remove a
  stat by editing only `app/stat_schema.ts`. Fields use dot-keyed names
  (`<category.key>.<field.key>`); paired fields also emit `<category.key>.<enhancement.key>`.
- **`BASE_PATH` is prop-drilled** as a `base: string` arg through every route and view.
  All internal hrefs/form actions interpolate it raw. It's env-controlled (never user
  input). The trailing-slash strip in `main.ts:20` is load-bearing.
- **Always escape user data in HTML** with `esc()` (`views.ts`). It escapes `& < > " '`.
  Every string that originates from form input or a paste must pass through it.
- **All SQL goes through postgres.js tagged templates** (`sql\`...${val}...\``), which
  parameterize automatically. Never string-concatenate into a query.
- **`db.ts` throws at module load** if `DATABASE_URL` is unset (fail-fast, intentional).
  This means importing it requires the env var even for tests.
- **`report_parser.ts` is pure** (no I/O, no imports) and optimistic — it never throws;
  unrecognized input yields nulls. The route layer is responsible for rejecting a
  meaningless parse before insert. The `raw` paste is always stored for re-parsing.

## Known issues / gotchas

- **`deno check` reports 2 pre-existing errors** in `db/db.ts:56` and `:109`
  (`sql.json()` expecting `JSONValue`, getting `Record<string, unknown>`). Type-checker
  only; runtime serialization is fine. Not yet fixed — don't be alarmed by them, and
  don't let new errors hide behind them.
- **No migration runner.** `001_init.sql` uses bare `CREATE TABLE` (no `IF NOT EXISTS`)
  and only runs on a fresh docker volume. Re-applying against a live DB errors. Any
  future migration must be sequenced manually.
- **`listBuilds`/`listReports` hard-cap at 100 rows** with no pagination — older rows
  silently disappear from list views and the report build-picker.
- **Detail pages dump raw `JSON.stringify(data)`** rather than a schema-driven view.
- **Accessibility gaps** in the forms (focus contrast, label `for`/`id` associations,
  mobile reflow) are known and not yet addressed.

## Subagents

This project carries a project-local **bobbie** agent (`.claude/agents/bobbie.md`) — a
test writer pre-configured for this Deno stack (`deno test`, `jsr:@std/assert`,
co-located `*_test.ts`). A broader user-level roster (miller, naomi, amos, edna, etc.)
is also available.

## Testing

No test suite exists yet. Use Deno's built-in `deno test` with `jsr:@std/assert`.
Co-locate tests as `*_test.ts` next to source. Highest-value targets are the pure
modules — `app/report_parser.ts` and `app/stat_schema.ts` (`coerce`) — which need no DB
or env. Anything importing `db/db.ts` requires `--allow-net --allow-env --env-file` and
a running Postgres. See `.claude/agents/bobbie.md` for the full testing brief.
