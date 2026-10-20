const fs = require('fs');
const path = require('path');

const cssPath = path.resolve('src/components/DashboardOverview.css');
let css = fs.readFileSync(cssPath, 'utf8');

const darkModeStyles = `
/* ==========================================================================
   DashboardOverview.css — Comprehensive Dark Mode Theme Overrides
   ========================================================================== */
:root[data-theme="dark"] .ov-container {
  background: var(--bg-main, #0B0F19);
  color: var(--text-primary, #F8FAFC);
}

:root[data-theme="dark"] .ov-card,
:root[data-theme="dark"] .ov-kpi-card {
  background: #111827;
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.4);
}

:root[data-theme="dark"] .ov-kpi-card:hover {
  border-color: rgba(239, 68, 68, 0.4);
  box-shadow: 0 6px 24px -2px rgba(239, 68, 68, 0.15);
}

:root[data-theme="dark"] .ov-kpi-title {
  color: #94A3B8;
}

:root[data-theme="dark"] .ov-kpi-value {
  color: #F8FAFC;
}

:root[data-theme="dark"] .ov-kpi-icon-box {
  background: rgba(239, 68, 68, 0.15);
  color: #EF4444;
}

:root[data-theme="dark"] .ov-card-head {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

:root[data-theme="dark"] .ov-card-title {
  color: #F8FAFC;
}

:root[data-theme="dark"] .ov-card-footer {
  border-top-color: rgba(255, 255, 255, 0.08);
}

:root[data-theme="dark"] .ov-footer-link,
:root[data-theme="dark"] .ov-head-action-link {
  color: #EF4444;
}

:root[data-theme="dark"] .ov-footer-link:hover,
:root[data-theme="dark"] .ov-head-action-link:hover {
  color: #F87171;
}

:root[data-theme="dark"] .ov-analytics-table th {
  color: #94A3B8;
  border-bottom-color: rgba(255, 255, 255, 0.1);
}

:root[data-theme="dark"] .ov-analytics-table td {
  color: #F8FAFC;
  border-bottom-color: rgba(255, 255, 255, 0.05);
}

:root[data-theme="dark"] .ov-analytics-table tbody tr:hover {
  background: rgba(255, 255, 255, 0.03);
}

:root[data-theme="dark"] .ov-td-desc,
:root[data-theme="dark"] .ov-td-rule-desc,
:root[data-theme="dark"] .ov-td-type,
:root[data-theme="dark"] .ov-td-rule-type,
:root[data-theme="dark"] .ov-td-date {
  color: #94A3B8;
}

:root[data-theme="dark"] .ov-progress-bar-bg {
  background: rgba(255, 255, 255, 0.1);
}

:root[data-theme="dark"] .ov-legend-name {
  color: #94A3B8;
}

:root[data-theme="dark"] .ov-legend-val {
  color: #F8FAFC;
}

:root[data-theme="dark"] .ov-legend-pct {
  color: #64748B;
}

:root[data-theme="dark"] .ov-donut-center-val {
  color: #F8FAFC;
}

:root[data-theme="dark"] .ov-donut-center-sub {
  color: #94A3B8;
}

:root[data-theme="dark"] .ov-gauge-value {
  color: #F8FAFC;
}

:root[data-theme="dark"] .ov-gauge-sub {
  color: #94A3B8;
}

:root[data-theme="dark"] .ov-floor-stat-val {
  color: #F8FAFC;
}

:root[data-theme="dark"] .ov-floor-stat-lbl {
  color: #94A3B8;
}

:root[data-theme="dark"] .ov-portfolio-left {
  border-right-color: rgba(255, 255, 255, 0.08);
}

:root[data-theme="dark"] .ov-price-total-val {
  color: #F8FAFC;
}

:root[data-theme="dark"] .ov-price-total-lbl {
  color: #94A3B8;
}

:root[data-theme="dark"] .ov-price-act-val {
  color: #F8FAFC;
}

:root[data-theme="dark"] .ov-price-act-lbl {
  color: #94A3B8;
}

:root[data-theme="dark"] .ov-price-inact-val {
  color: #94A3B8;
}

:root[data-theme="dark"] .ov-price-inact-lbl {
  color: #64748B;
}

:root[data-theme="dark"] .ov-price-chart-title {
  color: #94A3B8;
}

:root[data-theme="dark"] .ov-price-y-tick {
  color: #64748B;
}

:root[data-theme="dark"] .ov-price-gridline {
  background: rgba(255, 255, 255, 0.08);
}

:root[data-theme="dark"] .ov-price-bar-col .ov-price-bar-val {
  color: #94A3B8;
}

:root[data-theme="dark"] .ov-price-bar-col .ov-price-bar-label {
  color: #94A3B8;
}

:root[data-theme="dark"] .ov-price-bar-track {
  background: rgba(255, 255, 255, 0.06);
}

:root[data-theme="dark"] .ov-status-pill.active {
  background: rgba(16, 185, 129, 0.15);
  color: #34D399;
}

:root[data-theme="dark"] .ov-status-pill.paused {
  background: rgba(100, 116, 139, 0.2);
  color: #94A3B8;
}

:root[data-theme="dark"] .ov-causal-header-callout {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.25);
}

:root[data-theme="dark"] .ov-causal-callout-title {
  color: #FCA5A5;
}

:root[data-theme="dark"] .ov-causal-callout-desc {
  color: #CBD5E1;
}

:root[data-theme="dark"] .ov-causal-metric-item {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

:root[data-theme="dark"] .ov-cm-lbl {
  color: #94A3B8;
}

:root[data-theme="dark"] .ov-cm-val {
  color: #F8FAFC;
}

:root[data-theme="dark"] .ov-cm-val.muted {
  color: #64748B;
}
`;

if (!css.includes('Comprehensive Dark Mode Theme Overrides')) {
  css += '\n' + darkModeStyles;
  fs.writeFileSync(cssPath, css, 'utf8');
  console.log('Appended dark mode styles to DashboardOverview.css');
} else {
  console.log('Dark mode styles already present');
}
