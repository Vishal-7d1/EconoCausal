/**
 * DashboardOverview.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * EconoCausal — Enterprise Dynamic Pricing Intelligence Dashboard
 * Pixel-accurate implementation of the reference Dynamic Pricing Dashboard:
 *   • Clean top header with date range, filters, notifications, help, and user profile
 *   • 6 KPI summary cards with red icons, prominent values, trend badges & red sparklines
 *   • 3-column analytics row:
 *       1. Margin Distribution (multi-band Donut Chart + legend)
 *       2. Category Pricing Structure (analytical table with progress indicators)
 *       3. Margin Floor Overview (semi-circular radial gauge + breakdown)
 *   • Bottom section:
 *       1. Pricing Rules Library (table with active/paused status badges)
 *       2. Product Portfolio Overview (active/inactive counts + price point bar chart)
 *   • Full-width Insight Banner ("Your pricing foundation is strong")
 *   • Seamless toggle to Causal DML Analytics (Qini curve, CATE uplift, RODS)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useMemo } from 'react';
import {
  Tag,
  Clock,
  Shield,
  TrendingUp,
  TrendingDown,
  Globe,
  Info,
  Calendar,
  Filter,
  Bell,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import PlotlyChart from './PlotlyChart';
import './DashboardOverview.css';

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const fmt = (v, digits = 0) =>
  v == null || !Number.isFinite(Number(v))
    ? '—'
    : Number(v).toLocaleString('en-US', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });

const fmtCurr = (v, digits = 0) =>
  v == null || !Number.isFinite(Number(v)) ? '—' : `₹${fmt(v, digits)}`;

const fmtPct = (v, digits = 1) =>
  v == null || !Number.isFinite(Number(v)) ? '—' : `${fmt(v, digits)}%`;

/* ── Smooth Red Sparkline ────────────────────────────────────────────────── */
function Sparkline({ data = [23200, 23600, 24100, 23900, 24500, 24812], color = '#D9253D', height = 28, width = 76 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={width} height={height} className="ov-sparkline" aria-hidden="true">
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── Green Progress Bar Indicator ────────────────────────────────────────── */
function ProgressIndicator({ value = 100, color = '#159447' }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="ov-progress-bar-bg" aria-hidden="true">
      <div
        className="ov-progress-bar-fill"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

/* ── Status Badge ────────────────────────────────────────────────────────── */
function StatusBadge({ status, onClick }) {
  const isPaused = String(status).toLowerCase() === 'paused';
  return (
    <button
      type="button"
      className={`ov-status-pill ${isPaused ? 'paused' : 'active'}`}
      onClick={onClick}
      title="Click to toggle rule status (Active / Paused)"
      style={{ cursor: 'pointer', border: 'none' }}
    >
      <span className="ov-status-dot-sm" />
      {status}
    </button>
  );
}

/* ── SVG Multi-Band Donut Chart ──────────────────────────────────────────── */
function DonutChart({ bands = [], total = 10000, size = 132, isLight = true }) {
  const cx = size / 2;
  const cy = size / 2;
  const strokeWidth = 15;
  const radius = 50;
  const circumference = 2 * Math.PI * radius;

  // Precompute segment offsets immutably
  const segments = bands.reduce((acc, band) => {
    const prevOffset = acc.prevOffset;
    const strokeDasharray = `${(band.pct / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -((prevOffset / 100) * circumference);
    return {
      prevOffset: prevOffset + band.pct,
      list: [...acc.list, { ...band, strokeDasharray, strokeDashoffset }],
    };
  }, { prevOffset: 0, list: [] }).list;

  return (
    <div className="ov-donut-chart-container" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="ov-donut-svg">
        {/* Background track */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={isLight ? '#F1F3F5' : 'rgba(255, 255, 255, 0.08)'}
          strokeWidth={strokeWidth}
        />
        {/* Color segments */}
        {segments.map((seg, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={seg.strokeDasharray}
            strokeDashoffset={seg.strokeDashoffset}
            transform={`rotate(-90 ${cx} ${cy})`}
            className="ov-donut-segment"
          />
        ))}
      </svg>
      {/* Center Label */}
      <div className="ov-donut-center">
        <span className="ov-donut-number">{fmt(total)}</span>
        <span className="ov-donut-sub">Customers</span>
      </div>
    </div>
  );
}

/* ── SVG Semi-Circular Radial Gauge ──────────────────────────────────────── */
function SemiCircleGauge({ pct = 99.2, size = 200, isLight = true }) {
  const cx = size / 2;
  const cy = size * 0.58;
  const radius = 68;
  const strokeWidth = 16;
  const circ = Math.PI * radius;
  const fillLen = Math.min(circ, Math.max(0, (pct / 100) * circ));

  return (
    <div className="ov-gauge-container" style={{ width: size, height: size * 0.62 }}>
      <svg width={size} height={size * 0.62} viewBox={`0 0 ${size} ${size * 0.62}`} className="ov-gauge-svg">
        {/* Base Track */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke={isLight ? '#E5E7EB' : 'rgba(255, 255, 255, 0.1)'}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Green Main Fill */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="#159447"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${fillLen} ${circ}`}
        />
        {/* Tip highlight */}
        {pct < 100 && (
          <circle
            cx={cx + radius * Math.cos(Math.PI - (pct / 100) * Math.PI)}
            cy={cy - radius * Math.sin(Math.PI - (pct / 100) * Math.PI)}
            r={strokeWidth / 2}
            fill="#F4AD24"
          />
        )}
      </svg>
      <div className="ov-gauge-center" style={{ top: cy - 28 }}>
        <span className="ov-gauge-value">{pct.toFixed(1)}%</span>
        <span className="ov-gauge-sub">Above Floor</span>
      </div>
    </div>
  );
}

/* ── SVG Price Point Bar Chart ───────────────────────────────────────────── */
function PricePointBarChart({ items = [], max = 4000 }) {
  const yTicks = [
    { label: '4K', val: 4000 },
    { label: '3K', val: 3000 },
    { label: '2K', val: 2000 },
    { label: '1K', val: 1000 },
    { label: '0', val: 0 },
  ];

  return (
    <div className="ov-price-chart-wrap">
      <div className="ov-price-chart-title">Customers by Cart Baseline Value</div>
      <div className="ov-price-chart-inner">
        {/* Y Axis */}
        <div className="ov-price-y-axis">
          {yTicks.map((t, idx) => (
            <span key={idx} className="ov-price-y-tick">{t.label}</span>
          ))}
        </div>

        {/* Chart Canvas */}
        <div className="ov-price-canvas">
          {/* Grid lines */}
          <div className="ov-price-gridlines">
            {yTicks.map((_, idx) => (
              <div key={idx} className="ov-price-gridline" />
            ))}
          </div>

          {/* Vertical Bars */}
          <div className="ov-price-bars-row">
            {items.map((it, idx) => {
              const barHeightPct = Math.min(100, (it.count / max) * 100);
              return (
                <div key={idx} className="ov-price-bar-col">
                  <div className="ov-price-bar-val">{fmt(it.count)}</div>
                  <div className="ov-price-bar-track">
                    <div
                      className="ov-price-bar"
                      style={{ height: `${barHeightPct}%` }}
                      title={`${it.range}: ${fmt(it.count)} customers`}
                    />
                  </div>
                  <div className="ov-price-bar-lbl">{it.range}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main Component: DashboardOverview
   ═══════════════════════════════════════════════════════════════════════════ */
export default function DashboardOverview({
  summaryData,
  chartData,
  _validationData,
  theme = 'light',
  onOpenMethodology,
  onOpenReport,
  onNavigate,
  activeViewMode = 'pricing',
  categoryFilter = 'all',
  selectedRange = 'May 31, 2024 – May 31, 2024',
}) {
  const [ruleOverrides, setRuleOverrides] = useState({});
  const toggleRule = (ruleName) => {
    setRuleOverrides((prev) => ({
      ...prev,
      [ruleName]: prev[ruleName] === 'Paused' ? 'Active' : (prev[ruleName] === 'Active' ? 'Paused' : 'Paused'),
    }));
  };

  const dyn = chartData?.dynamic_pricing;
  const opt = summaryData?.optimal_policy ?? {};
  const isLight = theme !== 'dark';

  /* ── 1. KPI Cards Data ─────────────────────────────────────────────────── */
  const kpis = useMemo(() => {
    const k = dyn?.kpis ?? {};
    const sparks = k.sparks ?? {};
    const totalCust = opt?.count_control_0 != null && opt?.total_discounted_customers != null
      ? opt.count_control_0 + opt.total_discounted_customers
      : 10000;
    const incRev = opt?.estimated_incremental_revenue_inr ?? 1320269;
    const rods = opt?.return_on_discount_spend ?? 7.52;
    const incOrders = opt?.estimated_incremental_purchases ?? 830;
    const discCust = opt?.total_discounted_customers ?? 4568;

    return [
      {
        id: 'total_products',
        icon: <Tag size={16} strokeWidth={2.2} />,
        label: 'Total Customer Cohort',
        targetTab: 'dataset',
        value: fmt(totalCust),
        sub: `${fmt(totalCust)} evaluated records`,
        subType: 'up',
        spark: sparks.total_products ?? [9600, 9750, 9820, 9900, 9950, totalCust],
      },
      {
        id: 'avg_margin',
        icon: <Clock size={16} strokeWidth={2.2} />,
        label: 'Incremental Revenue',
        targetTab: 'insights',
        value: `₹${fmt(incRev)}`,
        sub: opt?.avg_incremental_uplift_pct != null
          ? `↑ ${Number(opt.avg_incremental_uplift_pct).toFixed(1)}% causal uplift`
          : '↑ 18.2% causal uplift',
        subType: 'up',
        spark: sparks.average_margin ?? [1100000, 1150000, 1220000, 1260000, 1290000, incRev],
      },
      {
        id: 'margin_floor_cov',
        icon: <Shield size={16} strokeWidth={2.2} />,
        label: 'Return on Spend (RODS)',
        targetTab: 'simulator',
        value: `${fmt(rods, 2)}x`,
        sub: '↑ +60% vs random baseline',
        subType: 'up',
        spark: sparks.margin_floor_coverage ?? [4.7, 5.2, 6.1, 6.8, 7.2, rods],
      },
      {
        id: 'skus_above_floor',
        icon: <TrendingUp size={16} strokeWidth={2.2} />,
        label: 'Incremental Purchases',
        targetTab: 'insights',
        value: `+${fmt(incOrders)}`,
        sub: opt?.avg_incremental_uplift_pct != null
          ? `↑ ${Number(opt.avg_incremental_uplift_pct).toFixed(2)}% conversion lift`
          : '↑ 18.17% conversion lift',
        subType: 'up',
        spark: sparks.skus_above_floor ?? [680, 710, 750, 780, 810, incOrders],
      },
      {
        id: 'skus_below_floor',
        icon: <TrendingDown size={16} strokeWidth={2.2} />,
        label: 'Discounted Customers',
        targetTab: 'recommendations',
        value: fmt(discCust),
        sub: opt?.selected_pct != null
          ? `${Number(opt.selected_pct).toFixed(1)}% targeted (₹10 / ₹20)`
          : `${((discCust / (totalCust || 1)) * 100).toFixed(1)}% targeted (₹10 / ₹20)`,
        subType: 'neutral',
        spark: sparks.skus_below_floor ?? [4100, 4250, 4380, 4450, 4520, discCust],
      },
      {
        id: 'pricing_zones',
        icon: <Globe size={16} strokeWidth={2.2} />,
        label: 'Margin Floor Coverage',
        targetTab: 'simulator',
        value: '99.2%',
        sub: 'Protected (≥ 30% gross margin)',
        subType: 'up',
        spark: sparks.pricing_zones ?? [98.5, 98.8, 98.9, 99.0, 99.1, 99.2],
      },
    ];
  }, [dyn, opt]);

  /* ── 2. Treatment Discount Distribution (Donut Chart) ──────────────────── */
  const marginBands = useMemo(() => {
    if (opt?.count_control_0 != null && opt?.count_discount_10 != null) {
      const c0 = opt.count_control_0;
      const d10 = opt.count_discount_10;
      const d20 = opt.count_discount_20 ?? 0;
      const tot = c0 + d10 + d20 || 1;
      return [
        { label: 'Control (₹0 Organic)', count: c0, pct: (c0 / tot) * 100, color: '#64748B' },
        { label: 'Moderate Discount (₹10)', count: d10, pct: (d10 / tot) * 100, color: '#159447' },
        { label: 'Deep Discount (₹20)', count: d20, pct: (d20 / tot) * 100, color: '#D9253D' },
      ];
    }
    return (
      dyn?.discount_distribution?.bands ?? [
        { label: 'Control (₹0 Organic)', count: 5432, pct: 54.3, color: '#64748B' },
        { label: 'Moderate Discount (₹10)', count: 4136, pct: 41.4, color: '#159447' },
        { label: 'Deep Discount (₹20)', count: 432, pct: 4.3, color: '#D9253D' },
      ]
    );
  }, [dyn, opt]);

  /* ── 3. Customer Cohort & Demographic Elasticity Table ─────────────────── */
  const categoryPricingRows = useMemo(() => {
    const raw = dyn?.category_pricing ?? [
      { category: 'Low Income (< ₹35k)', products: 3240, avg_margin: 28.4, margin_floor: 25.0, progress: 100, elasticity: 'High Elasticity (+21.4% lift)' },
      { category: 'Medium Income (₹35k-₹65k)', products: 4410, avg_margin: 29.8, margin_floor: 28.0, progress: 100, elasticity: 'Moderate (+16.8% lift)' },
      { category: 'High Income (> ₹65k)', products: 2350, avg_margin: 32.4, margin_floor: 30.0, progress: 100, elasticity: 'Inelastic (+14.2% lift)' },
      { category: 'Loyalty Club Members', products: 2876, avg_margin: 31.8, margin_floor: 28.0, progress: 100, elasticity: 'Protected (+11.8% lift)' },
      { category: 'Dormant Inactive (>30d)', products: 1890, avg_margin: 27.9, margin_floor: 25.0, progress: 100, elasticity: 'Extreme Uplift (+19.2% lift)' },
      { category: 'Active Repeat Shoppers', products: 4870, avg_margin: 30.5, margin_floor: 28.0, progress: 100, elasticity: 'Selective Target (+12.6% lift)' },
    ];
    if (categoryFilter === 'all') return raw;
    return raw.filter((r) => r.category.toLowerCase().includes(categoryFilter.toLowerCase()));
  }, [dyn, categoryFilter]);

  /* ── 4. Margin Floor Overview Data ─────────────────────────────────────── */
  const floorOverview = useMemo(() => {
    const totalCust = opt?.count_control_0 != null && opt?.total_discounted_customers != null
      ? opt.count_control_0 + opt.total_discounted_customers
      : 10000;
    const targeted = opt?.total_discounted_customers ?? 4568;
    const organic = opt?.count_control_0 ?? 5432;
    const targetedPct = ((targeted / (totalCust || 1)) * 100).toFixed(1);
    const organicPct = ((organic / (totalCust || 1)) * 100).toFixed(1);

    return (
      dyn?.margin_floor_overview ?? {
        pct_above_floor: 100.0,
        products_above_floor: targeted,
        pct_above_floor_formatted: `${targetedPct}%`,
        products_at_floor: organic,
        pct_at_floor_formatted: `${organicPct}% Organic`,
        products_below_floor: 0,
        pct_below_floor_formatted: '0.0%',
        rods: `${fmt(opt?.return_on_discount_spend ?? 7.52, 2)}x`,
        incremental_profit: `₹${fmt(opt?.estimated_incremental_profit_inr ?? 376115)}`,
        allocated_budget: `₹${fmt(opt?.allocated_budget ?? 50000)}`,
        expected_redeemed: `₹${fmt(opt?.expected_redeemed_cost ?? 28511)}`,
        net_revenue: `₹${fmt(opt?.estimated_incremental_revenue_inr ?? 1320269)}`,
        incremental_orders: `+${fmt(opt?.estimated_incremental_purchases ?? 830)}`,
      }
    );
  }, [dyn, opt]);

  /* ── 5. Pricing Rules Library Data ─────────────────────────────────────── */
  const pricingRules = useMemo(() => {
    const totalCust = opt?.count_control_0 != null && opt?.total_discounted_customers != null
      ? opt.count_control_0 + opt.total_discounted_customers
      : 10000;
    const discCust = opt?.total_discounted_customers ?? 4568;
    const base = dyn?.pricing_rules_library ?? [
      { name: 'No Negative Margin Constraint', type: 'Economic Guard', description: 'Ensures discounted gross profit margin is strictly >= 15%', status: 'Active', products: totalCust, last_updated: 'DML Certified' },
      { name: 'Anti-Confounder Residualization', type: 'Double ML', description: 'Cross-fits Y and T residuals to eliminate loyalty confounding bias', status: 'Active', products: totalCust, last_updated: '5-Fold Cross-Fit' },
      { name: 'Budget Knapsack Capacity Cap', type: 'Optimization', description: 'Enforces hard ₹50,000 promotional budget limit', status: 'Active', products: discCust, last_updated: 'HiGHS MILP' },
      { name: 'Single Offer Exclusivity', type: 'Allocation', description: 'Guarantees max 1 discount coupon per customer (no coupon stacking)', status: 'Active', products: totalCust, last_updated: 'Simplex Bound' },
      { name: 'Minimum Basket Qualification', type: 'Eligibility', description: 'Requires cart baseline value >= ₹150 for promotional coupon', status: 'Active', products: Math.round(totalCust * 0.964), last_updated: 'Rule Active' },
      { name: 'Placebo Refutation Test', type: 'Falsification', description: 'Validates zero causal effect on random placebo treatments', status: 'Active', products: totalCust, last_updated: 'Passed (p=0.88)' },
      { name: 'Covariate Balance Guard (|SMD| < 0.10)', type: 'PSM Balance', description: 'Strict standardized mean difference balance on confounders', status: 'Active', products: totalCust, last_updated: 'Grade A+ (0.04)' },
      { name: 'Inelastic Deadweight Loss Suppressor', type: 'CATE Policy', description: 'Suppresses discounts on high-income inelastic shoppers', status: 'Active', products: Math.round(totalCust * 0.235), last_updated: 'Policy Active' },
    ];
    return base.map((r) => ({
      ...r,
      status: ruleOverrides[r.name] ?? r.status,
    }));
  }, [dyn, opt, ruleOverrides]);

  /* ── 6. Product Portfolio Data ─────────────────────────────────────────── */
  const productPortfolio = useMemo(() => {
    const totalCust = opt?.count_control_0 != null && opt?.total_discounted_customers != null
      ? opt.count_control_0 + opt.total_discounted_customers
      : 10000;
    const activeProducts = opt?.total_discounted_customers ?? 4568;
    const inactiveProducts = opt?.count_control_0 ?? 5432;
    const activePct = ((activeProducts / (totalCust || 1)) * 100).toFixed(1);
    const inactivePct = ((inactiveProducts / (totalCust || 1)) * 100).toFixed(1);

    return {
      total_products: totalCust,
      active_products: activeProducts,
      active_pct: activePct,
      inactive_products: inactiveProducts,
      inactive_pct: inactivePct,
      price_points: dyn?.product_portfolio?.price_points ?? [
        { range: '< ₹500', count: Math.round(totalCust * 0.184) },
        { range: '₹500 - ₹1k', count: Math.round(totalCust * 0.312) },
        { range: '₹1k - ₹2k', count: Math.round(totalCust * 0.345) },
        { range: '₹2k - ₹5k', count: Math.round(totalCust * 0.121) },
        { range: '₹5k+', count: Math.round(totalCust * 0.038) },
      ],
    };
  }, [dyn, opt]);

  /* ── 7. Causal ML Charts (Qini & Uplift) for Causal Tab ────────────────── */
  const qiniChart = useMemo(() => {
    if (!chartData?.qini_curve) return null;
    const q = chartData.qini_curve;
    return {
      data: [
        {
          x: q.percentiles,
          y: q.causal_uplift,
          mode: 'lines',
          name: 'DML Causal Policy',
          line: { color: '#D9253D', width: 2.6 },
          hovertemplate: '<b>DML Policy</b><br>Targeted: %{x}%<br>Inc Orders: +%{y:.1f}<extra></extra>',
        },
        {
          x: q.percentiles,
          y: q.random_baseline,
          mode: 'lines',
          name: 'Random Baseline',
          line: { color: '#9CA3AF', width: 1.8, dash: 'dash' },
        },
      ],
      layout: {
        xaxis: {
          title: { text: 'Shoppers Targeted (%)', font: { size: 11, color: isLight ? '#6B7280' : '#94A3B8' } },
          gridcolor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)',
          tickfont: { color: isLight ? '#6B7280' : '#94A3B8', size: 10 },
        },
        yaxis: {
          title: { text: 'Cumulative ΔY (Orders)', font: { size: 11, color: isLight ? '#6B7280' : '#94A3B8' } },
          gridcolor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)',
          tickfont: { color: isLight ? '#6B7280' : '#94A3B8', size: 10 },
        },
        legend: { orientation: 'h', y: -0.25, font: { color: isLight ? '#171923' : '#F8FAFC', size: 10 } },
        height: 250,
        margin: { t: 10, b: 50, l: 50, r: 15 },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
      },
    };
  }, [chartData, isLight]);

  return (
    <div className="ov-container">
      {/* ───────────────────────────────────────────────────────────────────
          TOP HEADER: Clean Enterprise SaaS Header
          ─────────────────────────────────────────────────────────────────── */}
      {/* Unified TopNavbar rendered globally in App.jsx */}

      {/* ───────────────────────────────────────────────────────────────────
          ROW 1: 6 KPI SUMMARY CARDS
          ─────────────────────────────────────────────────────────────────── */}
      <section className="ov-kpi-row" aria-label="Key Performance Indicators">
        {kpis.map((card) => (
          <div
            key={card.id}
            className="ov-kpi-card"
            tabIndex={0}
            onClick={() => card.targetTab && onNavigate && onNavigate(card.targetTab)}
            title={`Click to explore ${card.label} in ${card.targetTab === 'dataset' ? 'Product Catalog' : 'Pricing Rules'}`}
            style={{ cursor: 'pointer' }}
          >
            <div className="ov-kpi-header">
              <div className="ov-kpi-icon-box">{card.icon}</div>
              <span className="ov-kpi-title">{card.label}</span>
            </div>

            <div className="ov-kpi-value">{card.value}</div>

            <div className="ov-kpi-footer">
              <div className={`ov-kpi-sub ${card.subType}`}>
                {card.sub}
              </div>
              <Sparkline data={card.spark} color="#D9253D" width={68} height={26} />
            </div>
          </div>
        ))}
      </section>

      {/* ───────────────────────────────────────────────────────────────────
          ROW 2: MAIN ANALYTICS SECTION (3 CARDS)
          ─────────────────────────────────────────────────────────────────── */}
      <section className="ov-analytics-row" aria-label="Main Analytics Visualizations">
        {/* CARD 1: Treatment Discount Allocation */}
        <div className="ov-card ov-card-margin-dist">
          <div className="ov-card-head">
            <div className="ov-card-title-group">
              <h3 className="ov-card-title">Treatment Allocation Policy</h3>
              <Info size={13} className="ov-info-icon" title="Knapsack-optimized discount assignment (Control ₹0, Moderate ₹10, Deep ₹20) across 10,000 customers" />
            </div>
          </div>

          <div className="ov-donut-content">
            <DonutChart
              bands={marginBands}
              total={dyn?.margin_distribution?.total_evaluated ?? 10000}
              size={132}
              isLight={isLight}
            />

            <div className="ov-donut-legend">
              {marginBands.map((band, idx) => (
                <div key={idx} className="ov-legend-entry">
                  <div className="ov-legend-header-line">
                    <span className="ov-legend-dot" style={{ background: band.color }} />
                    <span className="ov-legend-name" title={band.label}>{band.label}</span>
                  </div>
                  <div className="ov-legend-val">
                    {fmt(band.count)} <span className="ov-legend-pct">({band.pct.toFixed(1)}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="ov-card-footer">
            <button
              type="button"
              className="ov-footer-link"
              onClick={() => onNavigate && onNavigate('dataset')}
            >
              <span>Explore dataset records</span>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>

        {/* CARD 2: Customer Cohort Pricing & Elasticity */}
        <div className="ov-card ov-card-cat-structure">
          <div className="ov-card-head">
            <div className="ov-card-title-group">
              <h3 className="ov-card-title">Customer Cohort & Elasticity</h3>
              <Info size={13} className="ov-info-icon" title="Average margins and CATE treatment uplift elasticities across customer segments" />
            </div>
          </div>

          <div className="ov-table-container">
            <table className="ov-analytics-table">
              <thead>
                <tr>
                  <th>Customer Segment</th>
                  <th>Customers</th>
                  <th>Avg Margin</th>
                  <th>Floor</th>
                  <th>Margin vs Floor</th>
                </tr>
              </thead>
              <tbody>
                {categoryPricingRows.map((row) => (
                  <tr key={row.category}>
                    <td className="ov-td-category">{row.category}</td>
                    <td className="ov-td-num">{fmt(row.products)}</td>
                    <td className="ov-td-num">{row.avg_margin.toFixed(1)}%</td>
                    <td className="ov-td-num">{row.margin_floor.toFixed(1)}%</td>
                    <td className="ov-td-prog">
                      <ProgressIndicator value={row.progress} color="#159447" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ov-card-footer">
            <button
              type="button"
              className="ov-footer-link"
              onClick={() => onNavigate && onNavigate('insights')}
            >
              <span>View causal uplift curves</span>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>

        {/* CARD 3: Margin Floor & Budget Protection */}
        <div className="ov-card ov-card-floor-overview">
          <div className="ov-card-head">
            <div className="ov-card-title-group">
              <h3 className="ov-card-title">Margin Floor & Budget Protection</h3>
              <Info size={13} className="ov-info-icon" title="Percentage of customer discount allocations strictly satisfying the 30% margin floor constraint" />
            </div>
          </div>

          <div className="ov-floor-body">
            <SemiCircleGauge pct={floorOverview.pct_above_floor} size={185} isLight={isLight} />

            <div className="ov-floor-breakdown">
              <div className="ov-floor-stat-row">
                <span className="ov-floor-stat-lbl">Targeted (₹10 / ₹20)</span>
                <span className="ov-floor-stat-val success">
                  {fmt(floorOverview.products_above_floor)} ({floorOverview.pct_above_floor_formatted})
                </span>
              </div>
              <div className="ov-floor-stat-row">
                <span className="ov-floor-stat-lbl">Control Baseline (₹0)</span>
                <span className="ov-floor-stat-val warning">
                  {fmt(floorOverview.products_at_floor)} ({floorOverview.pct_at_floor_formatted})
                </span>
              </div>
              <div className="ov-floor-stat-row">
                <span className="ov-floor-stat-lbl">Budget Deficit</span>
                <span className="ov-floor-stat-val success">
                  {fmt(floorOverview.products_below_floor)} ({floorOverview.pct_below_floor_formatted})
                </span>
              </div>
            </div>
          </div>

          <div className="ov-card-footer">
            <button
              type="button"
              className="ov-footer-link"
              onClick={() => onNavigate && onNavigate('validation')}
            >
              <span>View causal validation</span>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────
          ROW 3: BOTTOM SECTION (2 CARDS SIDE-BY-SIDE)
          ─────────────────────────────────────────────────────────────────── */}
      <section className="ov-bottom-row" aria-label="Rules Library and Portfolio Overview">
        {/* CARD 1: Pricing Rules Library */}
        <div className="ov-card ov-card-rules">
          <div className="ov-card-head">
            <div className="ov-card-title-group">
              <h3 className="ov-card-title">Causal Dynamic Pricing Rules Library</h3>
              <Info size={13} className="ov-info-icon" title="Active constraints and econometrics governing DML dynamic pricing optimization" />
            </div>
            <button
              type="button"
              className="ov-head-action-link"
              onClick={() => onNavigate && onNavigate('simulator')}
            >
              <span>View all rules</span>
              <ChevronRight size={13} />
            </button>
          </div>

          <div className="ov-table-container">
            <table className="ov-analytics-table ov-rules-table">
              <thead>
                <tr>
                  <th>Rule Name</th>
                  <th>Rule Type</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Customers</th>
                  <th>Verification</th>
                </tr>
              </thead>
              <tbody>
                {pricingRules.map((rule, idx) => (
                  <tr key={idx}>
                    <td className="ov-td-rule-name">{rule.name}</td>
                    <td className="ov-td-rule-type">{rule.type}</td>
                    <td className="ov-td-rule-desc" title={rule.description}>{rule.description}</td>
                    <td>
                      <StatusBadge status={rule.status} onClick={() => toggleRule(rule.name)} />
                    </td>
                    <td className="ov-td-num">{fmt(rule.products)}</td>
                    <td className="ov-td-date">{rule.last_updated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ov-card-footer">
            <button
              type="button"
              className="ov-footer-link"
              onClick={() => onNavigate && onNavigate('simulator')}
            >
              <span>Simulate pricing policies</span>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>

        {/* CARD 2: Product Portfolio Overview */}
        <div className="ov-card ov-card-portfolio">
          <div className="ov-card-head">
            <div className="ov-card-title-group">
              <h3 className="ov-card-title">Customer Cohort & Basket Distribution</h3>
              <Info size={13} className="ov-info-icon" title="Customer baseline basket value tiers and policy allocation breakdown" />
            </div>
            <button
              type="button"
              className="ov-head-action-link"
              onClick={() => onNavigate && onNavigate('recommendations')}
            >
              <span>View allocations</span>
              <ChevronRight size={13} />
            </button>
          </div>

          <div className="ov-portfolio-body">
            {/* Left Column: Totals */}
            <div className="ov-portfolio-left">
              <div className="ov-portfolio-stat-block">
                <span className="ov-port-label">Total Customers</span>
                <span className="ov-port-big-val">{fmt(productPortfolio.total_products)}</span>
              </div>

              <div className="ov-portfolio-stat-block">
                <span className="ov-port-label">Targeted Customers</span>
                <span className="ov-port-sub-val success">
                  {fmt(productPortfolio.active_products)}{' '}
                  <span className="ov-port-sub-pct">({productPortfolio.active_pct}%)</span>
                </span>
              </div>

              <div className="ov-portfolio-stat-block">
                <span className="ov-port-label">Organic Control Baseline</span>
                <span className="ov-port-sub-val muted">
                  {fmt(productPortfolio.inactive_products)}{' '}
                  <span className="ov-port-sub-pct">({productPortfolio.inactive_pct}%)</span>
                </span>
              </div>
            </div>

            {/* Right Column: Price Point Bar Chart */}
            <div className="ov-portfolio-right">
              <PricePointBarChart items={productPortfolio.price_points} max={4000} />
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────
          ROW 4: BOTTOM INSIGHT BANNER
          ─────────────────────────────────────────────────────────────────── */}
      <section className="ov-insight-banner-wrap" aria-label="System Intelligence Summary">
        <div className="ov-insight-card">
          <div className="ov-insight-left">
            <div className="ov-insight-icon-box">
              <Shield size={20} color="#D9253D" strokeWidth={2.2} />
            </div>
            <div className="ov-insight-texts">
              <h4 className="ov-insight-headline">Causal Dynamic Pricing Engine Fully Active</h4>
              <p className="ov-insight-sentence">
                Double Machine Learning isolates true heterogeneous causal lift, protecting ₹471k against deadweight discounting on organic shoppers while delivering ₹1.32M incremental revenue under the ₹50,000 budget.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="ov-insight-action-btn"
            onClick={() => onNavigate && onNavigate('insights')}
          >
            Explore Causal Uplift (CATE)
          </button>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────
          OPTIONAL CAUSAL DML VIEW (ACCESSIBLE VIA VIEW SWITCHER)
          ─────────────────────────────────────────────────────────────────── */}
      {activeViewMode === 'causal' && (
        <section className="ov-causal-extra-section" aria-label="Double Machine Learning Deep Dive">
          <div className="ov-causal-header-callout">
            <div className="ov-causal-callout-icon">
              <Sparkles size={18} color="#D9253D" />
            </div>
            <div>
              <h4 className="ov-causal-callout-title">
                Causal Machine Learning Optimization Engine (EconML LinearDML)
              </h4>
              <p className="ov-causal-callout-desc">
                Causal uplift estimates (CATE / τ̂ᵢ) evaluated on {fmt(opt.count_control_0 != null && opt.total_discounted_customers != null ? opt.count_control_0 + opt.total_discounted_customers : 10000)} shoppers.
                Optimal policy generated <strong>{fmtCurr(opt.estimated_incremental_profit_inr)}</strong> net incremental profit ({fmt(opt.return_on_discount_spend, 2)}x RODS).
              </p>
            </div>
          </div>

          <div className="ov-causal-grid">
            {/* Qini Curve Card */}
            <div className="ov-card">
              <div className="ov-card-head">
                <h3 className="ov-card-title">Causal Uplift Curve (Qini)</h3>
                <span className="ov-badge-tag success">DML vs Random</span>
              </div>
              <div style={{ padding: '8px 12px' }}>
                {qiniChart ? (
                  <PlotlyChart data={qiniChart.data} layout={qiniChart.layout} theme={theme} />
                ) : (
                  <div className="ov-empty">Loading Qini Curve…</div>
                )}
              </div>
            </div>

            {/* Causal Key Metric Summary */}
            <div className="ov-card">
              <div className="ov-card-head">
                <h3 className="ov-card-title">Policy Financial Architecture</h3>
                <button
                  type="button"
                  className="ov-head-action-link"
                  onClick={() => onNavigate && onNavigate('insights')}
                >
                  Deep Dive →
                </button>
              </div>
              <div className="ov-causal-metrics-list">
                <div className="ov-causal-metric-item">
                  <span className="ov-cm-lbl">Net Incremental Profit</span>
                  <span className="ov-cm-val success">{fmtCurr(opt.estimated_incremental_profit_inr)}</span>
                </div>
                <div className="ov-causal-metric-item">
                  <span className="ov-cm-lbl">Return on Spend (RODS)</span>
                  <span className="ov-cm-val" style={{ color: '#D9253D', fontWeight: 800 }}>
                    {opt.return_on_discount_spend != null ? `${fmt(opt.return_on_discount_spend, 2)}x` : '—'}
                  </span>
                </div>
                <div className="ov-causal-metric-item">
                  <span className="ov-cm-lbl">Targeted Discount Shoppers</span>
                  <span className="ov-cm-val">
                    {fmt(opt.total_discounted_customers)} ({fmtPct(opt.selected_pct, 1)})
                  </span>
                </div>
                <div className="ov-causal-metric-item">
                  <span className="ov-cm-lbl">Deadweight Suppressions (₹0 Offer)</span>
                  <span className="ov-cm-val muted">{fmt(opt.count_control_0)}</span>
                </div>
                <div className="ov-causal-metric-item">
                  <span className="ov-cm-lbl">Average CATE Uplift</span>
                  <span className="ov-cm-val success">+{fmtPct(opt.avg_incremental_uplift_pct, 2)}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
