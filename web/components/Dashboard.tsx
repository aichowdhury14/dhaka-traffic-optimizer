"use client";

import { useEffect, useMemo, useState } from "react";
import type { Corridor, DataSourceMode, TrafficRecord } from "@/lib/types";
import CongestionMap, { computeAvgCongestionByCorridor } from "./CongestionMap";
import CongestionHeatmap from "./CongestionHeatmap";
import TrendChart from "./TrendChart";
import TravelAdvisor from "./TravelAdvisor";

export default function Dashboard() {
  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [traffic, setTraffic] = useState<TrafficRecord[]>([]);
  const [mode, setMode] = useState<DataSourceMode>("seed");
  const [selectedCorridorId, setSelectedCorridorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch("/api/corridors").then((r) => r.json()),
      fetch("/api/traffic").then((r) => r.json()),
    ])
      .then(([corridorsRes, trafficRes]) => {
        if (cancelled) return;
        setCorridors(corridorsRes.corridors ?? []);
        setTraffic(trafficRes.traffic ?? []);
        setMode(trafficRes.mode ?? "seed");
      })
      .catch((err) => {
        console.error("Dashboard data load failed:", err);
        if (!cancelled) setError("Failed to load traffic data. Please refresh.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const avgCongestionByCorridor = useMemo(() => computeAvgCongestionByCorridor(traffic), [traffic]);

  const cityAvgCongestion = useMemo(() => {
    if (traffic.length === 0) return 1;
    return traffic.reduce((sum, t) => sum + t.congestion_factor, 0) / traffic.length;
  }, [traffic]);

  const cityAvgSpeed = useMemo(() => {
    if (traffic.length === 0) return 0;
    return traffic.reduce((sum, t) => sum + t.avg_speed_kph, 0) / traffic.length;
  }, [traffic]);

  const worstHour = useMemo(() => {
    const byHour: Record<number, { sum: number; count: number }> = {};
    for (const t of traffic) {
      if (!byHour[t.hour]) byHour[t.hour] = { sum: 0, count: 0 };
      byHour[t.hour].sum += t.congestion_factor;
      byHour[t.hour].count += 1;
    }
    let worst = 0;
    let worstAvg = 0;
    for (const [hour, { sum, count }] of Object.entries(byHour)) {
      const avg = sum / count;
      if (avg > worstAvg) {
        worstAvg = avg;
        worst = Number(hour);
      }
    }
    return worst;
  }, [traffic]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="rounded-lg border border-red-800/50 bg-red-950/40 px-6 py-4 text-red-300">{error}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Dhaka Traffic <span className="text-accent">Optimizer</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Congestion analytics and route planning across Dhaka&apos;s major corridors.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-panelBorder bg-panel px-3 py-1.5 text-xs">
          <span
            className={`h-2 w-2 rounded-full ${mode === "live" ? "bg-emerald-400" : "bg-amber-400"}`}
          />
          {mode === "live" ? "Live data" : "Demo data (simulated)"}
        </div>
      </header>

      {loading ? (
        <div className="flex flex-1 items-center justify-center py-24 text-slate-500">Loading corridors and traffic data…</div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Avg congestion" value={`${cityAvgCongestion.toFixed(2)}x`} />
            <StatCard label="Avg speed" value={`${cityAvgSpeed.toFixed(1)} km/h`} />
            <StatCard label="Worst hour" value={`${worstHour}:00`} />
            <StatCard label="Corridors tracked" value={`${corridors.length}`} />
          </section>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3 overflow-hidden rounded-xl border border-panelBorder bg-panel">
              <div className="h-[480px] w-full">
                <CongestionMap
                  corridors={corridors}
                  avgCongestionByCorridor={avgCongestionByCorridor}
                  selectedCorridorId={selectedCorridorId}
                  onSelectCorridor={setSelectedCorridorId}
                />
              </div>
            </div>
            <div className="lg:col-span-2 rounded-xl border border-panelBorder bg-panel p-4">
              <h2 className="mb-3 text-sm font-medium text-slate-300">Best Time to Travel</h2>
              <TravelAdvisor
                corridors={corridors}
                selectedCorridorId={selectedCorridorId}
                onSelectCorridor={setSelectedCorridorId}
              />
            </div>
          </section>

          <section className="rounded-xl border border-panelBorder bg-panel p-4">
            <h2 className="mb-3 text-sm font-medium text-slate-300">
              Hourly Trend {selectedCorridorId ? `— ${corridors.find((c) => c.id === selectedCorridorId)?.name}` : "(all corridors)"}
            </h2>
            <TrendChart traffic={traffic} corridorId={selectedCorridorId} />
          </section>

          <section className="rounded-xl border border-panelBorder bg-panel p-4">
            <h2 className="mb-3 text-sm font-medium text-slate-300">Congestion Heatmap</h2>
            <CongestionHeatmap corridors={corridors} traffic={traffic} />
          </section>
        </>
      )}

      <footer className="pb-6 pt-2 text-center text-xs text-slate-600">
        Built on real Dhaka road network data (OpenStreetMap). {mode === "seed" && "Currently showing simulated traffic — connect TOMTOM_API_KEY and DATABASE_URL for live data."}
      </footer>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-panelBorder bg-panel px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-slate-100">{value}</div>
    </div>
  );
}
