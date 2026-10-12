import React, { useState, useEffect, useMemo, useCallback } from 'react';

import PlotlyChart from './components/PlotlyChart';

import './App.css';



export default function App() {

  // Data States

  const [summaryData, setSummaryData] = useState(null);

  const [chartData, setChartData] = useState(null);

  const [methodologyData, setMethodologyData] = useState(null);

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

    return (

      <div className="state-container">

        <div className="error-card">

          <div style={{ fontSize: '2rem' }}>⚠️</div>

          <h3>Dashboard Connection Error</h3>

          <p>{error}</p>

          <button className="btn btn-primary" onClick={fetchDashboardData}>

            Retry Loading Dashboard

          </button>

        </div>

      </div>

    );

  }



  return (

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

  );

}
