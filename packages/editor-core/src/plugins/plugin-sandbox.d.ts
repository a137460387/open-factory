/**
 * Plugin sandbox — runs plugins in an isolated iframe context.
 *
 * Provides security isolation, resource limits, and postMessage-based
 * communication between host and plugin.
 */
/** Sandbox configuration. */
export interface SandboxConfig {
    /** Plugin ID. */
    pluginId: string;
    /** Maximum memory in bytes (default 10MB). */
    maxMemoryBytes?: number;
    /** Maximum CPU time per operation in ms (default 100ms). */
    maxCpuTimeMs?: number;
    /** Allowed network origins (empty = no network). */
    allowedOrigins?: string[];
    /** CSP nonce for the sandbox iframe. */
    nonce?: string;
}
/** Message types for sandbox communication. */
export type SandboxMessageType = 'init' | 'ready' | 'call' | 'result' | 'error' | 'event' | 'terminate';
/** Sandbox message envelope. */
export interface SandboxMessage {
    type: SandboxMessageType;
    id: string;
    pluginId: string;
    payload: unknown;
}
/** Sandbox lifecycle status. */
export type SandboxStatus = 'created' | 'initializing' | 'ready' | 'running' | 'error' | 'terminated';
/** Performance metrics for a sandbox. */
export interface SandboxMetrics {
    /** Sandbox initialization time in ms. */
    initTimeMs: number;
    /** Total messages exchanged. */
    messageCount: number;
    /** Average message latency in ms. */
    avgMessageLatencyMs: number;
    /** Peak memory usage in bytes (estimate). */
    peakMemoryBytes: number;
    /** Number of errors. */
    errorCount: number;
}
/** Sandbox event callback. */
export type SandboxEventHandler = (event: {
    type: string;
    data: unknown;
}) => void;
/**
 * Create a sandboxed iframe for running a plugin.
 *
 * In a real browser environment, this creates an actual iframe.
 * In test/Node environments, it creates a mock that simulates isolation.
 */
export declare function createPluginSandbox(config: SandboxConfig): PluginSandbox;
export declare class PluginSandbox {
    readonly pluginId: string;
    private status;
    private iframe;
    private messageHandlers;
    private eventHandlers;
    private metrics;
    private latencySum;
    private readonly config;
    constructor(config: SandboxConfig);
    /** Get current sandbox status. */
    getStatus(): SandboxStatus;
    /** Get performance metrics. */
    getMetrics(): Readonly<SandboxMetrics>;
    /**
     * Initialize the sandbox with plugin code.
     * In browser: creates an iframe with the plugin code.
     * In test env: simulates initialization.
     */
    initialize(pluginCode: string): Promise<boolean>;
    /**
     * Send a message to the sandbox and wait for a response.
     */
    call(method: string, args: unknown[], timeoutMs?: number): Promise<unknown>;
    /** Register an event handler. */
    onEvent(handler: SandboxEventHandler): () => void;
    /** Terminate the sandbox and clean up. */
    terminate(): void;
    private buildSandboxHtml;
    private updateLatency;
}
/** Manages multiple plugin sandboxes. */
export declare class SandboxManager {
    private readonly sandboxes;
    /** Create and initialize a sandbox for a plugin. */
    createSandbox(config: SandboxConfig, pluginCode: string): Promise<PluginSandbox>;
    /** Get a sandbox by plugin ID. */
    getSandbox(pluginId: string): PluginSandbox | undefined;
    /** Terminate and remove a sandbox. */
    terminateSandbox(pluginId: string): void;
    /** Terminate all sandboxes. */
    terminateAll(): void;
    /** Get metrics for all sandboxes. */
    getAllMetrics(): Map<string, SandboxMetrics>;
    /** Get the number of active sandboxes. */
    get size(): number;
}
//# sourceMappingURL=plugin-sandbox.d.ts.map