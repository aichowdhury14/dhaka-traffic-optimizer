"""Corridor congestion forecasting.

Two models, cheapest-first:
  1. Historical baseline: median congestion_factor by (corridor, hour, is_friday).
     Fast, interpretable, surprisingly hard to beat for a signal this periodic.
  2. XGBoost regressor on calendar features, for comparison against the baseline.

Run:
    python -m src.models.forecast
"""

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import train_test_split
from xgboost import XGBRegressor

from src.pipeline.storage import read_all


def build_baseline(df: pd.DataFrame) -> pd.DataFrame:
    return (
        df.groupby(["corridor_id", "hour", "is_friday"])["congestion_factor"]
        .median()
        .reset_index()
        .rename(columns={"congestion_factor": "baseline_factor"})
    )


def predict_baseline(baseline: pd.DataFrame, corridor_id: str, hour: int, is_friday: bool) -> float:
    row = baseline[
        (baseline["corridor_id"] == corridor_id)
        & (baseline["hour"] == hour)
        & (baseline["is_friday"] == int(is_friday))
    ]
    if row.empty:
        return 1.2  # fallback: mild congestion assumption
    return float(row["baseline_factor"].iloc[0])


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["corridor_code"] = df["corridor_id"].astype("category").cat.codes
    df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24)
    df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24)
    return df


def train_xgb(df: pd.DataFrame) -> tuple[XGBRegressor, float]:
    df = build_features(df)
    features = ["corridor_code", "hour", "hour_sin", "hour_cos", "is_friday"]
    X = df[features]
    y = df["congestion_factor"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = XGBRegressor(n_estimators=200, max_depth=4, learning_rate=0.08, random_state=42)
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    mae = mean_absolute_error(y_test, preds)
    return model, mae


def evaluate_baseline(df: pd.DataFrame, baseline: pd.DataFrame) -> float:
    preds = df.apply(
        lambda r: predict_baseline(baseline, r["corridor_id"], r["hour"], bool(r["is_friday"])), axis=1
    )
    return mean_absolute_error(df["congestion_factor"], preds)


if __name__ == "__main__":
    df = read_all()
    print(f"Loaded {len(df)} rows from storage")

    baseline = build_baseline(df)
    baseline_mae = evaluate_baseline(df, baseline)
    print(f"Historical baseline MAE: {baseline_mae:.4f}")

    model, xgb_mae = train_xgb(df)
    print(f"XGBoost MAE: {xgb_mae:.4f}")
