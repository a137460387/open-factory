// Version Manager
// Semantic versioning, compatibility checking, and update detection.

import type {
  PluginVersionInfo,
  PluginUpdateInfo,
  ParsedSemVer,
  SemVerPart,
} from './types.js';

/** Parse a semver string into its components. */
export function parseSemVer(version: string): ParsedSemVer {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.]+))?(?:\+([a-zA-Z0-9.]+))?$/);
  if (!match) {
    throw new Error(`Invalid semver: ${version}`);
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4],
    build: match[5],
  };
}

/** Compare two semver strings. Returns -1, 0, or 1. */
export function compareSemVer(a: string, b: string): -1 | 0 | 1 {
  const pa = parseSemVer(a);
  const pb = parseSemVer(b);

  if (pa.major !== pb.major) return pa.major < pb.major ? -1 : 1;
  if (pa.minor !== pb.minor) return pa.minor < pb.minor ? -1 : 1;
  if (pa.patch !== pb.patch) return pa.patch < pb.patch ? -1 : 1;

  // Pre-release versions have lower precedence
  if (pa.prerelease && !pb.prerelease) return -1;
  if (!pa.prerelease && pb.prerelease) return 1;
  if (pa.prerelease && pb.prerelease) {
    return pa.prerelease < pb.prerelease ? -1 : pa.prerelease > pb.prerelease ? 1 : 0;
  }

  return 0;
}

/** Check if version a satisfies a semver range (supports ^, ~, >=, <=, >, <, =). */
export function satisfiesRange(version: string, range: string): boolean {
  const parsed = parseSemVer(version);

  // Exact match
  if (range === version) return true;

  // Caret range: ^1.2.3 => >=1.2.3 <2.0.0
  if (range.startsWith('^')) {
    const base = parseSemVer(range.slice(1));
    if (parsed.major !== base.major) return false;
    if (parsed.major === 0 && base.major === 0) {
      // ^0.x.y => >=0.x.y <0.(x+1).0
      if (parsed.minor !== base.minor) return false;
      return parsed.patch >= base.patch;
    }
    if (parsed.minor !== base.minor) return parsed.minor > base.minor;
    return parsed.patch >= base.patch;
  }

  // Tilde range: ~1.2.3 => >=1.2.3 <1.3.0
  if (range.startsWith('~')) {
    const base = parseSemVer(range.slice(1));
    if (parsed.major !== base.major) return false;
    if (parsed.minor !== base.minor) return false;
    return parsed.patch >= base.patch;
  }

  // Comparison operators
  const cmp = compareSemVer(version, extractVersionFromRange(range));
  if (range.startsWith('>=')) return cmp >= 0;
  if (range.startsWith('<=')) return cmp <= 0;
  if (range.startsWith('>')) return cmp > 0;
  if (range.startsWith('<')) return cmp < 0;
  if (range.startsWith('=')) return cmp === 0;

  // Wildcard: * matches everything
  if (range === '*') return true;

  // Major wildcard: 1.x or 1.*
  const majorWild = range.match(/^(\d+)\.(x|X|\*)$/);
  if (majorWild) return parsed.major === parseInt(majorWild[1], 10);

  // Major.minor wildcard: 1.2.x or 1.2.*
  const minorWild = range.match(/^(\d+)\.(\d+)\.(x|X|\*)$/);
  if (minorWild) {
    return parsed.major === parseInt(minorWild[1], 10) &&
      parsed.minor === parseInt(minorWild[2], 10);
  }

  return false;
}

/** Determine the bump type between two versions. */
export function getBumpType(from: string, to: string): SemVerPart | null {
  const pf = parseSemVer(from);
  const pt = parseSemVer(to);

  if (pt.major > pf.major) return 'major';
  if (pt.minor > pf.minor) return 'minor';
  if (pt.patch > pf.patch) return 'patch';
  return null;
}

