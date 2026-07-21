// Plugin Marketplace Types
// Comprehensive type definitions for plugin manifests, reviews, search, and versioning.

// ─── Permission System ───────────────────────────────────────────────

/** Granular permission categories for plugin sandboxing. */
export type PermissionCategory = 'filesystem' | 'network' | 'process' | 'ui';

/** Specific permission actions within each category. */
export interface PermissionGrant {
  readonly category: PermissionCategory;
  /** Target resource pattern (e.g., '/tmp/*', 'https://api.example.com/*'). */
  readonly target: string;
  /** Allowed operations ('read', 'write', 'execute', 'connect', 'all'). */
  readonly operations: readonly string[];
}

/** Declared permissions in plugin manifest. */
export interface PermissionDeclaration {
  readonly required: readonly PermissionGrant[];
  readonly optional: readonly PermissionGrant[];
}

// ─── CLI Command Extension ──────────────────────────────────────────

/** CLI command that a plugin can register. */
export interface CliCommandDefinition {
  readonly name: string;
  readonly description: string;
  readonly usage: string;
  readonly options: readonly CliOptionDefinition[];
  /** Handler entry point within the plugin (exported function name). */
  readonly handler: string;
}

export interface CliOptionDefinition {
  readonly flag: string;
  readonly description: string;
  readonly type: 'string' | 'boolean' | 'number';
  readonly required: boolean;
  readonly default?: string | boolean | number;
}

// ─── Workflow Node Extension ─────────────────────────────────────────

/** Workflow node type that a plugin can define. */
export interface WorkflowNodeDefinition {
  readonly type: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly inputs: readonly WorkflowPortDefinition[];
  readonly outputs: readonly WorkflowPortDefinition[];
  /** Handler entry point within the plugin (exported function name). */
  readonly handler: string;
}

export interface WorkflowPortDefinition {
  readonly name: string;
  readonly type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'media';
  readonly required: boolean;
  readonly description?: string;
}

// ─── Plugin Manifest ─────────────────────────────────────────────────

/** Full plugin manifest as declared in plugin.json or package.json. */
export interface PluginManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly author: string;
  readonly license: string;
  readonly homepage?: string;
  readonly repository?: string;
  readonly keywords: readonly string[];
  readonly category: PluginCategory;
  readonly minHostVersion: string;
  readonly maxHostVersion?: string;
  readonly main: string;
  readonly permissions: PermissionDeclaration;
  readonly cliCommands?: readonly CliCommandDefinition[];
  readonly workflowNodes?: readonly WorkflowNodeDefinition[];
  readonly icon?: string;
  readonly screenshots?: readonly string[];
  readonly dependencies?: Readonly<Record<string, string>>;
}

export type PluginCategory =
  | 'effect'
  | 'transition'
  | 'generator'
  | 'analyzer'
  | 'exporter'
  | 'importer'
  | 'tool'
  | 'workflow'
  | 'theme'
  | 'other';

// ─── Plugin Review & Rating ─────────────────────────────────────────

export interface PluginReview {
  readonly id: string;
  readonly pluginId: string;
  readonly userId: string;
  readonly userName: string;
  readonly rating: 1 | 2 | 3 | 4 | 5;
  readonly title: string;
  readonly content: string;
  readonly version: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly helpful: number;
  readonly reported: boolean;
}

export interface PluginRatingSummary {
  readonly pluginId: string;
  readonly averageRating: number;
  readonly totalReviews: number;
  readonly distribution: Readonly<Record<1 | 2 | 3 | 4 | 5, number>>;
}

// ─── Plugin Statistics ───────────────────────────────────────────────

export interface PluginStats {
  readonly pluginId: string;
  readonly downloads: number;
  readonly weeklyDownloads: number;
  readonly monthlyDownloads: number;
  readonly activeInstalls: number;
  readonly lastDownloadAt: string;
}

// ─── Search & Filter ─────────────────────────────────────────────────

export interface PluginSearchQuery {
  readonly keyword?: string;
  readonly category?: PluginCategory;
  readonly tags?: readonly string[];
  readonly minRating?: number;
  readonly sortBy?: PluginSortField;
  readonly sortOrder?: 'asc' | 'desc';
  readonly page: number;
  readonly limit: number;
}

export type PluginSortField = 'relevance' | 'downloads' | 'rating' | 'updated' | 'created' | 'name';

export interface PluginSearchResult {
  readonly plugin: PluginRegistryEntry;
  readonly score: number;
  readonly matchedFields: readonly string[];
}

export interface PluginSearchResponse {
  readonly results: readonly PluginSearchResult[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly hasMore: boolean;
}

// ─── Registry Entry ─────────────────────────────────────────────────

/** A plugin as stored in the registry (combines manifest with metadata). */
export interface PluginRegistryEntry {
  readonly manifest: PluginManifest;
  readonly stats: PluginStats;
  readonly rating: PluginRatingSummary;
  readonly publishedAt: string;
  readonly updatedAt: string;
  readonly verified: boolean;
  readonly deprecated: boolean;
  readonly deprecationMessage?: string;
}

// ─── Version Management ─────────────────────────────────────────────

export interface PluginVersionInfo {
  readonly pluginId: string;
  readonly version: string;
  readonly changelog: string;
  readonly publishedAt: string;
  readonly checksum: string;
  readonly dependencies: Readonly<Record<string, string>>;
  readonly minHostVersion: string;
  readonly maxHostVersion?: string;
}

export interface PluginUpdateInfo {
  readonly pluginId: string;
  readonly currentVersion: string;
  readonly latestVersion: string;
  readonly updateAvailable: boolean;
  readonly breaking: boolean;
  readonly changelog: string;
}

export type SemVerPart = 'major' | 'minor' | 'patch';

export interface ParsedSemVer {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease?: string;
  readonly build?: string;
}

// ─── Sandbox ─────────────────────────────────────────────────────────

export interface SandboxConfig {
  /** Maximum execution time in milliseconds. */
  readonly timeout: number;
  /** Maximum memory usage in bytes. */
  readonly memoryLimit: number;
  /** Allowed filesystem paths (glob patterns). */
  readonly allowedPaths: readonly string[];
  /** Allowed network hosts. */
  readonly allowedHosts: readonly string[];
  /** Whether to allow process spawning. */
  readonly allowProcess: boolean;
  /** Whether to allow UI modifications. */
  readonly allowUI: boolean;
}

export interface SandboxExecutionResult {
  readonly success: boolean;
  readonly output: unknown;
  readonly error?: string;
  readonly executionTime: number;
  readonly memoryUsed: number;
  readonly violations: readonly SandboxViolation[];
}

export interface SandboxViolation {
  readonly type: 'filesystem' | 'network' | 'process' | 'ui' | 'timeout' | 'memory';
  readonly message: string;
  readonly timestamp: string;
}

// ─── Events ─────────────────────────────────────────────────────────

export type PluginMarketEvent =
  | { type: 'plugin:installed'; pluginId: string; version: string }
  | { type: 'plugin:uninstalled'; pluginId: string }
  | { type: 'plugin:updated'; pluginId: string; fromVersion: string; toVersion: string }
  | { type: 'plugin:enabled'; pluginId: string }
  | { type: 'plugin:disabled'; pluginId: string }
  | { type: 'review:submitted'; pluginId: string; reviewId: string }
  | { type: 'search:performed'; query: string; resultCount: number };
