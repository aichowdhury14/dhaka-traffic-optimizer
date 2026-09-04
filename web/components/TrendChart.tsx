"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrafficRecord } from "@/lib/types";

interface Props {
  traffic: TrafficRecord[];
  corridorId: string | null;
}

export default function TrendChart({ traffic, corridorId }: Props) {
  const data = useMemo(() => {
    const filtered = corridorId ? traffic.filter((t) => t.corridor_id === corridorId) : traffic;

    const buckets: Record<number, { regular: number[]; friday: number[] }> = {};
    for (let h = 0; h < 24; h++) buckets[h] = { regular: [], friday: [] };

    for (const row of filtered) {
      const bucket = row.is_friday ? buckets[row.hour].friday : buckets[row.hour].regular;
      bucket.push(row.congestion_factor);
    }

    return Object.entries(buckets).map(([hour, { regular, friday }]) => ({
      hour: Number(hour),
      regularDay:
        regular.length > 0 ? Number((regular.reduce((a, b) => a + b, 0) / regular.length).toFixed(2)) : null,
      friday: friday.length > 0 ? Number((friday.reduce((a, b) => a + b, 0) / friday.length).toFixed(2)) : null,
    }));
  }, [traffic, corridorId]);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#22303f" />
        <XAxis dataKey="hour" stroke="#64748b" fontSize={12} tickFormatter={(h) => `${h}:00`} />
        <YAxis stroke="#64748b" fontSize={12} domain={[0.9, "auto"]} />
        <Tooltip
          contentStyle={{ background: "#121821", border: "1px solid #22303f", borderRadius: 8, fontSize: 12 }}
          labelFormatter={(h) => `${h}:00`}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <ReferenceLine y={1.0} stroke="#475569" strokeDasharray="4 4" label={{ value: "Free flow", fontSize: 10, fill: "#64748b" }} />
        <Line type="monotone" dataKey="regularDay" name="Regular day" stroke="#3cc7ff" strokeWidth={2} dot={false} connectNulls />
        <Line type="monotone" dataKey="friday" name="Friday" stroke="#ff5a3c" strokeWidth={2} dot={false} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}
