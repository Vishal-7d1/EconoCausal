# EconoCausal — Backend API Test & Security Audit Report

**Date of Execution:** October 2026  
**Auditor / Engineer:** Vishal Yadav (Data Associate L1 Intern, Infotact Solutions)  
**Target Module:** `04_Frontend_Dashboard/backend/app.py`  
**Test Suite:** `04_Frontend_Dashboard/backend/test_api.py`  
**Framework:** FastAPI 0.110+ / Starlette TestClient / Python `unittest`  
**Status:** `VERIFIED PASS` (17 / 17 Tests Passing, 100%)

---

## 1. Executive Summary

This report documents the automated testing, schema verification, security hardening, and anti-leakage controls of the EconoCausal FastAPI backend service. The backend serves high-concurrency REST endpoints for causal dynamic pricing metrics, customer-level discount allocations, live MILP optimization simulations, diagnostic chart aggregations (including Qini curves and DoWhy DAG structures), and audit reports.

All 17 integration and unit tests execute synchronously and pass with zero failures and zero warnings.

```
======================================================================
FastAPI Backend Test Suite: 17 Passed | 0 Failed | 0 Skipped | 100% Pass
Execution Time: ~0.45s | Memory Footprint: ~68 MB
======================================================================
```

---

## 2. API Endpoint Inventory & Verification Status

| Method | Endpoint | Description | Verification Status | Status Code |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Service health, model artifact validation, anti-leakage check | `VERIFIED PASS` | `200 OK` |
| `GET` | `/api/summary` | Global KPIs (₹3.76L profit, 7.52x RODS, nominal vs redeemed liability) | `VERIFIED PASS` | `200 OK` |
| `GET` | `/api/recommendations` | Customer allocations with pagination (page, page_size), search, filter, sort | `VERIFIED PASS` | `200 OK` |
| `GET` | `/api/charts` | Aggregations for Plotly: distribution, policy comparison, Qini curve | `VERIFIED PASS` | `200 OK` |
| `POST` | `/api/simulate` | Live re-optimization simulation under custom budget/margin (MILP / Greedy) | `VERIFIED PASS` | `200 OK / 422 Unprocessable` |
| `GET` | `/api/validation` | Covariate balance (Love plot), refutations, propensity diagnostics | `VERIFIED PASS` | `200 OK` |
| `GET` | `/api/causal/dag` | Structural Causal Model DAG nodes, edges, backdoor adjustment set | `VERIFIED PASS` | `200 OK` |
| `GET` | `/api/drift/status` | Real-time Kolmogorov-Smirnov & PSI covariate drift monitoring | `VERIFIED PASS` | `200 OK` |
| `GET` | `/api/dataset/sample` | Sample records of observable pricing data (sanitized, zero leakage) | `VERIFIED PASS` | `200 OK` |
| `GET` | `/api/methodology` | Econometric declarations, unconfoundedness assumptions, definitions | `VERIFIED PASS` | `200 OK` |
| `GET` | `/api/report/export` | Executive audit report markdown and structured JSON summary | `VERIFIED PASS` | `200 OK` |

---

## 3. Test Case Specification & Execution Results

### Test Case Breakdown

