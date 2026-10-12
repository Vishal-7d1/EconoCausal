"""
inspect_dataset.py
==================
Part of EconoCausal: Dynamic Pricing via Double Machine Learning
Module: 01_Dataset_Analysis

Description:
    Provides a comprehensive, non-destructive audit of raw CSV datasets.
    Inspects structural dimensions, column data types, missingness, duplicates,
    identifier candidates, numerical distributions, categorical cardinality,
    data quality flags, and heuristic candidate mappings for Causal ML
    variables (Pretreatment Covariates X, Treatment T, Outcome Y).

Usage:
    python 01_Dataset_Analysis/inspect_dataset.py --path "path/to/dataset.csv"
    python 01_Dataset_Analysis/inspect_dataset.py --help
"""

import argparse
from pathlib import Path
import sys
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd


import re

# -----------------------------------------------------------------------------
# Heuristic Keyword Sets for Causal ML Variable Candidate Detection
# Token-level matching prevents false substring matches (e.g., 'y' in 'empty_col')
# -----------------------------------------------------------------------------
TREATMENT_TOKENS = {
    "discount", "promo", "promotion", "coupon", "treatment", "voucher",
    "offer", "rebate", "incentive", "markdown", "t"
}
TREATMENT_PHRASES = {
    "price_cut", "discount_pct", "discount_amount", "discount_rate"
}

OUTCOME_TOKENS = {
    "purchase", "purchased", "bought", "conversion", "converted", "revenue",
    "sales", "spend", "spending", "profit", "margin", "transaction",
    "churn", "target", "outcome", "y"
}
OUTCOME_PHRASES = {
    "order_value", "basket_value", "gross_revenue", "net_margin"
}

IDENTIFIER_TOKENS = {
    "id", "uuid", "guid", "index", "idx", "key"
}
IDENTIFIER_PHRASES = {
    "customer_id", "user_id", "client_id", "cust_id", "account_id",
    "row_id", "transaction_id", "invoice_no", "invoice"
}


def matches_keyword_set(col_name: str, token_set: set, phrase_set: set) -> bool:
    """Check if column name matches keywords via token equality or phrase containment."""
    col_clean = col_name.strip().lower()
    tokens = set(re.split(r"[^a-z0-9]+", col_clean))
    if bool(tokens & token_set):
        return True
    return any(phrase in col_clean for phrase in phrase_set)


def parse_arguments() -> argparse.Namespace:
    """
    Parse command-line arguments for configurable dataset inspection.

    Returns:
        argparse.Namespace: Parsed command-line arguments.
    """
    parser = argparse.ArgumentParser(
        prog="inspect_dataset.py",
        description=(
            "EconoCausal Dataset Inspector: Perform a non-destructive audit of "
            "tabular CSV data for causal machine learning readiness."
        ),
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--path", "-p",
        type=str,
        default="01_Dataset_Analysis/data/raw_data.csv",
        help="Path to the CSV dataset file to inspect (relative or absolute).",
    )
    parser.add_argument(
        "--delimiter", "-d",
        type=str,
        default=",",
        help="Delimiter character used in the CSV file.",
    )
    parser.add_argument(
        "--encoding", "-e",
        type=str,
        default="utf-8",
        help="File encoding (e.g., utf-8, latin1, iso-8859-1).",
    )
    parser.add_argument(
        "--max-cardinality",
        type=int,
        default=10,
        help="Maximum distinct values to treat a column as low-cardinality categorical.",
    )
    parser.add_argument(
        "--preview-rows",
        type=int,
        default=5,
        help="Number of head preview rows to display.",
    )
    return parser.parse_args()


def print_banner(title: str, character: str = "=", width: int = 80) -> None:
    """Print a visually distinctive section banner."""
    print()
    print(character * width)
    print(f" {title.upper()} ".center(width, character))
    print(character * width)


