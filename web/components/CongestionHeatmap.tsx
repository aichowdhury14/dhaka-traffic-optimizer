"use client";

import { useMemo } from "react";
import type { Corridor, TrafficRecord } from "@/lib/types";

interface Props {
  corridors: Corridor[];
  traffic: TrafficRecord[];
}

function cellColor(factor: number): string {
  if (factor < 1.15) return "#14532d";
  if (factor < 1.4) return "#4d7c0f";
  if (factor < 1.7) return "#ca8a04";
  if (factor < 2.1) return "#c2410c";
  return "#991b1b";
}

export default function CongestionHeatmap({ corridors, traffic }: Props) {
  const matrix = useMemo(() => {
    const sums: Record<string, Record<number, { sum: number; count: number }>> = {};
    for (const row of traffic) {
      if (!sums[row.corridor_id]) sums[row.corridor_id] = {};
      if (!sums[row.corridor_id][row.hour]) sums[row.corridor_id][row.hour] = { sum: 0, count: 0 };
      sums[row.corridor_id][row.hour].sum += row.congestion_factor;
      sums[row.corridor_id][row.hour].count += 1;
    }
    return sums;
  }, [traffic]);

  const hours = Array.from({ length: 24 }, (_, h) => h);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-[2px] text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-panel px-2 py-1 text-left font-medium text-slate-400">
              Corridor
            </th>
            {hours.map((h) => (
              <th key={h} className="min-w-[26px] px-0 py-1 text-center font-normal text-slate-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {corridors.map((c) => (
            <tr key={c.id}>
              <td className="sticky left-0 z-10 whitespace-nowrap bg-panel px-2 py-1 text-slate-300">
                {c.name}
              </td>
              {hours.map((h) => {
                const cell = matrix[c.id]?.[h];
                const avg = cell && cell.count > 0 ? cell.sum / cell.count : null;
                return (
                  <td
                    key={h}
                    title={avg !== null ? `${c.name} @ ${h}:00 — ${avg.toFixed(2)}x` : "no data"}
                    className="h-6 w-[26px] rounded-sm"
                    style={{ backgroundColor: avg !== null ? cellColor(avg) : "#1e293b" }}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
