import { NextResponse } from "next/server";
import { getCorridors } from "@/lib/data";

export const revalidate = 3600;

export async function GET() {
  try {
    const corridors = await getCorridors();
    return NextResponse.json({ corridors });
  } catch (err) {
    console.error("GET /api/corridors failed:", err);
    return NextResponse.json({ corridors: [], error: "Failed to load corridors" }, { status: 500 });
  }
}
