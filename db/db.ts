// db.ts — thin data-access layer (Postgres.js)
//
// NOTE: I'm using Postgres.js (npm:postgres) for ergonomic tagged-template
// queries. If your chores app already standardizes on a different client,
// swap this out for consistency — nothing else here depends on the choice.

import postgres from "postgres";

const url = Deno.env.get("DATABASE_URL");
if (!url) throw new Error("DATABASE_URL is not set");

export const sql = postgres(url);

export interface Build {
  id: number;
  label: string;
  note: string | null;
  parent_build_id: number | null;
  data: Record<string, Record<string, unknown>>;
  created_at: string;
}

export function listBuilds(): Promise<Build[]> {
  return sql<Build[]>`
    select id, label, note, parent_build_id, data, created_at
    from builds
    order by created_at desc
    limit 100`;
}

export async function getBuild(id: number): Promise<Build | undefined> {
  const rows = await sql<Build[]>`
    select id, label, note, parent_build_id, data, created_at
    from builds
    where id = ${id}`;
  return rows[0];
}

export async function getLatestBuild(): Promise<Build | undefined> {
  const rows = await sql<Build[]>`
    select id, label, note, parent_build_id, data, created_at
    from builds
    order by created_at desc
    limit 1`;
  return rows[0];
}

export async function insertBuild(b: {
  label: string;
  note: string | null;
  parent_build_id: number | null;
  data: Record<string, unknown>;
}): Promise<number> {
  const rows = await sql<{ id: number }[]>`
    insert into builds (label, note, parent_build_id, data)
    values (${b.label}, ${b.note}, ${b.parent_build_id}, ${
    sql.json(b.data as Parameters<typeof sql.json>[0])
  })
    returning id`;
  return rows[0].id;
}

// Edit a build in place (used when leveling — not a respec). Updates label,
// note, and the full stat data. Returns the id, or undefined if no such build.
export async function updateBuild(id: number, b: {
  label: string;
  note: string | null;
  data: Record<string, unknown>;
}): Promise<number | undefined> {
  const rows = await sql<{ id: number }[]>`
    update builds
    set label = ${b.label}, note = ${b.note}, data = ${
    sql.json(b.data as Parameters<typeof sql.json>[0])
  }
    where id = ${id}
    returning id`;
  return rows[0]?.id;
}

export interface BattleReport {
  id: number;
  build_id: number | null;
  build_label?: string | null;
  occurred_at: string;
  date_inferred: boolean; // true when "Battle Date" was missing/unparseable; occurred_at = insert time
  tier: number | null;
  wave: number | null;
  coins: number | null;
  duration_s: number | null;
  parsed: Record<string, Record<string, string>>;
  raw: string | null;
  created_at: string;
}

export function listReports(): Promise<BattleReport[]> {
  return sql<BattleReport[]>`
    select r.id, r.build_id, b.label as build_label,
           r.occurred_at, r.tier, r.wave, r.coins, r.duration_s, r.created_at,
           (abs(extract(epoch from (r.occurred_at - r.created_at))) < 10) as date_inferred
    from battle_reports r
    left join builds b on b.id = r.build_id
    order by r.occurred_at desc
    limit 100`;
}

export async function getReport(id: number): Promise<BattleReport | undefined> {
  const rows = await sql<BattleReport[]>`
    select r.id, r.build_id, b.label as build_label,
           r.occurred_at, r.tier, r.wave, r.coins, r.duration_s,
           r.parsed, r.raw, r.created_at,
           (abs(extract(epoch from (r.occurred_at - r.created_at))) < 10) as date_inferred
    from battle_reports r
    left join builds b on b.id = r.build_id
    where r.id = ${id}`;
  return rows[0];
}

export async function insertBattleReport(r: {
  build_id: number | null;
  occurred_at: string; // caller passes now() when date was missing/unparseable in paste
  tier: number | null;
  wave: number | null;
  coins: number | null;
  duration_s: number | null;
  parsed: Record<string, unknown>;
  raw: string | null;
}): Promise<number> {
  const rows = await sql<{ id: number }[]>`
    insert into battle_reports (build_id, occurred_at, tier, wave, coins, duration_s, parsed, raw)
    values (${r.build_id}, ${r.occurred_at}, ${r.tier}, ${r.wave}, ${r.coins},
            ${r.duration_s}, ${sql.json(r.parsed as Parameters<typeof sql.json>[0])}, ${r.raw})
    returning id`;
  return rows[0].id;
}
