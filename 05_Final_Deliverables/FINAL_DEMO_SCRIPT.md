# INFOTACT SOLUTIONS — FINAL PROJECT DEMONSTRATION & VIVA WALKTHROUGH SCRIPT

**Confidential Internship Capstone Deliverable | ISO 9001:2015 Approved Seal**

---

# EconoCausal: Step-by-Step Live Project Demonstration & Evaluator Script

- **Presenter / Intern:** Vishal Yadav (Data Associate L1. Intern)  
- **Host Organization:** Infotact Solutions (Electronic City, Bengaluru)  
- **Supervising HR Manager:** Ms. Jyotirmayee Behera  
- **Evaluator Audience:** Assigned Technical Mentor & Evaluation Committee  
- **Total Demo Duration:** 10–12 Minutes  
- **Verification Status:** Validation Passed (Simulated Benchmark) — 100% Quality Gate  

---

## 1. Quick Startup & Environment Setup

Before starting the live demonstration, start both the backend microservice and frontend server in two separate terminals:

```bash
# Terminal 1: Start FastAPI Optimization Backend (Port 8000)
python -m uvicorn 04_Frontend_Dashboard.backend.app:app --host 127.0.0.1 --port 8000

# Terminal 2: Start React 19 + Vite Dashboard (Port 5173 / 5174)
cd 04_Frontend_Dashboard
npm run dev
```

Open Google Chrome or Brave and navigate to: **`http://localhost:5173`** (or `http://localhost:5174`).

---

## 2. Step-by-Step Live Demonstration Walkthrough

### Phase 1: Executive Opening & Problem Statement (0:00 – 1:30)
* **What to Show on Screen:** The dashboard landing page on the **Overview** workspace.
* **Exact Speaking Script:**
  > *"Good morning, respected mentor and evaluation committee. Today, I am demonstrating **EconoCausal**, my internship capstone project at Infotact Solutions.
  > 
  > In retail e-commerce, promotional discounts frequently waste millions in marketing budget. Standard predictive machine learning predicts purchase probabilities and mistakenly gives the biggest discounts to loyal customers who would have purchased anyway at full price. We call this 'deadweight loss'.
  > 
  > EconoCausal solves this by coupling **Double Machine Learning (EconML LinearDML)** with an exact **Mixed-Integer Linear Programming (HiGHS MILP)** optimizer. Under a fixed marketing budget, our system prescriptively allocates coupons only to customers whose purchase behavior is truly discount-elastic."*

---

### Phase 2: Overview Workspace & Financial KPI Scorecard (1:30 – 3:30)
* **What to Show on Screen:** Point your cursor across the top 6 KPI cards on the **Overview** page.
* **Key Numbers to Highlight:**
  1. **Cohort Size:** 10,000 customers analyzed.
  2. **Campaign Budget:** ₹50,000.00 nominal budget cap.
  3. **Allocated Spend:** ₹50,000.00 (100% budget utilization).
  4. **Targeted Customers:** 4,568 targeted (45.68%) | Control Arm: 5,432 (54.32%).
  5. **Incremental Purchases:** +829.88 transactions gained over baseline.
  6. **Incremental Net Profit:** **₹3,76,115.07**.
  7. **ROAS Efficiency:** **7.52x**.
* **Exact Speaking Script:**
  > *"As you can see on the overview scorecard, for our benchmark cohort of 10,000 customers under a ₹50,000 campaign budget:
  > - EconoCausal generates **₹3,76,115.07 in net incremental profit** after deducting all discount costs.
  > - That yields an outstanding **7.52x ROAS**, outperforming standard uniform discounting by **+75.5% (+₹1,61,765.07)**.
  > - Crucially, 5,432 customers (54.32%) receive ₹0 discount. These are organic shoppers who buy regardless of coupons. By leaving them at full price, we completely eliminated deadweight loss."*

---

### Phase 3: Causal Insights & The Qini Curve (3:30 – 5:30)
* **What to Show on Screen:** Click **Causal Insights** in the navigation bar, then click the **Qini & Cumulative Uplift** tab.
* **Visual to Highlight:** The green Causal DML curve versus the grey dashed Random Rollout line.
* **Exact Speaking Script:**
  > *"Here in the Causal Insights workspace, we present the **Qini Curve**, which directly proves that our causal model outperforms a random rollout.
  > 
  > The solid green line ranks customers by their predicted CATE uplift (τ̂_i), while the grey dashed line represents a random promotional rollout. Notice the steep initial slope of the green line: at the 50% rollout threshold, our causal model delivers **+27.5% more incremental purchases (488.6 vs 383.1 orders)** than random selection. This visual proof confirms that our algorithm concentrates budget on responsive 'Persuadables' first."*

