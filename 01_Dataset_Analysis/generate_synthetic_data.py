"""
generate_synthetic_data.py
==========================
Part of EconoCausal: Dynamic Pricing via Double Machine Learning
Module: 01_Dataset_Analysis

Description:
    Generates a reproducible, domain-faithful synthetic e-commerce pricing dataset
    with realistic customer characteristics, controlled confounding bias,
    discrete promotional discount treatments (₹0 control, ₹10 discount, ₹20 discount),
    binary purchase outcomes, and known ground-truth Individual Treatment Effects (ITE / tau_i).

Key Causal Mechanics:
    - Pretreatment Covariates (X): Customer demographics, browsing patterns, and historical spend.
    - Confounder-Driven Treatment Assignment (T): Propensity to receive discounts depends on
      covariates (e.g. cart value, dormant recency, loyalty status), creating realistic selection bias.
    - Heterogeneous Treatment Effects (tau_i): Price sensitivity varies with customer income,
      loyalty status, and browsing engagement.
    - Potential Outcomes Framework: Generates Y(0), Y(10), Y(20) for evaluation, while
      strictly exposing a single observed outcome Y = Y(T) under causal consistency.
    - Anti-Leakage Design: Ground-truth counterfactuals and true treatment effects are isolated
      under explicit 'true_*' column prefixes for evaluation and benchmarking only.

Usage:
    python 01_Dataset_Analysis/generate_synthetic_data.py --samples 10000 --seed 42
    python 01_Dataset_Analysis/generate_synthetic_data.py --help
"""

import argparse
from pathlib import Path
import sys
from typing import Dict, Tuple

import numpy as np
import pandas as pd


def parse_arguments() -> argparse.Namespace:
    """Parse CLI arguments for synthetic dataset generation."""
    parser = argparse.ArgumentParser(
        prog="generate_synthetic_data.py",
        description="Generate reproducible synthetic pricing data with known causal ground-truth.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--samples", "-n",
        type=int,
        default=10000,
        help="Number of synthetic customer observations to generate.",
    )
    parser.add_argument(
        "--seed", "-s",
        type=int,
        default=42,
        help="Random seed for full reproducibility.",
    )
    parser.add_argument(
        "--output", "-o",
        type=str,
        default="01_Dataset_Analysis/synthetic_pricing_data.csv",
        help="Target output CSV filepath.",
    )
    return parser.parse_args()


def print_banner(title: str, character: str = "=", width: int = 80) -> None:
    """Utility to print structured section banners."""
    print()
    print(character * width)
    print(f" {title.upper()} ".center(width, character))
    print(character * width)


def sigmoid(z: np.ndarray) -> np.ndarray:
    """Numerically stable logistic sigmoid function."""
    return 1.0 / (1.0 + np.exp(-np.clip(z, -35.0, 35.0)))


