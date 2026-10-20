const fs = require('fs');
const path = require('path');

// 1. Update DashboardOverview.jsx
const dashPath = path.resolve('src/components/DashboardOverview.jsx');
let dashContent = fs.readFileSync(dashPath, 'utf8');

// Replace component signature and local state
const oldSig = `export default function DashboardOverview({
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
  const [categoryFilter, setCategoryFilter] = useState('all');`;

const newSig = `export default function DashboardOverview({
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
  };`;

if (dashContent.includes('const [activeViewMode, setActiveViewMode] = useState(\'pricing\');')) {
  // Let's replace the signature block
  dashContent = dashContent.replace(oldSig.replace(/\r\n/g, '\n'), newSig);
  // Also try CRLF if needed
  if (dashContent.includes('const [activeViewMode, setActiveViewMode] = useState(\'pricing\');')) {
    dashContent = dashContent.replace(oldSig.replace(/\n/g, '\r\n'), newSig);
  }
}

// Update pricingRules definition to use ruleOverrides
const oldRulesDef = `  const pricingRules = useMemo(() => {
    return (
      dyn?.pricing_rules ?? [
        {
          name: 'Minimum Margin Rule',
          type: 'Margin',
          description: 'Ensure margin never below minimum',
          status: 'Active',
          products: 24812,
          last_updated: 'May 31, 2024',
        },
        {
          name: 'Competitor Alignment Rule',
          type: 'Competitor',
          description: 'Stay within competitor price range',
          status: 'Active',
          products: 18732,
          last_updated: 'May 31, 2024',
        },
        {
          name: 'Price Band Rule',
          type: 'Range',
          description: 'Keep prices within defined bands',
          status: 'Active',
          products: 24812,
          last_updated: 'May 30, 2024',
        },
        {
          name: 'MAP (Minimum Advertised Price)',
          type: 'Compliance',
          description: 'Enforce minimum advertised price',
          status: 'Active',
          products: 7621,
          last_updated: 'May 30, 2024',
        },
        {
          name: 'Regional Pricing Rule',
          type: 'Region',
          description: 'Adjust prices by region',
          status: 'Active',
          products: 24812,
          last_updated: 'May 29, 2024',
        },
        {
          name: 'Bundle Pricing Rule',
          type: 'Bundle',
          description: 'Manage bundle and package pricing',
          status: 'Active',
          products: 3214,
          last_updated: 'May 28, 2024',
        },
        {
          name: 'Clearance Rule',
          type: 'Lifecycle',
          description: 'Define markdown boundaries',
          status: 'Paused',
          products: 1842,
          last_updated: 'May 28, 2024',
        },
        {
          name: 'New Product Rule',
          type: 'New Product',
          description: 'Set initial pricing for new items',
          status: 'Paused',
          products: 1256,
          last_updated: 'May 28, 2024',
        },
      ]
    );
  }, [dyn]);`;

const newRulesDef = `  const pricingRules = useMemo(() => {
    const base = dyn?.pricing_rules ?? [
      {
        name: 'Minimum Margin Rule',
        type: 'Margin',
        description: 'Ensure margin never below minimum',
        status: 'Active',
        products: 24812,
        last_updated: 'May 31, 2024',
      },
      {
        name: 'Competitor Alignment Rule',
        type: 'Competitor',
        description: 'Stay within competitor price range',
        status: 'Active',
        products: 18732,
        last_updated: 'May 31, 2024',
      },
      {
        name: 'Price Band Rule',
        type: 'Range',
        description: 'Keep prices within defined bands',
        status: 'Active',
        products: 24812,
        last_updated: 'May 30, 2024',
      },
      {
        name: 'MAP (Minimum Advertised Price)',
        type: 'Compliance',
        description: 'Enforce minimum advertised price',
        status: 'Active',
        products: 7621,
        last_updated: 'May 30, 2024',
      },
      {
        name: 'Regional Pricing Rule',
        type: 'Region',
        description: 'Adjust prices by region',
        status: 'Active',
        products: 24812,
        last_updated: 'May 29, 2024',
      },
      {
        name: 'Bundle Pricing Rule',
        type: 'Bundle',
        description: 'Manage bundle and package pricing',
        status: 'Active',
        products: 3214,
        last_updated: 'May 28, 2024',
      },
      {
        name: 'Clearance Rule',
        type: 'Lifecycle',
        description: 'Define markdown boundaries',
        status: 'Paused',
        products: 1842,
        last_updated: 'May 28, 2024',
      },
      {
        name: 'New Product Rule',
        type: 'New Product',
        description: 'Set initial pricing for new items',
        status: 'Paused',
        products: 1256,
        last_updated: 'May 28, 2024',
      },
    ];
    return base.map((r) => ({
      ...r,
      status: ruleOverrides[r.name] ?? r.status,
    }));
  }, [dyn, ruleOverrides]);`;

dashContent = dashContent.replace(oldRulesDef.replace(/\r\n/g, '\n'), newRulesDef);
dashContent = dashContent.replace(oldRulesDef.replace(/\n/g, '\r\n'), newRulesDef);

// Update categories to filter by categoryFilter
const oldCatDef = `  const categories = useMemo(() => {
    return (
      dyn?.categories ?? [
        { name: 'Beverages', products: 3842, avg_margin: 27.4, margin_floor: 15.0 },
        { name: 'Snacks', products: 2941, avg_margin: 29.1, margin_floor: 18.0 },
        { name: 'Personal Care', products: 4215, avg_margin: 28.8, margin_floor: 20.0 },
        { name: 'Household', products: 3621, avg_margin: 25.6, margin_floor: 18.0 },
        { name: 'Dairy', products: 2876, avg_margin: 26.3, margin_floor: 16.0 },
        { name: 'Others', products: 7317, avg_margin: 29.8, margin_floor: 15.0 },
      ]
    );
  }, [dyn]);`;

