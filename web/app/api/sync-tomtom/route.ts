import { NextResponse } from "next/server";
import { ensureSchema, hasDb, query } from "@/lib/db";
import { getSeedCorridors } from "@/lib/seedData";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface TomTomFlowResponse {
  flowSegmentData?: {
    currentSpeed: number;
    freeFlowSpeed: number;
    currentTravelTime: number;
    freeFlowTravelTime: number;
  };
}

/**
 * Pulls current congestion for every configured corridor from TomTom's
 * Traffic Flow API and appends it to corridor_traffic. Intended to be hit
 * on a schedule (Vercel Cron) so the table accumulates real history over
 * time - the more runs, the better the hourly baseline/forecast gets.
 *
 * No-ops safely (200, skipped: true) if TOMTOM_API_KEY or DATABASE_URL are
 * unset, so it's safe to wire into a cron job before those are configured.
 *
 * Auth: requires header `Authorization: Bearer $CRON_SECRET` if CRON_SECRET
 * is set, matching Vercel Cron's convention for protecting endpoints.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const tomtomKey = process.env.TOMTOM_API_KEY;

  if (!tomtomKey || !hasDb()) {
    return NextResponse.json({
      skipped: true,
      reason: !tomtomKey ? "TOMTOM_API_KEY not set" : "DATABASE_URL not set",
    });
  }

  await ensureSchema();

  const corridors = getSeedCorridors();
  const now = new Date();
  const hour = now.getUTCHours();
  const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long", timeZone: "Asia/Dhaka" });
  const isFriday = dayOfWeek === "Friday";

  let synced = 0;
  const errors: string[] = [];

  for (const corridor of corridors) {
    try {
      // Sample the midpoint of the route for a representative flow reading.
      const mid = corridor.routeCoords[Math.floor(corridor.routeCoords.length / 2)];
      const [lat, lon] = mid;

      const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${lat},${lon}&key=${tomtomKey}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        errors.push(`${corridor.id}: TomTom returned ${res.status}`);
        continue;
      }

      const data = (await res.json()) as TomTomFlowResponse;
      const flow = data.flowSegmentData;
      if (!flow || flow.freeFlowTravelTime <= 0) {
        errors.push(`${corridor.id}: no flow data`);
        continue;
      }

      const congestionFactor = flow.currentTravelTime / flow.freeFlowTravelTime;
      const travelMinutes = corridor.freeFlowMinutes * congestionFactor;
      const avgSpeedKph = corridor.lengthMeters / 1000 / (travelMinutes / 60);

      await query(
        `INSERT INTO corridor_traffic
           (corridor_id, corridor_name, timestamp, hour, day_of_week, is_friday,
            congestion_factor, travel_minutes, free_flow_minutes, avg_speed_kph, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'tomtom')
         ON CONFLICT (corridor_id, timestamp) DO NOTHING`,
        [
          corridor.id,
          corridor.name,
          now.toISOString(),
          hour,
          dayOfWeek,
          isFriday,
          congestionFactor,
          travelMinutes,
          corridor.freeFlowMinutes,
          avgSpeedKph,
        ]
      );
      synced++;
    } catch (err) {
      errors.push(`${corridor.id}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  return NextResponse.json({ synced, total: corridors.length, errors });
}
