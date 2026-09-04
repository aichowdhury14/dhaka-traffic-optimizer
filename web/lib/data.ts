import { hasDb, query } from "./db";
import { getSeedBaseline, getSeedCorridors, getSeedTraffic } from "./seedData";
import type { BaselineRecord, Corridor, DataSourceMode, TrafficRecord } from "./types";

/**
 * Every data-access function here follows the same pattern: try the live
 * database if DATABASE_URL is configured, and fall back to the bundled JSON
 * seed data on any failure (missing table, connection error, etc). This is
 * what lets the app deploy and run correctly with zero environment
 * configuration, then upgrade to live data transparently once a database is
 * wired up - no code changes needed on either side.
 */

export async function getDataSourceMode(): Promise<DataSourceMode> {
  if (!hasDb()) return "seed";
  try {
    const rows = await query<{ count: number }>("SELECT COUNT(*)::int AS count FROM corridor_traffic");
    const count = rows?.[0]?.count ?? 0;
    return count > 0 ? "live" : "seed";
  } catch {
    return "seed";
  }
}

export async function getCorridors(): Promise<Corridor[]> {
  // Corridor geometry always comes from the bundled seed - it's derived
  // from the OSM road graph offline and doesn't change at runtime.
  return getSeedCorridors();
}

export async function getTraffic(): Promise<TrafficRecord[]> {
  if (hasDb()) {
    try {
      const rows = await query<{
        corridor_id: string;
        timestamp: string;
        hour: number;
        day_of_week: string;
        is_friday: boolean;
        congestion_factor: number;
        travel_minutes: number;
        free_flow_minutes: number;
        avg_speed_kph: number;
      }>(
        `SELECT corridor_id, timestamp, hour, day_of_week, is_friday,
                congestion_factor, travel_minutes, free_flow_minutes, avg_speed_kph
         FROM corridor_traffic
         ORDER BY timestamp DESC
         LIMIT 20000`
      );
      if (rows && rows.length > 0) {
        return rows.map((row) => ({
          ...row,
          timestamp: new Date(row.timestamp).toISOString(),
        }));
      }
    } catch (err) {
      console.error("Live traffic query failed, falling back to seed data:", err);
    }
  }
  return getSeedTraffic();
}

export async function getBaseline(): Promise<BaselineRecord[]> {
  if (hasDb()) {
    try {
      const rows = await query<{
        corridor_id: string;
        hour: number;
        is_friday: boolean;
        baselineFactor: string | number;
      }>(
        `SELECT corridor_id, hour, is_friday,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY congestion_factor) AS "baselineFactor"
         FROM corridor_traffic
         GROUP BY corridor_id, hour, is_friday`
      );
      if (rows && rows.length > 0) {
        return rows.map((row) => ({
          ...row,
          baselineFactor: Number(row.baselineFactor),
        }));
      }
    } catch (err) {
      console.error("Live baseline query failed, falling back to seed data:", err);
    }
  }
  return getSeedBaseline();
}

export function predictFromBaseline(
  baseline: BaselineRecord[],
  corridorId: string,
  hour: number,
  isFriday: boolean
): number {
  const match = baseline.find(
    (b) => b.corridor_id === corridorId && b.hour === hour && b.is_friday === isFriday
  );
  return match ? match.baselineFactor : 1.2;
}
