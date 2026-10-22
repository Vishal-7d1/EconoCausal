
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
import time
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

        # Budget too large (> 1M)
        resp_huge = self.client.post("/api/simulate", json={"budget": 1500000.0, "margin_ratio": 0.30})
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
        # Verify exactly 5 refutations and required diagnostic types under Level 4 contract
        refutations = data["arm_10"]["refutations"]
        self.assertEqual(len(refutations), 5)
        refutation_types = [r["refutation_type"] for r in refutations]
        self.assertIn("Placebo Treatment Test", refutation_types)
        self.assertIn("Random Common Cause Refutation", refutation_types)
        self.assertIn("Data Subset Removal Refutation", refutation_types)
        self.assertIn("Positivity Overlap Trimming Sensitivity", refutation_types)
        self.assertIn("Model-Based Residual Permutation Diagnostic", refutation_types)
        for r in refutations:
            self.assertEqual(r["status"], "PASS")

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
        """Verify report export endpoint returns executive audit report content with unified contract."""
        resp = self.client.get("/api/report/export")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("title", data)
        self.assertIn("status", data)
        self.assertIn("markdown_report", data)
        self.assertIn("summary", data)
        self.assertIn("validation", data)
        self.assertIn("optimal_policy", data)
        self.assertIn("causal_robustness", data)
        self.assertIn("psm_summary", data)
        self.assertEqual(data["report_version"], "2.1.0")
        self.assertEqual(data["causal_robustness"]["refutations_passed"], 5)
        self.assertEqual(data["causal_robustness"]["refutations_total"], 5)

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

    def test_20_zero_budget_simulation(self):
        """Verify zero budget returns valid zero-allocation feasible result without error."""
        resp = self.client.post("/api/simulate", json={"budget": 0.0, "objective": "max_profit"})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("simulation_id", data)

        perf = data["performance"]
        self.assertEqual(perf["total_budget"], 0.0)
        self.assertEqual(perf["allocated_budget"], 0.0)
        self.assertEqual(perf["count_discount_10"], 0)
        self.assertEqual(perf["count_discount_20"], 0)
        self.assertEqual(perf["total_discounted_customers"], 0)
        self.assertEqual(perf["count_control_0"], 10000)
        self.assertEqual(perf["estimated_incremental_profit_inr"], 0.0)
        self.assertEqual(perf["estimated_incremental_purchases"], 0.0)

        # Recommendations for this simulation should all be ₹0 control
        sim_id = data["simulation_id"]
        rec_resp = self.client.get(f"/api/recommendations?simulation_id={sim_id}&page_size=50")
        self.assertEqual(rec_resp.status_code, 200)
        rec_data = rec_resp.json()
        self.assertEqual(rec_data["total_count"], 10000)
        self.assertTrue(rec_data["is_simulation"])
        self.assertEqual(rec_data["simulation_id"], sim_id)
        for item in rec_data["items"]:
            self.assertEqual(item["recommended_discount_inr"], 0)

    def test_21_small_positive_budget(self):
        """Verify positive budget smaller than cheapest discount returns feasible zero allocation."""
        resp = self.client.post("/api/simulate", json={"budget": 5.0, "budget_type": "allocated"})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        perf = data["performance"]
        self.assertLessEqual(perf["allocated_budget"], 5.0)
        self.assertEqual(perf["total_discounted_customers"], 0)
        self.assertEqual(perf["count_discount_10"], 0)
        self.assertEqual(perf["count_discount_20"], 0)

    def test_22_max_budget_boundary(self):
        """Verify maximum budget ₹1,000,000 succeeds while over-budget (>1M) is rejected."""
        resp_max = self.client.post("/api/simulate", json={"budget": 1000000.0, "solver": "greedy"})
        self.assertEqual(resp_max.status_code, 200)
        self.assertLessEqual(resp_max.json()["performance"]["allocated_budget"], 1000000.0)

        # Over max limit
        resp_over = self.client.post("/api/simulate", json={"budget": 1000001.0})
        self.assertEqual(resp_over.status_code, 422)

    def test_23_nan_and_infinity_rejection(self):
        """Verify that NaN and Infinity for budget or margin are rejected with 422."""
        # Raw JSON with NaN token
        resp_nan = self.client.post(
            "/api/simulate",
            content=b'{"budget": NaN}',
            headers={"Content-Type": "application/json"}
        )
        self.assertEqual(resp_nan.status_code, 422)

        # Raw JSON with Infinity token
        resp_inf = self.client.post(
            "/api/simulate",
            content=b'{"budget": Infinity}',
            headers={"Content-Type": "application/json"}
        )
        self.assertEqual(resp_inf.status_code, 422)

        # String "NaN" or "Infinity"
        resp_nan_str = self.client.post("/api/simulate", json={"budget": "NaN"})
        self.assertEqual(resp_nan_str.status_code, 422)

        resp_inf_str = self.client.post("/api/simulate", json={"budget": "Infinity"})
        self.assertEqual(resp_inf_str.status_code, 422)

        # NaN and Inf margin ratio
        resp_margin_nan = self.client.post(
            "/api/simulate",
            content=b'{"budget": 10000.0, "margin_ratio": NaN}',
            headers={"Content-Type": "application/json"}
        )
        self.assertEqual(resp_margin_nan.status_code, 422)

        resp_margin_inf = self.client.post(
            "/api/simulate",
            content=b'{"budget": 10000.0, "margin_ratio": Infinity}',
            headers={"Content-Type": "application/json"}
        )
        self.assertEqual(resp_margin_inf.status_code, 422)

    def test_24_objectives_profit_and_conversions(self):
        """Verify both max_profit and max_conversions objectives are supported and identified in API response."""
        # 1. max_profit
        resp_profit = self.client.post("/api/simulate", json={"budget": 30000.0, "objective": "max_profit"})
        self.assertEqual(resp_profit.status_code, 200)
        data_profit = resp_profit.json()
        self.assertEqual(data_profit["inputs"]["objective"], "max_profit")
        self.assertEqual(data_profit["performance"]["objective"], "max_profit")
        self.assertGreater(data_profit["performance"]["estimated_incremental_profit_inr"], 0.0)

        # 2. max_conversions
        resp_conv = self.client.post("/api/simulate", json={"budget": 30000.0, "objective": "max_conversions"})
        self.assertEqual(resp_conv.status_code, 200)
        data_conv = resp_conv.json()
        self.assertEqual(data_conv["inputs"]["objective"], "max_conversions")
        self.assertEqual(data_conv["performance"]["objective"], "max_conversions")
        self.assertGreater(data_conv["performance"]["estimated_incremental_purchases"], 0.0)

        # 3. Default objective when omitted is max_profit
        resp_default = self.client.post("/api/simulate", json={"budget": 30000.0})
        self.assertEqual(resp_default.status_code, 200)
        self.assertEqual(resp_default.json()["inputs"]["objective"], "max_profit")

    def test_25_invalid_objective_rejection(self):
        """Verify invalid objective values are strictly rejected."""
        resp = self.client.post("/api/simulate", json={"budget": 20000.0, "objective": "max_revenue_fake"})
        self.assertEqual(resp.status_code, 422)

    def test_26_nominal_and_redeemed_budget_constraints(self):
        """Verify nominal vs redeemed budget constraints are strictly satisfied."""
        # Nominal mode
        resp_nom = self.client.post("/api/simulate", json={"budget": 25000.0, "budget_type": "allocated"})
        self.assertEqual(resp_nom.status_code, 200)
        p_nom = resp_nom.json()["performance"]
        self.assertLessEqual(p_nom["nominal_coupon_liability"], 25000.0 + 1e-4)

        # Redeemed mode
        resp_red = self.client.post("/api/simulate", json={"budget": 15000.0, "budget_type": "redeemed"})
        self.assertEqual(resp_red.status_code, 200)
        p_red = resp_red.json()["performance"]
        self.assertLessEqual(p_red["expected_redeemed_cost"], 15000.0 + 1e-4)

    def test_27_single_offer_and_eligibility(self):
        """Verify each customer receives at most one discount arm and ineligible offers are not assigned."""
        resp = self.client.post("/api/simulate", json={"budget": 50000.0, "solver": "greedy"})
        self.assertEqual(resp.status_code, 200)
        sim_id = resp.json()["simulation_id"]

        # Fetch all records via export to inspect
        exp_resp = self.client.get(f"/api/recommendations/export?simulation_id={sim_id}&format=json")
        self.assertEqual(exp_resp.status_code, 200)
        records = exp_resp.json()["records"]
        self.assertEqual(len(records), 10000)

        for r in records:
            disc = r["recommended_discount_inr"]
            self.assertIn(disc, [0, 10, 20])
            if disc > 0:
                # Must satisfy discount depth cap: disc / cart <= 0.25 (or float precision)
                depth = disc / max(r["cart_baseline_value_inr"], 1.0)
                self.assertLessEqual(depth, 0.25 + 1e-5)

    def test_28_solver_parity_and_fallback(self):
        """Verify solver attribution for normal MILP, explicit greedy, and mocked MILP failure fallback."""
        from unittest.mock import patch

        # 1. Normal MILP solver attribution
        resp_milp = self.client.post("/api/simulate", json={"budget": 20000.0, "solver": "milp"})
        self.assertEqual(resp_milp.status_code, 200)
        self.assertEqual(resp_milp.json()["performance"]["solver_used"], "milp")

        # 2. Explicit Greedy solver attribution
        resp_grd = self.client.post("/api/simulate", json={"budget": 20000.0, "solver": "greedy"})
        self.assertEqual(resp_grd.status_code, 200)
        self.assertEqual(resp_grd.json()["performance"]["solver_used"], "greedy")
        self.assertLessEqual(resp_grd.json()["performance"]["allocated_budget"], 20000.0)

        # 3. Forced MILP failure mock -> Greedy fallback attribution and feasibility
        class MockFailedResult:
            success = False
            status = -1
            message = "Forced mock solver failure for fallback verification"
            x = None

        with patch("optimize_budget.milp", return_value=MockFailedResult()):
            resp_fb = self.client.post("/api/simulate", json={"budget": 20000.0, "solver": "milp"})
            self.assertEqual(resp_fb.status_code, 200)
            perf_fb = resp_fb.json()["performance"]
            # Must accurately report greedy (fallback), not the requested milp
            self.assertEqual(perf_fb["solver_used"], "greedy (fallback)")
            # Must satisfy budget constraint and maintain feasibility
            self.assertLessEqual(perf_fb["allocated_budget"], 20000.0)
            self.assertGreater(perf_fb["total_discounted_customers"], 0)
            self.assertEqual(perf_fb["count_control_0"] + perf_fb["total_discounted_customers"], 10000)

    def test_29_simulation_metrics_match_allocations(self):
        """Verify summary metrics returned by simulation match actual customer table allocations."""
        resp = self.client.post("/api/simulate", json={"budget": 35000.0, "solver": "greedy"})
        self.assertEqual(resp.status_code, 200)
        sim_data = resp.json()
        sim_id = sim_data["simulation_id"]
        perf = sim_data["performance"]

        # 1. Total discount 10 count
        resp_10 = self.client.get(f"/api/recommendations?simulation_id={sim_id}&discount=10")
        self.assertEqual(resp_10.status_code, 200)
        self.assertEqual(resp_10.json()["filtered_count"], perf["count_discount_10"])

        # 2. Total discount 20 count
        resp_20 = self.client.get(f"/api/recommendations?simulation_id={sim_id}&discount=20")
        self.assertEqual(resp_20.status_code, 200)
        self.assertEqual(resp_20.json()["filtered_count"], perf["count_discount_20"])

        # 3. Control count
        resp_0 = self.client.get(f"/api/recommendations?simulation_id={sim_id}&discount=0")
        self.assertEqual(resp_0.status_code, 200)
        self.assertEqual(resp_0.json()["filtered_count"], perf["count_control_0"])

    def test_30_baseline_cache_and_invalidation(self):
        """Verify safe in-memory baseline conversion model caching, latency improvement, and invalidation."""
        # Ensure fresh cache state by resetting first
        self.client.post("/api/dataset/reset")

        # First call: populates cache (fits logistic regression)
        t0 = time.perf_counter()
        resp1 = self.client.post("/api/simulate", json={"budget": 10000.0})
        t_first = time.perf_counter() - t0
        self.assertEqual(resp1.status_code, 200)
        self.assertFalse(resp1.json()["performance"]["baseline_model_cached"])

        # Second call: uses cached baseline model (no refit)
        t0 = time.perf_counter()
        resp2 = self.client.post("/api/simulate", json={"budget": 15000.0})
        t_second = time.perf_counter() - t0
        self.assertEqual(resp2.status_code, 200)
        self.assertTrue(resp2.json()["performance"]["baseline_model_cached"])

        print(f"\n[LATENCY MEASUREMENT] First run (fitting baseline): {t_first*1000:.1f}ms | Second run (cached baseline): {t_second*1000:.1f}ms (Speedup: {t_first/max(t_second, 1e-6):.2f}x)")

        # Invalidate cache via dataset reset
        resp_reset = self.client.post("/api/dataset/reset")
        self.assertEqual(resp_reset.status_code, 200)

        # Third call after reset: should reload and report baseline_model_cached == False
        resp3 = self.client.post("/api/simulate", json={"budget": 10000.0})
        self.assertEqual(resp3.status_code, 200)
        self.assertFalse(resp3.json()["performance"]["baseline_model_cached"])

    def test_31_simulation_id_recommendations_and_404(self):
        """Verify retrieving recommendations for valid simulation_id and clear 404 for unknown/expired IDs."""
        # Non-existent simulation ID
        resp_404 = self.client.get("/api/recommendations?simulation_id=sim_nonexistent_xyz")
        self.assertEqual(resp_404.status_code, 404)
        self.assertIn("not found or has expired", resp_404.json()["detail"])

        # Valid simulation ID
        sim_resp = self.client.post("/api/simulate", json={"budget": 20000.0})
        sim_id = sim_resp.json()["simulation_id"]
        rec_resp = self.client.get(f"/api/recommendations?simulation_id={sim_id}")
        self.assertEqual(rec_resp.status_code, 200)
        self.assertEqual(rec_resp.json()["simulation_id"], sim_id)
        self.assertTrue(rec_resp.json()["is_simulation"])

    def test_32_simulation_recommendations_pagination_filters_export(self):
        """Verify pagination, sorting, filters, and export on simulated allocations."""
        sim_resp = self.client.post("/api/simulate", json={"budget": 45000.0})
        sim_id = sim_resp.json()["simulation_id"]

        # Filtering and pagination
        rec_resp = self.client.get(f"/api/recommendations?simulation_id={sim_id}&discount=10&page=1&page_size=10")
        self.assertEqual(rec_resp.status_code, 200)
        data = rec_resp.json()
        self.assertEqual(len(data["items"]), min(10, data["filtered_count"]))
        for it in data["items"]:
            self.assertEqual(it["recommended_discount_inr"], 10)

        # CSV Export
        csv_resp = self.client.get(f"/api/recommendations/export?simulation_id={sim_id}&discount=10&format=csv")
        self.assertEqual(csv_resp.status_code, 200)
        self.assertIn("text/csv", csv_resp.headers["content-type"])
        self.assertIn("customer_id", csv_resp.text)
        self.assertIn("recommended_discount_inr", csv_resp.text)

    def test_33_baseline_allocations_unchanged_after_simulation(self):
        """Verify baseline recommendations remain completely intact after running custom simulations."""
        # Query baseline recommendations before simulation
        base_before = self.client.get("/api/recommendations?page_size=20").json()
        self.assertFalse(base_before["is_simulation"])

        # Run multiple custom simulations with different budgets
        self.client.post("/api/simulate", json={"budget": 10000.0, "objective": "max_conversions"})
        self.client.post("/api/simulate", json={"budget": 80000.0, "objective": "max_profit"})

        # Query baseline recommendations after simulation
        base_after = self.client.get("/api/recommendations?page_size=20").json()
        self.assertFalse(base_after["is_simulation"])
        self.assertEqual(base_before["total_count"], base_after["total_count"])
        self.assertEqual(base_before["items"][0]["customer_id"], base_after["items"][0]["customer_id"])
        self.assertEqual(base_before["items"][0]["recommended_discount_inr"], base_after["items"][0]["recommended_discount_inr"])

    def test_34_simulation_details_endpoint(self):
        """Verify GET /api/simulation/{simulation_id} returns cached simulation metadata and 404 for unknown IDs."""
        sim_resp = self.client.post("/api/simulate", json={"budget": 22000.0})
        sim_id = sim_resp.json()["simulation_id"]

        detail_resp = self.client.get(f"/api/simulation/{sim_id}")
        self.assertEqual(detail_resp.status_code, 200)
        data = detail_resp.json()
        self.assertEqual(data["simulation_id"], sim_id)
        self.assertEqual(data["inputs"]["budget"], 22000.0)
        self.assertEqual(data["total_allocations"], 10000)

        # Invalid simulation ID
        bad_resp = self.client.get("/api/simulation/sim_invalid_abc")
        self.assertEqual(bad_resp.status_code, 404)


if __name__ == "__main__":
    unittest.main()

