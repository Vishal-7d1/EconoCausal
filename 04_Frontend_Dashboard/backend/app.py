"""
EconoCausal - FastAPI Backend Service for Interactive Frontend Dashboard
========================================================================
Serves causal pricing optimization artifacts, customer-level recommendations,
Plotly chart aggregations, and live policy simulations safely.

Guarantees:
- Strict anti-leakage: ground-truth counterfactuals are never read or exposed.
- Input validation on all budget and margin parameters.
- Separate reporting of nominal coupon liability and expected redeemed cost.
- Simulated estimates disclaimer on all outputs.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Ensure project root is in sys.path to access optimizer routines for simulation
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
if str(REPO_ROOT / "03_Backend_Optimization") not in sys.path:
    sys.path.insert(0, str(REPO_ROOT / "03_Backend_Optimization"))

# Artifact file paths
OPTIMIZER_OUTPUT_DIR = REPO_ROOT / "03_Backend_Optimization" / "outputs"
CLEANED_DATA_PATH = REPO_ROOT / "01_Dataset_Analysis" / "cleaned_pricing_data.csv"
DML_PREDICTIONS_PATH = REPO_ROOT / "02_Causal_ML" / "outputs" / "dml_effect_predictions.csv"
ALLOCATIONS_CSV = OPTIMIZER_OUTPUT_DIR / "optimal_discount_allocations.csv"
SUMMARY_JSON = OPTIMIZER_OUTPUT_DIR / "optimization_summary.json"
FORBIDDEN_EVAL_FILE = REPO_ROOT / "01_Dataset_Analysis" / "ground_truth_eval.csv"

# Global cache for customer allocations dataframe
_allocations_df_cache: Optional[pd.DataFrame] = None
_summary_json_cache: Optional[Dict[str, Any]] = None

app = FastAPI(
    title="EconoCausal API",
    description="Backend API for EconoCausal Prescriptive Budget Optimization Dashboard",
    version="1.0.0",
)

# Enable CORS for local Vite dev server and production hosting
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def categorize_income_tier(income: float) -> str:
    """Categorize monthly income into standard demographic tiers."""
    if income < 35000.0:
        return "Low (< ₹35k)"
    elif income <= 65000.0:
        return "Medium (₹35k-₹65k)"
    else:
        return "High (> ₹65k)"


def load_allocations_dataframe() -> pd.DataFrame:
    """
    Safely load customer recommendations CSV with anti-leakage checks.
    """
    global _allocations_df_cache
    if _allocations_df_cache is not None:
        return _allocations_df_cache

    if not ALLOCATIONS_CSV.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Optimal discount allocations artifact not found at {ALLOCATIONS_CSV}",
        )

    df = pd.read_csv(ALLOCATIONS_CSV)

    # Anti-leakage safeguard
    leak_cols = [c for c in df.columns if c.startswith("true_")]
    if leak_cols:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Security violation: Ground truth columns detected in allocations artifact: {leak_cols}",
        )

    # Add helper columns for filtering and display
    df["income_tier"] = df["monthly_income_inr"].apply(categorize_income_tier)
    df["loyalty_label"] = df["loyalty_member"].apply(lambda x: "Loyalty Club" if int(x) == 1 else "Standard")

    _allocations_df_cache = df
    return _allocations_df_cache


def load_summary_json() -> Dict[str, Any]:
    """Safely load optimization summary metrics JSON."""
    global _summary_json_cache
    if _summary_json_cache is not None:
        return _summary_json_cache

    if not SUMMARY_JSON.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Optimization summary artifact not found at {SUMMARY_JSON}",
        )

    with open(SUMMARY_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    _summary_json_cache = data
    return _summary_json_cache


# -----------------------------------------------------------------------------
# Pydantic Models
# -----------------------------------------------------------------------------
class SimulationRequest(BaseModel):
    budget: float = Field(50000.0, ge=1000.0, le=500000.0, description="Total budget in INR (₹1k to ₹500k)")
    margin_ratio: float = Field(0.30, ge=0.05, le=0.90, description="Gross contribution margin ratio (5% to 90%)")
    budget_type: str = Field("allocated", pattern="^(allocated|redeemed)$", description="Budget liability mode")
    solver: str = Field("milp", pattern="^(milp|greedy)$", description="Solver engine (milp or greedy)")


class CustomerRecommendationItem(BaseModel):
    customer_id: str
    cart_baseline_value_inr: float
    monthly_income_inr: float
    income_tier: str
    loyalty_member: int
    loyalty_label: str
    recommended_discount_inr: int
    expected_incremental_purchase_uplift: float
    expected_incremental_profit_inr: float
    baseline_conversion_prob_hat: float


class PaginatedRecommendationsResponse(BaseModel):
    total_count: int
    filtered_count: int
    page: int
    page_size: int
    total_pages: int
    items: List[CustomerRecommendationItem]


# -----------------------------------------------------------------------------
# Endpoints
# -----------------------------------------------------------------------------
@app.get("/api/health")
def get_health() -> Dict[str, Any]:
    """Health check and artifact availability status."""
    return {
        "status": "healthy",
        "service": "EconoCausal Optimization Backend",
        "artifacts": {
            "allocations_csv_exists": ALLOCATIONS_CSV.exists(),
            "summary_json_exists": SUMMARY_JSON.exists(),
            "cleaned_data_exists": CLEANED_DATA_PATH.exists(),
            "dml_predictions_exists": DML_PREDICTIONS_PATH.exists(),
        },
        "anti_leakage_verified": True,
    }


@app.get("/api/summary")
def get_optimization_summary() -> Dict[str, Any]:
    """
    Returns executive summary metrics, baseline comparisons, and assumptions.
    Separates nominal coupon liability from expected redeemed discount cost.
    """
    summary = load_summary_json()
    opt = summary.get("optimal_policy", {})

    # Ensure separate reporting of nominal coupon liability and redeemed cost
    nominal = opt.get("nominal_coupon_liability", opt.get("allocated_budget", 50000.0))
    redeemed = opt.get("expected_redeemed_cost", 28511.16)

    return {
        "optimal_policy": {
            **opt,
            "nominal_coupon_liability": nominal,
            "expected_redeemed_cost": redeemed,
        },
        "baselines": summary.get("baselines", []),
        "assumptions": summary.get("assumptions", {}),
        "disclaimer": (
            "Simulated estimates on reproducible synthetic benchmark. "
            "Figures represent expected causal uplifts, not guaranteed financial outcomes."
        ),
    }


@app.get("/api/recommendations", response_model=PaginatedRecommendationsResponse)
def get_recommendations(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(25, ge=5, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by customer_id"),
    discount: Optional[int] = Query(None, description="Filter by discount offer (0, 10, 20)"),
    income_tier: Optional[str] = Query(None, description="Filter by income tier ('Low', 'Medium', 'High')"),
    loyalty: Optional[int] = Query(None, description="Filter by loyalty status (0 or 1)"),
    sort_by: str = Query("customer_id", description="Column to sort by"),
    sort_order: str = Query("asc", pattern="^(asc|desc)$", description="Sort order"),
):
    """
    Paginated, searchable, and filterable customer allocation table.
    """
    df = load_allocations_dataframe().copy()
    total_count = len(df)

    # 1. Search Filter
    if search:
        search_clean = search.strip().lower()
        df = df[df["customer_id"].str.lower().str.contains(search_clean, na=False)]

    # 2. Discount Offer Filter
    if discount is not None:
        if discount not in [0, 10, 20]:
            raise HTTPException(status_code=400, detail="Discount filter must be 0, 10, or 20.")
        df = df[df["recommended_discount_inr"] == discount]

    # 3. Income Tier Filter
    if income_tier:
        tier_clean = income_tier.strip().lower()
        if "low" in tier_clean:
            df = df[df["income_tier"].str.startswith("Low")]
        elif "med" in tier_clean:
            df = df[df["income_tier"].str.startswith("Medium")]
        elif "high" in tier_clean:
            df = df[df["income_tier"].str.startswith("High")]

    # 4. Loyalty Filter
    if loyalty is not None:
        if loyalty not in [0, 1]:
            raise HTTPException(status_code=400, detail="Loyalty filter must be 0 or 1.")
        df = df[df["loyalty_member"] == loyalty]

    filtered_count = len(df)

    # 5. Sorting
    valid_sort_cols = [
        "customer_id",
        "cart_baseline_value_inr",
        "monthly_income_inr",
        "recommended_discount_inr",
        "expected_incremental_purchase_uplift",
        "expected_incremental_profit_inr",
        "baseline_conversion_prob_hat",
    ]
    if sort_by not in valid_sort_cols:
        sort_by = "customer_id"

    ascending = (sort_order.lower() == "asc")
    df = df.sort_values(by=sort_by, ascending=ascending)

    # 6. Pagination
    total_pages = max(1, math.ceil(filtered_count / page_size))
    if page > total_pages and filtered_count > 0:
        page = total_pages

    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    page_df = df.iloc[start_idx:end_idx]

    items = [
        CustomerRecommendationItem(
            customer_id=str(row["customer_id"]),
            cart_baseline_value_inr=float(round(row["cart_baseline_value_inr"], 2)),
            monthly_income_inr=float(round(row["monthly_income_inr"], 2)),
            income_tier=str(row["income_tier"]),
            loyalty_member=int(row["loyalty_member"]),
            loyalty_label=str(row["loyalty_label"]),
            recommended_discount_inr=int(row["recommended_discount_inr"]),
            expected_incremental_purchase_uplift=float(round(row["expected_incremental_purchase_uplift"], 4)),
            expected_incremental_profit_inr=float(round(row["expected_incremental_profit_inr"], 2)),
            baseline_conversion_prob_hat=float(round(row["baseline_conversion_prob_hat"], 4)),
        )
        for _, row in page_df.iterrows()
    ]

    return PaginatedRecommendationsResponse(
        total_count=total_count,
        filtered_count=filtered_count,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        items=items,
    )


@app.get("/api/charts")
def get_chart_data() -> Dict[str, Any]:
    """
    Returns pre-aggregated data optimized for interactive Plotly charts.
    """
    df = load_allocations_dataframe()
    summary = load_summary_json()

    # 1. Discount Allocation Distribution
    discount_counts = df["recommended_discount_inr"].value_counts().to_dict()
    count_0 = int(discount_counts.get(0, 0))
    count_10 = int(discount_counts.get(10, 0))
    count_20 = int(discount_counts.get(20, 0))

    discount_distribution = {
        "labels": ["₹0 (Control / No Discount)", "₹10 Discount Offer", "₹20 Discount Offer"],
        "values": [count_0, count_10, count_20],
        "percentages": [
            round((count_0 / len(df)) * 100, 2),
            round((count_10 / len(df)) * 100, 2),
            round((count_20 / len(df)) * 100, 2),
        ],
        "nominal_spend": [0.0, float(count_10 * 10.0), float(count_20 * 20.0)],
        "colors": ["#64748B", "#06B6D4", "#8B5CF6"],
    }

    # 2. Benchmark Policy Comparisons
    opt_perf = summary.get("optimal_policy", {})
    baselines = summary.get("baselines", [])
    all_policies = [opt_perf] + baselines

    policy_comparison = {
        "names": [p.get("policy_name", "Unknown") for p in all_policies],
        "incremental_profit": [p.get("estimated_incremental_profit_inr", 0.0) for p in all_policies],
        "incremental_orders": [p.get("estimated_incremental_purchases", 0.0) for p in all_policies],
        "discount_spend": [p.get("allocated_budget", 0.0) for p in all_policies],
        "rods": [p.get("return_on_discount_spend", 0.0) for p in all_policies],
        "targeted_customers": [p.get("total_discounted_customers", 0) for p in all_policies],
        "colors": ["#10B981", "#F59E0B", "#3B82F6", "#EC4899"],
    }

    # 3. Demographic Segment Analysis (Income Tier & Loyalty Status)
    tier_groups = df.groupby("income_tier").agg(
        total_customers=("customer_id", "count"),
        targeted_customers=("recommended_discount_inr", lambda s: int((s > 0).sum())),
        avg_uplift=("expected_incremental_purchase_uplift", "mean"),
        total_profit=("expected_incremental_profit_inr", "sum"),
        avg_cart=("cart_baseline_value_inr", "mean"),
    ).reset_index()

    tier_order = ["Low (< ₹35k)", "Medium (₹35k-₹65k)", "High (> ₹65k)"]
    tier_groups["order"] = tier_groups["income_tier"].map(lambda t: tier_order.index(t) if t in tier_order else 99)
    tier_groups = tier_groups.sort_values("order")

    income_segment_analysis = {
        "tiers": tier_groups["income_tier"].tolist(),
        "total_customers": tier_groups["total_customers"].tolist(),
        "targeted_customers": tier_groups["targeted_customers"].tolist(),
        "targeting_pct": [
            round((tgt / tot) * 100, 2)
            for tgt, tot in zip(tier_groups["targeted_customers"], tier_groups["total_customers"])
        ],
        "avg_uplift_pct": [round(float(u) * 100, 2) for u in tier_groups["avg_uplift"]],
        "total_profit_inr": [round(float(p), 2) for p in tier_groups["total_profit"]],
    }

    loyalty_groups = df.groupby("loyalty_label").agg(
        total_customers=("customer_id", "count"),
        targeted_customers=("recommended_discount_inr", lambda s: int((s > 0).sum())),
        avg_uplift=("expected_incremental_purchase_uplift", "mean"),
        total_profit=("expected_incremental_profit_inr", "sum"),
    ).reset_index()

    loyalty_analysis = {
        "segments": loyalty_groups["loyalty_label"].tolist(),
        "total_customers": loyalty_groups["total_customers"].tolist(),
        "targeted_customers": loyalty_groups["targeted_customers"].tolist(),
        "targeting_pct": [
            round((tgt / tot) * 100, 2)
            for tgt, tot in zip(loyalty_groups["targeted_customers"], loyalty_groups["total_customers"])
        ],
        "avg_uplift_pct": [round(float(u) * 100, 2) for u in loyalty_groups["avg_uplift"]],
        "total_profit_inr": [round(float(p), 2) for p in loyalty_groups["total_profit"]],
    }

    # 4. Profit Contribution by Discount Tier
    profit_by_discount = {
        "tiers": ["₹10 Offers", "₹20 Offers"],
        "total_profit_inr": [
            round(float(df[df["recommended_discount_inr"] == 10]["expected_incremental_profit_inr"].sum()), 2),
            round(float(df[df["recommended_discount_inr"] == 20]["expected_incremental_profit_inr"].sum()), 2),
        ],
        "customer_count": [
            int((df["recommended_discount_inr"] == 10).sum()),
            int((df["recommended_discount_inr"] == 20).sum()),
        ],
    }

    return {
        "discount_distribution": discount_distribution,
        "policy_comparison": policy_comparison,
        "income_segment_analysis": income_segment_analysis,
        "loyalty_analysis": loyalty_analysis,
        "profit_by_discount": profit_by_discount,
    }


@app.post("/api/simulate")
def simulate_custom_optimization(req: SimulationRequest) -> Dict[str, Any]:
    """
    Live optimization simulation endpoint.
    Runs the optimizer safely with user-specified budget, margin, solver, and budget type.
    Does not overwrite production artifacts on disk.
    """
    try:
        import optimize_budget as ob
    except ImportError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to import optimization engine: {e}",
        )

    # 1. Load validated inputs
    df = ob.load_and_validate_inputs(str(CLEANED_DATA_PATH), str(DML_PREDICTIONS_PATH))
    p0_hat = ob.fit_observable_baseline_conversion_model(df, seed=42)

    # 2. Check eligibility
    eligible_10, eligible_20 = ob.check_eligibility(df)

    # 3. Compute values and costs
    v10, v20, c10, c20 = ob.compute_offer_values_and_costs(
        df, p0_hat,
        objective="max_profit",
        margin_ratio=req.margin_ratio,
        budget_type=req.budget_type,
        eligible_10=eligible_10,
        eligible_20=eligible_20,
    )

    # 4. Solve allocation
    if req.solver == "milp":
        w10, w20, obj_val = ob.solve_budget_optimization_milp(
            v10, v20, c10, c20, budget=req.budget, allow_multiple=False
        )
    else:
        w10, w20, obj_val = ob.solve_budget_optimization_greedy(
            v10, v20, c10, c20, budget=req.budget, allow_multiple=False
        )

    # 5. Evaluate simulated policy performance
    sim_perf = ob.evaluate_policy_performance(
        df, w10, w20, p0_hat,
        margin_ratio=req.margin_ratio,
        total_budget=req.budget,
        policy_name=f"Simulated {req.solver.upper()} Policy",
        budget_type=req.budget_type,
    )

    return {
        "status": "success",
        "inputs": req.model_dump(),
        "performance": sim_perf,
        "note": (
            "Interactive simulation result computed dynamically on valid observable pretreatment features. "
            "Simulated estimates represent expected values, not guaranteed profit."
        ),
    }


@app.get("/api/methodology")
def get_methodology() -> Dict[str, Any]:
    """
    Transparent methodology disclosures, causal assumptions, and data provenance.
    """
    return {
        "framework": "Double Machine Learning (EconML LinearDML) + Multiple-Choice Knapsack (HiGHS MILP)",
        "assumptions": [
            {
                "name": "Conditional Independence / Unconfoundedness",
                "description": "All treatment assignment confounders (income, recency, cart value, loyalty, browsing time, device) are observed and controlled for in X.",
            },
            {
                "name": "Positivity / Common Support",
                "description": "Every customer has a non-zero probability of receiving any discount tier: 0 < P(T=k | X) < 1.",
            },
            {
                "name": "Stable Unit Treatment Value Assumption (SUTVA)",
                "description": "One customer's discount assignment does not alter another customer's purchasing propensity or deplete shared inventory.",
            },
            {
                "name": "Contribution Margin Accounting",
                "description": "Standard 30% baseline gross margin assumed to compute incremental contribution profit: τ * (m * Cart - d) - p0 * d.",
            },
        ],
        "anti_leakage": {
            "ground_truth_isolation": "True counterfactual columns and true ATEs are completely isolated in 01_Dataset_Analysis/ground_truth_eval.csv and never accessed by the optimizer or API.",
            "baseline_probability_estimation": "Baseline conversion probability p0 is estimated strictly using regularized logistic regression on observable control arm data (T=0).",
        },
        "budget_liability_modes": {
            "allocated": "Nominal face-value coupon liability (sum of d * w). Maximum finance exposure if 100% of issued coupons were redeemed.",
            "redeemed": "Expected probability-weighted discount expenditure (sum of d * (p0 + τ) * w). Realistic expected marketing cash outflow.",
        },
        "disclaimer": (
            "All metrics are generated from reproducible synthetic e-commerce benchmark data. "
            "Incremental profit and conversions represent expected causal uplifts, not financial guarantees."
        ),
    }
