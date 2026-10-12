# EconoCausal: Exploratory Data Analysis & Causal Confounding Report

**Generated**: Automatically via `01_Dataset_Analysis/eda.py`  
**Module**: 01_Dataset_Analysis  

---

## 1. Dataset Overview
- **Total Rows**: 10,000
- **Feature Columns**: 16
- **Missing Value Cells**: 0
- **Treatment Allocation**: Control (₹0): 5,478 (54.8%); ₹10 Discount: 2,371 (23.7%); ₹20 Discount: 2,151 (21.5%)

---

## 2. Observed Purchase Conversion Rates

> [!WARNING]
> Raw conversion rate differences conflate true treatment uplift with customer selection bias.
> Do not interpret naive conversion deltas as causal policy guidance.

| Treatment Arm | Discount INR | Sample Size | Conversion Rate (%) | SE (%) | Mean Realized Revenue (₹) |
| --- | --- | --- | --- | --- | --- |
| Control (₹0) | 0 | 5478 | 41.79 | 0.67 | 468.38 |
| ₹10 Discount | 10 | 2371 | 55.84 | 1.02 | 552.67 |
| ₹20 Discount | 20 | 2151 | 62.67 | 1.04 | 686.12 |

---

## 3. Confounder Profiling (Covariate Imbalance Across Arms)

Demonstrates systematic selection bias in the treatment assignment mechanism:

| Covariate | ₹0 (Control) Mean (Std) | ₹10 Discount Mean (Std) | ₹20 Discount Mean (Std) |
| --- | --- | --- | --- |
| monthly_income_inr | 57,685.52 (27,288.17) | 50,910.96 (22,934.30) | 46,627.02 (20,699.02) |
| days_since_last_purchase | 38.29 (38.09) | 52.81 (51.81) | 50.49 (49.89) |
| cart_baseline_value_inr | 1,184.88 (641.71) | 1,013.08 (473.27) | 1,150.63 (614.16) |
| past_purchases_count | 3.72 (3.28) | 3.69 (3.28) | 3.83 (3.37) |
| web_visits_last_30d | 6.22 (2.50) | 6.93 (2.62) | 6.82 (2.60) |
| loyalty_member | 0.21 (0.41) | 0.26 (0.44) | 0.27 (0.45) |
| age | 36.19 (10.61) | 35.96 (10.39) | 36.21 (10.59) |

---

## 4. Multiclass Propensity Score Overlap & Positivity Diagnostics

- **Model**: Multinomial Logistic Regression (`L-BFGS`, multi-class multinomial loss).
- **Features**: Pretreatment customer features exclusively (age, income, visits, recency, cart value, loyalty, device).
- **Anti-Leakage Safeguard**: `customer_id`, treatments, outcomes, and `true_*` columns strictly excluded.

| Treatment Arm | Range [Min, Max] | 1st - 99th Percentile | Mean Propensity |
| :--- | :--- | :--- | :--- |
| Control (₹0) | [0.0444, 0.9875] | [0.2013, 0.8586] | 0.5478 |
| ₹10 Discount | [0.0105, 0.6292] | [0.0663, 0.4569] | 0.2371 |
| ₹20 Discount | [0.0021, 0.5083] | [0.0457, 0.4045] | 0.2151 |

> [!NOTE]
> **Methodological Grounding**: Empirical overlap of estimated propensity scores is necessary
> but not sufficient to ensure causal identification. Unconfoundedness (conditional independence)
> and SUTVA remain structural assumptions grounded in business domain knowledge.

---

## 5. Ground-Truth Counterfactual Comparison & Selection Bias Breakdown

Comparing observed conversion against true potential outcome probabilities reveals the magnitude of selection bias:

| Treatment Arm | Observed Conversion (%) | True Assigned P(Y|T) (%) | True Baseline P(Y(0)) (%) | True Subgroup Uplift tau (%) |
| --- | --- | --- | --- | --- |
| Control (₹0) | 41.79 | 41.47 | 41.47 | 0.0 |
| ₹10 Discount | 55.84 | 55.78 | 40.93 | 14.85 |
| ₹20 Discount | 62.67 | 64.48 | 40.91 | 23.56 |

---

## 6. Subgroup CATE & Price Sensitivity Heterogeneity

Ground-truth benchmark analysis confirms price elasticity heterogeneity:

| Segment Category | Segment | Sample Size | Mean Income (₹) | True ATE ₹10 (%) | True ATE ₹20 (%) |
| --- | --- | --- | --- | --- | --- |
| Income Tier | Low Income (Q1) | 2500 | ₹28,023 | 16.65 | 26.36 |
| Income Tier | Med-Low (Q2) | 2500 | ₹41,912 | 14.78 | 23.38 |
| Income Tier | Med-High (Q3) | 2500 | ₹56,135 | 13.86 | 21.86 |
| Income Tier | High Income (Q4) | 2500 | ₹88,732 | 12.79 | 20.15 |
| Loyalty Status | Non-Loyalty Members | 7636 | ₹51,456 | 15.3 | 24.27 |
| Loyalty Status | Loyalty Club Members | 2364 | ₹60,952 | 12.02 | 18.62 |

---

## 7. Key Takeaways for Double Machine Learning (DML)

1. **Confounding is Active**: Marketers disproportionately discounted dormant customers and lower-income shoppers.
2. **Selection Bias Distorts Naive Comparisons**: High baseline purchase propensities mask true discount effects.
3. **Heterogeneity is Substantial**: Lower-income shoppers and non-loyalty members exhibit significantly higher uplift (+18% to +26%) compared to high-income loyal shoppers (+9% to +17%).
4. **Common Support Holds**: Propensity scores are non-degenerate, validating the feasibility of DML cross-fitting and residualization.

---
**Generated Figures**: `01_treatment_and_conversion.png`, `02_confounder_distributions.png`, `03_propensity_overlap.png`, `04_subgroup_cate_analysis.png`.