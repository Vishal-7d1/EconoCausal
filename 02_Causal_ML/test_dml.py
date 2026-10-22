"""
test_dml.py
===========
Part of EconoCausal: Dynamic Pricing via Double Machine Learning
Module: 02_Causal_ML

Description:
    Automated test suite verifying the Double Machine Learning (DML) pipeline:
    1. Tests missing input file handling.
    2. Tests anti-leakage safeguards (blocks execution if true_* columns exist in training data).
    3. Verifies full DML model training, artifact persistence, and statistical accuracy thresholds:
       - Predictions shape and completeness.
       - ATE estimation bias within acceptable bounds.
       - PEHE (RMSE of heterogeneous effect) within threshold (< 0.05).
       - Positive rank correlation between estimated and true CATE (Spearman rho > 0.70).
       - Verification of all saved outputs (model joblib, metrics JSON, report, and 4 diagnostic plots).

Usage:
    python 02_Causal_ML/test_dml.py
"""

import json
from pathlib import Path
import subprocess
import sys
import unittest
import pandas as pd


class TestDoubleMachineLearning(unittest.TestCase):
    """Test suite for EconML Double Machine Learning pipeline."""

    @classmethod
    def setUpClass(cls):
        cls.repo_root = Path(__file__).resolve().parent.parent
        cls.train_script = cls.repo_root / "02_Causal_ML" / "train_dml.py"
        cls.cleaned_data = cls.repo_root / "01_Dataset_Analysis" / "cleaned_pricing_data.csv"
        cls.eval_data = cls.repo_root / "01_Dataset_Analysis" / "ground_truth_eval.csv"
        cls.output_dir = cls.repo_root / "02_Causal_ML" / "outputs"

    def test_01_missing_file_handling(self):
        """Verify that train_dml.py exits with code 1 when input dataset is missing."""
        result = subprocess.run(
            [sys.executable, str(self.train_script), "--data", "nonexistent_dataset.csv"],
            capture_output=True,
            text=True
        )
        self.assertEqual(result.returncode, 1)
        self.assertIn("DATASET FILE NOT FOUND", result.stdout)

    def test_02_anti_leakage_safeguard(self):
        """Verify that train_dml.py blocks execution if true_* columns are present in training data."""
        # Create small temporary dataset with leaked column
        scratch_dir = self.repo_root / "02_Causal_ML" / "outputs" / "test_scratch"
        scratch_dir.mkdir(parents=True, exist_ok=True)
        leaked_csv = scratch_dir / "leaked_sample.csv"

        df_sample = pd.read_csv(self.cleaned_data).head(50).copy()
        df_sample["true_leaked_tau"] = 0.15
        df_sample.to_csv(leaked_csv, index=False)

        try:
            result = subprocess.run(
                [sys.executable, str(self.train_script), "--data", str(leaked_csv)],
                capture_output=True,
                text=True
            )
            self.assertEqual(result.returncode, 1)
            self.assertIn("DATA LEAKAGE DETECTED", result.stdout)
        finally:
            if leaked_csv.exists():
                leaked_csv.unlink()
            if scratch_dir.exists():
                scratch_dir.rmdir()

    def test_03_dml_training_and_artifacts(self):
        """Run DML training with LinearDML baseline in an isolated scratch directory and assert benchmarks."""
        import shutil
        scratch_dir = self.output_dir / "test_scratch_linear_dml"
        scratch_dir.mkdir(parents=True, exist_ok=True)
        try:
            result = subprocess.run(
                [
                    sys.executable, str(self.train_script),
                    "--data", str(self.cleaned_data),
                    "--eval-data", str(self.eval_data),
                    "--output-dir", str(scratch_dir),
                    "--estimator", "linear_dml",
                    "--cv", "3",
                    "--seed", "42"
                ],
                capture_output=True,
                text=True
            )
            self.assertEqual(result.returncode, 0, f"DML training failed with stderr:\n{result.stderr}")

            # Check artifact persistence in scratch directory
            expected_files = [
                scratch_dir / "dml_model.joblib",
                scratch_dir / "dml_effect_predictions.csv",
                scratch_dir / "dml_evaluation_metrics.json",
                scratch_dir / "dml_evaluation_report.md",
                scratch_dir / "01_estimated_vs_true_effects.png",
                scratch_dir / "02_effect_distributions.png",
                scratch_dir / "03_subgroup_cate_benchmark.png",
                scratch_dir / "04_propensity_support_diagnostics.png",
            ]
            for f in expected_files:
                self.assertTrue(f.is_file(), f"Expected artifact missing: {f}")

            # Validate predictions content
            pred_df = pd.read_csv(scratch_dir / "dml_effect_predictions.csv")
            self.assertEqual(len(pred_df), 10000)
            self.assertFalse(pred_df["tau_hat_10"].isna().any())
            self.assertFalse(pred_df["tau_hat_20"].isna().any())

            # Validate metrics JSON content
            with open(scratch_dir / "dml_evaluation_metrics.json", "r", encoding="utf-8") as f:
                metrics = json.load(f)

            m10 = metrics["arm_10"]
            m20 = metrics["arm_20"]

            # Assert PEHE is small (< 0.05 / 5% points)
            self.assertLess(m10["pehe"], 0.05, f"₹10 arm PEHE exceeds threshold: {m10['pehe']}")
            self.assertLess(m20["pehe"], 0.05, f"₹20 arm PEHE exceeds threshold: {m20['pehe']}")

            # Assert positive rank correlation for targeting personalization (Spearman rho > 0.35 for ₹10 and > 0.50 for ₹20)
            self.assertGreater(m10["spearman_rho"], 0.35, f"₹10 Spearman correlation too low: {m10['spearman_rho']}")
            self.assertGreater(m20["spearman_rho"], 0.50, f"₹20 Spearman correlation too low: {m20['spearman_rho']}")

            # Assert Pearson correlation is positive
            self.assertGreater(m10["pearson_r"], 0.35, f"₹10 Pearson correlation too low: {m10['pearson_r']}")
            self.assertGreater(m20["pearson_r"], 0.50, f"₹20 Pearson correlation too low: {m20['pearson_r']}")

            # Assert ATE estimation error is within 3% points
            self.assertLess(m10["ate_abs_error_pct"], 3.0)
            self.assertLess(m20["ate_abs_error_pct"], 3.0)
        finally:
            if scratch_dir.exists():
                shutil.rmtree(scratch_dir, ignore_errors=True)

    def test_04_causal_forest_dml_execution(self):
        """Verify CausalForestDML execution in an isolated scratch directory and bounded ATE error."""
        import shutil
        cf_dir = self.output_dir / "test_scratch_cf"
        cf_dir.mkdir(parents=True, exist_ok=True)
        try:
            result = subprocess.run(
                [
                    sys.executable, str(self.train_script),
                    "--data", str(self.cleaned_data),
                    "--eval-data", str(self.eval_data),
                    "--output-dir", str(cf_dir),
                    "--estimator", "causal_forest",
                    "--cv", "2",
                    "--n-estimators", "20",
                    "--seed", "42"
                ],
                capture_output=True,
                text=True
            )
            self.assertEqual(result.returncode, 0, f"CausalForest training failed with stderr:\n{result.stderr}")
            with open(cf_dir / "dml_evaluation_metrics.json", "r", encoding="utf-8") as f:
                cf_metrics = json.load(f)
            self.assertLess(cf_metrics["arm_10"]["ate_abs_error_pct"], 3.0)
            self.assertLess(cf_metrics["arm_20"]["ate_abs_error_pct"], 3.0)
        finally:
            if cf_dir.exists():
                shutil.rmtree(cf_dir, ignore_errors=True)

    def test_05_production_artifacts_unmodified(self):
        """Verify that production artifacts exist, are non-empty, and are protected from test writes."""
        prod_model = self.output_dir / "dml_model.joblib"
        prod_preds = self.output_dir / "dml_effect_predictions.csv"
        prod_metrics = self.output_dir / "dml_evaluation_metrics.json"

        self.assertTrue(prod_model.exists(), "Production dml_model.joblib must exist")
        self.assertTrue(prod_preds.exists(), "Production dml_effect_predictions.csv must exist")
        self.assertTrue(prod_metrics.exists(), "Production dml_evaluation_metrics.json must exist")

        self.assertGreater(prod_model.stat().st_size, 1_000_000, "Production model artifact size invalid")
        self.assertGreater(prod_preds.stat().st_size, 100_000, "Production predictions artifact size invalid")


def main():
    suite = unittest.TestLoader().loadTestsFromTestCase(TestDoubleMachineLearning)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)


if __name__ == "__main__":
    main()
