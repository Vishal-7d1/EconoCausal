/**
 * CatePredictor.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * EconoCausal — Level 2 Phase 3: Frontend CATE Prediction Studio
 *
 * Real-time causal inference interface powered by FastAPI CausalDMLService.
 * Connects directly to:
 *   • POST /api/causal/predict — Live individualized treatment effect estimation
 *   • GET  /api/causal/cate    — Population-level CATE distribution & heterogeneity
 *
 * Anti-Leakage & Governance Guarantees:
 *   • Strictly pretreatment covariates only (Age, Income, Visits, Purchases, Recency, Cart, Loyalty, Device).
 *   • Customer IDs treated strictly as optional metadata and never passed to the feature matrix.
 *   • Prohibited columns (outcomes, realized revenues, assigned discounts, true_* ground truth)
 *     are completely omitted from all form fields and API payloads.
 *   • Treatment contrasts (₹10 vs ₹0, ₹20 vs ₹0) formatted strictly as percentage points (pp).
 *   • 95% asymptotic confidence intervals visualized via EconML effect_interval API.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calculator,
  Cpu,
  Zap,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Info,
  TrendingUp,
  BarChart2,
  Users,
  Layers,
  ArrowRight,
  ExternalLink,
  RotateCcw,
} from 'lucide-react';
import './CatePredictor.css';

// Preset customer archetypes calibrated against the verified 10,000 customer dataset
const CUSTOMER_PRESETS = [
  {
    id: 'price-sensitive',
    name: 'Price-Sensitive Shopper',
    badge: 'High Elasticity',
    desc: 'Young mobile browser with low income, frequent visits, and modest basket size.',
    data: {
      customer_id: 'CUST_ARCH_01',
      age: 24,
      monthly_income_inr: 28000,
      web_visits_last_30d: 14,
      past_purchases_count: 1,
      days_since_last_purchase: 12,
      cart_baseline_value_inr: 650,
      loyalty_member: 0,
      device_type: 'Mobile',
    },
  },
  {
    id: 'loyal-affluent',
    name: 'Affluent Loyal Shopper',
    badge: 'Inelastic / Saturation',
    desc: 'High-income loyalty member on desktop with high cart baseline; low price sensitivity.',
    data: {
      customer_id: 'CUST_ARCH_02',
      age: 46,
      monthly_income_inr: 125000,
      web_visits_last_30d: 4,
      past_purchases_count: 9,
      days_since_last_purchase: 6,
      cart_baseline_value_inr: 2800,
      loyalty_member: 1,
      device_type: 'Desktop',
    },
  },
  {
    id: 'dormant-abandoner',
    name: 'Dormant Cart Abandoner',
    badge: 'Moderate Elasticity',
    desc: 'Inactive buyer on tablet with higher recency days and moderate basket value.',
    data: {
      customer_id: 'CUST_ARCH_03',
      age: 34,
      monthly_income_inr: 52000,
      web_visits_last_30d: 8,
      past_purchases_count: 2,
      days_since_last_purchase: 95,
      cart_baseline_value_inr: 1450,
      loyalty_member: 0,
      device_type: 'Tablet',
    },
  },
  {
    id: 'population-median',
    name: 'Population Benchmark Median',
    badge: 'Baseline Medians',
    desc: 'Calibrated exactly to the 10,000 dataset population medians (Age 36, Income ₹48k).',
    data: {
      customer_id: 'CUST_BENCH_MED',
      age: 36,
      monthly_income_inr: 48247,
      web_visits_last_30d: 6,
      past_purchases_count: 3,
      days_since_last_purchase: 30,
      cart_baseline_value_inr: 998,
      loyalty_member: 0,
      device_type: 'Mobile',
    },
  },
];

const INITIAL_FORM = { ...CUSTOMER_PRESETS[3].data };

/**
 * Format a probability difference into percentage points with sign and 2 decimals.
 * E.g., 0.1568 -> "+15.69 pp"
 */
function formatPP(val, includeSign = true) {
  if (val == null || !Number.isFinite(val)) return '—';
  const pp = val * 100;
  const sign = includeSign && pp > 0 ? '+' : '';
  return `${sign}${pp.toFixed(2)} pp`;
}