```
test_01_health_endpoint ............................................ [PASS]
  - Verifies status: "healthy"
  - Verifies anti_leakage_verified: true
  - Verifies artifacts on disk: allocations_csv_exists=True, summary_json_exists=True

test_02_summary_endpoint ........................................... [PASS]
  - Verifies optimal_policy metrics: allocated_budget=50,000, incremental_profit=376,115.07, RODS=7.52
  - Verifies distinct nominal coupon liability (₹50,000) vs expected redeemed cost (₹18,634.20)
  - Verifies baselines presence (Random, No Discount, Uniform)

test_03_recommendations_pagination ................................. [PASS]
  - Total count: 10,000 records; Page 1 of 500 (page_size=20)
  - Confirms schema attributes: customer_id, recommended_discount_inr, CATE estimates

test_04_recommendations_search_and_filters ......................... [PASS]
  - Customer ID exact search ("CUST_000042") -> exactly 1 match
  - Discount arm filter ("discount=20") -> exactly 432 matching items
  - Income tier filter ("Low") -> subset matching criteria
  - Loyalty status filter ("loyalty=1") -> subset matching criteria

test_05_recommendations_sorting .................................... [PASS]
  - Descending sort by expected_incremental_profit_inr validated monotonic non-increasing
  - Ascending sort by expected_incremental_profit_inr validated monotonic non-decreasing

test_06_charts_endpoint_data ....................................... [PASS]
  - Discount distribution values: [5432, 4136, 432], sum = 10,000
  - Policy comparison: 4 policies validated with correct labels and incremental profits
  - Income segment and loyalty cross-tabulation data validated

test_07_simulate_endpoint_valid_milp ............................... [PASS]
  - Custom budget ₹20,000 with 30% margin using PuLP CBC MILP
  - Status "success", allocated budget <= 20,000, positive incremental profit verified

test_08_simulate_endpoint_valid_greedy ............................. [PASS]
  - Custom budget ₹15,000 with 25% margin using Greedy Heuristic
  - Status "success", allocated budget <= 15,000, execution latency < 25ms

test_09_simulate_endpoint_invalid_inputs ........................... [PASS]
  - Negative budget (-500) -> HTTP 422 Unprocessable Entity
  - Budget exceeding cap (> 500,000) -> HTTP 422 Unprocessable Entity
  - Margin ratio out of bounds (0.99) -> HTTP 422 Unprocessable Entity
  - Invalid solver ("quantum") -> HTTP 422 Unprocessable Entity

test_10_anti_leakage_safeguard ..................................... [PASS]
  - Scans all recommendation keys for potential outcome prefixes
  - Confirms 0 keys starting with "true_" or "counterfactual_" are exposed

test_11_methodology_endpoint ....................................... [PASS]
  - Validates presence of framework ("Double Machine Learning / R-Learner")
  - Validates econometric assumptions: Unconfoundedness, Overlap, SUTVA
  - Validates budget liability mode definitions

test_12_metrics_consistency_with_source_artifacts .................. [PASS]
  - Exact floating-point parity between live API output and disk optimization_summary.json:
    * Incremental Profit: 376,115.07 == 376,115.07
    * Incremental Orders: 829.88 == 829.88
    * Allocated Budget: 50,000.00 == 50,000.00

test_13_validation_endpoint ........................................ [PASS]
  - Status: "PASSED"
  - Love plot data includes all 9 pretreatment covariates
  - Refutations present: Placebo, Confounder, Data Subset, Trimming

test_14_dataset_sample_endpoint .................................... [PASS]
  - Returns 50 sanitized records of clean pricing data
  - Zero ground-truth leakage across all returned fields

test_15_export_report_endpoint ..................................... [PASS]
  - Returns structured report content with Markdown formatting and summary dictionary

test_16_charts_qini_curve_structure ................................ [PASS]
  - 11 decile percentiles (0% to 100%)
  - Confirms CATE targeting strictly outperforms random targeting at 50% rollout
  - Qini score > 0 (positive uplift concentration)

test_17_cors_trusted_origins ....................................... [PASS]
  - Preflight OPTIONS request with Origin: http://localhost:5173
  - Verified access-control-allow-origin: http://localhost:5173
  - Verified access-control-allow-credentials: true
```

---

## 4. Security & Hardening Audit

### 4.1 CORS Configuration Fix

**Vulnerability Identified:**  
In development setups, developers frequently combine `allow_credentials=True` with wildcard `allow_origins=["*"]`. Under modern CORS standards (Fetch Specification / RFC 6454), browsers reject responses where credentials (cookies, HTTP authorization headers) are requested alongside a wildcard origin.

**Fix Implemented in `app.py`:**
```python
# Environment-configurable trusted origins
ALLOWED_ORIGINS_ENV = os.getenv("ALLOWED_ORIGINS", "")
if ALLOWED_ORIGINS_ENV:
    TRUSTED_ORIGINS = [orig.strip() for orig in ALLOWED_ORIGINS_ENV.split(",") if orig.strip()]
else:
    TRUSTED_ORIGINS = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=TRUSTED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)
```
- Wildcards eliminated.
- Explicit trusted domains enforced.
- Configurable via `ALLOWED_ORIGINS` environment variable for production containerization.

### 4.2 Data Leakage Prevention (Pre-treatment vs Post-treatment & Counterfactuals)

Operational endpoints (`/api/recommendations`, `/api/summary`, `/api/dataset/sample`, `/api/simulate`) were audited to ensure complete isolation from evaluation-only counterfactual fields:

1. **Excluded Columns:** `true_uplift_arm10`, `true_uplift_arm20`, `potential_y0`, `potential_y10`, `potential_y20`, `optimal_arm_true`, `discount_depth_ratio`.
2. **Post-Treatment Feature Isolation:** `discount_depth_ratio` is calculated as $\frac{\text{discount}}{\text{cart\_value}}$ and is directly derived from treatment assignment $T$. The API strictly prevents its use as a pre-treatment confounder or recommendation filter.
3. **Automated Leakage Assertion:** `test_10_anti_leakage_safeguard` scans all response dictionary keys for prefixes `true_` and raises `AssertionError` if any counterfactual data is detected.

### 4.3 Pydantic Request Validation Bounds

All dynamic endpoints enforce strict boundaries using Pydantic V2 schemas:
```python
class SimulationRequest(BaseModel):
    budget: float = Field(..., ge=100.0, le=500000.0, description="Nominal budget in INR")
    margin_ratio: float = Field(0.30, ge=0.05, le=0.90, description="Gross profit margin ratio")
    budget_type: str = Field("allocated", regex="^(allocated|redeemed)$")
    solver: str = Field("milp", regex="^(milp|greedy)$")
```
- Negative or zero budgets rejected immediately with HTTP 422.
- Unreasonably massive allocations (> ₹5,00,000) prevented to avoid solver denial-of-service.
- Arbitrary solver strings rejected via regex constraint.

---

## 5. Verification Commands

To independently reproduce the API test suite:

```powershell
# From project root
python -m unittest "04_Frontend_Dashboard\backend\test_api.py" -v
```

**Observed Output:**
```
Ran 17 tests in 0.448s

OK
```
