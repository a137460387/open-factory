import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import zhCN from './locales/zh-CN.json';

const STORAGE_KEY = 'open-factory:language';

/** Cache for loaded language packs */
const loadedLanguages: Record<string, Record<string, unknown>> = {
  zh: zhCN,
};

/**
 * Detect initial language from localStorage or system language
 */
function detectInitialLanguage(): string {
  if (typeof window === 'undefined') return 'zh';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'zh' || stored === 'en') return stored;
  } catch {
    // localStorage not available
  }
  const nav = navigator.language || '';
  return nav.startsWith('en') ? 'en' : 'zh';
}

/**
 * Lazily load a language pack and add it to i18next resources
 */
async function loadLanguage(lng: string): Promise<void> {
  if (loadedLanguages[lng]) return;

  const module = await import(`./locales/${lng === 'en' ? 'en-US' : 'zh-CN'}.json`);
  loadedLanguages[lng] = module.default ?? module;
  i18n.addResourceBundle(lng, 'translation', loadedLanguages[lng], true, true);
}

const initialLang = detectInitialLanguage();

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      zh: { translation: zhCN },
    },
    lng: initialLang,
    fallbackLng: 'zh',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: STORAGE_KEY,
      caches: ['localStorage'],
    },
  });

// Pre-load non-default language in background if needed
if (initialLang === 'en') {
  void loadLanguage('en');
}

/**
 * Switch language with lazy loading support
 */
export async function switchLanguage(lng: 'zh' | 'en'): Promise<void> {
  await loadLanguage(lng);
  void i18n.changeLanguage(lng);
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    // localStorage not available
  }
}

/**
 * Get current language
 */
export function getCurrentLanguage(): 'zh' | 'en' {
  const lng = i18n.language;
  return lng?.startsWith('en') ? 'en' : 'zh';
}

export default i18n;
