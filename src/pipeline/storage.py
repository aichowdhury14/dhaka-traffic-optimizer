"""SQLite-backed storage for corridor traffic data.

Starts on SQLite (zero setup) with a schema that maps directly onto Postgres
+ PostGIS later — swapping DATABASE_URL to a postgres:// DSN is the only
change needed once real geospatial queries are worth the extra setup.
"""

import os
from pathlib import Path

import pandas as pd
from sqlalchemy import create_engine, text

from src.config import DATA_PROCESSED

DEFAULT_SQLITE_PATH = DATA_PROCESSED / "traffic.db"
DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{DEFAULT_SQLITE_PATH}")

SCHEMA = """
CREATE TABLE IF NOT EXISTS corridor_traffic (
    corridor_id TEXT NOT NULL,
    corridor_name TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    hour INTEGER NOT NULL,
    day_of_week TEXT NOT NULL,
    is_friday INTEGER NOT NULL,
    congestion_factor REAL NOT NULL,
    travel_minutes REAL NOT NULL,
    free_flow_minutes REAL NOT NULL,
    avg_speed_kph REAL NOT NULL,
    PRIMARY KEY (corridor_id, timestamp)
);
"""


def get_engine():
    DATA_PROCESSED.mkdir(parents=True, exist_ok=True)
    return create_engine(DATABASE_URL)


def init_db() -> None:
    engine = get_engine()
    with engine.begin() as conn:
        conn.execute(text(SCHEMA))


def load_dataframe(df: pd.DataFrame, replace: bool = True) -> None:
    """Load rows into corridor_traffic. If replace=True (default), clears the
    table first so re-running ingestion doesn't hit the primary key constraint
    or duplicate rows."""
    init_db()
    engine = get_engine()
    df = df.copy()
    df["timestamp"] = df["timestamp"].astype(str)
    df["is_friday"] = df["is_friday"].astype(int)

    with engine.begin() as conn:
        if replace:
            conn.execute(text("DELETE FROM corridor_traffic"))
        df.to_sql("corridor_traffic", conn, if_exists="append", index=False, method="multi", chunksize=500)


def read_all() -> pd.DataFrame:
    engine = get_engine()
    with engine.begin() as conn:
        df = pd.read_sql("SELECT * FROM corridor_traffic", conn, parse_dates=["timestamp"])
    return df
