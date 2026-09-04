"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Corridor } from "@/lib/types";

interface Props {
  corridors: Corridor[];
  selectedCorridorId: string | null;
  onSelectCorridor: (id: string) => void;
}

interface ForecastResponse {
  predictions: { hour: number; congestionFactor: number }[];
  bestHour: number;
  worstHour: number;
}

function barColor(factor: number): string {
  if (factor < 1.2) return "#22c55e";
  if (factor < 1.6) return "#eab308";
  if (factor < 2.0) return "#f97316";
  return "#ef4444";
}

export default function TravelAdvisor({ corridors, selectedCorridorId, onSelectCorridor }: Props) {
  const [isFriday, setIsFriday] = useState(false);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const corridorId = selectedCorridorId ?? corridors[0]?.id ?? null;

  useEffect(() => {
    if (!corridorId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/forecast?corridorId=${encodeURIComponent(corridorId)}&isFriday=${isFriday}`)
      .then((res) => res.json())
      .then((data: ForecastResponse) => {
        if (!cancelled) setForecast(data);
      })
      .catch((err) => console.error("Forecast fetch failed:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [corridorId, isFriday]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={corridorId ?? ""}
          onChange={(e) => onSelectCorridor(e.target.value)}
          className="rounded-md border border-panelBorder bg-panel px-3 py-1.5 text-sm text-slate-200"
        >
          {corridors.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="flex overflow-hidden rounded-md border border-panelBorder text-sm">
          <button
            onClick={() => setIsFriday(false)}
            className={`px-3 py-1.5 ${!isFriday ? "bg-accent2 text-ink" : "bg-panel text-slate-300"}`}
          >
            Regular day
          </button>
          <button
            onClick={() => setIsFriday(true)}
            className={`px-3 py-1.5 ${isFriday ? "bg-accent2 text-ink" : "bg-panel text-slate-300"}`}
          >
            Friday
          </button>
        </div>
      </div>

      {forecast && !loading && (
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[180px] rounded-lg border border-emerald-800/50 bg-emerald-950/40 px-4 py-3">
            <div className="text-xs text-emerald-400">Best time to travel</div>
            <div className="text-2xl font-semibold text-emerald-300">{forecast.bestHour}:00</div>
          </div>
          <div className="flex-1 min-w-[180px] rounded-lg border border-red-800/50 bg-red-950/40 px-4 py-3">
            <div className="text-xs text-red-400">Avoid</div>
            <div className="text-2xl font-semibold text-red-300">{forecast.worstHour}:00</div>
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={forecast?.predictions ?? []} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#22303f" />
          <XAxis dataKey="hour" stroke="#64748b" fontSize={12} tickFormatter={(h) => `${h}`} />
          <YAxis stroke="#64748b" fontSize={12} domain={[0.9, "auto"]} />
          <Tooltip
            contentStyle={{ background: "#121821", border: "1px solid #22303f", borderRadius: 8, fontSize: 12 }}
            labelFormatter={(h) => `${h}:00`}
          />
          <Bar dataKey="congestionFactor" name="Predicted congestion" radius={[3, 3, 0, 0]}>
            {(forecast?.predictions ?? []).map((entry) => (
              <Cell key={entry.hour} fill={barColor(entry.congestionFactor)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
