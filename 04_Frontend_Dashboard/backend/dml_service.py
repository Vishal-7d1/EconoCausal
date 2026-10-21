"""
dml_service.py
==============
Part of EconoCausal: Dynamic Pricing via Double Machine Learning
Production Service Layer for CATE Estimation & Causal Inference

This module implements the CausalDMLService class, which provides:
1. Thread-safe in-memory caching and loading of fitted EconML LinearDML artifacts.
2. Strict feature schema validation (order, data types, missing/non-finite values).
3. Anti-leakage safeguards (rejection of true_* ground truth, outcomes, post-treatment variables).
4. Genuine CATE estimation (tau_hat_10, tau_hat_20) without heuristic fallbacks or mocks.
5. Asymptotic 95% confidence intervals via EconML's effect_interval API.
6. Order-preserving batch prediction and metadata extraction.

Estimand:
    tau_hat_10: Incremental purchase conversion probability difference of ₹10 discount vs ₹0 control.
    tau_hat_20: Incremental purchase conversion probability difference of ₹20 discount vs ₹0 control.
    Note: Predictions represent probability differences (uplift), not direct monetary revenue.
"""

from __future__ import annotations

import logging
import os
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import joblib
import numpy as np
import pandas as pd
from pydantic import BaseModel, Field

logger = logging.getLogger("econocausal.dml_service")

