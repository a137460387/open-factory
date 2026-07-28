/**
 * Dev-only performance monitoring hook.
 * Tracks component render counts, FPS, and Zustand store subscription activity.
 * All logic is gated behind __DEV_PERF_MONITOR__ — tree-shaken in production.
 */
import { useEffect, useSyncExternalStore } from 'react';

// Global flag — injected by vite.config.ts define
declare const __DEV_PERF_MONITOR__: boolean;

// ==================== Render Counter ====================

const renderCounts = new Map<string, number>();
const renderListeners = new Set<() => void>();
let renderVersion = 0;
let cachedCountsSnapshot: ReadonlyMap<string, number> = new Map();

function notifyRenderListeners() {
  renderVersion++;
  cachedCountsSnapshot = new Map(renderCounts);
  for (const fn of renderListeners) fn();
}

/**
 * Track render count for a named component.
 * Returns the current count for that component.
 */
export function trackRender(name: string): number {
  if (typeof __DEV_PERF_MONITOR__ === 'undefined' || !__DEV_PERF_MONITOR__) return 0;
  const next = (renderCounts.get(name) ?? 0) + 1;
  renderCounts.set(name, next);
  notifyRenderListeners();
  return next;
}

export function getRenderCounts(): ReadonlyMap<string, number> {
  return renderCounts;
}

export function resetRenderCounts(): void {
  renderCounts.clear();
  notifyRenderListeners();
}

function subscribeRenderCounts(cb: () => void) {
  renderListeners.add(cb);
  return () => { renderListeners.delete(cb); };
}

function getRenderCountsSnapshot(): ReadonlyMap<string, number> {
  return cachedCountsSnapshot;
}

// ==================== FPS Monitor ====================

let fpsHistory: number[] = [];
let lastFrameTime = 0;
let rafId = 0;
let fpsIntervalId: ReturnType<typeof setInterval> | 0 = 0;
const fpsListeners = new Set<() => void>();
let fpsVersion = 0;
let cachedFpsSnapshot: { current: number; avg: number; min: number; history: number[] } = { current: 0, avg: 0, min: 0, history: [] };

function fpsTick(now: number) {
  if (lastFrameTime > 0) {
    const delta = now - lastFrameTime;
    if (delta > 0) {
      fpsHistory.push(1000 / delta);
      if (fpsHistory.length > 120) fpsHistory = fpsHistory.slice(-120);
    }
  }
  lastFrameTime = now;
  rafId = requestAnimationFrame(fpsTick);
}

function notifyFpsListeners() {
  fpsVersion++;
  const history = fpsHistory.slice(-60);
  const current = history[history.length - 1] ?? 0;
  const avg = history.length > 0 ? history.reduce((a, b) => a + b, 0) / history.length : 0;
  const min = history.length > 0 ? Math.min(...history) : 0;
  cachedFpsSnapshot = { current: Math.round(current), avg: Math.round(avg), min: Math.round(min), history };
  for (const fn of fpsListeners) fn();
}

function startFpsMonitor() {
  if (rafId) return;
  lastFrameTime = 0;
  rafId = requestAnimationFrame(fpsTick);
  fpsIntervalId = setInterval(notifyFpsListeners, 500);
}

function stopFpsMonitor() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
  if (fpsIntervalId) {
    clearInterval(fpsIntervalId);
    fpsIntervalId = 0;
  }
  fpsHistory = [];
}

function subscribeFps(cb: () => void) {
  fpsListeners.add(cb);
  return () => { fpsListeners.delete(cb); };
}

function getFpsSnapshot() {
  return cachedFpsSnapshot;
}

// ==================== Store Subscription Monitor ====================

interface SubscriptionEvent {
  store: string;
  field: string;
  timestamp: number;
}

const subscriptionLog: SubscriptionEvent[] = [];
const MAX_SUB_LOG = 200;
const subListeners = new Set<() => void>();
let subVersion = 0;
let cachedSubSnapshot: readonly SubscriptionEvent[] = [];

function notifySubListeners() {
  subVersion++;
  cachedSubSnapshot = subscriptionLog.slice(-50);
  for (const fn of subListeners) fn();
}

/**
 * Log a store subscription trigger. Call this from Zustand middleware or selectors.
 */
export function logStoreSubscription(store: string, field: string): void {
  if (typeof __DEV_PERF_MONITOR__ === 'undefined' || !__DEV_PERF_MONITOR__) return;
  subscriptionLog.push({ store, field, timestamp: performance.now() });
  if (subscriptionLog.length > MAX_SUB_LOG) {
    subscriptionLog.splice(0, subscriptionLog.length - MAX_SUB_LOG);
  }
  notifySubListeners();
}

export function getSubscriptionLog(): readonly SubscriptionEvent[] {
  return subscriptionLog;
}

export function clearSubscriptionLog(): void {
  subscriptionLog.length = 0;
  notifySubListeners();
}

function subscribeSubLog(cb: () => void) {
  subListeners.add(cb);
  return () => { subListeners.delete(cb); };
}

function getSubSnapshot() {
  return cachedSubSnapshot;
}

// ==================== usePerfMonitor Hook ====================

export interface PerfMonitorData {
  renderCounts: ReadonlyMap<string, number>;
  fps: { current: number; avg: number; min: number; history: number[] };
  subscriptions: readonly SubscriptionEvent[];
  resetRenderCounts: () => void;
  clearSubscriptions: () => void;
}

/**
 * Main hook for the dev performance overlay.
 * Returns live data for render counts, FPS, and store subscriptions.
 * All monitoring is no-op when __DEV_PERF_MONITOR__ is false/undefined.
 */
export function usePerfMonitor(): PerfMonitorData {
  const active = typeof __DEV_PERF_MONITOR__ !== 'undefined' && __DEV_PERF_MONITOR__;

  const counts = useSyncExternalStore(
    subscribeRenderCounts,
    getRenderCountsSnapshot,
    getRenderCountsSnapshot,
  );

  const fps = useSyncExternalStore(
    subscribeFps,
    getFpsSnapshot,
    () => ({ current: 0, avg: 0, min: 0, history: [] }),
  );

  const subs = useSyncExternalStore(
    subscribeSubLog,
    getSubSnapshot,
    () => [],
  );

  useEffect(() => {
    if (!active) return;
    startFpsMonitor();
    return () => { stopFpsMonitor(); };
  }, [active]);

  return {
    renderCounts: counts,
    fps,
    subscriptions: subs,
    resetRenderCounts,
    clearSubscriptions: clearSubscriptionLog,
  };
}
