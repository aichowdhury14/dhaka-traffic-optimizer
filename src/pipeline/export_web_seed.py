"""Export corridor geometry + simulated traffic history as JSON for the Next.js app.

The web app (web/) ships with these bundled JSON files as its zero-config
fallback data source, so it runs immediately with no database or API keys.
Once DATABASE_URL/TOMTOM_API_KEY are set, the app prefers live Postgres data
instead - these files stay as the seed/demo dataset.

Run after the usual pipeline (fetch_road_network -> build_corridors ->
run_pipeline):
    python -m src.pipeline.export_web_seed
"""

import json

from src.config import ROOT_DIR
from src.ingestion.build_corridors import load_corridors
from src.pipeline.storage import read_all

WEB_DATA_DIR = ROOT_DIR / "web" / "data"


def export_corridors() -> None:
    corridors = load_corridors()
    out = [
        {
            "id": c["id"],
            "name": c["name"],
            "lengthMeters": c["length_m"],
            "freeFlowMinutes": c["free_flow_minutes"],
            "startLatLon": c["start_latlon"],
            "endLatLon": c["end_latlon"],
            "routeCoords": c["route_coords"],  # [lat, lon] pairs
        }
        for c in corridors
    ]
    path = WEB_DATA_DIR / "corridors.json"
    path.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(out)} corridors -> {path}")


def export_traffic() -> None:
    df = read_all()
    df = df.copy()
    df["timestamp"] = df["timestamp"].astype(str)
    # storage.py persists is_friday as SQLite integer 0/1; normalize to a
    # real JSON boolean so it matches the TypeScript `boolean` field type on
    # the web side (strict equality against `false`/`true` would otherwise
    # silently fail against 0/1).
    df["is_friday"] = df["is_friday"].astype(bool)

    records = df[
        [
            "corridor_id",
            "timestamp",
            "hour",
            "day_of_week",
            "is_friday",
            "congestion_factor",
            "travel_minutes",
            "free_flow_minutes",
            "avg_speed_kph",
        ]
    ].to_dict(orient="records")

    path = WEB_DATA_DIR / "traffic-seed.json"
    path.write_text(json.dumps(records, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(records)} traffic rows -> {path}")

    # Precompute the hourly baseline too, so the deployed app's forecast
    # endpoint has zero cold-start cost when there's no database configured.
    baseline = (
        df.groupby(["corridor_id", "hour", "is_friday"])["congestion_factor"]
        .median()
        .reset_index()
        .rename(columns={"congestion_factor": "baselineFactor"})
    )
    baseline_records = baseline.to_dict(orient="records")
    baseline_path = WEB_DATA_DIR / "baseline-seed.json"
    baseline_path.write_text(json.dumps(baseline_records, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(baseline_records)} baseline rows -> {baseline_path}")


if __name__ == "__main__":
    WEB_DATA_DIR.mkdir(parents=True, exist_ok=True)
    export_corridors()
    export_traffic()
