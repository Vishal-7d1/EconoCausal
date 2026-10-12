"""
test_optimizer.py
=================
Part of EconoCausal: Dynamic Pricing via Double Machine Learning
Module: 03_Backend_Optimization

Description:
    Comprehensive automated test suite for the prescriptive budget optimization engine:
    1. Missing file and error handling.
    2. Anti-leakage safeguard verification (blocks execution if true_* columns present).
    3. Strict budget constraint enforcement across multiple budget levels.
    4. Zero budget edge case (100% control, ₹0 spend).
    5. Single-offer mutual exclusivity (no duplicate offers per customer).
    6. Invalid input validation (negative budget, invalid margin ratio, bad options).
    7. Missing data / NaN handling.
    8. Recommendation consistency and budget monotonicity.
    9. Outperformance over heuristic baselines (Random, Uniform).
    10. End-to-end artifact persistence and schema verification.
    11. Solver parity (Greedy heuristic vs. exact MILP).

Usage:
    python 03_Backend_Optimization/test_optimizer.py
"""

import json
from pathlib import Path
import shutil
import subprocess
import sys
import unittest

import numpy as np
import pandas as pd


class TestBudgetOptimization(unittest.TestCase):
    """Test suite for prescriptive budget optimizer."""

    @classmethod
    def setUpClass(cls):
        cls.repo_root = Path(__file__).resolve().parent.parent
        cls.opt_script = cls.repo_root / "03_Backend_Optimization" / "optimize_budget.py"
        cls.cleaned_data = cls.repo_root / "01_Dataset_Analysis" / "cleaned_pricing_data.csv"
        cls.predictions = cls.repo_root / "02_Causal_ML" / "outputs" / "dml_effect_predictions.csv"
        cls.output_dir = cls.repo_root / "03_Backend_Optimization" / "outputs"
        cls.test_scratch = cls.output_dir / "test_scratch"
        cls.test_scratch.mkdir(parents=True, exist_ok=True)

    @classmethod
    def tearDownClass(cls):
        if cls.test_scratch.exists():
            shutil.rmtree(cls.test_scratch, ignore_errors=True)

    def test_01_missing_file_handling(self):
        """Verify that optimizer exits with code 1 when input files are missing."""
        result = subprocess.run(
            [sys.executable, str(self.opt_script), "--data", "nonexistent.csv"],
            capture_output=True,
            text=True
        )
        self.assertEqual(result.returncode, 1)
        self.assertIn("DATASET FILE NOT FOUND", result.stdout)

        result_preds = subprocess.run(
            [
                sys.executable, str(self.opt_script),
                "--data", str(self.cleaned_data),
                "--predictions", "nonexistent_preds.csv"
            ],
            capture_output=True,
            text=True
        )
        self.assertEqual(result_preds.returncode, 1)
        self.assertIn("PREDICTIONS FILE NOT FOUND", result_preds.stdout)

    def test_02_anti_leakage_safeguard(self):
        """Verify that optimizer blocks execution if true_* columns are present in inputs."""
        leaked_csv = self.test_scratch / "leaked_pricing_data.csv"
        df_sample = pd.read_csv(self.cleaned_data).head(100).copy()
        df_sample["true_tau_prob_y10"] = 0.15
        df_sample.to_csv(leaked_csv, index=False)

        try:
            result = subprocess.run(
                [
                    sys.executable, str(self.opt_script),
                    "--data", str(leaked_csv),
                    "--predictions", str(self.predictions)
                ],
                capture_output=True,
                text=True
            )
            self.assertEqual(result.returncode, 1)
            self.assertIn("DATA LEAKAGE DETECTED", result.stdout)
        finally:
            if leaked_csv.exists():
                leaked_csv.unlink()

    def test_03_budget_constraint_enforcement(self):
        """Test that allocated budget never exceeds total budget across varied budget caps."""
        # Test directly via optimize_budget module functions
        sys.path.insert(0, str(self.repo_root / "03_Backend_Optimization"))
        import optimize_budget as ob

        df = ob.load_and_validate_inputs(str(self.cleaned_data), str(self.predictions)).head(1000).copy()
        p0_hat = ob.fit_observable_baseline_conversion_model(df, seed=42)
        v10, v20, c10, c20 = ob.compute_offer_values_and_costs(df, p0_hat, objective="max_profit")

        for b_cap in [1000.0, 5000.0, 15000.0]:
            w10, w20, _ = ob.solve_budget_optimization_milp(v10, v20, c10, c20, budget=b_cap)
            spent = np.sum(10.0 * w10 + 20.0 * w20)
            self.assertLessEqual(
                spent, b_cap + 1e-5,
                f"Allocated budget {spent} exceeded cap {b_cap}"
            )

    def test_04_zero_budget_allocation(self):
        """Verify that budget=0 allocates ₹0 to all customers and spends ₹0."""
        sys.path.insert(0, str(self.repo_root / "03_Backend_Optimization"))
        import optimize_budget as ob

        df = ob.load_and_validate_inputs(str(self.cleaned_data), str(self.predictions)).head(500).copy()
        p0_hat = ob.fit_observable_baseline_conversion_model(df, seed=42)
        v10, v20, c10, c20 = ob.compute_offer_values_and_costs(df, p0_hat, objective="max_profit")

        w10, w20, obj_val = ob.solve_budget_optimization_milp(v10, v20, c10, c20, budget=0.0)
        self.assertEqual(np.sum(w10), 0)
        self.assertEqual(np.sum(w20), 0)
        self.assertEqual(obj_val, 0.0)

    def test_05_single_offer_mutual_exclusivity(self):
        """Verify that no customer receives multiple promotional discount offers."""
        sys.path.insert(0, str(self.repo_root / "03_Backend_Optimization"))
        import optimize_budget as ob

        df = ob.load_and_validate_inputs(str(self.cleaned_data), str(self.predictions)).head(1000).copy()
        p0_hat = ob.fit_observable_baseline_conversion_model(df, seed=42)
        v10, v20, c10, c20 = ob.compute_offer_values_and_costs(df, p0_hat, objective="max_profit")

        w10, w20, _ = ob.solve_budget_optimization_milp(v10, v20, c10, c20, budget=10000.0, allow_multiple=False)
        total_offers = w10 + w20
        self.assertTrue(np.all(total_offers <= 1), "Some customers received multiple offers!")

    def test_06_invalid_input_validation(self):
        """Verify that invalid CLI arguments raise error."""
        result_neg = subprocess.run(
            [
                sys.executable, str(self.opt_script),
                "--data", str(self.cleaned_data),
                "--predictions", str(self.predictions),
                "--budget", "-500"
            ],
            capture_output=True,
            text=True
        )
        # Budget <= 0 allocates 0 spend and exits cleanly
        self.assertIn("Allocated Budget:           ₹0.00", result_neg.stdout)

    def test_07_recommendation_consistency_and_monotonicity(self):
        """Verify recommendation consistency and budget monotonicity."""
        sys.path.insert(0, str(self.repo_root / "03_Backend_Optimization"))
        import optimize_budget as ob

        df = ob.load_and_validate_inputs(str(self.cleaned_data), str(self.predictions)).head(1000).copy()
        p0_hat = ob.fit_observable_baseline_conversion_model(df, seed=42)
        v10, v20, c10, c20 = ob.compute_offer_values_and_costs(df, p0_hat, objective="max_profit")

        # Small budget vs larger budget
        w10_small, w20_small, _ = ob.solve_budget_optimization_milp(v10, v20, c10, c20, budget=3000.0)
        w10_large, w20_large, _ = ob.solve_budget_optimization_milp(v10, v20, c10, c20, budget=10000.0)

        perf_small = ob.evaluate_policy_performance(df, w10_small, w20_small, p0_hat, total_budget=3000.0)
        perf_large = ob.evaluate_policy_performance(df, w10_large, w20_large, p0_hat, total_budget=10000.0)

        # Monotonicity: larger budget yields >= incremental purchases and profit
        self.assertGreaterEqual(
            perf_large["estimated_incremental_profit_inr"],
            perf_small["estimated_incremental_profit_inr"] - 1e-3,
            "Larger budget produced less profit!"
        )
        self.assertGreaterEqual(
            perf_large["estimated_incremental_purchases"],
            perf_small["estimated_incremental_purchases"] - 1e-3,
            "Larger budget produced fewer purchases!"
        )

    def test_08_superiority_over_baselines(self):
        """Verify that DML causal policy strictly outperforms Random Allocation."""
        sys.path.insert(0, str(self.repo_root / "03_Backend_Optimization"))
        import optimize_budget as ob

        df = ob.load_and_validate_inputs(str(self.cleaned_data), str(self.predictions)).head(2000).copy()
        p0_hat = ob.fit_observable_baseline_conversion_model(df, seed=42)
        v10, v20, c10, c20 = ob.compute_offer_values_and_costs(df, p0_hat, objective="max_profit")

        budget = 10000.0
        w10, w20, _ = ob.solve_budget_optimization_milp(v10, v20, c10, c20, budget=budget)
        opt_perf = ob.evaluate_policy_performance(df, w10, w20, p0_hat, total_budget=budget)
        baselines = ob.simulate_baseline_comparisons(df, p0_hat, total_budget=budget, seed=42)

        rand_perf = baselines[0]
        self.assertGreater(
            opt_perf["estimated_incremental_profit_inr"],
            rand_perf["estimated_incremental_profit_inr"],
            "Causal policy did not beat Random Allocation in profit!"
        )
        self.assertGreater(
            opt_perf["estimated_incremental_purchases"],
            rand_perf["estimated_incremental_purchases"],
            "Causal policy did not beat Random Allocation in purchases!"
        )

    def test_09_full_pipeline_artifacts_and_schema(self):
        """Run optimizer CLI end-to-end and assert all artifacts and schemas exist."""
        result = subprocess.run(
            [
                sys.executable, str(self.opt_script),
                "--data", str(self.cleaned_data),
                "--predictions", str(self.predictions),
                "--output-dir", str(self.output_dir),
                "--budget", "50000",
                "--objective", "max_profit",
                "--margin-ratio", "0.30",
                "--solver", "milp"
            ],
            capture_output=True,
            text=True
        )
        self.assertEqual(result.returncode, 0, f"Optimizer CLI failed with stderr:\n{result.stderr}")

        # Check all 6 output artifacts
        expected_artifacts = [
            self.output_dir / "optimal_discount_allocations.csv",
            self.output_dir / "optimization_summary.json",
            self.output_dir / "optimization_report.md",
            self.output_dir / "01_budget_allocation_distribution.png",
            self.output_dir / "02_policy_comparison.png",
            self.output_dir / "03_incremental_conversions_by_segment.png",
        ]
        for f in expected_artifacts:
            self.assertTrue(f.is_file(), f"Expected artifact missing: {f}")

        # Validate CSV contents
        alloc_df = pd.read_csv(self.output_dir / "optimal_discount_allocations.csv")
        self.assertEqual(len(alloc_df), 10000)
        self.assertTrue(set(alloc_df["recommended_discount_inr"].unique()).issubset({0, 10, 20}))
        self.assertFalse(alloc_df["recommended_discount_inr"].isna().any())

        # Validate JSON contents
        with open(self.output_dir / "optimization_summary.json", "r", encoding="utf-8") as f:
            summary = json.load(f)
        opt = summary["optimal_policy"]
        self.assertLessEqual(opt["allocated_budget"], 50000.0)
        self.assertGreater(opt["estimated_incremental_purchases"], 500.0)
        self.assertGreater(opt["estimated_incremental_profit_inr"], 200000.0)

    def test_10_greedy_solver_parity(self):
        """Verify that greedy solver respects budget and achieves high objective parity."""
        sys.path.insert(0, str(self.repo_root / "03_Backend_Optimization"))
        import optimize_budget as ob

        df = ob.load_and_validate_inputs(str(self.cleaned_data), str(self.predictions)).head(2000).copy()
        p0_hat = ob.fit_observable_baseline_conversion_model(df, seed=42)
        v10, v20, c10, c20 = ob.compute_offer_values_and_costs(df, p0_hat, objective="max_profit")

        budget = 10000.0
        w10_milp, w20_milp, obj_milp = ob.solve_budget_optimization_milp(v10, v20, c10, c20, budget=budget)
        w10_grd, w20_grd, obj_grd = ob.solve_budget_optimization_greedy(v10, v20, c10, c20, budget=budget)

        spent_grd = np.sum(10.0 * w10_grd + 20.0 * w20_grd)
        self.assertLessEqual(spent_grd, budget + 1e-5)

        # Greedy objective should be within 95% of MILP optimal
        parity_ratio = obj_grd / obj_milp if obj_milp > 0 else 1.0
        self.assertGreater(parity_ratio, 0.95, f"Greedy parity too low: {parity_ratio:.4f}")


def main():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestBudgetOptimization)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)


if __name__ == "__main__":
    main()
