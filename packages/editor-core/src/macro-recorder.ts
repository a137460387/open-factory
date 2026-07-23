/**
 * Macro Recorder - Records user operations on the timeline
 *
 * Captures user actions and converts them into replayable macro operations.
 * Supports pause/resume, debouncing, and operation filtering.
 */

import type {
  MacroOperation,
  MacroOperationType,
  MacroDefinition,
  MacroRecordingState,
  MacroRecorderConfig,
  MacroParameter,
} from './macro-types';

const DEFAULT_CONFIG: MacroRecorderConfig = {
  maxOperations: 1000,
  debounceMs: 50,
  ignoreOperations: [],
  inactivityTimeout: 300000, // 5 minutes
};

/**
 * Macro recorder that captures timeline operations
 */
export class MacroRecorder {
  private state: MacroRecordingState = 'idle';
  private operations: MacroOperation[] = [];
  private config: MacroRecorderConfig;
  private startTime: number = 0;
  private lastOperationTime: number = 0;
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private listeners: Array<(state: MacroRecordingState) => void> = [];
  private operationListeners: Array<(op: MacroOperation) => void> = [];

  constructor(config: Partial<MacroRecorderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ─── State Management ────────────────────────────────────────────────────

  /** Get current recording state */
  getState(): MacroRecordingState {
    return this.state;
  }

  /** Subscribe to state changes */
  onStateChange(listener: (state: MacroRecordingState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /** Subscribe to new operations */
  onOperation(listener: (op: MacroOperation) => void): () => void {
    this.operationListeners.push(listener);
    return () => {
      this.operationListeners = this.operationListeners.filter(l => l !== listener);
    };
  }

  private setState(newState: MacroRecordingState): void {
    this.state = newState;
    this.listeners.forEach(l => l(newState));
  }

  // ─── Recording Control ───────────────────────────────────────────────────

  /** Start recording */
  start(): void {
    if (this.state === 'recording') return;

    this.operations = [];
    this.startTime = Date.now();
    this.lastOperationTime = this.startTime;
    this.setState('recording');
    this.resetInactivityTimer();
  }

  /** Pause recording */
  pause(): void {
    if (this.state !== 'recording') return;
    this.setState('paused');
    this.clearInactivityTimer();
  }

  /** Resume recording */
  resume(): void {
    if (this.state !== 'paused') return;
    this.setState('recording');
    this.resetInactivityTimer();
  }

  /** Stop recording and return the macro */
  stop(): MacroDefinition | null {
    if (this.state === 'idle') return null;

    this.clearInactivityTimer();
    this.clearDebounceTimers();
    this.setState('idle');

    if (this.operations.length === 0) return null;

    return this.buildMacroDefinition();
  }

  /** Cancel recording without saving */
  cancel(): void {
    this.clearInactivityTimer();
    this.clearDebounceTimers();
    this.operations = [];
    this.setState('idle');
  }

  // ─── Operation Recording ─────────────────────────────────────────────────

  /** Record a single operation */
  recordOperation(
    type: MacroOperationType,
    targetId: string,
    params: Record<string, unknown>,
    previousState?: Record<string, unknown>,
  ): void {
    if (this.state !== 'recording') return;
    if (this.config.ignoreOperations?.includes(type)) return;
    if (this.operations.length >= (this.config.maxOperations ?? 1000)) return;

    const now = Date.now();
    const operation: MacroOperation = {
      id: this.generateId(),
      type,
      timestamp: now - this.startTime,
      targetId,
      params,
      previousState,
    };

    // Debounce rapid operations on the same target
    const debounceKey = `${type}:${targetId}`;
    this.debounceOperation(debounceKey, operation);

    this.lastOperationTime = now;
    this.resetInactivityTimer();
  }

  private debounceOperation(key: string, operation: MacroOperation): void {
    const existing = this.debounceTimers.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    // If debounce is 0 or less, add immediately
    if ((this.config.debounceMs ?? 50) <= 0) {
      this.addOperation(operation);
      return;
    }

    this.debounceTimers.set(
      key,
      setTimeout(() => {
        this.debounceTimers.delete(key);
        this.addOperation(operation);
      }, this.config.debounceMs ?? 50),
    );
  }

  private addOperation(operation: MacroOperation): void {
    this.operations.push(operation);
    this.operationListeners.forEach(l => l(operation));
  }

  // ─── Macro Building ──────────────────────────────────────────────────────

  /** Detect parameters that vary across operations */
  private detectParameters(): MacroParameter[] {
    const params: MacroParameter[] = [];
    const seen = new Set<string>();

    for (const op of this.operations) {
      for (const [key, value] of Object.entries(op.params)) {
        const paramKey = `${op.type}.${key}`;
        if (seen.has(paramKey)) continue;
        seen.add(paramKey);

        if (typeof value === 'number') {
          params.push({
            id: paramKey,
            name: `${op.type} - ${key}`,
            type: 'number',
            defaultValue: value,
          });
        } else if (typeof value === 'boolean') {
          params.push({
            id: paramKey,
            name: `${op.type} - ${key}`,
            type: 'boolean',
            defaultValue: value,
          });
        } else if (typeof value === 'string') {
          params.push({
            id: paramKey,
            name: `${op.type} - ${key}`,
            type: 'string',
            defaultValue: value,
          });
        }
      }
    }

    return params;
  }

  private buildMacroDefinition(): MacroDefinition {
    const now = new Date().toISOString();
    return {
      id: this.generateId(),
      name: `Macro ${new Date().toLocaleString()}`,
      description: `Recorded ${this.operations.length} operations`,
      version: '1.0.0',
      createdAt: now,
      updatedAt: now,
      tags: [],
      parameters: this.detectParameters(),
      operations: [...this.operations],
      duration: Date.now() - this.startTime,
      executionCount: 0,
    };
  }

  // ─── Utilities ───────────────────────────────────────────────────────────

  private resetInactivityTimer(): void {
    this.clearInactivityTimer();
    if (this.config.inactivityTimeout) {
      this.inactivityTimer = setTimeout(() => {
        this.pause();
      }, this.config.inactivityTimeout);
    }
  }

  private clearInactivityTimer(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }

  private clearDebounceTimers(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  private generateId(): string {
    return `macro_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  /** Get current operations count */
  getOperationCount(): number {
    return this.operations.length;
  }

  /** Get elapsed recording time in ms */
  getElapsedTime(): number {
    if (this.state === 'idle') return 0;
    return Date.now() - this.startTime;
  }
}

/**
 * Create a macro recorder with default configuration
 */
export function createMacroRecorder(config?: Partial<MacroRecorderConfig>): MacroRecorder {
  return new MacroRecorder(config);
}
