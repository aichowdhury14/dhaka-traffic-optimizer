"""Generate simulated congestion data on real Dhaka corridors.

This produces a time-series of congestion multipliers per corridor, calibrated
to known Dhaka traffic patterns, so the rest of the pipeline (storage, modeling,
dashboard) can be built and proven out with zero API cost or rate limits. The
schema matches what a real signal (e.g. TomTom) would provide, so swapping the
source later is a drop-in change.

Pattern assumptions baked in (adjust as real data becomes available):
  - Morning rush: ~7:00-10:00, evening rush: ~17:00-20:00
  - Friday (weekly holiday in Bangladesh) has much lighter traffic
  - Random day-to-day noise + occasional "incident" spikes

Run:
    python -m src.ingestion.simulate_traffic --days 30
"""

import argparse
from datetime import datetime, timedelta

import numpy as np
import pandas as pd

from src.config import SIMULATED_TRAFFIC_PATH
from src.ingestion.build_corridors import load_corridors

RNG = np.random.default_rng(seed=42)


def hourly_congestion_factor(hour: int, is_friday: bool) -> float:
    """Base congestion multiplier (1.0 = free flow, higher = slower) by hour."""
    if is_friday:
        # Friday: light traffic all day, small midday bump (prayer/market hours)
        base = 1.15
        if 12 <= hour <= 14:
            base = 1.4
        return base

    # Regular day: two rush-hour humps
    morning_peak = np.exp(-((hour - 8.5) ** 2) / (2 * 1.3 ** 2))
    evening_peak = np.exp(-((hour - 18.5) ** 2) / (2 * 1.5 ** 2))
    base = 1.1 + 2.2 * morning_peak + 2.6 * evening_peak

    # late night floor
    if hour < 5 or hour >= 23:
        base = min(base, 1.05)

    return base


def simulate_corridor(corridor: dict, start: datetime, days: int) -> pd.DataFrame:
    timestamps = pd.date_range(start=start, periods=days * 24, freq="h")
    rows = []

    for ts in timestamps:
        is_friday = ts.weekday() == 4  # Monday=0 ... Friday=4
        base_factor = hourly_congestion_factor(ts.hour, is_friday)

        noise = RNG.normal(loc=1.0, scale=0.08)
        incident = 1.0
        if RNG.random() < 0.02:  # ~2% chance of an incident spike this hour
            incident = RNG.uniform(1.3, 1.8)

        congestion_factor = max(1.0, base_factor * noise * incident)
        travel_minutes = corridor["free_flow_minutes"] * congestion_factor
        avg_speed_kph = (corridor["length_m"] / 1000) / (travel_minutes / 60)

        rows.append(
            {
                "corridor_id": corridor["id"],
                "corridor_name": corridor["name"],
                "timestamp": ts,
                "hour": ts.hour,
                "day_of_week": ts.strftime("%A"),
                "is_friday": is_friday,
                "congestion_factor": round(congestion_factor, 3),
                "travel_minutes": round(travel_minutes, 2),
                "free_flow_minutes": corridor["free_flow_minutes"],
                "avg_speed_kph": round(avg_speed_kph, 1),
            }
        )

    return pd.DataFrame(rows)


def simulate_and_save(days: int = 30) -> pd.DataFrame:
    corridors = load_corridors()
    start = datetime.now().replace(minute=0, second=0, microsecond=0) - timedelta(days=days)

    frames = [simulate_corridor(c, start, days) for c in corridors]
    df = pd.concat(frames, ignore_index=True)

    SIMULATED_TRAFFIC_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(SIMULATED_TRAFFIC_PATH, index=False)
    print(f"Simulated {len(df)} rows across {len(corridors)} corridors -> {SIMULATED_TRAFFIC_PATH}")
    return df


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=30, help="Days of hourly history to simulate")
    args = parser.parse_args()
    simulate_and_save(days=args.days)
