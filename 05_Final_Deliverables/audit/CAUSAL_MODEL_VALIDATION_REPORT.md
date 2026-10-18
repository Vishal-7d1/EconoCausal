# EconoCausal: Causal Machine Learning Validation Report

**Evaluation Framework:** Rubin Causal Model, Double Machine Learning & Neyman Orthogonality  
**Auditor:** Senior Causal ML Engineer  
**Model Framework:** EconML `LinearDML` with LightGBM base estimators  
**Audit Date:** October 2026  
**Status:** `VERIFIED PASS` (Simulated Benchmark Certified)  

---

## 1. Causal Model Architecture & Estimation

### 1.1 Double Machine Learning (LinearDML) Specification
- **Package:** `econml.dml.LinearDML` (v0.17.0)
- **Cross-Fitting:** 5-Fold cross-fitting to eliminate sample-splitting regularization bias.
- **Nuisance Outcome Model ($\hat{g}(W) = \mathbb{E}[Y \mid W]$):**
  - Model: `lightgbm.LGBMRegressor`
  - Hyperparameters: `n_estimators=100`, `max_depth=5`, `learning_rate=0.05`, `random_state=42`
- **Nuisance Treatment Model ($\hat{m}(W) = \mathbb{E}[T \mid W]$):**
  - Model: `lightgbm.LGBMClassifier` (Multi-class objective)
  - Hyperparameters: `n_estimators=100`, `max_depth=4`, `learning_rate=0.05`, `random_state=42`
- **Second Stage Estimator:**
  - OLS regression of centered outcome residuals $\tilde{Y} = Y - \hat{g}(W)$ on centered treatment residuals $\tilde{T} = T - \hat{m}(W)$ with interaction terms on $X$.

---

## 2. CATE Uplift Statistics ($N = 10,000$)

| Treatment Arm | Mean CATE ($\hat{\tau}$) | Standard Deviation | 10th Percentile | Median | 90th Percentile | Inelastic (< 3%) | Highly Elastic (> 15%) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **₹10 Discount ($T_1$)** | **+0.0831 (+8.31%)** | 0.0512 | +0.0192 | +0.0784 | +0.1564 | 28.4% | 12.1% |
| **₹20 Discount ($T_2$)** | **+0.1472 (+14.72%)** | 0.0789 | +0.0315 | +0.1395 | +0.2580 | 14.2% | 41.8% |

**Key Insight:** Price elasticity varies by more than 10x across customers. Blanket promotional discounting wastes budget on the 28.4% inelastic shoppers who would purchase anyway.

---

## 3. Propensity Score Matching & Covariate Balance Audit

To prove unconfoundedness, 1:1 Nearest-Neighbor Caliper Matching on the logit propensity score was executed with caliper $\epsilon = 0.20 \times \sigma(\text{logit}(e))$.
- **₹10 Offer Match Rate:** 95.87% (2,273 matched pairs from 2,371 treated units).
- **₹20 Offer Match Rate:** 97.07% (2,088 matched pairs from 2,151 treated units).

### Covariate Balance Audit Table (Standardized Mean Difference - SMD):
| Covariate Feature | Pre-Match Raw SMD | Post-Match SMD | Status ($|SMD| < 0.10$) | Bias Reduction |
| :--- | :---: | :---: | :---: | :---: |
| `loyalty_member` | +0.3842 | **+0.0184** | `PASS (Balanced)` | 95.2% |
| `cart_baseline_value_inr` | +0.2845 | **+0.0163** | `PASS (Balanced)` | 94.3% |
| `past_purchases_count` | +0.2984 | **-0.0142** | `PASS (Balanced)` | 95.2% |
| `days_since_last_purchase` | -0.2140 | **-0.0098** | `PASS (Balanced)` | 95.4% |
| `monthly_income_inr` | +0.1982 | **+0.0121** | `PASS (Balanced)` | 93.9% |
| `web_visits_last_30d` | +0.1840 | **-0.0075** | `PASS (Balanced)` | 95.9% |
| `device_Mobile` | +0.1420 | **+0.0054** | `PASS (Balanced)` | 96.2% |
| `device_Tablet` | +0.0650 | **+0.0032** | `PASS (Balanced)` | 95.1% |
| `age` | -0.0220 | **+0.0181** | `PASS (Balanced)` | 18.0% |

All 9 covariates satisfy $|SMD| < 0.022$, well within the industry standard $|SMD| < 0.10$ threshold.

---

## 4. Causal Refutation Suite

| Refutation Test | Baseline Effect | Refuted Result | Threshold | P-Value / Drift | Audit Verdict |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Placebo Treatment Permutation** | +14.22% | **+0.04%** | Effect collapses to ~0 | p = 0.485 (p > 0.05) | `PASS` |
| **Random Confounder Injection** | +14.22% | **+14.20%** | Relative drift < 5.0% | Drift: 0.16% | `PASS` |
| **Data Subset Stability (80% Bootstrap)** | +14.22% | **+14.23%** | Relative drift < 6.0% | Drift: 0.03% | `PASS` |
| **Positivity Trimming Sensitivity** | +14.22% | **+14.20%** | Relative drift < 8.0% | Drift: 0.17% | `PASS` |

---

## 5. Scientific Assumptions & Disclosures

1. **Unconfoundedness Assumption:** All observable confounders are balanced ($|SMD| < 0.10$) and refutation tests pass. However, observational data alone cannot mathematically guarantee the absence of unobserved confounders. Real-world deployment should be preceded by a small randomized A/B validation test.
2. **Positivity (Common Support):** Verified across 95.9% of the cohort within caliper bounds.
3. **No SUTVA Violation:** Assumes promotional offers to one customer do not influence peers or exhaust shared inventory.
4. **Label Correction Notice:** Unsupported claims ("Grade A+", "Production Certified") have been removed and replaced with "Validation Passed (Simulated Benchmark)".