def generate_synthetic_dataset(n_samples: int = 10000, seed: int = 42) -> pd.DataFrame:
    """
    Generate synthetic e-commerce customer dataset with controlled confounding and ground-truth CATE.

    Parameters:
        n_samples: Number of observations.
        seed: Random number generator seed.

    Returns:
        pd.DataFrame: Tabular dataset with covariates (X), treatment (T), observed outcome (Y),
                      and evaluation-only ground-truth columns ('true_*').
    """
    rng = np.random.default_rng(seed)

    # -------------------------------------------------------------------------
    # 1. Pretreatment Customer Characteristics (Covariates X)
    # -------------------------------------------------------------------------
    customer_ids = [f"CUST_{i+1:06d}" for i in range(n_samples)]

    # Demographics & engagement
    age = rng.normal(loc=36.0, scale=11.0, size=n_samples)
    age = np.clip(age, 18.0, 72.0).round().astype(int)

    # Monthly income in INR (log-normal, median ~Rs 48,000, range Rs 15k - 250k)
    log_income = rng.normal(loc=10.78, scale=0.45, size=n_samples)
    monthly_income_inr = np.clip(np.exp(log_income), 15000.0, 300000.0).round(2)

    # Web browsing engagement in last 30 days
    web_visits_last_30d = rng.poisson(lam=6.5, size=n_samples)
    web_visits_last_30d = np.clip(web_visits_last_30d, 0, 45).astype(int)

    # Historical purchasing activity
    past_purchases_count = rng.negative_binomial(n=2, p=0.35, size=n_samples)
    past_purchases_count = np.clip(past_purchases_count, 0, 30).astype(int)

    # Recency in days (days since last purchase or interaction)
    days_since_last_purchase = rng.exponential(scale=45.0, size=n_samples)
    days_since_last_purchase = np.clip(days_since_last_purchase, 1.0, 365.0).round().astype(int)

    # Baseline order/cart value without discount (Rs 400 - Rs 5,000)
    log_cart = rng.normal(loc=6.9, scale=0.5, size=n_samples)
    cart_baseline_value_inr = np.clip(np.exp(log_cart), 400.0, 5000.0).round(2)

    # Device type (60% Mobile, 30% Desktop, 10% Tablet)
    device_choices = np.array(["Mobile", "Desktop", "Tablet"])
    device_probs = [0.60, 0.30, 0.10]
    device_type = rng.choice(device_choices, size=n_samples, p=device_probs)

    # Loyalty membership flag (probability increases with tenure & income)
    loyalty_logit = (
        -1.8
        + 0.12 * past_purchases_count
        + 0.05 * (web_visits_last_30d - 6.0)
        + 0.000015 * (monthly_income_inr - 45000.0)
    )
    loyalty_prob = sigmoid(loyalty_logit)
    loyalty_member = rng.binomial(n=1, p=loyalty_prob, size=n_samples).astype(int)

    # -------------------------------------------------------------------------
    # 2. Controlled Confounding & Treatment Assignment (T)
    #    Promotional discounts are biased:
    #    - Dormant shoppers with high cart values receive discounts to reduce abandonment.
    #    - Loyalty members receive preferential coupons.
    #    - Lower income shoppers receive targeted price promotions.
    # -------------------------------------------------------------------------
    std_income = (monthly_income_inr - np.mean(monthly_income_inr)) / np.std(monthly_income_inr)
    std_visits = (web_visits_last_30d - np.mean(web_visits_last_30d)) / np.std(web_visits_last_30d)
    std_cart = (cart_baseline_value_inr - np.mean(cart_baseline_value_inr)) / np.std(cart_baseline_value_inr)
    std_recency = (days_since_last_purchase - np.mean(days_since_last_purchase)) / np.std(days_since_last_purchase)

    # Propensity logits for receiving discounts
    # Positive scores favor discount allocation
    promo_score = (
        -0.35
        - 0.45 * std_income            # Lower income targeted more
        + 0.35 * std_recency           # Inactive / dormant customers targeted to re-engage
        + 0.30 * std_visits            # Active visitors who haven't bought
        - 0.20 * std_cart              # Extremely high carts discount slightly less
        + 0.40 * loyalty_member        # Loyalty members receive discount perks
    )

    # Split into 3 discrete treatment arms:
    # T = 0: No discount (Control, Rs 0)
    # T = 10: Rs 10 discount
    # T = 20: Rs 20 discount
    prob_any_promo = sigmoid(promo_score)
    assigned_promo_flag = rng.binomial(n=1, p=prob_any_promo)

    # Conditional on receiving a promo, assign Rs 10 vs Rs 20 based on cart size and income
    deep_discount_logit = -0.1 + 0.3 * std_cart - 0.25 * std_income
    prob_deep_given_promo = sigmoid(deep_discount_logit)
    deep_flag = rng.binomial(n=1, p=prob_deep_given_promo)

    discount_inr = np.zeros(n_samples, dtype=int)
    discount_inr[(assigned_promo_flag == 1) & (deep_flag == 0)] = 10
    discount_inr[(assigned_promo_flag == 1) & (deep_flag == 1)] = 20

    # Binary treatment indicator (1 if discount received, 0 if control)
    treatment_binary = (discount_inr > 0).astype(int)

    # -------------------------------------------------------------------------
    # 3. Ground-Truth Individual Treatment Effects & Potential Outcomes (Y)
    # -------------------------------------------------------------------------
    # Baseline purchase probability under Control (T = 0)
    baseline_logit = (
        -1.10
        + 0.15 * past_purchases_count
        + 0.10 * std_visits
        + 0.25 * loyalty_member
        - 0.35 * std_recency
        - 0.15 * std_cart
        + 0.10 * (1 if device_type.any() else 0)
    )
    p_y0 = sigmoid(baseline_logit)

    # Individual Treatment Effect (CATE) heterogeneity:
    # - Lower income customers exhibit higher price elasticity (higher uplift).
    # - Customers who are not yet loyal respond more strongly to discounts.
    # - Active website visitors have higher conversion responsiveness.
    # Base uplift for Rs 10 discount: ~8% to 16% percentage points
    tau_10_raw = (
        0.09
        + 0.04 * np.clip(35000.0 / monthly_income_inr, 0.2, 1.8)
        + 0.03 * (1 - loyalty_member)
        + 0.02 * np.clip(std_visits, -1.0, 2.0)
    )
    # Enforce realistic bounds so p_y10 <= 0.98 and tau >= 0.01
    tau_10 = np.clip(tau_10_raw, 0.02, 0.25)
    p_y10 = np.clip(p_y0 + tau_10, 0.01, 0.98)
    actual_tau_10 = p_y10 - p_y0

    # Additional incremental uplift for Rs 20 discount: diminishing returns
    tau_20_incremental = (
        0.05
        + 0.025 * np.clip(35000.0 / monthly_income_inr, 0.2, 1.8)
        + 0.02 * (1 - loyalty_member)
    )
    tau_20_incremental = np.clip(tau_20_incremental, 0.01, 0.15)
    p_y20 = np.clip(p_y10 + tau_20_incremental, 0.01, 0.99)
    actual_tau_20 = p_y20 - p_y0

    # Potential outcomes under each treatment condition (Neyman-Rubin model)
    # Generated jointly with correlated uniform thresholds for counterfactual realism
    u_purchase = rng.uniform(0.0, 1.0, size=n_samples)
    y0_potential = (u_purchase < p_y0).astype(int)
    y10_potential = (u_purchase < p_y10).astype(int)
    y20_potential = (u_purchase < p_y20).astype(int)

    # -------------------------------------------------------------------------
    # 4. Consistency & Realized Single Observed Outcome
    #    Real platforms observe only Y = Y(T), never the counterfactuals.
    # -------------------------------------------------------------------------
    observed_purchase = np.zeros(n_samples, dtype=int)
    observed_purchase[discount_inr == 0] = y0_potential[discount_inr == 0]
    observed_purchase[discount_inr == 10] = y10_potential[discount_inr == 10]
    observed_purchase[discount_inr == 20] = y20_potential[discount_inr == 20]

    # Realized order revenue (Rs): Cart baseline minus discount, if purchased
    revenue_noise = rng.normal(loc=0.0, scale=35.0, size=n_samples)
    net_order_value = np.maximum(0.0, cart_baseline_value_inr - discount_inr + revenue_noise).round(2)
    observed_revenue_inr = np.where(observed_purchase == 1, net_order_value, 0.0)

    # Individual treatment effect for the assigned treatment condition
    assigned_tau = np.zeros(n_samples, dtype=float)
    assigned_tau[discount_inr == 10] = actual_tau_10[discount_inr == 10]
    assigned_tau[discount_inr == 20] = actual_tau_20[discount_inr == 20]

    # -------------------------------------------------------------------------
    # 5. DataFrame Assembly with Strict Anti-Leakage Separation
    # -------------------------------------------------------------------------
    df = pd.DataFrame({
        # Pretreatment Covariates (X)
        "customer_id": customer_ids,
        "age": age,
        "monthly_income_inr": monthly_income_inr,
        "web_visits_last_30d": web_visits_last_30d,
        "past_purchases_count": past_purchases_count,
        "days_since_last_purchase": days_since_last_purchase,
        "cart_baseline_value_inr": cart_baseline_value_inr,
        "loyalty_member": loyalty_member,
        "device_type": device_type,

        # Treatment Assignment (T)
        "discount_inr": discount_inr,
        "treatment_binary": treatment_binary,

        # Single Realized Observed Outcome (Y)
        "observed_purchase": observed_purchase,
        "observed_revenue_inr": observed_revenue_inr,

        # ---------------------------------------------------------------------
        # Ground-Truth Evaluation Columns (Anti-Leakage: DO NOT TRAIN ON THESE)
        # ---------------------------------------------------------------------
        "true_prob_purchase_control_y0": p_y0.round(5),
        "true_prob_purchase_discount_y10": p_y10.round(5),
        "true_prob_purchase_discount_y20": p_y20.round(5),
        "true_tau_prob_y10": actual_tau_10.round(5),
        "true_tau_prob_y20": actual_tau_20.round(5),
        "true_assigned_tau": assigned_tau.round(5),
        "true_potential_outcome_y0": y0_potential,
        "true_potential_outcome_y10": y10_potential,
        "true_potential_outcome_y20": y20_potential,
    })

    return df


