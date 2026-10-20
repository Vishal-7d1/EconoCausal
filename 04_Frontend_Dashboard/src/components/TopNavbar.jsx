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
    { label: 'May 31, 2024 – May 31, 2024', desc: 'Current Production Catalog (24,812 SKUs)' },
    { label: 'Last 7 Days (May 24 – May 31, 2024)', desc: 'Weekly Rolling Demand Matrix' },
    { label: 'Last 30 Days (May 1 – May 31, 2024)', desc: 'Monthly Causal Uplift Baseline' },
    { label: 'Quarter-to-Date (Q2 2024)', desc: 'Quarterly Price Elasticity Cycle' },
    { label: 'Synthetic Benchmark Cohort (N=10,000)', desc: 'EconoCausal ML Research Cohort' },
  ];

  const categoryOptions = [
    { id: 'all', label: 'All Categories (6 Departments)' },
    { id: 'Beverages', label: 'Beverages (3,842 products)' },
    { id: 'Snacks', label: 'Snacks (2,941 products)' },
    { id: 'Personal Care', label: 'Personal Care (4,215 products)' },
    { id: 'Household', label: 'Household (3,621 products)' },
    { id: 'Dairy', label: 'Dairy (2,876 products)' },
    { id: 'Others', label: 'Others (7,317 products)' },
  ];

  return (
    <header className="top-navbar" ref={navRef} aria-label="Workspace top navigation">
      {/* ── Left: Title & Breadcrumb ── */}
      <div className="top-navbar-left">
        <h1 className="top-navbar-title">{activeTabLabel}</h1>
        <nav className="top-navbar-breadcrumbs" aria-label="Breadcrumb">
          <span>EconoCausal</span>
          <span className="top-navbar-sep">/</span>
          <span className="top-navbar-curr">{activeTabLabel}</span>
        </nav>
      </div>

      {/* ── Right: Controls, Filters, Toggles, Profile ── */}
      <div className="top-navbar-right">
        {/* View Mode Switcher (Active on Dashboard) */}
        {activeTab === 'overview' && onViewModeChange && (
          <div className="top-navbar-switcher" role="tablist" aria-label="Dashboard presentation view">
            <button
              type="button"
              className={`top-navbar-tab-btn ${activeViewMode === 'pricing' ? 'active' : ''}`}
              onClick={() => onViewModeChange('pricing')}
              title="Reference Dynamic Pricing Analytics"
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
            aria-label="Select evaluation date range"
            aria-expanded={dateMenuOpen}
          >
            <Calendar size={14} className="top-pill-icon" />
            <span className="top-pill-text">{selectedRange}</span>
            <ChevronDown size={13} className="top-pill-chevron" />
          </button>

          {dateMenuOpen && (
            <div className="top-popover-menu top-date-popover" role="menu">
              <div className="top-popover-header">Active Evaluation Period</div>
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
            aria-label="Filter catalog and analytics"
            aria-expanded={filterMenuOpen}
          >
            <Filter size={14} className="top-pill-icon" />
            <span>Filters</span>
            {activeCategoryFilter !== 'all' && (
              <span className="top-filter-active-dot" title={`Filtered by ${activeCategoryFilter}`} />
            )}
          </button>

          {filterMenuOpen && (
            <div className="top-popover-menu top-filter-popover" role="menu">
              <div className="top-popover-header-row">
                <span className="top-popover-header">Filter by Category</span>
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

        {/* ── DARK / LIGHT MODE TOGGLE BUTTON (Prominent & Always Available) ── */}
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
            aria-label="User profile and settings menu"
          >
            <span className="top-navbar-avatar">AD</span>
            <span className="top-navbar-username">Admin</span>
            <ChevronDown size={13} className="top-pill-chevron" />
          </button>

          {profileMenuOpen && (
            <div className="top-popover-menu top-profile-popover" role="menu">
              <div className="top-profile-badge-row">
                <div className="top-navbar-avatar large">AD</div>
                <div>
                  <div className="top-profile-name">Administrator</div>
                  <div className="top-profile-email">admin@econocausal.ai</div>
                  <span className="top-profile-plan-pill">Enterprise Plan</span>
                </div>
              </div>

              <div className="top-popover-divider" />

              <div className="top-profile-status-block">
                <div className="top-status-indicator">
                  <span className="top-status-live-dot" />
                  <span>Causal Engine: EconML LinearDML</span>
                </div>
                <div className="top-status-indicator">
                  <span className="top-status-live-dot" />
                  <span>Optimizer: HiGHS MILP Solver</span>
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
                <span>Export Audit PDF Report</span>
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
                <span>Product Catalog Explorer</span>
                <ExternalLink size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
