import { NextResponse } from "next/server";
import { getBaseline, predictFromBaseline } from "@/lib/data";

export const revalidate = 300;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const corridorId = searchParams.get("corridorId");
    const isFriday = searchParams.get("isFriday") === "true";

    if (!corridorId) {
      return NextResponse.json({ error: "corridorId query param is required" }, { status: 400 });
    }

    const baseline = await getBaseline();
    const hours = Array.from({ length: 24 }, (_, h) => h);
    const predictions = hours.map((hour) => ({
      hour,
      congestionFactor: predictFromBaseline(baseline, corridorId, hour, isFriday),
    }));

    const best = predictions.reduce((a, b) => (b.congestionFactor < a.congestionFactor ? b : a));
    const worst = predictions.reduce((a, b) => (b.congestionFactor > a.congestionFactor ? b : a));

    return NextResponse.json({ predictions, bestHour: best.hour, worstHour: worst.hour });
  } catch (err) {
    console.error("GET /api/forecast failed:", err);
    return NextResponse.json({ error: "Failed to compute forecast" }, { status: 500 });
  }
}
