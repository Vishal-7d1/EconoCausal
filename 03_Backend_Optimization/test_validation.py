"""
test_validation.py
==================
Part of EconoCausal: Dynamic Pricing via Double Machine Learning
Module: 03_Backend_Optimization / Validation Test Suite

Description:
    Automated test suite verifying Causal Validation, Propensity Score Matching (PSM),
    Covariate Balance Diagnostics (SMD & Love Plot), Refutation Suite,
    Monte Carlo Treatment Permutations, Sensitivity Analyses, Pairwise Overlap,
    Production DML read-only verification, and honest p-value extraction:
    1. Tests missing input file handling.
    2. Tests anti-leakage safeguards (blocks execution if true_* columns present).
    3. Verifies PSM caliper match rate (> 90%) and covariate balance (|SMD| < 0.10) for both arms.
    4. Asserts all 5 refutation checks pass for ₹10 and ₹20 arms.
    5. Verifies artifact persistence, Love Plot, and complete JSON schema.
    6. Verifies temporary output isolation (scratch execution does not touch production).
    7. Tests Monte Carlo permutation reproducibility and Davison-Hinkley continuity correction.
    8. Verifies Cinelli-Hazlett mathematical bounds and Rosenbaum p_max monotonicity.
    9. Tests pairwise common support diagnostics and overlap trimming edge cases.
    10. Verifies production DML read-only validation without model alteration.
    11. Verifies honest DoWhy refutation p-value extraction (no hardcoded fallbacks).

Usage:
    python 03_Backend_Optimization/test_validation.py
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import unittest
from typing import Any

import numpy as np
import pandas as pd
from scipy import stats

# Add repo modules to path for direct testing
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.extend([
    str(REPO_ROOT / "02_Causal_ML"),
    str(REPO_ROOT / "03_Backend_Optimization"),
])

from causal_validation import (
    run_monte_carlo_permutation_test,
    compute_cinelli_hazlett_sensitivity,
    compute_rosenbaum_bounds,
    run_pairwise_overlap_diagnostics,
    run_propensity_trimming_sensitivity,
    validate_production_dml_estimator,
    COVARIATE_COLS,
)
from dowhy_causal_graph import extract_refutation_p_value


class TestCausalValidation(unittest.TestCase):
    """Comprehensive test suite for causal validation, refutations, and artifact integrity."""

    @classmethod
    def setUpClass(cls):
        cls.repo_root = REPO_ROOT
        cls.val_script = cls.repo_root / "03_Backend_Optimization" / "causal_validation.py"
        cls.cleaned_data = cls.repo_root / "01_Dataset_Analysis" / "cleaned_pricing_data.csv"
        cls.output_dir = cls.repo_root / "03_Backend_Optimization" / "outputs"
        cls.test_scratch = cls.output_dir / "test_scratch_val"
        cls.test_scratch.mkdir(parents=True, exist_ok=True)

    @classmethod
    def tearDownClass(cls):
        if cls.test_scratch.exists():
            shutil.rmtree(cls.test_scratch, ignore_errors=True)

    def test_01_missing_file_handling(self):
        """Verify that causal_validation.py exits with code 1 when dataset is missing."""
        result = subprocess.run(
            [sys.executable, str(self.val_script), "--data", "nonexistent.csv"],
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 1)
        self.assertIn("DATASET FILE NOT FOUND", result.stdout)

    def test_02_anti_leakage_safeguard(self):
        """Verify that causal_validation.py blocks execution if true_* columns are present in inputs."""
        leaked_csv = self.test_scratch / "leaked_pricing_data.csv"
        df_sample = pd.read_csv(self.cleaned_data).head(100).copy()
        df_sample["true_counterfactual_tau"] = 0.22
        df_sample.to_csv(leaked_csv, index=False)

        try:
            result = subprocess.run(
                [sys.executable, str(self.val_script), "--data", str(leaked_csv)],
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 1)
            self.assertIn("DATA LEAKAGE DETECTED", result.stdout)
        finally:
            if leaked_csv.exists():
                leaked_csv.unlink()

    def test_03_psm_and_balance_diagnostics(self):
        """Verify that PSM achieves high match rate and strictly reduces SMD below 0.10 for both arms."""
        summary_json = self.output_dir / "causal_validation_summary.json"
        self.assertTrue(summary_json.exists(), "causal_validation_summary.json should exist")

        with open(summary_json, "r", encoding="utf-8") as f:
            data = json.load(f)

        # Check Arm 10
        arm_10 = data["arm_10"]
        meta_10 = arm_10["matching_meta"]
        self.assertGreater(meta_10["match_rate_pct"], 90.0)
        self.assertGreater(meta_10["matched_pairs"], 2000)

        for rec in arm_10["balance_records"]:
            self.assertLess(
                rec["matched_abs_smd"],
                0.10,
                f"Covariate {rec['covariate']} matched SMD ({rec['matched_abs_smd']}) exceeds 0.10 threshold!",
            )
            self.assertEqual(rec["status"], "PASS")

        # Check Arm 20
        arm_20 = data["arm_20"]
        meta_20 = arm_20["matching_meta"]
        self.assertGreater(meta_20["match_rate_pct"], 90.0)
        self.assertGreater(meta_20["matched_pairs"], 1800)

        for rec in arm_20["balance_records"]:
            self.assertLess(
                rec["matched_abs_smd"],
                0.10,
                f"Arm 20 Covariate {rec['covariate']} matched SMD ({rec['matched_abs_smd']}) exceeds 0.10 threshold!",
            )
            self.assertEqual(rec["status"], "PASS")

    def test_04_refutation_suite_criteria(self):
        """Verify that all causal falsification tests pass statistical bounds for both arms."""
        summary_json = self.output_dir / "causal_validation_summary.json"
        with open(summary_json, "r", encoding="utf-8") as f:
            data = json.load(f)

        # Check Arm 10 refutations
        refutations_10 = data["arm_10"]["refutations"]
        self.assertGreaterEqual(len(refutations_10), 5)

        # 1. Placebo test
        placebo = refutations_10[0]
        self.assertEqual(placebo["refutation_type"], "Placebo Treatment Test")
        self.assertEqual(placebo["status"], "PASS")
        self.assertGreater(placebo["p_value"], 0.05)
        self.assertLess(abs(placebo["placebo_effect_pct"]), 2.0)

        # 2. Random common cause test
        confounder = refutations_10[1]
        self.assertEqual(confounder["refutation_type"], "Random Common Cause Refutation")
        self.assertEqual(confounder["status"], "PASS")
        self.assertLess(confounder["drift_pct"], 5.0)

        # 3. Data subset removal test
        subset = refutations_10[2]
        self.assertEqual(subset["refutation_type"], "Data Subset Removal Refutation")
        self.assertEqual(subset["status"], "PASS")
        self.assertLess(subset["drift_pct"], 6.0)

        # 4. Trimming sensitivity
        trimming = refutations_10[3]
        self.assertEqual(trimming["refutation_type"], "Positivity Overlap Trimming Sensitivity")
        self.assertEqual(trimming["status"], "PASS")
        self.assertLess(trimming["drift_pct"], 8.0)

        # 5. Monte Carlo / Model-Based Residual Permutation test
        perm_10 = refutations_10[4]
        self.assertIn(perm_10["refutation_type"], ["Model-Based Residual Permutation Diagnostic", "Monte Carlo Treatment Permutation Test"])
        self.assertEqual(perm_10["status"], "PASS")
        self.assertLessEqual(perm_10["p_value"], 0.05)
        self.assertEqual(perm_10["n_permutations"], 500)

        # Check Arm 20 refutations
        refutations_20 = data["arm_20"]["refutations"]
        self.assertGreaterEqual(len(refutations_20), 5)
        for ref in refutations_20:
            self.assertEqual(ref["status"], "PASS")

    def test_05_artifacts_and_schema(self):
        """Verify that all figures, markdown report, JSON summary, and new schema sections exist."""
        expected_artifacts = [
            self.output_dir / "04_love_plot_balance.png",
            self.output_dir / "05_propensity_balance_distribution.png",
            self.output_dir / "causal_validation_summary.json",
            self.output_dir / "causal_validation_report.md",
        ]

        for art in expected_artifacts:
            self.assertTrue(art.exists(), f"Expected artifact not found: {art}")
            self.assertGreater(art.stat().st_size, 100, f"Artifact appears empty: {art}")

        with open(self.output_dir / "causal_validation_summary.json", "r", encoding="utf-8") as f:
            data = json.load(f)

        # Love plot data
        self.assertIn("love_plot_data", data)
        self.assertEqual(len(data["love_plot_data"]["covariates"]), 9)
        self.assertEqual(data["causal_robustness_audit"]["status"], "PASSED")
        self.assertGreaterEqual(data["causal_robustness_audit"]["robustness_score"], 90.0)

        # Arm 10 & 20 Sensitivity analysis schemas
        for arm_key in ["arm_10", "arm_20"]:
            self.assertIn("sensitivity_analysis", data[arm_key])
            sa = data[arm_key]["sensitivity_analysis"]
            self.assertIn("cinelli_hazlett", sa)
            self.assertIn("rosenbaum_bounds", sa)
            ch = sa["cinelli_hazlett"]
            self.assertGreater(ch["robustness_value_q1_pct"], 0.0)
            self.assertGreater(ch["robustness_value_alpha_pct"], 0.0)
            self.assertIn("observed_covariate_benchmarks", ch)
            rosen = sa["rosenbaum_bounds"]
            self.assertGreaterEqual(rosen["gamma_critical"], 1.0)
            self.assertIn("sample_bounds", rosen)

        # Pairwise overlap diagnostics schema
        self.assertIn("pairwise_overlap_diagnostics", data)
        pod = data["pairwise_overlap_diagnostics"]
        self.assertIn("arm_10_vs_0", pod)
        self.assertIn("arm_20_vs_0", pod)
        self.assertIn("arm_20_vs_10", pod)

        # Production DML validation schema
        self.assertIn("production_dml_validation", data)
        dml_val = data["production_dml_validation"]
        self.assertIn(dml_val["status"], ["VALIDATED", "SKIPPED"])
        if dml_val["status"] == "VALIDATED":
            self.assertEqual(dml_val["estimator_class"], "LinearDML")
            self.assertGreaterEqual(dml_val["monotonicity_share_pct"], 80.0)

    def test_06_temporary_output_isolation(self):
        """Verify that causal_validation.py writes strictly to target output-dir without touching production."""
        isolated_scratch = self.test_scratch / "isolated_run"
        isolated_scratch.mkdir(parents=True, exist_ok=True)

        try:
            result = subprocess.run(
                [
                    sys.executable,
                    str(self.val_script),
                    "--data", str(self.cleaned_data),
                    "--output-dir", str(isolated_scratch),
                    "--n-permutations", "10",
                    "--skip-dml-eval",
                ],
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 0, f"Validation script failed: {result.stderr}")

            # Verify files were created in isolated scratch
            self.assertTrue((isolated_scratch / "causal_validation_summary.json").exists())
            self.assertTrue((isolated_scratch / "causal_validation_report.md").exists())
            self.assertTrue((isolated_scratch / "04_love_plot_balance.png").exists())
            self.assertTrue((isolated_scratch / "05_propensity_balance_distribution.png").exists())

            # Read generated summary
            with open(isolated_scratch / "causal_validation_summary.json", "r", encoding="utf-8") as f:
                iso_data = json.load(f)
            self.assertEqual(iso_data["causal_robustness_audit"]["status"], "PASSED")
            self.assertEqual(iso_data["production_dml_validation"]["status"], "SKIPPED")
        finally:
            if isolated_scratch.exists():
                shutil.rmtree(isolated_scratch, ignore_errors=True)

    def test_07_monte_carlo_permutation_reproducibility(self):
        """Verify reproducible permutation results with fixed seed and continuity-corrected p-value bounds."""
        df = pd.read_csv(self.cleaned_data)
        df_10 = df[df["discount_inr"].isin([0, 10])].copy().head(300)
        df_10["treated_binary"] = (df_10["discount_inr"] == 10).astype(int)

        # Run 1
        res1 = run_monte_carlo_permutation_test(
            df_arm=df_10,
            treatment_col="treated_binary",
            outcome_col="observed_purchase",
            covariates=COVARIATE_COLS,
            observed_effect=0.14,
            n_permutations=50,
            seed=42,
        )

        # Run 2 (identical seed)
        res2 = run_monte_carlo_permutation_test(
            df_arm=df_10,
            treatment_col="treated_binary",
            outcome_col="observed_purchase",
            covariates=COVARIATE_COLS,
            observed_effect=0.14,
            n_permutations=50,
            seed=42,
        )

        self.assertEqual(res1["p_value"], res2["p_value"], "Permutation p-value must be deterministic given fixed seed")
        self.assertEqual(res1["null_ci_95"], res2["null_ci_95"])
        self.assertEqual(res1["n_permutations"], 50)

        # Verify continuity-corrected p-value calculation: p = (count + 1) / (B + 1)
        # Even if 0 permutations exceed, minimum p-value is 1 / (B + 1) > 0.
        self.assertGreaterEqual(res1["p_value"], 1.0 / (50 + 1))
        self.assertLessEqual(res1["p_value"], 1.0)

    def test_08_sensitivity_analysis_bounds_and_monotonicity(self):
        """Verify Cinelli-Hazlett robustness bounds and Rosenbaum bounds monotonicity."""
        df = pd.read_csv(self.cleaned_data)
        df_10 = df[df["discount_inr"].isin([0, 10])].copy().head(400)
        df_10["treated_binary"] = (df_10["discount_inr"] == 10).astype(int)

        # Cinelli-Hazlett
        ch = compute_cinelli_hazlett_sensitivity(
            df_arm=df_10,
            treatment_col="treated_binary",
            outcome_col="observed_purchase",
            covariates=COVARIATE_COLS,
            observed_effect=0.14,
            seed=42,
        )

        self.assertIn("robustness_value_q1_pct", ch)
        self.assertIn("robustness_value_alpha_pct", ch)
        self.assertGreater(ch["robustness_value_q1_pct"], 0.0)
        self.assertGreaterEqual(
            ch["robustness_value_q1_pct"],
            ch["robustness_value_alpha_pct"],
            "RV_{q=1} must be >= RV_{alpha} for significant positive effects",
        )
        for b_name, b_val in ch["observed_covariate_benchmarks"].items():
            self.assertGreaterEqual(b_val["partial_r2_outcome"], 0.0)
            self.assertGreaterEqual(b_val["partial_r2_treatment"], 0.0)

        # Rosenbaum bounds
        df_t = df_10[df_10["treated_binary"] == 1].head(100)
        df_c = df_10[df_10["treated_binary"] == 0].head(100)
        rosen = compute_rosenbaum_bounds(
            matched_t_df=df_t,
            matched_c_df=df_c,
            outcome_col="observed_purchase",
            gamma_max=2.5,
            gamma_step=0.2,
        )

        self.assertIn("gamma_critical", rosen)
        bounds = rosen["sample_bounds"]
        self.assertGreater(len(bounds), 3)

        # Assert p_upper_bound is monotonically non-decreasing in Gamma
        p_max_values = [pt["p_upper_bound"] for pt in bounds]
        for i in range(len(p_max_values) - 1):
            self.assertLessEqual(
                p_max_values[i],
                p_max_values[i + 1] + 1e-6,
                f"Rosenbaum p_upper_bound must be non-decreasing with Gamma: {p_max_values[i]} > {p_max_values[i+1]}",
            )

    def test_09_pairwise_overlap_and_trimming_edge_cases(self):
        """Verify pairwise overlap diagnostics across all 3 contrasts and robust trimming edge cases."""
        df = pd.read_csv(self.cleaned_data).head(500)
        pod = run_pairwise_overlap_diagnostics(df, COVARIATE_COLS, seed=42)

        for contrast in ["arm_10_vs_0", "arm_20_vs_0", "arm_20_vs_10"]:
            self.assertIn(contrast, pod)
            diag = pod[contrast]
            self.assertIn("propensity_summary", diag)
            self.assertIn("trimming_sensitivity", diag)
            ps = diag["propensity_summary"]
            self.assertGreater(ps["min"], 0.0)
            self.assertLess(ps["max"], 1.0)

            # Sample size must decrease or stay equal as trimming interval tightens
            grid = diag["trimming_sensitivity"]
            counts = [row["units_retained"] for row in grid]
            for i in range(len(counts) - 1):
                self.assertGreaterEqual(
                    counts[i],
                    counts[i + 1],
                    f"Sample size should not increase as trimming bounds narrow for {contrast}",
                )

        # Test trimming edge cases on small synthetic sample
        df_edge = pd.DataFrame({
            "treated_binary": [1] * 5 + [0] * 5,
            "observed_purchase": [1, 0, 1, 1, 0, 0, 0, 1, 0, 0],
            "age": [25, 30, 35, 40, 45, 50, 55, 60, 65, 70],
            "monthly_income_inr": np.linspace(20000, 80000, 10),
            "web_visits_last_30d": [2, 5, 1, 7, 3, 4, 8, 2, 6, 9],
            "past_purchases_count": [1, 0, 3, 2, 0, 4, 1, 2, 5, 0],
            "days_since_last_purchase": np.linspace(5, 60, 10),
            "cart_baseline_value_inr": np.linspace(500, 2000, 10),
            "loyalty_member": [1, 0] * 5,
            "device_Mobile": [1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
            "device_Tablet": [0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
            "propensity_score": np.linspace(0.1, 0.9, 10),
        })
        trim_res = run_propensity_trimming_sensitivity(
            df_arm=df_edge,
            treatment_col="treated_binary",
            outcome_col="observed_purchase",
            covariates=COVARIATE_COLS,
            observed_effect=0.20,
            seed=42,
        )
        self.assertIn(trim_res["status"], ["PASS", "WARNING", "FAIL"])

    def test_10_production_dml_read_only_validation(self):
        """Verify production DML model validation executes strictly read-only and respects monotonicity."""
        dml_joblib = self.repo_root / "02_Causal_ML" / "outputs" / "dml_model.joblib"
        self.assertTrue(dml_joblib.exists(), "dml_model.joblib must exist")

        with open(dml_joblib, "rb") as f:
            baseline_hash = hashlib.sha256(f.read()).hexdigest()

        # Execute read-only evaluation
        eval_result = validate_production_dml_estimator(self.repo_root, self.cleaned_data)

        self.assertEqual(eval_result["status"], "VALIDATED")
        self.assertEqual(eval_result["estimator_class"], "LinearDML")
        self.assertGreaterEqual(eval_result["monotonicity_share_pct"], 80.0)
        self.assertIn("tau_10_summary", eval_result)
        self.assertIn("tau_20_summary", eval_result)

        # Verify hash was completely untouched
        with open(dml_joblib, "rb") as f:
            post_hash = hashlib.sha256(f.read()).hexdigest()
        self.assertEqual(baseline_hash, post_hash, "dml_model.joblib was modified during evaluation!")

    def test_11_dowhy_p_value_honest_extraction(self):
        """Verify that DoWhy refutation p-value extraction reports honest unavailable statuses without fabrications."""
        class MockRefutation:
            def __init__(self, p_value: Any):
                self.p_value = p_value

        # Case 1: Valid float p-value
        valid_obj = MockRefutation(0.3842)
        p, status = extract_refutation_p_value(valid_obj)
        self.assertEqual(p, 0.3842)
        self.assertEqual(status, "computed")

        # Case 2: None p-value (DoWhy could not compute)
        none_obj = MockRefutation(None)
        p, status = extract_refutation_p_value(none_obj)
        self.assertIsNone(p)
        self.assertIn("unavailable", status)

        # Case 3: NaN p-value
        nan_obj = MockRefutation(np.nan)
        p, status = extract_refutation_p_value(nan_obj)
        self.assertIsNone(p)
        self.assertIn("unavailable", status)

        # Case 4: Missing attribute
        class EmptyObj:
            pass
        p, status = extract_refutation_p_value(EmptyObj())
        self.assertIsNone(p)
        self.assertIn("unavailable", status)

        # Verify never returns hardcoded legacy values (0.741 or 0.485)
        for obj in [none_obj, nan_obj, EmptyObj()]:
            extracted_p, _ = extract_refutation_p_value(obj)
            self.assertNotIn(extracted_p, [0.741, 0.485])

    def test_12_cinelli_hazlett_benchmark_conditions_on_treatment(self):
        """Verify that the Cinelli-Hazlett outcome benchmark R^2(Y ~ X_j | T, X_{-j}) conditions on treatment."""
        # Construct synthetic dataset where X_target is confounded with T, but has 0 direct effect on Y given T
        np.random.seed(42)
        n = 500
        t = np.random.binomial(1, 0.5, n)
        # X_target strongly correlates with T
        x_bench = t * 2.0 + np.random.normal(0, 0.2, n)
        # Other covariates independent of Y
        x_other = np.random.normal(0, 1, (n, 8))
        # Y is purely driven by T
        y = t * 1.5 + np.random.normal(0, 0.1, n)

        cov_names = ["monthly_income_inr"] + [f"cov_{i}" for i in range(8)]
        data_dict = {
            "treated_binary": t,
            "observed_purchase": y,
            "monthly_income_inr": x_bench,
        }
        for i in range(8):
            data_dict[f"cov_{i}"] = x_other[:, i]

        df_synthetic = pd.DataFrame(data_dict)
        ch_res = compute_cinelli_hazlett_sensitivity(
            df_arm=df_synthetic,
            treatment_col="treated_binary",
            outcome_col="observed_purchase",
            covariates=cov_names,
            observed_effect=1.5,
            seed=42,
        )

        bench = ch_res["observed_covariate_benchmarks"]["monthly_income_inr"]
        # Treatment benchmark R^2(T ~ X_j | X_{-j}) should be very high
        self.assertGreater(bench["partial_r2_treatment"], 50.0)
        # Outcome benchmark R^2(Y ~ X_j | T, X_{-j}) must be near zero because it conditions on T!
        self.assertLess(bench["partial_r2_outcome"], 5.0, "Outcome benchmark failed to condition on T!")

    def test_13_rosenbaum_binary_matched_pair_edge_cases_and_monotonicity(self):
        """Verify Rosenbaum sensitivity bounds across all edge cases, monotonicity, and grid stability."""
        # Case 1: No discordant pairs (all identical pairs)
        df_t0 = pd.DataFrame({"observed_purchase": [1, 0, 1, 0]})
        df_c0 = pd.DataFrame({"observed_purchase": [1, 0, 1, 0]})
        res0 = compute_rosenbaum_bounds(df_t0, df_c0)
        self.assertEqual(res0["discordant_pairs"], 0)
        self.assertIsNone(res0["gamma_critical"])
        self.assertEqual(len(res0["sample_bounds"]), 0)

        # Case 2: All positive discordant pairs (1 vs 0)
        df_t_pos = pd.DataFrame({"observed_purchase": [1] * 50})
        df_c_pos = pd.DataFrame({"observed_purchase": [0] * 50})
        res_pos = compute_rosenbaum_bounds(df_t_pos, df_c_pos, gamma_max=3.0, gamma_step=0.1)
        self.assertEqual(res_pos["discordant_pairs"], 50)
        # Under Gamma=1.0, p must be extremely small
        self.assertLess(res_pos["sample_bounds"][0]["p_upper_bound"], 1e-4)
        # Monotonicity: p_upper must be strictly non-decreasing
        p_vals = [pt["p_upper_bound"] for pt in res_pos["sample_bounds"]]
        for i in range(len(p_vals) - 1):
            self.assertLessEqual(p_vals[i], p_vals[i + 1] + 1e-7)

        # Case 3: All negative discordant pairs (0 vs 1)
        df_t_neg = pd.DataFrame({"observed_purchase": [0] * 50})
        df_c_neg = pd.DataFrame({"observed_purchase": [1] * 50})
        res_neg = compute_rosenbaum_bounds(df_t_neg, df_c_neg, gamma_max=3.0, gamma_step=0.1)
        self.assertEqual(res_neg["discordant_pairs"], 50)
        # Negative effect fails immediately at Gamma=1.0 (p > 0.05)
        self.assertGreater(res_neg["sample_bounds"][0]["p_upper_bound"], 0.50)
        self.assertEqual(res_neg["gamma_critical"], 1.0)

        # Case 4: Mixed discordant pairs with known critical Gamma
        # 35 positive, 15 negative
        df_t_mix = pd.DataFrame({"observed_purchase": [1] * 35 + [0] * 15 + [1] * 10})
        df_c_mix = pd.DataFrame({"observed_purchase": [0] * 35 + [1] * 15 + [1] * 10})
        res_mix = compute_rosenbaum_bounds(df_t_mix, df_c_mix, gamma_max=3.0, gamma_step=0.1)
        self.assertEqual(res_mix["discordant_pairs"], 50)
        self.assertIsNotNone(res_mix["gamma_critical"])
        self.assertGreater(res_mix["gamma_critical"], 1.0)
        self.assertLessEqual(res_mix["gamma_critical"], 3.0)

        # Monotonicity check on mixed pairs
        p_mix = [pt["p_upper_bound"] for pt in res_mix["sample_bounds"]]
        for i in range(len(p_mix) - 1):
            self.assertLessEqual(p_mix[i], p_mix[i + 1] + 1e-7)

    def test_14_rosenbaum_continuity_correction_and_exact_binomial_parity(self):
        """
        Verify mathematical correctness of the one-sided upper-tail continuity correction
        and benchmark against exact binomial calculations. This test deterministically fails
        under the pre-fix two-sided shrinkage formula (which set dev=0 -> correction=0, or dev<0 -> +0.5).
        """
        # Test 1: Full-grid monotonicity across E[T] >= n_pos transition
        # 35 positive, 15 negative (S = 50). E[T] = 50 * Gamma / (1 + Gamma).
        # At Gamma=2.30: E[T] = 34.85 < 35 (dev > 0)
        # At Gamma=2.35: E[T] = 35.07 > 35 (dev < 0)
        # The pre-fix formula inverted the continuity correction sign at dev < 0,
        # dropping p from 0.54270 at Gamma=2.30 down to 0.44771 at Gamma=2.35.
        df_t35 = pd.DataFrame({"observed_purchase": [1] * 35 + [0] * 15})
        df_c35 = pd.DataFrame({"observed_purchase": [0] * 35 + [1] * 15})
        res35 = compute_rosenbaum_bounds(df_t35, df_c35, gamma_max=3.0, gamma_step=0.05)
        all_p = [pt["p_upper_bound"] for pt in res35["bounds_table"]]
        for i in range(len(all_p) - 1):
            self.assertLessEqual(
                all_p[i],
                all_p[i + 1] + 1e-7,
                f"Monotonicity violation between Gamma={res35['bounds_table'][i]['gamma']} "
                f"and Gamma={res35['bounds_table'][i+1]['gamma']}: {all_p[i]} > {all_p[i+1]}"
            )
        # Specific check at the transition point (fails on pre-fix code: 0.54270 > 0.44771)
        pt_map = {pt["gamma"]: pt["p_upper_bound"] for pt in res35["bounds_table"]}
        self.assertGreater(pt_map[2.35], pt_map[2.30], "p(Gamma=2.35) must exceed p(Gamma=2.30)")
        self.assertAlmostEqual(pt_map[2.35], 0.57048, places=4)

        # Test 2: Continuity correction when dev == 0 (n_pos == S/2 at Gamma=1.0)
        # 25 positive, 25 negative (S = 50). E[T] = 25.0, var = 12.5.
        # Exact Binomial: P(T >= 25) = 0.55614.
        # Corrected Normal: z = (25 - 0.5 - 25) / sqrt(12.5) = -0.14142 -> p = 0.55627.
        # Pre-fix code gave exactly 0.50000 (dev=0 -> correction=0).
        df_t25 = pd.DataFrame({"observed_purchase": [1] * 25 + [0] * 25})
        df_c25 = pd.DataFrame({"observed_purchase": [0] * 25 + [1] * 25})
        res25 = compute_rosenbaum_bounds(df_t25, df_c25, gamma_max=1.0, gamma_step=0.1)
        p_25 = res25["sample_bounds"][0]["p_upper_bound"]
        self.assertGreater(p_25, 0.50, "p-value at n_pos=S/2 under Gamma=1.0 must be > 0.50 due to discrete mass at 25")
        self.assertAlmostEqual(p_25, 0.55627, places=4)

        # Test 3: Continuity correction when dev < 0 (n_pos < S/2 at Gamma=1.0)
        # 24 positive, 26 negative (S = 50). E[T] = 25.0, var = 12.5.
        # Exact Binomial: P(T >= 24) = 0.66408.
        # Corrected Normal: z = (24 - 0.5 - 25) / sqrt(12.5) = -0.42426 -> p = 0.66431.
        # Pre-fix code gave 0.55627 (dev=-1 -> correction=-0.5 -> dev - (-0.5) = -0.5).
        df_t24 = pd.DataFrame({"observed_purchase": [1] * 24 + [0] * 26})
        df_c24 = pd.DataFrame({"observed_purchase": [0] * 24 + [1] * 26})
        res24 = compute_rosenbaum_bounds(df_t24, df_c24, gamma_max=1.0, gamma_step=0.1)
        p_24 = res24["sample_bounds"][0]["p_upper_bound"]
        self.assertGreater(p_24, 0.60, "p-value at n_pos=24/50 must reflect correct upper-tail continuity correction")
        self.assertAlmostEqual(p_24, 0.66431, places=4)

        # Test 4: Parity with Exact Binomial across small sample S=10
        # 8 positive, 2 negative. Verify asymptotic normal approx error bounded <= 0.025 across all Gamma in [1.0, 2.5]
        df_t8 = pd.DataFrame({"observed_purchase": [1] * 8 + [0] * 2})
        df_c8 = pd.DataFrame({"observed_purchase": [0] * 8 + [1] * 2})
        res8 = compute_rosenbaum_bounds(df_t8, df_c8, gamma_max=2.5, gamma_step=0.1)
        for pt in res8["bounds_table"]:
            g = pt["gamma"]
            p_norm = pt["p_upper_bound"]
            p_plus = g / (1.0 + g)
            p_exact = float(round(stats.binom.sf(7, 10, p_plus), 5))
            self.assertLessEqual(abs(p_norm - p_exact), 0.025, f"Approximation error at Gamma={g} exceeded 0.025")


if __name__ == "__main__":
    unittest.main()

