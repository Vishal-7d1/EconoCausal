# EconoCausal — Comprehensive Test Execution & Reproducibility Report

**Report Version:** 2.1.0 (Level 4 Phase 4.5 Targeted API Contract Repair & Safe Regression Closure)  
**Date of Current Execution:** October 22, 2026  
**Commit Baseline:** `eeb66240ecdb5788e10a53c94fbf3ccd6a7eef8a`  
**Lead Test Engineer / Auditor:** Vishal Yadav (Data Associate L1 Intern, Infotact Solutions)  
**Project Domain:** Causal Machine Learning, Double Machine Learning (DML), MILP Optimization & Full-Stack System  
**Test Suite Coverage:** Unit, Integration, Econometric Diagnostics, Mathematical Optimality, Security, Frontend Build  
**Current Phase 4.5 Verdict:** `VERIFIED PASS — API CONTRACT REPAIRED & SAFE REGRESSION CLOSED (34/34 API TESTS PASS, DML SAFELY ISOLATED)`

---

## 1. Executive Test Summary

All automated test suites across the EconoCausal project were reviewed and executed against commit `eeb66240ecdb5788e10a53c94fbf3ccd6a7eef8a` in the native Windows 11 / Python 3.11 environment. 

### Current Level 4 Phase 4.5 Execution Scorecard (October 22, 2026)

> [!NOTE]
> **Test Count Accounting Clarification:** The Phase 4.5 scorecard reflects **64 distinct test cases**, **65 total test executions**, **65 passing executions**, and **2 safety-blocked DML test cases**. Specifically, targeted API test `test_13_validation_endpoint` was run separately first to isolate and verify the contract fix (1 test execution), and was subsequently executed again as part of the 34-test full API suite `test_api.py` for comprehensive regression verification (34 test executions). Together with 3 safe DML tests, 14 econometric validation tests, and 13 MILP optimization tests, this yields $1 + 34 + 3 + 14 + 13 = 65$ total test executions across 64 distinct automated test cases (all 65 passing).

| Module & Test Suite | Test Type | Exact Command | Exit Code | Tests | Pass | Fail | Skip / Blocked | Status / Safety Classification | Duration | Notes / Evidence |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **04. Backend REST API (Targeted)** | Validation Endpoint Contract | `python -m unittest 04_Frontend_Dashboard.backend.test_api.TestDashboardAPI.test_13_validation_endpoint` | `0` | 1 | 1 | 0 | 0 | `VERIFIED PASS` | 0.028s | Targeted repair verified: asserts 5 refutations, 5 diagnostic types, and status='PASS'. Executed separately first. |
| **04. Backend REST API (Full Suite)** | Endpoints, CORS & Safeguards | `python -m unittest 04_Frontend_Dashboard/backend/test_api.py` | `0` | 34 | 34 | 0 | 0 | `VERIFIED PASS` | 59.87s | Full API suite cleanly passes with 0 regressions; re-executes test_13 as part of full suite. |
| **02. Causal ML (Safe Subset)** | Anti-leakage, CLI & Artifacts | `python -m unittest 02_Causal_ML.test_dml.TestDoubleMachineLearning.test_01_missing_file_handling 02_Causal_ML.test_dml.TestDoubleMachineLearning.test_02_anti_leakage_safeguard 02_Causal_ML.test_dml.TestDoubleMachineLearning.test_05_production_artifacts_unmodified` | `0` | 3 | 3 | 0 | 0 | `VERIFIED PASS` | 12.39s | Demonstrably safe, non-retraining, and ground-truth-free tests pass cleanly. |
| **02. Causal ML (Unsafe Tests)** | Retraining & Ground Truth Eval | `python -m unittest 02_Causal_ML.test_dml.TestDoubleMachineLearning.test_03_dml_training_and_artifacts 02_Causal_ML.test_dml.TestDoubleMachineLearning.test_04_causal_forest_dml_execution` | — | 2 | 0 | 0 | 2 | `BLOCKED_BY_SAFETY_CONSTRAINT` | — | Withheld: tests invoke `train_dml.py --eval-data ground_truth_eval.csv`, violating isolation rules. |
| **03. Econometric Validation** | PSM, Balance & Refutations | `python -B -m unittest 03_Backend_Optimization/test_validation.py` | `0` | 14 | 14 | 0 | 0 | `VERIFIED PASS` | 11.55s | All 14 tests pass, including Rosenbaum test_14 exact binomial parity. Bytecode untouched (-B flag). |
| **03. MILP Optimization** | Deterministic & Edge Cases | `python -m unittest 03_Backend_Optimization/test_optimizer.py` | `0` | 13 | 13 | 0 | 0 | `VERIFIED PASS` | 22.43s | All 13 tests pass, including test_13 solver fallback attribution. |
| **PHASE 4.5 VERIFIED TOTALS** | **Executable Safe Test Suite** | *Executed via Python 3.11 unittest* | **`0`** | **64 distinct (65 runs)** | **65** | **0** | **2 (Blocked)** | **`106.27s`** | **`64 DISTINCT TEST CASES, 65 EXECUTIONS, 65 PASSING, 2 BLOCKED`** |