def load_dataset(
    filepath_str: str,
    delimiter: str = ",",
    encoding: str = "utf-8"
) -> Tuple[Optional[pd.DataFrame], Optional[Path]]:
    """
    Safely locate and load a CSV dataset with robust error handling.

    Parameters:
        filepath_str: Configured path to the CSV file.
        delimiter: CSV delimiter character.
        encoding: File character encoding.

    Returns:
        Tuple containing:
            - Loaded pandas DataFrame (or None if load fails)
            - Resolved absolute Path object (or None if load fails)
    """
    resolved_path = Path(filepath_str).resolve()

    # Step 1: Verify file existence
    if not resolved_path.is_file():
        print_banner("DATASET FILE NOT FOUND", character="!")
        print(f"[!] Target Path Evaluated: {resolved_path}")
        print()
        print("  Explanation:")
        print("    The specified CSV dataset does not exist at this location.")
        print("    In adherence to EconoCausal data integrity guidelines, the inspection")
        print("    script does NOT generate fake or synthetic data automatically.")
        print()
        print("  How to Resolve:")
        print("    1. Specify your dataset explicitly using the '--path' argument:")
        print('       python 01_Dataset_Analysis/inspect_dataset.py --path "path/to/dataset.csv"')
        print()
        print("    2. Place your raw dataset in the default expected directory:")
        print("       01_Dataset_Analysis/data/raw_data.csv")
        print()
        print("  Compatible Benchmark Datasets for EconoCausal:")
        print("    - Criteo Uplift Prediction Dataset (Advertising / Uplift):")
        print("      https://ailab.criteo.com/criteo-uplift-prediction-dataset/")
        print("    - UCI Online Retail Dataset (Transactional Pricing & Baskets):")
        print("      https://archive.ics.uci.edu/dataset/352/online%2Bretail")
        print("=" * 80)
        return None, resolved_path

    # Step 2: Attempt loading with common error traps
    try:
        df = pd.read_csv(resolved_path, sep=delimiter, encoding=encoding)
        return df, resolved_path
    except pd.errors.EmptyDataError:
        print_banner("EMPTY DATASET ERROR", character="!")
        print(f"[!] The file at {resolved_path} is empty (0 bytes or no readable header/rows).")
        return None, resolved_path
    except pd.errors.ParserError as pe:
        print_banner("CSV PARSING ERROR", character="!")
        print(f"[!] Failed to parse CSV at {resolved_path}.")
        print(f"    Parser Details: {pe}")
        print("    Hint: Check whether delimiter matches the file (e.g., tab '\\t' or semicolon ';').")
        return None, resolved_path
    except UnicodeDecodeError:
        print_banner("ENCODING ERROR", character="!")
        print(f"[!] Unicode decode error using encoding '{encoding}'.")
        print("    Hint: Try running with '--encoding latin1' or '--encoding iso-8859-1'.")
        return None, resolved_path
    except PermissionError:
        print_banner("PERMISSION ERROR", character="!")
        print(f"[!] Permission denied when attempting to read {resolved_path}.")
        return None, resolved_path
    except Exception as exc:
        print_banner("UNEXPECTED ERROR DURING CSV LOAD", character="!")
        print(f"[!] An unexpected error occurred: {type(exc).__name__}: {exc}")
        return None, resolved_path


def inspect_metadata_and_dimensions(df: pd.DataFrame, file_path: Path) -> None:
    """Display file metadata, memory consumption, and dimensional shape."""
    print_banner("1. File Metadata & Dataset Dimensions")
    file_size_mb = file_path.stat().st_size / (1024 * 1024)
    total_memory_mb = df.memory_usage(deep=True).sum() / (1024 * 1024)
    duplicate_rows = int(df.duplicated().sum())
    duplicate_pct = (duplicate_rows / len(df)) * 100 if len(df) > 0 else 0.0

    print(f"  Filename:             {file_path.name}")
    print(f"  Absolute Path:        {file_path}")
    print(f"  Disk File Size:       {file_size_mb:.3f} MB ({file_path.stat().st_size:,} bytes)")
    print(f"  In-Memory Size:       {total_memory_mb:.3f} MB")
    print(f"  Total Rows (N):       {len(df):,}")
    print(f"  Total Columns (K):    {len(df.columns):,}")
    print(f"  Fully Duplicated Rows:{duplicate_rows:,} ({duplicate_pct:.2f}%)")


def inspect_head_preview(df: pd.DataFrame, preview_rows: int = 5) -> None:
    """Display clean preview of first N rows without screen flooding."""
    print_banner(f"2. Data Preview (First {preview_rows} Rows)")
    preview_df = df.head(preview_rows)
    # Configure pandas display temporarily to ensure readable terminal output
    with pd.option_context("display.max_columns", 15, "display.width", 120, "display.expand_frame_repr", False):
        print(preview_df)


