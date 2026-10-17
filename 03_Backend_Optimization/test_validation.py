"""
test_validation.py
==================
Part of EconoCausal: Dynamic Pricing via Double Machine Learning
Module: 03_Backend_Optimization / Validation Test Suite

Description:
    Automated test suite verifying the Causal Validation, Propensity Score Matching (PSM),
    Covariate Balance Diagnostics (SMD & Love Plot), and Refutation Suite:
    1. Tests missing input file handling.
    2. Tests anti-leakage safeguards (blocks execution if true_* columns present).
    3. Verifies PSM caliper match rate (> 90%).
    4. Asserts post-matching covariate balance: |SMD| < 0.10 for all 9 pretreatment covariates.
    5. Asserts Placebo Treatment Refutation (effect collapses to ~0, p > 0.05).
    6. Asserts Random Common Cause Refutation (effect invariant under confounder noise, drift < 5%).
    7. Asserts Data Subset Removal Refutation (80% bootstrap stability).
    8. Verifies artifact persistence and JSON schema completeness.

Usage:
    python 03_Backend_Optimization/test_validation.py
"""

from __future__ import annotations

import json
from pathlib import Path
import shutil
import subprocess
import sys
import unittest

import numpy as np
import pandas as pd


class TestCausalValidation(unittest.TestCase):
    """Test suite for PSM, covariate balance checks, and causal refutations."""

    @classmethod
    def setUpClass(cls):
        cls.repo_root = Path(__file__).resolve().parent.parent
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
        """Verify that PSM achieves high match rate and strictly reduces SMD below 0.10 threshold."""
        summary_json = self.output_dir / "causal_validation_summary.json"
        self.assertTrue(summary_json.exists(), "causal_validation_summary.json should exist")

        with open(summary_json, "r", encoding="utf-8") as f:
            data = json.load(f)

        # Check Arm 10
        arm_10 = data["arm_10"]
        meta_10 = arm_10["matching_meta"]
        self.assertGreater(meta_10["match_rate_pct"], 90.0)
        self.assertGreater(meta_10["matched_pairs"], 2000)

        # Check that ALL covariates in Arm 10 have matched |SMD| < 0.10
        for rec in arm_10["balance_records"]:
            self.assertLess(
                rec["matched_abs_smd"],
                0.10,
                f"Covariate {rec['covariate']} matched SMD ({rec['matched_abs_smd']}) exceeds 0.10 threshold!",
            )
            self.assertEqual(rec["status"], "PASS")

    def test_04_refutation_suite_criteria(self):
        """Verify that all four causal falsification tests pass their statistical bounds."""
        summary_json = self.output_dir / "causal_validation_summary.json"
        with open(summary_json, "r", encoding="utf-8") as f:
            data = json.load(f)

        refutations = data["arm_10"]["refutations"]
        self.assertEqual(len(refutations), 4)

        # 1. Placebo test
        placebo = refutations[0]
        self.assertEqual(placebo["refutation_type"], "Placebo Treatment Test")
        self.assertEqual(placebo["status"], "PASS")
        self.assertGreater(placebo["p_value"], 0.05)
        self.assertLess(abs(placebo["placebo_effect_pct"]), 2.0)

        # 2. Random common cause test
        confounder = refutations[1]
        self.assertEqual(confounder["refutation_type"], "Random Common Cause Refutation")
        self.assertEqual(confounder["status"], "PASS")
        self.assertLess(confounder["drift_pct"], 5.0)

        # 3. Data subset removal test
        subset = refutations[2]
        self.assertEqual(subset["refutation_type"], "Data Subset Removal Refutation")
        self.assertEqual(subset["status"], "PASS")
        self.assertLess(subset["drift_pct"], 6.0)

        # 4. Trimming sensitivity
        trimming = refutations[3]
        self.assertEqual(trimming["refutation_type"], "Positivity Overlap Trimming Sensitivity")
        self.assertEqual(trimming["status"], "PASS")
        self.assertLess(trimming["drift_pct"], 8.0)

    def test_05_artifacts_and_schema(self):
        """Verify that all figures, markdown report, and JSON summary are created and well-formed."""
        expected_artifacts = [
            self.output_dir / "04_love_plot_balance.png",
            self.output_dir / "05_propensity_balance_distribution.png",
            self.output_dir / "causal_validation_summary.json",
            self.output_dir / "causal_validation_report.md",
        ]

        for art in expected_artifacts:
            self.assertTrue(art.exists(), f"Expected artifact not found: {art}")
            self.assertGreater(art.stat().st_size, 100, f"Artifact appears empty: {art}")

        # Check Love Plot data structure in JSON
        with open(self.output_dir / "causal_validation_summary.json", "r", encoding="utf-8") as f:
            data = json.load(f)

        self.assertIn("love_plot_data", data)
        self.assertIn("covariates", data["love_plot_data"])
        self.assertIn("raw_abs_smd", data["love_plot_data"])
        self.assertIn("matched_abs_smd", data["love_plot_data"])
        self.assertEqual(len(data["love_plot_data"]["covariates"]), 9)
        self.assertIn("causal_robustness_audit", data)
        self.assertEqual(data["causal_robustness_audit"]["status"], "PASSED")
        self.assertGreaterEqual(data["causal_robustness_audit"]["robustness_score"], 90.0)


if __name__ == "__main__":
    unittest.main()
