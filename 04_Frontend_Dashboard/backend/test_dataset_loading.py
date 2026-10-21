"""
test_dataset_loading.py
=======================
Automated test suite for Level 1: Dataset Loading & Data Exploration.

Covers the 13 required test cases:
1. Valid CSV upload (allocations & pricing formats).
2. Empty CSV and malformed CSV rejection.
3. Missing required columns / invalid schema rejection.
4. Missing cells and accurate quality statistics reporting.
5. Numeric and categorical column profiling.
6. Identifier handling (customer_id treated as entity key, not measurement).
7. Duplicate records and duplicate identifier detection.
8. Search and column filtering logic.
9. Pagination boundaries and empty results handling.
10. CSV export scope verification.
11. Dataset switching and baseline reset behavior.
12. Ground-truth data isolation (strict anti-leakage audit).
13. Large-dataset behavior and 50MB file-size limit enforcement.
"""

import io
import unittest
import pandas as pd
from fastapi.testclient import TestClient

from app import app, reset_to_default_dataset, CLEANED_DATA_PATH


class TestDatasetLoadingAndExploration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def setUp(self):
        # Ensure fresh baseline state before each test
        reset_to_default_dataset()

    def tearDown(self):
        reset_to_default_dataset()

    # -------------------------------------------------------------------------
    # 1. Valid CSV Upload
    # -------------------------------------------------------------------------
    def test_01_valid_csv_upload_allocations(self):
        """Verify upload and synchronization of a valid allocations CSV."""
        csv_content = (
            "customer_id,recommended_discount_inr,expected_incremental_purchase_uplift,expected_incremental_profit_inr,baseline_conversion_prob_hat\n"
            "CUST_000001,10,0.145,28.50,0.220\n"
            "CUST_000002,20,0.250,45.10,0.180\n"
            "CUST_000003,0,0.000,0.00,0.250\n"
        ).encode("utf-8")

        response = self.client.post(
            "/api/dataset/upload",
            files={"file": ("custom_allocations.csv", io.BytesIO(csv_content), "text/csv")},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["active_dataset"]["total_records"], 3)
        self.assertTrue(data["active_dataset"]["is_custom"])
        self.assertIn("data_quality", data)

    def test_01_valid_csv_upload_pricing_data(self):
        """Verify upload, feature parsing, and live optimization of a valid customer pricing CSV."""
        csv_content = (
            "customer_id,age,monthly_income_inr,cart_baseline_value_inr,loyalty_member,discount_inr,observed_purchase\n"
            "CUST_100001,28,42000,850.0,1,10,1\n"
            "CUST_100002,45,68000,1400.0,0,0,0\n"
            "CUST_100003,32,31000,450.0,0,20,1\n"
            "CUST_100004,50,85000,2100.0,1,0,1\n"
        ).encode("utf-8")

        response = self.client.post(
            "/api/dataset/upload",
            files={"file": ("customer_pricing_sample.csv", io.BytesIO(csv_content), "text/csv")},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["active_dataset"]["total_records"], 4)
        self.assertTrue(data["active_dataset"]["is_custom"])

    # -------------------------------------------------------------------------
    # 2. Empty CSV and Malformed CSV Rejection
    # -------------------------------------------------------------------------
    def test_02_empty_csv_rejection(self):
        """Verify that an empty CSV file (0 bytes) is rejected with HTTP 400."""
        empty_content = b""
        response = self.client.post(
            "/api/dataset/upload",
            files={"file": ("empty.csv", io.BytesIO(empty_content), "text/csv")},
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("empty", response.json()["detail"].lower())

    def test_02_non_csv_file_rejection(self):
        """Verify that non-CSV file uploads (e.g. .xlsx, .json) are rejected."""
        content = b"some binary data"
        response = self.client.post(
            "/api/dataset/upload",
            files={"file": ("dataset.xlsx", io.BytesIO(content), "application/vnd.ms-excel")},
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn(".csv files are supported", response.json()["detail"])

    # -------------------------------------------------------------------------
    # 3. Missing Required Columns and Invalid Schema Rejection
    # -------------------------------------------------------------------------
    def test_03_missing_required_columns_rejection(self):
        """Verify that CSVs lacking both allocation and customer pricing columns are rejected."""
        invalid_schema_csv = (
            "product_name,inventory_shelf,store_aisle,supplier_rating\n"
            "Widget A,Shelf 3,Aisle 4,4.5\n"
            "Widget B,Shelf 1,Aisle 2,3.8\n"
        ).encode("utf-8")

        response = self.client.post(
            "/api/dataset/upload",
            files={"file": ("unrelated_store_data.csv", io.BytesIO(invalid_schema_csv), "text/csv")},
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("does not match the required econocausal pricing or allocations schema", response.json()["detail"].lower())

    # -------------------------------------------------------------------------
    # 4. Missing Cells and Accurate Quality Statistics
    # -------------------------------------------------------------------------
    def test_04_missing_cells_reporting_and_imputation(self):
        """Verify that datasets with missing cells report exact counts and impute without crashing."""
        csv_with_missing = (
            "customer_id,monthly_income_inr,cart_baseline_value_inr,loyalty_member,discount_inr\n"
            "CUST_001,,1200.0,1,10\n"
            "CUST_002,48000,,0,0\n"
            "CUST_003,55000,950.0,,20\n"
            "CUST_004,62000,1100.0,1,0\n"
        ).encode("utf-8")

        response = self.client.post(
            "/api/dataset/upload",
            files={"file": ("missing_cells.csv", io.BytesIO(csv_with_missing), "text/csv")},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        quality = data["data_quality"]
        self.assertEqual(quality["missing_cells"], 3)
        self.assertEqual(quality["total_records"], 4)
        self.assertIn("imputation_policy", quality)

    # -------------------------------------------------------------------------
    # 5. Numeric and Categorical Column Profiling
    # -------------------------------------------------------------------------
    def test_05_column_profiling_and_types(self):
        """Verify column profiling returns correct headers, rows, and observable features."""
        response = self.client.get("/api/dataset/sample?limit=50")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["sampleSize"], 50)
        headers = data["headers"]

        # Ensure pre-treatment covariates and treatments exist
        self.assertIn("cart_baseline_value_inr", headers)
        self.assertIn("monthly_income_inr", headers)
        self.assertIn("loyalty_member", headers)
        self.assertIn("discount_inr", headers)
        self.assertIn("customer_id", headers)

    # -------------------------------------------------------------------------
    # 6. Identifier Handling
    # -------------------------------------------------------------------------
    def test_06_identifier_handling(self):
        """Verify that customer identifiers are treated as discrete keys, not aggregated numeric features."""
        # Test numeric customer IDs like 1001, 1002
        numeric_id_csv = (
            "customer_id,cart_baseline_value_inr,monthly_income_inr,loyalty_member,discount_inr\n"
            "10001,800.0,40000,0,10\n"
            "10002,1500.0,75000,1,20\n"
        ).encode("utf-8")

        response = self.client.post(
            "/api/dataset/upload",
            files={"file": ("numeric_ids.csv", io.BytesIO(numeric_id_csv), "text/csv")},
        )
        self.assertEqual(response.status_code, 200)

        # In recommendations API, IDs must remain exact strings and not be converted to floats
        resp_recs = self.client.get("/api/recommendations?page=1&page_size=10")
        self.assertEqual(resp_recs.status_code, 200)
        items = resp_recs.json()["items"]
        cust_ids = [it["customer_id"] for it in items]
        self.assertIn("10001", cust_ids)
        self.assertIn("10002", cust_ids)

    # -------------------------------------------------------------------------
    # 7. Duplicate Records and Identifiers
    # -------------------------------------------------------------------------
    def test_07_duplicate_detection(self):
        """Verify duplicate rows and duplicate identifier counts are detected and reported."""
        dupes_csv = (
            "customer_id,cart_baseline_value_inr,monthly_income_inr,loyalty_member,discount_inr\n"
            "CUST_DUP1,900.0,50000,1,10\n"
            "CUST_DUP1,900.0,50000,1,10\n"  # Exact duplicate row & ID
            "CUST_DUP2,1100.0,60000,0,0\n"
            "CUST_DUP2,1250.0,65000,1,20\n"  # Duplicate ID with different features
        ).encode("utf-8")

        response = self.client.post(
            "/api/dataset/upload",
            files={"file": ("duplicates.csv", io.BytesIO(dupes_csv), "text/csv")},
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        quality = data["data_quality"]
        self.assertEqual(quality["total_records"], 4)
        self.assertEqual(quality["duplicate_rows"], 1)
        self.assertEqual(quality["duplicate_customer_ids"], 2)

    # -------------------------------------------------------------------------
    # 8. Search and Column Filtering
    # -------------------------------------------------------------------------
    def test_08_search_and_column_filtering(self):
        """Verify search by ID and filtering by discount, income tier, and loyalty."""
        # 1. Search filter
        resp_search = self.client.get("/api/recommendations?search=CUST_000042")
        self.assertEqual(resp_search.status_code, 200)
        self.assertEqual(resp_search.json()["filtered_count"], 1)
        self.assertEqual(resp_search.json()["items"][0]["customer_id"], "CUST_000042")

        # 2. Column filter: Discount = 20
        resp_disc = self.client.get("/api/recommendations?discount=20&page_size=50")
        self.assertEqual(resp_disc.status_code, 200)
        for item in resp_disc.json()["items"]:
            self.assertEqual(item["recommended_discount_inr"], 20)

        # 3. Column filter: Loyalty = 1
        resp_loy = self.client.get("/api/recommendations?loyalty=1&page_size=50")
        self.assertEqual(resp_loy.status_code, 200)
        for item in resp_loy.json()["items"]:
            self.assertEqual(item["loyalty_member"], 1)

    # -------------------------------------------------------------------------
    # 9. Pagination Boundaries and Empty Results
    # -------------------------------------------------------------------------
    def test_09_pagination_boundaries(self):
        """Verify boundary behavior: page 1, page beyond limit, and 0 search results."""
        # Page 1
        resp_p1 = self.client.get("/api/recommendations?page=1&page_size=25")
        self.assertEqual(resp_p1.status_code, 200)
        self.assertEqual(len(resp_p1.json()["items"]), 25)

        # Page beyond total records
        resp_far = self.client.get("/api/recommendations?page=99999&page_size=25")
        self.assertEqual(resp_far.status_code, 200)
        self.assertEqual(len(resp_far.json()["items"]), 0)

        # Zero results search
        resp_none = self.client.get("/api/recommendations?search=DOES_NOT_EXIST_XYZ")
        self.assertEqual(resp_none.status_code, 200)
        self.assertEqual(resp_none.json()["filtered_count"], 0)
        self.assertEqual(len(resp_none.json()["items"]), 0)

    # -------------------------------------------------------------------------
    # 10. CSV Export Scope
    # -------------------------------------------------------------------------
    def test_10_csv_export_scope(self):
        """Verify that recommendation exports correspond to requested scope and filters."""
        # Exporting filtered scope (discount=10)
        resp = self.client.get("/api/recommendations?discount=10&page=1&page_size=100")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertGreater(data["filtered_count"], 0)
        self.assertEqual(len(data["items"]), 100)
        for it in data["items"]:
            self.assertEqual(it["recommended_discount_inr"], 10)

    # -------------------------------------------------------------------------
    # 11. Dataset Switching and Reset Behavior
    # -------------------------------------------------------------------------
    def test_11_dataset_switching_and_reset(self):
        """Verify uploading custom dataset updates status, and reset restores 10k baseline."""
        # Step 1: Upload 2-record custom dataset
        custom_csv = (
            "customer_id,recommended_discount_inr,expected_incremental_purchase_uplift,expected_incremental_profit_inr,baseline_conversion_prob_hat\n"
            "CUST_S1,10,0.12,20.0,0.20\n"
            "CUST_S2,20,0.22,40.0,0.20\n"
        ).encode("utf-8")
        self.client.post("/api/dataset/upload", files={"file": ("small.csv", io.BytesIO(custom_csv), "text/csv")})

        status_custom = self.client.get("/api/dataset/status").json()
        self.assertTrue(status_custom["is_custom"])
        self.assertEqual(status_custom["total_records"], 2)

        # Step 2: Reset dataset
        reset_resp = self.client.post("/api/dataset/reset")
        self.assertEqual(reset_resp.status_code, 200)

        status_reset = self.client.get("/api/dataset/status").json()
        self.assertFalse(status_reset["is_custom"])
        self.assertEqual(status_reset["total_records"], 10000)
        self.assertEqual(status_reset["filename"], "optimal_discount_allocations.csv")

    # -------------------------------------------------------------------------
    # 12. Ground-Truth Data Isolation (Anti-Leakage Audit)
    # -------------------------------------------------------------------------
    def test_12_ground_truth_isolation(self):
        """Verify strict anti-leakage: files containing true_* columns are strictly blocked from models."""
        leaky_csv = (
            "customer_id,cart_baseline_value_inr,monthly_income_inr,true_tau_10,true_optimal_treatment\n"
            "CUST_001,800.0,40000,0.15,10\n"
        ).encode("utf-8")

        response = self.client.post(
            "/api/dataset/upload",
            files={"file": ("leaked_ground_truth.csv", io.BytesIO(leaky_csv), "text/csv")},
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("security violation", response.json()["detail"].lower())
        self.assertIn("ground truth", response.json()["detail"].lower())

        # Verify /api/dataset/sample never contains true_* columns
        sample_resp = self.client.get("/api/dataset/sample?limit=50")
        self.assertEqual(sample_resp.status_code, 200)
        headers = sample_resp.json()["headers"]
        for h in headers:
            self.assertFalse(h.startswith("true_"), f"Ground truth leakage in sample endpoint: {h}")

        # Verify /api/recommendations never exposes true_* columns
        rec_resp = self.client.get("/api/recommendations?page_size=20")
        self.assertEqual(rec_resp.status_code, 200)
        for item in rec_resp.json()["items"]:
            for key in item.keys():
                self.assertFalse(key.startswith("true_"), f"Ground truth leakage in recommendations: {key}")

    # -------------------------------------------------------------------------
    # 13. Large-Dataset Behavior & File-Size Limits
    # -------------------------------------------------------------------------
    def test_13_file_size_limit_enforcement(self):
        """Verify that uploads exceeding 50 MB are safely rejected with HTTP 400."""
        # Emulate 51 MB dummy file
        oversized_bytes = b"a" * (51 * 1024 * 1024)
        response = self.client.post(
            "/api/dataset/upload",
            files={"file": ("huge_dataset.csv", io.BytesIO(oversized_bytes), "text/csv")},
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("exceeds maximum allowable limit of 50 mb", response.json()["detail"].lower())

    def test_13_benchmark_dataset_integrity(self):
        """Verify that the official 10k customer benchmark dataset is intact, uncorrupted, and leak-free."""
        self.assertTrue(CLEANED_DATA_PATH.exists(), f"Missing cleaned pricing benchmark at {CLEANED_DATA_PATH}")
        df = pd.read_csv(CLEANED_DATA_PATH)
        self.assertEqual(len(df), 10000, f"Expected 10,000 benchmark records, found {len(df)}")
        self.assertEqual(len(df.columns), 16, f"Expected 16 columns, found {len(df.columns)}")
        self.assertEqual(df.duplicated().sum(), 0, "Benchmark must have 0 duplicate rows")
        self.assertEqual(df["customer_id"].nunique(), 10000, "Benchmark must have 10,000 unique customer IDs")

        leak_cols = [c for c in df.columns if str(c).startswith("true_")]
        self.assertEqual(len(leak_cols), 0, f"Benchmark dataset contains leaked columns: {leak_cols}")


if __name__ == "__main__":
    unittest.main()
