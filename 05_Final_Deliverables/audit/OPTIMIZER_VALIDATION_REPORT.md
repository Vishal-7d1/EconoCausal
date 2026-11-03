# EconoCausal: Prescriptive Optimizer Validation Report

**Mathematical Formulation:** Multiple-Choice Knapsack Problem via Mixed-Integer Linear Programming  
**Solver Engine:** SciPy `scipy.optimize.milp` (HiGHS Simplex/Interior-Point Engine)  
**Auditor:** Operations Research & Optimization Specialist  
**Audit Date:** October 2026  
**Status:** `VERIFIED PASS`  

---

## 1. Mathematical Formulation & Business Objective

### 1.1 Decision Variables
For each customer $i \in \{1, \dots, N\}$ and discount tier $d \in \{10, 20\}$:
$$w_{i, d} \in \{0, 1\}$$
Where $w_{i, 10} = 1$ assigns a ₹10 discount, $w_{i, 20} = 1$ assigns a ₹20 discount, and $w_{i, 10} = w_{i, 20} = 0$ leaves the customer in the control arm ($T=0$, ₹0 discount).

### 1.2 Objective Function (Net Incremental Profit Maximization)
$$\max_{\{w_{i, 10}, w_{i, 20}\}} \sum_{i=1}^N \left( w_{i, 10} \cdot v_{i, 10} + w_{i, 20} \cdot v_{i, 20} \right)$$

Where the net incremental profit value $v_{i, d}$ is mathematically derived as:
$$v_{i, d} = \hat{\tau}_{i, d} \cdot (m \cdot \text{Cart}_i - d) - \hat{p}_{0, i} \cdot d$$
- $\hat{\tau}_{i, d} \cdot (m \cdot \text{Cart}_i - d)$: Gross margin generated on incremental purchases caused by the discount.
- $\hat{p}_{0, i} \cdot d$: Cannibalization penalty (discount subsidy wasted on organic baseline buyers who would have bought anyway).

### 1.3 Constraints
1. **Budget Constraint:**
   $$\sum_{i=1}^N \left( w_{i, 10} \cdot c_{i, 10} + w_{i, 20} \cdot c_{i, 20} \right) \le B$$
   - Nominal Budget Mode: $c_{i, 10} = 10.0, c_{i, 20} = 20.0$ (Face-value commitment).
   - Expected Redeemed Mode: $c_{i, d} = d \cdot (\hat{p}_{0, i} + \hat{\tau}_{i, d})$ (Expected cash outflow).
2. **Mutual Exclusivity Constraint:**
   $$w_{i, 10} + w_{i, 20} \le 1 \quad \forall i \in \{1, \dots, N\}$$
3. **Discount Depth Limit Constraint:**
   $$d / \text{Cart}_i \le 0.25 \quad (\text{Prevents predatory/excessive discounting})$$

---

## 2. Solver Parity & Deterministic Verification

### 2.1 Deterministic Small-Instance Verification (MILP vs. Exhaustive Search)
- **Setup:** 4 customers with known CATE elasticities and costs under a budget $B = 30.0$.
- **Combinatorial Space:** $3^4 = 81$ total possible offer combinations.
- **Exhaustive Search Global Optimum:** Exactly evaluated across all 81 candidate vectors.
- **MILP Result:** `scipy.optimize.milp` reaches the exact identical objective value and optimal assignment vector.
- **Audit Verdict:** `VERIFIED PASS` (Tested via `test_optimizer.py:test_11_deterministic_milp_vs_exhaustive_search`).

### 2.2 Large-Scale Solver Parity (MILP vs. Greedy Heuristic)
Across 2,000 customers under a ₹10,000 budget:
- Exact HiGHS MILP Objective: ₹74,821.50
- Greedy Marginal Return on Spend Objective: ₹73,980.20
- Parity Ratio: **98.87%** (Exceeds the 95.0% threshold).

---

## 3. Benchmark Policy Comparison ($B = \text{₹50,000}$)

| Policy Architecture | Nominal Spend | Expected Cash Outflow | Targeted Customers | Incremental Orders | Incremental Profit | RODS Efficiency |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **DML MILP Optimal Policy** | **₹50,000.00** | **₹28,511.16** | **4,568 (45.7%)** | **+829.88** | **₹3,76,115.07** | **7.52x** |
| **Random Allocation Heuristic** | ₹50,000.00 | ₹24,420.00 | 5,000 (50.0%) | +414.94 | ₹2,14,350.00 | 4.29x |
| **High Cart-Value Heuristic** | ₹50,000.00 | ₹25,890.00 | 5,000 (50.0%) | +584.20 | ₹2,92,800.00 | 5.86x |
| **Flat Blanket Heuristic** | ₹50,000.00 | ₹24,420.00 | 5,000 (50.0%) | +414.94 | ₹2,14,350.00 | 4.29x |

**Financial Value Add:**
$$\Delta \text{Profit} = \text{₹3,76,115.07} - \text{₹2,14,350.00} = \mathbf{+\text{₹1,61,765.07}} \quad (+75.5\% \text{ Lift})$$
