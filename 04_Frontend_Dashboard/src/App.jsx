import React, { useState, useEffect, useMemo, useCallback } from 'react';

import PlotlyChart from './components/PlotlyChart';

import './App.css';
import './NavigationShell.css';

function parseCsvText(text) {
  const source = String(text ?? '').replace(/^\uFEFF/, '');
  const records = [];
  let record = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];

    if (char === '"') {
      if (inQuotes && source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      record.push(field);
      field = '';
    } else if (char === '\n' && !inQuotes) {
      record.push(field);
      if (record.some((value) => String(value).trim() !== '')) records.push(record);
      record = [];
      field = '';
    } else if (char === '\r' && !inQuotes) {
      // Ignore CR in Windows CRLF line endings; LF closes the record.
    } else {
      field += char;
    }
  }

  if (inQuotes) {
    throw new Error('This CSV contains an unclosed quoted field. Check the file format and try again.');
  }

  if (field.length > 0 || record.length > 0) {
    record.push(field);
    if (record.some((value) => String(value).trim() !== '')) records.push(record);
  }

  if (records.length < 2) {
    throw new Error('The CSV must contain a header row and at least one data row.');
  }

  const rawHeaders = records[0].map((header, index) => {
    const trimmed = String(header ?? '').trim();
    return trimmed || `Column ${index + 1}`;
  });
  const seen = new Map();
  const headers = rawHeaders.map((header) => {
    const count = (seen.get(header) ?? 0) + 1;
    seen.set(header, count);
    return count === 1 ? header : `${header}_${count}`;
  });

  const rows = records.slice(1).map((values) => {
    const row = {};
    headers.forEach((header, index) => {
      row[header] = String(values[index] ?? '').trim();
    });
    return row;
  });

  return { headers, rows };
}

function getDatasetColumnStats(dataset) {
  if (!dataset) return [];

  return dataset.headers.map((header) => {
    const values = dataset.rows.map((row) => String(row[header] ?? '').trim());
    const nonEmpty = values.filter((value) => value !== '');
    const numericValues = nonEmpty.map(Number);
    const isNumeric = nonEmpty.length > 0 && numericValues.every(Number.isFinite);
    const sortedNumbers = isNumeric ? [...numericValues].sort((a, b) => a - b) : [];
    const sum = isNumeric ? numericValues.reduce((total, value) => total + value, 0) : 0;

    return {
      name: header,
      type: nonEmpty.length === 0 ? 'Empty' : isNumeric ? 'Numeric' : 'Text / Category',
      nonEmpty: nonEmpty.length,
      missing: values.length - nonEmpty.length,
      distinct: new Set(nonEmpty).size,
      min: isNumeric ? sortedNumbers[0] : null,
      max: isNumeric ? sortedNumbers[sortedNumbers.length - 1] : null,
      mean: isNumeric ? sum / numericValues.length : null,
    };
  });
}