# Exact pretreatment covariates required by the trained LinearDML estimator (in order)
PREVET_FEATURE_COLS = [
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

# Prohibited columns: outcome, revenue, post-treatment, or evaluation leakage
PROHIBITED_COLUMNS = {
    "observed_purchase",
    "observed_revenue_inr",
    "revenue_inr",
    "revenue",
    "discount_inr",
    "discount_depth_ratio",
    "treatment",
    "treatment_binary",
    "recommended_discount_inr",
    "conversion",
    "converted",
    "target",
    "y",
    "outcome",
}

# Maximum allowable batch size for safety and resource limits
MAX_BATCH_SIZE = 10000


class CausalInferenceError(Exception):
    """Base exception for causal inference errors."""
    pass


class ModelArtifactError(CausalInferenceError):
    """Raised when the DML model artifact is missing, corrupted, or incompatible."""
    pass


class FeatureValidationError(CausalInferenceError):
    """Raised when input features fail schema, type, or completeness checks."""
    pass


class DataLeakageError(FeatureValidationError):
    """Raised when prohibited target, post-treatment, or ground-truth columns are provided."""
    pass


class UnsupportedInferenceError(CausalInferenceError):
    """Raised when confidence intervals or requested inference modes are unsupported."""
    pass


class SinglePredictionResult(BaseModel):
    """Prediction result for a single customer record."""
    customer_id: Optional[str] = Field(None, description="Customer identifier metadata")
    tau_hat_10: float = Field(..., description="Estimated conversion uplift of ₹10 discount vs ₹0")
    tau_hat_20: float = Field(..., description="Estimated conversion uplift of ₹20 discount vs ₹0")
    tau_hat_10_ci_95: Optional[List[float]] = Field(None, description="95% CI [lower, upper] for ₹10 contrast")
    tau_hat_20_ci_95: Optional[List[float]] = Field(None, description="95% CI [lower, upper] for ₹20 contrast")


class CATEBatchResponse(BaseModel):
    """Batch prediction response containing record-level predictions and model metadata."""
    total_records: int
    model_name: str
    has_confidence_intervals: bool
    estimand: str = "incremental_purchase_conversion_uplift"
    disclaimer: str = (
        "Simulated CATE estimates from Double Machine Learning baseline. "
        "Effects represent conversion probability differences, not direct monetary revenue."
    )
    predictions: List[SinglePredictionResult]


class CausalDMLService:
    """
    Production-grade Causal Inference Service for Double Machine Learning.

    Encapsulates artifact loading, caching, feature preprocessing, validation,
    and genuine CATE inference with confidence intervals.
    """

    _instance: Optional["CausalDMLService"] = None
    _lock = threading.Lock()

    def __init__(self, model_path: Optional[Union[str, Path]] = None) -> None:
        """
        Initialize the CausalDMLService.

        Args:
            model_path: Optional custom path to dml_model.joblib.
                        Defaults to standard repository output directory.
        """
        self._model_lock = threading.Lock()
        self._model: Optional[Any] = None
        self._model_metadata: Dict[str, Any] = {}

        if model_path is not None:
            self.model_path = Path(model_path).resolve()
        else:
            # Determine path relative to this file or repository root
            backend_dir = Path(__file__).resolve().parent
            repo_root = backend_dir.parent.parent
            self.model_path = (repo_root / "02_Causal_ML" / "outputs" / "dml_model.joblib").resolve()

    @classmethod
    def get_instance(cls, model_path: Optional[Union[str, Path]] = None) -> "CausalDMLService":
        """
        Thread-safe singleton accessor for the application.

        Args:
            model_path: Optional custom path to model artifact.

        Returns:
            Shared CausalDMLService instance.
        """
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls(model_path=model_path)
        return cls._instance

    @classmethod
    def reset_instance(cls) -> None:
        """Reset the singleton instance (useful for testing)."""
        with cls._lock:
            cls._instance = None

    @property
    def is_loaded(self) -> bool:
        """Check if model artifact is currently loaded in memory."""
        return self._model is not None

    @property
    def model_metadata(self) -> Dict[str, Any]:
        """Return metadata about the loaded model artifact."""
        return self._model_metadata.copy()

    def load_model(self, force_reload: bool = False) -> Any:
        """
        Load the fitted EconML estimator artifact from disk into memory.

        Thread-safe and cached. Fails explicitly if artifact is missing or corrupt.
        Never falls back to heuristic formulas, fabricated predictions, or mocks.

        Args:
            force_reload: If True, reloads model from disk even if cached.

        Returns:
            The loaded fitted estimator object.

        Raises:
            ModelArtifactError: If artifact does not exist or fails to load.
        """
        if self._model is not None and not force_reload:
            return self._model

        with self._model_lock:
            if self._model is not None and not force_reload:
                return self._model

            if not self.model_path.is_file():
                err_msg = (
                    f"DML model artifact not found at: {self.model_path}. "
                    "Ensure model training has been completed before requesting inference."
                )
                logger.error(err_msg)
                raise ModelArtifactError(err_msg)

            try:
                loaded = joblib.load(self.model_path)
            except Exception as e:
                err_msg = f"Failed to load DML model artifact from {self.model_path}: {e}"
                logger.exception(err_msg)
                raise ModelArtifactError(err_msg) from e

            # Verify estimator interface
            if not hasattr(loaded, "effect"):
                err_msg = (
                    f"Invalid estimator artifact at {self.model_path}: "
                    f"Loaded object of type {type(loaded).__name__} lacks required .effect() method."
                )
                logger.error(err_msg)
                raise ModelArtifactError(err_msg)

            # Check confidence interval capability
            has_intervals = hasattr(loaded, "effect_interval") and callable(getattr(loaded, "effect_interval"))

            self._model = loaded
            stat = self.model_path.stat()
            self._model_metadata = {
                "estimator_class": type(loaded).__name__,
                "artifact_path": str(self.model_path),
                "artifact_size_bytes": stat.st_size,
                "artifact_mtime": stat.st_mtime,
                "has_confidence_intervals": has_intervals,
                "expected_features": PREVET_FEATURE_COLS,
            }
            logger.info("Successfully loaded DML model artifact: %s", self._model_metadata)
            return self._model

    def validate_and_prepare_features(
        self,
        data: Union[pd.DataFrame, List[Dict[str, Any]], Dict[str, Any]],
    ) -> Tuple[np.ndarray, List[Optional[str]]]:
        """
        Validate input records against strict causal schema and return feature matrix X.

        Rules:
        1. Batch size must be >= 1 and <= MAX_BATCH_SIZE.
        2. Prohibited columns (true_*, outcomes, post-treatment, revenue) raise DataLeakageError.
        3. Pretreatment features must be present, numeric, and finite (no NaN, null, inf, -inf).
        4. Device type string ('Mobile', 'Tablet', 'Desktop') is converted to dummy columns if needed.
        5. Customer identifiers are extracted as non-feature metadata only.
        6. Preserves exact input row order.

        Args:
            data: Input DataFrame, list of record dicts, or single record dict.

        Returns:
            Tuple of (X, customer_ids):
                - X: np.ndarray of shape (N, 9) with dtype float64.
                - customer_ids: List of customer IDs of length N (values may be None if not provided).

        Raises:
            FeatureValidationError: If validation fails.
            DataLeakageError: If prohibited or ground-truth columns are present.
        """
        if isinstance(data, dict):
            df = pd.DataFrame([data])
        elif isinstance(data, list):
            if len(data) == 0:
                raise FeatureValidationError("Empty input records: at least one customer record is required.")
            df = pd.DataFrame(data)
        elif isinstance(data, pd.DataFrame):
            if len(data) == 0:
                raise FeatureValidationError("Empty input DataFrame: at least one customer record is required.")
            df = data.copy()
        else:
            raise FeatureValidationError(
                f"Unsupported data type for feature validation: {type(data).__name__}. "
                "Expected DataFrame, list of dicts, or dict."
            )

        n_records = len(df)
        if n_records > MAX_BATCH_SIZE:
            raise FeatureValidationError(
                f"Batch size of {n_records:,} exceeds maximum limit of {MAX_BATCH_SIZE:,} records per request."
            )

        # 1. Anti-Leakage Verification: Check for true_* or prohibited columns
        leaked_columns: List[str] = []
        for col in df.columns:
            col_str = str(col).strip()
            if col_str.lower().startswith("true_"):
                leaked_columns.append(col_str)
            elif col_str.lower() in PROHIBITED_COLUMNS:
                leaked_columns.append(col_str)

        if leaked_columns:
            err_msg = (
                f"Data leakage detected! Prohibited columns present in inference input: {sorted(leaked_columns)}. "
                "Causal inference requires strictly pretreatment covariates. "
                "Outcome, treatment, revenue, and true_* ground-truth columns must not be supplied."
            )
            logger.warning(err_msg)
            raise DataLeakageError(err_msg)

        # 2. Extract customer_id as metadata (never passed to model)
        customer_ids: List[Optional[str]] = []
        id_candidates = ["customer_id", "customerId", "cust_id", "id"]
        found_id_col = next((c for c in id_candidates if c in df.columns), None)
        if found_id_col is not None:
            customer_ids = [
                str(val) if pd.notna(val) else None
                for val in df[found_id_col]
            ]
        else:
            customer_ids = [None] * n_records

        # 3. Handle device encoding: derive device_Mobile and device_Tablet if device_type provided
        cols_lower = {str(c).lower(): c for c in df.columns}
        has_mobile = "device_mobile" in cols_lower
        has_tablet = "device_tablet" in cols_lower

        if not (has_mobile and has_tablet):
            # Check for device_type or device column
            device_col = cols_lower.get("device_type", cols_lower.get("device"))
            if device_col is not None:
                device_vals = df[device_col].astype(str).str.strip().str.lower()
                df["device_Mobile"] = (device_vals == "mobile").astype(int)
                df["device_Tablet"] = (device_vals == "tablet").astype(int)
            else:
                missing_device = []
                if not has_mobile:
                    missing_device.append("device_Mobile")
                if not has_tablet:
                    missing_device.append("device_Tablet")
                raise FeatureValidationError(
                    f"Missing device feature columns: {missing_device}. "
                    "Provide either 'device_type' ('Mobile', 'Tablet', 'Desktop') "
                    "or one-hot dummy columns 'device_Mobile' and 'device_Tablet'."
                )

        # 4. Verify all required pretreatment covariates are present
        cols_case_map = {str(c).lower(): c for c in df.columns}
        missing_features: List[str] = []
        resolved_col_names: List[str] = []

        for req_col in PREVET_FEATURE_COLS:
            actual_col = cols_case_map.get(req_col.lower())
            if actual_col is None:
                missing_features.append(req_col)
            else:
                resolved_col_names.append(actual_col)

        if missing_features:
            raise FeatureValidationError(
                f"Missing required pretreatment feature(s): {missing_features}. "
                f"Required schema: {PREVET_FEATURE_COLS}"
            )

        # 5. Type and non-finite value validation (no NaN, Inf, strings in numeric fields)
        feature_df = df[resolved_col_names].copy()
        feature_df.columns = PREVET_FEATURE_COLS

        for col in PREVET_FEATURE_COLS:
            # Attempt numeric conversion
            numeric_series = pd.to_numeric(feature_df[col], errors="coerce")
            if numeric_series.isna().any():
                nan_indices = numeric_series.isna()
                num_invalid = int(nan_indices.sum())
                sample_idx = int(np.where(nan_indices)[0][0])
                sample_val = feature_df[col].iloc[sample_idx]
                raise FeatureValidationError(
                    f"Invalid or missing value in column '{col}': found {num_invalid} NaN/null/unparseable value(s) "
                    f"(e.g., record #{sample_idx} has '{sample_val}'). "
                    "All pretreatment features must be finite, non-null numeric values."
                )

            # Check for infinite values
            arr_vals = numeric_series.to_numpy(dtype=np.float64)
            if np.isinf(arr_vals).any():
                inf_indices = np.where(np.isinf(arr_vals))[0]
                sample_idx = int(inf_indices[0])
                raise FeatureValidationError(
                    f"Non-finite (Infinity) value detected in column '{col}' at record #{sample_idx}. "
                    "Features must be finite real numbers."
                )

            feature_df[col] = arr_vals

        # 6. Build strictly ordered NumPy feature matrix X
        X = feature_df[PREVET_FEATURE_COLS].to_numpy(dtype=np.float64)

        if X.shape != (n_records, len(PREVET_FEATURE_COLS)):
            raise FeatureValidationError(
                f"Internal shape mismatch: expected ({n_records}, {len(PREVET_FEATURE_COLS)}), got {X.shape}"
            )

        return X, customer_ids

    def predict_cate(
        self,
        data: Union[pd.DataFrame, List[Dict[str, Any]], Dict[str, Any]],
        return_intervals: bool = False,
        alpha: float = 0.05,
    ) -> CATEBatchResponse:
        """
        Estimate Individual Treatment Effects (CATE) using the verified fitted DML estimator.

        Estimand:
            tau_hat_10: Effect of ₹10 discount vs ₹0 control on conversion probability.
            tau_hat_20: Effect of ₹20 discount vs ₹0 control on conversion probability.

        Args:
            data: DataFrame or list of feature records.
            return_intervals: If True, returns 95% asymptotic confidence intervals [lower, upper].
            alpha: Significance level for confidence intervals (default 0.05 -> 95% CI).

        Returns:
            CATEBatchResponse containing per-customer predictions and metadata.

        Raises:
            ModelArtifactError: If model cannot be loaded.
            FeatureValidationError: If input validation fails.
            DataLeakageError: If prohibited columns are detected.
            UnsupportedInferenceError: If intervals requested but model does not support them.
        """
        # Ensure model is loaded (fails explicitly if missing/corrupt)
        model = self.load_model()

        # Validate input and build feature matrix X
        X, customer_ids = self.validate_and_prepare_features(data)
        n_records = X.shape[0]

        # Genuine CATE inference using the fitted estimator
        try:
            tau_hat_10 = model.effect(X, T0=0, T1=10).flatten()
            tau_hat_20 = model.effect(X, T0=0, T1=20).flatten()
        except Exception as e:
            err_msg = f"Failed to compute treatment effects with fitted estimator: {e}"
            logger.exception(err_msg)
            raise CausalInferenceError(err_msg) from e

        # Validate prediction output shape and finite values
        if len(tau_hat_10) != n_records or len(tau_hat_20) != n_records:
            raise CausalInferenceError(
                f"Prediction shape mismatch: expected {n_records} outputs, "
                f"got {len(tau_hat_10)} for arm 10 and {len(tau_hat_20)} for arm 20."
            )

        if not np.isfinite(tau_hat_10).all() or not np.isfinite(tau_hat_20).all():
            raise CausalInferenceError("Non-finite values encountered in treatment effect predictions.")

        # Compute confidence intervals if requested
        ci_10_low: Optional[np.ndarray] = None
        ci_10_high: Optional[np.ndarray] = None
        ci_20_low: Optional[np.ndarray] = None
        ci_20_high: Optional[np.ndarray] = None
        has_ci = False

        if return_intervals:
            if not hasattr(model, "effect_interval") or not callable(getattr(model, "effect_interval")):
                raise UnsupportedInferenceError(
                    f"Confidence intervals are not supported by estimator {type(model).__name__}."
                )

            try:
                raw_ci_10 = model.effect_interval(X, T0=0, T1=10, alpha=alpha)
                raw_ci_20 = model.effect_interval(X, T0=0, T1=20, alpha=alpha)

                ci_10_low = np.asarray(raw_ci_10[0]).flatten()
                ci_10_high = np.asarray(raw_ci_10[1]).flatten()
                ci_20_low = np.asarray(raw_ci_20[0]).flatten()
                ci_20_high = np.asarray(raw_ci_20[1]).flatten()

                # Validate interval shapes and finite bounds
                for label, low, high in [("10", ci_10_low, ci_10_high), ("20", ci_20_low, ci_20_high)]:
                    if len(low) != n_records or len(high) != n_records:
                        raise CausalInferenceError(f"Confidence interval shape mismatch for arm {label}.")
                    if not (np.isfinite(low).all() and np.isfinite(high).all()):
                        raise CausalInferenceError(f"Non-finite confidence interval bounds encountered for arm {label}.")
                    if not (low <= high).all():
                        raise CausalInferenceError(
                            f"Statistical anomaly: lower confidence bound exceeds upper bound for arm {label}."
                        )

                has_ci = True
            except Exception as e:
                err_msg = f"Failed to compute confidence intervals: {e}"
                logger.exception(err_msg)
                raise CausalInferenceError(err_msg) from e

        # Construct structured per-record predictions preserving order
        predictions: List[SinglePredictionResult] = []
        for i in range(n_records):
            t10_val = float(np.round(tau_hat_10[i], 6))
            t20_val = float(np.round(tau_hat_20[i], 6))

            ci10 = None
            ci20 = None
            if has_ci and ci_10_low is not None and ci_10_high is not None:
                ci10 = [float(np.round(ci_10_low[i], 6)), float(np.round(ci_10_high[i], 6))]
            if has_ci and ci_20_low is not None and ci_20_high is not None:
                ci20 = [float(np.round(ci_20_low[i], 6)), float(np.round(ci_20_high[i], 6))]

            predictions.append(
                SinglePredictionResult(
                    customer_id=customer_ids[i],
                    tau_hat_10=t10_val,
                    tau_hat_20=t20_val,
                    tau_hat_10_ci_95=ci10,
                    tau_hat_20_ci_95=ci20,
                )
            )

        return CATEBatchResponse(
            total_records=n_records,
            model_name=type(model).__name__,
            has_confidence_intervals=has_ci,
            predictions=predictions,
        )