def inspect_columns_and_missingness(df: pd.DataFrame) -> pd.DataFrame:
    """
    Analyze column types, non-null counts, missing value rates, and distinct cardinality.

    Returns:
        pd.DataFrame: Summary table of column-level statistics.
    """
    print_banner("3. Column Schema, Types & Missingness Audit")
    records = []
    total_rows = len(df)

    for col in df.columns:
        series = df[col]
        missing_count = int(series.isna().sum())
        missing_pct = (missing_count / total_rows * 100) if total_rows > 0 else 0.0
        unique_count = int(series.nunique(dropna=True))

        records.append({
            "Column": col,
            "Dtype": str(series.dtype),
            "Non-Null": total_rows - missing_count,
            "Missing": missing_count,
            "Missing %": f"{missing_pct:.2f}%",
            "Unique Values": unique_count,
        })

    col_audit_df = pd.DataFrame(records)
    with pd.option_context("display.max_rows", None, "display.width", 120, "display.max_colwidth", 30):
        print(col_audit_df.to_string(index=False))

    return col_audit_df


def inspect_low_cardinality_and_binary(df: pd.DataFrame, max_cardinality: int = 10) -> None:
    """Identify binary fields and low-cardinality discrete columns."""
    print_banner("4. Binary Fields & Low-Cardinality Categoricals")

    binary_cols = [c for c in df.columns if df[c].nunique(dropna=True) == 2]
    low_card_cols = [
        c for c in df.columns
        if 2 < df[c].nunique(dropna=True) <= max_cardinality
    ]

    print("--- [A] Binary Columns (Candidate Binary Treatments or Outcomes) ---")
    if not binary_cols:
        print("  None detected.")
    else:
        for col in binary_cols:
            vals = df[col].dropna().unique().tolist()
            val_counts = df[col].value_counts(dropna=False).to_dict()
            counts_str = ", ".join([f"{k}: {v:,}" for k, v in val_counts.items()])
            print(f"  * {col:<24} Distinct: {vals} | Frequencies: [{counts_str}]")

    print()
    print(f"--- [B] Low-Cardinality Categorical Columns (Distinct <= {max_cardinality}) ---")
    if not low_card_cols:
        print("  None detected.")
    else:
        for col in low_card_cols:
            val_counts = df[col].value_counts(dropna=False).head(5).to_dict()
            counts_str = ", ".join([f"'{k}': {v:,}" for k, v in val_counts.items()])
            total_distinct = df[col].nunique(dropna=True)
            print(f"  * {col:<24} ({total_distinct} unique) Top 5: [{counts_str}]")


def inspect_numerical_distributions(df: pd.DataFrame) -> None:
    """Compute and display summary statistics for continuous numerical columns."""
    print_banner("5. Numerical Features Descriptive Statistics")
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()

    if not num_cols:
        print("  No numerical columns identified.")
        return

    desc = df[num_cols].describe().T
    desc["missing"] = df[num_cols].isna().sum()
    columns_to_show = ["count", "missing", "mean", "std", "min", "25%", "50%", "75%", "max"]
    desc_clean = desc[columns_to_show].copy()

    with pd.option_context("display.max_columns", 10, "display.width", 120, "display.float_format", "{:,.3f}".format):
        print(desc_clean)


def detect_identifier_columns(df: pd.DataFrame) -> List[str]:
    """
    Detect likely primary keys or identifiers based on 100% uniqueness or naming keywords.

    Returns:
        List of candidate identifier column names.
    """
    print_banner("6. Potential Identifier & Entity Key Detection")
    detected = []
    total_rows = len(df)

    for col in df.columns:
        unique_cnt = df[col].nunique(dropna=True)
        is_fully_unique = (unique_cnt == total_rows) and (total_rows > 1)
        name_matches_id = matches_keyword_set(col, IDENTIFIER_TOKENS, IDENTIFIER_PHRASES)

        if is_fully_unique or name_matches_id:
            reason = []
            if is_fully_unique:
                reason.append("100% unique row values")
            if name_matches_id:
                reason.append("naming pattern matches identifier keywords")
            print(f"  [ID Candidate] {col:<24} Reason: {', '.join(reason)}")
            detected.append(col)

    if not detected:
        print("  No obvious identifier columns detected.")
    else:
        print()
        print("  [Notice] Primary identifiers should typically be excluded from causal feature matrices (X)")
        print("           to prevent spurious overfitting or artificial leakage.")

    return detected