export default function CatePredictor({ theme = 'light', onNavigate }) {
  // Navigation sub-tab: 'individual' (Form/Batch) vs 'population' (GET /api/causal/cate)
  const [activeSubTab, setActiveSubTab] = useState('individual');
  const [predictionMode, setPredictionMode] = useState('single'); // 'single' | 'batch_presets'

  // Form State (strictly 9 pretreatment features + optional customer_id)
  const [form, setForm] = useState(INITIAL_FORM);
  const [returnIntervals, setReturnIntervals] = useState(true);
  const [activePresetId, setActivePresetId] = useState('population-median');
  const [formErrors, setFormErrors] = useState({});

  // API Call States for Prediction (POST /api/causal/predict)
  const [isPredicting, setIsPredicting] = useState(false);
  const [predictionResponse, setPredictionResponse] = useState(null);
  const [predictionError, setPredictionError] = useState(null);
  const [lastSubmittedPayload, setLastSubmittedPayload] = useState(null);

  // Population CATE Summary State (GET /api/causal/cate)
  const [cateSummary, setCateSummary] = useState(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(null);

  // ── Fetch Population CATE Summary on Mount or on subTab switch ──
  const fetchCateSummary = useCallback(async () => {
    setIsSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await fetch('/api/causal/cate');
      if (!res.ok) {
        let detail = `HTTP ${res.status} ${res.statusText}`;
        try {
          const body = await res.json();
          if (body?.detail) detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
        } catch {
          // ignore json parse error
        }
        throw new Error(detail);
      }
      const data = await res.json();
      setCateSummary(data);
    } catch (err) {
      setSummaryError(err.message || 'Failed to load population CATE summary.');
    } finally {
      setIsSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCateSummary();
  }, [fetchCateSummary]);

  // ── Client-side Field Validation ──
  const validateForm = useCallback((formData) => {
    const errors = {};
    const age = Number(formData.age);
    if (!Number.isFinite(age) || age < 18 || age > 100) {
      errors.age = 'Age must be a valid number between 18 and 100.';
    }

    const income = Number(formData.monthly_income_inr);
    if (!Number.isFinite(income) || income < 5000 || income > 2000000) {
      errors.monthly_income_inr = 'Monthly income must be between ₹5,000 and ₹20,00,000.';
    }

    const visits = Number(formData.web_visits_last_30d);
    if (!Number.isFinite(visits) || visits < 0 || visits > 200) {
      errors.web_visits_last_30d = 'Visits must be an integer between 0 and 200.';
    }

    const purchases = Number(formData.past_purchases_count);
    if (!Number.isFinite(purchases) || purchases < 0 || purchases > 100) {
      errors.past_purchases_count = 'Past purchases must be between 0 and 100.';
    }

    const days = Number(formData.days_since_last_purchase);
    if (!Number.isFinite(days) || days < 1 || days > 730) {
      errors.days_since_last_purchase = 'Recency must be between 1 and 730 days.';
    }

    const cart = Number(formData.cart_baseline_value_inr);
    if (!Number.isFinite(cart) || cart < 50 || cart > 100000) {
      errors.cart_baseline_value_inr = 'Cart value must be between ₹50 and ₹1,00,000.';
    }

    if (!['Mobile', 'Tablet', 'Desktop'].includes(formData.device_type)) {
      errors.device_type = "Device must be 'Mobile', 'Tablet', or 'Desktop'.";
    }

    return errors;
  }, []);

  // ── Apply Preset ──
  const handleSelectPreset = (preset) => {
    setActivePresetId(preset.id);
    setForm({ ...preset.data });
    setFormErrors({});
  };

  // ── Handle Field Change ──
  const handleFieldChange = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      return next;
    });
    setActivePresetId(null); // customized from preset
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // ── Execute Live CATE Prediction API Request ──
  const executePrediction = useCallback(
    async (payload) => {
      setIsPredicting(true);
      setPredictionError(null);
      setPredictionResponse(null);
      setLastSubmittedPayload(payload);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const res = await fetch('/api/causal/predict', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          let errorDetail = `HTTP ${res.status} ${res.statusText}`;
          try {
            const errJson = await res.json();
            if (errJson?.detail) {
              errorDetail = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
            }
          } catch {
            // ignore parse failure
          }

          if (res.status === 503) {
            errorDetail =
              'FastAPI Backend server is offline on http://127.0.0.1:8000. ' +
              'Please ensure the backend is started using: python backend/app.py or npm run backend.';
          } else if (res.status === 422) {
            errorDetail = `Feature Validation Error: ${errorDetail}`;
          } else if (res.status === 400) {
            errorDetail = `Inference Request Rejected: ${errorDetail}`;
          }

          throw new Error(errorDetail);
        }

        const data = await res.json();
        setPredictionResponse(data);
      } catch (err) {
        if (err.name === 'AbortError') {
          setPredictionError('Request timed out after 15 seconds. Please check backend connectivity and retry.');
        } else {
          setPredictionError(err.message || 'CATE inference request failed.');
        }
      } finally {
        clearTimeout(timeoutId);
        setIsPredicting(false);
      }
    },
    []
  );

  // ── Single Record Submit ──
  const handleSubmitSingle = (e) => {
    if (e) e.preventDefault();

    const errors = validateForm(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const record = {
      customer_id: form.customer_id?.trim() || undefined,
      age: Number(form.age),
      monthly_income_inr: Number(form.monthly_income_inr),
      web_visits_last_30d: Number(form.web_visits_last_30d),
      past_purchases_count: Number(form.past_purchases_count),
      days_since_last_purchase: Number(form.days_since_last_purchase),
      cart_baseline_value_inr: Number(form.cart_baseline_value_inr),
      loyalty_member: Number(form.loyalty_member),
      device_type: form.device_type,
    };

    const payload = {
      records: [record],
      return_intervals: Boolean(returnIntervals),
    };

    executePrediction(payload);
  };

  // ── Batch Presets Submit (All 4 Archetypes) ──
  const handleSubmitBatchArchetypes = () => {
    const records = CUSTOMER_PRESETS.map((p) => ({
      customer_id: p.data.customer_id,
      age: p.data.age,
      monthly_income_inr: p.data.monthly_income_inr,
      web_visits_last_30d: p.data.web_visits_last_30d,
      past_purchases_count: p.data.past_purchases_count,
      days_since_last_purchase: p.data.days_since_last_purchase,
      cart_baseline_value_inr: p.data.cart_baseline_value_inr,
      loyalty_member: p.data.loyalty_member,
      device_type: p.data.device_type,
    }));

    const payload = {
      records,
      return_intervals: Boolean(returnIntervals),
    };

    executePrediction(payload);
  };

  // ── Auto-run baseline prediction once on mount so the user immediately sees live results ──
  useEffect(() => {
    handleSubmitSingle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Active Single Prediction (first result) ──
  const singleResult = predictionResponse?.predictions?.[0];

  // ── Incremental Economics Diagnosis for Single Prediction ──
  const elasticityDiagnosis = useMemo(() => {
    if (!singleResult) return null;
    const t10 = singleResult.tau_hat_10;
    const t20 = singleResult.tau_hat_20;
    const diff = t20 - t10;
    const diffPP = diff * 100;

    const cartVal = Number(form.cart_baseline_value_inr) || 1000;
    // Expected incremental revenue: cartVal * uplift
    const expRev10 = cartVal * Math.max(0, t10);
    const expRev20 = cartVal * Math.max(0, t20);
    // Net profit after coupon cost: expRev - coupon
    const netProfit10 = expRev10 - 10;
    const netProfit20 = expRev20 - 20;

    let recommendation = '₹10 Discount';
    let alertClass = 'optimal-10';
    let reasoning = '';

    if (t10 <= 0 && t20 <= 0) {
      recommendation = '₹0 Control (Suppress Discount)';
      alertClass = 'no-discount';
      reasoning =
        'Customer exhibits negligible or non-positive causal response. Suppressing promotional offers protects margin from deadweight loss.';
    } else if (t10 >= t20) {
      recommendation = '₹10 Discount (Cost-Optimal)';
      alertClass = 'optimal-10';
      reasoning =
        'Diminishing causal returns / saturation detected: ₹10 discount achieves higher or equivalent purchase uplift than ₹20, recommending the ₹10 offer to preserve budget.';
    } else if (diffPP < 3.0 && netProfit10 >= netProfit20) {
      recommendation = '₹10 Discount (Profit-Optimal)';
      alertClass = 'optimal-10';
      reasoning = `The ₹20 discount provides only a modest +${diffPP.toFixed(2)} pp incremental uplift over ₹10, which does not economically justify the extra ₹10 expenditure on cart size ₹${cartVal.toLocaleString('en-IN')}.`;
    } else {
      recommendation = '₹20 Discount (Volume-Maximizing)';
      alertClass = 'optimal-20';
      reasoning = `Customer displays strong incremental price sensitivity with +${diffPP.toFixed(2)} pp additional uplift from the deeper ₹20 promotional tier.`;
    }

    return {
      t10,
      t20,
      diffPP,
      cartVal,
      recommendation,
      alertClass,
      reasoning,
    };
  }, [singleResult, form.cart_baseline_value_inr]);

  return (
    <div className="cate-studio-container" data-theme={theme}>
      {/* ── Top Header Banner ── */}
      <section className="cate-header-banner" aria-labelledby="cate-heading">
        <div className="cate-eyebrow">
          <Zap size={15} />
          <span>CAUSAL INFERENCE &amp; DOUBLE ML • LIVE INFERENCE ENGINE</span>
        </div>
        <div className="cate-header-row">
          <div>
            <h1 id="cate-heading" className="cate-title">
              CATE Prediction Studio &amp; Uplift Estimator
            </h1>
            <p className="cate-subtitle">
              Estimate customer-level Conditional Average Treatment Effects (τ̂₁₀, τ̂₂₀) for real-time customer feature
              vectors using fitted EconML LinearDML artifacts.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className="cate-reset-btn"
              onClick={fetchCateSummary}
              disabled={isSummaryLoading}
              title="Refresh CATE distribution from backend artifact"
            >
              <RefreshCw size={14} className={isSummaryLoading ? 'cate-loading-spinner' : ''} />
              <span>Refresh Baseline</span>
            </button>
          </div>
        </div>

        <div className="cate-badges-row">
          <span className="cate-badge primary">
            <Cpu size={13} />
            <span>Estimator: LinearDML (5-fold cross-fitting)</span>
          </span>
          <span className="cate-badge success">
            <ShieldCheck size={13} />
            <span>Anti-Leakage Certified: Pretreatment Covariates Only</span>
          </span>
          <span className="cate-badge">
            <TrendingUp size={13} />
            <span>Estimand: Incremental Purchase Probability Uplift (pp vs ₹0)</span>
          </span>
          {cateSummary?.total_records && (
            <span className="cate-badge">
              <Users size={13} />
              <span>Population Baseline: {cateSummary.total_records.toLocaleString('en-US')} Shoppers</span>
            </span>
          )}
        </div>
      </section>

      {/* ── Workspace Sub-Tabs ── */}
      <nav className="cate-nav-tabs" aria-label="CATE Prediction sub-views">
        <button
          type="button"
          className={`cate-tab-btn ${activeSubTab === 'individual' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('individual')}
          aria-selected={activeSubTab === 'individual'}
        >
          <Calculator size={16} />
          <span>Individual &amp; Batch Inference</span>
        </button>
        <button
          type="button"
          className={`cate-tab-btn ${activeSubTab === 'population' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('population')}
          aria-selected={activeSubTab === 'population'}
        >
          <BarChart2 size={16} />
          <span>Benchmark CATE Distribution (GET /api/causal/cate)</span>
        </button>
      </nav>

      {/* ════════════════════════════════════════════════════════════════════════
          VIEW 1: INDIVIDUAL & BATCH INFERENCE STUDIO
         ════════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'individual' && (
        <div className="cate-layout-grid">
          {/* ── Left Column: Form & Archetypes ── */}
          <div className="cate-card">
            <div className="cate-card-header">
              <h2 className="cate-card-title">
                <Calculator size={18} color="var(--color-primary)" />
                <span>Customer Pretreatment Covariates</span>
              </h2>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className={`cate-segmented-btn ${predictionMode === 'single' ? 'active' : ''}`}
                  onClick={() => setPredictionMode('single')}
                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                >
                  Single
                </button>
                <button
                  type="button"
                  className={`cate-segmented-btn ${predictionMode === 'batch_presets' ? 'active' : ''}`}
                  onClick={() => {
                    setPredictionMode('batch_presets');
                    handleSubmitBatchArchetypes();
                  }}
                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                >
                  Batch Archetypes
                </button>
              </div>
            </div>

            {/* Presets Box */}
            <div className="cate-presets-box">
              <div className="cate-presets-label">
                <Layers size={13} />
                <span>Quick Archetype Profiles</span>
              </div>
              <div className="cate-presets-pills">
                {CUSTOMER_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`cate-preset-pill ${activePresetId === p.id && predictionMode === 'single' ? 'active' : ''}`}
                    onClick={() => {
                      setPredictionMode('single');
                      handleSelectPreset(p);
                    }}
                    title={p.desc}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Form */}
            <form className="cate-form" onSubmit={handleSubmitSingle} noValidate>
              {/* Optional Customer ID (Metadata only) */}
              <div className="cate-field-group">
                <label htmlFor="customer_id">
                  <span>Customer Identifier (Optional Metadata)</span>
                  <span className="cate-field-hint">Not passed to model matrix</span>
                </label>
                <input
                  id="customer_id"
                  type="text"
                  className="cate-input"
                  placeholder="e.g., CUST_004521"
                  value={form.customer_id ?? ''}
                  onChange={(e) => handleFieldChange('customer_id', e.target.value)}
                />
              </div>

              {/* Age */}
              <div className="cate-field-group">
                <label htmlFor="age">
                  <span>Shopper Age (Years)</span>
                  <span className="cate-field-hint">Dataset Range: 18 – 72</span>
                </label>
                <input
                  id="age"
                  type="number"
                  min="18"
                  max="100"
                  step="1"
                  required
                  className={`cate-input ${formErrors.age ? 'error' : ''}`}
                  value={form.age}
                  onChange={(e) => handleFieldChange('age', e.target.value)}
                />
                {formErrors.age && <span className="cate-field-error">{formErrors.age}</span>}
              </div>

              {/* Monthly Income INR */}
              <div className="cate-field-group">
                <label htmlFor="monthly_income_inr">
                  <span>Monthly Income (INR ₹)</span>
                  <span className="cate-field-hint">Median: ₹48,247</span>
                </label>
                <input
                  id="monthly_income_inr"
                  type="number"
                  min="5000"
                  max="2000000"
                  step="1000"
                  required
                  className={`cate-input ${formErrors.monthly_income_inr ? 'error' : ''}`}
                  value={form.monthly_income_inr}
                  onChange={(e) => handleFieldChange('monthly_income_inr', e.target.value)}
                />
                {formErrors.monthly_income_inr && (
                  <span className="cate-field-error">{formErrors.monthly_income_inr}</span>
                )}
              </div>

              {/* Grid 2 Cols: Visits & Past Purchases */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="cate-field-group">
                  <label htmlFor="web_visits_last_30d">
                    <span>Web Visits (30d)</span>
                    <span className="cate-field-hint">Mean: 6.5</span>
                  </label>
                  <input
                    id="web_visits_last_30d"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    required
                    className={`cate-input ${formErrors.web_visits_last_30d ? 'error' : ''}`}
                    value={form.web_visits_last_30d}
                    onChange={(e) => handleFieldChange('web_visits_last_30d', e.target.value)}
                  />
                  {formErrors.web_visits_last_30d && (
                    <span className="cate-field-error">{formErrors.web_visits_last_30d}</span>
                  )}
                </div>

                <div className="cate-field-group">
                  <label htmlFor="past_purchases_count">
                    <span>Lifetime Orders</span>
                    <span className="cate-field-hint">Mean: 3.7</span>
                  </label>
                  <input
                    id="past_purchases_count"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    required
                    className={`cate-input ${formErrors.past_purchases_count ? 'error' : ''}`}
                    value={form.past_purchases_count}
                    onChange={(e) => handleFieldChange('past_purchases_count', e.target.value)}
                  />
                  {formErrors.past_purchases_count && (
                    <span className="cate-field-error">{formErrors.past_purchases_count}</span>
                  )}
                </div>
              </div>

              {/* Grid 2 Cols: Recency & Cart Baseline */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="cate-field-group">
                  <label htmlFor="days_since_last_purchase">
                    <span>Recency (Days)</span>
                    <span className="cate-field-hint">Mean: 44.4</span>
                  </label>
                  <input
                    id="days_since_last_purchase"
                    type="number"
                    min="1"
                    max="730"
                    step="1"
                    required
                    className={`cate-input ${formErrors.days_since_last_purchase ? 'error' : ''}`}
                    value={form.days_since_last_purchase}
                    onChange={(e) => handleFieldChange('days_since_last_purchase', e.target.value)}
                  />
                  {formErrors.days_since_last_purchase && (
                    <span className="cate-field-error">{formErrors.days_since_last_purchase}</span>
                  )}
                </div>

                <div className="cate-field-group">
                  <label htmlFor="cart_baseline_value_inr">
                    <span>Cart Value (₹)</span>
                    <span className="cate-field-hint">Range: ₹400-₹5k</span>
                  </label>
                  <input
                    id="cart_baseline_value_inr"
                    type="number"
                    min="50"
                    max="50000"
                    step="50"
                    required
                    className={`cate-input ${formErrors.cart_baseline_value_inr ? 'error' : ''}`}
                    value={form.cart_baseline_value_inr}
                    onChange={(e) => handleFieldChange('cart_baseline_value_inr', e.target.value)}
                  />
                  {formErrors.cart_baseline_value_inr && (
                    <span className="cate-field-error">{formErrors.cart_baseline_value_inr}</span>
                  )}
                </div>
              </div>

              {/* Loyalty Status (0 or 1) */}
              <div className="cate-field-group">
                <label>
                  <span>Loyalty Club Membership</span>
                  <span className="cate-field-hint">Confounder Variable</span>
                </label>
                <div className="cate-segmented-control" role="group" aria-label="Loyalty status">
                  <button
                    type="button"
                    className={`cate-segmented-btn ${Number(form.loyalty_member) === 0 ? 'active' : ''}`}
                    onClick={() => handleFieldChange('loyalty_member', 0)}
                  >
                    Non-Loyal (0)
                  </button>
                  <button
                    type="button"
                    className={`cate-segmented-btn ${Number(form.loyalty_member) === 1 ? 'active' : ''}`}
                    onClick={() => handleFieldChange('loyalty_member', 1)}
                  >
                    Loyalty Member (1)
                  </button>
                </div>
              </div>

              {/* Device Type (Mobile, Desktop, Tablet) */}
              <div className="cate-field-group">
                <label>
                  <span>Primary Shopper Device</span>
                  <span className="cate-field-hint">One-Hot Pretreatment Feature</span>
                </label>
                <div className="cate-segmented-control" role="group" aria-label="Device type">
                  {['Mobile', 'Desktop', 'Tablet'].map((dev) => (
                    <button
                      key={dev}
                      type="button"
                      className={`cate-segmented-btn ${form.device_type === dev ? 'active' : ''}`}
                      onClick={() => handleFieldChange('device_type', dev)}
                    >
                      {dev}
                    </button>
                  ))}
                </div>
              </div>

              {/* Confidence Interval Checkbox */}
              <div
                className="cate-checkbox-row"
                onClick={() => setReturnIntervals(!returnIntervals)}
                role="checkbox"
                aria-checked={returnIntervals}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') setReturnIntervals(!returnIntervals);
                }}
              >
                <input
                  type="checkbox"
                  id="return_intervals"
                  className="cate-checkbox"
                  checked={returnIntervals}
                  onChange={(e) => setReturnIntervals(e.target.checked)}
                />
                <div className="cate-checkbox-label">
                  <span>Compute 95% Confidence Intervals</span>
                  <span className="cate-checkbox-sub">
                    Calculated via EconML effect_interval asymptotic variance bounds
                  </span>
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="cate-form-actions">
                <button
                  type="submit"
                  className="cate-submit-btn"
                  disabled={isPredicting}
                  id="cate-predict-submit-btn"
                >
                  {isPredicting ? (
                    <>
                      <span className="cate-loading-spinner" />
                      <span>Computing CATE Effect...</span>
                    </>
                  ) : (
                    <>
                      <Zap size={16} />
                      <span>Estimate Individual CATE</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="cate-reset-btn"
                  onClick={() => {
                    handleSelectPreset(CUSTOMER_PRESETS[3]);
                  }}
                  title="Reset to benchmark population median customer"
                >
                  <RotateCcw size={15} />
                  <span>Reset</span>
                </button>
              </div>
            </form>
          </div>

          {/* ── Right Column: Live Results Display ── */}
          <div className="cate-results-panel">
            {/* Disclaimer & Unit Interpretation Alert */}
            <div className="cate-disclaimer-box" role="note">
              <Info size={18} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>CATE Estimand &amp; Probability Interpretation:</strong>
                <div>
                  Values represent estimated percentage-point (pp) conversion probability differences relative to the
                  ₹0 control baseline (e.g. +15.70 pp indicates expected conversion increases from e.g. 20.0% to 35.7%).
                  These are causal uplift estimates, not direct rupee revenue or guaranteed outcomes.
                </div>
              </div>
            </div>

            {/* Error Banner with Retry */}
            {predictionError && (
              <div className="cate-error-banner" role="alert">
                <AlertCircle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <strong>Prediction Failed</strong>
                  <div>{predictionError}</div>
                  <button
                    type="button"
                    className="cate-retry-btn"
                    onClick={() => {
                      if (lastSubmittedPayload) executePrediction(lastSubmittedPayload);
                      else handleSubmitSingle();
                    }}
                  >
                    <RefreshCw size={13} />
                    <span>Retry Request</span>
                  </button>
                </div>
              </div>
            )}

            {/* Loading Indicator Overlay */}
            {isPredicting && (
              <div className="cate-empty-state">
                <div className="cate-loading-spinner" style={{ width: 32, height: 32, borderTopColor: 'var(--color-primary)' }} />
                <h3 style={{ margin: '8px 0 2px', color: 'var(--text-primary)' }}>Evaluating Fitted EconML Estimator</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Passing pretreatment feature vector X through 5-fold cross-fitted DML orthogonal residual matrices...
                </p>
              </div>
            )}

            {/* Single Customer Results */}
            {!isPredicting && predictionResponse && predictionMode === 'single' && singleResult && (
              <>
                <div className="cate-uplift-grid">
                  {/* Arm ₹10 Card */}
                  <div className="cate-uplift-card arm-10">
                    <div className="cate-uplift-card-header">
                      <div>
                        <span className="cate-arm-label">TREATMENT CONTRAST</span>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          ₹10 Discount vs ₹0
                        </div>
                      </div>
                      <span className="cate-arm-tag">τ̂₁₀ Uplift</span>
                    </div>

                    <div className={`cate-uplift-number ${singleResult.tau_hat_10 >= 0 ? 'positive' : 'negative'}`}>
                      <span>{formatPP(singleResult.tau_hat_10)}</span>
                    </div>

                    <div className="cate-uplift-interp">
                      Estimated purchase conversion probability uplift relative to organic baseline.
                    </div>

                    {/* 95% Confidence Interval */}
                    {singleResult.tau_hat_10_ci_95 ? (
                      <div className="cate-ci-box">
                        <div className="cate-ci-header">
                          <span>95% Asymptotic CI</span>
                          <span className="cate-ci-range-val">
                            [{formatPP(singleResult.tau_hat_10_ci_95[0])},{' '}
                            {formatPP(singleResult.tau_hat_10_ci_95[1])}]
                          </span>
                        </div>

                        {/* Visual Range Bar (-5% to +40% domain) */}
                        <div className="cate-ci-bar-track">
                          {(() => {
                            const minDomain = -0.05;
                            const maxDomain = 0.4;
                            const range = maxDomain - minDomain;
                            const lowPct = Math.max(0, Math.min(100, ((singleResult.tau_hat_10_ci_95[0] - minDomain) / range) * 100));
                            const highPct = Math.max(0, Math.min(100, ((singleResult.tau_hat_10_ci_95[1] - minDomain) / range) * 100));
                            const ptPct = Math.max(0, Math.min(100, ((singleResult.tau_hat_10 - minDomain) / range) * 100));
                            return (
                              <>
                                <div
                                  className="cate-ci-bar-fill"
                                  style={{ left: `${lowPct}%`, width: `${Math.max(2, highPct - lowPct)}%` }}
                                />
                                <div className="cate-ci-point-dot" style={{ left: `${ptPct}%` }} />
                              </>
                            );
                          })()}
                        </div>
                        <div className="cate-ci-ticks">
                          <span>-5 pp</span>
                          <span>+15 pp</span>
                          <span>+40 pp</span>
                        </div>
                      </div>
                    ) : (
                      <div className="cate-ci-box" style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                        Confidence intervals were not requested for this query.
                      </div>
                    )}
                  </div>

                  {/* Arm ₹20 Card */}
                  <div className="cate-uplift-card arm-20">
                    <div className="cate-uplift-card-header">
                      <div>
                        <span className="cate-arm-label">TREATMENT CONTRAST</span>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          ₹20 Discount vs ₹0
                        </div>
                      </div>
                      <span className="cate-arm-tag">τ̂₂₀ Uplift</span>
                    </div>

                    <div className={`cate-uplift-number ${singleResult.tau_hat_20 >= 0 ? 'positive' : 'negative'}`}>
                      <span>{formatPP(singleResult.tau_hat_20)}</span>
                    </div>

                    <div className="cate-uplift-interp">
                      Estimated purchase conversion probability uplift relative to organic baseline.
                    </div>

                    {/* 95% Confidence Interval */}
                    {singleResult.tau_hat_20_ci_95 ? (
                      <div className="cate-ci-box">
                        <div className="cate-ci-header">
                          <span>95% Asymptotic CI</span>
                          <span className="cate-ci-range-val">
                            [{formatPP(singleResult.tau_hat_20_ci_95[0])},{' '}
                            {formatPP(singleResult.tau_hat_20_ci_95[1])}]
                          </span>
                        </div>

                        {/* Visual Range Bar (-5% to +40% domain) */}
                        <div className="cate-ci-bar-track">
                          {(() => {
                            const minDomain = -0.05;
                            const maxDomain = 0.4;
                            const range = maxDomain - minDomain;
                            const lowPct = Math.max(0, Math.min(100, ((singleResult.tau_hat_20_ci_95[0] - minDomain) / range) * 100));
                            const highPct = Math.max(0, Math.min(100, ((singleResult.tau_hat_20_ci_95[1] - minDomain) / range) * 100));
                            const ptPct = Math.max(0, Math.min(100, ((singleResult.tau_hat_20 - minDomain) / range) * 100));
                            return (
                              <>
                                <div
                                  className="cate-ci-bar-fill"
                                  style={{ left: `${lowPct}%`, width: `${Math.max(2, highPct - lowPct)}%` }}
                                />
                                <div className="cate-ci-point-dot" style={{ left: `${ptPct}%` }} />
                              </>
                            );
                          })()}
                        </div>
                        <div className="cate-ci-ticks">
                          <span>-5 pp</span>
                          <span>+15 pp</span>
                          <span>+40 pp</span>
                        </div>
                      </div>
                    ) : (
                      <div className="cate-ci-box" style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                        Confidence intervals were not requested for this query.
                      </div>
                    )}
                  </div>
                </div>

                {/* Comparative Analysis & Strategic Diagnosis */}
                {elasticityDiagnosis && (
                  <div className="cate-strategy-card">
                    <div className="cate-strategy-header">
                      <h3 className="cate-strategy-title">
                        <TrendingUp size={18} color="var(--color-primary)" />
                        <span>Incremental Responsiveness &amp; Policy Recommendation</span>
                      </h3>
                      <span className="cate-badge" style={{ fontSize: '0.72rem' }}>
                        Target Customer: {singleResult.customer_id || 'Individual Customer Profile'}
                      </span>
                    </div>

                    <div className="cate-comparison-metrics">
                      <div className="cate-metric-box">
                        <div className="cate-metric-box-label">Marginal ₹20 vs ₹10 Gain</div>
                        <div
                          className="cate-metric-box-val"
                          style={{
                            color: elasticityDiagnosis.diffPP > 0 ? 'var(--color-success)' : 'var(--color-danger)',
                          }}
                        >
                          {elasticityDiagnosis.diffPP > 0 ? '+' : ''}
                          {elasticityDiagnosis.diffPP.toFixed(2)} pp
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                          {elasticityDiagnosis.diffPP > 0
                            ? 'Positive incremental elasticity'
                            : 'Saturation / Diminishing returns'}
                        </div>
                      </div>

                      <div className="cate-metric-box">
                        <div className="cate-metric-box-label">Optimal Action</div>
                        <div className="cate-metric-box-val" style={{ color: 'var(--color-primary)' }}>
                          {elasticityDiagnosis.recommendation}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                          Based on basket value ₹{elasticityDiagnosis.cartVal.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    <div className={`cate-recommendation-alert ${elasticityDiagnosis.alertClass}`}>
                      <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                      <div>
                        <strong>Economic Rationale: </strong>
                        <span>{elasticityDiagnosis.reasoning}</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Batch Archetype Results Table */}
            {!isPredicting && predictionResponse && predictionMode === 'batch_presets' && (
              <div className="cate-card">
                <div className="cate-card-header">
                  <h3 className="cate-card-title">
                    <Users size={18} color="var(--color-primary)" />
                    <span>Cohort CATE Predictions Comparison ({predictionResponse.total_records} Archetypes)</span>
                  </h3>
                  <button
                    type="button"
                    className="cate-reset-btn"
                    onClick={handleSubmitBatchArchetypes}
                    style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                  >
                    <RefreshCw size={13} />
                    <span>Re-evaluate Cohort</span>
                  </button>
                </div>

                <div className="cate-batch-table-wrap">
                  <table className="cate-table">
                    <thead>
                      <tr>
                        <th>Customer ID</th>
                        <th>Archetype</th>
                        <th>Income (₹)</th>
                        <th>Device</th>
                        <th>Loyalty</th>
                        <th>τ̂₁₀ Uplift (₹10 vs ₹0)</th>
                        <th>τ̂₁₀ 95% CI</th>
                        <th>τ̂₂₀ Uplift (₹20 vs ₹0)</th>
                        <th>τ̂₂₀ 95% CI</th>
                        <th>Optimal Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {predictionResponse.predictions.map((pred, idx) => {
                        const preset = CUSTOMER_PRESETS[idx] || {};
                        const diffPP = (pred.tau_hat_20 - pred.tau_hat_10) * 100;
                        const rec =
                          pred.tau_hat_10 <= 0 && pred.tau_hat_20 <= 0
                            ? '₹0 Control'
                            : pred.tau_hat_10 >= pred.tau_hat_20
                            ? '₹10 Offer'
                            : diffPP >= 3.0
                            ? '₹20 Offer'
                            : '₹10 Offer';

                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                              {pred.customer_id || `CUST_${idx + 1}`}
                            </td>
                            <td>
                              <span style={{ fontWeight: 600 }}>{preset.name ?? 'Custom'}</span>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{preset.badge}</div>
                            </td>
                            <td>₹{Number(preset.data?.monthly_income_inr ?? 0).toLocaleString('en-IN')}</td>
                            <td>{preset.data?.device_type}</td>
                            <td>{preset.data?.loyalty_member ? 'Member' : 'Non-Loyal'}</td>
                            <td
                              style={{
                                fontWeight: 700,
                                color: pred.tau_hat_10 >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
                              }}
                            >
                              {formatPP(pred.tau_hat_10)}
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                              {pred.tau_hat_10_ci_95
                                ? `[${formatPP(pred.tau_hat_10_ci_95[0])}, ${formatPP(pred.tau_hat_10_ci_95[1])}]`
                                : '—'}
                            </td>
                            <td
                              style={{
                                fontWeight: 700,
                                color: pred.tau_hat_20 >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
                              }}
                            >
                              {formatPP(pred.tau_hat_20)}
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                              {pred.tau_hat_20_ci_95
                                ? `[${formatPP(pred.tau_hat_20_ci_95[0])}, ${formatPP(pred.tau_hat_20_ci_95[1])}]`
                                : '—'}
                            </td>
                            <td>
                              <span
                                className="cate-badge"
                                style={{
                                  background:
                                    rec === '₹20 Offer'
                                      ? 'var(--color-primary-light)'
                                      : rec === '₹10 Offer'
                                      ? '#EFF6FF'
                                      : 'var(--bg-badge)',
                                  color:
                                    rec === '₹20 Offer'
                                      ? 'var(--color-primary)'
                                      : rec === '₹10 Offer'
                                      ? '#1D4ED8'
                                      : 'var(--text-secondary)',
                                  fontWeight: 700,
                                }}
                              >
                                {rec}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          VIEW 2: POPULATION CATE DISTRIBUTION & SEGMENTS (GET /api/causal/cate)
         ════════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'population' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {isSummaryLoading && (
            <div className="cate-empty-state">
              <div className="cate-loading-spinner" style={{ width: 32, height: 32, borderTopColor: 'var(--color-primary)' }} />
              <p>Loading verified CATE population distribution from /api/causal/cate...</p>
            </div>
          )}

          {summaryError && (
            <div className="cate-error-banner" role="alert">
              <AlertCircle size={20} style={{ flexShrink: 0 }} />
              <div>
                <strong>Failed to load CATE summary</strong>
                <div>{summaryError}</div>
                <button type="button" className="cate-retry-btn" onClick={fetchCateSummary}>
                  <RefreshCw size={13} />
                  <span>Retry</span>
                </button>
              </div>
            </div>
          )}

          {!isSummaryLoading && cateSummary && (
            <>
              {/* Summary Metadata Card */}
              <div className="cate-card">
                <div className="cate-card-header">
                  <h2 className="cate-card-title">
                    <BarChart2 size={18} color="var(--color-primary)" />
                    <span>Verified CATE Prediction Artifact Metadata</span>
                  </h2>
                  <span className="cate-badge success">Status: Verified Artifact</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                  <div className="cate-metric-box">
                    <div className="cate-metric-box-label">Evaluated Population</div>
                    <div className="cate-metric-box-val">{cateSummary.total_records?.toLocaleString('en-US')} Customers</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                      Artifact: {cateSummary.artifact_path}
                    </div>
                  </div>

                  <div className="cate-metric-box">
                    <div className="cate-metric-box-label">Causal Estimand</div>
                    <div className="cate-metric-box-val" style={{ fontSize: '1rem', color: 'var(--color-primary)' }}>
                      Incremental Purchase Uplift
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                      Conversion probability differences (pp)
                    </div>
                  </div>

                  <div className="cate-metric-box">
                    <div className="cate-metric-box-label">Average Population Uplift (₹10)</div>
                    <div className="cate-metric-box-val" style={{ color: 'var(--color-success)' }}>
                      {formatPP(cateSummary.tau_hat_10?.mean)}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                      Std Dev: {formatPP(cateSummary.tau_hat_10?.std, false)}
                    </div>
                  </div>

                  <div className="cate-metric-box">
                    <div className="cate-metric-box-label">Average Population Uplift (₹20)</div>
                    <div className="cate-metric-box-val" style={{ color: 'var(--color-success)' }}>
                      {formatPP(cateSummary.tau_hat_20?.mean)}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                      Std Dev: {formatPP(cateSummary.tau_hat_20?.std, false)}
                    </div>
                  </div>
                </div>

                <div className="cate-disclaimer-box">
                  <Info size={16} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>{cateSummary.disclaimer}</div>
                </div>
              </div>

              {/* Statistical Distribution Quartiles */}
              <div className="cate-summary-grid">
                {/* ₹10 Distribution Card */}
                <div className="cate-stat-card">
                  <div className="cate-stat-card-title">
                    <span>τ̂₁₀ Distribution (₹10 Discount vs ₹0)</span>
                    <span className="cate-badge" style={{ background: '#E0F2FE', color: '#0369A1' }}>Arm 10</span>
                  </div>

                  <div className="cate-stat-kv-list">
                    <div className="cate-stat-kv">
                      <span className="cate-stat-k">Mean Effect</span>
                      <span className="cate-stat-v">{formatPP(cateSummary.tau_hat_10?.mean)}</span>
                    </div>
                    <div className="cate-stat-kv">
                      <span className="cate-stat-k">Median (P50)</span>
                      <span className="cate-stat-v">{formatPP(cateSummary.tau_hat_10?.median)}</span>
                    </div>
                    <div className="cate-stat-kv">
                      <span className="cate-stat-k">Std Deviation</span>
                      <span className="cate-stat-v">{formatPP(cateSummary.tau_hat_10?.std, false)}</span>
                    </div>
                    <div className="cate-stat-kv">
                      <span className="cate-stat-k">Interquartile (IQR)</span>
                      <span className="cate-stat-v">
                        {formatPP(cateSummary.tau_hat_10?.q25)} – {formatPP(cateSummary.tau_hat_10?.q75)}
                      </span>
                    </div>
                    <div className="cate-stat-kv">
                      <span className="cate-stat-k">Minimum Effect</span>
                      <span className="cate-stat-v">{formatPP(cateSummary.tau_hat_10?.min)}</span>
                    </div>
                    <div className="cate-stat-kv">
                      <span className="cate-stat-k">Maximum Effect</span>
                      <span className="cate-stat-v">{formatPP(cateSummary.tau_hat_10?.max)}</span>
                    </div>
                  </div>
                </div>

                {/* ₹20 Distribution Card */}
                <div className="cate-stat-card">
                  <div className="cate-stat-card-title">
                    <span>τ̂₂₀ Distribution (₹20 Discount vs ₹0)</span>
                    <span className="cate-badge primary">Arm 20</span>
                  </div>

                  <div className="cate-stat-kv-list">
                    <div className="cate-stat-kv">
                      <span className="cate-stat-k">Mean Effect</span>
                      <span className="cate-stat-v">{formatPP(cateSummary.tau_hat_20?.mean)}</span>
                    </div>
                    <div className="cate-stat-kv">
                      <span className="cate-stat-k">Median (P50)</span>
                      <span className="cate-stat-v">{formatPP(cateSummary.tau_hat_20?.median)}</span>
                    </div>
                    <div className="cate-stat-kv">
                      <span className="cate-stat-k">Std Deviation</span>
                      <span className="cate-stat-v">{formatPP(cateSummary.tau_hat_20?.std, false)}</span>
                    </div>
                    <div className="cate-stat-kv">
                      <span className="cate-stat-k">Interquartile (IQR)</span>
                      <span className="cate-stat-v">
                        {formatPP(cateSummary.tau_hat_20?.q25)} – {formatPP(cateSummary.tau_hat_20?.q75)}
                      </span>
                    </div>
                    <div className="cate-stat-kv">
                      <span className="cate-stat-k">Minimum Effect</span>
                      <span className="cate-stat-v">{formatPP(cateSummary.tau_hat_20?.min)}</span>
                    </div>
                    <div className="cate-stat-kv">
                      <span className="cate-stat-k">Maximum Effect</span>
                      <span className="cate-stat-v">{formatPP(cateSummary.tau_hat_20?.max)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Subgroup Heterogeneity Breakdown Table */}
              {cateSummary.segments && cateSummary.segments.length > 0 && (
                <div className="cate-card">
                  <div className="cate-card-header">
                    <h3 className="cate-card-title">
                      <TrendingUp size={18} color="var(--color-primary)" />
                      <span>Subgroup CATE Heterogeneity Breakdown (Segments)</span>
                    </h3>
                    <span className="cate-badge">Evaluated on Cleaned Covariates</span>
                  </div>

                  <div className="cate-batch-table-wrap">
                    <table className="cate-table">
                      <thead>
                        <tr>
                          <th>Segment Dimension</th>
                          <th>Customer Subgroup</th>
                          <th>Cohort Size</th>
                          <th>Mean τ̂₁₀ Uplift</th>
                          <th>Median τ̂₁₀ Uplift</th>
                          <th>Mean τ̂₂₀ Uplift</th>
                          <th>Median τ̂₂₀ Uplift</th>
                          <th>Incremental ₹20 vs ₹10 Gain</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cateSummary.segments.map((seg, idx) => {
                          const diffMean = (seg.mean_tau_hat_20 - seg.mean_tau_hat_10) * 100;
                          return (
                            <tr key={idx}>
                              <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                                {seg.segment_category}
                              </td>
                              <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{seg.segment}</td>
                              <td>{seg.count?.toLocaleString('en-US')} shoppers</td>
                              <td style={{ fontWeight: 700, color: '#0369A1' }}>{formatPP(seg.mean_tau_hat_10)}</td>
                              <td>{formatPP(seg.median_tau_hat_10)}</td>
                              <td style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                                {formatPP(seg.mean_tau_hat_20)}
                              </td>
                              <td>{formatPP(seg.median_tau_hat_20)}</td>
                              <td
                                style={{
                                  fontWeight: 700,
                                  color: diffMean > 0 ? 'var(--color-success)' : 'var(--color-danger)',
                                }}
                              >
                                {diffMean > 0 ? '+' : ''}
                                {diffMean.toFixed(2)} pp
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