---

### Phase 4: Prescriptive Budget Simulator (5:30 – 7:30)
* **What to Show on Screen:** Click **Budget Simulator** in the left navigation.
* **Action to Perform:**
  1. Adjust the **Campaign Budget** slider from ₹50,000 to ₹75,000.
  2. Switch solver between **Exact MILP (HiGHS)** and **Greedy Heuristic**.
  3. Click **Run Live Optimization Simulation**.
* **Exact Speaking Script:**
  > *"The platform includes a real-time prescriptive simulator for marketing directors. When I increase the campaign budget from ₹50,000 to ₹75,000 and click 'Run Live Optimization Simulation', our backend solves the new Multiple-Choice Knapsack problem in under 50 milliseconds.
  > 
  > The solver expands discount allocations to the next tier of price-sensitive customers, showing the revised profit, expected cash outflow, and marginal return. Notice that both nominal coupon liability and expected redeemed cost are reported separately for finance transparency."*

---

### Phase 5: Individual Customer Recommendations (7:30 – 9:00)
* **What to Show on Screen:** Click **Recommendations** in the sidebar.
* **Action to Perform:**
  1. In the search box, type `CUST_000042`.
  2. Point out: Recommended Discount = ₹20, Uplift = +0.2245 (+22.45%), Net Profit = +₹112.80.
* **Exact Speaking Script:**
  > *"In the Recommendations matrix, business teams can search, sort, and filter all 10,000 individual customer prescriptions.
  > 
  > For example, searching customer `CUST_000042`: our model recommends a ₹20 discount offer because their estimated uplift is +22.45%, yielding an expected incremental profit of ₹112.80. Conversely, if we filter by ₹0 discount, we see customers whose estimated uplift is near zero—proving why the optimizer withheld coupons from them."*

---

### Phase 6: Causal Validation, DoWhy DAG & Drift Detection (9:00 – 11:00)
* **What to Show on Screen:** Click **Causal Validation & PSM** in the sidebar.
* **Key Visuals to Show:**
  1. **Scorecard:** Validation Passed (100% Robustness Score).
  2. **Love Plot:** Pre-match SMD (orange squares) vs Post-match SMD (green circles < 0.022).
  3. **4 Refutations:** Placebo (p=0.485), Confounder Injection (0.16% drift), Data Subset (0.03% drift), Trimming (0.17% drift).
  4. **DoWhy Causal DAG Card:** Backdoor criterion identification.
  5. **Data Drift Monitoring Card:** PSI scores across features (all < 0.020 < 0.10 threshold).
* **Exact Speaking Script:**
  > *"To ensure scientific integrity, we do not rely on correlation. In the Validation workspace:
  > 1. Our Love Plot confirms that 1:1 Propensity Score Matching eliminated over 94% of observational bias across all 9 confounders, bringing all |SMD| values below 0.022.
  > 2. All 4 causal refutation tests pass: in the Placebo test, when treatment is permuted, the causal effect collapses to 0 with p = 0.485.
  > 3. Our Microsoft DoWhy Directed Acyclic Graph mathematically proves identification via the Backdoor Criterion.
  > 4. Finally, our continuous Data Drift Detector monitors incoming customer distributions via Population Stability Index (PSI); all features currently report PSI < 0.020, confirming system stability."*

---

## 3. Fallback Plan & Troubleshooting

If any dependency or server issue arises during the presentation:
- **Backend Port Conflict:** If port 8000 is occupied, run `python -m uvicorn 04_Frontend_Dashboard.backend.app:app --host 127.0.0.1 --port 8001` and update Vite proxy in `vite.config.js`.
- **Offline Fallback:** All static pre-computed artifacts are cached in `05_Final_Deliverables/Model_Evaluation_Report.xlsx`, `EconoCausal_Final_Project_Report.pdf`, and `EconoCausal_Final_Presentation.pptx`.
