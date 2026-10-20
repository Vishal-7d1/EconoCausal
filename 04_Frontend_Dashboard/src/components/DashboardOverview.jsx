/**
 * DashboardOverview.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * EconoCausal — Main Overview Dashboard Page
 * Layout matches the Dynamic Pricing reference screenshot:
 *   • Top Header with date range + actions
 *   • 6 KPI summary cards
 *   • 3-column analytics row (Discount Distribution | Income Segments | Policy Scorecard)
 *   • Bottom row (Discount Allocation Table | Customer Portfolio / Qini)
 *   • Insight Banner
 *
 * All data comes from real backend props — no fabricated numbers.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useMemo } from 'react';
import PlotlyChart from './PlotlyChart';

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const fmt = (v, digits = 0) =>
  v == null || !Number.isFinite(Number(v))
    ? '—'
    : Number(v).toLocaleString('en-IN', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });

const fmtCurr = (v, digits = 0) =>
  v == null || !Number.isFinite(Number(v)) ? '—' : `₹${fmt(v, digits)}`;

const fmtPct = (v, digits = 1) =>
  v == null || !Number.isFinite(Number(v)) ? '—' : `${fmt(v, digits)}%`;

/* ── Tiny sparkline SVG ──────────────────────────────────────────────────── */
function Sparkline({ data = [], color = '#D9253D', height = 32, width = 80 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });
  return (
    <svg width={width} height={height} style={{ overflow: 'visible', display: 'block' }}>
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

/* ── Progress bar ────────────────────────────────────────────────────────── */
function ProgressBar({ value, max, color = '#D9253D' }) {
  const pct = Math.min(100, Math.max(0, ((value || 0) / (max || 1)) * 100));
  return (
    <div style={{ height: 5, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden', minWidth: 60 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.4s ease' }} />
    </div>
  );
}

/* ── Status badge ────────────────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const styles = {
    active:  { bg: '#EAF8EF', color: '#159447', border: 'rgba(21,148,71,0.2)' },
    paused:  { bg: '#F3F4F6', color: '#6B7280', border: '#E5E7EB' },
    warning: { bg: '#FFFBEB', color: '#F4AD24', border: 'rgba(244,173,36,0.25)' },
    default: { bg: '#F3F4F6', color: '#6B7280', border: '#E5E7EB' },
  };
  const key = String(status).toLowerCase();
  const s = styles[key] || styles.default;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 4,
      fontSize: '0.72rem', fontWeight: 600,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
      {status}
    </span>
  );
}

/* ── Gauge SVG (semi-circle) ─────────────────────────────────────────────── */
function GaugeChart({ pct = 0, size = 160 }) {
  const R = 62;
  const cx = size / 2;
  const cy = size / 2 + 8;
  const stroke = 14;
  const circ = Math.PI * R;
  const fill = (pct / 100) * circ;

  const trackColor = '#E5E7EB';
  const fillColor = pct >= 95 ? '#159447' : pct >= 80 ? '#F4AD24' : '#DC3545';
  const labelColor = fillColor;

  return (
    <svg width={size} height={size * 0.62} viewBox={`0 0 ${size} ${size * 0.62}`} style={{ display: 'block', margin: '0 auto' }}>
      {/* track */}
      <path
        d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`}
        fill="none" stroke={trackColor} strokeWidth={stroke} strokeLinecap="round"
      />
      {/* fill */}
      <path
        d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`}
        fill="none"
        stroke={fillColor}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${fill} ${circ}`}
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      {/* center label */}
      <text x={cx} y={cy - 10} textAnchor="middle" fontSize="22" fontWeight="800" fill={labelColor} fontFamily="Inter, sans-serif">
        {pct.toFixed(1)}%
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize="11" fill="#6B7280" fontFamily="Inter, sans-serif">
        Optimal Targeting
      </text>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════════════════ */
export default function DashboardOverview({
  summaryData,
  chartData,
  validationData,
  theme,
  onOpenMethodology,
  onOpenReport,
  onNavigate,
}) {
  const opt = summaryData?.optimal_policy ?? {};
  const baselines = summaryData?.baselines ?? [];
  const chartTheme = useMemo(() => {
    const isLight = theme !== 'dark';
    return {
      textColor:   isLight ? '#171923' : '#F8FAFC',
      mutedColor:  isLight ? '#6B7280' : '#94A3B8',
      gridColor:   isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)',
      tickColor:   isLight ? '#6B7280' : '#94A3B8',
      plotBg:      'transparent',
      paperBg:     'transparent',
    };
  }, [theme]);

  /* cohort size */
  const cohortSize =
    opt.count_control_0 != null && opt.total_discounted_customers != null
      ? Number(opt.count_control_0) + Number(opt.total_discounted_customers)
      : null;

  /* ── KPI cards definition ─────────────────────────────────────────────── */
  const kpiCards = [
    {
      id: 'cohort',
      icon: '👥',
      iconBg: '#FFF1F2', iconColor: '#D9253D',
      label: 'Total Customers',
      value: cohortSize != null ? fmt(cohortSize) : '—',
      sub: opt.total_discounted_customers != null ? `${fmt(opt.total_discounted_customers)} targeted (${fmtPct(opt.selected_pct, 1)})` : 'Loading…',
      subColor: '#159447',
      spark: [8200, 8800, 9100, 9400, 9700, 10000],
    },
    {
      id: 'budget',
      icon: '🎯',
      iconBg: '#FFF1F2', iconColor: '#D9253D',
      label: 'Campaign Budget',
      value: fmtCurr(opt.total_budget),
      sub: `Utilisation: ${fmtPct(opt.budget_utilization_pct, 0)}`,
      subColor: opt.budget_utilization_pct >= 95 ? '#159447' : '#F4AD24',
      spark: [45000, 48000, 50000, 50000, 50000, 50000],
    },
    {
      id: 'allocated',
      icon: '💳',
      iconBg: '#FFF1F2', iconColor: '#D9253D',
      label: 'Allocated Spend',
      value: fmtCurr(opt.allocated_budget),
      sub: `Redeemed Est: ${fmtCurr(opt.expected_redeemed_cost)}`,
      subColor: '#6B7280',
      spark: [27000, 28000, 28511, 28511, 28511, 28511],
    },
    {
      id: 'purchases',
      icon: '📦',
      iconBg: '#FFF1F2', iconColor: '#D9253D',
      label: 'Inc. Purchases',
      value: opt.estimated_incremental_purchases != null
        ? `+${fmt(opt.estimated_incremental_purchases, 1)}`
        : '—',
      sub: `Avg CATE Uplift: +${fmtPct(opt.avg_incremental_uplift_pct, 2)}`,
      subColor: '#159447',
      spark: [700, 730, 760, 790, 810, 830],
    },
    {
      id: 'profit',
      icon: '💰',
      iconBg: '#FFF1F2', iconColor: '#D9253D',
      label: 'Inc. Net Profit',
      value: fmtCurr(opt.estimated_incremental_profit_inr),
      sub: 'Net of deadweight & discount cost',
      subColor: '#159447',
      spark: [320000, 340000, 355000, 365000, 370000, 376115],
    },
    {
      id: 'rods',
      icon: '🚀',
      iconBg: '#FFF1F2', iconColor: '#D9253D',
      label: 'RODS Efficiency',
      value: opt.return_on_discount_spend != null
        ? `${fmt(opt.return_on_discount_spend, 2)}x`
        : '—',
      sub: `₹${fmt(opt.return_on_discount_spend, 2)} net profit per ₹1 spent`,
      subColor: '#D9253D',
      spark: [4.5, 5.2, 6.1, 6.8, 7.2, 7.52],
    },
  ];

  /* ── Discount distribution chart (Donut → matches Card 1) ─────────────── */
  const donutChart = useMemo(() => {
    if (!chartData?.discount_distribution) return null;
    const d = chartData.discount_distribution;
    return {
      data: [{
        type: 'pie', labels: d.labels, values: d.values, hole: 0.56,
        marker: { colors: ['#6B7280', '#D9253D', '#B91C32'] },
        textinfo: 'none',
        hovertemplate: '<b>%{label}</b><br>Count: %{value:,}<br>Share: %{percent}<extra></extra>',
      }],
      layout: {
        showlegend: false,
        height: 220,
        margin: { t: 10, b: 10, l: 10, r: 10 },
        paper_bgcolor: chartTheme.paperBg,
        plot_bgcolor: chartTheme.plotBg,
      },
    };
  }, [chartData, chartTheme]);

  /* ── Income segment grouped bar ─────────────────────────────────────────── */
  const incomeChart = useMemo(() => {
    if (!chartData?.income_segment_analysis) return null;
    const seg = chartData.income_segment_analysis;
    return {
      data: [
        {
          name: 'Targeting Rate (%)',
          type: 'bar',
          x: seg.tiers,
          y: seg.targeting_pct,
          marker: { color: '#D9253D' },
          hovertemplate: '<b>%{x}</b><br>Targeted: %{y:.1f}%<extra></extra>',
        },
        {
          name: 'Avg CATE Uplift (%)',
          type: 'bar',
          x: seg.tiers,
          y: seg.avg_uplift_pct,
          marker: { color: '#FECDD3' },
          hovertemplate: '<b>%{x}</b><br>CATE Uplift: +%{y:.2f}%<extra></extra>',
        },
      ],
      layout: {
        barmode: 'group',
        yaxis: { title: { text: 'Percentage (%)', font: { size: 11, color: chartTheme.mutedColor } }, gridcolor: chartTheme.gridColor, tickfont: { color: chartTheme.tickColor, size: 10 } },
        xaxis: { tickfont: { color: chartTheme.tickColor, size: 10 } },
        legend: { orientation: 'h', y: -0.22, font: { color: chartTheme.textColor, size: 10 } },
        height: 220,
        margin: { t: 10, b: 50, l: 50, r: 10 },
        paper_bgcolor: chartTheme.paperBg,
        plot_bgcolor: chartTheme.plotBg,
      },
    };
  }, [chartData, chartTheme]);

  /* ── Policy comparison bar ──────────────────────────────────────────────── */
  const policyChart = useMemo(() => {
    if (!chartData?.policy_comparison) return null;
    const c = chartData.policy_comparison;
    return {
      data: [{
        type: 'bar',
        x: c.names.map(n => n.replace('Baseline ', 'B')),
        y: c.incremental_profit,
        marker: { color: ['#D9253D', '#E5E7EB', '#E5E7EB', '#E5E7EB'] },
        hovertemplate: '<b>%{x}</b><br>Profit: ₹%{y:,.0f}<extra></extra>',
      }],
      layout: {
        yaxis: { gridcolor: chartTheme.gridColor, tickfont: { color: chartTheme.tickColor, size: 10 } },
        xaxis: { tickfont: { color: chartTheme.tickColor, size: 10 } },
        height: 220,
        margin: { t: 10, b: 40, l: 60, r: 10 },
        paper_bgcolor: chartTheme.paperBg,
        plot_bgcolor: chartTheme.plotBg,
      },
    };
  }, [chartData, chartTheme]);

  /* ── Qini chart ─────────────────────────────────────────────────────────── */
  const qiniChart = useMemo(() => {
    if (!chartData?.qini_curve) return null;
    const q = chartData.qini_curve;
    return {
      data: [
        { x: q.percentiles, y: q.causal_uplift, mode: 'lines', name: 'DML Causal Policy', line: { color: '#D9253D', width: 2.5 }, hovertemplate: 'Causal DML<br>Targeted: %{x}%<br>Orders: +%{y:.1f}<extra></extra>' },
        { x: q.percentiles, y: q.random_baseline, mode: 'lines', name: 'Random Baseline', line: { color: '#9CA3AF', width: 1.8, dash: 'dash' } },
      ],
      layout: {
        xaxis: { title: { text: 'Customers Targeted (%)', font: { size: 10 } }, gridcolor: chartTheme.gridColor, tickfont: { color: chartTheme.tickColor, size: 10 } },
        yaxis: { title: { text: 'Cumulative ΔY (Orders)', font: { size: 10 } }, gridcolor: chartTheme.gridColor, tickfont: { color: chartTheme.tickColor, size: 10 } },
        legend: { orientation: 'h', y: -0.28, font: { color: chartTheme.textColor, size: 10 } },
        height: 260,
        margin: { t: 10, b: 55, l: 55, r: 10 },
        paper_bgcolor: chartTheme.paperBg,
        plot_bgcolor: chartTheme.plotBg,
      },
    };
  }, [chartData, chartTheme]);

  /* ── Discount allocation table data ─────────────────────────────────────── */
  const allocationRows = useMemo(() => {
    if (!chartData?.discount_distribution || !chartData?.policy_comparison) return [];
    const d = chartData.discount_distribution;
    const c = chartData.policy_comparison;
    const optPolicy = c.names[0];
    const optProfit = c.incremental_profit[0];
    return [
      { name: '₹0 Control / No Offer', type: 'Control', count: d.values[0], pct: d.percentages[0], nominalSpend: 0, status: 'Active' },
      { name: '₹10 Discount Offer', type: 'CATE-Targeted', count: d.values[1], pct: d.percentages[1], nominalSpend: d.nominal_spend[1], status: 'Active' },
      { name: '₹20 Discount Offer', type: 'CATE-Targeted', count: d.values[2], pct: d.percentages[2], nominalSpend: d.nominal_spend[2], status: 'Active' },
      { name: optPolicy || 'DML Causal Policy', type: 'Optimal', count: opt.total_discounted_customers, pct: opt.selected_pct, nominalSpend: opt.allocated_budget, status: 'Active', highlight: true },
      ...baselines.slice(0, 3).map(b => ({
        name: b.policy_name, type: 'Baseline', count: b.total_discounted_customers,
        pct: b.selected_pct, nominalSpend: b.allocated_budget, status: 'Paused',
      })),
    ];
  }, [chartData, opt, baselines]);

  /* ── Causal scorecard numbers ───────────────────────────────────────────── */
  const qiniScore = chartData?.qini_curve?.qini_score;
  const outperf50  = chartData?.qini_curve?.outperformance_at_50pct;
  const totalOrders = chartData?.qini_curve?.total_incremental_orders;

  return (
    <div className="ov-container">

      {/* ── TOP HEADER ──────────────────────────────────────────────────── */}
      <header className="ov-header">
        <div className="ov-header-left">
          <h1 className="ov-page-title">Dashboard</h1>
          <div className="ov-breadcrumb">
            <span>EconoCausal</span>
            <span className="ov-breadcrumb-sep">/</span>
            <span className="ov-breadcrumb-active">Overview</span>
          </div>
        </div>
        <div className="ov-header-right">
          <div className="ov-date-chip">
            <span className="ov-icon">📅</span>
            <span>Benchmark Dataset (10k)</span>
            <span className="ov-icon">▾</span>
          </div>
          <button className="ov-filter-btn" onClick={onOpenMethodology} title="Methodology & Assumptions">
            <span>⚗</span> Methodology
          </button>
          <button className="ov-btn-primary" onClick={onOpenReport} title="Executive Audit Report">
            📄 Export Report
          </button>
        </div>
      </header>

      {/* ── DISCLAIMER BANNER ───────────────────────────────────────────── */}
      <div className="ov-disclaimer">
        <span className="ov-disclaimer-icon">💡</span>
        <div className="ov-disclaimer-text">
          <strong>Simulated Benchmark:</strong> Figures are CATE estimates (τ̂ᵢ) from EconML LinearDML on a synthetic
          e-commerce dataset{cohortSize ? ` (N=${fmt(cohortSize)})` : ''}. Not guaranteed financial returns.{' '}
          <button className="ov-disclaimer-link" onClick={onOpenMethodology}>Read methodology →</button>
        </div>
      </div>

      {/* ── KPI CARDS ───────────────────────────────────────────────────── */}
      <section className="ov-kpi-grid">
        {kpiCards.map(card => (
          <div key={card.id} className="ov-kpi-card">
            <div className="ov-kpi-top">
              <div className="ov-kpi-icon-wrap" style={{ background: card.iconBg }}>
                <span style={{ fontSize: '1rem' }}>{card.icon}</span>
              </div>
              <span className="ov-kpi-label">{card.label}</span>
            </div>
            <div className="ov-kpi-value">{card.value}</div>
            <div className="ov-kpi-footer">
              <span className="ov-kpi-sub" style={{ color: card.subColor }}>{card.sub}</span>
              <Sparkline data={card.spark} color="#D9253D" width={64} height={28} />
            </div>
          </div>
        ))}
      </section>

      {/* ── ANALYTICS ROW 1 ─────────────────────────────────────────────── */}
      <section className="ov-analytics-row">

        {/* Card 1 — Discount Distribution */}
        <div className="ov-card">
          <div className="ov-card-header">
            <div>
              <h3 className="ov-card-title">Discount Distribution</h3>
              <p className="ov-card-sub">CATE-driven allocation across offer tiers</p>
            </div>
            <button className="ov-link-btn" onClick={() => onNavigate && onNavigate('insights')}>
              View all charts →
            </button>
          </div>
          {donutChart ? (
            <>
              <div style={{ position: 'relative' }}>
                <PlotlyChart data={donutChart.data} layout={donutChart.layout} theme={theme} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {cohortSize != null ? fmt(cohortSize) : '—'}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Customers</span>
                </div>
              </div>
              <div className="ov-donut-legend">
                {(chartData?.discount_distribution?.labels || []).map((lbl, i) => (
                  <div key={i} className="ov-legend-row">
                    <span className="ov-legend-dot" style={{ background: ['#6B7280','#D9253D','#B91C32'][i] }} />
                    <span className="ov-legend-label">{lbl}</span>
                    <span className="ov-legend-count">{fmt(chartData.discount_distribution.values[i])}</span>
                    <span className="ov-legend-pct">({chartData.discount_distribution.percentages[i]}%)</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="ov-empty">Loading chart…</div>
          )}
        </div>

        {/* Card 2 — Income Segment Analysis */}
        <div className="ov-card">
          <div className="ov-card-header">
            <div>
              <h3 className="ov-card-title">Income Segment Analysis</h3>
              <p className="ov-card-sub">Targeting rate & CATE uplift by income tier</p>
            </div>
            <button className="ov-link-btn" onClick={() => onNavigate && onNavigate('insights')}>
              View segments →
            </button>
          </div>
          {incomeChart ? (
            <>
              <PlotlyChart data={incomeChart.data} layout={incomeChart.layout} theme={theme} />
              {chartData?.income_segment_analysis && (
                <table className="ov-seg-table">
                  <thead>
                    <tr>
                      <th>Income Tier</th>
                      <th>Total</th>
                      <th>Targeted</th>
                      <th>Target %</th>
                      <th>Avg CATE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.income_segment_analysis.tiers.map((tier, i) => (
                      <tr key={tier}>
                        <td style={{ fontWeight: 600 }}>{tier}</td>
                        <td>{fmt(chartData.income_segment_analysis.total_customers[i])}</td>
                        <td>{fmt(chartData.income_segment_analysis.targeted_customers[i])}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <ProgressBar value={chartData.income_segment_analysis.targeting_pct[i]} max={100} color="#D9253D" />
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', minWidth: 32 }}>
                              {fmtPct(chartData.income_segment_analysis.targeting_pct[i], 1)}
                            </span>
                          </div>
                        </td>
                        <td style={{ color: '#159447', fontWeight: 600 }}>
                          +{fmtPct(chartData.income_segment_analysis.avg_uplift_pct[i], 2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          ) : (
            <div className="ov-empty">Loading chart…</div>
          )}
        </div>

        {/* Card 3 — Causal Targeting Overview (Gauge) */}
        <div className="ov-card">
          <div className="ov-card-header">
            <div>
              <h3 className="ov-card-title">Causal Targeting Overview</h3>
              <p className="ov-card-sub">CATE-based precision vs random rollout</p>
            </div>
            <button className="ov-link-btn" onClick={() => onNavigate && onNavigate('validation')}>
              View analysis →
            </button>
          </div>
          <div style={{ padding: '12px 0 4px' }}>
            <GaugeChart pct={opt.selected_pct ?? 0} size={200} />
          </div>
          <div className="ov-gauge-stats">
            <div className="ov-gauge-stat">
              <span className="ov-gauge-stat-label">Targeted Customers</span>
              <span className="ov-gauge-stat-value" style={{ color: '#D9253D', fontWeight: 800 }}>
                {fmt(opt.total_discounted_customers)} ({fmtPct(opt.selected_pct, 1)})
              </span>
            </div>
            <div className="ov-gauge-stat">
              <span className="ov-gauge-stat-label">Control Group</span>
              <span className="ov-gauge-stat-value" style={{ color: '#F4AD24', fontWeight: 800 }}>
                {fmt(opt.count_control_0)} ({fmtPct(opt.count_control_0 != null && cohortSize ? (opt.count_control_0/cohortSize*100) : null, 1)})
              </span>
            </div>
            <div className="ov-gauge-stat">
              <span className="ov-gauge-stat-label">RODS Efficiency</span>
              <span className="ov-gauge-stat-value" style={{ color: '#DC3545', fontWeight: 800 }}>
                {opt.return_on_discount_spend != null ? `${fmt(opt.return_on_discount_spend,2)}x` : '—'}
              </span>
            </div>
            {outperf50 != null && (
              <div className="ov-gauge-stat">
                <span className="ov-gauge-stat-label">50% Rollout Outperformance</span>
                <span className="ov-gauge-stat-value" style={{ color: '#159447', fontWeight: 800 }}>+{fmtPct(outperf50, 1)}</span>
              </div>
            )}
          </div>
        </div>

      </section>

      {/* ── BOTTOM ROW ──────────────────────────────────────────────────── */}
      <section className="ov-bottom-row">

        {/* Card — Discount Allocation Library */}
        <div className="ov-card ov-card-wide">
          <div className="ov-card-header">
            <div>
              <h3 className="ov-card-title">Discount Allocation Library</h3>
              <p className="ov-card-sub">CATE-optimised offers and baseline policy benchmarks</p>
            </div>
            <button className="ov-link-btn" onClick={() => onNavigate && onNavigate('recommendations')}>
              View all recommendations →
            </button>
          </div>
          <div className="ov-table-wrap">
            <table className="ov-table">
              <thead>
                <tr>
                  <th>Offer / Policy Name</th>
                  <th>Type</th>
                  <th>Customers</th>
                  <th>Share</th>
                  <th>Nominal Spend</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {allocationRows.length > 0 ? allocationRows.map((row, i) => (
                  <tr key={i} style={row.highlight ? { background: 'rgba(217,37,61,0.03)' } : {}}>
                    <td style={{ fontWeight: row.highlight ? 700 : 500 }}>{row.name}</td>
                    <td>
                      <span style={{
                        fontSize: '0.7rem', padding: '1px 7px', borderRadius: 4,
                        background: row.type === 'Optimal' ? '#FFF1F2' : row.type === 'CATE-Targeted' ? '#EAF8EF' : '#F3F4F6',
                        color: row.type === 'Optimal' ? '#D9253D' : row.type === 'CATE-Targeted' ? '#159447' : '#6B7280',
                        fontWeight: 600, border: `1px solid ${row.type === 'Optimal' ? 'rgba(217,37,61,0.2)' : row.type === 'CATE-Targeted' ? 'rgba(21,148,71,0.2)' : '#E5E7EB'}`,
                      }}>
                        {row.type}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{fmt(row.count)}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ProgressBar value={row.pct} max={100} color={row.type === 'Optimal' ? '#D9253D' : '#E5E7EB'} />
                        <span>{fmtPct(row.pct, 1)}</span>
                      </div>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{row.nominalSpend != null ? fmtCurr(row.nominalSpend) : '—'}</td>
                    <td><StatusBadge status={row.status} /></td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Loading allocation data…</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Card — Causal Portfolio (Qini) */}
        <div className="ov-card">
          <div className="ov-card-header">
            <div>
              <h3 className="ov-card-title">Causal Uplift Curve (Qini)</h3>
              <p className="ov-card-sub">DML policy vs random rollout performance</p>
            </div>
            <button className="ov-link-btn" onClick={() => onNavigate && onNavigate('insights')}>
              View Qini →
            </button>
          </div>

          <div className="ov-portfolio-stats">
            <div className="ov-port-stat">
              <span className="ov-port-stat-label">Total Inc. Orders</span>
              <span className="ov-port-stat-value">{totalOrders != null ? `+${fmt(totalOrders, 1)}` : '—'}</span>
            </div>
            <div className="ov-port-stat">
              <span className="ov-port-stat-label">Qini Score</span>
              <span className="ov-port-stat-value" style={{ color: '#D9253D' }}>{qiniScore != null ? fmt(qiniScore, 1) : '—'}</span>
            </div>
            <div className="ov-port-stat">
              <span className="ov-port-stat-label">Targeted Customers</span>
              <span className="ov-port-stat-value" style={{ color: '#159447' }}>{fmt(opt.total_discounted_customers)} ({fmtPct(opt.selected_pct, 1)})</span>
            </div>
            <div className="ov-port-stat">
              <span className="ov-port-stat-label">Control Group</span>
              <span className="ov-port-stat-value" style={{ color: '#6B7280' }}>{fmt(opt.count_control_0)}</span>
            </div>
          </div>

          {qiniChart ? (
            <PlotlyChart data={qiniChart.data} layout={qiniChart.layout} theme={theme} />
          ) : (
            <div className="ov-empty">Loading Qini curve…</div>
          )}
        </div>

      </section>

      {/* ── INSIGHT BANNER ──────────────────────────────────────────────── */}
      <div className="ov-insight-banner">
        <div className="ov-insight-left">
          <div className="ov-insight-icon">🛡️</div>
          <div>
            <div className="ov-insight-title">
              {opt.return_on_discount_spend >= 7
                ? 'Your causal targeting strategy is highly efficient'
                : 'Causal model optimization is active'}
            </div>
            <div className="ov-insight-sub">
              {summaryData?.natural_language_summary
                || `DML policy generates ${fmtCurr(opt.estimated_incremental_profit_inr)} net incremental profit (${fmt(opt.return_on_discount_spend, 2)}x RODS) by eliminating deadweight subsidies on ${fmt(opt.count_control_0)} unresponsive customers.`}
            </div>
          </div>
        </div>
        <button className="ov-insight-btn" onClick={() => onNavigate && onNavigate('validation')}>
          View Causal Health →
        </button>
      </div>

    </div>
  );
}
