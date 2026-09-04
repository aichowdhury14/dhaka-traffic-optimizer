export interface Corridor {
  id: string;
  name: string;
  lengthMeters: number;
  freeFlowMinutes: number;
  startLatLon: [number, number];
  endLatLon: [number, number];
  routeCoords: [number, number][]; // [lat, lon] pairs
}

export interface TrafficRecord {
  corridor_id: string;
  timestamp: string;
  hour: number;
  day_of_week: string;
  is_friday: boolean;
  congestion_factor: number;
  travel_minutes: number;
  free_flow_minutes: number;
  avg_speed_kph: number;
}

export interface BaselineRecord {
  corridor_id: string;
  hour: number;
  is_friday: boolean;
  baselineFactor: number;
}

export interface CorridorSummary {
  corridorId: string;
  corridorName: string;
  avgCongestion: number;
  avgSpeedKph: number;
  worstHour: number;
}

export type DataSourceMode = "live" | "seed";