---

### Historical Phase 4.4 Execution Scorecard (October 22, 2026)

| Module & Test Suite | Test Type | Exact Command | Exit Code | Tests | Pass | Fail | Status / Safety Classification | Duration | Notes / Root Cause |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **03. Econometric Validation** | PSM, Balance & Refutations | `python -m unittest "03_Backend_Optimization/test_validation.py"` | `0` | 14 | 14 | 0 | `VERIFIED PASS` | 11.46s | All 14 tests pass, including Rosenbaum test_14 exact binomial parity. |
| **03. MILP Optimization** | Deterministic & Edge Cases | `python -m unittest "03_Backend_Optimization/test_optimizer.py"` | `0` | 13 | 13 | 0 | `VERIFIED PASS` | 22.83s | All 13 tests pass, including test_13 solver fallback attribution. |
| **02. Causal ML** | DML Pipeline & PEHE | `python -m unittest "02_Causal_ML/test_dml.py"` | — | 5 | 0 | 0 | `NOT RUN — SAFETY BLOCKER` | — | Blocked: `test_03` and `test_04` load quarantined `ground_truth_eval.csv` and retrain DML models. |
| **04. Backend REST API** | Endpoints, CORS & Safeguards | `python -m unittest "04_Frontend_Dashboard/backend/test_api.py"` | `1` | 34 | 33 | 1 | `REGRESSION IDENTIFIED` | 57.20s | 33/34 passed. 1 failure in `test_13`: asserts 4 refutations, but Phase 4.2 expanded suite to 5 (`5 != 4`). |

---

### Historical Baseline Execution Scorecard (Level 1–3 Initial Submission)

| Module & Test Suite | Test Type | Exact Command | Exit Code | Tests | Pass | Fail | Skip | Duration | Status |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **01. Dataset & EDA** | Integrity & Leakage | `python "01_Dataset_Analysis/inspect_dataset.py" --path "01_Dataset_Analysis/synthetic_pricing_data.csv"` | `0` | 1 | 1 | 0 | 0 | 3.8s | `VERIFIED PASS (Historical)` |
| **02. Causal ML** | DML Pipeline & PEHE | `python -m unittest "02_Causal_ML/test_dml.py"` | `0` | 4 | 4 | 0 | 0 | 46.0s | `VERIFIED PASS (Historical)` |
| **03. Econometric Validation** | PSM, Balance & Refutations | `python -m unittest "03_Backend_Optimization/test_validation.py"` | `0` | 5 | 5 | 0 | 0 | 7.0s | `VERIFIED PASS (Historical)` |
| **03. MILP Optimization** | Deterministic & Edge Cases | `python -m unittest "03_Backend_Optimization/test_optimizer.py"` | `0` | 12 | 12 | 0 | 0 | 26.3s | `VERIFIED PASS (Historical)` |
| **04. Backend REST API** | Endpoints, CORS & Safeguards | `python -m unittest "04_Frontend_Dashboard/backend/test_api.py"` | `0` | 17 | 17 | 0 | 0 | 7.0s | `VERIFIED PASS (Historical)` |
| **04. Frontend Linter** | Oxlint Code Quality | `npm run lint` (in `04_Frontend_Dashboard/`) | `0` | 4 files | 4 | 0 | 0 | 0.2s | `VERIFIED PASS (Historical)` |
| **04. Frontend Production Build** | Vite Production Bundle | `npm run build` (in `04_Frontend_Dashboard/`) | `0` | 19 modules | 19 | 0 | 0 | 0.5s | `VERIFIED PASS (Historical)` |
| **HISTORICAL TOTALS** | **End-to-End Test Suite** | *7 Automated Execution Stages* | **`0`** | **43** | **43** | **0** | **0** | **~90.8s** | **`VERIFIED PASS (Historical)`** |

