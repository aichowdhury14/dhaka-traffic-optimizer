from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_RAW = ROOT_DIR / "data" / "raw"
DATA_PROCESSED = ROOT_DIR / "data" / "processed"

DHAKA_CENTER = (23.8103, 90.4125)
DHAKA_PLACE_QUERY = "Dhaka, Bangladesh"

# Bounding box (left, bottom, right, top) = (west, south, east, north) around
# Dhaka's urban core, covering every corridor in CORRIDORS below (Uttara in
# the north to Jatrabari in the south, Mirpur/Gabtoli in the west to Badda in
# the east). Used instead of the full administrative district polygon, which
# is ~11x larger and reliably times out against the public Overpass API.
DHAKA_BBOX = (90.30, 23.68, 90.47, 23.90)

ROAD_NETWORK_PATH = DATA_RAW / "dhaka_road_network.graphml"
CORRIDORS_PATH = DATA_RAW / "corridors.geojson"
SIMULATED_TRAFFIC_PATH = DATA_PROCESSED / "simulated_traffic.parquet"

# Known congestion-heavy corridors in Dhaka, defined as (start, end) place queries
# geocoded via OSM. Used to build representative routes on the road graph rather
# than tracking every edge in the city.
CORRIDORS = [
    {"id": "mirpur_farmgate", "name": "Mirpur 10 -> Farmgate", "start": "Mirpur 10, Dhaka", "end": "Farmgate, Dhaka"},
    {"id": "farmgate_motijheel", "name": "Farmgate -> Motijheel", "start": "Farmgate, Dhaka", "end": "Motijheel, Dhaka"},
    {"id": "uttara_airport", "name": "Uttara -> Airport", "start": "Uttara, Dhaka", "end": "Hazrat Shahjalal International Airport, Dhaka"},
    {"id": "gulshan_banani", "name": "Gulshan -> Banani", "start": "Gulshan 1, Dhaka", "end": "Banani, Dhaka"},
    {"id": "mohakhali_badda", "name": "Mohakhali -> Badda", "start": "Mohakhali, Dhaka", "end": "Badda, Dhaka"},
    {"id": "jatrabari_motijheel", "name": "Jatrabari -> Motijheel", "start": "Jatrabari, Dhaka", "end": "Motijheel, Dhaka"},
    {"id": "dhanmondi_newmarket", "name": "Dhanmondi -> New Market", "start": "Dhanmondi 27, Dhaka", "end": "New Market, Dhaka"},
    {"id": "mirpur_gabtoli", "name": "Mirpur -> Gabtoli", "start": "Mirpur 1, Dhaka", "end": "Gabtoli, Mirpur, Dhaka"},
]