/** Bump a version string by the given part. */
export function bumpVersion(version: string, part: SemVerPart): string {
  const p = parseSemVer(version);
  switch (part) {
    case 'major': return `${p.major + 1}.0.0`;
    case 'minor': return `${p.major}.${p.minor + 1}.0`;
    case 'patch': return `${p.major}.${p.minor}.${p.patch + 1}`;
  }
}

/**
 * Version manager for tracking plugin versions and detecting updates.
 */
export class VersionManager {
  private readonly versions = new Map<string, PluginVersionInfo[]>();
  private readonly installed = new Map<string, string>();

  /** Register a new version for a plugin. */
  addVersion(info: PluginVersionInfo): void {
    const list = this.versions.get(info.pluginId) ?? [];
    // Avoid duplicates
    if (list.some((v) => v.version === info.version)) return;
    list.push(info);
    list.sort((a, b) => compareSemVer(b.version, a.version)); // newest first
    this.versions.set(info.pluginId, list);
  }

  /** Record that a specific version is installed. */
  setInstalled(pluginId: string, version: string): void {
    this.installed.set(pluginId, version);
  }

  /** Get the installed version of a plugin. */
  getInstalled(pluginId: string): string | undefined {
    return this.installed.get(pluginId);
  }

  /** Get all known versions of a plugin. */
  getVersions(pluginId: string): readonly PluginVersionInfo[] {
    return this.versions.get(pluginId) ?? [];
  }

  /** Get the latest version of a plugin. */
  getLatest(pluginId: string): PluginVersionInfo | undefined {
    const versions = this.versions.get(pluginId);
    return versions?.[0]; // Already sorted newest-first
  }

  /** Check if an update is available for a plugin. */
  checkForUpdate(pluginId: string): PluginUpdateInfo | undefined {
    const installedVer = this.installed.get(pluginId);
    if (!installedVer) return undefined;

    const latest = this.getLatest(pluginId);
    if (!latest) return undefined;

    const cmp = compareSemVer(installedVer, latest.version);
    if (cmp >= 0) return undefined; // Already up to date

    const bump = getBumpType(installedVer, latest.version);
    const breaking = bump === 'major';

    return {
      pluginId,
      currentVersion: installedVer,
      latestVersion: latest.version,
      updateAvailable: true,
      breaking,
      changelog: latest.changelog,
    };
  }

  /** Check for updates for all installed plugins. */
  checkAllUpdates(): readonly PluginUpdateInfo[] {
    const updates: PluginUpdateInfo[] = [];
    for (const [pluginId] of this.installed) {
      const update = this.checkForUpdate(pluginId);
      if (update) updates.push(update);
    }
    return updates;
  }

  /** Check if a plugin version is compatible with the host version. */
  isCompatible(pluginId: string, pluginVersion: string, hostVersion: string): boolean {
    const versions = this.versions.get(pluginId);
    if (!versions) return false;

    const info = versions.find((v) => v.version === pluginVersion);
    if (!info) return false;

    if (!satisfiesRange(hostVersion, `>=${info.minHostVersion}`)) return false;
    if (info.maxHostVersion && !satisfiesRange(hostVersion, `<=${info.maxHostVersion}`)) return false;

    return true;
  }

  /** Get the latest compatible version of a plugin for a given host version. */
  getLatestCompatible(pluginId: string, hostVersion: string): PluginVersionInfo | undefined {
    const versions = this.versions.get(pluginId);
    if (!versions) return undefined;

    return versions.find((v) => this.isCompatible(pluginId, v.version, hostVersion));
  }

  /** Remove all version data for a plugin. */
  removePlugin(pluginId: string): void {
    this.versions.delete(pluginId);
    this.installed.delete(pluginId);
  }

  /** Clear all data. */
  clear(): void {
    this.versions.clear();
    this.installed.clear();
  }
}

function extractVersionFromRange(range: string): string {
  const cleaned = range.replace(/^[><=!]+\s*/, '');
  return cleaned;
}