---

## 2. Test Execution Details by Module

### 2.1 Module 01: Dataset Inspection & Anti-Leakage Audit
- **Command:** `python "01_Dataset_Analysis/inspect_dataset.py" --path "01_Dataset_Analysis/synthetic_pricing_data.csv"`
- **Result:** `EXIT 0` (Execution Time: 3.84s)
- **Verified Assertions:**
  * Clean schema: 10,000 rows, 22 columns, 0 missing values, 0 duplicate customer IDs.
  * Correct identification of primary key `customer_id`.
  * Candidate identification of treatment arm `discount_inr` (levels: ₹0, ₹10, ₹20).
  * Strict separation: Pretreatment confounders $W$ vs. post-treatment features vs. potential outcome fields.

### 2.2 Module 02: Double Machine Learning (DML) Pipeline
- **Command:** `python -m unittest "02_Causal_ML/test_dml.py"`
- **Result:** `EXIT 0` (Execution Time: 46.03s)
- **Passed Tests:**
  1. `test_01_missing_file_handling`: Ensures exit code 1 and descriptive error when data path is missing.
  2. `test_02_anti_leakage_safeguard`: Injects synthetic column `true_leaked_tau` and verifies that execution is immediately halted with error `DATA LEAKAGE DETECTED`.
  3. `test_03_dml_training_and_artifacts`: Fits LinearDML baseline across 3 cross-fitting folds ($K=3$). Asserts:
     * PEHE < 0.05 on both arms (Arm 10: 0.0163, Arm 20: 0.0264).
     * Positive rank correlation (Spearman $\rho = 0.428$ for ₹10; $\rho = 0.584$ for ₹20).
     * ATE bias < 3.0 percentage points.
     * Persistence of all 8 artifacts (`dml_model.joblib`, `dml_effect_predictions.csv`, `dml_evaluation_metrics.json`, `dml_evaluation_report.md`, and 4 diagnostic plots).
  4. `test_04_causal_forest_dml_execution`: Validates non-parametric CausalForestDML with 20 trees and 2 cross-fitting folds, verifying discrete treatment support and bounded ATE error.

### 2.3 Module 03: Causal Validation & Falsification Tests
- **Command:** `python -m unittest "03_Backend_Optimization/test_validation.py"`
- **Result:** `EXIT 0` (Execution Time: 7.03s)
- **Passed Tests:**
  1. `test_01_missing_file_handling`: Handles missing dataset gracefully.
  2. `test_02_anti_leakage_safeguard`: Rejects inputs containing `true_*` counterfactuals.
  3. `test_03_psm_and_balance_diagnostics`: Validates that 1:1 Nearest-Neighbor Propensity Score Matching achieves >90% match rate and strictly reduces Standardized Mean Differences ($|SMD| < 0.10$) across all 9 pretreatment covariates (observed maximum matched $|SMD| = 0.0218$).
  4. `test_04_refutation_suite_criteria`: Falsification criteria:
     * Placebo Treatment: Estimated effect collapses to 0.00% ($p = 0.4851 > 0.05$).
     * Random Common Cause: Gaussian confounder noise causes only 0.16% effect drift (< 5.0% threshold).
     * Data Subset Removal: 80% bootstrap sub-sampling exhibits 0.03% effect drift (< 6.0% threshold).
     * Positivity Overlap Trimming: Extreme propensity trimming exhibits 0.17% effect drift (< 8.0% threshold).
  5. `test_05_artifacts_and_schema`: Verifies persistence and non-empty size of Love plot, propensity distributions, markdown report, and JSON summary.

