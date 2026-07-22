/**
 * Personal Cloud Storage Integration
 *
 * Supports WebDAV and OneDrive for mounting personal cloud storage
 * as media library sources. Pure functions for connection management
 * and file operations — actual network I/O is delegated to Tauri bridge.
 */

// ─── Types ──────────────────────────────────────────────

export type CloudProvider = 'webdav' | 'onedrive';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface CloudConnectionConfig {
  id: string;
  provider: CloudProvider;
  label: string;
  /** WebDAV: server URL, OneDrive: tenant ID */
  endpoint: string;
  /** WebDAV: username, OneDrive: not used */
  username?: string;
  /** Encrypted credential reference (not stored in plain text) */
  credentialRef: string;
  /** Root path on the cloud to mount */
  rootPath: string;
  /** Whether to auto-connect on startup */
  autoConnect: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CloudConnectionState {
  configId: string;
  status: ConnectionStatus;
  lastError?: string;
  connectedAt?: string;
  lastSyncAt?: string;
}

export interface CloudFileEntry {
  /** Full path relative to rootPath */
  path: string;
  name: string;
  isDirectory: boolean;
  size?: number;
  mimeType?: string;
  lastModified?: string;
  /** Whether a local proxy has been generated */
  hasLocalProxy: boolean;
  localProxyPath?: string;
}

export interface CloudDirectoryListing {
  connectionId: string;
  path: string;
  entries: CloudFileEntry[];
  fetchedAt: string;
}

export interface ProxyGenerationRequest {
  connectionId: string;
  remotePath: string;
  /** Target quality: 'low' for preview, 'medium' for editing, 'high' for final */
  quality: 'low' | 'medium' | 'high';
}

export interface ProxyGenerationResult {
  remotePath: string;
  localPath: string;
  quality: 'low' | 'medium' | 'high';
  sizeBytes: number;
  generatedAt: string;
}

export interface ProjectSnapshot {
  id: string;
  projectId: string;
  projectName: string;
  connectionId: string;
  remotePath: string;
  sizeBytes?: number;
  createdAt: string;
  description?: string;
  version: number;
}

export interface SnapshotUploadProgress {
  snapshotId: string;
  progress: number;
  status: 'preparing' | 'uploading' | 'completed' | 'error';
  error?: string;
}

// ─── Connection Management ──────────────────────────────

export function createConnectionConfig(input: {
  provider: CloudProvider;
  label: string;
  endpoint: string;
  username?: string;
  credentialRef: string;
  rootPath?: string;
  autoConnect?: boolean;
}): CloudConnectionConfig {
  const now = new Date().toISOString();
  return {
    id: `cloud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    provider: input.provider,
    label: input.label.trim() || `${input.provider} connection`,
    endpoint: normalizeEndpoint(input.endpoint, input.provider),
    username: input.username?.trim() || undefined,
    credentialRef: input.credentialRef,
    rootPath: normalizeRootPath(input.rootPath),
    autoConnect: input.autoConnect ?? false,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateConnectionConfig(
  config: CloudConnectionConfig,
  patch: Partial<Pick<CloudConnectionConfig, 'label' | 'endpoint' | 'username' | 'rootPath' | 'autoConnect'>>,
): CloudConnectionConfig {
  return {
    ...config,
    ...(patch.label !== undefined ? { label: patch.label.trim() } : {}),
    ...(patch.endpoint !== undefined ? { endpoint: normalizeEndpoint(patch.endpoint, config.provider) } : {}),
    ...(patch.username !== undefined ? { username: patch.username?.trim() || undefined } : {}),
    ...(patch.rootPath !== undefined ? { rootPath: normalizeRootPath(patch.rootPath) } : {}),
    ...(patch.autoConnect !== undefined ? { autoConnect: patch.autoConnect } : {}),
    updatedAt: new Date().toISOString(),
  };
}

export function createConnectionState(configId: string): CloudConnectionState {
  return {
    configId,
    status: 'disconnected',
  };
}

export function setConnectionStatus(
  state: CloudConnectionState,
  status: ConnectionStatus,
  error?: string,
): CloudConnectionState {
  return {
    ...state,
    status,
    ...(status === 'connected' ? { connectedAt: new Date().toISOString(), lastError: undefined } : {}),
    ...(error ? { lastError: error } : {}),
  };
}

// ─── File Listing ──────────────────────────────────────

export function filterMediaFiles(entries: CloudFileEntry[]): CloudFileEntry[] {
  const mediaExtensions = new Set([
    '.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm',
    '.mp3', '.wav', '.aac', '.flac', '.ogg', '.m4a',
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff',
    '.mxf', '.prores', '.dnxhd',
  ]);

  return entries.filter((entry) => {
    if (entry.isDirectory) return false;
    const ext = getExtension(entry.name);
    return mediaExtensions.has(ext);
  });
}

export function sortDirectoryEntries(
  entries: CloudFileEntry[],
  sortBy: 'name' | 'date' | 'size' = 'name',
  order: 'asc' | 'desc' = 'asc',
): CloudFileEntry[] {
  const sorted = [...entries].sort((a, b) => {
    // Directories always first
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;

    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name, 'zh-CN');
      case 'date':
        return (a.lastModified ?? '').localeCompare(b.lastModified ?? '');
      case 'size':
        return (a.size ?? 0) - (b.size ?? 0);
      default:
        return 0;
    }
  });

  return order === 'desc' ? sorted.reverse() : sorted;
}

// ─── Proxy Generation ──────────────────────────────────

export function estimateProxySize(
  originalSizeBytes: number,
  quality: 'low' | 'medium' | 'high',
): number {
  const ratios = { low: 0.05, medium: 0.15, high: 0.4 };
  return Math.round(originalSizeBytes * ratios[quality]);
}

export function getProxyCachePath(
  connectionId: string,
  remotePath: string,
  quality: string,
): string {
  const safePath = remotePath.replace(/[^a-zA-Z0-9/_-]/g, '_');
  return `proxy/${connectionId}/${quality}/${safePath}`;
}

// ─── Snapshot Management ──────────────────────────────

export function createSnapshot(input: {
  projectId: string;
  projectName: string;
  connectionId: string;
  remotePath?: string;
  description?: string;
  previousVersion?: number;
}): ProjectSnapshot {
  const version = (input.previousVersion ?? 0) + 1;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return {
    id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    projectId: input.projectId,
    projectName: input.projectName,
    connectionId: input.connectionId,
    remotePath: input.remotePath ?? `snapshots/${input.projectId}/v${version}_${timestamp}.zip`,
    createdAt: new Date().toISOString(),
    description: input.description,
    version,
  };
}

export function sortSnapshots(snapshots: ProjectSnapshot[], order: 'newest' | 'oldest' = 'newest'): ProjectSnapshot[] {
  return [...snapshots].sort((a, b) =>
    order === 'newest'
      ? b.version - a.version
      : a.version - b.version,
  );
}

export function formatSnapshotPath(projectId: string, version: number): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `snapshots/${projectId}/v${version}_${timestamp}.zip`;
}

// ─── Helpers ──────────────────────────────────────────

function normalizeEndpoint(endpoint: string, provider: CloudProvider): string {
  const trimmed = endpoint.trim();
  if (!trimmed) return '';
  if (provider === 'onedrive' && !trimmed.startsWith('https://')) {
    return `https://graph.microsoft.com/v1.0`;
  }
  return trimmed.replace(/\/+$/, '');
}

function normalizeRootPath(path: string | undefined): string {
  const trimmed = (path ?? '/').trim();
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot).toLowerCase() : '';
}
