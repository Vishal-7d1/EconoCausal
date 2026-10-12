"""
data_cleaning.py
================
Part of EconoCausal: Dynamic Pricing via Double Machine Learning
Module: 01_Dataset_Analysis

Description:
    Cleans, standardizes, and prepares raw/synthetic pricing datasets for Causal ML modeling.
    Enforces rigorous data integrity, categorical encoding, non-negative bounds,
    and strict anti-leakage isolation between training features (X, T, Y) and
    evaluation-only ground-truth causal benchmarks ('true_*').

Key Transformations:
    1. Deduplication: Removes duplicate records and ensures unique entity IDs.
    2. Missingness Imputation: Robust median imputation for numericals, mode for categoricals.
    3. Anomaly & Boundary Enforcement: Validates non-negative prices, bounds, and dtypes.
    4. Feature Engineering for Causal ML:
       - Generates discount depth ratio (discount / cart_baseline_value).
       - One-hot encodes nominal categorical features (e.g. device_type).
       - Casts binary flags to standard integer format.
    5. Anti-Leakage Partitioning:
       - Exports cleaned model dataset with strictly observable columns (X, T, Y).
       - Separately preserves evaluation benchmark table containing ground-truth counterfactuals
         and CATE (tau_i) keyed by customer_id.

Usage:
    python 01_Dataset_Analysis/data_cleaning.py --input "01_Dataset_Analysis/synthetic_pricing_data.csv"
    python 01_Dataset_Analysis/data_cleaning.py --help
"""

import argparse
from pathlib import Path
import sys
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd


def parse_arguments() -> argparse.Namespace:
    """Parse command-line arguments for data cleaning pipeline."""
    parser = argparse.ArgumentParser(
        prog="data_cleaning.py",
        description="EconoCausal Data Cleaning & Anti-Leakage Partitioning Pipeline.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--input", "-i",
        type=str,
        default="01_Dataset_Analysis/synthetic_pricing_data.csv",
        help="Path to the input dataset CSV to clean.",
    )
    parser.add_argument(
        "--output-cleaned", "-o",
        type=str,
        default="01_Dataset_Analysis/cleaned_pricing_data.csv",
        help="Path where the cleaned model-ready dataset will be saved.",
    )
    parser.add_argument(
        "--output-eval", "-e",
        type=str,
        default="01_Dataset_Analysis/ground_truth_eval.csv",
        help="Path where evaluation-only ground-truth columns are isolated.",
    )
    return parser.parse_args()


def print_banner(title: str, character: str = "=", width: int = 80) -> None:
    """Print structured section banner."""
    print()
    print(character * width)
    print(f" {title.upper()} ".center(width, character))
    print(character * width)


def load_raw_dataset(input_path: Path) -> pd.DataFrame:
    """
    Safely load raw dataset with existence verification.

    Parameters:
        input_path: Path to CSV file.

    Returns:
        pd.DataFrame: Loaded DataFrame.
    """
    if not input_path.is_file():
        print_banner("INPUT FILE NOT FOUND", character="!")
        print(f"[!] Target file does not exist: {input_path}")
        print("    Run 'python 01_Dataset_Analysis/generate_synthetic_data.py' first")
        print("    or provide a valid file via '--input'.")
        sys.exit(1)

    df = pd.read_csv(input_path)
    return df


def clean_and_prepare_data(
    df_raw: pd.DataFrame
) -> Tuple[pd.DataFrame, pd.DataFrame, Dict[str, int]]:
    """
    Execute full data cleaning, validation, and anti-leakage partitioning.

    Parameters:
        df_raw: Raw loaded DataFrame.

    Returns:
        Tuple containing:
            - df_cleaned: Model-ready DataFrame containing observable X, T, Y.
            - df_eval: Evaluation-only DataFrame with customer_id and true_* columns.
            - audit_counts: Dictionary of audit counts (duplicates, missing, etc.).
    """
    audit_counts = {}
    df = df_raw.copy()

    # -------------------------------------------------------------------------
    # 1. Deduplication
    # -------------------------------------------------------------------------
    initial_rows = len(df)
    df = df.drop_duplicates()
    duplicates_removed = initial_rows - len(df)
    audit_counts["Duplicates Removed"] = duplicates_removed

    # Check customer_id uniqueness if column exists
    if "customer_id" in df.columns:
        id_dupes = df["customer_id"].duplicated().sum()
        if id_dupes > 0:
            df = df.drop_duplicates(subset=["customer_id"], keep="first")
            audit_counts["Duplicate Customer IDs Dropped"] = int(id_dupes)
        else:
            audit_counts["Duplicate Customer IDs Dropped"] = 0

    # -------------------------------------------------------------------------
    # 2. Separate Ground-Truth Evaluation Columns (Strict Anti-Leakage)
    # -------------------------------------------------------------------------
    eval_cols = [c for c in df.columns if c.startswith("true_")]
    has_ground_truth = len(eval_cols) > 0

    if has_ground_truth:
        eval_id_cols = ["customer_id"] if "customer_id" in df.columns else []
        df_eval = df[eval_id_cols + eval_cols].copy()
        # Drop ground-truth columns completely from model training data
        df = df.drop(columns=eval_cols)
        audit_counts["Isolated Ground-Truth Columns"] = len(eval_cols)
    else:
        df_eval = pd.DataFrame()
        audit_counts["Isolated Ground-Truth Columns"] = 0

    # -------------------------------------------------------------------------
    # 3. Missing Value Imputation
    # -------------------------------------------------------------------------
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
    if "customer_id" in cat_cols:
        cat_cols.remove("customer_id")

    missing_imputed = 0
    for col in num_cols:
        col_missing = int(df[col].isna().sum())
        if col_missing > 0:
            median_val = df[col].median()
            df[col] = df[col].fillna(median_val)
            missing_imputed += col_missing

    for col in cat_cols:
        col_missing = int(df[col].isna().sum())
        if col_missing > 0:
            mode_val = df[col].mode().iloc[0] if not df[col].mode().empty else "Unknown"
            df[col] = df[col].fillna(mode_val)
            missing_imputed += col_missing

    audit_counts["Missing Values Imputed"] = missing_imputed

    # -------------------------------------------------------------------------
    # 4. Anomaly Correction & Non-Negative Clamping
    # -------------------------------------------------------------------------
    anomalies_fixed = 0
    non_negative_keywords = ["income", "visits", "purchases", "cart", "revenue", "price", "discount", "age"]
    for col in num_cols:
        col_lower = col.lower()
        if any(kw in col_lower for kw in non_negative_keywords):
            neg_mask = df[col] < 0
            neg_cnt = int(neg_mask.sum())
            if neg_cnt > 0:
                df.loc[neg_mask, col] = 0.0
                anomalies_fixed += neg_cnt

    audit_counts["Negative Anomalies Clamped"] = anomalies_fixed

    # -------------------------------------------------------------------------
    # 5. Causal Feature Engineering & Standardization
    # -------------------------------------------------------------------------
    # Standardize treatment binary flag
    if "discount_inr" in df.columns and "treatment_binary" not in df.columns:
        df["treatment_binary"] = (df["discount_inr"] > 0).astype(int)

    # Calculate discount depth ratio (fraction of baseline cart value)
    if "discount_inr" in df.columns and "cart_baseline_value_inr" in df.columns:
        # Avoid division by zero
        cart_safe = np.maximum(df["cart_baseline_value_inr"], 1.0)
        df["discount_depth_ratio"] = (df["discount_inr"] / cart_safe).clip(0.0, 1.0).round(4)

    # One-Hot Encode nominal variables (e.g. device_type)
    if "device_type" in df.columns:
        device_dummies = pd.get_dummies(df["device_type"], prefix="device", drop_first=True, dtype=int)
        df = pd.concat([df, device_dummies], axis=1)

    return df, df_eval, audit_counts


