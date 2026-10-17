"""
EconoCausal - Automated Customer Behavior Data Drift Detector
============================================================
Satisfies Infotact Solutions Internship Plan - Week 4:
"Build an automated data drift detector that warns if the underlying
customer behavior changes."

Methodology:
- Population Stability Index (PSI) per feature across quantile bins.
  * PSI < 0.10  -> Stable (No Drift)
  * 0.10 <= PSI <= 0.25 -> Moderate Drift (Warning)
  * PSI > 0.25  -> Significant Drift (Trigger Model Retraining)
- Two-Sample Kolmogorov-Smirnov (KS) test for continuous covariates.
- Automated Alert System returning status, drift metrics, and prescriptive actions.
"""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from scipy import stats

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parent.parent
BASELINE_DATA_PATH = REPO_ROOT / "01_Dataset_Analysis" / "cleaned_pricing_data.csv"
OUTPUT_DIR = REPO_ROOT / "03_Backend_Optimization" / "outputs"
DRIFT_OUTPUT_JSON = OUTPUT_DIR / "drift_audit.json"

MONITORED_FEATURES: List[str] = [
    "age",
    "monthly_income_inr",
    "web_visits_last_30d",
    "past_purchases_count",
    "days_since_last_purchase",
    "cart_baseline_value_inr",
    "loyalty_member",
    "device_Mobile",
    "device_Tablet",
]


def calculate_psi(
    expected: np.ndarray,
    actual: np.ndarray,
    num_bins: int = 10,
    epsilon: float = 1e-4,
) -> float:
    """Calculates the Population Stability Index (PSI) between baseline and incoming data."""
    if len(expected) == 0 or len(actual) == 0:
        return 0.0

    # For low-cardinality discrete features (binary 0/1)
    unique_vals = np.unique(expected)
    if len(unique_vals) <= 3:
        # Category-based binning
        bins = np.sort(unique_vals)
        expected_counts, _ = np.histogram(expected, bins=np.append(bins, bins[-1] + 1))
        actual_counts, _ = np.histogram(actual, bins=np.append(bins, bins[-1] + 1))
    else:
        # Quantile-based binning on baseline
        percentiles = np.linspace(0, 100, num_bins + 1)
        bin_edges = np.percentile(expected, percentiles)
        bin_edges[0] = -np.inf
        bin_edges[-1] = np.inf
        # Remove duplicate bin edges if variance is low
        bin_edges = np.unique(bin_edges)

        expected_counts, _ = np.histogram(expected, bins=bin_edges)
        actual_counts, _ = np.histogram(actual, bins=bin_edges)

    expected_pct = expected_counts / len(expected)
    actual_pct = actual_counts / len(actual)

    # Apply smoothing epsilon to avoid division by zero or log of zero
    expected_pct = np.clip(expected_pct, epsilon, 1.0)
    actual_pct = np.clip(actual_pct, epsilon, 1.0)

    # Re-normalize
    expected_pct /= expected_pct.sum()
    actual_pct /= actual_pct.sum()

    psi_val = np.sum((actual_pct - expected_pct) * np.log(actual_pct / expected_pct))
    return float(max(0.0, psi_val))


