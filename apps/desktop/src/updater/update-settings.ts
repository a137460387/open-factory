export const DEFAULT_UPDATE_ENDPOINT =
  'https://github.com/open-factory/open-factory/releases/latest/download/latest.json';
export const DEFAULT_RELEASE_NOTES_ENDPOINT = 'https://api.github.com/repos/open-factory/open-factory/releases/latest';

export interface UpdateSettings {
  autoCheckEnabled: boolean;
  customEndpoint?: string;
}

export const DEFAULT_UPDATE_SETTINGS: UpdateSettings = {
  autoCheckEnabled: true,
};

export function normalizeUpdateSettings(settings: Partial<UpdateSettings> | undefined): UpdateSettings {
  const normalized: UpdateSettings = {
    autoCheckEnabled: settings?.autoCheckEnabled !== false,
  };
  const endpoint = normalizeUpdaterEndpointUrl(settings?.customEndpoint);
  if (endpoint) {
    normalized.customEndpoint = endpoint;
  }
  return normalized;
}

export function shouldPersistUpdateSettings(settings: UpdateSettings): boolean {
  return settings.autoCheckEnabled !== DEFAULT_UPDATE_SETTINGS.autoCheckEnabled || Boolean(settings.customEndpoint);
}

export function getEffectiveUpdaterEndpoint(settings: UpdateSettings): string {
  return settings.customEndpoint || DEFAULT_UPDATE_ENDPOINT;
}

function normalizeUpdaterEndpointUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 500 || !isValidUpdaterEndpointUrl(trimmed)) {
    return undefined;
  }
  return trimmed;
}

export function isValidUpdaterEndpointUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}
