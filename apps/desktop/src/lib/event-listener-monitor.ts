/**
 * Dev-only global addEventListener monitor.
 *
 * Wraps EventTarget.prototype.addEventListener to track registrations
 * and report leaked listeners (registered but never removed).
 *
 * Usage: import this module early in your dev entry point.
 *   import './lib/event-listener-monitor';
 *
 * In production builds this module is a no-op (tree-shaken away).
 */

interface ListenerRecord {
  target: string;
  type: string;
  listener: string;
  stack: string;
  registeredAt: number;
}

const registry = new WeakMap<EventListenerOrEventListenerObject, ListenerRecord>();
const activeListeners = new Set<ListenerRecord>();

let patched = false;

function getTargetName(target: EventTarget): string {
  if (target === globalThis) return 'window';
  if (typeof Document !== 'undefined' && target instanceof Document) return 'document';
  if (typeof Element !== 'undefined' && target instanceof Element) {
    return target.tagName.toLowerCase() + (target.id ? `#${target.id}` : '');
  }
  return target.constructor?.name ?? 'EventTarget';
}

function getListenerName(listener: EventListenerOrEventListenerObject): string {
  if (typeof listener === 'function') {
    return listener.name || '<anonymous>';
  }
  return listener.handleEvent?.name || '<EventListenerObject>';
}

function getStack(): string {
  const err = new Error();
  const lines = err.stack?.split('\n') ?? [];
  // Skip first 3 lines (Error, this function, addEventListener wrapper)
  return lines.slice(3, 8).map(l => l.trim()).join(' ← ');
}

export function installEventListenerMonitor(): void {
  if (patched) return;
  if (typeof EventTarget === 'undefined') return; // Node / SSR

  patched = true;
  const origAdd = EventTarget.prototype.addEventListener;
  const origRemove = EventTarget.prototype.removeEventListener;

  EventTarget.prototype.addEventListener = function (
    this: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ) {
    if (listener) {
      const record: ListenerRecord = {
        target: getTargetName(this),
        type,
        listener: getListenerName(listener),
        stack: getStack(),
        registeredAt: Date.now(),
      };
      registry.set(listener, record);
      activeListeners.add(record);
    }
    return origAdd.call(this, type, listener, options);
  };

  EventTarget.prototype.removeEventListener = function (
    this: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ) {
    if (listener) {
      const record = registry.get(listener);
      if (record) {
        activeListeners.delete(record);
      }
    }
    return origRemove.call(this, type, listener, options);
  };
}

/**
 * Returns a snapshot of currently active (not yet removed) listeners.
 */
export function getActiveListeners(): ListenerRecord[] {
  return Array.from(activeListeners);
}

/**
 * Prints a table of leaked listeners to the console.
 * Call this in development to diagnose leaks.
 */
export function reportLeakedListeners(): void {
  const leaked = getActiveListeners();
  if (leaked.length === 0) {
    console.info('[EventListenerMonitor] No leaked listeners detected.');
    return;
  }
  console.warn(`[EventListenerMonitor] ${leaked.length} active listener(s) detected:`);
  console.table(
    leaked.map(r => ({
      target: r.target,
      type: r.type,
      listener: r.listener,
      age: `${((Date.now() - r.registeredAt) / 1000).toFixed(1)}s`,
      stack: r.stack,
    })),
  );
}

// Auto-install in development
if (import.meta.env?.DEV ?? process.env.NODE_ENV === 'development') {
  installEventListenerMonitor();
}
