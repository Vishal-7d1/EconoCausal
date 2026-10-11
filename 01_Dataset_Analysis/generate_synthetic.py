"""
Synthetic pricing dataset for EconoCausal (Member 1).

Creates a fake shop where each customer may receive a discount of Rs 0, 10 or 20.
We choose the TRUE effect of the discount ourselves, so Member 2 can check
whether the DML model recovers it.

Run from inside the 01_Dataset_Analysis folder:
    python generate_synthetic.py

Outputs (in data/synthetic/):
    synthetic_pricing.csv       - the dataset the team models on
    synthetic_ground_truth.csv  - the true effects (answer key; do NOT use as features)
"""
import os
import numpy as np
import pandas as pd

SEED = 42
N = 20000
OUT_DIR = os.path.join("data", "synthetic")

rng = np.random.default_rng(SEED)


def sigmoid(x):
    return 1 / (1 + np.exp(-x))


# 1. Customer features (all measured BEFORE any discount is given)
age = rng.integers(18, 66, N)
region = rng.choice(["North", "South", "East", "West", "Central"], N,
                    p=[0.2, 0.25, 0.15, 0.25, 0.15])
loyalty_member = rng.binomial(1, 0.35, N)
past_purchases = rng.poisson(2 + 3 * loyalty_member)          # loyal customers buy more often
avg_basket_value = np.round(rng.lognormal(mean=5.2, sigma=0.5, size=N), 0)  # in Rs

# 2. How price-sensitive each customer really is (hidden from the dataset)
#    Younger, non-loyal, small-basket customers react more to discounts.
sensitivity = (
    1.0
    - 0.6 * loyalty_member
    - 0.015 * (age - 40)
    - 0.3 * (np.log(avg_basket_value) - 5.2)
)
sensitivity = np.clip(sensitivity, 0.1, 2.0)

# 3. Baseline chance of buying with no discount
base_logit = (
    -1.5
    + 0.25 * past_purchases
    + 0.8 * loyalty_member
    + 0.002 * (avg_basket_value - 200)
)

# 4. TRUE causal effect: each Rs 10 of discount adds 0.12 * sensitivity to the logit
EFFECT_PER_10 = 0.12
def logit_with_discount(d):
    return base_logit + EFFECT_PER_10 * (d / 10) * sensitivity * 5

p0, p10, p20 = (sigmoid(logit_with_discount(d)) for d in (0, 10, 20))

# 5. Who gets a discount? NOT random: shop targets customers with many past
#    purchases (this is the confounding DML must remove).
score10 = -0.3 + 0.15 * past_purchases - 0.3 * loyalty_member
score20 = -0.8 + 0.25 * past_purchases - 0.3 * loyalty_member
scores = np.column_stack([np.zeros(N), score10, score20])
probs = np.exp(scores) / np.exp(scores).sum(axis=1, keepdims=True)
u = rng.random(N)[:, None]
discount = (u > probs.cumsum(axis=1)).sum(axis=1) * 10      # 0, 10 or 20

# 6. Observed outcome
p_observed = np.where(discount == 0, p0, np.where(discount == 10, p10, p20))
purchased = rng.binomial(1, p_observed)
spend = np.where(
    purchased == 1,
    np.round(np.maximum(avg_basket_value * rng.normal(1.0, 0.15, N) - discount, 0), 0),
    0,
)

df = pd.DataFrame({
    "customer_id": np.arange(1, N + 1),
    "age": age,
    "region": region,
    "loyalty_member": loyalty_member,
    "past_purchases": past_purchases,
    "avg_basket_value": avg_basket_value,
    "discount": discount,
    "purchased": purchased,
    "spend": spend,
})

truth = pd.DataFrame({
    "customer_id": df["customer_id"],
    "true_prob_discount_0": p0.round(4),
    "true_prob_discount_10": p10.round(4),
    "true_prob_discount_20": p20.round(4),
    "true_uplift_10": (p10 - p0).round(4),
    "true_uplift_20": (p20 - p0).round(4),
})

os.makedirs(OUT_DIR, exist_ok=True)
df.to_csv(os.path.join(OUT_DIR, "synthetic_pricing.csv"), index=False)
truth.to_csv(os.path.join(OUT_DIR, "synthetic_ground_truth.csv"), index=False)

# Quick sanity summary
print("Rows:", len(df))
print("\nDiscount counts:\n", df["discount"].value_counts().sort_index())
print("\nNaive purchase rate by discount (confounded):\n",
      df.groupby("discount")["purchased"].mean().round(3))
print("\nTRUE average uplift (answer key):")
print("  Rs 10:", round(truth["true_uplift_10"].mean(), 4))
print("  Rs 20:", round(truth["true_uplift_20"].mean(), 4))
print("\nFiles written to", OUT_DIR)
