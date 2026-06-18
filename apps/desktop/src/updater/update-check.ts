import type { AvailableAppUpdate } from '../lib/tauri-bridge';
import { DEFAULT_RELEASE_NOTES_ENDPOINT, getEffectiveUpdaterEndpoint, type UpdateSettings } from './update-settings';

export interface AppUpdateNotice {
  currentVersion: string;
  version: string;
  date?: string;
  releaseNotes?: string;
  releaseUrl?: string;
  source: 'tauri-updater' | 'endpoint';
  install?: () => Promise<void>;
}

export interface UpdateCheckClient {
  checkNativeUpdate?: () => Promise<AvailableAppUpdate | null>;
  fetchJson?: (url: string) => Promise<unknown>;
  installNativeUpdate?: (update: AvailableAppUpdate) => Promise<void>;
}

export interface ReleaseNotes {
  version?: string;
  body?: string;
  url?: string;
  publishedAt?: string;
}

interface EndpointUpdatePayload {
  version?: string;
  body?: string;
  date?: string;
  url?: string;
}

export async function checkForAvailableUpdate(
  settings: UpdateSettings,
  currentVersion: string,
  client: UpdateCheckClient
): Promise<AppUpdateNotice | undefined> {
  if (!settings.autoCheckEnabled) {
    return undefined;
  }
  try {
    const nativeUpdate = await client.checkNativeUpdate?.();
    if (nativeUpdate) {
      const releaseNotes = await fetchDefaultReleaseNotes(client.fetchJson);
      return {
        currentVersion: nativeUpdate.currentVersion || currentVersion,
        version: nativeUpdate.version,
        date: nativeUpdate.date ?? releaseNotes?.publishedAt,
        releaseNotes: releaseNotes?.body || nativeUpdate.body,
        releaseUrl: releaseNotes?.url,
        source: 'tauri-updater',
        install: client.installNativeUpdate ? () => client.installNativeUpdate!(nativeUpdate) : undefined
      };
    }
  } catch {
    return undefined;
  }

  try {
    const endpointPayload = await client.fetchJson?.(getEffectiveUpdaterEndpoint(settings));
    const endpointUpdate = parseUpdateEndpointPayload(endpointPayload);
    if (!endpointUpdate.version || !shouldPromptForUpdate(currentVersion, endpointUpdate.version)) {
      return undefined;
    }
    const releaseNotes = settings.customEndpoint ? undefined : await fetchDefaultReleaseNotes(client.fetchJson);
    return {
      currentVersion,
      version: endpointUpdate.version,
      date: endpointUpdate.date ?? releaseNotes?.publishedAt,
      releaseNotes: releaseNotes?.body || endpointUpdate.body,
      releaseUrl: releaseNotes?.url || endpointUpdate.url,
      source: 'endpoint'
    };
  } catch {
    return undefined;
  }
}

export function shouldPromptForUpdate(currentVersion: string, remoteVersion: string): boolean {
  return compareSemanticVersions(currentVersion, remoteVersion) < 0;
}

export function compareSemanticVersions(left: string, right: string): number {
  const a = parseSemanticVersion(left);
  const b = parseSemanticVersion(right);
  for (let index = 0; index < 3; index += 1) {
    const diff = a.parts[index] - b.parts[index];
    if (diff !== 0) {
      return diff < 0 ? -1 : 1;
    }
  }
  if (a.prerelease === b.prerelease) {
    return 0;
  }
  if (!a.prerelease) {
    return 1;
  }
  if (!b.prerelease) {
    return -1;
  }
  return a.prerelease.localeCompare(b.prerelease);
}

export function parseUpdateEndpointPayload(payload: unknown): EndpointUpdatePayload {
  if (!payload || typeof payload !== 'object') {
    return {};
  }
  const input = payload as Record<string, unknown>;
  return {
    version: normalizeVersion(input.version ?? input.tag_name ?? input.name),
    body: normalizeText(input.notes ?? input.body ?? input.releaseNotes ?? input.changelog),
    date: normalizeText(input.pub_date ?? input.pubDate ?? input.date ?? input.published_at),
    url: normalizeText(input.html_url ?? input.releaseUrl ?? input.url)
  };
}

export function parseReleaseNotesPayload(payload: unknown): ReleaseNotes {
  if (!payload || typeof payload !== 'object') {
    return {};
  }
  const input = payload as Record<string, unknown>;
  return {
    version: normalizeVersion(input.tag_name ?? input.version ?? input.name),
    body: normalizeText(input.body ?? input.notes ?? input.releaseNotes),
    url: normalizeText(input.html_url ?? input.url),
    publishedAt: normalizeText(input.published_at ?? input.pub_date ?? input.date)
  };
}

async function fetchDefaultReleaseNotes(fetchJson: UpdateCheckClient['fetchJson']): Promise<ReleaseNotes | undefined> {
  if (!fetchJson) {
    return undefined;
  }
  try {
    const payload = await fetchJson(DEFAULT_RELEASE_NOTES_ENDPOINT);
    const releaseNotes = parseReleaseNotesPayload(payload);
    return releaseNotes.body || releaseNotes.url || releaseNotes.publishedAt ? releaseNotes : undefined;
  } catch {
    return undefined;
  }
}

function parseSemanticVersion(value: string): { parts: [number, number, number]; prerelease?: string } {
  const match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?/.exec(value.trim());
  if (!match) {
    return { parts: [0, 0, 0] };
  }
  return {
    parts: [Number(match[1] ?? 0), Number(match[2] ?? 0), Number(match[3] ?? 0)],
    prerelease: match[4]
  };
}

function normalizeVersion(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed.replace(/^v(?=\d)/i, '') : undefined;
}

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}
