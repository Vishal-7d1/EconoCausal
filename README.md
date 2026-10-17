
# EconoCausal: Dynamic Pricing via Double Machine Learning

AI-powered causal inference and dynamic pricing platform using Double Machine Learning (DML) to estimate individual treatment effects (heterogeneous treatment effects) of promotional discounts and optimize discount allocation under marketing budget constraints.

---

## 1. Project Overview & Problem Statement

### Problem Statement
In retail and e-commerce, promotional discounts are frequently assigned based on customer history, loyalty tier, or past spending. This creates severe **confounding bias**:
- High-spending or loyal customers frequently receive higher discounts, creating an observational correlation between discounts and high revenue that is not purely causal.
- Standard machine learning models (e.g., standard regression, gradient boosting) predict outcomes $Y$ given treatment $T$ and features $X$, but confuse correlation with causation. Consequently, standard models recommend discounting loyal shoppers who would have purchased anyway at full price ("deadweight loss").

### Project Objectives
1. **Causal Effect Estimation**: Employ **Double Machine Learning (DML / Chernozhukov et al.)** and Heterogeneous Treatment Effect (HTE / CATE) estimation to isolate the true incremental impact of discounts on conversion, revenue, and contribution margin.
2. **Personalized Treatment Policies**: Predict individual-level price elasticities $\tau_i(X)$ to determine who is truly discount-sensitive.
3. **Constrained Budget Optimization**: Formulate and solve a knapsack/linear programming optimization problem in the backend that maximizes overall revenue/margin under fixed discount budget constraints.
4. **Interactive Dashboard**: Deliver an executive dashboard for business stakeholders to simulate budget scenarios, view uplift distributions, and inspect pricing policies.

---

## 2. Project Architecture & Folder Structure

```text
EconoCausal/
├── 01_Dataset_Analysis/              # Data ingestion, synthetic generation, cleaning, & EDA
│   ├── .gitkeep
│   ├── inspect_dataset.py            # Non-destructive CSV inspection & causal candidate audit
│   ├── generate_synthetic_data.py    # Confounder-controlled synthetic pricing data generator
│   ├── data_cleaning.py              # Data cleaning, feature engineering & anti-leakage partitioner
│   ├── eda.py                        # Causal exploratory data analysis & propensity overlap diagnostics
│   ├── synthetic_pricing_data.csv    # Raw synthetic dataset (10,000 rows x 22 cols)
│   ├── cleaned_pricing_data.csv      # Model-ready dataset (10,000 rows x 16 cols)
│   ├── ground_truth_eval.csv         # Isolated evaluation-only ground-truth benchmarks
│   └── outputs/                      # Generated EDA diagnostic figures & summary report
│       ├── 01_treatment_and_conversion.png
│       ├── 02_confounder_distributions.png
│       ├── 03_propensity_overlap.png
│       ├── 04_subgroup_cate_analysis.png
│       └── eda_summary_report.md
├── 02_Causal_ML/                     # Double Machine Learning (EconML / CATE estimation)
│   ├── train_dml.py                  # DML training, cross-fitting, evaluation & diagnostics
│   ├── test_dml.py                   # Automated validation test suite (unit + statistical tests)
│   └── outputs/                      # Saved DML models, predictions, metrics, and plots
│       ├── dml_model.joblib          # Trained EconML DML estimator
│       ├── dml_effect_predictions.csv# Customer-level CATE estimates (tau_hat_10, tau_hat_20)
│       ├── dml_evaluation_metrics.json# JSON evaluation benchmarks & subgroup metrics
│       ├── dml_evaluation_report.md  # Detailed markdown model report
│       ├── 01_estimated_vs_true_effects.png
│       ├── 02_effect_distributions.png
│       ├── 03_subgroup_cate_benchmark.png
│       └── 04_propensity_support_diagnostics.png
├── 03_Backend_Optimization/          # Prescriptive discount allocation & budget optimization engine
│   ├── optimize_budget.py            # Budget-constrained knapsack & MILP pricing optimizer
│   ├── test_optimizer.py             # Automated unit & statistical test suite (10 tests)
│   └── outputs/                      # Saved allocation policies, metrics, and plots
│       ├── optimal_discount_allocations.csv # Customer-level discount recommendations
│       ├── optimization_summary.json # Quantitative performance & baseline comparisons
│       ├── optimization_report.md    # Detailed executive markdown report
│       ├── 01_budget_allocation_distribution.png
│       ├── 02_policy_comparison.png
│       └── 03_incremental_conversions_by_segment.png
├── 04_Frontend_Dashboard/            # Executive decision dashboard (HTML, CSS, JS)
│   └── index.html
└── README.md                         # Central project documentation
```

---

## 3. Technology Stack

- **Language**: Python 3.11.4
- **Core Data Processing**: `pandas` (v2.3.3), `numpy` (v2.4.6)
- **Machine Learning & Propensity**: `scikit-learn` (v1.8.0), `lightgbm` (v4.7.0)
- **Causal Inference**: `econml` (v0.17.0)
- **Scientific Computing & Statistics**: `scipy` (v1.17.0)
- **Artifact Serialization**: `joblib` (v1.5.3)
- **Visualization**: `matplotlib` (v3.10.8)
- **Environment**: Windows (PowerShell)
- **Planned Optimization Engine**: `scipy.optimize` (Module 3)
- **Planned Backend & API**: `fastapi`, `uvicorn`
- **Planned Frontend**: Vanilla HTML5, Vanilla CSS3 (custom design system), JavaScript

---

## 4. Dataset Sources & Acquisition Instructions

