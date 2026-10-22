# EconoCausal — Executive Frontend Decision Dashboard

**Framework:** React 19.2.8 | **Bundler:** Vite 8.3.4 | **Styling:** Curated Vanilla CSS Design System  
**Backend Microservice:** FastAPI (`http://127.0.0.1:8000`) | **Interactive Charts:** Plotly.js  
**Verification Status:** `PASS WITH LIMITATIONS` (Google Chrome Headless Browser Smoke Tested)

---

## 1. Overview & Architecture

The EconoCausal dashboard is an interactive enterprise web application designed for executive stakeholders, pricing managers, and data science auditors. It bridges Double Machine Learning (DML) causal inference and Mixed-Integer Linear Programming (MILP) budget optimization into a reactive decision interface.

### Key Architecture Components
- **Client Application (`src/App.jsx`):** Single-page application rendering an 8-tab executive workflow, dynamic KPI scorecards, interactive parameter sliders, and high-contrast dual-theme support (Obsidian Dark Mode and Off-White Slate Light Mode).
- **Styling System (`src/App.css` & `src/index.css`):** Custom vanilla CSS with CSS variable design tokens for glassmorphism, responsive data grids, accessible color contrast (WCAG AAA), and smooth theme transitions.
- **Dynamic Charts (`src/components/PlotlyChart.jsx`):** Plotly wrapper reacting dynamically to theme toggles, budget changes, and window resizing.
- **Backend Service (`backend/app.py`):** High-concurrency FastAPI REST service serving 11 endpoints with explicit trusted CORS configuration.

---

## 2. Navigation Tabs & Capabilities

1. **Executive Dashboard (`overview`):** Topline KPIs (Spend, Targeted Customers, Incremental Profit ₹3,76,115.07, RODS 7.52x), offer distribution donut, and policy comparison benchmarks.
2. **Dataset Explorer (`dataset`):** Interactive browser exploration of observable customer profiles with summary distributions and pagination.
3. **CATE Predictor (`cate-prediction`):** Interactive individual customer elasticity scoring and counterfactual uplift estimation.
4. **Causal Uplift & HTE (`insights`):** Visualizations of treatment effect heterogeneity across customer income tiers, baseline cart values, and loyalty segments, featuring cumulative Qini uplift curves.
5. **Budget Simulator (`simulator`):** Interactive budget controls ($B \in [1\text{k}, 500\text{k}]$), contribution margin ($m \in [0.05, 0.90]$), liability mode toggle (Nominal vs. Expected Redeemed), and solver selection (HiGHS MILP vs. Greedy).
6. **Customer Allocations (`recommendations`):** Searchable, sortable, and filterable 10,000-customer recommendation matrix.
7. **Causal Validation & PSM (`validation`):**
   - 1:1 Propensity Score Matching balance Love plot ($|SMD| < 0.022$ across all 9 confounders).
   - 5 Causal Refutation Cards: Placebo ($p=0.4851$), Random Common Cause (0.16% drift), Data Subset (0.03% drift), Positivity Trimming (0.17% drift), and Model-Based Residual Permutation Diagnostic ($p=0.00200 < 0.05$).
   - Sensitivity Analysis: Rosenbaum Sensitivity Bounds ($\Gamma^* = 1.7, 2.1$) and Cinelli & Hazlett (2020) Partial-$R^2$ Robustness Values ($RV_{q=1} = 12.42\%, 17.81\%$).
   - Microsoft DoWhy Directed Acyclic Graph (DAG) Backdoor Criterion proof.
   - Real-time customer covariate drift monitoring (PSI < 0.020).
8. **DML Methodology (`methodology`):** Formal econometric definitions, Neyman orthogonality formulation, SUTVA assumptions, and anti-leakage declarations.

---

## 3. Deep-Linking & Verification URLs

The application supports deterministic deep-linking for automated browser testing:
- Tab navigation: `http://localhost:5173/?tab=<tab_id>` (e.g., `?tab=validation`, `?tab=simulator`, `?tab=insights`).
- Executive Report Modal: `http://localhost:5173/?modal=report` automatically opens the formal audit report dialog.

---

## 4. How to Run Locally

### Prerequisites
- Node.js v18+ (tested on v22.14.0 / v24.15.0)
- Python 3.11+ (for backend)

### Step 1: Start Backend API Service
From the repository root:
```powershell
uvicorn 04_Frontend_Dashboard.backend.app:app --host 127.0.0.1 --port 8000 --reload
```

### Step 2: Start Frontend Development Server
From `04_Frontend_Dashboard/`:
```powershell
npm install
npm run dev
```
The application will launch at `http://localhost:5173`.

### Step 3: Lint and Production Build Verification
```powershell
# Run Oxlint code quality checks (104 rules across 10 files)
npm run lint

# Compile production bundle via Vite & Rollup
npm run build
```

---

## 5. Verified Status & Governance Disclosures

- **Level 6 Browser Verification:** Evaluated via headless Google Chrome (`chrome.exe --headless=new --dump-dom`). All 8 tabs, 5 refutations, sensitivity bounds, and modal dialog were verified in DOM evaluation (`PASS WITH LIMITATIONS`).
- **Native Print / PDF Generation Limitation:** Marked **`NOT VERIFIED`** for native PDF document generation. The header and modal print buttons have `window.print()` attached; however, headless test environments cannot visually complete the OS print dialog, and dedicated `@media print` CSS rules are absent in `App.css`. Users should verify print layout in interactive desktop browsers.
- **Scorecard Certification vs Real-World Approval:** Status badges (`APPROVED`, `Grade A+ Certified`) represent internal algorithmic validation criteria on synthetic benchmark data ($N=10,000$); they do not constitute external regulatory certification or unconditional real-world production approval.