def detect_causal_candidates(df: pd.DataFrame) -> Dict[str, List[str]]:
    """
    Heuristically examine column names and properties for potential Causal ML roles:
    Pretreatment Covariates (X), Treatment (T), and Outcome (Y).

    Returns:
        Dictionary mapping role names ('treatment_candidates', 'outcome_candidates') to column lists.
    """
    print_banner("7. Causal Machine Learning Candidate Analysis")

    t_candidates: List[str] = []
    y_candidates: List[str] = []

    for col in df.columns:
        # Check Treatment keywords
        if matches_keyword_set(col, TREATMENT_TOKENS, TREATMENT_PHRASES):
            t_candidates.append(col)

        # Check Outcome keywords
        if matches_keyword_set(col, OUTCOME_TOKENS, OUTCOME_PHRASES):
            y_candidates.append(col)

    print("  [!] CAUSAL IDENTIFICATION NOTICE:")
    print("      In Double Machine Learning (DML), variable roles cannot be chosen solely")
    print("      by correlation or heuristics. They must reflect business mechanics:")
    print("      - X (Confounders/Covariates): Pretreatment customer features.")
    print("      - T (Treatment): Discount intervention (e.g. discount % or promo receipt).")
    print("      - Y (Outcome): Consumer response (e.g. conversion, margin, basket value).")
    print()

    print("--- [T] Potential Treatment Candidates (Discount / Intervention) ---")
    if t_candidates:
        for c in t_candidates:
            print(f"  -> {c} (Dtype: {df[c].dtype}, Unique: {df[c].nunique()})")
    else:
        print("  No columns explicitly matching discount/treatment keywords.")

    print()
    print("--- [Y] Potential Outcome Candidates (Purchases / Revenue / Demand) ---")
    if y_candidates:
        for c in y_candidates:
            print(f"  -> {c} (Dtype: {df[c].dtype}, Unique: {df[c].nunique()})")
    else:
        print("  No columns explicitly matching purchase/revenue/outcome keywords.")

    return {
        "treatment_candidates": t_candidates,
        "outcome_candidates": y_candidates
    }


def audit_data_quality_flags(df: pd.DataFrame) -> List[str]:
    """
    Audit suspicious data quality issues without modifying the underlying data:
    - High missingness (> 50%)
    - Constant (zero variance) columns
    - Infinite values
    - Negative values in typically non-negative business metrics
    - Discount values outside plausible ranges (e.g., > 1.0 if fractions or > 100 if percentages)

    Returns:
        List of warning messages flagged during the audit.
    """
    print_banner("8. Non-Destructive Data Quality & Integrity Audit")
    warnings: List[str] = []
    total_rows = len(df)

    # 1. High missingness & completely empty columns
    for col in df.columns:
        missing_cnt = df[col].isna().sum()
        pct = (missing_cnt / total_rows * 100) if total_rows > 0 else 0
        if pct == 100:
            msg = f"Column '{col}' is 100% EMPTY (all values missing)."
            warnings.append(msg)
            print(f"  [FLAG: High Missingness] {msg}")
        elif pct >= 50.0:
            msg = f"Column '{col}' has {pct:.1f}% missing values ({missing_cnt:,}/{total_rows:,})."
            warnings.append(msg)
            print(f"  [FLAG: High Missingness] {msg}")

    # 2. Constant / Single-value columns
    for col in df.columns:
        unique_cnt = df[col].nunique(dropna=False)
        if unique_cnt <= 1:
            msg = f"Column '{col}' has ZERO variance (constant single value: {df[col].iloc[0] if len(df) > 0 else 'N/A'})."
            warnings.append(msg)
            print(f"  [FLAG: Zero Variance]   {msg}")

    # 3. Numerical anomalies (infinities, negative prices/discounts)
    num_cols = df.select_dtypes(include=[np.number]).columns
    for col in num_cols:
        series = df[col]

        # Check for infinities
        inf_count = int(np.isinf(series).sum())
        if inf_count > 0:
            msg = f"Column '{col}' contains {inf_count:,} infinite (+inf/-inf) values."
            warnings.append(msg)
            print(f"  [FLAG: Infinite Values] {msg}")

        # Check for negative values in business metrics
        col_lower = col.lower()
        is_typically_positive = any(
            kw in col_lower for kw in ["price", "cost", "revenue", "sales", "discount", "age", "visits", "margin", "qty", "quantity"]
        )
        if is_typically_positive:
            valid_series = series.dropna()
            negative_count = int((valid_series < 0).sum())
            if negative_count > 0:
                msg = f"Column '{col}' contains {negative_count:,} negative values (Min: {valid_series.min()})."
                warnings.append(msg)
                print(f"  [FLAG: Negative Values] {msg}")

        # Check discount bounds
        if "discount" in col_lower:
            valid_series = series.dropna()
            if len(valid_series) > 0:
                max_val = valid_series.max()
                min_val = valid_series.min()
                if min_val < 0:
                    msg = f"Discount column '{col}' has negative minimum: {min_val}."
                    warnings.append(msg)
                    print(f"  [FLAG: Discount Bound]  {msg}")
                if 1.0 < max_val <= 100.0:
                    print(f"  [NOTE: Discount Scale]  Column '{col}' max is {max_val:.2f}. Likely represented as a percentage [0-100%].")
                elif max_val <= 1.0:
                    print(f"  [NOTE: Discount Scale]  Column '{col}' max is {max_val:.2f}. Likely represented as a rate/fraction [0.0-1.0].")
                elif max_val > 100.0:
                    msg = f"Discount column '{col}' has maximum value exceeding 100 ({max_val}). Verify currency vs. percentage unit."
                    warnings.append(msg)
                    print(f"  [FLAG: Discount Bound]  {msg}")

    if not warnings:
        print("  [OK] No severe data quality anomalies flagged during initial audit.")

    return warnings


