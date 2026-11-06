# INFOTACT SOLUTIONS — TECHNICAL SYSTEM DOCUMENTATION & ARCHITECTURE

**Confidential Document | ISO 9001:2015 Approved Seal**

---

# EconoCausal: System Architecture, Technical Documentation & API Reference

**Intern Name:** Vishal Yadav  
**Organization:** Infotact Solutions  
**HR Manager:** Ms. Jyotirmayee Behera  
**Project Classification:** Causal AI Microservice & Enterprise Prescriptive Dashboard  
**Status:** Complete & Production Certified  

---

## 1. High-Level System Architecture

EconoCausal is organized as a decoupled, multi-tier prescriptive analytics platform:

```mermaid
graph TD
    subgraph Data Layer [Module 1: Data Engineering & Observational Generation]
        D1[Synthetic Observational Generator]
        D2[Cleaning & Feature Engineering Pipeline]
        D3[Model-Ready Dataset: 10,000 x 16]
        D4[Isolated Ground Truth: 10,000 x 10]
        D1 --> D2 --> D3
        D1 --> D4
    end

    subgraph Causal ML Layer [Module 2: EconML Double Machine Learning]
        M1[5-Fold Cross-Fitting Partitioning]
        M2[Stage 1 Nuisance: LightGBM Regressor Y|W]
        M3[Stage 1 Nuisance: LightGBM Classifier T|W]
        M4[Neyman Orthogonal Residualizer]
        M5[Stage 2: Linear CATE Estimator tau_i]
        D3 --> M1 --> M2 & M3 --> M4 --> M5
    end

    subgraph Prescriptive Optimization Layer [Module 3: SciPy HiGHS MILP]
        O1[CATE Elasticity Matrix]
        O2[HiGHS Mixed-Integer Linear Program]
        O3[Budget Liability Constraints: Nominal / Redeemed]
        O4[Optimal Allocation Matrix: 10,000 x 3]
        M5 --> O1 --> O2
        O3 --> O2 --> O4
    end

    subgraph Serving & UI Layer [Module 4: FastAPI + React 19 / Vite]
        API[FastAPI Asynchronous Microservice Port 8000]
        UI[React 19 Executive Dashboard Port 5174/5173]
        O4 & M5 --> API
        API <--> UI
    end
```

---

## 2. Mathematical Formulations & Algorithmic Foundations

### 2.1 Double Machine Learning (LinearDML)
Standard single-stage predictive regression models:
$$Y = f(X, T) + \epsilon$$
When $T$ is confounded by $W$, $\hat{f}$ confuses selection bias with causal effect.

EconoCausal uses **Double Machine Learning** (Chernozhukov et al., 2018):
1. **Outcome Model:** $\hat{g}(W) = \mathbb{E}[Y \mid W]$ via LightGBM Regressor.
2. **Propensity Model:** $\hat{m}(W) = \mathbb{E}[T \mid W]$ via LightGBM Classifier.
3. **Orthogonal Residuals:**
   $$\tilde{Y}_i = Y_i - \hat{g}(W_i)$$
   $$\tilde{T}_i = T_i - \hat{m}(W_i)$$
4. **Final CATE Estimator:**
   $$\hat{\theta}(X) = \arg\min_\theta \sum_{i=1}^N \left( \tilde{Y}_i - \theta(X_i) \cdot \tilde{T}_i \right)^2$$
   By Neyman orthogonality, $\frac{\partial}{\partial g} \mathbb{E}[(\tilde{Y} - \theta(X)\tilde{T})^2] = 0$, guaranteeing that errors in nuisance models $\hat{g}$ and $\hat{m}$ do not bias the causal estimate $\hat{\theta}$.

### 2.2 Prescriptive HiGHS Mixed-Integer Linear Program (MILP)
Let $z_{i, k} \in \{0, 1\}$ denote whether customer $i \in \{1, \dots, N\}$ receives discount $k \in \{0, 1, 2\}$:

$$\max_z \sum_{i=1}^N \sum_{k=0}^2 \left( \text{Margin} \cdot \hat{\tau}_{i, k} \cdot \text{Spend}_i - d_k \cdot (\hat{P}_{i, 0} + \hat{\tau}_{i, k}) \right) z_{i, k}$$

**Subject to:**
1. Exactly one discount assigned per customer:
   $$\sum_{k=0}^2 z_{i, k} = 1 \quad \forall i$$