### 2.4 Module 03: MILP Budget Optimization Engine
- **Command:** `python -m unittest "03_Backend_Optimization/test_optimizer.py"`
- **Result:** `EXIT 0` (Execution Time: 26.25s)
- **Passed Tests:**
  1. `test_01_missing_files_handling`: Verifies clean error exit if inputs are absent.
  2. `test_02_anti_leakage_safeguard`: Ensures optimizer cannot run if ground-truth columns are provided as model inputs.
  3. `test_03_zero_budget_boundary`: With budget = ₹0, 100% of customers are allocated to ₹0 (Control), allocated spend = ₹0, incremental profit = ₹0.
  4. `test_04_infinite_budget_boundary`: With unconstrained budget, all customers with $\tau_i > 0$ receive their profit-maximizing discount arm.
  5. `test_05_strictly_satisfies_allocated_budget`: $N=10,000$, Budget ₹50,000 allocated spend = exactly ₹50,000.00 $\le$ ₹50,000.00.
  6. `test_06_strictly_satisfies_redeemed_budget`: In redeemed mode, $\sum_i \sum_a c_{ia} Y_{ia}^* x_{ia} \le B$.
  7. `test_07_no_coupon_liability_leak`: Ensures every customer receives at most one discount arm ($\sum_a x_{ia} \le 1$).
  8. `test_08_outperforms_heuristic_baselines`: Proves DML MILP policy (₹3,76,115.07) strictly outperforms Random policy (₹2,14,350.00) by +75.5% lift.
  9. `test_09_greedy_vs_milp_concordance`: Confirms Greedy Heuristic achieves >85% of MILP objective value while executing in <0.05 seconds.
  10. `test_10_artifacts_persistence`: Confirms generation of `customer_discount_allocations.csv`, `optimization_summary.json`, `optimization_report.md`, and 4 allocation diagnostic charts.
  11. `test_11_deterministic_milp_vs_exhaustive_search`: On a deterministic 4-customer, 3-arm problem (81 combinatorial states), CBC MILP and exhaustive combinatorial search achieve identical optimal allocation and identical maximum profit (₹160.00).
  12. `test_12_solver_negative_budget_and_edge_cases`: Confirms negative budgets raise `ValueError` and solver failure automatically triggers the deterministic greedy fallback.

### 2.5 Module 04: FastAPI Backend REST Service
- **Command:** `python -m unittest "04_Frontend_Dashboard/backend/test_api.py"`
- **Result:** `EXIT 0` (Execution Time: 7.00s)
- **Passed Tests:**
  * 17 distinct automated test cases verifying `/api/health`, `/api/summary`, `/api/recommendations`, `/api/charts`, `/api/simulate`, `/api/validation`, `/api/dataset/sample`, `/api/methodology`, `/api/report/export`, Qini cumulative uplift curve structure, and explicit trusted CORS origins.

### 2.6 Module 04: Frontend Code Quality & Production Build
- **Linter Command:** `npm run lint` (Oxlint 1.81.0 across 4 files, 104 rules)
  * Exit Code: `0` (Execution Time: 0.19s)
  * Errors: 0
  * Warnings: 2 (non-blocking React Compiler informational warnings on effect sync)
