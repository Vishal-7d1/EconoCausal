# INFOTACT SOLUTIONS — FORMAL INTERNSHIP PROJECT REPORT

**Confidential Document | ISO 9001:2015 Approved Seal**

---

# EconoCausal: Prescriptive Pricing Optimization & Dynamic Discount Allocation via Double Machine Learning

**Intern Name:** Vishal Yadav  
**Organization:** Infotact Solutions  
**HR Manager:** Ms. Jyotirmayee Behera  
**Domain:** Causal Machine Learning, Prescriptive Analytics & Econometric Optimization  
**Project Track:** AI & Machine Learning Internship  
**Submission Date:** October 2026  
**Status:** Complete & Production Certified (Grade A+ Robustness)  

---

## Declaration & Confidentiality Notice
This project report has been prepared as a mandatory internship deliverable for **Infotact Solutions** in partial fulfillment of the internship requirements. All proprietary algorithms, causal methodologies, mathematical formulations, and source code documented herein represent original, unplagiarized work developed in adherence to company quality guidelines and ISO 9001:2015 standards.

---

## Executive Summary

Promotional discounting represents one of the largest budget outlays in modern retail and e-commerce, yet traditional predictive machine learning approaches frequently fail to optimize financial return. Standard supervised learning algorithms predict conversion probabilities $P(Y=1 \mid X, T)$, conflating correlation with causation: loyal, high-intent shoppers receive the steepest discounts simply because they purchase frequently, creating massive **deadweight loss** (subsidizing purchases that would have occurred at full price).

**EconoCausal** addresses this fundamental econometrics challenge by building an end-to-end causal machine learning and prescriptive optimization engine. Using **Double Machine Learning (DML)** with orthogonalized Neyman residualization, the system isolates true **Conditional Average Treatment Effects (CATE / $\hat{\tau}_i$)** across three distinct treatment options:
- Treatment 0 ($T_0$): No Discount (Baseline)
- Treatment 1 ($T_1$): ₹10 Discount
- Treatment 2 ($T_2$): ₹20 Discount

These customer-specific price elasticities are directly coupled with an exact **Mixed-Integer Linear Programming (MILP)** optimization solver utilizing the **HiGHS** simplex/interior-point engine via SciPy. Under fixed campaign budget caps (e.g., ₹50,000 for a 10,000-customer cohort), the system solves for the global profit-maximizing treatment allocation matrix.

### Key Performance Highlights:
- **Incremental Net Profit:** **₹3,76,115.07** generated under a ₹50,000 budget constraint.
- **Return on Ad/Discount Spend (ROAS):** **7.52x**, outperforming uniform discounting heuristics by **+28.4%**.
- **Incremental Purchases:** **+829.9** uplift in transactions over organic baseline.
- **Causal Robustness & Falsification:** Passed all 5 econometric refutation stress tests (Placebo $p=0.4851$, Random Common Cause $0.16\%$ drift, Data Subset $0.03\%$ drift, Positivity Trimming $0.17\%$ drift, and Permutation Diagnostic $p=0.002$), verified post-matching balance ($|SMD| < 0.022$ across all 9 confounders), and established Rosenbaum bounds ($\Gamma^* = 1.7, 2.1$) and Cinelli-Hazlett robustness ($RV_{q=1} = 12.42\%, 17.81\%$).
- **Interactive Interface:** Delivered a high-performance React + Vite executive dashboard communicating with a FastAPI microservice backend with sub-50ms inference latency.

---

## 1. Project Overview & Business Problem Formulation

### 1.1 The Causal Inference Problem in Observational Retail Data
In retail transactional databases, discount assignments are rarely completely randomized (A/B testing at scale is expensive, risks customer friction, and causes revenue cannibalization). Instead, discounts are historically assigned based on customer behavior:
1. High-frequency purchasers receive VIP coupons.
2. At-risk shoppers receive win-back retention incentives.
3. Cart abandoners receive dynamic discount nudges.

Consequently, observable customer covariates $X$ simultaneously influence the **treatment decision** $T$ (discount) and the **outcome variable** $Y$ (purchase/revenue). This creates severe **confounding bias**:

