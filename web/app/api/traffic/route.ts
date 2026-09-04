import { NextResponse } from "next/server";
import { getDataSourceMode, getTraffic } from "@/lib/data";

export const revalidate = 300;

export async function GET() {
  try {
    const [traffic, mode] = await Promise.all([getTraffic(), getDataSourceMode()]);
    return NextResponse.json({ traffic, mode });
  } catch (err) {
    console.error("GET /api/traffic failed:", err);
    return NextResponse.json({ traffic: [], mode: "seed", error: "Failed to load traffic data" }, { status: 500 });
  }
}