def print_cleaning_report(
    df_raw: pd.DataFrame,
    df_cleaned: pd.DataFrame,
    df_eval: pd.DataFrame,
    audit_counts: Dict[str, int],
    cleaned_path: Path,
    eval_path: Path
) -> None:
    """Print structured summary of cleaning audit and outputs."""
    print_banner("DATA CLEANING & INTEGRITY AUDIT REPORT")
    print(f"  Input Dataset Dimensions:     {len(df_raw):,} Rows x {len(df_raw.columns):,} Columns")
    print(f"  Cleaned Model Dimensions:     {len(df_cleaned):,} Rows x {len(df_cleaned.columns):,} Columns")
    print(f"  Evaluation Table Dimensions:  {len(df_eval):,} Rows x {len(df_eval.columns):,} Columns")
    print()

    print("--- Integrity Actions Taken ---")
    for action, count in audit_counts.items():
        print(f"  * {action:<34}: {count:,}")

    print()
    print("--- Observable Columns for Double ML Training ---")
    covariates_x = [
        c for c in df_cleaned.columns
        if c not in ["customer_id", "discount_inr", "treatment_binary", "discount_depth_ratio", "observed_purchase", "observed_revenue_inr"]
    ]
    treatment_t = [c for c in df_cleaned.columns if c in ["discount_inr", "treatment_binary", "discount_depth_ratio"]]
    outcome_y = [c for c in df_cleaned.columns if c in ["observed_purchase", "observed_revenue_inr"]]

    print(f"  * Pretreatment Covariates X ({len(covariates_x)}): {', '.join(covariates_x)}")
    print(f"  * Treatment Variables T ({len(treatment_t)}):       {', '.join(treatment_t)}")
    print(f"  * Observed Outcomes Y ({len(outcome_y)}):         {', '.join(outcome_y)}")

    if not df_eval.empty:
        print()
        print("--- Ground-Truth Evaluation Isolation (Strict Anti-Leakage) ---")
        eval_cols = [c for c in df_eval.columns if c != "customer_id"]
        print(f"  * Preserved Evaluation Benchmarks ({len(eval_cols)}):")
        for ec in eval_cols:
            print(f"    - {ec}")
        print(f"  * Saved Separately to: {eval_path.name}")

    print()
    print(f"  [OK] Cleaned training data written to: {cleaned_path}")
    if not df_eval.empty:
        print(f"  [OK] Ground-truth evaluation benchmarks written to: {eval_path}")
    print("=" * 80)


def main() -> int:
    """Main execution function."""
    args = parse_arguments()

    print_banner("ECONOCAUSAL: DATA CLEANING PIPELINE")
    input_path = Path(args.input).resolve()
    cleaned_path = Path(args.output_cleaned).resolve()
    eval_path = Path(args.output_eval).resolve()

    cleaned_path.parent.mkdir(parents=True, exist_ok=True)
    eval_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"  Input Dataset:    {input_path}")
    print(f"  Cleaned Output:   {cleaned_path}")
    print(f"  Eval Benchmark:   {eval_path}")

    # Load raw
    df_raw = load_raw_dataset(input_path)

    # Clean and partition
    df_cleaned, df_eval, audit_counts = clean_and_prepare_data(df_raw)

    # Export cleaned dataset
    df_cleaned.to_csv(cleaned_path, index=False)

    # Export evaluation dataset if present
    if not df_eval.empty:
        df_eval.to_csv(eval_path, index=False)

    # Print summary report
    print_cleaning_report(df_raw, df_cleaned, df_eval, audit_counts, cleaned_path, eval_path)

    return 0


if __name__ == "__main__":
    sys.exit(main())