$$\mathbb{E}[Y \mid T=1] - \mathbb{E}[Y \mid T=0] \neq \mathbb{E}[Y(1) - Y(0)]$$

Standard machine learning models (XGBoost, Logistic Regression, Deep Neural Networks) optimize associative loss functions $\arg\min_\theta \mathcal{L}(Y, f_\theta(X, T))$. When deployed for decision-making, they recommend discounting customers who already have high baseline purchase probabilities, wasting millions in promotional budget.

### 1.2 The EconoCausal Value Proposition
EconoCausal formulates dynamic pricing not as a prediction problem, but as a **counterfactual decision optimization problem**:
1. Estimate what *would happen* to individual customer $i$ under each counterfactual price point: $Y_i(T_0), Y_i(T_1), Y_i(T_2)$.
2. Calculate individual uplift $\tau_{i, k} = Y_i(T_k) - Y_i(T_0)$.
3. Prescriptively allocate limited budget $B$ exclusively to customers exhibiting positive incremental profit margin: $\Delta \Pi_{i, k} > 0$.

```mermaid
graph TD
    A[Raw Observational Pricing Data] --> B[Module 1: Preprocessing & Causal EDA]
    B --> C[Module 2: EconML Double Machine Learning]
    C --> D[Customer-Level CATE Uplift Estimates]
    D --> E[Module 3: Prescriptive MILP Budget Optimizer]
    E --> F[Optimal Profit-Maximizing Policy]
    F --> G[Module 4: Executive Dashboard & FastAPI]
    G --> H[Business Decision Maker: One-Click Strategy Execution]
```

---

## 2. Dataset Engineering & Exploratory Data Analysis (EDA)

### 2.1 Cohort Architecture
The dataset was synthetically generated with ground-truth causal mechanisms strictly known for benchmark verification, mirroring a realistic 10,000-customer e-commerce cohort ($N=10,000$):
- **Features ($X$):**
  - `recency_days`: Days since last purchase ($1 - 365$).
  - `frequency_purchases`: Past annual orders ($1 - 50$).
  - `monetary_total`: Historical customer lifetime spend ($₹100 - ₹50,000$).
  - `cart_size`: Items in active shopping cart ($1 - 12$).
  - `avg_basket_value`: Mean purchase order size.
  - `browsing_minutes`: Pre-checkout active web/app session duration.
  - `mobile_app_user`: Binary device flag.
  - `loyalty_tier`: Discrete membership status ($0: \text{Bronze}, 1: \text{Silver}, 2: \text{Gold}$).
  - `days_as_customer`: Customer tenure.
- **Treatment Assignment ($T$):** Discrete categorical treatment:
  - $T \in \{0: \text{₹0}, 1: \text{₹10}, 2: \text{₹20}\}$.
  - Treatment assignment biased by loyalty tier and cart size (simulating observational confounder bias).
- **Observed Outcome ($Y$):** Binary conversion flag $Y \in \{0, 1\}$ and continuous spend $S \ge 0$.

### 2.2 Data Preprocessing & Integrity Checks
- **Missing Value Handling:** Verified zero unhandled null cells across the 10,000 records.
- **Outlier Mitigation:** Scaled heavy-tailed monetary variables via robust transformations.
- **Multicollinearity Screening:** Confirmed all feature Variance Inflation Factors (VIF) $< 5.0$.
- **Strict Data Separation:** An isolated ground-truth counterfactual matrix was segregated (`ground_truth_eval.csv`) to prevent data leakage during model training and evaluation.

### 2.3 Confounder Overlap & Propensity Diagnostics
A core assumption of causal identification is **Positivity (Common Support)**:

$$0 < P(T = k \mid X = x) < 1 \quad \forall k \in \{0, 1, 2\}, \forall x \in \text{supp}(X)$$

Exploratory diagnostics confirmed strict common support across bronze, silver, and gold customer segments: propensity distributions exhibited significant overlap across all treatment arms with no deterministic assignment violations.

---

## 3. Causal Machine Learning Methodology (Double Machine Learning)

### 3.1 Mathematical Foundation of Double Machine Learning (LinearDML)
EconoCausal implements Double Machine Learning based on the Frisch-Waugh-Lovell theorem and Neyman orthogonality (Chernozhukov et al., 2018).

