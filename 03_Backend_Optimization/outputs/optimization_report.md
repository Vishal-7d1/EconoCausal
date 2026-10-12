# EconoCausal: Prescriptive Budget Optimization Report

**Module**: `03_Backend_Optimization`  
**Solver**: `MILP` (`scipy.optimize.milp` / HiGHS)  
**Optimization Objective**: `max_profit`  
**Total Campaign Budget**: ₹50,000.00  

---

## 1. Executive Summary & Key Results

- **Allocated Budget**: ₹50,000.00 (100.0% utilized).
- **Nominal Coupon Liability (Face Value)**: ₹50,000.00.
- **Expected Redeemed Cost (Probability-Weighted)**: ₹28,511.16.
- **Unused Budget**: ₹0.00.
- **Targeted Customers**: 4,568 / 10,000 (45.68%).
  - ₹0 (Control): 5,432 shoppers
  - ₹10 Discount: 4,136 shoppers
  - ₹20 Discount: 432 shoppers
- **Estimated Incremental Purchases**: **829.9 orders** (Avg uplift: +18.17 percentage points).
- **Estimated Incremental Profit**: **₹376,115.07**.
- **Return on Discount Spend (RODS)**: **7.52x** (Profit generated per ₹1 spent).

---

## 2. Comparison against Standard Marketing Baselines

Comparing the DML Causal Optimal Policy against standard promotional allocation heuristics under the identical ₹50,000 budget:

| Allocation Policy | Discount Spend (₹) | Customers Discounted | Incremental Orders | Incremental Profit (₹) | RODS (Profit / Spend) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **DML Causal Optimal Policy** | ₹50,000 | 4,568 | +829.9 | ₹376,115.07 | 7.52x |
| **Baseline 1: Random ₹10 Allocation** | ₹50,000 | 5,000 | +717.1 | ₹235,022.35 | 4.7x |
| **Baseline 2: Highest Cart Value (₹10)** | ₹50,000 | 5,000 | +791.7 | ₹361,734.50 | 7.23x |
| **Baseline 3: Sequential Uniform ₹10** | ₹50,000 | 5,000 | +718.8 | ₹234,914.09 | 4.7x |

### Key Business Takeaways:
1. **Causal Optimization vs. Random Allocation**: Generates **+₹141,092.72** (+60.0%) incremental profit and **+112.7** additional orders.
2. **Causal Optimization vs. High-Cart Heuristic**: Overcomes deadweight loss, delivering **+₹14,380.57** additional profit and **+38.2** orders. High-cart shoppers frequently convert at full price; causal targeting redirects discounts to price-elastic segments.

---

## 3. Explicit Business Assumptions & Missing Data Disclosure

> [!IMPORTANT]
> **Transparency Regarding Business Assumptions**:
> In accordance with causal modeling standards, the following business assumptions were explicitly documented rather than invented:
> 1. **Contribution Margin Ratio**: The source dataset contains `cart_baseline_value_inr` but lacks cost-of-goods-sold (COGS) or product margin fields. A configurable baseline margin ratio of **30%** (`--margin-ratio 0.30`) was adopted for contribution margin accounting.
> 2. **Baseline Purchase Probability**: DML predictions contain CATE uplifts (`tau_hat`) but not baseline control conversion probabilities $p_{0, i}$. Rather than leaking ground-truth counterfactuals, a regularized logistic regression was fit exclusively on observable control records ($T=0$) using valid pretreatment covariates.
> 3. **Budget Liability Model**: Budget enforcement evaluates face-value allocated coupon liability (`--budget-type allocated`), guaranteeing the campaign never exceeds finance liability caps.
> 4. **No Multiple Offers**: Mutual exclusivity ($w_{i, 10} + w_{i, 20} \le 1$) is strictly enforced.

---

## 4. Known Methodological Limitations

1. **Uncertainty Propagation**: Optimization takes point estimates $\hat{\tau}_i$ as deterministic inputs; it does not currently penalize high standard error intervals (robust optimization / CVaR).
2. **Discrete Price Arm Grid**: Allocation selects among {₹0, ₹10, ₹20}; continuous price elasticity curves are not modeled.
3. **Inventory & Competitive Neutrality (SUTVA)**: Assumes storewide inventory is unconstrained and discount allocations do not create market-wide supply depletion.
4. **Synthetic Data Benchmark**: Validated on reproducible synthetic benchmarks; real-world deployment requires live A/B rollout with propensity logging.

---
**Generated Figures**: `01_budget_allocation_distribution.png`, `02_policy_comparison.png`, `03_incremental_conversions_by_segment.png`.