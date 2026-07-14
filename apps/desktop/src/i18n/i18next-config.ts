import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import zhCN from './locales/zh-CN.json';
import enUS from './locales/en-US.json';

const STORAGE_KEY = 'open-factory:language';

/**
 * 从 localStorage 或系统语言检测初始语言
 */
function detectInitialLanguage(): string {
  if (typeof window === 'undefined') return 'zh';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'zh' || stored === 'en') return stored;
  } catch {
    // localStorage 不可用时静默忽略
  }
  const nav = navigator.language || '';
  return nav.startsWith('en') ? 'en' : 'zh';
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      zh: { translation: zhCN },
      en: { translation: enUS },
    },
    lng: detectInitialLanguage(),
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

/**
 * 切换语言并持久化到 localStorage
 */
export function switchLanguage(lng: 'zh' | 'en'): void {
  void i18n.changeLanguage(lng);
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    // localStorage 不可用时静默忽略
  }
}

/**
 * 获取当前语言
 */
export function getCurrentLanguage(): 'zh' | 'en' {
  const lng = i18n.language;
  return lng?.startsWith('en') ? 'en' : 'zh';
}

export default i18n;
