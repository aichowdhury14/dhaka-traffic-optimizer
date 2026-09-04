"""Fetch Dhaka's drivable road network from OpenStreetMap and cache it locally.

Uses a bounding box around the urban core (not the full administrative
district, which extends into rural/peri-urban areas far beyond any of our
configured corridors) - the full-district polygon query against the public
Overpass API reliably times out. All corridors in src/config.py fall well
within this box.

On this machine, osmnx's own HTTP call to Overpass reliably fails to connect
(TimeoutError at the socket level) even though a plain `requests.post` with
the identical query/headers succeeds immediately. Root cause looks like
osmnx's internal requests.Session/connection-pool handling, not the server -
manual replay of the exact captured query worked every time. So this module
monkeypatches osmnx's request function to use a plain, freshly-created
`requests.post` call per attempt, and otherwise defers to osmnx for query
construction and graph parsing.

Run once (or whenever the cached graph should be refreshed):
    python -m src.ingestion.fetch_road_network
"""

import time

import osmnx as ox
import osmnx._overpass as ov
import requests

from src.config import DATA_RAW, DHAKA_BBOX, ROAD_NETWORK_PATH

MAX_ATTEMPTS = 5
RETRY_DELAY_SECONDS = 5
REQUEST_TIMEOUT_SECONDS = 120


def _plain_overpass_request(params, **kwargs):
    """Drop-in replacement for osmnx._overpass._overpass_request that issues
    a plain requests.post instead of going through osmnx's own session/retry
    machinery, which hangs on this machine (see module docstring)."""
    url = f"{ox.settings.overpass_url.rstrip('/')}/interpreter"
    headers = {
        "User-Agent": ox.settings.http_user_agent,
        "Referer": ox.settings.http_referer,
    }

    last_exc = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            response = requests.post(url, data=params, headers=headers, timeout=REQUEST_TIMEOUT_SECONDS)
            response.raise_for_status()
            return response.json()
        except Exception as exc:
            last_exc = exc
            print(f"  overpass request attempt {attempt}/{MAX_ATTEMPTS} failed: {exc}")
            if attempt < MAX_ATTEMPTS:
                time.sleep(RETRY_DELAY_SECONDS)

    raise RuntimeError(f"Overpass request failed after {MAX_ATTEMPTS} attempts") from last_exc


def fetch_and_save() -> None:
    DATA_RAW.mkdir(parents=True, exist_ok=True)

    print(f"Downloading drivable road network for bbox: {DHAKA_BBOX}")

    ov._overpass_request = _plain_overpass_request
    graph = ox.graph_from_bbox(bbox=DHAKA_BBOX, network_type="drive")

    print(f"Graph: {len(graph.nodes)} nodes, {len(graph.edges)} edges")
    ox.save_graphml(graph, ROAD_NETWORK_PATH)
    print(f"Saved to {ROAD_NETWORK_PATH}")


def load_graph():
    if not ROAD_NETWORK_PATH.exists():
        raise FileNotFoundError(
            f"No cached road network at {ROAD_NETWORK_PATH}. "
            "Run `python -m src.ingestion.fetch_road_network` first."
        )
    return ox.load_graphml(ROAD_NETWORK_PATH)


if __name__ == "__main__":
    fetch_and_save()
