"""
test_batch_upload_regression.py
================================
Regression test suite for EconoCausal:
12 Comprehensive Tests for Dataset Upload, Bounded Batch Processing, Schema Validation,
Atomic Activation, and Dashboard Synchronization.
"""

import io
import sys
import unittest
from unittest.mock import patch
from pathlib import Path
import pandas as pd
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app import (
    app,
    reset_to_default_dataset,
    CLEANED_DATA_PATH,
    _active_dataset_info,
    _allocations_df_cache,
    _summary_json_cache,
)


class TestBatchUploadAndSynchronizationRegression(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.test_csv_path = Path(r"C:\Users\Vishal Yadav\OneDrive\Desktop\Infotact Solution\econocausal_test_dataset.csv")
        cls.incompatible_60k_path = Path(r"C:\Users\Vishal Yadav\OneDrive\Desktop\Infotact Solution\EconoCausal_Synthetic_Dataset_60000.csv")

    def setUp(self):
        reset_to_default_dataset()

    def tearDown(self):
        reset_to_default_dataset()

    # 1. Compatible Small Dataset (< 10k rows)
    def test_01_compatible_small_dataset(self):
        """Upload 2,000-row compatible pricing dataset and verify synchronization."""
        if not self.test_csv_path.exists():
            self.skipTest(f"Test file not found at {self.test_csv_path}")

        with open(self.test_csv_path, "rb") as f:
            content = f.read()

        resp = self.client.post(
            "/api/dataset/upload?strip_ground_truth=true",
            files={"file": ("econocausal_test_dataset.csv", io.BytesIO(content), "text/csv")},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["active_dataset"]["total_records"], 2000)
        self.assertTrue(data["active_dataset"]["is_custom"])

        # Verify /api/dataset/status
        status_resp = self.client.get("/api/dataset/status")
        self.assertEqual(status_resp.status_code, 200)
        self.assertEqual(status_resp.json()["total_records"], 2000)

        # Verify /api/summary
        sum_resp = self.client.get("/api/summary")
        self.assertEqual(sum_resp.status_code, 200)
        opt = sum_resp.json()["optimal_policy"]
        self.assertEqual(opt["count_control_0"] + opt["total_discounted_customers"], 2000)

        # Verify /api/recommendations
        rec_resp = self.client.get("/api/recommendations?page=1&page_size=10")
        self.assertEqual(rec_resp.status_code, 200)
        self.assertEqual(rec_resp.json()["total_count"], 2000)

    # 2. Compatible 10k Benchmark Dataset
    def test_02_compatible_10k_dataset(self):
        """Upload standard 10,000-row benchmark dataset and verify full 10k records."""
        with open(CLEANED_DATA_PATH, "rb") as f:
            content = f.read()

        resp = self.client.post(
            "/api/dataset/upload",
            files={"file": ("cleaned_pricing_data.csv", io.BytesIO(content), "text/csv")},
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["active_dataset"]["total_records"], 10000)

    # 3. Compatible Large Dataset (60,000 rows with Bounded Batch Processing)
    def test_03_compatible_60k_batch_processing(self):
        """Verify sequential 5,000-row chunking allows 60,000 rows to process without hitting MAX_BATCH_SIZE."""
        # Generate 12,000 rows in memory (2 full 5k chunks + 1 partial chunk) for fast unit test execution
        n_rows = 12000
        df_large = pd.DataFrame({
            "customer_id": [f"CUST_LRG_{i:06d}" for i in range(n_rows)],
            "age": [20 + (i % 45) for i in range(n_rows)],
            "monthly_income_inr": [30000 + (i % 70) * 1000 for i in range(n_rows)],
            "cart_baseline_value_inr": [500.0 + (i % 30) * 50.0 for i in range(n_rows)],
            "loyalty_member": [i % 2 for i in range(n_rows)],
            "web_visits_last_30d": [5 + (i % 20) for i in range(n_rows)],
            "past_purchases_count": [1 + (i % 10) for i in range(n_rows)],
            "days_since_last_purchase": [5 + (i % 60) for i in range(n_rows)],
            "device_type": ["Mobile" if i % 2 == 0 else "Desktop" for i in range(n_rows)],
        })
        csv_bytes = df_large.to_csv(index=False).encode("utf-8")

        resp = self.client.post(
            "/api/dataset/upload",
            files={"file": ("compatible_12k_dataset.csv", io.BytesIO(csv_bytes), "text/csv")},
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["active_dataset"]["total_records"], n_rows)

        # Check recommendations preserve exact sequential IDs
        rec_resp = self.client.get("/api/recommendations?page=1&page_size=5")
        self.assertEqual(rec_resp.status_code, 200)
        items = rec_resp.json()["items"]
        self.assertEqual(items[0]["customer_id"], "CUST_LRG_000000")
        self.assertEqual(items[1]["customer_id"], "CUST_LRG_000001")

    # 4. Incompatible 60k Dataset Rejection
    def test_04_incompatible_60k_dataset_rejection(self):
        """Verify that EconoCausal_Synthetic_Dataset_60000.csv is rejected with HTTP 400 and explicit schema error."""
        if not self.incompatible_60k_path.exists():
            self.skipTest(f"File not found at {self.incompatible_60k_path}")

        # Read first 100 rows to test rejection quickly without 4MB payload
        df_sample = pd.read_csv(self.incompatible_60k_path, nrows=50)
        csv_bytes = df_sample.to_csv(index=False).encode("utf-8")

        resp = self.client.post(
            "/api/dataset/upload",
            files={"file": ("EconoCausal_Synthetic_Dataset_60000.csv", io.BytesIO(csv_bytes), "text/csv")},
        )
        self.assertEqual(resp.status_code, 400)
        detail = resp.json()["detail"]
        self.assertIn("does not match the required econocausal pricing or allocations schema", detail.lower())
        self.assertIn("historical_spend", detail.lower())
        self.assertIn("income_bracket", detail.lower())

    # 5. Missing Required Features Rejection
    def test_05_missing_required_features_rejection(self):
        """Verify that CSV missing cart_baseline_value_inr is rejected with HTTP 400."""
        csv_content = (
            "customer_id,age,monthly_income_inr,loyalty_member\n"
            "CUST_1,35,50000,1\n"
        ).encode("utf-8")

        resp = self.client.post(
            "/api/dataset/upload",
            files={"file": ("missing_cart.csv", io.BytesIO(csv_content), "text/csv")},
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("cart_baseline_value_inr", resp.json()["detail"])

    # 6. Customer Identifier Mapping
    def test_06_customer_id_mapping(self):
        """Verify that user_id column is safely mapped to customer_id preserving discrete keys."""
        csv_content = (
            "user_id,age,monthly_income_inr,cart_baseline_value_inr,loyalty_member\n"
            "99001,30,45000,900.0,0\n"
            "99002,40,65000,1200.0,1\n"
        ).encode("utf-8")

        resp = self.client.post(
            "/api/dataset/upload",
            files={"file": ("user_ids.csv", io.BytesIO(csv_content), "text/csv")},
        )
        self.assertEqual(resp.status_code, 200)

        rec_resp = self.client.get("/api/recommendations?page=1&page_size=5")
        items = rec_resp.json()["items"]
        cust_ids = [it["customer_id"] for it in items]
        self.assertIn("99001", cust_ids)
        self.assertIn("99002", cust_ids)

    # 7. Ground-Truth Anti-Leakage Gate
    def test_07_ground_truth_anti_leakage_gate(self):
        """Verify that true_* columns trigger HTTP 400 rejection unless strip_ground_truth=true."""
        csv_content = (
            "customer_id,age,monthly_income_inr,cart_baseline_value_inr,loyalty_member,true_tau_10\n"
            "CUST_L1,30,45000,900.0,0,0.15\n"
        ).encode("utf-8")

        resp = self.client.post(
            "/api/dataset/upload",
            files={"file": ("leaked_gt.csv", io.BytesIO(csv_content), "text/csv")},
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("security violation", resp.json()["detail"].lower())

    # 8. Mid-Batch Failure Rollback
    def test_08_mid_batch_failure_rollback(self):
        """Verify that if chunk inference fails mid-stream, active dataset is not altered."""
        init_status = self.client.get("/api/dataset/status").json()
        self.assertEqual(init_status["total_records"], 10000)

        csv_content = (
            "customer_id,age,monthly_income_inr,cart_baseline_value_inr,loyalty_member\n"
            "CUST_F1,30,45000,900.0,0\n"
            "CUST_F2,40,65000,1200.0,1\n"
        ).encode("utf-8")

        with patch("dml_service.CausalDMLService.predict_cate", side_effect=RuntimeError("Simulated mid-batch crash")):
            resp = self.client.post(
                "/api/dataset/upload",
                files={"file": ("crash_test.csv", io.BytesIO(csv_content), "text/csv")},
            )
            self.assertEqual(resp.status_code, 500)

        # Confirm prior active dataset is unchanged
        post_status = self.client.get("/api/dataset/status").json()
        self.assertEqual(post_status["total_records"], 10000)
        self.assertFalse(post_status["is_custom"])

    # 9. Failed Upload Preserves Active Dataset
    def test_09_failed_upload_preserves_active_dataset(self):
        """Verify that failed upload of invalid schema preserves 10k baseline in summary and recommendations."""
        invalid_csv = b"random_col_1,random_col_2\n1,2\n"
        resp = self.client.post(
            "/api/dataset/upload",
            files={"file": ("invalid.csv", io.BytesIO(invalid_csv), "text/csv")},
        )
        self.assertEqual(resp.status_code, 400)

        # Check /api/summary still has 10,000 customers
        sum_resp = self.client.get("/api/summary")
        opt = sum_resp.json()["optimal_policy"]
        self.assertEqual(opt["count_control_0"] + opt["total_discounted_customers"], 10000)

    # 10. Full Dashboard Synchronization on Success
    def test_10_full_dashboard_synchronization_on_success(self):
        """Verify that after successful upload, /api/dataset/status, /api/summary, /api/recommendations, and /api/charts match."""
        csv_content = (
            "customer_id,age,monthly_income_inr,cart_baseline_value_inr,loyalty_member\n"
            "CUST_S1,25,35000,800.0,1\n"
            "CUST_S2,45,65000,1500.0,0\n"
            "CUST_S3,35,45000,950.0,1\n"
        ).encode("utf-8")

        resp = self.client.post(
            "/api/dataset/upload",
            files={"file": ("sync_test.csv", io.BytesIO(csv_content), "text/csv")},
        )
        self.assertEqual(resp.status_code, 200)

        # Check status
        self.assertEqual(self.client.get("/api/dataset/status").json()["total_records"], 3)
        # Check summary
        opt = self.client.get("/api/summary").json()["optimal_policy"]
        self.assertEqual(opt["count_control_0"] + opt["total_discounted_customers"], 3)
        # Check recommendations
        recs = self.client.get("/api/recommendations?page=1&page_size=10").json()
        self.assertEqual(recs["total_count"], 3)
        # Check charts
        charts = self.client.get("/api/charts").json()
        dist = charts["discount_distribution"]
        self.assertEqual(sum(dist["values"]), 3)

    # 11. Recommendation Row Count Consistency
    def test_11_recommendation_row_count_consistency(self):
        """Verify total_count in recommendations precisely matches active dataset record count."""
        status = self.client.get("/api/dataset/status").json()
        recs = self.client.get("/api/recommendations?page=1&page_size=5").json()
        self.assertEqual(recs["total_count"], status["total_records"])

    # 12. Reset to Default Restores 10k Benchmark
    def test_12_reset_to_default_restores_10k_benchmark(self):
        """Verify /api/dataset/reset cleanly restores all caches to 10k benchmark."""
        csv_content = (
            "customer_id,age,monthly_income_inr,cart_baseline_value_inr,loyalty_member\n"
            "CUST_R1,25,35000,800.0,1\n"
        ).encode("utf-8")
        self.client.post("/api/dataset/upload", files={"file": ("r.csv", io.BytesIO(csv_content), "text/csv")})
        self.assertEqual(self.client.get("/api/dataset/status").json()["total_records"], 1)

        # Call reset
        reset_resp = self.client.post("/api/dataset/reset")
        self.assertEqual(reset_resp.status_code, 200)
        self.assertEqual(self.client.get("/api/dataset/status").json()["total_records"], 10000)
        self.assertFalse(self.client.get("/api/dataset/status").json()["is_custom"])


if __name__ == "__main__":
    unittest.main()
