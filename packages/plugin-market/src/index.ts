// Plugin Market - Main Entry Point
// Exports all public APIs for the plugin marketplace.

// Types
export type {
  PermissionCategory,
  PermissionGrant,
  PermissionDeclaration,
  CliCommandDefinition,
  CliOptionDefinition,
  WorkflowNodeDefinition,
  WorkflowPortDefinition,
  PluginManifest,
  PluginCategory,
  PluginReview,
  PluginRatingSummary,
  PluginStats,
  PluginSearchQuery,
  PluginSortField,
  PluginSearchResult,
  PluginSearchResponse,
  PluginRegistryEntry,
  PluginVersionInfo,
  PluginUpdateInfo,
  SemVerPart,
  ParsedSemVer,
  SandboxConfig,
  SandboxExecutionResult,
  SandboxViolation,
  PluginMarketEvent,
} from './types.js';

// Registry
export { PluginRegistry } from './registry.js';

// Sandbox
export { PluginSandbox } from './sandbox.js';

// Permissions
export {
  PermissionManager,
  buildPermissionDeclaration,
  checkPermissions,
} from './permissions.js';
export type {
  PermissionState,
  PermissionAuditEntry,
  PermissionRequest,
} from './permissions.js';

// Search
export { PluginSearchEngine } from './search.js';

// Version Manager
export {
  VersionManager,
  parseSemVer,
  compareSemVer,
  satisfiesRange,
  getBumpType,
  bumpVersion,
} from './version-manager.js';

// CLI Commands
export { CliCommandRegistry, validateCliCommand } from './cli-commands.js';
export type {
  ParsedCliArgs,
  RegisteredCliCommand,
} from './cli-commands.js';

// Workflow Nodes
export { WorkflowNodeRegistry, validateWorkflowNode } from './workflow-nodes.js';
export type {
  RegisteredWorkflowNode,
  WorkflowNodeCatalogEntry,
  ConnectionValidationResult,
} from './workflow-nodes.js';