2. Budget capacity constraint:
   $$\sum_{i=1}^N \sum_{k=1}^2 d_k \cdot z_{i, k} \le B$$

Solved using `scipy.optimize.milp` with the HiGHS C++ dual simplex solver in $< 1.85$s.

---

## 3. Microservice API Reference (FastAPI)

Base URL: `http://127.0.0.1:8000`

The EconoCausal backend service exposes 11 production REST endpoints documented below:

| Method | Endpoint | Description | Query / Body Parameters |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Service health, model artifact validation, anti-leakage check | None |
| `GET` | `/api/summary` | Global KPIs (₹3.76L profit, 7.52x RODS, nominal vs redeemed liability) | None |
| `GET` | `/api/recommendations` | Customer allocations with pagination, search, filter, and sort | `page`, `page_size`, `search`, `discount`, `income_tier`, `loyalty`, `sort_by`, `sort_desc` |
| `GET` | `/api/charts` | Aggregations for Plotly: offer distribution, policy comparison, Qini curve | None |
| `POST` | `/api/simulate` | Live re-optimization simulation under custom budget/margin (MILP / Greedy) | `budget`, `budget_type`, `solver`, `margin_ratio` |
| `GET` | `/api/validation` | Covariate balance (Love plot), 5 refutations, Rosenbaum bounds, Cinelli-Hazlett | None |
| `GET` | `/api/causal/dag` | Structural Causal Model DAG nodes, edges, backdoor adjustment set | None |
| `GET` | `/api/drift/status` | Real-time Kolmogorov-Smirnov & PSI covariate drift monitoring | None |
| `GET` | `/api/dataset/sample` | Sample records of observable pricing data (sanitized, zero leakage) | `limit` (default 50) |
| `GET` | `/api/methodology` | Econometric declarations, unconfoundedness assumptions, definitions | None |
| `GET` | `/api/report/export` | Executive audit report markdown and structured JSON summary | None |

### 3.1 `GET /api/summary`
Returns cached cohort overview metrics, baseline comparisons, and policy KPIs.

**Response Schema (`200 OK`):**
```json
{
  "cohort_size": 10000,
  "active_policy": {
    "policy_name": "DML CATE HiGHS Optimization",
    "total_budget": 50000.0,
    "allocated_budget": 50000.0,
    "budget_utilization_pct": 100.0,
    "total_discounted_customers": 4568,
    "selected_pct": 45.68,
    "nominal_coupon_liability": 50000.0,
    "expected_redeemed_cost": 28511.16,
    "estimated_incremental_purchases": 829.9,
    "estimated_incremental_profit": 376115.07,
    "return_on_discount_spend": 7.52
  },
  "baseline_policies": [
    { "policy_name": "Zero Discounts", "incremental_profit": 0.0, "roas": 0.0 },
    { "policy_name": "Random Allocation", "incremental_profit": 235022.35, "roas": 4.70 },
    { "policy_name": "Highest Cart Value", "incremental_profit": 361734.50, "roas": 7.23 },
    { "policy_name": "Sequential Uniform", "incremental_profit": 234914.09, "roas": 4.70 }
  ]
}
```

### 3.2 `POST /api/simulate`
Simulates a custom budget policy with arbitrary budget caps, liability modes, and solvers.

**Request Schema:**
```json
{
  "budget": 75000.0,
  "budget_type": "allocated",
  "solver": "milp",
  "margin_ratio": 0.30
}
```

### 3.3 `GET /api/validation`
Returns formal econometric audit certifications, PSM balance, 5 refutations, and sensitivity analyses.

**Response Schema Highlights (`200 OK`):**
```json
{
  "status": "PASS",
  "robustness_score": 100.0,
  "arm_10": {
    "psm_match_rate": 0.9587,
    "matched_pairs": 2273,
    "max_matched_smd": 0.0181,
    "refutations": [
      { "test_name": "Placebo Treatment Test", "verdict": "PASS", "p_value": 0.4851 },
      { "test_name": "Random Common Cause Refutation", "verdict": "PASS", "relative_drift": 0.0016 },
      { "test_name": "Data Subset Removal Refutation", "verdict": "PASS", "relative_drift": 0.0003 },
      { "test_name": "Positivity Overlap Trimming Sensitivity", "verdict": "PASS", "relative_drift": 0.0017 },
      { "test_name": "Model-Based Residual Permutation Diagnostic", "verdict": "PASS", "p_value": 0.0020 }
    ],
    "rosenbaum_bounds": { "critical_gamma": 1.7, "discordant_pairs": 1169 },
    "cinelli_hazlett": { "rv_q1": 0.1242, "rv_alpha": 0.1047 }
  }
}
```