def run_drift_detection(
    incoming_df: Optional[pd.DataFrame] = None,
    synthetic_drift: bool = False,
) -> Dict[str, Any]:
    """Runs automated drift detection on incoming customer behavioral data."""
    logger.info("Initializing Automated Customer Data Drift Detector...")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    if not BASELINE_DATA_PATH.exists():
        raise FileNotFoundError(f"Baseline data not found at {BASELINE_DATA_PATH}")

    baseline_df = pd.read_csv(BASELINE_DATA_PATH)
    logger.info(f"Loaded baseline cohort: {len(baseline_df)} records.")

    # If incoming_df not provided, evaluate a representative current batch (or simulate drift scenario if requested)
    if incoming_df is None:
        if synthetic_drift:
            # Simulate a macro-economic shock / holiday shopping drift
            incoming_df = baseline_df.copy().sample(n=3000, random_state=101, replace=True)
            incoming_df["cart_baseline_value_inr"] *= 1.45  # 45% inflation in cart sizes
            incoming_df["web_visits_last_30d"] += np.random.poisson(5, size=len(incoming_df))
        else:
            # Natural production inference batch from identical distribution with random sampling noise
            incoming_df = baseline_df.sample(n=4000, random_state=42)

    feature_metrics: List[Dict[str, Any]] = []
    psi_scores: List[float] = []
    drifted_features: List[str] = []
    warning_features: List[str] = []

    for feat in MONITORED_FEATURES:
        if feat not in baseline_df.columns or feat not in incoming_df.columns:
            continue

        base_vals = baseline_df[feat].to_numpy(dtype=float)
        curr_vals = incoming_df[feat].to_numpy(dtype=float)

        psi = calculate_psi(base_vals, curr_vals)
        psi_scores.append(psi)

        # Kolmogorov-Smirnov 2-sample test
        ks_stat, ks_pval = stats.ks_2samp(base_vals, curr_vals)

        # Baseline vs current distribution descriptive stats
        base_mean = float(np.mean(base_vals))
        curr_mean = float(np.mean(curr_vals))
        mean_shift_pct = (curr_mean - base_mean) / max(abs(base_mean), 1e-4) * 100.0

        if psi > 0.25 or ks_pval < 0.001:
            feat_status = "DRIFT_DETECTED"
            drifted_features.append(feat)
        elif psi >= 0.10 or ks_pval < 0.05:
            feat_status = "WARNING"
            warning_features.append(feat)
        else:
            feat_status = "STABLE"

        feature_metrics.append({
            "feature": feat,
            "label": feat.replace("_", " ").title(),
            "psi_score": float(round(psi, 4)),
            "ks_statistic": float(round(ks_stat, 4)),
            "ks_p_value": float(round(ks_pval, 4)),
            "baseline_mean": float(round(base_mean, 2)),
            "current_mean": float(round(curr_mean, 2)),
            "mean_shift_pct": float(round(mean_shift_pct, 2)),
            "status": feat_status,
        })

    max_psi = float(max(psi_scores)) if psi_scores else 0.0
    mean_psi = float(np.mean(psi_scores)) if psi_scores else 0.0

    if len(drifted_features) > 0:
        system_status = "DRIFT_DETECTED"
        health_color = "red"
        recommendation = (
            f"ALERT: Significant behavioral drift detected on {len(drifted_features)} feature(s): "
            f"{', '.join(drifted_features)}. Trigger automated Causal Model & Policy Retraining."
        )
    elif len(warning_features) > 0:
        system_status = "MODERATE_WARNING"
        health_color = "amber"
        recommendation = (
            f"WARNING: Moderate covariate drift detected on {len(warning_features)} feature(s): "
            f"{', '.join(warning_features)}. Continue monitoring; model retraining recommended next cycle."
        )
    else:
        system_status = "STABLE"
        health_color = "emerald"
        recommendation = (
            "SYSTEM HEALTHY: Underlying customer behavior is statistically stable across all 9 confounders. "
            f"Maximum PSI is {max_psi:.4f} (< 0.10 threshold). Retraining is not required."
        )

    drift_report = {
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "baseline_records": int(len(baseline_df)),
        "monitored_records": int(len(incoming_df)),
        "system_status": system_status,
        "health_color": health_color,
        "max_psi": float(round(max_psi, 4)),
        "mean_psi": float(round(mean_psi, 4)),
        "psi_threshold_stable": 0.10,
        "psi_threshold_drift": 0.25,
        "total_monitored_features": len(feature_metrics),
        "drifted_features_count": len(drifted_features),
        "warning_features_count": len(warning_features),
        "recommendation": recommendation,
        "feature_metrics": feature_metrics,
    }

    with open(DRIFT_OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(drift_report, f, indent=2)

    logger.info(f"Data Drift Audit exported successfully to {DRIFT_OUTPUT_JSON}")
    return drift_report


if __name__ == "__main__":
    report = run_drift_detection()
    print("=" * 60)
    print("AUTOMATED DATA DRIFT DETECTION AUDIT COMPLETE")
    print(f"System Status: {report['system_status']}")
    print(f"Max PSI: {report['max_psi']:.4f}")
    print(f"Recommendation: {report['recommendation']}")
    print("=" * 60)