- **Production Build Command:** `npm run build` (Vite 8.3.4, Rollup production bundle)
  * Exit Code: `0` (Execution Time: 0.53s)
  * Output Files:
    - `dist/index.html` (1.21 kB)
    - `dist/assets/index-3gRQOGpm.css` (59.81 kB │ gzip: 11.01 kB)
    - `dist/assets/index-B4i8SEmW.js` (295.79 kB │ gzip: 87.07 kB)

### 2.7 Phase 4.4 Fresh Execution Audit Details (October 22, 2026)

1. **`03_Backend_Optimization/test_validation.py`:**
   - **Command:** `python -m unittest 03_Backend_Optimization/test_validation.py`
   - **Result:** `EXIT 0` (14 passed in 11.46s).
   - **Key Assertions:** Verified 1:1 PSM caliper matching rate (>95%), post-match $|SMD| < 0.022$, 5 refutation bounds, overlap trimming invariance, Cinelli-Hazlett sensitivity, and deterministic Rosenbaum continuity correction (`test_14`) with exact binomial parity.

2. **`03_Backend_Optimization/test_optimizer.py`:**
   - **Command:** `python -m unittest 03_Backend_Optimization/test_optimizer.py`
   - **Result:** `EXIT 0` (13 passed in 22.83s).
   - **Key Assertions:** Verified nominal and redeemed budget caps, mutual exclusivity, deterministic small-instance MILP vs exhaustive search parity, negative budget handling, and `test_13` automatic greedy fallback attribution.

3. **`02_Causal_ML/test_dml.py`:**
   - **Status:** `NOT RUN — SAFETY BLOCKER`
   - **Safety Blocker Details:** Tests `test_03` and `test_04` unconditionally invoke `train_dml.py --eval-data ground_truth_eval.csv`, which retrains DML models and loads/evaluates the quarantined ground-truth benchmark dataset `01_Dataset_Analysis/ground_truth_eval.csv`. In accordance with non-negotiable anti-leakage isolation rules, execution of this suite was withheld.

4. **`04_Frontend_Dashboard/backend/test_api.py`:**
   - **Command:** `python -m unittest 04_Frontend_Dashboard/backend/test_api.py`
   - **Result:** `EXIT 1` (33 passed, 1 failed in 57.20s).
   - **Failure Analysis:** `test_13_validation_endpoint` failed with `AssertionError: 5 != 4`.
   - **Root Cause:** In Level 4 Phase 4.2 / 4.2.2, the econometric refutation suite in `causal_validation.py` was expanded from 4 to 5 diagnostics by adding the Model-Based Residual Permutation Diagnostic. When `causal_validation_summary.json` is synchronized with the latest Phase 4.2 code, `len(data["arm_10"]["refutations"])` evaluates to 5. The legacy test assertion in `test_api.py:L256` (`self.assertEqual(len(data["arm_10"]["refutations"]), 4)`) predates Phase 4.2. All other 33 endpoints, simulations, and anti-leakage tests passed.

---

### 2.8 Phase 4.5 Targeted Contract Repair & Safe Regression Details (October 22, 2026)

1. **Targeted Repair of `/api/validation` Contract in `04_Frontend_Dashboard/backend/test_api.py`:**
   - **Target Test:** `test_13_validation_endpoint`
   - **Pre-Repair Defect:** Outdated assertion `self.assertEqual(len(data["arm_10"]["refutations"]), 4)` expecting 4 diagnostics.
   - **Contract Justification:** The Level 4 refutation contract in `causal_validation.py` defines exactly 5 refutations (`Placebo Treatment Test`, `Random Common Cause Refutation`, `Data Subset Removal Refutation`, `Positivity Overlap Trimming Sensitivity`, and `Model-Based Residual Permutation Diagnostic`). The test assertion was updated to explicitly assert `len(refutations) == 5`, verify all 5 named diagnostic types are present, and verify `status == 'PASS'` across all 5 refutations.
   - **Targeted Test Execution Command:** `python -m unittest 04_Frontend_Dashboard.backend.test_api.TestDashboardAPI.test_13_validation_endpoint`
   - **Result:** `EXIT 0` (1 passed in 0.028s).
   - **Execution Accounting Context:** This targeted test was run in isolation to verify the contract repair first, and was subsequently re-executed as part of the 34-test full API suite below.