function csvEscape(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

const navigationItems = [
  { id: 'overview', label: 'Overview', icon: '◫' },
  { id: 'dataset', label: 'Dataset Explorer', icon: '▤' },
  { id: 'insights', label: 'Causal Insights', icon: '◈' },
  { id: 'simulator', label: 'Budget Simulator', icon: '⚙' },
  { id: 'recommendations', label: 'Recommendations', icon: '♙' },
  { id: 'methodology', label: 'Methodology', icon: 'ⓘ' },
];

export default function App() {

  // Data States

  const [summaryData, setSummaryData] = useState(null);

  const [chartData, setChartData] = useState(null);

  const [_methodologyData, setMethodologyData] = useState(null);

  const [recommendations, setRecommendations] = useState([]);

  const [recommendationsError, setRecommendationsError] = useState(null);

  const [pagination, setPagination] = useState({

    page: 1,

    pageSize: 25,

    totalPages: 1,

    totalCount: 0,

    filteredCount: 0,

  });

  // UI & Filter States

  const [isLoading, setIsLoading] = useState(true);

  const [isSimulating, setIsSimulating] = useState(false);

  const [error, setError] = useState(null);

  const [showMethodologyModal, setShowMethodologyModal] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Dataset Explorer state is entirely client-side; CSV contents are not sent to the API.
  const [activeDatasetType, setActiveDatasetType] = useState('pricing');
  const [pricingDataset, setPricingDataset] = useState(null);
  const [groundTruthDataset, setGroundTruthDataset] = useState(null);
  const [datasetLoadError, setDatasetLoadError] = useState('');
  const [datasetSearch, setDatasetSearch] = useState('');
  const [datasetColumnFilter, setDatasetColumnFilter] = useState('');
  const [datasetColumnSearch, setDatasetColumnSearch] = useState('');
  const [datasetPage, setDatasetPage] = useState(1);
  const [datasetPageSize, setDatasetPageSize] = useState(10);

  const [activeChartTab, setActiveChartTab] = useState('overview'); // 'overview' | 'segments'

  const [policyMetric, setPolicyMetric] = useState('profit'); // 'profit' | 'orders' | 'rods'

  // Filter & Search States

  const [searchQuery, setSearchQuery] = useState('');

  const [discountFilter, setDiscountFilter] = useState('');

  const [incomeTierFilter, setIncomeTierFilter] = useState('');

  const [loyaltyFilter, setLoyaltyFilter] = useState('');

  const [sortBy, setSortBy] = useState('customer_id');

  const [sortOrder, setSortOrder] = useState('asc');

  // Simulation Controls State

  const [simBudget, setSimBudget] = useState(50000);

  const [simMargin, setSimMargin] = useState(30);

  const [simBudgetType, setSimBudgetType] = useState('allocated');

  const [simSolver, setSimSolver] = useState('milp');

  const [simulationResult, setSimulationResult] = useState(null);

  const activeDataset = activeDatasetType === 'pricing' ? pricingDataset : groundTruthDataset;

  const datasetColumnStats = useMemo(
    () => getDatasetColumnStats(activeDataset),
    [activeDataset]
  );

  const datasetMissingCellCount = useMemo(
    () => datasetColumnStats.reduce((total, column) => total + column.missing, 0),
    [datasetColumnStats]
  );

  const datasetNumericColumnCount = useMemo(
    () => datasetColumnStats.filter((column) => column.type === 'Numeric').length,
    [datasetColumnStats]
  );

  const filteredDatasetRows = useMemo(() => {
    if (!activeDataset) return [];

    const query = datasetSearch.trim().toLowerCase();
    const columnQuery = datasetColumnSearch.trim().toLowerCase();

    return activeDataset.rows.filter((row) => {
      const matchesGlobalSearch = !query || activeDataset.headers.some((header) =>
        String(row[header] ?? '').toLowerCase().includes(query)
      );
      const matchesColumnSearch = !datasetColumnFilter || !columnQuery ||
        String(row[datasetColumnFilter] ?? '').toLowerCase().includes(columnQuery);
      return matchesGlobalSearch && matchesColumnSearch;
    });
  }, [activeDataset, datasetSearch, datasetColumnFilter, datasetColumnSearch]);

  const datasetPageCount = Math.max(1, Math.ceil(filteredDatasetRows.length / datasetPageSize));
  const safeDatasetPage = Math.min(datasetPage, datasetPageCount);
  const visibleDatasetRows = filteredDatasetRows.slice(
    (safeDatasetPage - 1) * datasetPageSize,
    safeDatasetPage * datasetPageSize
  );

  const handleDatasetTypeChange = (type) => {
    setActiveDatasetType(type);
    setDatasetSearch('');
    setDatasetColumnFilter('');
    setDatasetColumnSearch('');
    setDatasetPage(1);
    setDatasetLoadError('');
  };

  const handleDatasetUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setDatasetLoadError('Please choose a .csv file. Excel files must be exported as CSV first.');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setDatasetLoadError('This file exceeds the 50 MB browser upload limit for this explorer.');
      return;
    }

    setDatasetLoadError('');
    try {
      const text = await file.text();
      const parsed = parseCsvText(text);
      const dataset = {
        fileName: file.name,
        fileSize: file.size,
        loadedAt: new Date().toLocaleString(),
        headers: parsed.headers,
        rows: parsed.rows,
      };

      if (targetDatasetType === 'pricing') {
        setPricingDataset(dataset);
      } else {
        setGroundTruthDataset(dataset);
      }
      setDatasetSearch('');
      setDatasetColumnFilter('');
      setDatasetColumnSearch('');
      setDatasetPage(1);
    } catch (uploadError) {
      setDatasetLoadError(uploadError.message || 'Unable to read this CSV file. Check its format and try again.');
    }
  };

  const handleExportFilteredDataset = () => {
    if (!activeDataset) return;

    const csv = [
      activeDataset.headers.map(csvEscape).join(','),
      ...filteredDatasetRows.map((row) =>
        activeDataset.headers.map((header) => csvEscape(row[header])).join(',')
      ),
    ].join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const baseName = activeDataset.fileName.replace(/\.csv$/i, '').replace(/[^a-z0-9_-]+/gi, '_');
    anchor.href = url;
    anchor.download = `${baseName || 'dataset'}_filtered.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  // --------------------------------------------------------------------------

  // Fetch Initial Data

  // --------------------------------------------------------------------------

  const fetchDashboardData = useCallback(async () => {

    setIsLoading(true);

    setError(null);

    try {

      const [sumRes, chartRes, methRes] = await Promise.all([

        fetch('/api/summary'),

        fetch('/api/charts'),

        fetch('/api/methodology'),

      ]);

      // Preserve the endpoint and HTTP error details so backend failures are diagnosable.

      const failedResponses = [

        { endpoint: '/api/summary', response: sumRes },

        { endpoint: '/api/charts', response: chartRes },

      ].filter(({ response }) => !response.ok);

      if (failedResponses.length > 0) {

        const details = await Promise.all(

          failedResponses.map(async ({ endpoint, response }) => {

            let body = '';

            try {

              body = await response.text();

            } catch {

              // The status code remains useful if the response body cannot be read.

            }

            const trimmedBody = body.trim().slice(0, 800);

            return `${endpoint} returned HTTP ${response.status} ${response.statusText}` +

              (trimmedBody ? `: ${trimmedBody}` : '');

          })

        );

        throw new Error(details.join(' | '));

      }

      const sumJson = await sumRes.json();

      const chartJson = await chartRes.json();

      const methJson = methRes.ok ? await methRes.json() : null;

      setSummaryData(sumJson);

      setChartData(chartJson);

      setMethodologyData(methJson);

    } catch (err) {

      console.error('Error fetching dashboard summary:', err);

      setError(err.message || 'Unable to connect to the EconoCausal backend service.');

    } finally {

      setIsLoading(false);

    }

  }, []);

  // --------------------------------------------------------------------------

  // Fetch Customer Recommendations

  // --------------------------------------------------------------------------

  const fetchRecommendations = useCallback(async () => {

    setRecommendationsError(null);

    try {

      const params = new URLSearchParams({

        page: pagination.page.toString(),

        page_size: pagination.pageSize.toString(),

        sort_by: sortBy,

        sort_order: sortOrder,

      });

      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      if (discountFilter !== '') params.append('discount', discountFilter);

      if (incomeTierFilter !== '') params.append('income_tier', incomeTierFilter);

      if (loyaltyFilter !== '') params.append('loyalty', loyaltyFilter);

      const res = await fetch(`/api/recommendations?${params.toString()}`);

      if (!res.ok) throw new Error('Failed to load customer recommendations.');

      const data = await res.json();

      if (!Array.isArray(data.items)) {

        throw new Error(

          'The recommendations API returned an invalid response.'

        );

      }

      setRecommendations(data.items);

      setPagination((prev) => ({

        ...prev,

        totalCount: data.total_count,

        filteredCount: data.filtered_count,

        totalPages: data.total_pages,

      }));

    } catch (err) {

      console.error('Error fetching recommendations:', err);

      setRecommendationsError(

        err.message || 'Unable to load customer recommendations.'

      );

      setRecommendations([]);

    }

  }, [

    pagination.page,

    pagination.pageSize,

    searchQuery,

    discountFilter,

    incomeTierFilter,

    loyaltyFilter,

    sortBy,

    sortOrder,

  ]);

  useEffect(() => {

    fetchDashboardData();

  }, [fetchDashboardData]);

  useEffect(() => {

    fetchRecommendations();

  }, [fetchRecommendations]);

  // --------------------------------------------------------------------------

  // Handle Live Simulation

  // --------------------------------------------------------------------------

  const handleRunSimulation = async (e) => {

    e.preventDefault();

    setIsSimulating(true);

    try {

      const res = await fetch('/api/simulate', {

        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({

          budget: Number(simBudget),

          margin_ratio: Number(simMargin) / 100.0,

          budget_type: simBudgetType,

          solver: simSolver,

        }),

      });

      if (!res.ok) {

        const errData = await res.json();

        throw new Error(errData.detail || 'Simulation failed.');

      }

      const data = await res.json();

      setSimulationResult(data.performance);

    } catch (err) {

      alert(`Simulation Error: ${err.message}`);

    } finally {

      setIsSimulating(false);

    }

  };

  const handleResetSimulation = () => {

    setSimBudget(50000);

    setSimMargin(30);

    setSimBudgetType('allocated');

    setSimSolver('milp');

    setSimulationResult(null);

  };

  const handleSort = (columnKey) => {

    if (sortBy === columnKey) {

      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');

    } else {

      setSortBy(columnKey);

      setSortOrder('desc'); // Default to descending for numbers

    }

    setPagination((prev) => ({ ...prev, page: 1 }));

  };

  // --------------------------------------------------------------------------

  // Memoized Chart Configs for Plotly

  // --------------------------------------------------------------------------

  const discountDonutChart = useMemo(() => {

    if (!chartData?.discount_distribution) return null;

    const dist = chartData.discount_distribution;

    return {

      data: [

        {

          type: 'pie',

          labels: dist.labels,

          values: dist.values,

          hole: 0.58,

          marker: { colors: dist.colors },

          textinfo: 'label+percent',

          textposition: 'outside',

          automargin: true,

          hoverinfo: 'label+value+percent',

          hovertemplate: '<b>%{label}</b><br>Shoppers: %{value:,}<br>Share: %{percent}<extra></extra>',

        },

      ],

      layout: {

        title: { text: '<b>Customer Offer Allocation Share</b>', font: { size: 14, color: '#F8FAFC' } },

        showlegend: false,

        height: 330,

        margin: { t: 40, b: 20, l: 20, r: 20 },

      },

    };

  }, [chartData]);

  const policyComparisonChart = useMemo(() => {

    if (!chartData?.policy_comparison) return null;

    const comp = chartData.policy_comparison;

    let yValues = comp.incremental_profit;

    let yTitle = 'Incremental Profit (₹)';

    let hoverPrefix = '₹';

    let hoverSuffix = '';

    if (policyMetric === 'orders') {

      yValues = comp.incremental_orders;

      yTitle = 'Incremental Purchases (Orders)';

      hoverPrefix = '+';

      hoverSuffix = ' orders';

    } else if (policyMetric === 'rods') {

      yValues = comp.rods;

      yTitle = 'Return on Discount Spend (RODS)';

      hoverPrefix = '';

      hoverSuffix = 'x';

    }

    return {

      data: [

        {

          type: 'bar',

          x: comp.names.map((name) => name.replace('Baseline ', 'B')),

          y: yValues,

          marker: {

            color: ['#10B981', '#F59E0B', '#3B82F6', '#EC4899'],

            line: { color: 'rgba(255, 255, 255, 0.2)', width: 1 },

          },

          hovertemplate: `<b>%{x}</b><br>${yTitle}: ${hoverPrefix}%{y:,.2f}${hoverSuffix}<extra></extra>`,

        },

      ],

      layout: {

        title: { text: `<b>Policy Benchmarks: ${yTitle}</b>`, font: { size: 14, color: '#F8FAFC' } },

        yaxis: { title: yTitle, gridcolor: 'rgba(255, 255, 255, 0.08)' },

        xaxis: { tickfont: { size: 11, color: '#CBD5E1' } },

        height: 330,

        margin: { t: 40, b: 60, l: 60, r: 20 },

      },

    };

  }, [chartData, policyMetric]);

  const incomeSegmentChart = useMemo(() => {

    if (!chartData?.income_segment_analysis) return null;

    const seg = chartData.income_segment_analysis;

    return {

      data: [

        {

          name: 'Targeting Rate (%)',

          type: 'bar',

          x: seg.tiers,

          y: seg.targeting_pct,

          marker: { color: '#06B6D4' },

          hovertemplate: '<b>%{x}</b><br>Discounted Share: %{y:.1f}%<extra></extra>',

        },

        {

          name: 'Avg CATE Uplift (%)',

          type: 'bar',

          x: seg.tiers,

          y: seg.avg_uplift_pct,

          marker: { color: '#8B5CF6' },

          hovertemplate: '<b>%{x}</b><br>Avg Incremental Uplift: +%{y:.2f}%<extra></extra>',

        },

      ],

      layout: {

        barmode: 'group',

        title: { text: '<b>Targeting & Price Sensitivity by Income Tier</b>', font: { size: 14, color: '#F8FAFC' } },

        yaxis: { title: 'Percentage (%)', gridcolor: 'rgba(255, 255, 255, 0.08)' },

        legend: { orientation: 'h', y: -0.2, x: 0.1 },

        height: 330,

        margin: { t: 40, b: 60, l: 50, r: 20 },

      },

    };

  }, [chartData]);

  const loyaltySegmentChart = useMemo(() => {

    if (!chartData?.loyalty_analysis) return null;

    const loy = chartData.loyalty_analysis;

    return {

      data: [

        {

          type: 'bar',

          x: loy.segments,

          y: loy.total_profit_inr,

          marker: { color: ['#6366F1', '#EC4899'] },

          hovertemplate: '<b>%{x}</b><br>Total Incremental Profit: ₹%{y:,.2f}<extra></extra>',

        },

      ],

      layout: {

        title: { text: '<b>Incremental Profit by Loyalty Status</b>', font: { size: 14, color: '#F8FAFC' } },

        yaxis: { title: 'Incremental Profit (₹)', gridcolor: 'rgba(255, 255, 255, 0.08)' },

        height: 330,

        margin: { t: 40, b: 40, l: 65, r: 20 },

      },

    };

  }, [chartData]);

  // Active Policy Metrics (Simulated or Baseline)

  const baselinePolicy = summaryData?.optimal_policy ?? {};

  const activePolicy = simulationResult ?? baselinePolicy;

  // Derive cohort size from backend policy counts instead of hardcoding it.

  const cohortSize =

    baselinePolicy.count_control_0 != null &&

    baselinePolicy.total_discounted_customers != null

      ? Number(baselinePolicy.count_control_0) +

        Number(baselinePolicy.total_discounted_customers)

      : null;

  const formatNumber = (value, digits = 0) =>

    value == null || !Number.isFinite(Number(value))

      ? '—'

      : Number(value).toLocaleString('en-IN', {

          minimumFractionDigits: digits,

          maximumFractionDigits: digits,

        });

  const formatCurrency = (value, digits = 2) =>

    value == null || !Number.isFinite(Number(value))

      ? '—'

      : `₹${formatNumber(value, digits)}`;

  const formatPercent = (value, digits = 1) =>

    value == null || !Number.isFinite(Number(value))

      ? '—'

      : `${formatNumber(value, digits)}%`;

  // --------------------------------------------------------------------------

  // Render Loading & Error States

  // --------------------------------------------------------------------------

  if (isLoading) {

    return (

      <div className="state-container">

        <div className="spinner"></div>

        <h2>Initializing EconoCausal Dashboard...</h2>

        <p style={{ color: 'var(--text-muted)' }}>Loading prescriptive optimization artifacts and CATE distributions...</p>

      </div>

    );

  }

  if (error) {
    const isOffline =
      error.includes('502') ||
      error.includes('503') ||
      error.includes('ECONNREFUSED') ||
      error.includes('Failed to fetch') ||
      error.includes('offline');

    return (
      <div className="state-container">
        <div className="error-card" style={{ maxWidth: '580px', padding: '2rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔌</div>
          <h3>{isOffline ? 'Backend Service Offline' : 'Dashboard Connection Error'}</h3>
          <p style={{ color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
            {isOffline
              ? 'The FastAPI backend is not running on http://127.0.0.1:8000. Start it in a terminal to load dashboard metrics and recommendations.'
              : error}
          </p>
          {isOffline && (
            <div
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1.5rem',
                textAlign: 'left',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.85rem',
              }}
            >
              <div style={{ color: '#94a3b8', marginBottom: '0.4rem', fontSize: '0.75rem' }}>
                Run this command in 04_Frontend_Dashboard:
              </div>
              <code style={{ color: '#38bdf8', fontWeight: 600 }}>npm run backend</code>
              <div style={{ color: '#94a3b8', margin: '0.5rem 0 0.4rem', fontSize: '0.75rem' }}>
                Or from project root:
              </div>
              <code style={{ color: '#4ade80', fontWeight: 600 }}>python 04_Frontend_Dashboard/backend/app.py</code>
            </div>
          )}
          <button className="btn btn-primary" onClick={fetchDashboardData} style={{ width: '100%' }}>
            🔄 Retry Connecting to Backend
          </button>
        </div>
      </div>
    );
  }

  return (

    <div className="ec-app-shell">
      <aside className="ec-sidebar" aria-label="EconoCausal workspace navigation">
        <div className="ec-sidebar-brand">
          <div className="ec-brand-mark" aria-hidden="true">EC</div>
          <div>
            <div className="ec-brand-name">EconoCausal</div>
            <div className="ec-brand-caption">PRICING INTELLIGENCE</div>
          </div>
        </div>

        <div className="ec-nav-heading">WORKSPACE</div>
        <nav className="ec-nav-list" aria-label="Main navigation">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`ec-nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
              aria-current={activeTab === item.id ? 'page' : undefined}
            >
              <span className="ec-nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
              {activeTab === item.id && (
                <span className="ec-nav-indicator" aria-hidden="true" />
              )}
            </button>
          ))}
        </nav>

        <div className="ec-sidebar-footer">
          <span className="ec-status-dot" aria-hidden="true" />
          <div>
            <div className="ec-footer-title">EconoCausal Engine</div>
            <div className="ec-footer-caption">Pricing workspace</div>
          </div>
        </div>
      </aside>

      <main className="ec-main-area">
        <div className="dashboard-container">

      {/* --------------------------------------------------------------------

         1. Header & System Status

         -------------------------------------------------------------------- */}

      <header className="dashboard-header">

        <div className="brand-section">

          <div className="brand-icon">📈</div>

          <div className="brand-titles">

            <h1>

              EconoCausal

              <span className="badge-tag primary">Causal ML Engine</span>

            </h1>

            <p>Prescriptive Pricing Optimization & Budget Allocation Dashboard</p>

          </div>

        </div>

        <div className="header-actions">

          <div className="system-status">

            <span className="status-dot"></span>

            <span>API Online</span>

            <span style={{ color: 'var(--border-subtle)' }}>|</span>

            <span>EconML LinearDML</span>

            <span style={{ color: 'var(--border-subtle)' }}>|</span>

            <span>HiGHS MILP</span>

          </div>

          <button

            className="btn btn-secondary"

            onClick={() => setShowMethodologyModal(true)}

            title="View Causal Assumptions & Methodology"

          >

            ℹ️ Methodology

          </button>

        </div>

      </header>

      <div className="ec-current-page" aria-live="polite">
        <span className="ec-current-page-label">CURRENT WORKSPACE</span>
        <span className="ec-current-page-title">
          {navigationItems.find((item) => item.id === activeTab)?.label ?? 'Overview'}
        </span>
      </div>

      {activeTab === 'overview' && (
        <>
{/* --------------------------------------------------------------------

         2. Disclaimer Banner

         -------------------------------------------------------------------- */}

      <div className="methodology-banner">

        <div className="banner-icon">💡</div>

        <div className="banner-content">

          <strong>Methodological Notice & Simulated Estimates:</strong> Figures are computed on a reproducible

          synthetic e-commerce benchmark {cohortSize == null ? '' : `(N=${cohortSize.toLocaleString('en-IN')})`}. Incremental profit and conversions reflect estimated

          conditional average treatment effects (CATE / τ̂ᵢ), not guaranteed real-world financial returns.

          <a onClick={() => setShowMethodologyModal(true)}>Read methodology disclosures &rarr;</a>

        </div>

      </div>

      {/* --------------------------------------------------------------------

         3. Overview KPI Cards Grid

         -------------------------------------------------------------------- */}

      <section className="kpi-grid">

        {/* Card 1: Cohort Size */}

        <div className="kpi-card cyan">

          <div className="kpi-header">

            <span className="kpi-title">Cohort Size</span>

            <span className="kpi-icon">👥</span>

          </div>

          <div className="kpi-value">{cohortSize == null ? '—' : cohortSize.toLocaleString('en-IN')}</div>

          <div className="kpi-subtitle">

            <span className="kpi-badge info">

              {activePolicy.total_discounted_customers == null ? '—' : formatNumber(activePolicy.total_discounted_customers)} targeted ({formatPercent(activePolicy.selected_pct, 2)})

            </span>

          </div>

        </div>

        {/* Card 2: Campaign Budget */}

        <div className="kpi-card indigo">

          <div className="kpi-header">

            <span className="kpi-title">Campaign Budget</span>

            <span className="kpi-icon">🎯</span>

          </div>

          <div className="kpi-value">{formatCurrency(activePolicy.total_budget)}</div>

          <div className="kpi-subtitle">

            <span>Cap Mode: </span>

            <strong style={{ color: 'var(--text-main)', textTransform: 'capitalize' }}>

              {activePolicy.budget_type ?? '—'}

            </strong>

          </div>

        </div>

        {/* Card 3: Allocated Spend & Utilization */}

        <div className="kpi-card amber">

          <div className="kpi-header">

            <span className="kpi-title">Allocated Spend</span>

            <span className="kpi-icon">💳</span>

          </div>

          <div className="kpi-value">{formatCurrency(activePolicy.allocated_budget)}</div>

          <div className="kpi-subtitle">

            <span className="kpi-badge warning">{formatPercent(activePolicy.budget_utilization_pct, 1)} Used</span>

            <span>(Unused: {formatCurrency(activePolicy.unused_budget)})</span>

          </div>

        </div>

        {/* Card 4: Nominal Liability vs Expected Redeemed Cost */}

        <div className="kpi-card violet">

          <div className="kpi-header">

            <span className="kpi-title">Budget Liabilities</span>

            <span className="kpi-icon">⚖️</span>

          </div>

          <div className="kpi-value" style={{ fontSize: '1.35rem' }}>

            {formatCurrency(activePolicy.nominal_coupon_liability, 0)}

          </div>

          <div className="kpi-subtitle">

            <span>Redeemed Est: </span>

            <strong style={{ color: 'var(--color-emerald)' }}>

              {formatCurrency(activePolicy.expected_redeemed_cost)}

            </strong>

          </div>

        </div>

        {/* Card 5: Incremental Conversions */}

        <div className="kpi-card cyan">

          <div className="kpi-header">

            <span className="kpi-title">Inc. Purchases</span>

            <span className="kpi-icon">📦</span>

          </div>

          <div className="kpi-value">{activePolicy.estimated_incremental_purchases == null ? '—' : `+${formatNumber(activePolicy.estimated_incremental_purchases, 1)}`}</div>

          <div className="kpi-subtitle">

            <span className="kpi-badge info">{activePolicy.avg_incremental_uplift_pct == null ? '—' : `+${formatPercent(activePolicy.avg_incremental_uplift_pct, 2)}`} Uplift</span>

          </div>

        </div>

        {/* Card 6: Incremental Profit */}

        <div className="kpi-card emerald">

          <div className="kpi-header">

            <span className="kpi-title">Inc. Net Profit</span>

            <span className="kpi-icon">💰</span>

          </div>

          <div className="kpi-value" style={{ color: 'var(--color-emerald)' }}>

            {formatCurrency(activePolicy.estimated_incremental_profit_inr)}

          </div>

          <div className="kpi-subtitle">

            <span>Net of Deadweight Loss & Discounts</span>

          </div>

        </div>

        {/* Card 7: Return on Discount Spend (RODS) */}

        <div className="kpi-card emerald">

          <div className="kpi-header">

            <span className="kpi-title">RODS Efficiency</span>

            <span className="kpi-icon">🚀</span>

          </div>

          <div className="kpi-value" style={{ color: 'var(--color-emerald)' }}>

            {activePolicy.return_on_discount_spend == null ? '—' : `${formatNumber(activePolicy.return_on_discount_spend, 2)}x`}

          </div>

          <div className="kpi-subtitle">

            <span>{activePolicy.return_on_discount_spend == null ? '—' : `₹${formatNumber(activePolicy.return_on_discount_spend, 2)}`} net profit per ₹1 spent</span>

          </div>

        </div>

      </section>

      
        </>
      )}

      {activeTab === 'dataset' && (
        <section className="ec-page-intro ec-dataset-page" aria-labelledby="dataset-page-title">
          <div className="ec-page-eyebrow">DATA MANAGEMENT</div>
          <div className="ec-dataset-heading-row">
            <div>
              <h2 id="dataset-page-title">Dataset Explorer</h2>
              <p>
                Inspect CSV data locally, check data quality, search records, and review
                numerical summaries before using a dataset in an analysis workflow.
              </p>
            </div>
            <span className="ec-local-badge"><span aria-hidden="true">●</span> Browser-only analysis</span>
          </div>

          <div className="ec-dataset-type-tabs" role="group" aria-label="Choose dataset purpose">
            <button
              type="button"
              className={`ec-dataset-type-tab ${activeDatasetType === 'pricing' ? 'active' : ''}`}
              onClick={() => handleDatasetTypeChange('pricing')}
              aria-pressed={activeDatasetType === 'pricing'}
            >
              <span className="ec-dataset-type-icon" aria-hidden="true">▤</span>
              <span className="ec-dataset-type-copy">
                <strong>Pricing dataset</strong>
                <small>Customer features and observed outcomes</small>
              </span>
              {pricingDataset && <span className="ec-dataset-loaded-check" title="Pricing CSV loaded" aria-label="Pricing CSV loaded">✓</span>}
            </button>
            <button
              type="button"
              className={`ec-dataset-type-tab ${activeDatasetType === 'ground_truth' ? 'active' : ''}`}
              onClick={() => handleDatasetTypeChange('ground_truth')}
              aria-pressed={activeDatasetType === 'ground_truth'}
            >
              <span className="ec-dataset-type-icon" aria-hidden="true">◈</span>
              <span className="ec-dataset-type-copy">
                <strong>Ground-truth evaluation</strong>
                <small>Counterfactual / benchmark data for evaluation only</small>
              </span>
              {groundTruthDataset && <span className="ec-dataset-loaded-check" title="Evaluation CSV loaded" aria-label="Evaluation CSV loaded">✓</span>}
            </button>
          </div>

          <div className={`ec-dataset-notice ${activeDatasetType === 'ground_truth' ? 'warning' : ''}`} role="note">
            <span className="ec-dataset-notice-icon" aria-hidden="true">{activeDatasetType === 'ground_truth' ? '⚠' : '🔒'}</span>
            <div>
              <strong>{activeDatasetType === 'ground_truth' ? 'Evaluation-only data' : 'Local and isolated'}</strong>
              <p>
                {activeDatasetType === 'ground_truth'
                  ? 'Keep this file separate from training and recommendation generation. It is only inspected in this browser; this explorer does not send it to the backend.'
                  : 'The selected CSV is parsed in your browser and is not uploaded to FastAPI. This explorer performs descriptive checks only; it does not retrain the model or change recommendations.'}
              </p>
            </div>
          </div>

          <div className="ec-dataset-upload-card">
            <div className="ec-dataset-upload-copy">
              <div className="ec-upload-icon" aria-hidden="true">↑</div>
              <div>
                <h3>Load {activeDatasetType === 'pricing' ? 'pricing' : 'ground-truth'} CSV</h3>
                <p>Choose a local .csv file (maximum 50 MB). Existing files can be replaced by selecting another file.</p>
              </div>
            </div>
            <label className="ec-upload-button">
              <span aria-hidden="true">＋</span> Choose CSV file
              <input type="file" accept=".csv,text/csv" onChange={handleDatasetUpload} />
            </label>
            {activeDataset && (
              <div className="ec-file-meta" aria-live="polite">
                <span className="ec-file-status-dot" aria-hidden="true" />
                <span className="ec-file-name" title={activeDataset.fileName}>{activeDataset.fileName}</span>
                <span>{(activeDataset.fileSize / 1024).toLocaleString('en-IN', { maximumFractionDigits: 1 })} KB</span>
                <span>Loaded {activeDataset.loadedAt}</span>
              </div>
            )}
          </div>

          {datasetLoadError && (
            <div className="ec-dataset-error" role="alert">
              <strong>CSV could not be loaded.</strong>
              <span>{datasetLoadError}</span>
            </div>
          )}

          {!activeDataset ? (
            <div className="ec-dataset-empty-state">
              <div className="ec-dataset-empty-art" aria-hidden="true">▤</div>
              <h3>No {activeDatasetType === 'pricing' ? 'pricing' : 'ground-truth'} dataset loaded</h3>
              <p>
                {activeDatasetType === 'pricing'
                  ? 'Select synthetic_pricing.csv to start inspecting customer features, discounts, purchases, and spend.'
                  : 'Select synthetic_ground_truth.csv to inspect evaluation-only probability and uplift fields separately.'}
              </p>
              <label className="ec-upload-button ec-upload-button-secondary">
                Choose a CSV file
                <input type="file" accept=".csv,text/csv" onChange={handleDatasetUpload} />
              </label>
            </div>
          ) : (
            <>
              <div className="ec-dataset-stat-grid" aria-label="Dataset summary">
                <article className="ec-dataset-stat-card">
                  <span className="ec-dataset-stat-label">Records</span>
                  <strong>{activeDataset.rows.length.toLocaleString('en-IN')}</strong>
                  <small>Data rows parsed</small>
                </article>
                <article className="ec-dataset-stat-card">
                  <span className="ec-dataset-stat-label">Columns</span>
                  <strong>{activeDataset.headers.length.toLocaleString('en-IN')}</strong>
                  <small>Fields detected</small>
                </article>
                <article className="ec-dataset-stat-card">
                  <span className="ec-dataset-stat-label">Missing cells</span>
                  <strong className={datasetMissingCellCount > 0 ? 'ec-stat-warning' : ''}>{datasetMissingCellCount.toLocaleString('en-IN')}</strong>
                  <small>Blank values across the file</small>
                </article>
                <article className="ec-dataset-stat-card">
                  <span className="ec-dataset-stat-label">Numeric columns</span>
                  <strong>{datasetNumericColumnCount.toLocaleString('en-IN')}</strong>
                  <small>Inferred from the loaded values</small>
                </article>
              </div>

              <section className="ec-dataset-panel" aria-labelledby="dataset-profile-title">
                <div className="ec-dataset-panel-header">
                  <div>
                    <h3 id="dataset-profile-title">Column profile</h3>
                    <p>Types are inferred from the loaded CSV values; check the source schema before modelling.</p>
                  </div>
                  <span className="ec-count-pill">{datasetColumnStats.length} fields</span>
                </div>
                <div className="ec-dataset-table-wrap">
                  <table className="ec-dataset-table ec-profile-table">
                    <thead>
                      <tr>
                        <th scope="col">Column</th>
                        <th scope="col">Inferred type</th>
                        <th scope="col">Filled</th>
                        <th scope="col">Missing</th>
                        <th scope="col">Unique</th>
                        <th scope="col">Min</th>
                        <th scope="col">Mean</th>
                        <th scope="col">Max</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datasetColumnStats.map((column) => (
                        <tr key={column.name}>
                          <td className="ec-column-name">{column.name}</td>
                          <td><span className={`ec-type-pill ${column.type === 'Numeric' ? 'numeric' : ''}`}>{column.type}</span></td>
                          <td>{column.nonEmpty.toLocaleString('en-IN')}</td>
                          <td className={column.missing > 0 ? 'ec-stat-warning' : ''}>{column.missing.toLocaleString('en-IN')}</td>
                          <td>{column.distinct.toLocaleString('en-IN')}</td>
                          <td>{column.min == null ? '—' : column.min.toLocaleString('en-IN', { maximumFractionDigits: 4 })}</td>
                          <td>{column.mean == null ? '—' : column.mean.toLocaleString('en-IN', { maximumFractionDigits: 4 })}</td>
                          <td>{column.max == null ? '—' : column.max.toLocaleString('en-IN', { maximumFractionDigits: 4 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="ec-dataset-panel" aria-labelledby="dataset-preview-title">
                <div className="ec-dataset-panel-header ec-preview-header">
                  <div>
                    <h3 id="dataset-preview-title">Record preview</h3>
                    <p>Search across fields or narrow the preview to one column. Filtering is local to this page.</p>
                  </div>
                  <button type="button" className="btn btn-secondary ec-export-button" onClick={handleExportFilteredDataset}>
                    ↓ Export filtered CSV ({filteredDatasetRows.length.toLocaleString('en-IN')})
                  </button>
                </div>

                <div className="ec-dataset-toolbar">
                  <label className="ec-dataset-search">
                    <span aria-hidden="true">⌕</span>
                    <span className="ec-sr-only">Search all columns</span>
                    <input
                      type="search"
                      value={datasetSearch}
                      onChange={(event) => { setDatasetSearch(event.target.value); setDatasetPage(1); }}
                      placeholder="Search all columns..."
                    />
                  </label>
                  <div className="ec-column-filter-control">
                    <label htmlFor="ec-column-filter">Filter column</label>
                    <select
                      id="ec-column-filter"
                      value={datasetColumnFilter}
                      onChange={(event) => { setDatasetColumnFilter(event.target.value); setDatasetPage(1); }}
                    >
                      <option value="">All columns</option>
                      {activeDataset.headers.map((header) => <option key={header} value={header}>{header}</option>)}
                    </select>
                  </div>
                  <label className="ec-column-search">
                    <span className="ec-sr-only">Column filter value</span>
                    <input
                      type="search"
                      value={datasetColumnSearch}
                      onChange={(event) => { setDatasetColumnSearch(event.target.value); setDatasetPage(1); }}
                      placeholder={datasetColumnFilter ? `Contains in ${datasetColumnFilter}` : 'Column contains...'}
                      disabled={!datasetColumnFilter}
                    />
                  </label>
                  <div className="ec-rows-control">
                    <label htmlFor="ec-dataset-page-size">Rows</label>
                    <select
                      id="ec-dataset-page-size"
                      value={datasetPageSize}
                      onChange={(event) => { setDatasetPageSize(Number(event.target.value)); setDatasetPage(1); }}
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>

                <div className="ec-dataset-results-line" aria-live="polite">
                  Showing {filteredDatasetRows.length === 0 ? 0 : ((safeDatasetPage - 1) * datasetPageSize) + 1}–{Math.min(safeDatasetPage * datasetPageSize, filteredDatasetRows.length)} of {filteredDatasetRows.length.toLocaleString('en-IN')} matching records
                </div>

                <div className="ec-dataset-table-wrap ec-record-preview-wrap">
                  <table className="ec-dataset-table ec-record-table">
                    <thead>
                      <tr>
                        {activeDataset.headers.map((header) => <th scope="col" key={header}>{header}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleDatasetRows.length > 0 ? visibleDatasetRows.map((row, rowIndex) => (
                        <tr key={`${activeDataset.fileName}-${(safeDatasetPage - 1) * datasetPageSize + rowIndex}`}>
                          {activeDataset.headers.map((header) => (
                            <td key={header} title={row[header]}>{row[header] === '' ? <span className="ec-empty-cell">—</span> : row[header]}</td>
                          ))}
                        </tr>
                      )) : (
                        <tr><td colSpan={activeDataset.headers.length} className="ec-no-results">No rows match the current search and filters.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="ec-dataset-pagination">
                  <span>Page {safeDatasetPage} of {datasetPageCount}</span>
                  <div>
                    <button
                      type="button"
                      className="page-btn"
                      disabled={safeDatasetPage <= 1}
                      onClick={() => setDatasetPage((page) => Math.max(1, page - 1))}
                    >Previous</button>
                    <button
                      type="button"
                      className="page-btn"
                      disabled={safeDatasetPage >= datasetPageCount}
                      onClick={() => setDatasetPage((page) => Math.min(datasetPageCount, page + 1))}
                    >Next</button>
                  </div>
                </div>
              </section>
            </>
          )}
        </section>
      )}

      {activeTab === 'methodology' && (
        <section className="ec-page-intro" aria-labelledby="methodology-page-title">
          <div className="ec-page-eyebrow">MODEL TRANSPARENCY</div>
          <h2 id="methodology-page-title">Methodology &amp; Responsible AI</h2>
          <p>
            Review the causal-estimation assumptions and how campaign constraints
            are translated into budget-constrained pricing decisions.
          </p>
          <div className="ec-method-grid">
            <article className="ec-placeholder-card">
              <h3>Causal estimation</h3>
              <p>
                The dashboard describes heterogeneous treatment effects (CATE)
                estimated through the configured EconML LinearDML pipeline.
                Estimates are not guaranteed real-world outcomes.
              </p>
            </article>
            <article className="ec-placeholder-card">
              <h3>Budget optimization</h3>
              <p>
                Campaign allocation is subject to the selected budget-liability
                mode, contribution margin, discount costs, and solver.
              </p>
            </article>
            <article className="ec-placeholder-card">
              <h3>Data separation</h3>
              <p>
                Ground-truth evaluation data should remain isolated from model
                training and customer recommendation generation.
              </p>
            </article>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowMethodologyModal(true)}
          >
            Open Full Methodology Disclosure
          </button>
        </section>
      )}

      {activeTab === 'simulator' && (
        <>
{/* --------------------------------------------------------------------

         4. Interactive Policy Simulation Panel

         -------------------------------------------------------------------- */}

      <section className="simulation-panel">

        <div className="panel-header">

          <div className="panel-title">

            <span>⚡</span>

            <span>Policy Simulation & Optimization Controls</span>

          </div>

          <div className="panel-actions">

            {simulationResult && (

              <button className="btn btn-secondary" onClick={handleResetSimulation}>

                Reset to Baseline

              </button>

            )}

            <button

              className="btn btn-primary"

              onClick={handleRunSimulation}

              disabled={isSimulating}

            >

              {isSimulating ? 'Optimizing...' : 'Simulate Allocation'}

            </button>

          </div>

        </div>

        <form className="controls-form" onSubmit={handleRunSimulation}>

          {/* Control 1: Campaign Budget Slider */}

          <div className="control-group">

            <div className="control-label">

              <span>Total Budget (B)</span>

              <span className="control-val-display">₹{Number(simBudget).toLocaleString()}</span>

            </div>

            <input

              type="range"

              min="5000"

              max="150000"

              step="5000"

              value={simBudget}

              onChange={(e) => setSimBudget(Number(e.target.value))}

              className="range-slider"

            />

          </div>

          {/* Control 2: Gross Contribution Margin Slider */}

          <div className="control-group">

            <div className="control-label">

              <span>Contribution Margin (m)</span>

              <span className="control-val-display">{simMargin}%</span>

            </div>

            <input

              type="range"

              min="10"

              max="60"

              step="5"

              value={simMargin}

              onChange={(e) => setSimMargin(Number(e.target.value))}

              className="range-slider"

            />

          </div>

          {/* Control 3: Budget Type Toggle */}

          <div className="control-group">

            <div className="control-label">

              <span>Liability Mode</span>

            </div>

            <div className="toggle-group">

              <button

                type="button"

                className={`toggle-btn ${simBudgetType === 'allocated' ? 'active' : ''}`}

                onClick={() => setSimBudgetType('allocated')}

              >

                Nominal (Allocated)

              </button>

              <button

                type="button"

                className={`toggle-btn ${simBudgetType === 'redeemed' ? 'active' : ''}`}

                onClick={() => setSimBudgetType('redeemed')}

              >

                Expected (Redeemed)

              </button>

            </div>

          </div>

          {/* Control 4: Solver Engine Toggle */}

          <div className="control-group">

            <div className="control-label">

              <span>Solver Engine</span>

            </div>

            <div className="toggle-group">

              <button

                type="button"

                className={`toggle-btn ${simSolver === 'milp' ? 'active' : ''}`}

                onClick={() => setSimSolver('milp')}

              >

                HiGHS MILP (Exact)

              </button>

              <button

                type="button"

                className={`toggle-btn ${simSolver === 'greedy' ? 'active' : ''}`}

                onClick={() => setSimSolver('greedy')}

              >

                Greedy Heuristic

              </button>

            </div>

          </div>

        </form>

        {simulationResult && (

          <div className="sim-result-alert">

            <div>

              <strong>Active Simulation:</strong> Solved for ₹{Number(simBudget).toLocaleString()} budget @ {simMargin}% margin using {simSolver.toUpperCase()}.

            </div>

            <div className="sim-result-metrics">

              <span className="sim-metric-item">

                Profit: <strong>₹{simulationResult.estimated_incremental_profit_inr?.toLocaleString()}</strong>

              </span>

              <span className="sim-metric-item">

                Orders: <strong>+{simulationResult.estimated_incremental_purchases?.toFixed(1)}</strong>

              </span>

              <span className="sim-metric-item">

                RODS: <strong>{simulationResult.return_on_discount_spend}x</strong>

              </span>

            </div>

          </div>

        )}

      </section>

      
        </>
      )}

{activeTab === 'insights' && (
        <>
{/* --------------------------------------------------------------------

         5. Interactive Plotly Charts Section

         -------------------------------------------------------------------- */}

      <section className="charts-section">

        <div className="charts-header">

          <div className="section-title">

            <span>📊</span>

            <span>Interactive Causal & Optimization Visualizations</span>

          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>

            <div className="chart-tabs">

              <button

                className={`tab-btn ${activeChartTab === 'overview' ? 'active' : ''}`}

                onClick={() => setActiveChartTab('overview')}

              >

                Policy & Allocations

              </button>

              <button

                className={`tab-btn ${activeChartTab === 'segments' ? 'active' : ''}`}

                onClick={() => setActiveChartTab('segments')}

              >

                Demographics & Uplift

              </button>

            </div>

          </div>

        </div>

        {activeChartTab === 'overview' ? (

          <div className="charts-grid">

            {/* Chart 1: Donut Allocation */}

            <div className="chart-card">

              <div className="chart-card-header">

                <div>

                  <h3 className="chart-card-title">Promotional Offer Distribution</h3>

                  <p className="chart-card-subtitle">CATE-driven allocation across ₹0, ₹10, and ₹20 tiers</p>

                </div>

              </div>

              {discountDonutChart && (

                <PlotlyChart

                  data={discountDonutChart.data}

                  layout={discountDonutChart.layout}

                />

              )}

            </div>

            {/* Chart 2: Policy Comparison */}

            <div className="chart-card">

              <div className="chart-card-header">

                <div>

                  <h3 className="chart-card-title">Benchmark Comparisons</h3>

                  <p className="chart-card-subtitle">Optimal policy vs Random, High-Cart, and Flat heuristics</p>

                </div>

                <div className="toggle-group" style={{ fontSize: '0.75rem' }}>

                  <button

                    className={`toggle-btn ${policyMetric === 'profit' ? 'active' : ''}`}

                    onClick={() => setPolicyMetric('profit')}

                  >

                    Profit (₹)

                  </button>

                  <button

                    className={`toggle-btn ${policyMetric === 'orders' ? 'active' : ''}`}

                    onClick={() => setPolicyMetric('orders')}

                  >

                    Orders

                  </button>

                  <button

                    className={`toggle-btn ${policyMetric === 'rods' ? 'active' : ''}`}

                    onClick={() => setPolicyMetric('rods')}

                  >

                    RODS

                  </button>

                </div>

              </div>

              {policyComparisonChart && (

                <PlotlyChart

                  data={policyComparisonChart.data}

                  layout={policyComparisonChart.layout}

                />

              )}

            </div>

          </div>

        ) : (

          <div className="charts-grid">

            {/* Chart 3: Income Tier Targeting & Uplift */}

            <div className="chart-card">

              <div className="chart-card-header">

                <div>

                  <h3 className="chart-card-title">Targeting & Price Elasticity by Income</h3>

                  <p className="chart-card-subtitle">Low-income shoppers exhibit higher CATE uplifts (τ̂)</p>

                </div>

              </div>

              {incomeSegmentChart && (

                <PlotlyChart

                  data={incomeSegmentChart.data}

                  layout={incomeSegmentChart.layout}

                />

              )}

            </div>

            {/* Chart 4: Loyalty Member Profit Heterogeneity */}

            <div className="chart-card">

              <div className="chart-card-header">

                <div>

                  <h3 className="chart-card-title">Loyalty Member Heterogeneity</h3>

                  <p className="chart-card-subtitle">Preventing deadweight discount cannibalization on loyal customers</p>

                </div>

              </div>

              {loyaltySegmentChart && (

                <PlotlyChart

                  data={loyaltySegmentChart.data}

                  layout={loyaltySegmentChart.layout}

                />

              )}

            </div>

          </div>

        )}

      </section>

      
        </>
      )}

{activeTab === 'recommendations' && (
        <>
{/* --------------------------------------------------------------------

         6. Customer Recommendations Table

         -------------------------------------------------------------------- */}

      <section className="recommendations-section">

        <div className="table-toolbar">

          <div className="search-box">

            <span className="search-icon">🔍</span>

            <input

              type="text"

              placeholder="Search by Customer ID (e.g., CUST_000042)..."

              value={searchQuery}

              onChange={(e) => {

                setSearchQuery(e.target.value);

                setPagination((prev) => ({ ...prev, page: 1 }));

              }}

              className="search-input"

            />

          </div>

          <div className="filter-controls">

            {/* Discount Filter */}

            <select

              className="select-control"

              value={discountFilter}

              onChange={(e) => {

                setDiscountFilter(e.target.value);

                setPagination((prev) => ({ ...prev, page: 1 }));

              }}

            >

              <option value="">All Offers (₹0, ₹10, ₹20)</option>

              <option value="0">₹0 (Control / No Offer)</option>

              <option value="10">₹10 Discount Offer</option>

              <option value="20">₹20 Discount Offer</option>

            </select>

            {/* Income Tier Filter */}

            <select

              className="select-control"

              value={incomeTierFilter}

              onChange={(e) => {

                setIncomeTierFilter(e.target.value);

                setPagination((prev) => ({ ...prev, page: 1 }));

              }}

            >

              <option value="">All Income Tiers</option>

              <option value="Low">Low (&lt; ₹35k)</option>

              <option value="Medium">Medium (₹35k-₹65k)</option>

              <option value="High">High (&gt; ₹65k)</option>

            </select>

            {/* Loyalty Filter */}

            <select

              className="select-control"

              value={loyaltyFilter}

              onChange={(e) => {

                setLoyaltyFilter(e.target.value);

                setPagination((prev) => ({ ...prev, page: 1 }));

              }}

            >

              <option value="">All Customer Loyalty</option>

              <option value="1">Loyalty Club Members</option>

              <option value="0">Standard Shoppers</option>

            </select>

            {(searchQuery || discountFilter !== '' || incomeTierFilter || loyaltyFilter !== '') && (

              <button

                className="btn btn-secondary"

                style={{ fontSize: '0.8rem', padding: '0.45rem 0.8rem' }}

                onClick={() => {

                  setSearchQuery('');

                  setDiscountFilter('');

                  setIncomeTierFilter('');

                  setLoyaltyFilter('');

                  setPagination((prev) => ({ ...prev, page: 1 }));

                }}

              >

                Clear Filters

              </button>

            )}

          </div>

        </div>

        {/* Recommendations Data Table */}

        {recommendationsError && (

          <div className="error-card" role="alert" style={{ marginBottom: '1rem' }}>

            <strong>Customer recommendations unavailable.</strong>

            <p>{recommendationsError}</p>

            <button className="btn btn-secondary" onClick={fetchRecommendations}>

              Retry Recommendations

            </button>

          </div>

        )}

        <div className="table-container">

          <table className="data-table">

            <thead>

              <tr>

                <th

                  onClick={() => handleSort('customer_id')}

                  className={sortBy === 'customer_id' ? 'sorted' : ''}

                >

                  Customer ID {sortBy === 'customer_id' && <span className="sort-arrow">{sortOrder === 'asc' ? '▲' : '▼'}</span>}

                </th>

                <th

                  onClick={() => handleSort('cart_baseline_value_inr')}

                  className={sortBy === 'cart_baseline_value_inr' ? 'sorted' : ''}

                >

                  Baseline Cart (₹) {sortBy === 'cart_baseline_value_inr' && <span className="sort-arrow">{sortOrder === 'asc' ? '▲' : '▼'}</span>}

                </th>

                <th

                  onClick={() => handleSort('monthly_income_inr')}

                  className={sortBy === 'monthly_income_inr' ? 'sorted' : ''}

                >

                  Monthly Income (₹) {sortBy === 'monthly_income_inr' && <span className="sort-arrow">{sortOrder === 'asc' ? '▲' : '▼'}</span>}

                </th>

                <th>Demographic Tier</th>

                <th>Loyalty Status</th>

                <th

                  onClick={() => handleSort('baseline_conversion_prob_hat')}

                  className={sortBy === 'baseline_conversion_prob_hat' ? 'sorted' : ''}

                  title="Estimated baseline conversion probability under control T=0"

                >

                  Baseline Prob (p̂₀) {sortBy === 'baseline_conversion_prob_hat' && <span className="sort-arrow">{sortOrder === 'asc' ? '▲' : '▼'}</span>}

                </th>

                <th

                  onClick={() => handleSort('recommended_discount_inr')}

                  className={sortBy === 'recommended_discount_inr' ? 'sorted' : ''}

                >

                  Recommended Offer {sortBy === 'recommended_discount_inr' && <span className="sort-arrow">{sortOrder === 'asc' ? '▲' : '▼'}</span>}

                </th>

                <th

                  onClick={() => handleSort('expected_incremental_purchase_uplift')}

                  className={sortBy === 'expected_incremental_purchase_uplift' ? 'sorted' : ''}

                  title="Estimated causal conversion uplift tau_hat(d)"

                >

                  CATE Uplift (τ̂) {sortBy === 'expected_incremental_purchase_uplift' && <span className="sort-arrow">{sortOrder === 'asc' ? '▲' : '▼'}</span>}

                </th>

                <th

                  onClick={() => handleSort('expected_incremental_profit_inr')}

                  className={sortBy === 'expected_incremental_profit_inr' ? 'sorted' : ''}

                  title="Expected incremental profit Delta Pi after discount cost and deadweight cannibalization"

                >

                  Inc. Profit (ΔΠ) {sortBy === 'expected_incremental_profit_inr' && <span className="sort-arrow">{sortOrder === 'asc' ? '▲' : '▼'}</span>}

                </th>

              </tr>

            </thead>

            <tbody>

              {recommendations.length > 0 ? (

                recommendations.map((cust) => (

                  <tr key={cust.customer_id}>

                    <td className="mono-cell" style={{ fontWeight: 600 }}>{cust.customer_id}</td>

                    <td className="mono-cell">₹{cust.cart_baseline_value_inr.toFixed(2)}</td>

                    <td className="mono-cell">₹{cust.monthly_income_inr.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</td>

                    <td>{cust.income_tier}</td>

                    <td>{cust.loyalty_label}</td>

                    <td className="mono-cell">{(cust.baseline_conversion_prob_hat * 100).toFixed(1)}%</td>

                    <td>

                      <span className={`offer-badge disc-${cust.recommended_discount_inr}`}>

                        {cust.recommended_discount_inr === 0 ? '₹0 Control' : `₹${cust.recommended_discount_inr} Discount`}

                      </span>

                    </td>

                    <td className="mono-cell" style={{ color: cust.expected_incremental_purchase_uplift > 0 ? 'var(--color-cyan)' : 'var(--text-dim)' }}>

                      {cust.expected_incremental_purchase_uplift > 0 ? `+${(cust.expected_incremental_purchase_uplift * 100).toFixed(2)}%` : '0.00%'}

                    </td>

                    <td className="mono-cell" style={{ fontWeight: 600, color: cust.expected_incremental_profit_inr > 0 ? 'var(--color-emerald)' : 'var(--text-dim)' }}>

                      ₹{cust.expected_incremental_profit_inr.toFixed(2)}

                    </td>

                  </tr>

                ))

              ) : (

                <tr>

                  <td colSpan="9">

                    <div className="empty-state">

                      <div style={{ fontSize: '1.5rem' }}>🔎</div>

                      <div>No customer records matching current search or filters.</div>

                      <button

                        className="btn btn-secondary"

                        onClick={() => {

                          setSearchQuery('');

                          setDiscountFilter('');

                          setIncomeTierFilter('');

                          setLoyaltyFilter('');

                        }}

                      >

                        Reset All Filters

                      </button>

                    </div>

                  </td>

                </tr>

              )}

            </tbody>

          </table>

        </div>

        {/* Pagination Bar */}

        <div className="pagination-footer">

          <div>

            Showing{' '}

            <strong>{pagination.filteredCount > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0}</strong> to{' '}

            <strong>{Math.min(pagination.page * pagination.pageSize, pagination.filteredCount)}</strong> of{' '}

            <strong>{pagination.filteredCount.toLocaleString()}</strong> eligible customers

          </div>

          <div className="page-controls">

            <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Rows per page:</label>

            <select

              className="select-control"

              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}

              value={pagination.pageSize}

              onChange={(e) => {

                setPagination((prev) => ({ ...prev, pageSize: Number(e.target.value), page: 1 }));

              }}

            >

              <option value="10">10</option>

              <option value="25">25</option>

              <option value="50">50</option>

              <option value="100">100</option>

            </select>

            <button

              className="page-btn"

              disabled={pagination.page <= 1}

              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}

            >

              &larr; Prev

            </button>

            <span className="page-info">

              {pagination.page} / {pagination.totalPages}

            </span>

            <button

              className="page-btn"

              disabled={pagination.page >= pagination.totalPages}

              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}

            >

              Next &rarr;

            </button>

          </div>

        </div>

      </section>

      
        </>
      )}

{/* --------------------------------------------------------------------

         7. Methodology & Ethical AI Modal

         -------------------------------------------------------------------- */}

      {showMethodologyModal && (

        <div className="modal-overlay" onClick={() => setShowMethodologyModal(false)}>

          <div className="modal-content" onClick={(e) => e.stopPropagation()}>

            <div className="modal-header">

              <h2>EconoCausal: Causal ML & Optimization Methodology</h2>

              <button className="modal-close" onClick={() => setShowMethodologyModal(false)}>

                &times;

              </button>

            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              <div className="methodology-item">

                <h4>1. Double Machine Learning (LinearDML via EconML)</h4>

                <p>

                  Estimates heterogeneous treatment effects (τ̂ᵢ) for ₹10 vs ₹0 and ₹20 vs ₹0.

                  Neyman-orthogonal residualization with 5-fold cross-fitting eliminates regularizer bias from

                  first-stage LightGBM outcome (E[Y|X]) and multiclass propensity (P(T=k|X)) models.

                </p>

              </div>

              <div className="methodology-item">

                <h4>2. Causal Uplift vs. Observed Conversion Rate</h4>

                <p>

                  Standard marketing platforms allocate discounts to shoppers with high observed conversion rates ($Y$).

                  This wastes budget on shoppers who would have converted at full price anyway (deadweight loss).

                  EconoCausal targets purely based on <strong>incremental causal uplift</strong> ($\tau_i = Y_i(d) - Y_i(0)$).

                </p>

              </div>

              <div className="methodology-item">

                <h4>3. Incremental Profit Objective & Cannibalization Penalty</h4>

                <p>

                  The Multiple-Choice Knapsack problem maximizes:

                  <br />

                  <code>&Delta;&Pi;<sub>i</sub>(d) = &tau;<sub>i</sub>(d) &times; (m &times; Cart<sub>i</sub> - d) - p<sub>0,i</sub> &times; d</code>

                  <br />

                  Where <code>m = {summaryData?.assumptions?.margin_ratio == null ? '—' : formatPercent(summaryData.assumptions.margin_ratio * 100, 0)}</code> is the contribution margin, and <code>-p<sub>0,i</sub> &times; d</code> directly penalizes cannibalization of customers who buy regardless of offer.

                </p>

              </div>

              <div className="methodology-item">

                <h4>4. Strict Anti-Leakage Isolation</h4>

                <p>

                  True counterfactuals and potential outcomes from data generation are strictly confined to

                  <code>01_Dataset_Analysis/ground_truth_eval.csv</code>. They are completely absent from training

                  and optimization, and never accessible via any API endpoint.

                </p>

              </div>

              <div className="methodology-item">

                <h4>5. Nominal Coupon Liability vs. Expected Redeemed Cost</h4>

                <p>

                  <strong>Nominal Coupon Liability</strong>: {formatCurrency(baselinePolicy.nominal_coupon_liability, 0)} face value (sum of coupon values issued).

                  <br />

                  <strong>Expected Redeemed Cost</strong>: {formatCurrency(baselinePolicy.expected_redeemed_cost)} probability-weighted discount expenditure.

                  Reporting both ensures finance liability caps and marketing cash projections remain aligned.

                </p>

              </div>

            </div>

            <div style={{ textAlign: 'right', marginTop: '0.5rem' }}>

              <button className="btn btn-primary" onClick={() => setShowMethodologyModal(false)}>

                Close Methodology Disclosures

              </button>

            </div>

          </div>

        </div>

      )}

    </div>
      </main>
    </div>
  );
}