const newCatDef = `  const categories = useMemo(() => {
    const list = dyn?.categories ?? [
      { name: 'Beverages', products: 3842, avg_margin: 27.4, margin_floor: 15.0 },
      { name: 'Snacks', products: 2941, avg_margin: 29.1, margin_floor: 18.0 },
      { name: 'Personal Care', products: 4215, avg_margin: 28.8, margin_floor: 20.0 },
      { name: 'Household', products: 3621, avg_margin: 25.6, margin_floor: 18.0 },
      { name: 'Dairy', products: 2876, avg_margin: 26.3, margin_floor: 16.0 },
      { name: 'Others', products: 7317, avg_margin: 29.8, margin_floor: 15.0 },
    ];
    if (categoryFilter && categoryFilter !== 'all') {
      return list.filter((c) => c.name.toLowerCase() === categoryFilter.toLowerCase());
    }
    return list;
  }, [dyn, categoryFilter]);`;

dashContent = dashContent.replace(oldCatDef.replace(/\r\n/g, '\n'), newCatDef);
dashContent = dashContent.replace(oldCatDef.replace(/\n/g, '\r\n'), newCatDef);

// Make KPI cards interactive with navigation targets
dashContent = dashContent.replace(
  `{
        id: 'total_products',
        icon: <Tag size={16} strokeWidth={2.2} />,
        label: 'Total Products',`,
  `{
        id: 'total_products',
        icon: <Tag size={16} strokeWidth={2.2} />,
        label: 'Total Products',
        targetTab: 'dataset',`
);

dashContent = dashContent.replace(
  `{
        id: 'avg_margin',
        icon: <Clock size={16} strokeWidth={2.2} />,
        label: 'Average Margin',`,
  `{
        id: 'avg_margin',
        icon: <Clock size={16} strokeWidth={2.2} />,
        label: 'Average Margin',
        targetTab: 'simulator',`
);

dashContent = dashContent.replace(
  `{
        id: 'margin_floor_cov',
        icon: <Shield size={16} strokeWidth={2.2} />,
        label: 'Margin Floor Coverage',`,
  `{
        id: 'margin_floor_cov',
        icon: <Shield size={16} strokeWidth={2.2} />,
        label: 'Margin Floor Coverage',
        targetTab: 'simulator',`
);

dashContent = dashContent.replace(
  `{
        id: 'skus_above_floor',
        icon: <TrendingUp size={16} strokeWidth={2.2} />,
        label: 'Skus Above Margin Floor',`,
  `{
        id: 'skus_above_floor',
        icon: <TrendingUp size={16} strokeWidth={2.2} />,
        label: 'Skus Above Margin Floor',
        targetTab: 'dataset',`
);

dashContent = dashContent.replace(
  `{
        id: 'skus_below_floor',
        icon: <TrendingDown size={16} strokeWidth={2.2} />,
        label: 'Skus Below Margin Floor',`,
  `{
        id: 'skus_below_floor',
        icon: <TrendingDown size={16} strokeWidth={2.2} />,
        label: 'Skus Below Margin Floor',
        targetTab: 'dataset',`
);

dashContent = dashContent.replace(
  `{
        id: 'pricing_zones',
        icon: <Globe size={16} strokeWidth={2.2} />,
        label: 'Pricing Zones',`,
  `{
        id: 'pricing_zones',
        icon: <Globe size={16} strokeWidth={2.2} />,
        label: 'Pricing Zones',
        targetTab: 'simulator',`
);

// In KPI card render, add onClick and cursor
dashContent = dashContent.replace(
  `<div key={card.id} className="ov-kpi-card" tabIndex={0}>`,
  `<div
            key={card.id}
            className="ov-kpi-card"
            tabIndex={0}
            onClick={() => card.targetTab && onNavigate && onNavigate(card.targetTab)}
            title={\`Click to explore \${card.label} in \${card.targetTab === 'dataset' ? 'Product Catalog' : 'Pricing Rules'}\`}
            style={{ cursor: 'pointer' }}
          >`
);

// In StatusBadge, allow clicking to toggle
dashContent = dashContent.replace(
  `function StatusBadge({ status }) {
  const isPaused = String(status).toLowerCase() === 'paused';
  return (
    <span className={\`ov-status-pill \${isPaused ? 'paused' : 'active'}\`}>
      <span className="ov-status-dot-sm" />
      {status}
    </span>
  );
}`,
  `function StatusBadge({ status, onClick }) {
  const isPaused = String(status).toLowerCase() === 'paused';
  return (
    <button
      type="button"
      className={\`ov-status-pill \${isPaused ? 'paused' : 'active'}\`}
      onClick={onClick}
      title="Click to toggle rule status (Active / Paused)"
      style={{ cursor: 'pointer', border: 'none' }}
    >
      <span className="ov-status-dot-sm" />
      {status}
    </button>
  );
}`
);

dashContent = dashContent.replace(
  `<StatusBadge status={rule.status} />`,
  `<StatusBadge status={rule.status} onClick={() => toggleRule(rule.name)} />`
);

// Now remove <header className="ov-top-header"> ... </header>
const headerRegex = /<header className="ov-top-header">[\s\S]*?<\/header>/;
if (headerRegex.test(dashContent)) {
  dashContent = dashContent.replace(headerRegex, '{/* Unified TopNavbar rendered globally in App.jsx */}');
  console.log('Successfully removed redundant ov-top-header from DashboardOverview.jsx');
} else {
  console.warn('Could not find ov-top-header in DashboardOverview.jsx');
}

fs.writeFileSync(dashPath, dashContent, 'utf8');
console.log('Updated DashboardOverview.jsx');