def validate_synthetic_dataset(df: pd.DataFrame) -> Tuple[bool, Dict[str, str]]:
    """
    Perform rigorous validation checks on generated synthetic dataset.

    Returns:
        Tuple of (bool passed, Dict of validation metrics)
    """
    metrics = {}
    passed = True

    # 1. Null and Infinity Checks
    null_count = int(df.isna().sum().sum())
    metrics["Missing Values"] = f"{null_count} (Passed)" if null_count == 0 else f"{null_count} (Failed)"
    if null_count > 0:
        passed = False

    # 2. Treatment Consistency Check: Y == Y(T)
    t0_match = (df[df["discount_inr"] == 0]["observed_purchase"] == df[df["discount_inr"] == 0]["true_potential_outcome_y0"]).all()
    t10_match = (df[df["discount_inr"] == 10]["observed_purchase"] == df[df["discount_inr"] == 10]["true_potential_outcome_y10"]).all()
    t20_match = (df[df["discount_inr"] == 20]["observed_purchase"] == df[df["discount_inr"] == 20]["true_potential_outcome_y20"]).all()
    consistency_passed = bool(t0_match and t10_match and t20_match)
    metrics["Potential Outcome Consistency"] = "100% Consistent" if consistency_passed else "Violated"
    if not consistency_passed:
        passed = False

    # 3. Probability & Treatment Effect Bounds Check
    p_bounds = (
        (df["true_prob_purchase_control_y0"] >= 0.0) & (df["true_prob_purchase_control_y0"] <= 1.0) &
        (df["true_prob_purchase_discount_y10"] >= 0.0) & (df["true_prob_purchase_discount_y10"] <= 1.0) &
        (df["true_prob_purchase_discount_y20"] >= 0.0) & (df["true_prob_purchase_discount_y20"] <= 1.0)
    ).all()
    metrics["Probability Bounds [0, 1]"] = "Passed" if p_bounds else "Failed"
    if not p_bounds:
        passed = False

    # 4. Monotonic Treatment Effect Check (tau_20 >= tau_10)
    monotonic_tau = (df["true_tau_prob_y20"] >= df["true_tau_prob_y10"]).all()
    metrics["Monotonicity (tau_20 >= tau_10)"] = "Passed" if monotonic_tau else "Failed"
    if not monotonic_tau:
        passed = False

    # 5. Non-Negative Revenue Check
    revenue_non_negative = (df["observed_revenue_inr"] >= 0.0).all()
    metrics["Non-Negative Revenue"] = "Passed" if revenue_non_negative else "Failed"
    if not revenue_non_negative:
        passed = False

    return passed, metrics


