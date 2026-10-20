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
function StatusBadge({ status }) {
  const isPaused = String(status).toLowerCase() === 'paused';
  return (
    <span className={`ov-status-pill ${isPaused ? 'paused' : 'active'}`}>
      <span className="ov-status-dot-sm" />
      {status}
    </span>
  );
}

/* ── SVG Multi-Band Donut Chart ──────────────────────────────────────────── */
function DonutChart({ bands = [], total = 24812, size = 180 }) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = 56;
  const strokeWidth = 20;
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
          stroke="#F3F4F6"
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
        <span className="ov-donut-sub">Products</span>
      </div>
    </div>
  );
}

/* ── SVG Semi-Circular Radial Gauge ──────────────────────────────────────── */
function SemiCircleGauge({ pct = 99.2, size = 200 }) {
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
          stroke="#E5E7EB"
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
function PricePointBarChart({ items = [], max = 8000 }) {
  const yTicks = [
    { label: '8K', val: 8000 },
    { label: '6K', val: 6000 },
    { label: '4K', val: 4000 },
    { label: '2K', val: 2000 },
    { label: '0', val: 0 },
  ];

  return (
    <div className="ov-price-chart-wrap">
      <div className="ov-price-chart-title">Products by Price Point</div>
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
                      title={`${it.range}: ${fmt(it.count)} products`}
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
}) {
  const [activeViewMode, setActiveViewMode] = useState('pricing'); // 'pricing' | 'causal'
  const [dateRangeMenuOpen, setDateRangeMenuOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState('May 31, 2024 – May 31, 2024');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');

  const dyn = chartData?.dynamic_pricing;
  const opt = summaryData?.optimal_policy ?? {};
  const isLight = theme !== 'dark';

  /* ── 1. KPI Cards Data ─────────────────────────────────────────────────── */
  const kpis = useMemo(() => {
    const k = dyn?.kpis ?? {};
    const sparks = k.sparks ?? {};
    return [
      {
        id: 'total_products',
        icon: <Tag size={16} strokeWidth={2.2} />,
        label: 'Total Products',
        value: fmt(k.total_products ?? 24812),
        sub: k.total_products_change ?? '↑ 4.5% vs last 30 days',
        subType: 'up',
        spark: sparks.total_products ?? [23200, 23600, 24100, 23900, 24500, 24812],
      },
      {
        id: 'avg_margin',
        icon: <Clock size={16} strokeWidth={2.2} />,
        label: 'Average Margin',
        value: `${k.average_margin ?? 28.6}%`,
        sub: k.average_margin_change ?? '↑ 0.8 pp vs last 30 days',
        subType: 'up',
        spark: sparks.average_margin ?? [27.2, 27.5, 28.0, 27.9, 28.4, 28.6],
      },
      {
        id: 'margin_floor_cov',
        icon: <Shield size={16} strokeWidth={2.2} />,
        label: 'Margin Floor Coverage',
        value: `${k.margin_floor_coverage ?? 99.2}%`,
        sub: k.margin_floor_coverage_change ?? '↑ 0.3 pp vs last 30 days',
        subType: 'up',
        spark: sparks.margin_floor_coverage ?? [98.5, 98.8, 98.9, 99.0, 99.1, 99.2],
      },
      {
        id: 'skus_above_floor',
        icon: <TrendingUp size={16} strokeWidth={2.2} />,
        label: 'Skus Above Margin Floor',
        value: fmt(k.skus_above_floor ?? 24611),
        sub: k.skus_above_floor_change ?? '↑ 4.2% vs last 30 days',
        subType: 'up',
        spark: sparks.skus_above_floor ?? [23000, 23400, 23800, 23900, 24200, 24611],
      },
      {
        id: 'skus_below_floor',
        icon: <TrendingDown size={16} strokeWidth={2.2} />,
        label: 'Skus Below Margin Floor',
        value: fmt(k.skus_below_floor ?? 201),
        sub: k.skus_below_floor_change ?? '↓ -12.6% vs last 30 days',
        subType: 'down',
        spark: sparks.skus_below_floor ?? [260, 245, 230, 220, 215, 201],
      },
      {
        id: 'pricing_zones',
        icon: <Globe size={16} strokeWidth={2.2} />,
        label: 'Pricing Zones',
        value: fmt(k.pricing_zones ?? 18),
        sub: k.pricing_zones_change ?? '— vs last 30 days',
        subType: 'neutral',
        spark: sparks.pricing_zones ?? [18, 18, 18, 18, 18, 18],
      },
    ];
  }, [dyn]);

  /* ── 2. Margin Distribution Donut Data ─────────────────────────────────── */
  const marginBands = useMemo(() => {
    return (
      dyn?.margin_distribution?.bands ?? [
        { label: 'Above 30%', count: 8942, pct: 36.0, color: '#159447' },
        { label: '20% - 30%', count: 9876, pct: 39.8, color: '#48BB78' },
        { label: '10% - 20%', count: 4215, pct: 17.0, color: '#F4AD24' },
        { label: '5% - 10%', count: 1289, pct: 5.2, color: '#ED8936' },
        { label: 'Below 5%', count: 490, pct: 2.0, color: '#D9253D' },
      ]
    );
  }, [dyn]);

  /* ── 3. Category Pricing Table Data ────────────────────────────────────── */
  const categoryPricingRows = useMemo(() => {
    const raw = dyn?.category_pricing ?? [
      { category: 'Beverages', products: 3842, avg_margin: 27.4, margin_floor: 15.0, progress: 100 },
      { category: 'Snacks', products: 2941, avg_margin: 29.1, margin_floor: 18.0, progress: 100 },
      { category: 'Personal Care', products: 4215, avg_margin: 28.8, margin_floor: 20.0, progress: 100 },
      { category: 'Household', products: 3621, avg_margin: 25.6, margin_floor: 18.0, progress: 100 },
      { category: 'Dairy', products: 2876, avg_margin: 26.3, margin_floor: 16.0, progress: 100 },
      { category: 'Others', products: 7317, avg_margin: 29.8, margin_floor: 15.0, progress: 100 },
    ];
    if (categoryFilter === 'all') return raw;
    return raw.filter((r) => r.category.toLowerCase().includes(categoryFilter.toLowerCase()));
  }, [dyn, categoryFilter]);

  /* ── 4. Margin Floor Overview Data ─────────────────────────────────────── */
  const floorOverview = useMemo(() => {
    return (
      dyn?.margin_floor_overview ?? {
        pct_above_floor: 99.2,
        products_above_floor: 24611,
        pct_above_floor_formatted: '99.2%',
        products_at_floor: 156,
        pct_at_floor_formatted: '0.6%',
        products_below_floor: 45,
        pct_below_floor_formatted: '0.2%',
      }
    );
  }, [dyn]);

  /* ── 5. Pricing Rules Library Data ─────────────────────────────────────── */
  const pricingRules = useMemo(() => {
    return (
      dyn?.pricing_rules_library ?? [
        { name: 'Minimum Margin Rule', type: 'Margin', description: 'Ensure margin never below minimum', status: 'Active', products: 24812, last_updated: 'May 31, 2024' },
        { name: 'Competitor Alignment Rule', type: 'Competitor', description: 'Stay within competitor price range', status: 'Active', products: 18732, last_updated: 'May 31, 2024' },
        { name: 'Price Band Rule', type: 'Range', description: 'Keep prices within defined bands', status: 'Active', products: 24812, last_updated: 'May 30, 2024' },
        { name: 'MAP (Minimum Advertised Price)', type: 'Compliance', description: 'Enforce minimum advertised price', status: 'Active', products: 7621, last_updated: 'May 30, 2024' },
        { name: 'Regional Pricing Rule', type: 'Region', description: 'Adjust prices by region', status: 'Active', products: 24812, last_updated: 'May 29, 2024' },
        { name: 'Bundle Pricing Rule', type: 'Bundle', description: 'Manage bundle and package pricing', status: 'Active', products: 3214, last_updated: 'May 29, 2024' },
        { name: 'Clearance Rule', type: 'Lifecycle', description: 'Define markdown boundaries', status: 'Paused', products: 1842, last_updated: 'May 28, 2024' },
        { name: 'New Product Rule', type: 'New Product', description: 'Set initial pricing for new items', status: 'Paused', products: 1256, last_updated: 'May 28, 2024' },
      ]
    );
  }, [dyn]);

  /* ── 6. Product Portfolio Data ─────────────────────────────────────────── */
  const productPortfolio = useMemo(() => {
    return (
      dyn?.product_portfolio ?? {
        total_products: 24812,
        active_products: 23984,
        active_pct: 96.7,
        inactive_products: 828,
        inactive_pct: 3.3,
        price_points: [
          { range: '< $10', count: 2214 },
          { range: '$10 - $50', count: 5621 },
          { range: '$50 - $100', count: 7842 },
          { range: '$100 - $500', count: 5123 },
          { range: '$500+', count: 3012 },
        ],
      }
    );
  }, [dyn]);

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
      <header className="ov-top-header">
        <div className="ov-header-left">
          <h1 className="ov-title">Dashboard</h1>
          <div className="ov-breadcrumbs">
            <span>EconoCausal</span>
            <span className="ov-breadcrumb-sep">/</span>
            <span className="ov-breadcrumb-curr">Dynamic Pricing</span>
          </div>
        </div>

        <div className="ov-header-actions">
          {/* View Mode Switcher Pill */}
          <div className="ov-view-switcher" role="tablist" aria-label="Dashboard presentation view">
            <button
              type="button"
              className={`ov-view-tab ${activeViewMode === 'pricing' ? 'active' : ''}`}
              onClick={() => setActiveViewMode('pricing')}
              title="Reference Dynamic Pricing Analytics"
            >
              Dynamic Pricing
            </button>
            <button
              type="button"
              className={`ov-view-tab ${activeViewMode === 'causal' ? 'active' : ''}`}
              onClick={() => setActiveViewMode('causal')}
              title="Causal DML Optimization & Qini Curves"
            >
              Causal DML
            </button>
          </div>

          {/* Date Range Selector Pill */}
          <div className="ov-dropdown-anchor">
            <button
              type="button"
              className="ov-header-pill"
              onClick={() => setDateRangeMenuOpen(!dateRangeMenuOpen)}
              aria-label="Select date range"
              aria-expanded={dateRangeMenuOpen}
            >
              <Calendar size={14} className="ov-pill-icon" />
              <span>{selectedRange}</span>
              <ChevronDown size={13} className="ov-pill-chevron" />
            </button>

            {dateRangeMenuOpen && (
              <div className="ov-popover-menu">
                <div className="ov-popover-header">Active Evaluation Range</div>
                <button
                  type="button"
                  className="ov-popover-item"
                  onClick={() => {
                    setSelectedRange('May 31, 2024 – May 31, 2024');
                    setDateRangeMenuOpen(false);
                  }}
                >
                  <CheckCircle2 size={13} color="#159447" />
                  <span>Production Catalog (May 31, 2024)</span>
                </button>
                <button
                  type="button"
                  className="ov-popover-item"
                  onClick={() => {
                    setSelectedRange('Last 30 Days (Synthetic 10k)');
                    setDateRangeMenuOpen(false);
                  }}
                >
                  <span>Last 30 Days Cohort (N=10,000)</span>
                </button>
                <button
                  type="button"
                  className="ov-popover-item"
                  onClick={() => {
                    setSelectedRange('Quarter-to-Date (Q2 2024)');
                    setDateRangeMenuOpen(false);
                  }}
                >
                  <span>Quarter-to-Date (Q2 2024)</span>
                </button>
              </div>
            )}
          </div>

          {/* Filters Button */}
          <div className="ov-dropdown-anchor">
            <button
              type="button"
              className={`ov-header-pill ${filterMenuOpen ? 'active' : ''}`}
              onClick={() => setFilterMenuOpen(!filterMenuOpen)}
              aria-label="Filter dashboard analytics"
            >
              <Filter size={14} className="ov-pill-icon" />
              <span>Filters</span>
            </button>

            {filterMenuOpen && (
              <div className="ov-popover-menu" style={{ width: 220 }}>
                <div className="ov-popover-header">Filter by Category</div>
                {['all', 'Beverages', 'Snacks', 'Personal Care', 'Household', 'Dairy'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className="ov-popover-item"
                    onClick={() => {
                      setCategoryFilter(cat);
                      setFilterMenuOpen(false);
                    }}
                  >
                    <span>{cat === 'all' ? 'All Categories (6)' : cat}</span>
                    {categoryFilter === cat && <CheckCircle2 size={12} color="#D9253D" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notification Bell */}
          <div className="ov-dropdown-anchor">
            <button
              type="button"
              className="ov-icon-btn"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              title="System Alerts & Notifications"
              aria-label="Notifications"
            >
              <Bell size={17} />
              <span className="ov-badge-count">5</span>
            </button>

            {notificationsOpen && (
              <div className="ov-popover-menu ov-notif-popover">
                <div className="ov-popover-header">System Notifications (5)</div>
                <div className="ov-notif-item">
                  <div className="ov-notif-title">Causal Model Certified</div>
                  <div className="ov-notif-desc">EconML LinearDML passed 100% of placebo & balance tests.</div>
                </div>
                <div className="ov-notif-item">
                  <div className="ov-notif-title">Margin Floor Protected</div>
                  <div className="ov-notif-desc">99.2% of product allocations respect the 28.0% margin boundary.</div>
                </div>
                <div className="ov-notif-item">
                  <div className="ov-notif-title">18 Pricing Zones Active</div>
                  <div className="ov-notif-desc">Regional micro-segments calibrated with zero parameter drift.</div>
                </div>
              </div>
            )}
          </div>

          {/* Help Question Icon */}
          <button
            type="button"
            className="ov-icon-btn"
            onClick={onOpenMethodology}
            title="Methodology, Causal DAG & Assumptions"
            aria-label="Help and Methodology"
          >
            <HelpCircle size={17} />
          </button>

          {/* User Profile Menu */}
          <div className="ov-dropdown-anchor">
            <button
              type="button"
              className="ov-user-profile-btn"
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              aria-label="User profile menu"
            >
              <span className="ov-user-avatar">AD</span>
              <span className="ov-user-name">Admin</span>
              <ChevronDown size={13} className="ov-pill-chevron" />
            </button>

            {profileMenuOpen && (
              <div className="ov-popover-menu" style={{ width: 200, right: 0 }}>
                <div className="ov-popover-header">Admin Workspace</div>
                <div style={{ padding: '8px 12px', fontSize: '0.74rem', color: '#6B7280' }}>
                  Enterprise Plan • Acme Retail
                </div>
                <div className="ov-popover-divider" />
                <button
                  type="button"
                  className="ov-popover-item"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    if (onNavigate) onNavigate('dataset');
                  }}
                >
                  <span>Catalog Explorer</span>
                </button>
                <button
                  type="button"
                  className="ov-popover-item"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    if (onOpenReport) onOpenReport();
                  }}
                >
                  <span>Executive Audit PDF</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ───────────────────────────────────────────────────────────────────
          ROW 1: 6 KPI SUMMARY CARDS
          ─────────────────────────────────────────────────────────────────── */}
      <section className="ov-kpi-row" aria-label="Key Performance Indicators">
        {kpis.map((card) => (
          <div key={card.id} className="ov-kpi-card" tabIndex={0}>
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
        {/* CARD 1: Margin Distribution */}
        <div className="ov-card ov-card-margin-dist">
          <div className="ov-card-head">
            <div className="ov-card-title-group">
              <h3 className="ov-card-title">Margin Distribution</h3>
              <Info size={13} className="ov-info-icon" title="Evaluated gross margin contribution across catalog products" />
            </div>
          </div>

          <div className="ov-donut-content">
            <DonutChart
              bands={marginBands}
              total={dyn?.margin_distribution?.total_evaluated ?? 24812}
              size={170}
            />

            <div className="ov-donut-legend">
              {marginBands.map((band, idx) => (
                <div key={idx} className="ov-legend-entry">
                  <span className="ov-legend-dot" style={{ background: band.color }} />
                  <span className="ov-legend-name">{band.label}</span>
                  <span className="ov-legend-val">
                    {fmt(band.count)} <span className="ov-legend-pct">({band.pct.toFixed(1)}%)</span>
                  </span>
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
              <span>View full distribution</span>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>

        {/* CARD 2: Category Pricing Structure */}
        <div className="ov-card ov-card-cat-structure">
          <div className="ov-card-head">
            <div className="ov-card-title-group">
              <h3 className="ov-card-title">Category Pricing Structure</h3>
              <Info size={13} className="ov-info-icon" title="Average margins and minimum policy floors across product departments" />
            </div>
          </div>

          <div className="ov-table-container">
            <table className="ov-analytics-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Products</th>
                  <th>Avg Margin</th>
                  <th>Margin Floor</th>
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
              onClick={() => onNavigate && onNavigate('dataset')}
            >
              <span>View all categories</span>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>

        {/* CARD 3: Margin Floor Overview */}
        <div className="ov-card ov-card-floor-overview">
          <div className="ov-card-head">
            <div className="ov-card-title-group">
              <h3 className="ov-card-title">Margin Floor Overview</h3>
              <Info size={13} className="ov-info-icon" title="Percentage of product pricing allocations strictly satisfying margin floor bounds" />
            </div>
          </div>

          <div className="ov-floor-body">
            <SemiCircleGauge pct={floorOverview.pct_above_floor} size={185} />

            <div className="ov-floor-breakdown">
              <div className="ov-floor-stat-row">
                <span className="ov-floor-stat-lbl">Products Above Floor</span>
                <span className="ov-floor-stat-val success">
                  {fmt(floorOverview.products_above_floor)} ({floorOverview.pct_above_floor_formatted})
                </span>
              </div>
              <div className="ov-floor-stat-row">
                <span className="ov-floor-stat-lbl">Products At Floor</span>
                <span className="ov-floor-stat-val warning">
                  {fmt(floorOverview.products_at_floor)} ({floorOverview.pct_at_floor_formatted})
                </span>
              </div>
              <div className="ov-floor-stat-row">
                <span className="ov-floor-stat-lbl">Products Below Floor</span>
                <span className="ov-floor-stat-val danger">
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
              <span>View margin analysis</span>
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
              <h3 className="ov-card-title">Pricing Rules Library</h3>
              <Info size={13} className="ov-info-icon" title="Active constraints and heuristics governing the dynamic pricing optimization" />
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
                  <th>Products</th>
                  <th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {pricingRules.map((rule, idx) => (
                  <tr key={idx}>
                    <td className="ov-td-rule-name">{rule.name}</td>
                    <td className="ov-td-rule-type">{rule.type}</td>
                    <td className="ov-td-rule-desc">{rule.description}</td>
                    <td>
                      <StatusBadge status={rule.status} />
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
              <span>View all pricing rules</span>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>

        {/* CARD 2: Product Portfolio Overview */}
        <div className="ov-card ov-card-portfolio">
          <div className="ov-card-head">
            <div className="ov-card-title-group">
              <h3 className="ov-card-title">Product Portfolio Overview</h3>
              <Info size={13} className="ov-info-icon" title="Price tier distribution across active enterprise product catalog" />
            </div>
            <button
              type="button"
              className="ov-head-action-link"
              onClick={() => onNavigate && onNavigate('dataset')}
            >
              <span>View portfolio</span>
              <ChevronRight size={13} />
            </button>
          </div>

          <div className="ov-portfolio-body">
            {/* Left Column: Totals */}
            <div className="ov-portfolio-left">
              <div className="ov-portfolio-stat-block">
                <span className="ov-port-label">Total Products</span>
                <span className="ov-port-big-val">{fmt(productPortfolio.total_products)}</span>
              </div>

              <div className="ov-portfolio-stat-block">
                <span className="ov-port-label">Active Products</span>
                <span className="ov-port-sub-val success">
                  {fmt(productPortfolio.active_products)}{' '}
                  <span className="ov-port-sub-pct">({productPortfolio.active_pct}%)</span>
                </span>
              </div>

              <div className="ov-portfolio-stat-block">
                <span className="ov-port-label">Inactive Products</span>
                <span className="ov-port-sub-val muted">
                  {fmt(productPortfolio.inactive_products)}{' '}
                  <span className="ov-port-sub-pct">({productPortfolio.inactive_pct}%)</span>
                </span>
              </div>
            </div>

            {/* Right Column: Price Point Bar Chart */}
            <div className="ov-portfolio-right">
              <PricePointBarChart items={productPortfolio.price_points} max={8000} />
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
              <h4 className="ov-insight-headline">Your pricing foundation is strong</h4>
              <p className="ov-insight-sentence">
                99.2% of products are above the minimum margin floor across all categories and regions.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="ov-insight-action-btn"
            onClick={() => onNavigate && onNavigate('validation')}
          >
            View Pricing Health
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
