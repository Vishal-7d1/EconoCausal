import React, { useEffect, useRef } from 'react';

/**
 * Lightweight, robust Plotly React wrapper utilizing window.Plotly
 * Supports reactive updates, automatic responsiveness, and dark-theme layout defaults.
 */
export default function PlotlyChart({
  data,
  layout = {},
  config = {},
  style = { width: '100%', height: '360px' },
  className = '',
  theme = 'dark',
}) {
  const containerRef = useRef(null);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    const isLight = theme === 'light';
    const mergedLayout = {
      autosize: true,
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: {
        family: 'Inter, system-ui, sans-serif',
        color: isLight ? '#475569' : '#94A3B8',
        size: 12,
      },
      margin: { l: 50, r: 30, t: 40, b: 50 },
      ...layout,
    };

    const mergedConfig = {
      responsive: true,
      displayModeBar: false,
      displaylogo: false,
      ...config,
    };

    const renderChart = () => {
      if (!containerRef.current || !window.Plotly) return;
      window.Plotly.react(containerRef.current, data, mergedLayout, mergedConfig);
    };

    if (window.Plotly) {
      renderChart();
    } else {
      // Poll briefly if Plotly script tag is still executing
      const checkInterval = setInterval(() => {
        if (window.Plotly) {
          clearInterval(checkInterval);
          if (isMountedRef.current) renderChart();
        }
      }, 50);
      return () => clearInterval(checkInterval);
    }

    const handleResize = () => {
      if (containerRef.current && window.Plotly) {
        window.Plotly.Plots.resize(containerRef.current);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [data, layout, config, theme]);

  useEffect(() => {
    const container = containerRef.current;
    return () => {
      isMountedRef.current = false;
      if (container && window.Plotly) {
        window.Plotly.purge(container);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={style}
      className={`plotly-chart-container ${className}`}
    />
  );
}
