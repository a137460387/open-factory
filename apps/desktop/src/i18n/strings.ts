import {core} from './locales/zh/core.js';
import {settingsGroup} from './locales/zh/settings.js';
import {updater} from './locales/zh/updater.js';
import {media} from './locales/zh/media.js';
import {ai} from './locales/zh/ai.js';
import {editor} from './locales/zh/editor.js';
import {preview} from './locales/zh/preview.js';
import {timelineGroup} from './locales/zh/timeline.js';
import {collaboration} from './locales/zh/collaboration.js';
import {inspector} from './locales/zh/inspector.js';
import {exportGroup} from './locales/zh/export.js';
import {exportTools} from './locales/zh/export-tools.js';
import {toast} from './locales/zh/toast.js';
import {tools} from './locales/zh/tools.js';

const zh = {
  ...core,
  ...settingsGroup,
  ...updater,
  ...media,
  ...ai,
  ...editor,
  ...preview,
  ...timelineGroup,
  ...collaboration,
  ...inspector,
  ...exportGroup,
  ...exportTools,
  ...toast,
  ...tools,
} as const;

type DeepPartial<T> = T extends (...args: any[]) => any
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

type WidenLocale<T> = T extends (...args: infer Args) => infer Return
  ? (...args: Args) => Return
  : T extends string
    ? string
    : T extends number
      ? number
      : T extends boolean
        ? boolean
        : T extends object
          ? { readonly [K in keyof T]: WidenLocale<T[K]> }
          : T;

export type Language = 'zh' | 'en';
export type LocaleStrings = WidenLocale<typeof zh>;


const locales: Partial<Record<Language, LocaleStrings>> = {
  zh,
};

let enLoadPromise: Promise<LocaleStrings> | null = null;

async function ensureEnglishLocale(): Promise<LocaleStrings> {
  if (locales.en) return locales.en;
  if (!enLoadPromise) {
    enLoadPromise = import('./en-overrides.js').then((mod) => {
      const merged = mergeLocale<LocaleStrings>(zh, mod.enOverrides);
      locales.en = merged;
      return merged;
    });
  }
  return enLoadPromise;
}

// Initialize i18next (side-effect import)
import i18nextInstance from './i18next-config';

function getInitialLanguage(): Language {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('open-factory:language');
      if (stored === 'zh' || stored === 'en') return stored;
    } catch {
      /* localStorage unavailable */
    }
  }
  return languageFromNavigator(typeof navigator === 'undefined' ? undefined : navigator.language);
}

let currentLanguage: Language = getInitialLanguage();
const languageListeners = new Set<() => void>();

export function t<T = string>(key: string): T {
  const segments = key.split('.').filter(Boolean);
  const value = resolveLocalePath(currentLanguage, segments) ?? resolveLocalePath('zh', segments);
  return (value ?? key) as T;
}

export function getLanguage(): Language {
  return currentLanguage;
}

export function setLanguage(language: string): Language {
  const next = normalizeLanguage(language);
  if (next === currentLanguage) {
    return currentLanguage;
  }
  if (next === 'en' && !locales.en) {
    void ensureEnglishLocale().then(() => {
      currentLanguage = next;
      persistLanguage(next);
      notifyListeners();
    });
    return currentLanguage;
  }
  currentLanguage = next;
  persistLanguage(next);
  notifyListeners();
  return currentLanguage;
}

export async function setLanguageAsync(language: string): Promise<Language> {
  const next = normalizeLanguage(language);
  if (next === currentLanguage) {
    return currentLanguage;
  }
  if (next === 'en') {
    await ensureEnglishLocale();
  }
  currentLanguage = next;
  persistLanguage(next);
  notifyListeners();
  return currentLanguage;
}

function persistLanguage(lng: Language): void {
  try {
    localStorage.setItem('open-factory:language', lng);
  } catch {
    /* localStorage unavailable */
  }
  try {
    void i18nextInstance.changeLanguage(lng);
  } catch {
    /* i18next not loaded */
  }
}

function notifyListeners(): void {
  for (const listener of languageListeners) {
    listener();
  }
}

export function subscribeLanguage(listener: () => void): () => void {
  languageListeners.add(listener);
  return () => {
    languageListeners.delete(listener);
  };
}

export function normalizeLanguage(language: string | undefined): Language {
  const value = language?.trim().toLowerCase();
  return value === 'en' || value?.startsWith('en-') ? 'en' : 'zh';
}

export function languageFromNavigator(language: string | undefined): Language {
  return normalizeLanguage(language);
}

const localeProxyCache = new Map<string, unknown>();
export const zhCN = createLocaleProxy([]) as LocaleStrings;

export function formatTrackType(type: string): string {
  if (type === 'video') {
    return t('timeline.trackTypes.video');
  }
  if (type === 'audio') {
    return t('timeline.trackTypes.audio');
  }
  if (type === 'text') {
    return t('timeline.trackTypes.text');
  }
  if (type === 'subtitle') {
    return t('timeline.trackTypes.subtitle');
  }
  return type;
}

function mergeLocale<T>(base: T, overrides: DeepPartial<T> | undefined): T {
  if (!overrides || typeof base !== 'object' || base === null || typeof base === 'function') {
    return (overrides ?? base) as T;
  }
  const output: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(overrides as Record<string, unknown>)) {
    const baseValue = (base as Record<string, unknown>)[key];
    output[key] =
      value &&
      typeof value === 'object' &&
      typeof value !== 'function' &&
      baseValue &&
      typeof baseValue === 'object' &&
      typeof baseValue !== 'function'
        ? mergeLocale(baseValue, value as DeepPartial<typeof baseValue>)
        : value;
  }
  return output as T;
}

function resolveLocalePath(language: Language, path: string[]): unknown {
  let value: unknown = locales[language];
  for (const segment of path) {
    if (!value || typeof value !== 'object') {
      return undefined;
    }
    value = (value as Record<string, unknown>)[segment];
  }
  return value;
}

function createLocaleProxy(path: string[]): unknown {
  const cacheKey = path.join('.');
  const cached = localeProxyCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const proxy = new Proxy(
    {},
    {
      get(_target, property) {
        if (typeof property === 'symbol') {
          return undefined;
        }
        const nextPath = [...path, property];
        const value = resolveLocalePath(currentLanguage, nextPath) ?? resolveLocalePath('zh', nextPath);
        return isProxyableLocaleValue(value) ? createLocaleProxy(nextPath) : value;
      },
      ownKeys() {
        const value = resolveLocalePath(currentLanguage, path) ?? resolveLocalePath('zh', path);
        return isProxyableLocaleValue(value) ? Reflect.ownKeys(value) : [];
      },
      getOwnPropertyDescriptor(_target, property) {
        if (typeof property === 'symbol') {
          return undefined;
        }
        const value =
          resolveLocalePath(currentLanguage, [...path, property]) ?? resolveLocalePath('zh', [...path, property]);
        return value === undefined ? undefined : { enumerable: true, configurable: true };
      },
    },
  );
  localeProxyCache.set(cacheKey, proxy);
  return proxy;
}

function isProxyableLocaleValue(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}
