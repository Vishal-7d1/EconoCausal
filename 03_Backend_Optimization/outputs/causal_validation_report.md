# EconoCausal: Causal Inference Validation & Statistical Audit Report

**Audit Timestamp**: 2026-10-22 11:55:11 UTC  
**Composite Causal Robustness Index**: `100.0%` (Validation Passed (Simulated Benchmark))  
**Overall Audit Status**: **PASSED**  

---

## 1. Executive Summary & Causal Identification Guarantees

In observational e-commerce pricing data, promotional discounts are preferentially assigned to loyal or high-cart shoppers, inducing severe confounding bias. To establish mathematical causality before optimizing marketing expenditure, EconoCausal enforces two foundational pillars:

1. **Conditional Independence & Covariate Balance (Propensity Score Matching)**: Proves that treated and control cohorts are indistinguishable across all observable pretreatment covariates ($|SMD| < 0.10$).
2. **Empirical Refutation & Sensitivity Invariance**: Confirms that estimated treatment effects withstand falsification tests (placebo assignments, unobserved confounder perturbations, and sub-sample stability).

---

## 2. Propensity Score Matching (PSM) & Covariate Balance

Matching specification: **1:1 Nearest-Neighbor Caliper Matching** without replacement on the logit propensity score with caliper $\epsilon = 0.20 \times \sigma(\text{logit}(e))$.

- **Arm ₹10 vs ₹0**: Matched 2,273 pairs from 2,371 treated units (Match Rate: 95.87%).
- **Arm ₹20 vs ₹0**: Matched 2,088 pairs from 2,151 treated units (Match Rate: 97.07%).

### Covariate Balance Audit Table (₹10 Offer vs Control)

| Covariate Name | Raw SMD | Matched SMD | Status (SMD < 0.10) | % Bias Reduction | Variance Ratio |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Customer Age** | -0.0220 | `+0.0181` | **PASS** | 18.0% | 0.97 |
| **Monthly Income (₹)** | -0.2688 | `+0.0022` | **PASS** | 99.2% | 1.09 |
| **Web Visits (30d)** | +0.2791 | `+0.0086` | **PASS** | 96.9% | 1.01 |
| **Past Purchases Count** | -0.0076 | `-0.0072` | **PASS** | 5.3% | 0.98 |
| **Recency (Days Since Purchase)** | +0.3194 | `-0.0112` | **PASS** | 96.5% | 0.99 |
| **Active Cart Value (₹)** | -0.3047 | `-0.0056` | **PASS** | 98.2% | 0.85 |
| **Loyalty Program Member** | +0.1195 | `+0.0093` | **PASS** | 92.2% | 1.01 |
| **Device: Mobile** | -0.0196 | `-0.0063` | **PASS** | 67.8% | 1.00 |
| **Device: Tablet** | +0.0186 | `-0.0043` | **PASS** | 76.6% | 0.99 |

> [!NOTE]
> **Gold Standard Rule**: Standardized Mean Difference $|SMD| < 0.10$ and Variance Ratio between $0.80$ and $1.25$ signifies that confounding selection bias has been successfully eliminated.

---

## 3. Causal Diagnostics & Sensitivity Refutations

We subjected the estimated causal effects to five falsification stress-tests for both promotional arms:

### A. Arm ₹10 vs ₹0 Refutation Summary

| Refutation Test | Benchmark Effect | Test Result | Tolerance / Criteria | Audit Verdict |
| :--- | :---: | :---: | :---: | :---: |
| **Placebo Treatment Test** | +14.22% | Placebo: `+0.83%` (p=0.477) | Effect collapses to 0 (p > 0.05) | **PASS** |
| **Random Common Cause Refutation** | +14.22% | Drift: `0.16%` | Invariant (< 5% relative drift) | **PASS** |
| **Data Subset Removal Refutation** | +14.22% | Drift: `0.03%` | Invariant (< 5% relative drift) | **PASS** |
| **Positivity Overlap Trimming Sensitivity** | +14.22% | Drift: `0.17%` | Invariant (< 5% relative drift) | **PASS** |
| **Monte Carlo Treatment Permutation Test** | +14.22% | Null CI: `[-2.12%, +2.02%]` | Reject H0 (p = 0.00200 < 0.05) | **PASS** |

### B. Arm ₹20 vs ₹0 Refutation Summary

