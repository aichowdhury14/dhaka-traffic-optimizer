"""End-to-end pipeline: simulate traffic on cached corridors, load into storage.

Assumes fetch_road_network.py and build_corridors.py have already been run
(these hit OSM/Overpass and are slow, so they're kept as separate one-off steps).

Run:
    python -m src.pipeline.run_pipeline --days 30
"""

import argparse

from src.ingestion.simulate_traffic import simulate_and_save
from src.pipeline.storage import load_dataframe


def run(days: int = 30) -> None:
    df = simulate_and_save(days=days)
    load_dataframe(df, replace=True)
    print(f"Loaded {len(df)} rows into storage.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=30)
    args = parser.parse_args()
    run(days=args.days)