2. **Full API Suite Regression Verification (`test_api.py`):**
   - **Command:** `python -m unittest 04_Frontend_Dashboard/backend/test_api.py`
   - **Result:** `EXIT 0` (34 passed, 0 failed in 59.87s).
   - **Outcome:** The single regression from Phase 4.4 is completely resolved. All 34 API endpoints, data filtering, in-memory simulations, and anti-leakage safeguards pass (accounting for 35 total API test executions across 34 distinct API test cases).

3. **Safe DML Regression Verification (`02_Causal_ML/test_dml.py`):**
   - **Safe Command:** `python -m unittest 02_Causal_ML.test_dml.TestDoubleMachineLearning.test_01_missing_file_handling 02_Causal_ML.test_dml.TestDoubleMachineLearning.test_02_anti_leakage_safeguard 02_Causal_ML.test_dml.TestDoubleMachineLearning.test_05_production_artifacts_unmodified`
   - **Result:** `EXIT 0` (3 passed in 12.39s).
   - **Safety Boundary & Blocked Tests:** `test_03_dml_training_and_artifacts` and `test_04_causal_forest_dml_execution` remain marked `BLOCKED_BY_SAFETY_CONSTRAINT`. Both tests invoke `train_dml.py --eval-data ground_truth_eval.csv`, which triggers model refitting and loads/evaluates the quarantined ground-truth benchmark file `01_Dataset_Analysis/ground_truth_eval.csv`. The safe subset confirms missing file handling, anti-leakage interception, and production artifact integrity without violating isolation rules.

4. **Module 03 Optimization Suite Verification (`test_optimizer.py`):**
   - **Command:** `python -m unittest 03_Backend_Optimization/test_optimizer.py`
   - **Result:** `EXIT 0` (13 passed in 22.43s).
   - **Outcome:** All 13 optimization tests pass deterministically.

5. **Module 03 Econometric Validation Suite Verification (`test_validation.py`):**
   - **Command:** `python -B -m unittest 03_Backend_Optimization/test_validation.py`
   - **Result:** `EXIT 0` (14 passed in 11.55s).
   - **Outcome:** All 14 tests pass. Executed with `-B` flag to guarantee zero bytecode generation or modification of existing `.pyc` files.

---

### 2.9 Protected Artifact Integrity, Rosenbaum Grid Alignment & Bytecode Audit

1. **Cryptographic Hash Verification (4 Readable Protected Assets):**
   Recomputed via SHA-256 against established baseline hashes:
   - `02_Causal_ML/outputs/dml_model.joblib`:
     * SHA-256: `ddf7ddd89a3c87ca023fadd128ae9fde08ad77125451e20541bd1d6ff2d2bb90` (`MATCH - IMMUTABLE`)
   - `02_Causal_ML/outputs/dml_effect_predictions.csv`:
     * SHA-256: `4e5c9f158da0a4084a54d2b64bba07da93be0fa2d2a054d7decfd11b8c04d4dc` (`MATCH - IMMUTABLE`)
   - `03_Backend_Optimization/outputs/optimal_discount_allocations.csv`:
     * SHA-256: `84f5d48f5914b1e35da4afbe7ec8262952a80e8853aa40a787b8e65d77687114` (`MATCH - IMMUTABLE`)
   - `01_Dataset_Analysis/cleaned_pricing_data.csv`:
     * SHA-256: `423478e73126ebedf49a06d60a1223beb0c39b3d82be7991b5bb16c8fbed809c` (`MATCH - IMMUTABLE`)

2. **Ground-Truth File Quarantine Status:**
   - `01_Dataset_Analysis/ground_truth_eval.csv`: Excluded from inspection, reading, parsing, or hashing in accordance with strict anti-leakage isolation rules. Never accessed or loaded during Phase 4.5.

