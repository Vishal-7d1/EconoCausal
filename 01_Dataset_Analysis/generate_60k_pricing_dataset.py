"""
generate_60k_pricing_dataset.py
================================
Generates a 60,000-row domain-faithful e-commerce customer pricing dataset
strictly matching the EconoCausal causal inference schema.

Pretreatment features:
  - customer_id (CUST_000001 ... CUST_060000)
  - age (18 to 72)
  - monthly_income_inr (continuous INR, 15,000 to 250,000)
  - web_visits_last_30d (0 to 45)
  - past_purchases_count (0 to 30)
  - days_since_last_purchase (1 to 365)
  - cart_baseline_value_inr (continuous INR, 400.0 to 5,000.0)
  - loyalty_member (0 or 1)
  - device_type (Mobile, Desktop, Tablet)
  - discount_inr (0, 10, 20)
  - observed_purchase (0 or 1)
  - observed_revenue_inr

Anti-leakage: Excludes true_* columns so it can be uploaded directly as raw observational customer pricing data.
"""

import os
import shutil
from pathlib import Path
import numpy as np
import pandas as pd


def sigmoid(z: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-np.clip(z, -35.0, 35.0)))


def generate_60k_dataset(n_samples: int = 60000, seed: int = 2026) -> pd.DataFrame:
    print(f"Generating {n_samples:,} synthetic customer records...")
    rng = np.random.default_rng(seed)

    # 1. Customer IDs
    customer_ids = [f"CUST_{i+1:06d}" for i in range(n_samples)]

    # 2. Demographics & behavioral engagement
    age = np.clip(rng.normal(loc=36.0, scale=11.0, size=n_samples), 18.0, 72.0).round().astype(int)

    log_income = rng.normal(loc=10.78, scale=0.45, size=n_samples)
    monthly_income_inr = np.clip(np.exp(log_income), 15000.0, 280000.0).round(2)

    web_visits_last_30d = np.clip(rng.poisson(lam=6.5, size=n_samples), 0, 45).astype(int)
    past_purchases_count = np.clip(rng.negative_binomial(n=2, p=0.35, size=n_samples), 0, 30).astype(int)
    days_since_last_purchase = np.clip(rng.exponential(scale=45.0, size=n_samples), 1.0, 365.0).round().astype(int)

    log_cart = rng.normal(loc=6.9, scale=0.5, size=n_samples)
    cart_baseline_value_inr = np.clip(np.exp(log_cart), 400.0, 5000.0).round(2)

    device_choices = np.array(["Mobile", "Desktop", "Tablet"])
    device_type = rng.choice(device_choices, size=n_samples, p=[0.60, 0.30, 0.10])

    loyalty_logit = (
        -1.8
        + 0.12 * past_purchases_count
        + 0.05 * (web_visits_last_30d - 6.0)
        + 0.000015 * (monthly_income_inr - 45000.0)
    )
    loyalty_member = rng.binomial(n=1, p=sigmoid(loyalty_logit), size=n_samples).astype(int)

    # 3. Observational Treatments (historical discount policy)
    std_income = (monthly_income_inr - np.mean(monthly_income_inr)) / np.std(monthly_income_inr)
    std_recency = (days_since_last_purchase - np.mean(days_since_last_purchase)) / np.std(days_since_last_purchase)
    std_visits = (web_visits_last_30d - np.mean(web_visits_last_30d)) / np.std(web_visits_last_30d)
    std_cart = (cart_baseline_value_inr - np.mean(cart_baseline_value_inr)) / np.std(cart_baseline_value_inr)

    promo_score = (
        -0.35
        - 0.45 * std_income
        + 0.35 * std_recency
        + 0.30 * std_visits
        - 0.20 * std_cart
        + 0.40 * loyalty_member
    )
    prob_any_promo = sigmoid(promo_score)
    assigned_promo_flag = rng.binomial(n=1, p=prob_any_promo)

    deep_discount_logit = -0.1 + 0.3 * std_cart - 0.25 * std_income
    prob_deep_given_promo = sigmoid(deep_discount_logit)
    deep_flag = rng.binomial(n=1, p=prob_deep_given_promo)

    discount_inr = np.zeros(n_samples, dtype=int)
    discount_inr[(assigned_promo_flag == 1) & (deep_flag == 0)] = 10
    discount_inr[(assigned_promo_flag == 1) & (deep_flag == 1)] = 20

    # 4. Observational Outcomes
    baseline_logit = (
        -1.4
        + 0.35 * std_visits
        + 0.25 * past_purchases_count
        - 0.40 * (days_since_last_purchase / 60.0)
        + 0.30 * loyalty_member
    )
    p_baseline = sigmoid(baseline_logit)

    uplift_10 = 0.08 + 0.06 * (1.0 - sigmoid(std_income)) + 0.04 * loyalty_member
    uplift_20 = 0.15 + 0.10 * (1.0 - sigmoid(std_income)) + 0.07 * loyalty_member

    p_observed = p_baseline.copy()
    p_observed[discount_inr == 10] = np.clip(p_baseline[discount_inr == 10] + uplift_10[discount_inr == 10], 0.0, 0.95)
    p_observed[discount_inr == 20] = np.clip(p_baseline[discount_inr == 20] + uplift_20[discount_inr == 20], 0.0, 0.95)

    observed_purchase = rng.binomial(n=1, p=p_observed, size=n_samples).astype(int)
    order_val = np.maximum(cart_baseline_value_inr - discount_inr, 0.0)
    observed_revenue_inr = np.where(observed_purchase == 1, order_val, 0.0).round(2)

    df = pd.DataFrame({
        "customer_id": customer_ids,
        "age": age,
        "monthly_income_inr": monthly_income_inr,
        "web_visits_last_30d": web_visits_last_30d,
        "past_purchases_count": past_purchases_count,
        "days_since_last_purchase": days_since_last_purchase,
        "cart_baseline_value_inr": cart_baseline_value_inr,
        "loyalty_member": loyalty_member,
        "device_type": device_type,
        "discount_inr": discount_inr,
        "observed_purchase": observed_purchase,
        "observed_revenue_inr": observed_revenue_inr,
    })
    return df


if __name__ == "__main__":
    df_60k = generate_60k_dataset(60000, seed=2026)
    
    # Save target 1: inside repository 01_Dataset_Analysis
    repo_target = Path("01_Dataset_Analysis/EconoCausal_Pricing_60000.csv")
    df_60k.to_csv(repo_target, index=False)
    file_size_mb = repo_target.stat().st_size / (1024 * 1024)
    print(f"Saved {len(df_60k):,} rows to {repo_target} ({file_size_mb:.2f} MB)")

    # Save target 2: in Desktop\Infotact Solution for direct browser upload
    infotact_dir = Path(r"C:\Users\Vishal Yadav\OneDrive\Desktop\Infotact Solution")
    if infotact_dir.exists():
        infotact_target = infotact_dir / "EconoCausal_Pricing_60000.csv"
        shutil.copy2(repo_target, infotact_target)
        print(f"Copied to {infotact_target} for convenient browser upload selection.")
