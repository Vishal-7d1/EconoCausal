
"""
EconoCausal - FastAPI Backend Automated Test Suite
===================================================
Tests API endpoints, schemas, filtering, pagination, live simulation,
input validation, anti-leakage safeguards, and metric consistency.
"""

from __future__ import annotations

import json
import math
import sys
import unittest
from pathlib import Path

import numpy as np
from fastapi.testclient import TestClient

# Ensure backend directory is in sys.path
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import app as api_module
from app import app, ALLOCATIONS_CSV, SUMMARY_JSON


class TestDashboardAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_01_health_endpoint(self):
        """Verify health check returns healthy status and verifies artifacts."""
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")
        self.assertTrue(data["anti_leakage_verified"])
        self.assertTrue(data["artifacts"]["allocations_csv_exists"])
        self.assertTrue(data["artifacts"]["summary_json_exists"])

    def test_02_summary_endpoint(self):
        """Verify summary endpoint returns KPI metrics and distinguishes nominal vs redeemed costs."""
        response = self.client.get("/api/summary")
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertIn("optimal_policy", data)
        self.assertIn("baselines", data)
        self.assertIn("assumptions", data)
        self.assertIn("disclaimer", data)

        opt = data["optimal_policy"]
        self.assertEqual(opt["total_budget"], 50000.0)
        self.assertEqual(opt["allocated_budget"], 50000.0)
        self.assertEqual(opt["nominal_coupon_liability"], 50000.0)
        self.assertGreater(opt["expected_redeemed_cost"], 0.0)
        self.assertLess(opt["expected_redeemed_cost"], opt["nominal_coupon_liability"])
        self.assertEqual(opt["estimated_incremental_profit_inr"], 376115.07)
        self.assertEqual(opt["return_on_discount_spend"], 7.52)

    def test_03_recommendations_pagination(self):
        """Verify recommendations endpoint pagination bounds and structure."""
        response = self.client.get("/api/recommendations?page=1&page_size=20")
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertEqual(data["total_count"], 10000)
        self.assertEqual(data["filtered_count"], 10000)
        self.assertEqual(data["page"], 1)
        self.assertEqual(data["page_size"], 20)
        self.assertEqual(data["total_pages"], 500)
        self.assertEqual(len(data["items"]), 20)

        first_item = data["items"][0]
        self.assertIn("customer_id", first_item)
        self.assertIn("recommended_discount_inr", first_item)
        self.assertIn("expected_incremental_purchase_uplift", first_item)
        self.assertIn("expected_incremental_profit_inr", first_item)
        self.assertIn("baseline_conversion_prob_hat", first_item)

    def test_04_recommendations_search_and_filters(self):
        """Verify searching by customer ID and filtering by discount, income tier, and loyalty."""
        # 1. Search filter
        resp_search = self.client.get("/api/recommendations?search=CUST_000042")
        self.assertEqual(resp_search.status_code, 200)
        data_search = resp_search.json()
        self.assertEqual(data_search["filtered_count"], 1)
        self.assertEqual(data_search["items"][0]["customer_id"], "CUST_000042")

        # 2. Discount filter
        resp_disc = self.client.get("/api/recommendations?discount=20&page_size=100")
        self.assertEqual(resp_disc.status_code, 200)
        data_disc = resp_disc.json()
        self.assertEqual(data_disc["filtered_count"], 432)
        for item in data_disc["items"]:
            self.assertEqual(item["recommended_discount_inr"], 20)

        # 3. Income Tier filter
        resp_tier = self.client.get("/api/recommendations?income_tier=Low&page_size=50")
        self.assertEqual(resp_tier.status_code, 200)
        data_tier = resp_tier.json()
        self.assertGreater(data_tier["filtered_count"], 0)
        for item in data_tier["items"]:
            self.assertIn("Low", item["income_tier"])

        # 4. Loyalty filter
        resp_loyalty = self.client.get("/api/recommendations?loyalty=1&page_size=50")
        self.assertEqual(resp_loyalty.status_code, 200)
        data_loyalty = resp_loyalty.json()
        for item in data_loyalty["items"]:
            self.assertEqual(item["loyalty_member"], 1)

    def test_05_recommendations_sorting(self):
        """Verify sorting by incremental profit descending and ascending."""
        resp_desc = self.client.get("/api/recommendations?sort_by=expected_incremental_profit_inr&sort_order=desc&page_size=10")
        self.assertEqual(resp_desc.status_code, 200)
        items_desc = resp_desc.json()["items"]
        profits_desc = [it["expected_incremental_profit_inr"] for it in items_desc]
        self.assertEqual(profits_desc, sorted(profits_desc, reverse=True))

        resp_asc = self.client.get("/api/recommendations?sort_by=expected_incremental_profit_inr&sort_order=asc&page_size=10")
        self.assertEqual(resp_asc.status_code, 200)
        items_asc = resp_asc.json()["items"]
        profits_asc = [it["expected_incremental_profit_inr"] for it in items_asc]
        self.assertEqual(profits_asc, sorted(profits_asc))

    def test_06_charts_endpoint_data(self):
        """Verify chart data aggregations for Plotly visualizations."""
        response = self.client.get("/api/charts")
        self.assertEqual(response.status_code, 200)
        data = response.json()

        # Discount distribution
        self.assertIn("discount_distribution", data)
        dist = data["discount_distribution"]
        self.assertEqual(dist["values"], [5432, 4136, 432])
        self.assertEqual(sum(dist["values"]), 10000)

        # Policy comparison
        self.assertIn("policy_comparison", data)
        pcomp = data["policy_comparison"]
        self.assertEqual(len(pcomp["names"]), 4)
        self.assertIn("DML Causal Optimal Policy", pcomp["names"][0])

        # Segment analysis
        self.assertIn("income_segment_analysis", data)
        self.assertIn("loyalty_analysis", data)
        self.assertIn("profit_by_discount", data)

    def test_07_simulate_endpoint_valid_milp(self):
        """Verify live optimization simulation with MILP solver."""
        payload = {
            "budget": 20000.0,
            "margin_ratio": 0.30,
            "budget_type": "allocated",
            "solver": "milp"
        }
        response = self.client.post("/api/simulate", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")

        perf = data["performance"]
        self.assertEqual(perf["total_budget"], 20000.0)
        self.assertLessEqual(perf["allocated_budget"], 20000.0)
        self.assertGreater(perf["estimated_incremental_profit_inr"], 0.0)
        self.assertGreater(perf["total_discounted_customers"], 0)

    def test_08_simulate_endpoint_valid_greedy(self):
        """Verify live optimization simulation with Greedy heuristic solver."""
        payload = {
            "budget": 15000.0,
            "margin_ratio": 0.25,
            "budget_type": "allocated",
            "solver": "greedy"
        }
        response = self.client.post("/api/simulate", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        perf = data["performance"]
        self.assertLessEqual(perf["allocated_budget"], 15000.0)
        self.assertGreater(perf["estimated_incremental_profit_inr"], 0.0)

    def test_09_simulate_endpoint_invalid_inputs(self):
        """Verify input validation rejects negative budgets, out-of-range margins, and invalid solvers."""
        # Negative budget
        resp_neg = self.client.post("/api/simulate", json={"budget": -500.0, "margin_ratio": 0.30})
        self.assertEqual(resp_neg.status_code, 422)

        # Budget too large (> 500k)
        resp_huge = self.client.post("/api/simulate", json={"budget": 600000.0, "margin_ratio": 0.30})
        self.assertEqual(resp_huge.status_code, 422)

        # Margin ratio out of range
        resp_margin = self.client.post("/api/simulate", json={"budget": 10000.0, "margin_ratio": 0.99})
        self.assertEqual(resp_margin.status_code, 422)

        # Invalid solver
        resp_solver = self.client.post("/api/simulate", json={"budget": 10000.0, "solver": "quantum"})
        self.assertEqual(resp_solver.status_code, 422)

    def test_10_anti_leakage_safeguard(self):
        """Verify that no true_* columns or sensitive identifiers are exposed by any API response."""
        resp_recs = self.client.get("/api/recommendations?page_size=50")
        self.assertEqual(resp_recs.status_code, 200)
        items = resp_recs.json()["items"]
        for it in items:
            for key in it.keys():
                self.assertFalse(key.startswith("true_"), f"Data leakage detected! Found key: {key}")

    def test_11_methodology_endpoint(self):
        """Verify methodology endpoint returns documented causal assumptions and anti-leakage declarations."""
        response = self.client.get("/api/methodology")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("framework", data)
        self.assertIn("assumptions", data)
        self.assertIn("anti_leakage", data)
        self.assertIn("budget_liability_modes", data)

    def test_12_metrics_consistency_with_source_artifacts(self):
        """Verify that summary API response exactly matches source optimization_summary.json artifact."""
        with open(SUMMARY_JSON, "r", encoding="utf-8") as f:
            disk_summary = json.load(f)

        resp = self.client.get("/api/summary")
        api_summary = resp.json()

        self.assertEqual(
            api_summary["optimal_policy"]["estimated_incremental_profit_inr"],
            disk_summary["optimal_policy"]["estimated_incremental_profit_inr"],
        )
        self.assertEqual(
            api_summary["optimal_policy"]["estimated_incremental_purchases"],
            disk_summary["optimal_policy"]["estimated_incremental_purchases"],
        )
        self.assertEqual(
            api_summary["optimal_policy"]["allocated_budget"],
            disk_summary["optimal_policy"]["allocated_budget"],
        )

    def test_13_validation_endpoint(self):
        """Verify validation endpoint returns PSM balance metrics, Love plot data, and refutations."""
        resp = self.client.get("/api/validation")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("causal_robustness_audit", data)
        self.assertEqual(data["causal_robustness_audit"]["status"], "PASSED")
        self.assertIn("arm_10", data)
        self.assertIn("love_plot_data", data)
        self.assertEqual(len(data["love_plot_data"]["covariates"]), 9)
        self.assertEqual(len(data["arm_10"]["refutations"]), 4)

    def test_14_dataset_sample_endpoint(self):
        """Verify sample dataset endpoint returns clean pricing records without leakage."""
        resp = self.client.get("/api/dataset/sample?limit=50")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["sampleSize"], 50)
        self.assertEqual(data["totalRecords"], 10000)
        self.assertIn("customer_id", data["headers"])
        self.assertIn("discount_inr", data["headers"])
        for row in data["rows"]:
            for key in row.keys():
                self.assertFalse(key.startswith("true_"), f"Leakage in sample dataset: {key}")

    def test_15_export_report_endpoint(self):
        """Verify report export endpoint returns executive audit report content."""
        resp = self.client.get("/api/report/export")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("title", data)
        self.assertIn("status", data)
        self.assertIn("markdown_report", data)
        self.assertIn("summary", data)
        self.assertIn("validation", data)

    def test_16_charts_qini_curve_structure(self):
        """Verify that charts endpoint provides verified Qini cumulative uplift curve data."""
        resp = self.client.get("/api/charts")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("qini_curve", data)
        qini = data["qini_curve"]
        self.assertEqual(len(qini["percentiles"]), 11)
        self.assertEqual(len(qini["causal_uplift"]), 11)
        self.assertEqual(len(qini["random_baseline"]), 11)
        self.assertGreater(qini["total_incremental_orders"], 500.0)
        self.assertGreater(qini["targeted_customers"], 4000)
        self.assertGreater(qini["qini_score"], 0.0)
        # Causal targeting must outperform random targeting at 50% rollout
        self.assertGreater(qini["causal_uplift"][5], qini["random_baseline"][5])

    def test_17_cors_trusted_origins(self):
        """Verify that CORS middleware permits configured trusted origins."""
        origin = "http://localhost:5173"
        resp = self.client.options(
            "/api/health",
            headers={"Origin": origin, "Access-Control-Request-Method": "GET"}
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.headers.get("access-control-allow-origin"), origin)
        self.assertEqual(resp.headers.get("access-control-allow-credentials"), "true")

    def test_18_causal_cate_summary_endpoint(self):
        """Verify GET /api/causal/cate returns verified CATE distribution metrics and segments."""
        resp = self.client.get("/api/causal/cate")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["source"], "saved_artifact")
        self.assertEqual(data["total_records"], 10000)
        self.assertIn("tau_hat_10", data)
        self.assertIn("tau_hat_20", data)
        self.assertGreater(data["tau_hat_10"]["mean"], 0.0)
        self.assertGreater(data["tau_hat_20"]["mean"], 0.0)
        self.assertGreaterEqual(len(data["segments"]), 5)

    def test_19_causal_predict_endpoint(self):
        """Verify POST /api/causal/predict generates genuine CATE predictions with 95% CIs."""
        payload = {
            "records": [
                {
                    "customer_id": "TEST_API_001",
                    "age": 42.0,
                    "monthly_income_inr": 62000.0,
                    "web_visits_last_30d": 18.0,
                    "past_purchases_count": 5.0,
                    "days_since_last_purchase": 8.0,
                    "cart_baseline_value_inr": 480.0,
                    "loyalty_member": 1,
                    "device_type": "Mobile",
                }
            ],
            "return_intervals": True,
        }
        resp = self.client.post("/api/causal/predict", json=payload)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["total_records"], 1)
        self.assertTrue(data["has_confidence_intervals"])
        p = data["predictions"][0]
        self.assertEqual(p["customer_id"], "TEST_API_001")
        self.assertTrue(np.isfinite(p["tau_hat_10"]))
        self.assertTrue(np.isfinite(p["tau_hat_20"]))
        self.assertLessEqual(p["tau_hat_10_ci_95"][0], p["tau_hat_10_ci_95"][1])
        self.assertLessEqual(p["tau_hat_20_ci_95"][0], p["tau_hat_20_ci_95"][1])


if __name__ == "__main__":
    unittest.main()

