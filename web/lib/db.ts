import { Pool, QueryResultRow } from "@neondatabase/serverless";

let pool: Pool | null = null;
let poolInitAttempted = false;

/**
 * Returns a connection pool if DATABASE_URL is configured, otherwise null.
 * Callers must treat null as "fall back to bundled seed data" rather than
 * throwing - this is what lets the app run with zero configuration and
 * upgrade to live Postgres transparently once DATABASE_URL is set.
 */
function getPool(): Pool | null {
  if (poolInitAttempted) return pool;
  poolInitAttempted = true;

  const url = process.env.DATABASE_URL;
  if (!url) return null;

  try {
    pool = new Pool({ connectionString: url });
  } catch (err) {
    console.error("Failed to initialize Postgres pool:", err);
    pool = null;
  }
  return pool;
}

/** Runs a parameterized query and returns its rows, or null if no DB is configured. */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T[] | null> {
  const p = getPool();
  if (!p) return null;
  const result = await p.query<T>(text, params);
  return result.rows;
}

export function hasDb(): boolean {
  return getPool() !== null;
}

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS corridor_traffic (
  corridor_id TEXT NOT NULL,
  corridor_name TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  hour INTEGER NOT NULL,
  day_of_week TEXT NOT NULL,
  is_friday BOOLEAN NOT NULL,
  congestion_factor DOUBLE PRECISION NOT NULL,
  travel_minutes DOUBLE PRECISION NOT NULL,
  free_flow_minutes DOUBLE PRECISION NOT NULL,
  avg_speed_kph DOUBLE PRECISION NOT NULL,
  source TEXT NOT NULL DEFAULT 'simulated',
  PRIMARY KEY (corridor_id, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_corridor_traffic_corridor_hour
  ON corridor_traffic (corridor_id, hour);
`;

export async function ensureSchema(): Promise<void> {
  if (!hasDb()) return;
  await query(SCHEMA_SQL);
}
