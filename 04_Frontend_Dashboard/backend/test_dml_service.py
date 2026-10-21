"""
test_dml_service.py
===================
Part of EconoCausal: Dynamic Pricing via Double Machine Learning
Module: 04_Frontend_Dashboard / backend

Comprehensive Automated Test Suite for Level 2 Phase 2:
CausalDMLService, CATE Prediction APIs, and Upload Integration.

Test Scenarios Covered:
1. Successful inference using the real existing artifact (LinearDML).
2. Batch prediction and correct row ordering.
3. Missing required feature rejection.
4. Invalid data type rejection.
5. NaN and Infinity rejection.
6. true_* leakage rejection.
7. Outcome and post-treatment feature rejection.
8. Missing or corrupt model artifact handling.
9. No hard-coded fallback predictions when loading fails.
10. Output shape and finite prediction validation.
11. Confidence intervals when genuinely supported (lower <= upper); explicit unsupported behaviour otherwise.
12. GET /api/causal/cate valid response and failure cases.
13. POST /api/causal/predict valid single-record and batch requests.
14. Upload integration regression tests.
15. Confirmation that production API outputs do not expose ground-truth columns.
"""

from __future__ import annotations

import io
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app import app, DML_PREDICTIONS_PATH, DML_MODEL_PATH, CLEANED_DATA_PATH, REPO_ROOT
from dml_service import (
    CATEBatchResponse,
    CausalDMLService,
    CausalInferenceError,
    DataLeakageError,
    FeatureValidationError,
    ModelArtifactError,
    PREVET_FEATURE_COLS,
    PROHIBITED_COLUMNS,
    SinglePredictionResult,
    UnsupportedInferenceError,
)