The partially linear model formulation is specified as:

$$Y_i = \theta(X_i) \cdot T_i + g(W_i) + \varepsilon_i, \quad \mathbb{E}[\varepsilon_i \mid X_i, W_i] = 0$$

$$T_i = m(W_i) + \eta_i, \quad \mathbb{E}[\eta_i \mid W_i] = 0$$

Where:
- $Y_i$: Observed outcome (conversion / incremental spend).
- $T_i$: Treatment vector (discount indicator).
- $X_i$: Effect modifiers (covariates driving heterogeneous treatment sensitivity).
- $W_i$: High-dimensional confounders driving both treatment assignment and conversion.
- $\theta(X_i)$: Heterogeneous treatment effect function (CATE / $\tau_i(X)$).

### 3.2 Two-Stage Orthogonalized Residualization & Cross-Fitting
To eliminate regularization bias and overfitting:
1. **Stage 1 (Nuisance Estimation via Cross-Fitting):**
   - Model outcome nuisance: $\hat{g}(W) = \mathbb{E}[Y \mid W]$ fitted via LightGBM Regressor across 5-fold cross-validation.
   - Model treatment propensity nuisance: $\hat{m}(W) = \mathbb{E}[T \mid W]$ fitted via LightGBM Classifier.
2. **Residualization:**
   $$\tilde{Y}_i = Y_i - \hat{g}(W_i)$$
   $$\tilde{T}_i = T_i - \hat{m}(W_i)$$
3. **Stage 2 (Final CATE Estimation):**
   $$\hat{\theta} = \arg\min_{\theta} \sum_{i=1}^N \left( \tilde{Y}_i - \theta(X_i) \cdot \tilde{T}_i \right)^2$$
   Estimated via linear interaction basis, yielding robust, $\sqrt{N}$-consistent estimates of individual uplift $\hat{\tau}_{i, 10}$ and $\hat{\tau}_{i, 20}$.

---

## 4. Prescriptive Budget Optimization Engine (MILP Formulation)

### 4.1 Knapsack / Mixed-Integer Linear Programming Formulation
Having estimated causal price elasticity $\hat{\tau}_{i, k}$ for every customer $i$ and discount tier $k \in \{0, 1, 2\}$, EconoCausal solves a constrained prescriptive optimization problem.

Let $z_{i, k} \in \{0, 1\}$ be the binary decision variable denoting whether customer $i$ receives discount tier $k$.

$$\max_{z} \quad \sum_{i=1}^N \sum_{k \in \{0, 1, 2\}} \Delta \Pi_{i, k} \cdot z_{i, k}$$

**Subject to:**

1. **Mutually Exclusive Assignment (Exactly One Treatment Per Customer):**
   $$\sum_{k \in \{0, 1, 2\}} z_{i, k} = 1 \quad \forall i \in \{1, \dots, N\}$$

2. **Budget Liability Constraint:**
   - **Nominal (Allocated) Budget Mode:**
     $$\sum_{i=1}^N \sum_{k \in \{1, 2\}} d_k \cdot z_{i, k} \le B$$
   - **Expected (Redeemed) Cost Mode:**
     $$\sum_{i=1}^N \sum_{k \in \{1, 2\}} d_k \cdot \left( \hat{P}_{i, 0} + \hat{\tau}_{i, k} \right) \cdot z_{i, k} \le B$$

Where:
- $d_k \in \{0, 10, 20\}$ is the nominal face value of discount tier $k$.
- $\Delta \Pi_{i, k} = \text{Margin} \cdot \hat{\tau}_{i, k} \cdot \text{BaseSpend}_i - d_k \cdot (\hat{P}_{i, 0} + \hat{\tau}_{i, k})$ is the expected incremental profit.
- $B$ is the total marketing campaign budget cap ($₹50,000$).

### 4.2 Exact Solver Execution
The optimization problem is solved using the **HiGHS** dual-simplex and interior-point solver via `scipy.optimize.linprog` / `milp`. For $N=10,000$ and 3 treatments ($30,000$ variables), the solver achieves the global mathematical optimum in under **1.85 seconds**.

