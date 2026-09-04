"""Dhaka Traffic & Public Transport Optimization dashboard.

Run:
    streamlit run src/dashboard/app.py
"""

import sys
from pathlib import Path

# allow running via `streamlit run src/dashboard/app.py` from repo root
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

import pandas as pd
import plotly.express as px
import pydeck as pdk
import streamlit as st

from src.ingestion.build_corridors import load_corridors
from src.models.forecast import build_baseline, predict_baseline
from src.pipeline.storage import read_all

st.set_page_config(page_title="Dhaka Traffic Optimizer", layout="wide")


@st.cache_data
def get_data() -> pd.DataFrame:
    return read_all()


@st.cache_data
def get_corridors() -> list[dict]:
    return load_corridors()


st.title("Dhaka Traffic & Public Transport Optimization")
st.caption(
    "Congestion patterns across major Dhaka corridors. Currently running on simulated "
    "traffic calibrated to known rush-hour patterns — swap in a live signal (e.g. TomTom) "
    "via src/ingestion without changing this dashboard."
)

df = get_data()
corridors = get_corridors()
corridor_lookup = {c["id"]: c for c in corridors}

if df.empty:
    st.warning("No traffic data loaded yet. Run the ingestion + simulation pipeline first.")
    st.stop()

# --- Sidebar controls ---
st.sidebar.header("Filters")
corridor_names = ["All corridors"] + sorted(df["corridor_name"].unique().tolist())
selected_corridor = st.sidebar.selectbox("Corridor", corridor_names)

filtered = df if selected_corridor == "All corridors" else df[df["corridor_name"] == selected_corridor]

# --- Top-level metrics ---
col1, col2, col3, col4 = st.columns(4)
col1.metric("Avg congestion factor", f"{filtered['congestion_factor'].mean():.2f}x")
col2.metric("Avg speed", f"{filtered['avg_speed_kph'].mean():.1f} km/h")
col3.metric("Worst hour (city-wide)", f"{df.groupby('hour')['congestion_factor'].mean().idxmax()}:00")
col4.metric("Corridors tracked", f"{df['corridor_id'].nunique()}")

st.divider()

# --- Congestion heatmap: corridor x hour ---
st.subheader("Congestion Heatmap (Corridor x Hour of Day)")
heatmap_data = (
    df.groupby(["corridor_name", "hour"])["congestion_factor"].mean().reset_index()
)
fig_heatmap = px.density_heatmap(
    heatmap_data,
    x="hour",
    y="corridor_name",
    z="congestion_factor",
    color_continuous_scale="RdYlGn_r",
    labels={"hour": "Hour of day", "corridor_name": "Corridor", "congestion_factor": "Congestion factor"},
)
fig_heatmap.update_layout(height=400)
st.plotly_chart(fig_heatmap, use_container_width=True)

# --- Hourly trend for selected corridor ---
st.subheader(f"Hourly Congestion Trend — {selected_corridor}")
hourly = filtered.groupby("hour")["congestion_factor"].agg(["mean", "std"]).reset_index()
fig_line = px.line(hourly, x="hour", y="mean", labels={"hour": "Hour of day", "mean": "Avg congestion factor"})
fig_line.add_hline(y=1.0, line_dash="dot", annotation_text="Free flow", line_color="gray")
st.plotly_chart(fig_line, use_container_width=True)

# --- Weekday vs Friday comparison ---
st.subheader("Weekday vs Friday Pattern")
day_type = filtered.copy()
day_type["day_type"] = day_type["is_friday"].map({1: "Friday", 0: "Regular day"})
fig_day = px.line(
    day_type.groupby(["hour", "day_type"])["congestion_factor"].mean().reset_index(),
    x="hour",
    y="congestion_factor",
    color="day_type",
    labels={"hour": "Hour of day", "congestion_factor": "Avg congestion factor"},
)
st.plotly_chart(fig_day, use_container_width=True)

st.divider()

# --- Route map ---
st.subheader("Corridor Routes")
route_layers = []
for c in corridors:
    coords = [[lon, lat] for lat, lon in c["route_coords"]]
    route_layers.append({"path": coords, "name": c["name"]})

if route_layers:
    layer = pdk.Layer(
        "PathLayer",
        data=route_layers,
        get_path="path",
        get_width=40,
        get_color=[255, 90, 60],
        width_min_pixels=3,
    )
    view_state = pdk.ViewState(latitude=23.8103, longitude=90.4125, zoom=10.5)
    st.pydeck_chart(pdk.Deck(layers=[layer], initial_view_state=view_state, map_style=None))

st.divider()

# --- Best time to travel advisor ---
st.subheader("Best Time to Travel")
baseline = build_baseline(df)
advisor_corridor = st.selectbox("Choose a corridor to plan around", sorted(df["corridor_id"].unique()),
                                 format_func=lambda cid: corridor_lookup.get(cid, {}).get("name", cid))
advisor_day = st.radio("Day type", ["Regular day", "Friday"], horizontal=True)
is_friday = advisor_day == "Friday"

hours = list(range(24))
predictions = [predict_baseline(baseline, advisor_corridor, h, is_friday) for h in hours]
pred_df = pd.DataFrame({"hour": hours, "predicted_congestion": predictions})
best_hour = pred_df.loc[pred_df["predicted_congestion"].idxmin(), "hour"]
worst_hour = pred_df.loc[pred_df["predicted_congestion"].idxmax(), "hour"]

c1, c2 = st.columns(2)
c1.success(f"Best time to travel: **{best_hour}:00** (lowest predicted congestion)")
c2.error(f"Avoid: **{worst_hour}:00** (highest predicted congestion)")

fig_advisor = px.bar(pred_df, x="hour", y="predicted_congestion",
                      labels={"hour": "Hour of day", "predicted_congestion": "Predicted congestion factor"})
st.plotly_chart(fig_advisor, use_container_width=True)
