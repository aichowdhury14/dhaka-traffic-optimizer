"""Resolve each configured corridor to an actual route on the Dhaka road graph.

For every (start, end) pair in src.config.CORRIDORS, geocode the endpoints,
snap them to the nearest graph node, compute the shortest path, and record
the route geometry plus free-flow distance/time. This free-flow travel time
is the baseline against which simulated/real congestion multipliers are applied.

Run after fetch_road_network.py:
    python -m src.ingestion.build_corridors
"""

import json
import time

import networkx as nx
import osmnx as ox

from src.config import CORRIDORS, CORRIDORS_PATH, DATA_RAW
from src.ingestion.fetch_road_network import load_graph

FREE_FLOW_SPEED_KPH = 30  # assumed uncongested urban arterial speed
NOMINATIM_DELAY_SECONDS = 1.0  # be polite to the shared public geocoding endpoint


def resolve_corridor(graph, corridor: dict) -> dict:
    start_point = ox.geocode(corridor["start"])
    time.sleep(NOMINATIM_DELAY_SECONDS)
    end_point = ox.geocode(corridor["end"])
    time.sleep(NOMINATIM_DELAY_SECONDS)

    start_node = ox.distance.nearest_nodes(graph, start_point[1], start_point[0])
    end_node = ox.distance.nearest_nodes(graph, end_point[1], end_point[0])

    route = nx.shortest_path(graph, start_node, end_node, weight="length")
    length_m = nx.shortest_path_length(graph, start_node, end_node, weight="length")

    route_coords = [(graph.nodes[n]["y"], graph.nodes[n]["x"]) for n in route]
    free_flow_minutes = (length_m / 1000) / FREE_FLOW_SPEED_KPH * 60

    return {
        "id": corridor["id"],
        "name": corridor["name"],
        "start_node": start_node,
        "end_node": end_node,
        "start_latlon": start_point,
        "end_latlon": end_point,
        "route_nodes": route,
        "route_coords": route_coords,
        "length_m": round(length_m, 1),
        "free_flow_minutes": round(free_flow_minutes, 2),
    }


def build_and_save() -> None:
    graph = load_graph()
    resolved = []

    for corridor in CORRIDORS:
        print(f"Resolving corridor: {corridor['name']}")
        try:
            resolved.append(resolve_corridor(graph, corridor))
        except Exception as exc:
            print(f"  FAILED ({corridor['id']}): {exc}")

    DATA_RAW.mkdir(parents=True, exist_ok=True)
    with open(CORRIDORS_PATH, "w", encoding="utf-8") as f:
        json.dump(resolved, f, ensure_ascii=False, indent=2)

    print(f"Saved {len(resolved)} corridors to {CORRIDORS_PATH}")


def load_corridors() -> list[dict]:
    if not CORRIDORS_PATH.exists():
        raise FileNotFoundError(
            f"No corridors file at {CORRIDORS_PATH}. "
            "Run `python -m src.ingestion.build_corridors` first."
        )
    with open(CORRIDORS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


if __name__ == "__main__":
    build_and_save()