3. **Bytecode File Audit (`03_Backend_Optimization/__pycache__/test_validation.cpython-311.pyc`):**
   - Length: 40,877 bytes
   - Timestamp: October 22, 2026, 19:04:37 (Pre-existing modification generated during Phase 4.4 test run)
   - Status: Preserved untouched. Not deleted, restored, or overwritten. Distinguished from Phase 4.5 actions.

4. **Rosenbaum Bounds Grid Parity & Critical Threshold Alignment:**
   - Both `causal_validation_summary.json` and `causal_validation_report.md` agree exactly on the 21-point Gamma grid ($\Gamma \in [1.0, 3.0]$ in steps of 0.1).
   - Configured critical grid thresholds:
     * Arm ₹10: $\Gamma^* = 1.7$ (1,169 discordant pairs, first grid point where upper bound $p > 0.05$).
     * Arm ₹20: $\Gamma^* = 2.1$ (1,067 discordant pairs, first grid point where upper bound $p > 0.05$).
   - Scientific Disclosure: Configured grid thresholds are documented as discrete grid boundaries, not continuous mathematical tipping points.

---

## 3. Environment Specifications & Dependencies

### Python Environment
- **Python Version:** 3.11.4 64-bit (`C:\Python311\python.exe`)
- **Key Packages:**
  * `econml`: 0.15.1
  * `scikit-learn`: 1.4.0+
  * `pulp`: 2.8.0 (CBC Solver v2.10.3)
  * `fastapi`: 0.110.0
  * `uvicorn`: 0.28.0
  * `reportlab`: 4.1.0+
  * `python-docx`: 1.1.0+
  * `python-pptx`: 0.6.23+
  * `openpyxl`: 3.1.2+

### Node.js & Frontend Environment
- **Node.js Version:** v22.14.0
- **Package Manager:** npm 10.9.2
- **Bundler:** Vite 8.3.4
- **Framework:** React 19.2.8
- **Plotting Library:** Plotly.js (via CDN in `index.html`)

---

## 4. Known Scope Limitations & Honest Caveats

1. **Synthetic Data Benchmark:** All statistical evaluations and PEHE metrics are derived from a simulated synthetic benchmark ($N=10,000$). In real observational enterprise deployments, ground truth potential outcomes $Y(0)$ and $Y(1)$ are fundamentally unobservable; observational validation must rely on A/B test holdout validation, covariate balance, and refutation tests.
2. **Unconfoundedness Assumption:** While PSM matched $|SMD| < 0.022$ across all 9 observed covariates and refutation tests showed stability, Double Machine Learning relies on the unconfoundedness assumption ($Y(d) \perp T \mid W$). Unobserved confounders not recorded in the data cannot be ruled out purely by statistical tests.
3. **Linear CATE Heterogeneity:** The primary production baseline utilizes `LinearDML`. For non-linear treatment interactions, `CausalForestDML` is supported via `--estimator causal_forest`.
4. **MILP Computational Complexity:** For enterprise datasets with $N > 250,000$, solving a global MILP with CBC can take several minutes; the built-in greedy heuristic ($\mathcal{O}(N \log N)$) is provided for sub-second responses.

---

## 5. Master Reproduction Script

To execute the entire test suite in one sequence from PowerShell:

```powershell
# 1. Dataset Inspection & Integrity Check
python "01_Dataset_Analysis/inspect_dataset.py" --path "01_Dataset_Analysis/synthetic_pricing_data.csv"

# 2. Causal ML DML Suite
python -m unittest "02_Causal_ML/test_dml.py" -v

# 3. Econometric Validation & PSM Suite
python -m unittest "03_Backend_Optimization/test_validation.py" -v

# 4. MILP Budget Optimization Engine Suite
python -m unittest "03_Backend_Optimization/test_optimizer.py" -v

# 5. FastAPI Backend REST Service Suite
python -m unittest "04_Frontend_Dashboard/backend/test_api.py" -v

# 6. Frontend Build Verification
cd 04_Frontend_Dashboard
npm run build
cd ..
```
