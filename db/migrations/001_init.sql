-- Tower expert — v1 schema
-- Apply against a dedicated `tower` database (NOT the chores tables).
-- See README for creating the database + a least-privilege role.

-- ---------------------------------------------------------------------------
-- builds: each row is a FULL snapshot of your tower at a point in time.
-- A respec = a new row, so history is preserved and never overwritten.
-- All stat values live in `data` (jsonb) so adding/removing tracked stats
-- as the meta shifts never requires a migration.
-- ---------------------------------------------------------------------------
create table builds (
    id              bigint generated always as identity primary key,
    label           text        not null,              -- "fire crit v3"
    note            text,                               -- freeform context
    parent_build_id bigint      references builds (id), -- what this respec derived from
    data            jsonb       not null default '{}'::jsonb,
    created_at      timestamptz not null default now()
);

create index builds_created_at_idx on builds (created_at desc);
create index builds_parent_idx     on builds (parent_build_id);

-- ---------------------------------------------------------------------------
-- battle_reports: after-run summaries, optionally tied to the active build.
-- A few "hot" columns are promoted out for charting/sorting; everything else
-- stays in `parsed`. `raw` keeps the original paste so you can re-parse later
-- if your parser improves.
-- ---------------------------------------------------------------------------
create table battle_reports (
    id          bigint generated always as identity primary key,
    build_id    bigint      references builds (id),
    occurred_at timestamptz not null default now(),
    tier        int,
    wave        int,
    coins       numeric,                 -- normalized to a plain number on entry
    duration_s  int,
    parsed      jsonb       not null default '{}'::jsonb,
    raw         text,
    created_at  timestamptz not null default now()
);

create index battle_reports_build_idx     on battle_reports (build_id);
create index battle_reports_occurred_idx  on battle_reports (occurred_at desc);
