/**
 * Plugin Network API
 *
 * Provides sandboxed HTTP request capabilities for plugins.
 * All requests are filtered through the sandbox's host allowlist.
 */

// ─── Network API Types ────────────────────────────────────────────

export interface NetworkRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: string | FormData | ArrayBuffer;
  timeout?: number;
  signal?: AbortSignal;
}

export interface NetworkResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  ok: boolean;
}

export interface PluginNetworkAPI {
  /** Make an HTTP request (subject to sandbox host restrictions) */
  fetch(url: string, options?: NetworkRequestOptions): Promise<NetworkResponse>;
  /** Check if a host is accessible */
  canAccess(url: string): Promise<boolean>;
}

// ─── Network API Implementation ────────────────────────────────────────────

export class PluginNetworkAPIImpl implements PluginNetworkAPI {
  private readonly hostChecker: (host: string) => void;
  private readonly rateChecker: () => void;

  constructor(
    hostChecker: (host: string) => void,
    rateChecker: () => void,
  ) {
    this.hostChecker = hostChecker;
    this.rateChecker = rateChecker;
  }

  async fetch(url: string, options?: NetworkRequestOptions): Promise<NetworkResponse> {
    const parsed = new URL(url);
    this.hostChecker(parsed.hostname);
    this.rateChecker();

    const timeout = options?.timeout ?? 10_000;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    // Combine external signal with timeout
    if (options?.signal) {
      options.signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const response = await globalThis.fetch(url, {
        method: options?.method ?? 'GET',
        headers: options?.headers,
        body: options?.body as BodyInit | undefined,
        signal: controller.signal,
      });

      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      return {
        status: response.status,
        statusText: response.statusText,
        headers,
        body: await response.text(),
        ok: response.ok,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async canAccess(url: string): Promise<boolean> {
    try {
      const parsed = new URL(url);
      this.hostChecker(parsed.hostname);
      return true;
    } catch {
      return false;
    }
  }
}