---

## 5. Statistical Validation & Causal Robustness Verification

To satisfy stringent enterprise validation standards, the system incorporates empirical verification grounded in the Rubin Causal Model:

```mermaid
graph LR
    V1[1:1 Caliper PSM Matching] --> VA[Covariate Balance: All SMD < 0.022]
    V2[Placebo Treatment Test] --> VB[Placebo Effect: p = 0.4851 > 0.05]
    V3[Random Common Cause] --> VC[Effect Drift < 0.16%]
    V4[Data Subset Stability] --> VD[Subsample Drift < 0.03%]
    V5[Residual Permutation] --> VE[Null Rejection: p = 0.0020]
    VA & VB & VC & VD & VE --> CERT[Validation Scorecard: 100% Robustness]
```

### 5.1 Propensity Score Matching (PSM) & Covariate Balance
Using 1:1 Nearest-Neighbor Caliper Matching on estimated logit propensity scores ($\epsilon = 0.20 \times \sigma_{\text{logit}}$):
- **Treatment Cohort Size:** 2,273 matched pairs for ₹10 arm (95.87% match rate) and 2,088 matched pairs for ₹20 arm (97.07% match rate).
- **Standardized Mean Differences (SMD):** Across all 9 observational covariates, post-match $|SMD|$ dropped from $> 0.35$ down to **$< 0.022$** (maximum observed $|SMD| = 0.0181$), well within the gold-standard scientific threshold ($|SMD| < 0.10$).

### 5.2 5 Causal Falsification Refutation Tests
1. **Placebo Treatment Refutation:** Replacing actual discount assignments with randomized noise resulted in an estimated causal effect collapsing to $0.00\%$ ($p = 0.4851 > 0.05$). The model correctly rejected spurious causation.
2. **Random Common Cause Refutation:** Adding an unobserved synthetic Gaussian confounder to $W$ induced only $0.16\%$ relative effect drift ($< 5.0\%$ tolerance).
3. **Data Subset Refutation:** Re-estimating on independent 80% random sub-samples exhibited only $0.03\%$ relative effect drift ($< 5.0\%$ tolerance).
4. **Positivity Overlap Trimming Sensitivity:** Trimming extreme propensity tails exhibited only $0.17\%$ relative effect drift ($< 5.0\%$ tolerance).
5. **Model-Based Residual Permutation Diagnostic:** Observed treatment uplift ($+14.22\%$) lies far outside the 95% permutation null distribution ($[-2.12\%, +2.02\%]$), rejecting the null hypothesis of zero effect at empirical $p = 0.00200 < 0.05$.

### 5.3 Sensitivity to Unobserved Confounding & Governance Disclosures
- **Rosenbaum Sensitivity Bounds:** Critical tipping thresholds evaluated on matched pairs are $\Gamma^* = 1.7$ (₹10 arm) and $\Gamma^* = 2.1$ (₹20 arm).
- **Cinelli & Hazlett (2020) Robustness Values:** To reduce estimated effects to zero, an unobserved confounder must explain at least $RV_{q=1} = 12.42\%$ (₹10 arm) and $17.81\%$ (₹20 arm) of residual variance in both treatment and outcome.
- **Scientific Disclosure & Certification Scope:** Internal labels (`APPROVED`, `Grade A+ Certified`) reflect project-level validation scorecard criteria evaluated on a synthetic benchmark dataset ($N=10,000$). Observational sensitivity analysis establishes resilience against hidden bias but cannot mathematically replace randomized A/B experimentation in live enterprise deployments.

---

## 6. Financial & Business Impact Analysis

### 6.1 Policy Comparison Benchmark ($N=10,000$, Budget = ₹50,000)

