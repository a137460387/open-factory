import type {
  Result,
  SDKEventType,
  SDKEvent,
  EventListener,
} from './types.js';

/**
 * Event emitter for SDK events
 */
export class EventEmitter {
  private listeners = new Map<SDKEventType, Set<EventListener>>();

  /**
   * Subscribe to an event
   */
  on(type: SDKEventType, listener: EventListener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
    return () => this.off(type, listener);
  }

  /**
   * Unsubscribe from an event
   */
  off(type: SDKEventType, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  /**
   * Emit an event
   */
  emit(type: SDKEventType, payload: unknown): void {
    const event: SDKEvent = { type, payload, timestamp: Date.now() };
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(): void {
    this.listeners.clear();
  }
}

/**
 * Create a success result
 */
export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

/**
 * Create an error result
 */
export function err<E = Error>(error: E): Result<never, E> {
  return { ok: false, error };
}
