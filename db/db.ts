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
    values (${b.label}, ${b.note}, ${b.parent_build_id}, ${sql.json(b.data)})
    returning id`;
  return rows[0].id;
}

// Provided for the next slice (battle-report paste route). Not yet wired
// into a route — included so the schema and DAL stay in step.
export async function insertBattleReport(r: {
  build_id: number | null;
  tier: number | null;
  wave: number | null;
  coins: number | null;
  duration_s: number | null;
  parsed: Record<string, unknown>;
  raw: string | null;
}): Promise<number> {
  const rows = await sql<{ id: number }[]>`
    insert into battle_reports (build_id, tier, wave, coins, duration_s, parsed, raw)
    values (${r.build_id}, ${r.tier}, ${r.wave}, ${r.coins},
            ${r.duration_s}, ${sql.json(r.parsed)}, ${r.raw})
    returning id`;
  return rows[0].id;
}
