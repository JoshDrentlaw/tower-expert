# Tower — build tracker (v1)

A small Deno app that stores **versioned snapshots** of your tower build. A respec is a new
snapshot, so history is preserved; every stat value lives in `builds.data` (jsonb), so changing what
you track never requires a migration.

## Structure

```
tower/
├── deno.json            # tasks + import map
├── .env.example
├── Dockerfile
├── main.ts              # HTTP server + router (BASE_PATH-aware)
├── app/
│   ├── stat_schema.ts   # EDIT ME: the categories/fields the form collects
│   ├── views.ts         # server-rendered HTML (layout, form, list, detail)
│   └── routes/builds.ts # list / new / save / detail handlers
└── db/
    ├── db.ts            # Postgres.js data-access layer
    └── migrations/001_init.sql
```

## Routes

| Method | Path                            | Purpose                                 |
| ------ | ------------------------------- | --------------------------------------- |
| GET    | `/tower/builds`                 | History of snapshots                    |
| GET    | `/tower/builds/new`             | Blank entry form                        |
| GET    | `/tower/builds/new?from=latest` | Prefilled from your last build (respec) |
| GET    | `/tower/builds/new?from=<id>`   | Prefilled from a specific build         |
| POST   | `/tower/builds`                 | Save a new snapshot                     |
| GET    | `/tower/builds/:id`             | View a snapshot                         |

## Setup

**1. Dedicated database + least-privilege role** in your existing `chores-postgres` (keep it
isolated from the chores tables):

```sql
-- run as the postgres superuser inside the chores-postgres container
CREATE ROLE tower LOGIN PASSWORD 'a-strong-password';
CREATE DATABASE tower OWNER tower;
-- tower owns only this DB; it has no rights on the chores database.
```

**2. Apply the schema:**

```bash
docker compose exec -T chores-postgres \
  psql -U tower -d tower < db/migrations/001_init.sql
```

**3. Configure + run (dev):**

```bash
cp .env.example .env   # set DATABASE_URL password, keep BASE_PATH=/tower
deno task dev          # http://localhost:8787/tower/builds
deno check main.ts     # run a typecheck (I couldn't in my sandbox)
```

## Deploy on Nucklehead

**Compose** (under `/srv/home-automation/tower`). The app must reach `chores-postgres` by name, so
put it on that container's network — same fix you used for the chores↔n8n isolation:

```yaml
services:
  tower:
    build: .
    env_file: .env
    restart: unless-stopped
    ports: ["8787:8787"]
    networks: [tower_default, chores_default] # external join to reach the DB

networks:
  chores_default:
    external: true
```

(or `docker network connect chores_default tower` after the fact.)

**Caddy** — uses `handle` (not `handle_path`), matching your existing blocks; the app is
`BASE_PATH`-aware so the `/tower` prefix is preserved end to end:

```caddyfile
handle /tower* {
    reverse_proxy localhost:8787
}
```

## Security notes

- **Isolated DB + role**: `tower` owns only the `tower` database — no access to chores data. Least
  privilege by construction.
- **Minimal Deno perms**: runs with `--allow-net --allow-env` only. No `--allow-run`, no
  `--allow-write`, no Docker socket.
- **No public ingress**: reachable only via Caddy behind Tailscale.
- **Secrets**: `DATABASE_URL` lives in `.env` — folds straight into the SOPS/Infisical plan
  alongside your other stack secrets.

## Next slices

- **Battle-report paste route** — `db.ts` already has `insertBattleReport()`; add a
  `POST /tower/reports` that parses your after-run paste into the promoted columns + `parsed` jsonb.
  This becomes the performance stream for history charts.
- **Diff view** — compare a build against its `parent_build_id` to show exactly what a respec
  changed.
- **Contextual chat** — inject the selected snapshot + recent reports + game knowledge into a Claude
  API call.
- **Telegram quick-query client** — reads the latest snapshot for mid-run questions.
- **Screenshot ingestion (optional)** — vision extraction → editable preview, if clone-and-edit ever
  gets tedious.