| Refutation Test | Benchmark Effect | Test Result | Tolerance / Criteria | Audit Verdict |
| :--- | :---: | :---: | :---: | :---: |
| **Placebo Treatment Test** | +21.32% | Placebo: `+0.23%` (p=0.852) | Effect collapses to 0 (p > 0.05) | **PASS** |
| **Random Common Cause Refutation** | +21.32% | Drift: `0.12%` | Invariant (< 5% relative drift) | **PASS** |
| **Data Subset Removal Refutation** | +21.32% | Drift: `0.65%` | Invariant (< 5% relative drift) | **PASS** |
| **Positivity Overlap Trimming Sensitivity** | +21.32% | Drift: `0.45%` | Invariant (< 5% relative drift) | **PASS** |
| **Monte Carlo Treatment Permutation Test** | +21.32% | Null CI: `[-2.44%, +2.14%]` | Reject H0 (p = 0.00200 < 0.05) | **PASS** |

---

## 4. Unobserved Confounding Sensitivity Analysis

Observational causal inference relies on unconfoundedness, which is fundamentally untestable from data alone.
We report formal econometric sensitivity analyses quantifying the magnitude of hidden bias required to overturn conclusions:

### A. Cinelli & Hazlett (2020) Partial-R² Robustness Values (Residualized OLS Estimand)

| Treatment Arm | Observed ATE | Partial R² (Y ~ T \| X) | Robustness Value (RV_q=1) | Robustness Value (RV_alpha=0.05) |
| :--- | :---: | :---: | :---: | :---: |
| **₹10 Discount vs ₹0** | +14.22% | 1.73% | **12.42%** | **10.47%** |
| **₹20 Discount vs ₹0** | +21.32% | 3.72% | **17.81%** | **15.95%** |

> **Interpretation (₹10 Arm)**: An unobserved confounder U would need to explain at least 12.42% of the residual variance in both treatment assignment and purchase conversion to reduce the estimated treatment effect to zero. To render the effect statistically insignificant at alpha=0.05, U would need to explain 10.47% of the residual variance in both.

### B. Rosenbaum Sensitivity Bounds on Matched Observational Pairs

| Treatment Arm | Matched Pairs | Discordant Pairs | Critical Gamma Threshold (Gamma*) | Interpretation |
| :--- | :---: | :---: | :---: | :--- |
| **₹10 Discount vs ₹0** | 2,273 | 1,169 | **Gamma* = 1.7** | Hidden odds ratio must exceed 1.7 to explain effect. |
| **₹20 Discount vs ₹0** | 2,088 | 1,067 | **Gamma* = 2.1** | Hidden odds ratio must exceed 2.1 to explain effect. |

---

## 5. Pairwise Positivity & Trimming Sensitivity Grid

| Contrast | Propensity Range | Trim [0.01, 0.99] ATE | Trim [0.05, 0.95] ATE | Trim [0.10, 0.90] ATE |
| :--- | :---: | :---: | :---: | :---: |
| **₹10 Discount vs ₹0 Control** | [0.0103, 0.9307] | +14.22% (cut 0.0%) | +14.25% (cut 0.37%) | +14.28% (cut 3.13%) |
| **₹20 Discount vs ₹0 Control** | [0.0021, 0.8926] | +21.33% (cut 0.01%) | +21.22% (cut 1.14%) | +21.03% (cut 5.61%) |
| **₹20 Discount vs ₹10 Discount (Incremental)** | [0.1924, 0.8895] | +6.77% (cut 0.0%) | +6.77% (cut 0.0%) | +6.77% (cut 0.0%) |

---

## 6. Production EconML DML Estimator Verification

- **Estimator Class**: `LinearDML` (Loaded read-only from `dml_model.joblib`)
- **Arm ₹10 Mean CATE Uplift**: `+14.36%` (Range: `[-3.39%, 32.05%]`)
- **Arm ₹20 Mean CATE Uplift**: `+21.23%` (Range: `[2.06%, 33.59%]`)
- **Monotonicity Consistency**: `89.31%` of customers satisfy τ_20 >= τ_10
- **Supports Confidence Intervals**: `True`

---

## 7. Econometric Assumptions Review & Scientific Disclosures

- **Audit Status**: `PASSED`
- **Verification Status**: `Validation Passed (Simulated Benchmark)`
- **Anti-Leakage Validation**: Confirmed. Zero ground-truth evaluation columns were accessed during model fitting, propensity scoring, or validation.
- **Deployment Recommendation**: Validation passed on simulated benchmark. For real-world enterprise deployment, run a staggered randomized A/B rollout to experimentally verify unconfoundedness in live customer traffic.

> [!IMPORTANT]
> **Scientific Disclosure**: Observed covariate balance (|SMD| < 0.10) and refutation stability confirm that observed confounding was mitigated. However, observational methods cannot conclusively rule out unobserved confounding without randomized A/B experimentation.