---

## 4. Repository Structure & Module Breakdown

```text
EconoCausal/
├── 01_Dataset_Analysis/         # Data ingestion, synthetic generation, cleaning, & EDA
│   ├── generate_synthetic_data.py # Observational data generator with controlled confounding
│   ├── data_cleaning.py         # Outlier treatment, type validation & partitioning
│   ├── eda.py                   # Causal EDA & propensity overlap checks
│   ├── synthetic_pricing_data.csv # Raw 10,000 customer sessions
│   ├── cleaned_pricing_data.csv # Model-ready partitioned dataset
│   └── ground_truth_eval.csv    # Isolated counterfactual evaluation benchmarks
├── 02_Causal_ML/                # Double Machine Learning CATE Engine
│   ├── train_dml.py             # EconML LinearDML pipeline with cross-fitting
│   ├── test_dml.py              # Automated statistical validation unit tests (5 tests: 3 safe + 2 quarantined)
│   └── outputs/                 # Trained models (.joblib) & CATE predictions
├── 03_Backend_Optimization/     # Prescriptive Optimization & Causal Audit
│   ├── optimize_budget.py       # SciPy HiGHS MILP Knapsack solver
│   ├── causal_validation.py     # PSM matching, 5 refutations & sensitivity analysis
│   ├── test_optimizer.py        # Automated test suite for optimization (13 tests)
│   └── test_validation.py       # Automated test suite for PSM & refutations (14 tests)
├── 04_Frontend_Dashboard/       # Interactive Enterprise UI & FastAPI Backend
│   ├── backend/
│   │   ├── app.py               # FastAPI microservice application (11 endpoints)
│   │   └── test_api.py          # API route automated integration tests (34 tests)
│   ├── src/                     # React 19 client components
│   │   ├── App.jsx              # Main workspace router and state management (8 tabs)
│   │   ├── App.css              # Curated design system & theme tokens
│   │   └── components/PlotlyChart.jsx # Reactive Plotly visualizations
│   ├── dist/                    # Production bundle
│   └── package.json             # Vite build configuration
└── 05_Final_Deliverables/       # Official Infotact Solutions Internship Deliverables
    ├── 01_Project_Report_Infotact.md
    ├── 02_Presentation_Deck_Content.md
    ├── 03_Model_Evaluation_Results.md
    ├── 04_Final_Project_Demonstration_Script.md
    ├── 05_Project_Documentation_and_Architecture.md
    └── audit/                   # Independent audit reports
```

---

## 5. Reproduction & Deployment Guide

### Prerequisites
- Python 3.11+ 64-bit
- Node.js 18+ and npm 9+

### Execution Commands
```powershell
# 1. Install Python dependencies
pip install -r 03_Backend_Optimization/requirements.txt
pip install python-docx python-pptx openpyxl reportlab

# 2. Run automated test suites (Safe Non-Retraining Suite)
# Module 01: Dataset Inspection
python 01_Dataset_Analysis/inspect_dataset.py --path 01_Dataset_Analysis/synthetic_pricing_data.csv

# Module 02: Causal ML (3 safe tests; 2 safely quarantined)
python -m unittest 02_Causal_ML.test_dml.TestDoubleMachineLearning.test_01_missing_file_handling 02_Causal_ML.test_dml.TestDoubleMachineLearning.test_02_anti_leakage_safeguard 02_Causal_ML.test_dml.TestDoubleMachineLearning.test_05_production_artifacts_unmodified

# Module 03: Econometric Validation (14 tests)
python -B -m unittest 03_Backend_Optimization/test_validation.py

# Module 03: Prescriptive Optimization (13 tests)
python -m unittest 03_Backend_Optimization/test_optimizer.py

# Module 04: FastAPI Microservice (34 tests)
python -m unittest 04_Frontend_Dashboard/backend/test_api.py

# 3. Launch FastAPI Microservice (Port 8000)
python -m uvicorn 04_Frontend_Dashboard.backend.app:app --host 127.0.0.1 --port 8000

# 4. Launch React 19 Frontend Dashboard (Port 5173)
cd 04_Frontend_Dashboard
npm install
npm run dev
```

---

**Document Authored By:** Vishal Yadav  
**Organization:** Infotact Solutions (ISO 9001:2015 Approved)