class TestCausalDMLService(unittest.TestCase):
    """Unit and integration tests for CausalDMLService and CATE endpoints."""

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.repo_root = REPO_ROOT
        cls.real_model_path = DML_MODEL_PATH
        cls.cleaned_data_path = CLEANED_DATA_PATH
        cls.predictions_path = DML_PREDICTIONS_PATH

        # Verify real artifacts exist
        if not cls.real_model_path.is_file():
            raise unittest.SkipTest(f"Real DML model artifact missing at {cls.real_model_path}")
        if not cls.cleaned_data_path.is_file():
            raise unittest.SkipTest(f"Cleaned pricing dataset missing at {cls.cleaned_data_path}")

        # Sample valid pretreatment covariates from cleaned dataset
        df_full = pd.read_csv(cls.cleaned_data_path)
        cov_cols = ["customer_id"] + PREVET_FEATURE_COLS
        cls.sample_df = df_full[cov_cols].head(25).copy()

    def setUp(self):
        # Reset singleton between tests to ensure clean state
        CausalDMLService.reset_instance()

    # -------------------------------------------------------------------------
    # 1. Successful inference using real existing artifact
    # -------------------------------------------------------------------------
    def test_01_successful_real_artifact_inference(self):
        """Verify real fitted LinearDML artifact runs inference and returns genuine CATE uplift."""
        service = CausalDMLService.get_instance(model_path=self.real_model_path)
        self.assertTrue(self.real_model_path.is_file())

        batch = service.predict_cate(self.sample_df, return_intervals=False)
        self.assertIsInstance(batch, CATEBatchResponse)
        self.assertEqual(batch.total_records, len(self.sample_df))
        self.assertEqual(batch.model_name, "LinearDML")
        self.assertEqual(len(batch.predictions), len(self.sample_df))

        # Check values are finite, reasonable conversion uplift percentages (0.0 to 0.6)
        for pred in batch.predictions:
            self.assertIsInstance(pred.tau_hat_10, float)
            self.assertIsInstance(pred.tau_hat_20, float)
            self.assertTrue(np.isfinite(pred.tau_hat_10))
            self.assertTrue(np.isfinite(pred.tau_hat_20))
            self.assertGreater(pred.tau_hat_10, -0.2)
            self.assertLess(pred.tau_hat_10, 0.8)
            self.assertGreater(pred.tau_hat_20, -0.2)
            self.assertLess(pred.tau_hat_20, 0.8)

    # -------------------------------------------------------------------------
    # 2. Batch prediction and correct row ordering
    # -------------------------------------------------------------------------
    def test_02_batch_prediction_and_order_preservation(self):
        """Verify batch predictions strictly preserve input record order and identifiers."""
        service = CausalDMLService.get_instance()
        test_records = [
            {
                "customer_id": f"ORDER_TEST_{i:03d}",
                "age": 20.0 + i * 5,
                "monthly_income_inr": 25000.0 + i * 10000,
                "web_visits_last_30d": 5.0 + i,
                "past_purchases_count": 1.0 + i,
                "days_since_last_purchase": 10.0 + i * 2,
                "cart_baseline_value_inr": 200.0 + i * 50,
                "loyalty_member": i % 2,
                "device_Mobile": 1 if i % 2 == 0 else 0,
                "device_Tablet": 0,
            }
            for i in range(10)
        ]

        batch = service.predict_cate(test_records, return_intervals=False)
        self.assertEqual(batch.total_records, 10)

        for i, pred in enumerate(batch.predictions):
            expected_id = f"ORDER_TEST_{i:03d}"
            self.assertEqual(pred.customer_id, expected_id, f"Row order violated at index {i}")

            # Verify that single-record inference yields the exact same prediction
            single_batch = service.predict_cate(test_records[i], return_intervals=False)
            self.assertAlmostEqual(pred.tau_hat_10, single_batch.predictions[0].tau_hat_10, places=5)
            self.assertAlmostEqual(pred.tau_hat_20, single_batch.predictions[0].tau_hat_20, places=5)

    # -------------------------------------------------------------------------
    # 3. Missing required feature rejection
    # -------------------------------------------------------------------------
    def test_03_missing_required_feature_rejection(self):
        """Verify FeatureValidationError when any required pretreatment feature is omitted."""
        service = CausalDMLService.get_instance()
        base_record = {
            "age": 30,
            "monthly_income_inr": 40000,
            "web_visits_last_30d": 10,
            "past_purchases_count": 2,
            "days_since_last_purchase": 15,
            "cart_baseline_value_inr": 350,
            "loyalty_member": 0,
            "device_Mobile": 1,
            "device_Tablet": 0,
        }

        # Test omitting each feature one by one
        for feature in ["age", "monthly_income_inr", "cart_baseline_value_inr", "loyalty_member"]:
            incomplete_record = base_record.copy()
            del incomplete_record[feature]
            with self.assertRaises(FeatureValidationError) as ctx:
                service.predict_cate(incomplete_record)
            self.assertIn("Missing required pretreatment feature", str(ctx.exception))

    # -------------------------------------------------------------------------
    # 4. Invalid data type rejection
    # -------------------------------------------------------------------------
    def test_04_invalid_data_type_rejection(self):
        """Verify FeatureValidationError when non-numeric strings are provided for numerical features."""
        service = CausalDMLService.get_instance()
        record_bad_age = self.sample_df.iloc[0].to_dict()
        record_bad_age["age"] = "invalid_thirty_five"

        with self.assertRaises(FeatureValidationError) as ctx:
            service.predict_cate(record_bad_age)
        self.assertIn("Invalid or missing value in column 'age'", str(ctx.exception))

        record_bad_income = self.sample_df.iloc[0].to_dict()
        record_bad_income["monthly_income_inr"] = "high_earner"
        with self.assertRaises(FeatureValidationError) as ctx:
            service.predict_cate(record_bad_income)
        self.assertIn("monthly_income_inr", str(ctx.exception))

    # -------------------------------------------------------------------------
    # 5. NaN and Infinity rejection
    # -------------------------------------------------------------------------
    def test_05_nan_and_infinity_rejection(self):
        """Verify FeatureValidationError when NaN, null, or Infinite values are passed."""
        service = CausalDMLService.get_instance()

        # 5A: NaN test
        rec_nan = self.sample_df.iloc[0].to_dict()
        rec_nan["web_visits_last_30d"] = np.nan
        with self.assertRaises(FeatureValidationError) as ctx_nan:
            service.predict_cate(rec_nan)
        self.assertIn("NaN/null/unparseable value", str(ctx_nan.exception))

        # 5B: Positive Infinity test
        rec_inf = self.sample_df.iloc[0].to_dict()
        rec_inf["cart_baseline_value_inr"] = np.inf
        with self.assertRaises(FeatureValidationError) as ctx_inf:
            service.predict_cate(rec_inf)
        self.assertIn("Non-finite (Infinity)", str(ctx_inf.exception))

        # 5C: Negative Infinity test
        rec_ninf = self.sample_df.iloc[0].to_dict()
        rec_ninf["monthly_income_inr"] = -np.inf
        with self.assertRaises(FeatureValidationError) as ctx_ninf:
            service.predict_cate(rec_ninf)
        self.assertIn("Non-finite (Infinity)", str(ctx_ninf.exception))

    # -------------------------------------------------------------------------
    # 6. true_* leakage rejection
    # -------------------------------------------------------------------------
    def test_06_true_leakage_rejection(self):
        """Verify strict DataLeakageError when input contains true_* evaluation counterfactuals."""
        service = CausalDMLService.get_instance()
        leaked_records = self.sample_df.head(5).copy()
        leaked_records["true_tau_prob_y10"] = 0.14
        leaked_records["true_baseline_p0"] = 0.20

        with self.assertRaises(DataLeakageError) as ctx:
            service.predict_cate(leaked_records)
        self.assertIn("Data leakage detected", str(ctx.exception))
        self.assertIn("true_tau_prob_y10", str(ctx.exception))
        self.assertIn("true_baseline_p0", str(ctx.exception))

    # -------------------------------------------------------------------------
    # 7. Outcome and post-treatment feature rejection
    # -------------------------------------------------------------------------
    def test_07_outcome_and_post_treatment_rejection(self):
        """Verify DataLeakageError when outcomes, realized revenue, or post-treatment columns are provided."""
        service = CausalDMLService.get_instance()

        prohibited_test_cases = [
            "observed_purchase",
            "observed_revenue_inr",
            "discount_inr",
            "treatment_binary",
            "discount_depth_ratio",
            "conversion",
            "recommended_discount_inr",
        ]

        for prohibited_col in prohibited_test_cases:
            dirty_df = self.sample_df.head(3).copy()
            dirty_df[prohibited_col] = 1.0
            with self.assertRaises(DataLeakageError) as ctx:
                service.predict_cate(dirty_df)
            self.assertIn("Data leakage detected", str(ctx.exception))
            self.assertIn(prohibited_col, str(ctx.exception))

    # -------------------------------------------------------------------------
    # 8. Missing or corrupt model artifact handling
    # -------------------------------------------------------------------------
    def test_08_missing_or_corrupt_model_artifact_handling(self):
        """Verify ModelArtifactError is raised explicitly when artifact is missing or corrupt."""
        # 8A: Non-existent file path
        non_existent_path = self.repo_root / "02_Causal_ML" / "outputs" / "non_existent_model.joblib"
        service_missing = CausalDMLService(model_path=non_existent_path)
        with self.assertRaises(ModelArtifactError) as ctx_missing:
            service_missing.load_model()
        self.assertIn("DML model artifact not found", str(ctx_missing.exception))

        # 8B: Corrupted artifact file
        with tempfile.NamedTemporaryFile(suffix=".joblib", delete=False) as f:
            f.write(b"CORRUPTED_NON_JOBLIB_DATA_12345")
            corrupt_path = Path(f.name)

        try:
            service_corrupt = CausalDMLService(model_path=corrupt_path)
            with self.assertRaises(ModelArtifactError) as ctx_corrupt:
                service_corrupt.load_model()
            self.assertIn("Failed to load DML model artifact", str(ctx_corrupt.exception))
        finally:
            if corrupt_path.exists():
                corrupt_path.unlink()

    # -------------------------------------------------------------------------
    # 9. No hard-coded fallback predictions when loading fails
    # -------------------------------------------------------------------------
    def test_09_no_hardcoded_fallback_when_loading_fails(self):
        """Verify service fails explicitly and NEVER returns heuristic formulas when model is unavailable."""
        service_broken = CausalDMLService(model_path=Path("/invalid/path/dml_model.joblib"))
        with self.assertRaises(ModelArtifactError):
            service_broken.predict_cate(self.sample_df.head(5))

    # -------------------------------------------------------------------------
    # 10. Output shape and finite prediction validation
    # -------------------------------------------------------------------------
    def test_10_output_shape_and_finite_validation(self):
        """Verify batch output matches input row count exactly with finite float values."""
        service = CausalDMLService.get_instance()

        for n in [1, 5, 20]:
            sub_df = self.sample_df.head(n)
            batch = service.predict_cate(sub_df)
            self.assertEqual(len(batch.predictions), n)
            self.assertEqual(batch.total_records, n)
            for p in batch.predictions:
                self.assertFalse(np.isnan(p.tau_hat_10))
                self.assertFalse(np.isinf(p.tau_hat_10))
                self.assertFalse(np.isnan(p.tau_hat_20))
                self.assertFalse(np.isinf(p.tau_hat_20))

    # -------------------------------------------------------------------------
    # 11. Confidence intervals validation
    # -------------------------------------------------------------------------
    def test_11_confidence_intervals_validation(self):
        """Verify 95% asymptotic confidence intervals are computed, finite, and lower <= upper."""
        service = CausalDMLService.get_instance()

        # When return_intervals=True
        batch_ci = service.predict_cate(self.sample_df.head(10), return_intervals=True)
        self.assertTrue(batch_ci.has_confidence_intervals)

        for pred in batch_ci.predictions:
            self.assertIsNotNone(pred.tau_hat_10_ci_95)
            self.assertIsNotNone(pred.tau_hat_20_ci_95)
            self.assertEqual(len(pred.tau_hat_10_ci_95), 2)
            self.assertEqual(len(pred.tau_hat_20_ci_95), 2)

            low_10, high_10 = pred.tau_hat_10_ci_95
            low_20, high_20 = pred.tau_hat_20_ci_95

            self.assertTrue(np.isfinite(low_10))
            self.assertTrue(np.isfinite(high_10))
            self.assertLessEqual(low_10, high_10, "Lower bound exceeds upper bound for ₹10 contrast")

            self.assertTrue(np.isfinite(low_20))
            self.assertTrue(np.isfinite(high_20))
            self.assertLessEqual(low_20, high_20, "Lower bound exceeds upper bound for ₹20 contrast")

        # When return_intervals=False
        batch_no_ci = service.predict_cate(self.sample_df.head(5), return_intervals=False)
        self.assertFalse(batch_no_ci.has_confidence_intervals)
        for pred in batch_no_ci.predictions:
            self.assertIsNone(pred.tau_hat_10_ci_95)
            self.assertIsNone(pred.tau_hat_20_ci_95)

    # -------------------------------------------------------------------------
    # 12. GET /api/causal/cate valid response and failure cases
    # -------------------------------------------------------------------------
    def test_12_api_cate_summary_endpoint(self):
        """Verify GET /api/causal/cate returns correct distribution stats, quantiles, and segment summaries."""
        response = self.client.get("/api/causal/cate")
        self.assertEqual(response.status_code, 200)

        data = response.json()
        self.assertEqual(data["source"], "saved_artifact")
        self.assertEqual(data["total_records"], 10000)
        self.assertEqual(data["estimand"], "incremental_purchase_conversion_uplift")
        self.assertIn("tau_hat_10", data)
        self.assertIn("tau_hat_20", data)
        self.assertIn("segments", data)

        # Validate statistics structure and mathematical monotonicity of quantiles
        for arm in ["tau_hat_10", "tau_hat_20"]:
            stats = data[arm]
            self.assertEqual(stats["count"], 10000)
            self.assertLessEqual(stats["min"], stats["q25"])
            self.assertLessEqual(stats["q25"], stats["median"])
            self.assertLessEqual(stats["median"], stats["q75"])
            self.assertLessEqual(stats["q75"], stats["max"])
            self.assertGreater(stats["std"], 0.0)

        # Validate segment breakdowns
        self.assertGreaterEqual(len(data["segments"]), 5)
        for seg in data["segments"]:
            self.assertIn("segment_category", seg)
            self.assertIn("segment", seg)
            self.assertGreater(seg["count"], 0)
            self.assertTrue(np.isfinite(seg["mean_tau_hat_10"]))
            self.assertTrue(np.isfinite(seg["mean_tau_hat_20"]))

        # Failure case: missing predictions artifact
        with patch("app.DML_PREDICTIONS_PATH", Path("/tmp/non_existent_cate_predictions.csv")):
            with patch("app._cate_summary_cache", None):
                resp_missing = self.client.get("/api/causal/cate")
                self.assertEqual(resp_missing.status_code, 404)
                self.assertIn("CATE predictions artifact not found", resp_missing.json()["detail"])

    # -------------------------------------------------------------------------
    # 13. POST /api/causal/predict valid single-record and batch requests
    # -------------------------------------------------------------------------
    def test_13_api_predict_endpoint_single_and_batch(self):
        """Verify POST /api/causal/predict handles single dict, records wrapper, and bare arrays."""
        single_record = {
            "customer_id": "API_TEST_001",
            "age": 35.0,
            "monthly_income_inr": 48000.0,
            "web_visits_last_30d": 14.0,
            "past_purchases_count": 4.0,
            "days_since_last_purchase": 18.0,
            "cart_baseline_value_inr": 520.0,
            "loyalty_member": 1,
            "device_type": "Mobile",
        }

        # 13A: Single record directly
        resp_single = self.client.post("/api/causal/predict", json=single_record)
        self.assertEqual(resp_single.status_code, 200)
        data_single = resp_single.json()
        self.assertEqual(data_single["total_records"], 1)
        self.assertEqual(data_single["predictions"][0]["customer_id"], "API_TEST_001")

        # 13B: Wrapped records with return_intervals=True
        batch_payload = {
            "records": [single_record, {**single_record, "customer_id": "API_TEST_002", "monthly_income_inr": 22000.0}],
            "return_intervals": True,
        }
        resp_batch = self.client.post("/api/causal/predict", json=batch_payload)
        self.assertEqual(resp_batch.status_code, 200)
        data_batch = resp_batch.json()
        self.assertEqual(data_batch["total_records"], 2)
        self.assertTrue(data_batch["has_confidence_intervals"])
        self.assertIsNotNone(data_batch["predictions"][0]["tau_hat_10_ci_95"])

        # 13C: Bare list of records
        resp_list = self.client.post("/api/causal/predict", json=[single_record])
        self.assertEqual(resp_list.status_code, 200)
        self.assertEqual(resp_list.json()["total_records"], 1)

        # 13D: Empty batch rejection
        resp_empty = self.client.post("/api/causal/predict", json={"records": []})
        self.assertEqual(resp_empty.status_code, 400)
        self.assertIn("cannot be empty", resp_empty.json()["detail"])

        # 13E: Data leakage rejection
        leaked_payload = {"records": [{**single_record, "true_tau": 0.15}]}
        resp_leak = self.client.post("/api/causal/predict", json=leaked_payload)
        self.assertEqual(resp_leak.status_code, 400)
        self.assertIn("Data leakage detected", resp_leak.json()["detail"])

        # 13F: Missing feature rejection
        bad_feature_payload = {"records": [{"age": 30.0}]}
        resp_bad = self.client.post("/api/causal/predict", json=bad_feature_payload)
        self.assertEqual(resp_bad.status_code, 422)

    # -------------------------------------------------------------------------
    # 14. Upload integration regression tests
    # -------------------------------------------------------------------------
    def test_14_upload_integration_delegates_to_dml_service(self):
        """Verify upload endpoint uses CausalDMLService and raises explicit error without fallbacks."""
        # Create a valid customer pricing dataset without tau_hat columns
        upload_records = [
            {
                "customer_id": f"UPLOAD_CUST_{i:04d}",
                "age": 28 + i * 2,
                "monthly_income_inr": 32000 + i * 3000,
                "web_visits_last_30d": 8 + i,
                "past_purchases_count": 2 + i,
                "days_since_last_purchase": 15 + i,
                "cart_baseline_value_inr": 250 + i * 20,
                "loyalty_member": 1 if i % 2 == 0 else 0,
                "device_type": "Mobile" if i % 2 == 0 else "Desktop",
            }
            for i in range(20)
        ]
        df_upload = pd.DataFrame(upload_records)
        csv_buffer = io.BytesIO()
        df_upload.to_csv(csv_buffer, index=False)
        csv_buffer.seek(0)

        response = self.client.post(
            "/api/dataset/upload",
            files={"file": ("custom_pricing_upload.csv", csv_buffer.getvalue(), "text/csv")},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["active_dataset"]["total_records"], 20)

        # Verify allocations were scored using CausalDMLService
        resp_rec = self.client.get("/api/recommendations?page_size=20")
        self.assertEqual(resp_rec.status_code, 200)
        recs = resp_rec.json()["items"]
        self.assertEqual(len(recs), 20)
        for r in recs:
            self.assertTrue(r["customer_id"].startswith("UPLOAD_CUST_"))
            self.assertTrue(np.isfinite(r["expected_incremental_purchase_uplift"]))

        # Reset active dataset back to baseline
        resp_reset = self.client.post("/api/dataset/reset")
        self.assertEqual(resp_reset.status_code, 200)

    # -------------------------------------------------------------------------
    # 15. Confirmation that production API outputs do not expose ground-truth columns
    # -------------------------------------------------------------------------
    def test_15_no_ground_truth_in_production_api_outputs(self):
        """Verify production API endpoints strictly isolate ground truth and never expose true_* columns."""
        endpoints = [
            "/api/health",
            "/api/summary",
            "/api/recommendations?page_size=10",
            "/api/causal/cate",
            "/api/dataset/sample?limit=10",
            "/api/validation",
        ]

        for endpoint in endpoints:
            resp = self.client.get(endpoint)
            self.assertEqual(resp.status_code, 200, f"Endpoint {endpoint} failed with code {resp.status_code}")
            text_content = resp.text
            # Strict assertion: no occurrences of 'true_tau', 'true_purchase', 'true_counterfactual', 'true_p0'
            forbidden_substrings = ["true_tau", "true_purchase", "true_p0", "true_y10", "true_y20", "true_ate"]
            for forbidden in forbidden_substrings:
                self.assertNotIn(
                    forbidden,
                    text_content.lower(),
                    f"Security violation: Ground truth substring '{forbidden}' detected in production endpoint {endpoint}",
                )


def suite():
    s = unittest.TestSuite()
    s.addTest(unittest.makeSuite(TestCausalDMLService))
    return s


if __name__ == "__main__":
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite())
    sys.exit(0 if result.wasSuccessful() else 1)
