const fs = require('fs');
const path = require('path');

const appPath = path.resolve('src/App.jsx');
let content = fs.readFileSync(appPath, 'utf8');

// 1. Add TopNavbar import
if (!content.includes("import TopNavbar from './components/TopNavbar';")) {
  content = content.replace(
    "import DashboardOverview from './components/DashboardOverview';",
    "import DashboardOverview from './components/DashboardOverview';\nimport TopNavbar from './components/TopNavbar';"
  );
}

// 2. Add topNav states in App component
if (!content.includes('const [topNavViewMode, setTopNavViewMode] = useState')) {
  content = content.replace(
    "  const [activeTab, setActiveTab] = useState('overview');",
    `  const [activeTab, setActiveTab] = useState('overview');
  const [topNavViewMode, setTopNavViewMode] = useState('pricing');
  const [topNavRange, setTopNavRange] = useState('May 31, 2024 – May 31, 2024');
  const [topNavCategory, setTopNavCategory] = useState('all');`
  );
}

// 3. Replace the legacy header block and mount TopNavbar globally
const oldBlock = `      <main className="ec-main-area">
        <div className="dashboard-container">

          {activeTab !== 'overview' && (
            <>
              <header className="dashboard-header">
                <div className="brand-section">
                  <div className="brand-icon">📈</div>
                  <div className="brand-titles">
                    <h1>
                      EconoCausal
                      <span className="badge-tag primary">
                        {navigationItems.find((item) => item.id === activeTab)?.label ?? 'Workspace'}
                      </span>
                    </h1>
                    <p>Dynamic Pricing &amp; Causal Machine Learning Intelligence</p>
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
                    type="button"
                    className="theme-toggle-btn"
                    onClick={toggleTheme}
                    title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  >
                    <span className="theme-toggle-icon" aria-hidden="true">
                      {theme === 'dark' ? '☀️' : '🌙'}
                    </span>
                    <span className="theme-toggle-label">
                      {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                    </span>
                  </button>

                  <button
                    className="btn btn-primary"
                    onClick={handleOpenReportModal}
                    title="View & Export Executive Causal Audit Report"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
                  >
                    📄 Executive Report
                  </button>

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
            </>
          )}`;

const newBlock = `      <main className="ec-main-area">
        {/* Unified Top Navigation Bar across ALL workspace pages */}
        <TopNavbar
          activeTab={activeTab}
          activeTabLabel={navigationItems.find((item) => item.id === activeTab)?.label ?? 'Dashboard'}
          theme={theme}
          onToggleTheme={toggleTheme}
          activeViewMode={topNavViewMode}
          onViewModeChange={setTopNavViewMode}
          selectedRange={topNavRange}
          onSelectRange={setTopNavRange}
          activeCategoryFilter={topNavCategory}
          onSelectCategoryFilter={setTopNavCategory}
          onOpenMethodology={() => setShowMethodologyModal(true)}
          onOpenReport={handleOpenReportModal}
          onNavigate={(tab) => {
            setActiveTab(tab);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            const mainArea = document.querySelector('.ec-main-area');
            if (mainArea) mainArea.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />

        <div className="dashboard-container">`;

// Handle CRLF vs LF
if (content.includes('className="ec-main-area"')) {
  let normalizedContent = content.replace(/\r\n/g, '\n');
  let normalizedOld = oldBlock.replace(/\r\n/g, '\n');
  if (normalizedContent.includes(normalizedOld)) {
    normalizedContent = normalizedContent.replace(normalizedOld, newBlock.replace(/\r\n/g, '\n'));
    content = normalizedContent;
    console.log('Successfully replaced header with TopNavbar in App.jsx');
  } else {
    console.warn('Could not find exact oldBlock in App.jsx, using fallback pattern match');
    // Fallback: replace using regex
    const regex = /<main className="ec-main-area">[\s\S]*?\{activeTab !== 'overview' && \([\s\S]*?<\/>\s*\)\}/;
    if (regex.test(content)) {
      content = content.replace(regex, newBlock);
      console.log('Successfully replaced via regex fallback');
    } else {
      console.error('Failed to locate header block in App.jsx');
    }
  }
}

// 4. Update DashboardOverview props in App.jsx to pass activeViewMode, categoryFilter, selectedRange
content = content.replace(
  `<DashboardOverview
              summaryData={summaryData}
              chartData={chartData}
              validationData={validationData}
              theme={theme}`,
  `<DashboardOverview
              summaryData={summaryData}
              chartData={chartData}
              validationData={validationData}
              theme={theme}
              activeViewMode={topNavViewMode}
              categoryFilter={topNavCategory}
              selectedRange={topNavRange}`
);

// 5. Update competitor benchmarking cards in App.jsx to use CSS variables for theme support
content = content.replace(
  /background:\s*['"]#FFFFFF['"],\s*border:\s*['"]1px solid #E5E7EB['"]/g,
  "background: 'var(--bg-card, #FFFFFF)', border: '1px solid var(--border, #E5E7EB)'"
);

content = content.replace(
  /color:\s*['"]#171923['"]/g,
  "color: 'var(--text-primary, #171923)'"
);

fs.writeFileSync(appPath, content, 'utf8');
console.log('App.jsx updated successfully!');
