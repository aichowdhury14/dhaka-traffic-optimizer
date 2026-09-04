import fs from "fs";
import path from "path";
import type { BaselineRecord, Corridor, TrafficRecord } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

function readJson<T>(filename: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, filename), "utf-8");
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(`Could not read seed file ${filename}:`, err);
    return fallback;
  }
}

let corridorsCache: Corridor[] | null = null;
let trafficCache: TrafficRecord[] | null = null;
let baselineCache: BaselineRecord[] | null = null;

export function getSeedCorridors(): Corridor[] {
  if (!corridorsCache) corridorsCache = readJson<Corridor[]>("corridors.json", []);
  return corridorsCache;
}

export function getSeedTraffic(): TrafficRecord[] {
  if (!trafficCache) trafficCache = readJson<TrafficRecord[]>("traffic-seed.json", []);
  return trafficCache;
}

export function getSeedBaseline(): BaselineRecord[] {
  if (!baselineCache) baselineCache = readJson<BaselineRecord[]>("baseline-seed.json", []);
  return baselineCache;
}