def print_generation_summary(df: pd.DataFrame, output_path: Path, metrics: Dict[str, str]) -> None:
    """Print clean summary of generated synthetic data and causal metrics."""
    print_banner("SYNTHETIC PRICING DATASET SUMMARY")
    n = len(df)
    print(f"  Target File:               {output_path.resolve()}")
    print(f"  Total Observations (N):    {n:,}")
    print(f"  Feature Columns (Total):   {len(df.columns)}")

    print()
    print("--- Treatment Allocation Breakdown (T) ---")
    t_counts = df["discount_inr"].value_counts().sort_index()
    for t_val, cnt in t_counts.items():
        pct = (cnt / n) * 100
        label = "Control (Rs 0)" if t_val == 0 else f"Rs {t_val} Discount"
        print(f"  * {label:<22}: {cnt:,} ({pct:.2f}%)")

    print()
    print("--- Observed Purchase Conversion Rates (Y) ---")
    for t_val in sorted(df["discount_inr"].unique()):
        conv_rate = df[df["discount_inr"] == t_val]["observed_purchase"].mean() * 100
        mean_rev = df[df["discount_inr"] == t_val]["observed_revenue_inr"].mean()
        label = "Control (Rs 0)" if t_val == 0 else f"Rs {t_val} Discount"
        print(f"  * {label:<22}: Conv Rate = {conv_rate:.2f}% | Mean Realized Revenue = Rs {mean_rev:,.2f}")

    print()
    print("--- True Ground-Truth Causal Treatment Effects (ATE) ---")
    ate_10 = df["true_tau_prob_y10"].mean() * 100
    ate_20 = df["true_tau_prob_y20"].mean() * 100
    print(f"  * True ATE (Rs 10 Discount): +{ate_10:.2f}% percentage points conversion uplift")
    print(f"  * True ATE (Rs 20 Discount): +{ate_20:.2f}% percentage points conversion uplift")

    print()
    print("--- Anti-Leakage Separation Reminder ---")
    eval_cols = [c for c in df.columns if c.startswith("true_")]
    train_cols = [c for c in df.columns if not c.startswith("true_")]
    print(f"  * Observable Columns ({len(train_cols)}):   {', '.join(train_cols)}")
    print(f"  * Evaluation-Only Columns ({len(eval_cols)}): {', '.join(eval_cols)}")

    print()
    print("--- Validation Audit Checks ---")
    for k, v in metrics.items():
        print(f"  * {k:<36}: {v}")
    print("=" * 80)


def main() -> int:
    """Main execution function."""
    args = parse_arguments()

    print_banner("ECONOCAUSAL: SYNTHETIC DATA GENERATOR")
    print(f"  Generating {args.samples:,} synthetic e-commerce customer profiles...")
    print(f"  Random Seed: {args.seed}")

    output_path = Path(args.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Generate synthetic dataset
    df = generate_synthetic_dataset(n_samples=args.samples, seed=args.seed)

    # Validate dataset
    passed, metrics = validate_synthetic_dataset(df)
    if not passed:
        print_banner("VALIDATION FAILURE", character="!")
        print("  Synthetic data failed consistency or bounds checks.")
        return 1

    # Save to CSV
    df.to_csv(output_path, index=False)
    print(f"  Successfully exported dataset to: {output_path}")

    # Summary
    print_generation_summary(df, output_path, metrics)
    return 0


if __name__ == "__main__":
    sys.exit(main())
