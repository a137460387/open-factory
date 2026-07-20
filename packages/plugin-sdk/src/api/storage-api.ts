/**
 * Plugin Storage API
 *
 * Provides plugins with isolated key-value storage and file access
 * within their sandboxed directory.
 */

// ─── Storage API Types ────────────────────────────────────────────

export interface PluginStorageAPI {
  /** Get a value by key */
  get<T = unknown>(key: string): Promise<T | null>;
  /** Set a value */
  set<T = unknown>(key: string, value: T): Promise<void>;
  /** Delete a value */
  delete(key: string): Promise<void>;
  /** List all keys */
  keys(): Promise<string[]>;
  /** Clear all stored data for this plugin */
  clear(): Promise<void>;
  /** Get storage usage in bytes */
  getUsage(): Promise<{ usedBytes: number; quotaBytes: number }>;
  /** Read a file from plugin's data directory */
  readFile(path: string): Promise<string>;
  /** Write a file to plugin's data directory */
  writeFile(path: string, contents: string): Promise<void>;
  /** Delete a file from plugin's data directory */
  deleteFile(path: string): Promise<void>;
  /** List files in a directory */
  listFiles(dirPath: string): Promise<string[]>;
}

// ─── Storage API Implementation ────────────────────────────────────────────

export class PluginStorageAPIImpl implements PluginStorageAPI {
  private store = new Map<string, unknown>();
  private files = new Map<string, string>();
  private readonly pluginId: string;
  private readonly quotaBytes: number;

  constructor(pluginId: string, quotaBytes = 10 * 1024 * 1024) {
    this.pluginId = pluginId;
    this.quotaBytes = quotaBytes;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const fullKey = this.prefixKey(key);
    return (this.store.get(fullKey) as T) ?? null;
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    const fullKey = this.prefixKey(key);
    this.store.set(fullKey, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(this.prefixKey(key));
  }

  async keys(): Promise<string[]> {
    const prefix = `${this.pluginId}:`;
    return Array.from(this.store.keys())
      .filter((k) => k.startsWith(prefix))
      .map((k) => k.slice(prefix.length));
  }

  async clear(): Promise<void> {
    const prefix = `${this.pluginId}:`;
    for (const key of Array.from(this.store.keys())) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  async getUsage(): Promise<{ usedBytes: number; quotaBytes: number }> {
    let usedBytes = 0;
    const prefix = `${this.pluginId}:`;
    for (const [key, value] of this.store.entries()) {
      if (key.startsWith(prefix)) {
        usedBytes += key.length * 2;
        usedBytes += JSON.stringify(value).length * 2;
      }
    }
    for (const [path, contents] of this.files.entries()) {
      if (path.startsWith(`/${this.pluginId}/`)) {
        usedBytes += path.length * 2;
        usedBytes += contents.length * 2;
      }
    }
    return { usedBytes, quotaBytes: this.quotaBytes };
  }

  async readFile(path: string): Promise<string> {
    const fullPath = this.prefixPath(path);
    const contents = this.files.get(fullPath);
    if (contents === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return contents;
  }

  async writeFile(path: string, contents: string): Promise<void> {
    const usage = await this.getUsage();
    const newSize = path.length * 2 + contents.length * 2;
    if (usage.usedBytes + newSize > usage.quotaBytes) {
      throw new Error('Storage quota exceeded');
    }
    this.files.set(this.prefixPath(path), contents);
  }

  async deleteFile(path: string): Promise<void> {
    this.files.delete(this.prefixPath(path));
  }

  async listFiles(dirPath: string): Promise<string[]> {
    const prefix = this.prefixPath(dirPath);
    return Array.from(this.files.keys())
      .filter((p) => p.startsWith(prefix))
      .map((p) => p.slice(prefix.length));
  }

  private prefixKey(key: string): string {
    return `${this.pluginId}:${key}`;
  }

  private prefixPath(path: string): string {
    return `/${this.pluginId}/${path}`.replace(/\/+/g, '/');
  }
}
