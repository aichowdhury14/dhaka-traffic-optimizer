"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef } from "react";
import Map, { Layer, MapRef, Source, Popup } from "react-map-gl/maplibre";
import type { LineLayerSpecification } from "maplibre-gl";
import type { Corridor, TrafficRecord } from "@/lib/types";
import { useState } from "react";

const DHAKA_CENTER: [number, number] = [90.4125, 23.8103];

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;
const STYLE_URL = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${MAPTILER_KEY}`
  : "https://demotiles.maplibre.org/style.json";

function congestionColor(factor: number): string {
  // 1.0 (free flow) -> green, ~2.0+ (heavy) -> red
  if (factor < 1.2) return "#22c55e";
  if (factor < 1.6) return "#eab308";
  if (factor < 2.0) return "#f97316";
  return "#ef4444";
}

interface Props {
  corridors: Corridor[];
  avgCongestionByCorridor: Record<string, number>;
  selectedCorridorId: string | null;
  onSelectCorridor: (id: string) => void;
}

export default function CongestionMap({
  corridors,
  avgCongestionByCorridor,
  selectedCorridorId,
  onSelectCorridor,
}: Props) {
  const mapRef = useRef<MapRef>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const geojson = useMemo(() => {
    return {
      type: "FeatureCollection" as const,
      features: corridors.map((c) => ({
        type: "Feature" as const,
        properties: {
          id: c.id,
          name: c.name,
          congestion: avgCongestionByCorridor[c.id] ?? 1.0,
          color: congestionColor(avgCongestionByCorridor[c.id] ?? 1.0),
        },
        geometry: {
          type: "LineString" as const,
          coordinates: c.routeCoords.map(([lat, lon]) => [lon, lat]),
        },
      })),
    };
  }, [corridors, avgCongestionByCorridor]);

  const lineLayer: LineLayerSpecification = {
    id: "corridor-lines",
    type: "line",
    source: "corridors",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": ["get", "color"],
      "line-width": [
        "case",
        ["==", ["get", "id"], selectedCorridorId ?? ""],
        7,
        ["==", ["get", "id"], hoveredId ?? ""],
        6,
        4,
      ],
      "line-opacity": 0.9,
    },
  };

  const hoveredCorridor = corridors.find((c) => c.id === hoveredId);
  const hoveredMidpoint = hoveredCorridor
    ? hoveredCorridor.routeCoords[Math.floor(hoveredCorridor.routeCoords.length / 2)]
    : null;

  return (
    <Map
      ref={mapRef}
      initialViewState={{ longitude: DHAKA_CENTER[0], latitude: DHAKA_CENTER[1], zoom: 11 }}
      style={{ width: "100%", height: "100%" }}
      mapStyle={STYLE_URL}
      interactiveLayerIds={["corridor-lines"]}
      onMouseMove={(e) => {
        const feature = e.features?.[0];
        setHoveredId((feature?.properties?.id as string) ?? null);
      }}
      onClick={(e) => {
        const feature = e.features?.[0];
        const id = feature?.properties?.id as string | undefined;
        if (id) onSelectCorridor(id);
      }}
      cursor={hoveredId ? "pointer" : "grab"}
    >
      <Source id="corridors" type="geojson" data={geojson}>
        <Layer {...lineLayer} />
      </Source>
      {hoveredCorridor && hoveredMidpoint && (
        <Popup
          longitude={hoveredMidpoint[1]}
          latitude={hoveredMidpoint[0]}
          closeButton={false}
          closeOnClick={false}
          offset={12}
        >
          <div className="text-sm font-medium text-slate-900">{hoveredCorridor.name}</div>
          <div className="text-xs text-slate-600">
            Avg congestion: {(avgCongestionByCorridor[hoveredCorridor.id] ?? 1).toFixed(2)}x
          </div>
        </Popup>
      )}
    </Map>
  );
}

export function computeAvgCongestionByCorridor(traffic: TrafficRecord[]): Record<string, number> {
  const sums: Record<string, { sum: number; count: number }> = {};
  for (const row of traffic) {
    if (!sums[row.corridor_id]) sums[row.corridor_id] = { sum: 0, count: 0 };
    sums[row.corridor_id].sum += row.congestion_factor;
    sums[row.corridor_id].count += 1;
  }
  const result: Record<string, number> = {};
  for (const [id, { sum, count }] of Object.entries(sums)) {
    result[id] = count > 0 ? sum / count : 1.0;
  }
  return result;
}
