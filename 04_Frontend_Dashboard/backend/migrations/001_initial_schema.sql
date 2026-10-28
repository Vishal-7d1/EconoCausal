-- Migration 001: Initial Schema for EconoCausal Persistence
-- Supports: Datasets, Model Runs, Campaigns, Optimizations, Allocations, Causal Audits, and Drift Monitoring

PRAGMA foreign_keys = ON;

-- 1. Schema Migrations Tracker
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    migration_name TEXT NOT NULL,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Datasets Table
CREATE TABLE IF NOT EXISTS datasets (
    dataset_id TEXT PRIMARY KEY,
    dataset_name TEXT NOT NULL,
    filename TEXT NOT NULL,
    source_type TEXT NOT NULL, -- 'benchmark', 'upload', 'synthetic'
    total_records INTEGER NOT NULL,
    file_path TEXT,
    file_hash_sha256 TEXT,
    is_active INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'READY', -- 'INGESTING', 'READY', 'FAILED', 'ARCHIVED'
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_datasets_is_active ON datasets(is_active);

-- 3. Dataset Processing Runs
CREATE TABLE IF NOT EXISTS dataset_processing_runs (
    run_id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL REFERENCES datasets(dataset_id) ON DELETE CASCADE,
    run_type TEXT NOT NULL, -- 'ingestion', 'validation', 'cleaning'
    status TEXT NOT NULL, -- 'PENDING', 'RUNNING', 'COMPLETED', 'FAILED'
    records_processed INTEGER DEFAULT 0,
    error_message TEXT,
    metrics_json TEXT,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_processing_runs_dataset ON dataset_processing_runs(dataset_id);

-- 4. Model Training Runs
CREATE TABLE IF NOT EXISTS model_training_runs (
    model_id TEXT PRIMARY KEY,
    model_version TEXT NOT NULL,
    estimator_class TEXT NOT NULL, -- 'LinearDML', 'CausalForestDML'
    dataset_id TEXT REFERENCES datasets(dataset_id),
    artifact_path TEXT NOT NULL,
    artifact_size_bytes INTEGER,
    artifact_hash_sha256 TEXT,
    parameters_json TEXT,
    evaluation_metrics_json TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'SUPERSEDED', 'FAILED'
    trained_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_model_runs_status ON model_training_runs(status);

-- 5. Campaigns Table
CREATE TABLE IF NOT EXISTS campaigns (
    campaign_id TEXT PRIMARY KEY,
    campaign_name TEXT NOT NULL,
    description TEXT,
    dataset_id TEXT NOT NULL REFERENCES datasets(dataset_id),
    model_id TEXT REFERENCES model_training_runs(model_id),
    total_budget REAL NOT NULL,
    budget_type TEXT NOT NULL DEFAULT 'allocated', -- 'allocated' or 'redeemed'
    margin_ratio REAL NOT NULL DEFAULT 0.30,
    min_discount INTEGER NOT NULL DEFAULT 0,
    max_discount INTEGER NOT NULL DEFAULT 20,
    status TEXT NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'OPTIMIZED', 'ACTIVE', 'ARCHIVED'
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_campaigns_dataset ON campaigns(dataset_id);

-- 6. Optimization Runs Table
CREATE TABLE IF NOT EXISTS optimization_runs (
    optimization_id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
    dataset_id TEXT NOT NULL REFERENCES datasets(dataset_id),
    solver_type TEXT NOT NULL DEFAULT 'greedy', -- 'greedy', 'milp'
    objective TEXT NOT NULL DEFAULT 'max_profit', -- 'max_profit', 'max_conversions'
    total_customers INTEGER NOT NULL,
    allocated_budget REAL NOT NULL,
    nominal_coupon_liability REAL NOT NULL,
    expected_redeemed_cost REAL NOT NULL,
    estimated_incremental_profit_inr REAL NOT NULL,
    return_on_discount_spend REAL NOT NULL,
    count_control_0 INTEGER NOT NULL,
    count_discount_10 INTEGER NOT NULL,
    count_discount_20 INTEGER NOT NULL,
    summary_json TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_opt_runs_campaign ON optimization_runs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_opt_runs_dataset ON optimization_runs(dataset_id);

-- 7. Customer Allocations Table
CREATE TABLE IF NOT EXISTS customer_allocations (
    allocation_id INTEGER PRIMARY KEY AUTOINCREMENT,
    optimization_id TEXT NOT NULL REFERENCES optimization_runs(optimization_id) ON DELETE CASCADE,
    customer_id TEXT NOT NULL,
    cart_baseline_value_inr REAL NOT NULL,
    monthly_income_inr REAL NOT NULL,
    income_tier TEXT NOT NULL,
    loyalty_member INTEGER NOT NULL,
    loyalty_label TEXT NOT NULL,
    recommended_discount_inr INTEGER NOT NULL,
    expected_incremental_purchase_uplift REAL NOT NULL,
    expected_incremental_profit_inr REAL NOT NULL,
    baseline_conversion_prob_hat REAL NOT NULL,
    tau_hat_10 REAL,
    tau_hat_20 REAL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(optimization_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_allocations_opt_cust ON customer_allocations(optimization_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_allocations_opt_disc ON customer_allocations(optimization_id, recommended_discount_inr);
CREATE INDEX IF NOT EXISTS idx_allocations_opt_income ON customer_allocations(optimization_id, income_tier);

-- 8. Causal Audit Runs Table
CREATE TABLE IF NOT EXISTS causal_audit_runs (
    audit_id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL REFERENCES datasets(dataset_id),
    model_id TEXT REFERENCES model_training_runs(model_id),
    audit_type TEXT NOT NULL, -- 'validation', 'refutation', 'psm'
    status TEXT NOT NULL, -- 'PASSED', 'WARNING', 'FAILED'
    robustness_score REAL,
    refutations_passed INTEGER,
    refutations_total INTEGER,
    summary_json TEXT,
    report_path TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_causal_audit_dataset ON causal_audit_runs(dataset_id);

-- 9. Drift Monitoring Runs Table
CREATE TABLE IF NOT EXISTS drift_monitoring_runs (
    drift_id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL REFERENCES datasets(dataset_id),
    reference_dataset_id TEXT REFERENCES datasets(dataset_id),
    status TEXT NOT NULL, -- 'PASSED', 'WARNING', 'FAILED'
    ks_drift_detected INTEGER NOT NULL DEFAULT 0,
    psi_drift_detected INTEGER NOT NULL DEFAULT 0,
    summary_json TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_drift_monitoring_dataset ON drift_monitoring_runs(dataset_id);