The project evaluates both domain-specific synthetic pricing environments and public benchmarks.

### Synthetic E-Commerce Pricing Environment (Active Ground Truth)
- **Generator**: `01_Dataset_Analysis/generate_synthetic_data.py`
- **Purpose**: Generates a mathematically controlled e-commerce dataset with known individual treatment effects (CATE / $\tau_i$), realistic customer covariates, and intentional confounding bias (marketers preferentially discounting dormant users, high-cart-value shoppers, and loyalty members).
- **Evaluation Safety**: Counterfactual potential outcomes $Y(0)$, $Y(10)$, $Y(20)$ and true $\tau_i$ are explicitly generated for benchmarking and isolated from model training.

### Public Benchmark Datasets (Optional Real-World Extensions)
1. **Criteo Uplift Prediction Dataset**:
   - Source: [Criteo AI Lab](https://ailab.criteo.com/criteo-uplift-prediction-dataset/)
   - *Domain Caveat*: Captures advertising impressions, not monetary price discounts.
2. **UCI Online Retail Dataset**:
   - Source: [UCI Machine Learning Repository](https://archive.ics.uci.edu/dataset/352/online%2Bretail)
   - *Domain Caveat*: Transactional invoice data requiring basket aggregation and price confounding adjustment.

---

## 5. Dataset Schema & Column Definitions

The project enforces strict separation between observable model features and evaluation-only ground truth:

### A. Pretreatment Covariates ($X$) — Observable
| Column Name | Type | Description |
| :--- | :--- | :--- |
| `customer_id` | String | Unique identifier (e.g. `CUST_000001`). Excluded from model features. |
| `age` | Integer | Customer age in years (range: 18 - 72). |
| `monthly_income_inr`| Float | Monthly income in ₹ (median ~₹48,000, log-normal). |
| `web_visits_last_30d`| Integer | Browsing sessions on the platform in past 30 days. |
| `past_purchases_count`| Integer | Historical completed orders. |
| `days_since_last_purchase`| Integer | Recency of last interaction/purchase (in days). |
| `cart_baseline_value_inr` | Float | Value of active basket before any discount applied (₹). |
| `loyalty_member` | Binary (0/1) | Whether customer is enrolled in loyalty rewards. |
| `device_type` | Categorical | Browsing device (`Mobile`, `Desktop`, `Tablet`). |
| `device_Mobile` | Binary (0/1) | One-hot encoded dummy for Mobile. |
| `device_Tablet` | Binary (0/1) | One-hot encoded dummy for Tablet. |

### B. Treatment Assignment ($T$) — Observable
| Column Name | Type | Description |
| :--- | :--- | :--- |
| `discount_inr` | Integer | Assigned promotional discount: ₹0 (Control), ₹10, or ₹20. |
| `treatment_binary` | Binary (0/1) | 0 if control (₹0), 1 if treated (₹10 or ₹20 discount). |
| `discount_depth_ratio`| Float | Discount amount divided by baseline cart value $[0.0, 1.0]$. |

### C. Observed Realized Outcome ($Y$) — Observable
| Column Name | Type | Description |
| :--- | :--- | :--- |
| `observed_purchase` | Binary (0/1) | Whether the customer converted under assigned discount $T$. |
| `observed_revenue_inr`| Float | Realized net revenue: $(\text{cart} - \text{discount}) \times \text{purchase}$ in ₹. |

### D. Ground-Truth Benchmarks (Evaluation Only — Isolated in `ground_truth_eval.csv`)
| Column Name | Type | Description |
| :--- | :--- | :--- |
| `true_prob_purchase_control_y0` | Float | Counterfactual conversion probability under control $P(Y(0)=1)$. |
| `true_prob_purchase_discount_y10` | Float | Counterfactual conversion probability under ₹10 discount $P(Y(10)=1)$. |
| `true_prob_purchase_discount_y20` | Float | Counterfactual conversion probability under ₹20 discount $P(Y(20)=1)$. |
| `true_tau_prob_y10` | Float | Ground-truth CATE for ₹10 discount: $\tau_i(10) = P(Y(10)=1) - P(Y(0)=1)$. |
| `true_tau_prob_y20` | Float | Ground-truth CATE for ₹20 discount: $\tau_i(20) = P(Y(20)=1) - P(Y(0)=1)$. |
| `true_assigned_tau` | Float | Realized CATE corresponding to assigned treatment arm $T_i$. |
| `true_potential_outcome_y0` | Binary | Realized binary counterfactual outcome under ₹0 discount $Y_i(0)$. |
| `true_potential_outcome_y10` | Binary | Realized binary counterfactual outcome under ₹10 discount $Y_i(10)$. |
| `true_potential_outcome_y20` | Binary | Realized binary counterfactual outcome under ₹20 discount $Y_i(20)$. |

---

## 6. Data Processing Workflow

1. **Step 1: Dataset Inspection & Health Audit** (`inspect_dataset.py`) — **[COMPLETED]**
   - Non-destructive inspection of shape, types, missing values, duplicates, and causal candidate screening.
2. **Step 2: Synthetic Benchmark Generation** (`generate_synthetic_data.py`) — **[COMPLETED]**
   - Reproducible generation ($N=10,000$, seed=42) with customer features, selection bias, potential outcomes, and ground truth $\tau_i$.
3. **Step 3: Data Cleaning & Anti-Leakage Partitioning** (`data_cleaning.py`) — **[COMPLETED]**
   - Imputation, boundary validation, feature engineering (discount ratios, one-hot encoding), and isolation of `ground_truth_eval.csv`.
4. **Step 4: Exploratory Data Analysis & Confounder Analysis** (`eda.py`) — **[COMPLETED]**
   - Multiclass propensity score estimation ($P(T=k \mid X)$), common support/overlap verification, selection bias decomposition, and subgroup price elasticity profiling.
5. **Step 5: Double Machine Learning Modeling** (`02_Causal_ML/`) — **[COMPLETED & TESTED]**
   - Flexible nuisance models (LightGBM Regressor for outcome expectation $\mathbb{E}[Y \mid X]$, LightGBM Classifier for multiclass propensity $P(T=k \mid X)$).
   - $K$-fold cross-fitting (default $K=5$) for Neyman orthogonality and out-of-fold residualization ($\tilde{Y}, \tilde{T}$).
   - Estimation of heterogeneous treatment effects (CATE / $\tau_i$) for ₹10 vs ₹0 and ₹20 vs ₹0 using EconML (`LinearDML` baseline, `CausalForestDML`).
   - Ground-truth counterfactual evaluation (PEHE, MAE, Pearson $r$, Spearman $\rho$, subgroup calibration) and multiclass positivity/overlap diagnostics.
6. **Step 6: Prescriptive Optimization Engine** (`03_Backend_Optimization/`) — **[COMPLETED & TESTED]**
   - Formulates Multiple-Choice Knapsack problem allocating ₹0, ₹10, and ₹20 offers under configurable budget constraint $B$.
   - Solved with exact Mixed-Integer Linear Programming (`scipy.optimize.milp` / HiGHS) and Greedy Marginal Return on Spend heuristic.
   - Maximizes Expected Incremental Profit ($\Delta \Pi = \tau_i(d) \cdot (m \cdot \text{cart}_i - d) - p_{0, i} \cdot d$), explicitly accounting for product contribution margin ($m=30\%$) and penalizing deadweight loss / cannibalization ($p_{0, i} \cdot d$).
   - Enforces mutual exclusivity ($w_{i, 10} + w_{i, 20} \le 1$, zero duplicate offers) and eligibility rules.
   - Benchmarked against industry baselines: Random Allocation, Highest Cart Value heuristic, and Uniform flat discounting.
7. **Step 7: Interactive Decision Dashboard** (`04_Frontend_Dashboard/`) — **[COMPLETED & TESTED]**
   - Executive decision dashboard for business stakeholders built with React 19, Plotly.js, Vanilla CSS, and a FastAPI backend service.
   - **Premium Dual-Theme Architecture**: Seamless toggle between Obsidian Dark Mode (`#0B0F19`) and Off-White Slate Light Mode (`#F8FAFC`) with dynamic Plotly chart re-theming, CSS token transitions, and `localStorage` persistence.
   - Dynamic budget simulation controls (budget slider, margin ratio, liability mode, solver engine) with real-time optimization.
   - High-density KPI cards: cohort size, total budget, allocated spend, nominal coupon liability, expected redeemed discount cost, incremental conversions, incremental profit, and RODS.
   - Interactive Plotly visualizations for offer distribution, benchmark policy comparisons, income tier targeting rates, and loyalty member elasticity.
   - Searchable, sortable, and filterable customer-level recommendations table with pagination and strict anti-leakage protection.

---

## 7. Files Created & Responsibilities

| File Path | Status | Responsibility |
| :--- | :--- | :--- |
| `01_Dataset_Analysis/inspect_dataset.py` | Completed & Tested | Standalone CLI script for non-destructive CSV inspection, data quality audit, and causal candidate screening. |
| `01_Dataset_Analysis/generate_synthetic_data.py` | Completed & Tested | Generates reproducible synthetic e-commerce pricing data with controlled confounding and ground-truth $\tau_i$. |
| `01_Dataset_Analysis/data_cleaning.py` | Completed & Tested | Cleans raw data, engineers causal features, and isolates ground-truth columns to prevent model leakage. |
| `01_Dataset_Analysis/eda.py` | Completed & Tested | Causal exploratory data analysis, multiclass propensity modeling, common support diagnostics, and subgroup profiling. |
| `01_Dataset_Analysis/synthetic_pricing_data.csv` | Generated | Raw synthetic e-commerce dataset (10,000 rows x 22 columns). |
| `01_Dataset_Analysis/cleaned_pricing_data.csv` | Generated | Model-ready training dataset with observable $X, T, Y$ (10,000 rows x 16 columns). |
| `01_Dataset_Analysis/ground_truth_eval.csv` | Generated | Evaluation benchmarks with customer IDs and true counterfactuals (10,000 rows x 10 columns). |
| `01_Dataset_Analysis/outputs/` | Generated Artifacts | Diagnostic charts (`01_treatment_and_conversion.png`, `02_confounder_distributions.png`, `03_propensity_overlap.png`, `04_subgroup_cate_analysis.png`) and comprehensive `eda_summary_report.md`. |
| `02_Causal_ML/train_dml.py` | Completed & Tested | Double Machine Learning training pipeline using EconML (`LinearDML`, `CausalForestDML`), cross-fitting, nuisance models, CATE predictions, and diagnostics. |
| `02_Causal_ML/test_dml.py` | Completed & Tested | Automated test suite validating missing file handling, anti-leakage protection, LinearDML statistical accuracy, and CausalForest execution. |
| `02_Causal_ML/outputs/` | Generated Artifacts | Trained model (`dml_model.joblib`), customer CATEs (`dml_effect_predictions.csv`), metrics (`dml_evaluation_metrics.json`), markdown report (`dml_evaluation_report.md`), and 4 diagnostic figures (`01_estimated_vs_true_effects.png`, `02_effect_distributions.png`, `03_subgroup_cate_benchmark.png`, `04_propensity_support_diagnostics.png`). |
| `03_Backend_Optimization/optimize_budget.py` | Completed & Tested | Prescriptive pricing optimizer allocating ₹0, ₹10, ₹20 discounts under budget via MILP (HiGHS) and Greedy heuristics with baseline simulations. |
| `03_Backend_Optimization/test_optimizer.py` | Completed & Tested | Automated test suite verifying budget constraints, anti-leakage guards, invalid inputs, monotonicity, baseline superiority, and solver parity (10 tests). |
| `03_Backend_Optimization/outputs/` | Generated Artifacts | Customer recommendations (`optimal_discount_allocations.csv`), summary metrics (`optimization_summary.json`), markdown report (`optimization_report.md`), and 3 diagnostic figures (`01_budget_allocation_distribution.png`, `02_policy_comparison.png`, `03_incremental_conversions_by_segment.png`). |
| `04_Frontend_Dashboard/backend/app.py` | Completed & Tested | FastAPI backend service exposing `/api/health`, `/api/summary`, `/api/recommendations`, `/api/charts`, `/api/simulate`, and `/api/methodology`. |
| `04_Frontend_Dashboard/backend/test_api.py` | Completed & Tested | Automated test suite verifying API responses, pagination, filtering, sorting, live simulation, and anti-leakage guards (12 tests). |
| `04_Frontend_Dashboard/src/App.jsx` | Completed & Tested | React 19 interactive frontend dashboard with KPI cards, simulation panel, Plotly charts, and customer recommendations table. |
| `04_Frontend_Dashboard/src/components/PlotlyChart.jsx` | Completed & Tested | Responsive Plotly.js wrapper component supporting dark-theme financial styling and auto-resize. |
| `04_Frontend_Dashboard/src/App.css` | Completed & Tested | Modern vanilla CSS component styles for cards, simulation controls, tables, badges, and modals. |
| `04_Frontend_Dashboard/src/index.css` | Completed & Tested | Core design token system, dark-mode palettes, and typography tokens. |
| `README.md` | Active / Updated | Central single-source-of-truth project documentation. |

---

## 8. Installation Instructions

```powershell
# Verify Python version (Requires 3.11+)
python --version

# Core dependencies (Verified in environment)
pip install pandas numpy scikit-learn matplotlib lightgbm econml scipy joblib
```

---

## 9. Commands to Execute the Code

Run from the project root in Windows PowerShell:

### 1. Generate Synthetic Pricing Dataset
```powershell
python 01_Dataset_Analysis/generate_synthetic_data.py --samples 10000 --seed 42 --output 01_Dataset_Analysis/synthetic_pricing_data.csv
```

### 2. Inspect the Raw Generated Dataset
```powershell
python 01_Dataset_Analysis/inspect_dataset.py --path 01_Dataset_Analysis/synthetic_pricing_data.csv
```

### 3. Clean the Dataset & Partition Evaluation Benchmarks
```powershell
python 01_Dataset_Analysis/data_cleaning.py --input 01_Dataset_Analysis/synthetic_pricing_data.csv --output-cleaned 01_Dataset_Analysis/cleaned_pricing_data.csv --output-eval 01_Dataset_Analysis/ground_truth_eval.csv
```

### 4. Audit the Cleaned Model-Ready Dataset
```powershell
python 01_Dataset_Analysis/inspect_dataset.py --path 01_Dataset_Analysis/cleaned_pricing_data.csv
```

### 5. Run Exploratory Data Analysis & Causal Audit
```powershell
python 01_Dataset_Analysis/eda.py --data 01_Dataset_Analysis/cleaned_pricing_data.csv --eval-data 01_Dataset_Analysis/ground_truth_eval.csv --output-dir 01_Dataset_Analysis/outputs --seed 42
```

### 6. Train Double Machine Learning Baseline Model
```powershell
python 02_Causal_ML/train_dml.py --data 01_Dataset_Analysis/cleaned_pricing_data.csv --eval-data 01_Dataset_Analysis/ground_truth_eval.csv --output-dir 02_Causal_ML/outputs --estimator linear_dml --cv 5 --seed 42
```

### 7. Run Automated DML Test Suite
```powershell
python 02_Causal_ML/test_dml.py
```

### 8. Run Prescriptive Budget Optimization (₹50,000 Budget)
```powershell
python 03_Backend_Optimization/optimize_budget.py --data 01_Dataset_Analysis/cleaned_pricing_data.csv --predictions 02_Causal_ML/outputs/dml_effect_predictions.csv --output-dir 03_Backend_Optimization/outputs --budget 50000 --objective max_profit --margin-ratio 0.30 --solver milp
```

### 9. Run Optimizer Automated Test Suite
```powershell
python 03_Backend_Optimization/test_optimizer.py
```

### 10. Run Dashboard FastAPI Backend Service
```powershell
uvicorn 04_Frontend_Dashboard.backend.app:app --host 127.0.0.1 --port 8000 --reload
```

### 11. Run Backend API Automated Test Suite
```powershell
python 04_Frontend_Dashboard/backend/test_api.py
```

### 12. Run Interactive Frontend Dashboard (Vite Dev Server)
```powershell
npm --prefix 04_Frontend_Dashboard run dev
```

### 13. Build Frontend Production Bundle
```powershell
npm --prefix 04_Frontend_Dashboard run build
```

---

## 10. Expected Outputs & Actual Validation Results

### A. Synthetic Generation Validation (`generate_synthetic_data.py`)
- **Total Generated**: 10,000 observations.
- **Treatment Arm Allocation**:
  - Control (₹0 Discount): 5,478 (54.78%)
  - ₹10 Discount: 2,371 (23.71%)
  - ₹20 Discount: 2,151 (21.51%)
- **Observed Conversion Rates & Revenue**:
  - Control (₹0): Conversion Rate = 41.79% | Mean Realized Revenue = ₹468.38
  - ₹10 Discount: Conversion Rate = 55.84% | Mean Realized Revenue = ₹552.67
  - ₹20 Discount: Conversion Rate = 62.67% | Mean Realized Revenue = ₹686.12
- **Ground-Truth Causal Effects (True ATE)**:
  - True ATE for ₹10 Discount: **+14.52%** percentage points conversion uplift.
  - True ATE for ₹20 Discount: **+22.94%** percentage points conversion uplift.
- **Automated Validation Checks**:
  - Missing Values: 0 (Passed)
  - Potential Outcome Consistency ($Y = Y(T)$): 100% Consistent (Passed)
  - Probability Bounds $[0, 1]$: Passed
  - Monotonicity ($\tau_{20} \ge \tau_{10}$): Passed
  - Non-Negative Revenue: Passed

### B. Data Cleaning & Anti-Leakage Validation (`data_cleaning.py`)
- **Input Dimensions**: 10,000 rows $\times$ 22 columns.
- **Cleaned Model Dimensions**: 10,000 rows $\times$ 16 columns (strictly observable $X, T, Y$).
- **Evaluation Benchmark Table**: 10,000 rows $\times$ 10 columns (isolated `true_*` columns + `customer_id`).
- **Feature Engineering**: Generated `discount_depth_ratio` and one-hot encoded `device_Mobile`, `device_Tablet`.
- **Integrity Scorecard**: 0 duplicate rows, 0 duplicate IDs, 0 missing values, 0 negative values.

### C. Exploratory Data Analysis & Causal Audit (`eda.py`)
- **Observed Conversion vs. Naive Association**:
  - Control (₹0): 41.79% (SE: 0.67%)
  - ₹10 Discount: 55.84% (SE: 1.02%) $\rightarrow$ Naive $\Delta = +14.05\%$
  - ₹20 Discount: 62.67% (SE: 1.04%) $\rightarrow$ Naive $\Delta = +20.88\%$
- **Confounder Profiling**:
  - Mean Income: ₹0 Control = ₹57,685 vs. ₹20 Discount = ₹46,627 (lower income targeted more).
  - Mean Recency: ₹0 Control = 38.3 days vs. ₹10 Discount = 52.8 days (dormant customers targeted to re-engage).
  - Loyalty Membership: ₹0 Control = 21% vs. ₹20 Discount = 27% (loyalty members receive perks).
- **Multiclass Propensity Model ($P(T=k \mid X)$)**:
  - Modeled using Multinomial Logistic Regression (`L-BFGS`) on standardized pretreatment covariates $X$.
  - Control Propensity $P(T=0 \mid X)$: Mean = 0.5478, Range = $[0.0444, 0.9875]$.
  - ₹10 Discount Propensity $P(T=10 \mid X)$: Mean = 0.2371, Range = $[0.0105, 0.6292]$.
  - ₹20 Discount Propensity $P(T=20 \mid X)$: Mean = 0.2151, Range = $[0.0021, 0.5083]$.
  - Positivity Audit: Non-degenerate overlap across all arms; near-zero tail detected for ₹20 arm ($0.0021$) flagged for overlap monitoring in DML.
- **Selection Bias Breakdown (Counterfactual Ground Truth)**:
  - Baseline Control Probability $P(Y(0))$: Control Arm = 41.47% vs. ₹20 Arm = 40.91%.
  - Confirms that treated shoppers had different baseline response rates, proving why naive observational comparisons fail.
- **Price Sensitivity Heterogeneity (Subgroup CATE)**:
  - Low-Income (Q1, mean ₹28k): ₹10 ATE = **+16.65%**, ₹20 ATE = **+26.36%**.
  - High-Income (Q4, mean ₹88k): ₹10 ATE = **+12.79%**, ₹20 ATE = **+20.15%**.
  - Non-Loyalty Members: ₹10 ATE = **+15.30%**, ₹20 ATE = **+24.27%**.
  - Loyalty Club Members: ₹10 ATE = **+12.02%**, ₹20 ATE = **+18.62%**.
  - *Business Conclusion*: Highly loyal and high-income shoppers exhibit deadweight loss (buy anyway with low uplift), while non-loyal and lower-income shoppers are highly discount-sensitive.

### D. Double Machine Learning Baseline Validation (`train_dml.py` & `test_dml.py`)
- **Estimator Architecture**:
  - Baseline Estimator: `LinearDML` (EconML) with Neyman-orthogonal residualization.
  - Outcome Nuisance Model ($\mathbb{E}[Y \mid X]$): LightGBM Regressor (`n_estimators=100`, `learning_rate=0.05`, `max_depth=5`).
  - Treatment Propensity Model ($P(T=k \mid X)$): LightGBM Classifier (`n_estimators=100`, `learning_rate=0.05`, `max_depth=5`).
  - Cross-Fitting: 5-Fold cross-fitting to eliminate regularizer overfitting bias.
  - Feature Matrix $X$: Strictly valid pretreatment covariates (9 features: `age`, `monthly_income_inr`, `web_visits_last_30d`, `past_purchases_count`, `days_since_last_purchase`, `cart_baseline_value_inr`, `loyalty_member`, `device_Mobile`, `device_Tablet`).
  - Anti-Leakage: Strictly excluded `customer_id`, `discount_inr`, `treatment_binary`, `discount_depth_ratio`, `observed_purchase`, `observed_revenue_inr`, and all `true_*` columns.
- **Estimated Effects vs. Ground Truth Benchmark**:
  - **₹10 Discount Arm vs Control (₹0)**:
    - True ATE: **+14.52%** points
    - DML Estimated ATE: **+14.25%** points
    - Absolute ATE Bias: **0.275%** percentage points
    - PEHE (RMSE of CATE $\tau_i$): **3.845%** points ($0.03845$)
    - MAE of CATE: **3.045%** points ($0.03045$)
    - Pearson Correlation ($r$): **0.4493**
    - Spearman Rank Correlation ($\rho$): **0.4514**
  - **₹20 Discount Arm vs Control (₹0)**:
    - True ATE: **+22.94%** points
    - DML Estimated ATE: **+21.13%** points
    - Absolute ATE Bias: **1.812%** percentage points
    - PEHE (RMSE of CATE $\tau_i$): **4.093%** points ($0.04093$)
    - MAE of CATE: **3.284%** points ($0.03284$)
    - Pearson Correlation ($r$): **0.6458**
    - Spearman Rank Correlation ($\rho$): **0.6241**
- **Subgroup CATE Calibration**:
  | Segment Category | Segment | True ATE ₹10 (%) | DML ATE ₹10 (%) | True ATE ₹20 (%) | DML ATE ₹20 (%) |
  | :--- | :--- | :---: | :---: | :---: | :---: |
  | Income Tier | Low (Q1) | +16.65% | +14.73% | +26.36% | +22.40% |
  | Income Tier | Med-Low (Q2) | +14.78% | +14.40% | +23.38% | +21.76% |
  | Income Tier | Med-High (Q3) | +13.86% | +14.27% | +21.86% | +20.90% |
  | Income Tier | High (Q4) | +12.79% | +13.59% | +20.15% | +19.45% |
  | Loyalty Status | Non-Loyal | +15.30% | +14.56% | +24.27% | +23.04% |
  | Loyalty Status | Loyalty Member | +12.02% | +13.23% | +18.62% | +14.95% |
  - *Calibration Takeaway*: Perfectly reproduces the monotonic ordering across income quartiles and loyalty status, confirming reliable personalization rankings for subsequent optimization.
- **Propensity Support & Positivity Diagnostics**:
  - Weak Positivity Cutoff: $P(T=k \mid X) < 0.05$.
  - Flagged Weak Support: 489 observations (4.89%) fall below threshold across all 3 arms.
  - Common Support: Bounded residual variance across cross-fitting folds; positivity holds with empirical common support.
- **Automated Test Suite (`02_Causal_ML/test_dml.py`)**:
  - `test_01_missing_file_handling`: Passed (clean error handling on absent inputs).
  - `test_02_anti_leakage_safeguard`: Passed (actively aborts with code 1 if `true_*` columns present).
  - `test_03_dml_training_and_artifacts`: Passed (LinearDML training, artifact persistence, PEHE < 0.05, ATE error < 3%, rank correlation thresholds).
  - `test_04_causal_forest_dml_execution`: Passed (CausalForestDML multi-arm execution and bounded error).
  - Result: **4 passed in 30.2s (OK)**.

### E. Prescriptive Budget Optimization Validation Results (`optimize_budget.py` & `test_optimizer.py`)
- **Optimization Formulation**:
  - Problem Class: Multiple-Choice Knapsack Problem (MCKP).
  - Primary Objective: Maximize Expected Incremental Profit ($\Delta \Pi_{i, a} = \hat{\tau}_{i, a} \cdot (m \cdot \text{cart}_i - d_a) - \hat{p}_{0, i} \cdot d_a$).
  - Solvers: Exact Mixed-Integer Linear Programming (`scipy.optimize.milp` / HiGHS, 4.08s) and Greedy Marginal Return on Spend heuristic.
  - Decision Variables: Binary $w_{i, 0}, w_{i, 10}, w_{i, 20} \in \{0, 1\}$ with mutual exclusivity $w_{i, 10} + w_{i, 20} \le 1$ (zero duplicate offers).
  - Budget Constraint: Nominal allocated discount liability $\sum (10 \cdot w_{i, 10} + 20 \cdot w_{i, 20}) \le B$.
- **Allocation Performance (₹50,000 Budget Cap)**:
  - Total Campaign Budget: **₹50,000.00**
  - Allocated Discount Spend: **₹50,000.00** (100.0% utilization, ₹0.00 unused)
  - Allocation Breakdown across Cohort (N=10,000):
    - Control (₹0): **5,432 customers** (54.32%)
    - ₹10 Discount: **4,136 customers** (41.36%)
    - ₹20 Discount: **432 customers** (4.32%)
    - Total Targeted: **4,568 customers** (45.68%)
  - Estimated Incremental Purchases: **+829.9 orders** (Average incremental uplift: +18.17 percentage points)
  - Estimated Incremental Revenue: **₹1,320,261.51**
  - Estimated Incremental Profit: **₹376,115.07**
  - Return on Discount Spend (RODS): **7.52x** (₹7.52 net profit earned per ₹1 discount invested)
- **Benchmark Policy Comparison (₹50,000 Budget Cap)**:
  | Allocation Policy | Discount Spend (₹) | Customers Discounted | Incremental Orders | Incremental Profit (₹) | RODS (Profit / Spend) |
  | :--- | :---: | :---: | :---: | :---: | :---: |
  | **DML Causal Optimal Policy** | **₹50,000** | **4,568** | **+829.9** | **₹376,115.07** | **7.52x** |
  | Baseline 1: Random ₹10 Allocation | ₹50,000 | 5,000 | +717.1 | ₹235,022.35 | 4.70x |
  | Baseline 2: Highest Cart Value (₹10) | ₹50,000 | 5,000 | +791.7 | ₹361,734.50 | 7.23x |
  | Baseline 3: Sequential Uniform ₹10 | ₹50,000 | 5,000 | +718.8 | ₹234,914.09 | 4.70x |
  - *Causal Targeting Advantage*: Outperforms Random Allocation by **+₹141,092.72 (+60.0%)** incremental profit and **+112.7 orders**. Outperforms traditional High-Cart heuristics by **+₹14,380.57 (+4.0%)** profit and **+38.2 orders**, effectively eliminating deadweight loss on high-baseline shoppers.
### F. Interactive Frontend Dashboard Validation Results (`04_Frontend_Dashboard/`)
- **Technology Stack**:
  - **Frontend**: React 19, Vite, Plotly.js (`PlotlyChart.jsx`), Vanilla CSS design system (`index.css`, `App.css`).
  - **Backend API**: FastAPI (`backend/app.py`), Uvicorn ASGI server, Pydantic data validation models.
- **REST API Endpoints**:
  - `GET /api/health`: Health status and artifact validation check.
  - `GET /api/summary`: Key metrics, baseline comparisons, and explicit distinction between nominal coupon liability and expected redeemed cost.
  - `GET /api/recommendations`: Paginated (default 25/page), searchable by `customer_id`, sortable across 7 metrics, and filterable by discount (₹0, ₹10, ₹20), demographic income tier (Low, Medium, High), and loyalty status.
  - `GET /api/charts`: Aggregated Plotly data payloads for offer allocation donut chart, benchmark policy comparison bar charts, and segment price elasticity profiles.
  - `POST /api/simulate`: Live simulation endpoint evaluating custom budgets ($B \in [1\text{k}, 500\text{k}]$), margins ($m \in [0.05, 0.90]$), solvers (`milp`, `greedy`), and liability modes (`allocated`, `redeemed`).
  - `GET /api/methodology`: Causal identification assumptions, anti-leakage isolation declarations, and financial liability disclosures.
- **Budget Reporting Separation**:
  - **Nominal Coupon Liability (Face-Value exposure)**: **₹50,000.00**
  - **Expected Redeemed Cost (Probability-weighted)**: **₹28,511.16**
- **Automated Test Suite (`04_Frontend_Dashboard/backend/test_api.py`)**:
  - `test_01_health_endpoint`: Passed
  - `test_02_summary_endpoint`: Passed
  - `test_03_recommendations_pagination`: Passed
  - `test_04_recommendations_search_and_filters`: Passed
  - `test_05_recommendations_sorting`: Passed
  - `test_06_charts_endpoint_data`: Passed
  - `test_07_simulate_endpoint_valid_milp`: Passed
  - `test_08_simulate_endpoint_valid_greedy`: Passed
  - `test_09_simulate_endpoint_invalid_inputs`: Passed
  - `test_10_anti_leakage_safeguard`: Passed
  - `test_11_methodology_endpoint`: Passed
  - `test_12_metrics_consistency_with_source_artifacts`: Passed
  - Result: **12 passed in 8.75s (OK)**.
- **Frontend Production Bundle Build**:
  - Vite v8.3.4 compiled cleanly in 533ms (0 errors, 0 warnings).

---

## 11. Current Implementation Status

- **Step 1 (Dataset Inspection)**: Completed & Verified
- **Step 2 (Synthetic Data Generation)**: Completed & Verified
- **Step 3 (Data Cleaning & Anti-Leakage)**: Completed & Verified
- **Step 4 (Exploratory Data Analysis - EDA)**: Completed & Verified
- **Step 5 (Causal ML Modeling - Double ML)**: Completed & Verified
- **Step 6 (Optimization Engine)**: Completed & Verified
- **Step 7 (Frontend Dashboard)**: Completed & Verified

---

## 12. Completed Tasks & Pending Tasks

### Completed Tasks
- [x] Inspect existing project directory structure and verify environment.
- [x] Implement non-destructive inspection CLI `01_Dataset_Analysis/inspect_dataset.py`.
- [x] Implement synthetic e-commerce pricing generator `01_Dataset_Analysis/generate_synthetic_data.py`.
- [x] Generate 10,000 customer records with ₹0 / ₹10 / ₹20 discount arms, selection bias, and known ground-truth $\tau_i$.
- [x] Implement data cleaning and anti-leakage isolation pipeline `01_Dataset_Analysis/data_cleaning.py`.
- [x] Partition dataset into model-ready `cleaned_pricing_data.csv` and evaluation-only `ground_truth_eval.csv`.
- [x] Implement `01_Dataset_Analysis/eda.py` for confounding analysis, multiclass propensity modeling, and overlap diagnostics.
- [x] Generate and export publication-quality diagnostic plots and `eda_summary_report.md` under `01_Dataset_Analysis/outputs/`.
- [x] Implement Double Machine Learning baseline with EconML `02_Causal_ML/train_dml.py` supporting ₹0, ₹10, and ₹20 arms.
- [x] Build flexible first-stage nuisance models (LightGBM Regressor for outcome expectation $\mathbb{E}[Y \mid X]$, LightGBM Classifier for multiclass propensity $P(T=k \mid X)$).
- [x] Implement $K$-fold cross-fitting residualization ($\tilde{Y}, \tilde{T}$) satisfying Neyman orthogonality.
- [x] Enforce strict anti-leakage guarantees (exclude identifiers, treatment-derived features, outcomes, revenue, and `true_*` columns).
- [x] Evaluate estimated CATE against ground truth (PEHE, MAE, Pearson, Spearman, subgroup CATE calibration).
- [x] Run propensity overlap diagnostics and flag weak-support regions ($P(T < 0.05)$).
- [x] Save all artifacts to `02_Causal_ML/outputs/` (`dml_model.joblib`, predictions CSV, metrics JSON, markdown report, 4 diagnostic figures).
- [x] Implement and verify automated test suite `02_Causal_ML/test_dml.py` (4 tests passing).
- [x] Implement standalone prescriptive budget optimizer `03_Backend_Optimization/optimize_budget.py`.
- [x] Formulate Multiple-Choice Knapsack problem allocating ₹0, ₹10, and ₹20 offers under marketing budget constraint.
- [x] Solve optimization using exact Mixed-Integer Linear Programming (`scipy.optimize.milp` / HiGHS) and Greedy heuristics.
- [x] Account for contribution margin (30%) and penalize cannibalization deadweight loss ($p_{0, i} \cdot d_a$).
- [x] Enforce mutual exclusivity ($w_{10} + w_{20} \le 1$, zero duplicate offers) and eligibility rules.
- [x] Benchmark optimized policy against Random, Highest Cart Value, and Uniform heuristics.
- [x] Export customer recommendations CSV, JSON summary, markdown report, and 3 diagnostic figures to `03_Backend_Optimization/outputs/`.
- [x] Implement and verify automated test suite `03_Backend_Optimization/test_optimizer.py` (10 tests passing).
- [x] Implement interactive executive decision dashboard `04_Frontend_Dashboard/` (React 19, Plotly.js, Vanilla CSS, FastAPI backend).
- [x] Implement FastAPI backend service with strict anti-leakage guards, pagination, search, filters, live simulation, and distinct liability reporting.
- [x] Implement and verify automated test suite `04_Frontend_Dashboard/backend/test_api.py` (12 tests passing).
- [x] Update root `README.md` with complete implementation status, exact numerical validation metrics, and limitations.

### Pending Tasks
- *All four core project modules are fully implemented, independently tested, validated, and documented.*

---

## 13. Known Issues, Assumptions, & Limitations

1. **Estimator Choice & Trade-offs**:
   - `LinearDML` is adopted as the primary baseline estimator due to superior finite-sample efficiency, fast training (3.05s), and reliable rank correlation ($\rho = 0.45$ for ₹10, $\rho = 0.62$ for ₹20).
   - `CausalForestDML` (Generalized Random Forests) is supported as an alternative non-parametric estimator; however, in discrete multi-arm settings where treatment uplift variance is small (~2.6% points in ₹10 arm) relative to Bernoulli outcome noise ($\sigma^2 \approx 0.25$), tree splitting exhibits higher estimation variance.
2. **Identification Assumptions**:
   - **Unconfoundedness (Conditional Exchangeability)**: Assumes all variables simultaneously influencing discount assignment and purchase conversion are captured in pretreatment covariates $X$.
   - **Positivity / Common Support**: Assumes $0 < P(T = t \mid X) < 1$ for all arms. Diagnostic audit flagged 489 observations (4.89%) with propensity $< 0.05$, but residual variance remains bounded across folds.
   - **SUTVA**: Assumes single treatment version and no cross-customer interference (e.g., promo code sharing, stock depletion).
3. **Business Assumptions in Optimization**:
   - **Contribution Margin Ratio**: The source dataset provides cart baseline value but omits COGS / unit cost. A baseline margin ratio of $m = 30\%$ (`--margin-ratio 0.30`) is parameterized to compute contribution margin.
   - **Baseline Conversion Probabilities ($p_{0, i}$)**: DML predictions contain CATE uplifts ($\hat{\tau}$) but not baseline probabilities. A regularized logistic regression was fit exclusively on observable control records ($T=0$) using valid pretreatment covariates to evaluate cannibalization risk without leaking ground-truth counterfactuals.
   - **Budget Liability Interpretation**: Default budget enforces nominal allocated coupon liability ($\sum d_i \le B$). Expected redeemed cost ($\sum d_i \cdot \hat{P}(Y_i=1) \le B$) is also supported.
4. **Methodological Limitations**:
   - **Point Estimate Optimization**: Allocations rely on point estimates $\hat{\tau}_i$ without uncertainty penalization (future extension: robust optimization with confidence bounds).
   - **Discrete Pricing Grid**: Allocation selects among {₹0, ₹10, ₹20}; continuous price functions are not evaluated.
   - **Synthetic vs. Production Readiness**: Evaluated and tested rigorously on synthetic e-commerce data with known ground truth; production deployment requires live A/B experiment validation and propensity logging.

---

## 14. Next Development Steps

1. **Interactive Executive Decision Dashboard (`04_Frontend_Dashboard/`)**:
   - Build a modern, responsive web application interface (HTML5, Vanilla CSS3, JavaScript).
   - Features:
     - Real-time budget simulation slider (₹10,000 to ₹100,000) with dynamic ROI / RODS computation.
     - Uplift and discount allocation breakdown charts across customer segments.
     - Customer inspection table displaying individual features, CATE estimates, and offer recommendations.
     - Policy comparison view comparing Causal DML against naive heuristics.

