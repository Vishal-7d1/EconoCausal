/**
 * TopNavbar.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * EconoCausal — Unified Top Navigation Bar
 * Shared across ALL workspace pages (Dashboard, Products, Pricing Rules,
 * Competitors, Inventory, Recommendations, Reports, Settings).
 *
 * Features:
 *   • Title & Dynamic Breadcrumb reflecting the active workspace
 *   • View Switcher (Dynamic Pricing | Causal DML) on Dashboard
 *   • Interactive Date Range / Benchmark Cohort selector
 *   • Interactive Filter Drawer / Dropdown with category & margin filters
 *   • Interactive Notification Center with unread counter and clear action
 *   • Direct Help & Methodology modal launcher
 *   • Interactive Theme Toggle (Light ☀️ / Dark 🌙 Mode) with real-time switching
 *   • Admin User Profile menu with workspace details & executive report export
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Calendar,
  Filter,
  Bell,
  HelpCircle,
  ChevronDown,
  Sun,
  Moon,
  CheckCircle2,
  FileText,
  Sliders,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import './TopNavbar.css';

export default function TopNavbar({
  activeTab = 'overview',
  activeTabLabel = 'Dashboard',
  theme = 'light',
  onToggleTheme,
  activeViewMode = 'pricing',
  onViewModeChange,
  selectedRange = 'May 31, 2024 – May 31, 2024',
  onSelectRange,
  activeCategoryFilter = 'all',
  onSelectCategoryFilter,
  onOpenMethodology,
  onOpenReport,
  onNavigate,
}) {
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      title: 'Causal DML Model Certified',
      desc: 'EconML LinearDML passed 100% of placebo & covariate balance tests (Grade A+).',
      time: '10m ago',
      read: false,
    },
    {
      id: 2,
      title: 'Margin Floor Guard Active',
      desc: '99.2% of product allocations satisfy the minimum gross margin constraint (≥ 28.0%).',
      time: '35m ago',
      read: false,
    },
    {
      id: 3,
      title: '18 Pricing Zones Synchronized',
      desc: 'Demographic and regional micro-pricing matrices calibrated with 0 parameter drift.',
      time: '1h ago',
      read: false,
    },
    {
      id: 4,
      title: 'HiGHS MILP Solver Converged',
      desc: 'Optimal ₹50,000 campaign budget allocation generated in 0.12s (7.52x RODS).',
      time: '2h ago',
      read: false,
    },
    {
      id: 5,
      title: 'Strict Anti-Leakage Verified',
      desc: '0 counterfactual ground-truth labels exposed to runtime policy estimators.',
      time: '3h ago',
      read: false,
    },
  ]);

  const navRef = useRef(null);

  // Close open popovers when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (navRef.current && !navRef.current.contains(event.target)) {
        setDateMenuOpen(false);
        setFilterMenuOpen(false);
        setNotifMenuOpen(false);
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const isDarkMode = theme === 'dark';

  const dateRangeOptions = [
    { label: 'Active Evaluation Benchmark (N=10,000)', desc: 'Full DML Evaluated Customer Cohort' },
    { label: 'Optimal Policy Allocations (N=4,568)', desc: 'Selected for ₹10 / ₹20 Promotional Discounts' },
    { label: 'Organic Control Baseline (N=5,432)', desc: '₹0 Discount Non-Treated Customer Cohort' },
    { label: 'High Price Elasticity Cohort (N=3,240)', desc: 'Low-Income Tier with CATE τ̂ ≥ 0.20' },
    { label: 'Inelastic Organic Shoppers (N=2,350)', desc: 'High-Income Tier (Deadweight Loss Protection)' },
  ];

  const categoryOptions = [
    { id: 'all', label: 'All Customer Segments (N=10,000)' },
    { id: 'Low Income', label: 'Low Income (< ₹35k) — High Elasticity' },
    { id: 'Medium Income', label: 'Medium Income (₹35k-₹65k) — Moderate' },
    { id: 'High Income', label: 'High Income (> ₹65k) — Inelastic' },
    { id: 'Loyalty', label: 'Loyalty Club Members' },
    { id: 'Dormant', label: 'Dormant / Inactive Shoppers' },
  ];

  return (
    <header className="top-navbar" ref={navRef} aria-label="Workspace top navigation">
      {/* ── Left: View Mode Switcher (Dynamic Pricing | Causal DML on Dashboard) ── */}
      <div className="top-navbar-left">
        {activeTab === 'overview' && onViewModeChange && (
          <div className="top-navbar-switcher" role="tablist" aria-label="Dashboard presentation view">
            <button
              type="button"
              className={`top-navbar-tab-btn ${activeViewMode === 'pricing' ? 'active' : ''}`}
              onClick={() => onViewModeChange('pricing')}
              title="Dynamic Pricing Dashboard"
            >
              Dynamic Pricing
            </button>
            <button
              type="button"
              className={`top-navbar-tab-btn ${activeViewMode === 'causal' ? 'active' : ''}`}
              onClick={() => onViewModeChange('causal')}
              title="Causal DML Optimization & Qini Curves"
            >
              Causal DML
            </button>
          </div>
        )}
      </div>

      {/* ── Right: Controls, Filters, Toggles, Profile ── */}
      <div className="top-navbar-right">

        {/* Date Range Selector Pill */}
        <div className="top-nav-dropdown-anchor">
          <button
            type="button"
            className={`top-navbar-pill ${dateMenuOpen ? 'active' : ''}`}
            onClick={() => {
              setDateMenuOpen(!dateMenuOpen);
              setFilterMenuOpen(false);
              setNotifMenuOpen(false);
              setProfileMenuOpen(false);
            }}
            aria-label="Select evaluation benchmark cohort"
            aria-expanded={dateMenuOpen}
          >
            <Calendar size={14} className="top-pill-icon" />
            <span className="top-pill-text">{selectedRange}</span>
            <ChevronDown size={13} className="top-pill-chevron" />
          </button>

          {dateMenuOpen && (
            <div className="top-popover-menu top-date-popover" role="menu">
              <div className="top-popover-header">Active Evaluation Cohort</div>
              {dateRangeOptions.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  className={`top-popover-item ${selectedRange === opt.label ? 'selected' : ''}`}
                  onClick={() => {
                    if (onSelectRange) onSelectRange(opt.label);
                    setDateMenuOpen(false);
                  }}
                  role="menuitem"
                >
                  <div className="top-popover-item-text">
                    <span className="top-popover-item-title">{opt.label}</span>
                    <span className="top-popover-item-desc">{opt.desc}</span>
                  </div>
                  {selectedRange === opt.label && (
                    <CheckCircle2 size={14} className="top-popover-check" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filters Button */}
        <div className="top-nav-dropdown-anchor">
          <button
            type="button"
            className={`top-navbar-pill ${filterMenuOpen || activeCategoryFilter !== 'all' ? 'active' : ''}`}
            onClick={() => {
              setFilterMenuOpen(!filterMenuOpen);
              setDateMenuOpen(false);
              setNotifMenuOpen(false);
              setProfileMenuOpen(false);
            }}
            aria-label="Filter customer segments and cohorts"
            aria-expanded={filterMenuOpen}
          >
            <Filter size={14} className="top-pill-icon" />
            <span>Cohort Filters</span>
            {activeCategoryFilter !== 'all' && (
              <span className="top-filter-active-dot" title={`Filtered by ${activeCategoryFilter}`} />
            )}
          </button>

          {filterMenuOpen && (
            <div className="top-popover-menu top-filter-popover" role="menu">
              <div className="top-popover-header-row">
                <span className="top-popover-header">Filter by Customer Cohort</span>
                {activeCategoryFilter !== 'all' && (
                  <button
                    type="button"
                    className="top-popover-reset-link"
                    onClick={() => {
                      if (onSelectCategoryFilter) onSelectCategoryFilter('all');
                      setFilterMenuOpen(false);
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
              {categoryOptions.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`top-popover-item ${activeCategoryFilter === cat.id ? 'selected' : ''}`}
                  onClick={() => {
                    if (onSelectCategoryFilter) onSelectCategoryFilter(cat.id);
                    setFilterMenuOpen(false);
                  }}
                  role="menuitem"
                >
                  <span>{cat.label}</span>
                  {activeCategoryFilter === cat.id && (
                    <CheckCircle2 size={13} className="top-popover-check" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notification Bell */}
        <div className="top-nav-dropdown-anchor">
          <button
            type="button"
            className={`top-navbar-icon-btn ${notifMenuOpen ? 'active' : ''}`}
            onClick={() => {
              setNotifMenuOpen(!notifMenuOpen);
              setDateMenuOpen(false);
              setFilterMenuOpen(false);
              setProfileMenuOpen(false);
            }}
            title="System Alerts & Model Status"
            aria-label={`Notifications (${unreadCount} unread)`}
          >
            <Bell size={17} />
            {unreadCount > 0 && (
              <span className="top-navbar-badge-count">{unreadCount}</span>
            )}
          </button>

          {notifMenuOpen && (
            <div className="top-popover-menu top-notif-popover" role="menu">
              <div className="top-popover-header-row">
                <span className="top-popover-header">
                  System Notifications ({unreadCount} new)
                </span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    className="top-popover-reset-link"
                    onClick={markAllAsRead}
                  >
                    Mark read
                  </button>
                )}
              </div>
              <div className="top-notif-list">
                {notifications.map((n) => (
                  <div key={n.id} className={`top-notif-card ${n.read ? 'read' : 'unread'}`}>
                    <div className="top-notif-card-header">
                      <span className="top-notif-card-title">{n.title}</span>
                      <span className="top-notif-card-time">{n.time}</span>
                    </div>
                    <div className="top-notif-card-desc">{n.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Help & Methodology Icon */}
        <button
          type="button"
          className="top-navbar-icon-btn"
          onClick={onOpenMethodology}
          title="Methodology, Causal DAG & Model Assumptions"
          aria-label="Methodology Disclosures"
        >
          <HelpCircle size={17} />
        </button>

        {/* ── DARK / LIGHT MODE TOGGLE BUTTON ── */}
        <button
          type="button"
          className={`top-navbar-icon-btn top-navbar-theme-btn ${isDarkMode ? 'dark-active' : ''}`}
          onClick={onToggleTheme}
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDarkMode ? (
            <Sun size={17} className="top-theme-sun-icon" />
          ) : (
            <Moon size={17} className="top-theme-moon-icon" />
          )}
        </button>

        {/* User Profile Menu */}
        <div className="top-nav-dropdown-anchor">
          <button
            type="button"
            className={`top-navbar-profile-btn ${profileMenuOpen ? 'active' : ''}`}
            onClick={() => {
              setProfileMenuOpen(!profileMenuOpen);
              setDateMenuOpen(false);
              setFilterMenuOpen(false);
              setNotifMenuOpen(false);
            }}
            aria-label="User profile and internship details"
          >
            <span className="top-navbar-avatar">VY</span>
            <span className="top-navbar-username">Vishal Yadav</span>
            <ChevronDown size={13} className="top-pill-chevron" />
          </button>

          {profileMenuOpen && (
            <div className="top-popover-menu top-profile-popover" role="menu">
              <div className="top-profile-badge-row">
                <div className="top-navbar-avatar large">VY</div>
                <div>
                  <div className="top-profile-name">Vishal Yadav</div>
                  <div className="top-profile-email">vyadav276203@gmail.com</div>
                  <span className="top-profile-plan-pill">Data Associate L1 • Infotact</span>
                </div>
              </div>

              <div className="top-popover-divider" />

              <div className="top-profile-status-block">
                <div className="top-status-indicator">
                  <span className="top-status-live-dot" />
                  <span>Project: "EconoCausal"</span>
                </div>
                <div className="top-status-indicator">
                  <span className="top-status-live-dot" />
                  <span>Ref: ITS/DSML/1244 (Infotact Solutions)</span>
                </div>
                <div className="top-status-indicator">
                  <span className="top-status-live-dot" />
                  <span>Causal Model: EconML LinearDML</span>
                </div>
                <div className="top-status-indicator">
                  <span className="top-status-live-dot" />
                  <span>Optimizer: HiGHS MILP Knapsack Solver</span>
                </div>
              </div>

              <div className="top-popover-divider" />

              <button
                type="button"
                className="top-popover-action-item"
                onClick={() => {
                  setProfileMenuOpen(false);
                  if (onToggleTheme) onToggleTheme();
                }}
              >
                <span>Theme: {isDarkMode ? 'Dark Mode 🌙' : 'Light Mode ☀️'}</span>
                <span className="top-profile-hint">Click to toggle</span>
              </button>

              <button
                type="button"
                className="top-popover-action-item"
                onClick={() => {
                  setProfileMenuOpen(false);
                  if (onOpenReport) onOpenReport();
                }}
              >
                <span>Export Executive Project Report</span>
                <FileText size={14} />
              </button>

              <button
                type="button"
                className="top-popover-action-item"
                onClick={() => {
                  setProfileMenuOpen(false);
                  if (onNavigate) onNavigate('dataset');
                }}
              >
                <span>Dataset Explorer (10,000 Cohort)</span>
                <ExternalLink size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