def print_executive_summary(
    df: pd.DataFrame,
    file_path: Path,
    warnings: List[str],
    id_cols: List[str],
    causal_candidates: Dict[str, List[str]]
) -> None:
    """Print a structured executive scorecard summarizing inspection findings."""
    print_banner("9. Executive Dataset Health & Readiness Scorecard")
    total_missing_cells = df.isna().sum().sum()
    total_cells = df.size
    overall_missing_pct = (total_missing_cells / total_cells * 100) if total_cells > 0 else 0.0

    print(f"  Dataset Name:             {file_path.name}")
    print(f"  Dimensions:               {len(df):,} Rows x {len(df.columns):,} Columns")
    print(f"  Overall Missing Rate:     {overall_missing_pct:.2f}% ({total_missing_cells:,} missing cells)")
    print(f"  Duplicate Rows:           {df.duplicated().sum():,}")
    print(f"  Detected Identifiers:     {len(id_cols)} column(s) ({', '.join(id_cols) if id_cols else 'None'})")
    print(f"  Treatment Candidates:     {len(causal_candidates['treatment_candidates'])} column(s)")
    print(f"  Outcome Candidates:       {len(causal_candidates['outcome_candidates'])} column(s)")
    print(f"  Data Quality Flags:       {len(warnings)} issue(s) identified")
    print()
    print("  Recommended Next Steps:")
    print("    1. Formulate Causal Identification: Confirm whether Treatment (T) is randomized (A/B test)")
    print("       or observational (coupons sent based on loyalty score / past spending).")
    print("    2. Data Cleaning (01_Dataset_Analysis/data_cleaning.py): Handle duplicates, imputation,")
    print("       and standardize discount scales [0.0 - 1.0].")
    print("    3. Exploratory Data Analysis (01_Dataset_Analysis/eda.py): Inspect confounding correlations")
    print("       between Pretreatment Covariates (X) and Treatment (T).")
    print("=" * 80)


def main() -> int:
    """Main execution entry point."""
    args = parse_arguments()

    print_banner("ECONOCAUSAL: DATASET INSPECTION & INTEGRITY AUDIT")
    print("  Double Machine Learning (DML) Dynamic Pricing System")
    print(f"  Target File: {args.path}")

    # Load dataset
    df, resolved_path = load_dataset(
        filepath_str=args.path,
        delimiter=args.delimiter,
        encoding=args.encoding
    )

    if df is None:
        # Exit gracefully with code 1 when dataset cannot be loaded
        return 1

    # Execute inspection steps
    inspect_metadata_and_dimensions(df, resolved_path)
    inspect_head_preview(df, preview_rows=args.preview_rows)
    inspect_columns_and_missingness(df)
    inspect_low_cardinality_and_binary(df, max_cardinality=args.max_cardinality)
    inspect_numerical_distributions(df)
    id_cols = detect_identifier_columns(df)
    causal_candidates = detect_causal_candidates(df)
    warnings = audit_data_quality_flags(df)
    print_executive_summary(df, resolved_path, warnings, id_cols, causal_candidates)

    return 0


if __name__ == "__main__":
    sys.exit(main())