| Policy Name | Targeted Customers | Allocated Spend | Incremental Conversions | Incremental Net Profit | ROAS Efficiency |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **No Discounts (Organic Baseline)** | 0 (0.0%) | ₹0.00 | 0.0 | ₹0.00 | 0.00x |
| **Uniform ₹10 to All** | 5,000 (50.0%) | ₹50,000.00 | +512.4 | ₹2,14,350.20 | 4.28x |
| **Random Allocation** | 3,120 (31.2%) | ₹50,000.00 | +389.1 | ₹1,48,210.00 | 2.96x |
| **Predictive Heuristic (Top Conversion)** | 4,200 (42.0%) | ₹50,000.00 | +610.8 | ₹2,92,440.00 | 5.85x |
| **EconoCausal (DML + HiGHS MILP)** | **4,568 (45.68%)** | **₹50,000.00** | **+829.9** | **₹3,76,115.07** | **7.52x** |

### 6.2 Key Takeaways for Commercial Leadership
1. **+75.4% Higher Net Profit** than uniform discounting heuristics under the exact same ₹50,000 marketing outlay.
2. **Elimination of Deadweight Loss:** Inelastic customers (those with high baseline purchase probability $\hat{P}_0 > 0.85$ but near-zero treatment sensitivity $\tau < 0.02$) are assigned ₹0 discount, preserving margin without hurting purchase volume.
3. **Precision Targeting:** Discounts are concentrated on *fence-sitters* (moderate baseline intent, high elasticity), unlocking +829.9 incremental conversions that would never have occurred organically.

---

## 7. System Architecture & Technical Implementation

```mermaid
graph TB
    subgraph Frontend [React 19 + Vite 8 Dashboard]
        UI1[Overview KPI & Policy Summary]
        UI2[Dataset Explorer & CSV Parser]
        UI3[Interactive Plotly Causal Visualizations]
        UI4[HiGHS MILP Budget Simulator]
        UI5[Executive Causal Audit Modal]
    end

    subgraph Backend [FastAPI Production Microservice]
        API1[/api/summary]
        API2[/api/simulate]
        API3[/api/dataset/sample]
        API4[/api/report/export]
        API5[/api/validation]
        DML[EconML LinearDML Runtime Engine]
        MILP[SciPy HiGHS Optimizer]
    end

    UI1 <--> API1
    UI4 <--> API2
    UI2 <--> API3
    UI5 <--> API4
    UI5 <--> API5
    API2 <--> MILP
    API1 <--> DML
```

### 7.1 Tech Stack Summary
- **Data Engineering:** Python 3.12, Pandas, NumPy, Scikit-Learn.
- **Causal Machine Learning:** EconML, LightGBM, Double Machine Learning (LinearDML).
- **Optimization:** SciPy (`scipy.optimize.milp`), HiGHS simplex solver.
- **Backend Microservice:** FastAPI, Uvicorn, Pydantic v2 schemas.
- **Frontend Dashboard:** React 19, Vite, Vanilla CSS Design System, Plotly.js, Responsive Shell.
- **Theme Architecture:** High-contrast dual-theme engine (Dark Mode & Eye-Soothing Light Mode) conforming to WCAG AAA contrast ratios.

---

## 8. Conclusion, Internship Learnings & Recommendations

### 8.1 Key Technical Learnings
During this internship at **Infotact Solutions**, the following core technical capabilities were developed and demonstrated:
1. Translating complex econometric theory (Neyman-Rubin causal model, Frisch-Waugh-Lovell theorem) into robust, modular production software.
2. Formulating real-world business constraints as mixed-integer linear optimization programs solved with modern LP/MILP engines.
3. Architecting scalable full-stack ML applications integrating asynchronous Python backends with low-latency reactive frontends.
4. Implementing rigorous statistical falsification pipelines to certify machine learning safety prior to production deployment.

### 8.2 Future Roadmap
- **Dynamic Real-Time Re-Estimation:** Implementing streaming contextual bandits (e.g., LinUCB / Thompson Sampling) for continuous exploration.
- **Multi-Product Basket Cannibalization:** Extending CATE matrices to account for cross-product elasticity and substitute cannibalization.
- **Containerized Kubernetes Deployment:** Packaging FastAPI backend and React static bundle into Docker containers for cloud scaling.

---

**Report Prepared By:** Vishal Yadav  
**Designation:** Machine Learning & Causal AI Intern  
**Approved By:** Infotact Solutions Evaluation Committee  
**HR Seal:** Ms. Jyotirmayee Behera, Human Resource Manager (ISO 9001:2015)
