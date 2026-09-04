# Dhaka Traffic Optimizer — Web

Next.js dashboard for Dhaka corridor congestion analytics, built to deploy on Vercel.

Runs with **zero configuration** on bundled seed data (real Dhaka road geometry +
30 days of simulated, rush-hour-calibrated traffic), and upgrades transparently
to live data once `DATABASE_URL` and `TOMTOM_API_KEY` are set — no code changes
needed either way.

## Stack

- **Next.js 15** (App Router) — pages + API routes, deploys natively on Vercel
- **MapLibre GL** (via `react-map-gl/maplibre`) — interactive corridor map, no vendor lock-in
- **Recharts** — heatmap, trend chart, forecast bar chart
- **Neon Postgres** (`@neondatabase/serverless`) — optional live data store
- **TomTom Traffic API** — optional real congestion signal

## Local development

```bash
npm install
npm run dev
```

Opens at http://localhost:3000, reading from `data/*.json` (bundled seed data,
exported from the Python pipeline in `../src/pipeline/export_web_seed.py`).

## Environment variables

Copy `.env.example` to `.env.local`. Every variable is optional:

| Variable | Effect when set |
|---|---|
| `DATABASE_URL` | App reads/writes live Postgres instead of seed JSON |
| `TOMTOM_API_KEY` | `/api/sync-tomtom` pulls real congestion data (needs `DATABASE_URL` too) |
| `CRON_SECRET` | Protects `/api/sync-tomtom` from public invocation |
| `NEXT_PUBLIC_MAPTILER_KEY` | Polished vector basemap (falls back to a basic demo style if unset) |

## Deploying to Vercel

1. Push this repo (or just the `web/` directory as the project root) to GitHub.
2. Import into Vercel. No build config needed — it auto-detects Next.js.
3. Optional, for live data:
   - Create a Neon Postgres database (Vercel's Storage tab can provision one directly) and add `DATABASE_URL`.
   - Get a free TomTom API key at https://developer.tomtom.com/ and add `TOMTOM_API_KEY`.
   - Set a `CRON_SECRET` (any random string) — `vercel.json` already schedules `/api/sync-tomtom` hourly via Vercel Cron.
   - Get a free MapTiler key at https://cloud.maptiler.com/ and add `NEXT_PUBLIC_MAPTILER_KEY` for the nicer basemap.
4. Redeploy after adding env vars (Vercel doesn't hot-reload them into a running deployment).

Without any of the above, the deployed app works immediately on the bundled
seed data — a fully functional demo with real Dhaka road geometry.

## Refreshing the seed data

The seed data in `data/*.json` is exported from the Python pipeline. To
regenerate it (e.g. after editing corridors in `../src/config.py`):

```bash
cd ..
python -m src.ingestion.fetch_road_network   # slow, one-off
python -m src.ingestion.build_corridors
python -m src.pipeline.run_pipeline --days 30
python -m src.pipeline.export_web_seed
```

## Known residual risk

`npm audit` reports 1 high-severity finding in `postcss`, pinned as a
transitive dependency *inside* `next`'s own `node_modules` (not our direct
dependency). It concerns arbitrary file/sourcemap reads during the build
step — not an attack surface reachable by end users of the deployed site.
Resolving it requires Next.js 16, which wasn't validated here; revisit when
upgrading Next major versions.

## Architecture notes

- `lib/data.ts` is the single data-access layer — every API route goes
  through it, and it's the only place that decides live-vs-seed.
- `lib/db.ts` wraps `@neondatabase/serverless`'s `Pool` with a
  `query(text, params)` helper; returns `null`/no-ops everywhere if
  `DATABASE_URL` is unset rather than throwing.
- Corridor geometry (`lib/seedData.ts` → `getSeedCorridors`) always comes
  from the bundled JSON — it's derived from the OSM road graph offline and
  doesn't need a database.
