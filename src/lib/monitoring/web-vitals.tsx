'use client';

import { useEffect, useRef } from 'react';

type MetricName = 'FCP' | 'LCP' | 'CLS' | 'INP' | 'TTFB';

interface WebVitalMetric {
  name: MetricName;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
}

const THRESHOLDS: Record<MetricName, { good: number; poor: number }> = {
  FCP: { good: 1800, poor: 3000 },
  LCP: { good: 2500, poor: 4000 },
  CLS: { good: 0.1, poor: 0.25 },
  INP: { good: 200, poor: 500 },
  TTFB: { good: 800, poor: 1800 },
};

function getRating(name: MetricName, value: number): 'good' | 'needs-improvement' | 'poor' {
  const t = THRESHOLDS[name];
  if (value <= t.good) return 'good';
  if (value <= t.poor) return 'needs-improvement';
  return 'poor';
}

function sendMetric(metric: WebVitalMetric) {
  try {
    // Send to console as structured log (machine-readable)
    console.log(
      JSON.stringify({
        type: 'web-vital',
        name: metric.name,
        value: Math.round(metric.value * 100) / 100,
        rating: metric.rating,
        delta: Math.round(metric.delta * 100) / 100,
        id: metric.id,
        navigationType: metric.navigationType,
        timestamp: Date.now(),
      })
    );

    // Send to existing metrics system
    import('@/lib/monitoring/metrics').then(({ timing, increment }) => {
      timing(`web_vital.${metric.name.toLowerCase()}`, metric.value, {
        rating: metric.rating,
        navigationType: metric.navigationType,
      });
      increment('web_vital_measurement', {
        name: metric.name,
        rating: metric.rating,
      });
    }).catch(() => {
      // Non-critical
    });

    // Send to Sentry as custom measurement
    if (typeof window !== 'undefined' && window.__SENTRY__) {
      try {
        const Sentry = window.__SENTRY__;
        if (Sentry.setMeasurement) {
          Sentry.setMeasurement(metric.name, metric.value, metric.name === 'CLS' ? '' : 'millisecond');
        }
      } catch {
        // Non-critical
      }
    }
  } catch {
    // Metrics must never break the app
  }
}

function observe(metricName: MetricName, callback: (metric: WebVitalMetric) => void) {
  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name !== metricName) continue;

        // CLS is cumulative — use the latest entry value
        if (metricName === 'CLS') {
          const clsEntry = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
          if (clsEntry.hadRecentInput) continue;

          callback({
            name: metricName,
            value: clsEntry.value,
            rating: getRating(metricName, clsEntry.value),
            delta: clsEntry.value,
            id: `${metricName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            navigationType: (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming)?.type ?? 'unknown',
          });
          continue;
        }

        // For other metrics, use the last entry
        const metricEntry = entry as PerformanceEntry & { value: number; startTime: number };
        const value = metricEntry.startTime ?? metricEntry.value ?? 0;

        callback({
          name: metricName,
          value,
          rating: getRating(metricName, value),
          delta: value,
          id: `${metricName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          navigationType: (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming)?.type ?? 'unknown',
        });
      }
    });

    po.observe({ type: metricName === 'CLS' ? 'layout-shift' : 'paint', buffered: true });
    return () => po.disconnect();
  } catch {
    // PerformanceObserver not supported — graceful no-op
    return () => {};
  }
}

function observeLCP(callback: (metric: WebVitalMetric) => void) {
  try {
    const po = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as PerformanceEntry & { startTime: number };
      if (!lastEntry) return;

      const value = lastEntry.startTime;
      callback({
        name: 'LCP',
        value,
        rating: getRating('LCP', value),
        delta: value,
        id: `LCP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        navigationType: (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming)?.type ?? 'unknown',
      });
    });

    po.observe({ type: 'largest-contentful-paint', buffered: true });
    return () => po.disconnect();
  } catch {
    return () => {};
  }
}

function observeINP(callback: (metric: WebVitalMetric) => void) {
  try {
    let maxDuration = 0;

    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const inpEntry = entry as PerformanceEntry & { duration: number };
        if (inpEntry.duration > maxDuration) {
          maxDuration = inpEntry.duration;
          callback({
            name: 'INP',
            value: inpEntry.duration,
            rating: getRating('INP', inpEntry.duration),
            delta: inpEntry.duration,
            id: `INP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            navigationType: (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming)?.type ?? 'unknown',
          });
        }
      }
    });

    po.observe({ type: 'event', buffered: true });
    return () => po.disconnect();
  } catch {
    return () => {};
  }
}

function observeTTFB(callback: (metric: WebVitalMetric) => void) {
  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name !== 'ttfb') continue;
        const navEntry = entry as PerformanceEntry & { startTime: number };
        const value = navEntry.startTime;
        callback({
          name: 'TTFB',
          value,
          rating: getRating('TTFB', value),
          delta: value,
          id: `TTFB-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          navigationType: (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming)?.type ?? 'unknown',
        });
      }
    });

    po.observe({ type: 'navigation', buffered: true });
    return () => po.disconnect();
  } catch {
    return () => {};
  }
}

/**
 * Web Vitals reporter component.
 *
 * Tracks FCP, LCP, CLS, INP, TTFB and reports them via structured logs.
 * Includes throttling to avoid duplicate reports.
 */
export function WebVitalsReporter() {
  const reportedRef = useRef(new Set<string>());

  useEffect(() => {
    const cleanupFns: Array<() => void> = [];

    const throttledCallback = (metric: WebVitalMetric) => {
      // Throttle: only report each metric name once per page load
      if (reportedRef.current.has(metric.name)) return;
      reportedRef.current.add(metric.name);

      sendMetric(metric);
    };

    cleanupFns.push(observe('FCP', throttledCallback));
    cleanupFns.push(observeLCP(throttledCallback));
    cleanupFns.push(observe('CLS', throttledCallback));
    cleanupFns.push(observeINP(throttledCallback));
    cleanupFns.push(observeTTFB(throttledCallback));

    // Report page load timing
    if (typeof window !== 'undefined' && window.performance) {
      const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      if (navEntry) {
        sendMetric({
          name: 'TTFB',
          value: navEntry.responseStart,
          rating: getRating('TTFB', navEntry.responseStart),
          delta: navEntry.responseStart,
          id: 'page-load-ttfb',
          navigationType: navEntry.type ?? 'unknown',
        });
      }
    }

    return () => {
      cleanupFns.forEach((fn) => fn());
    };
  }, []);

  return null;
}

// Extend Window for Sentry
declare global {
  interface Window {
    __SENTRY__?: {
      setMeasurement?: (name: string, value: number, unit: string) => void;
    };
  }
}
