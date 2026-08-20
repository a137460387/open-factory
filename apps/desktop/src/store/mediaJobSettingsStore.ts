import { create } from 'zustand';
import {
  backgroundMediaPool,
  defaultBackgroundPoolLimit,
  uiFeedbackPool,
} from '../media/media-concurrency';

export type BackgroundConcurrency = 'auto' | 1 | 2 | 3 | 4;
export type UiFeedbackConcurrency = 1 | 2 | 3;

const BACKGROUND_CONCURRENCY_OPTIONS: BackgroundConcurrency[] = ['auto', 1, 2, 3, 4];
const UI_FEEDBACK_CONCURRENCY_OPTIONS: UiFeedbackConcurrency[] = [1, 2, 3];

export interface MediaJobSettingsState {
  /** 后台批量池并发上限：auto（按 CPU 核数）或显式 1-4 */
  backgroundConcurrency: BackgroundConcurrency;
  /** UI 反馈池并发上限：1-3 */
  uiFeedbackConcurrency: UiFeedbackConcurrency;
  /** 是否暂停后台队列（停止取新任务，运行中任务自然完成） */
  paused: boolean;
  setBackgroundConcurrency(value: BackgroundConcurrency): void;
  setUiFeedbackConcurrency(value: UiFeedbackConcurrency): void;
  setPaused(paused: boolean): void;
  reset(): void;
}

const STORAGE_KEY = 'open-factory:media-job-settings';
const DEFAULT_BACKGROUND_CONCURRENCY: BackgroundConcurrency = 'auto';
const DEFAULT_UI_FEEDBACK_CONCURRENCY: UiFeedbackConcurrency = 3;

/** 解析后台并发上限：auto 按 CPU 核数，否则取用户设定值。 */
export function resolveBackgroundConcurrency(value: BackgroundConcurrency): number {
  return value === 'auto' ? defaultBackgroundPoolLimit() : value;
}

export const useMediaJobSettingsStore = create<MediaJobSettingsState>((set, get) => {
  const saved = readMediaJobSettings();
  applyConcurrency(saved.backgroundConcurrency, saved.uiFeedbackConcurrency);
  return {
    ...saved,
    setBackgroundConcurrency(backgroundConcurrency) {
      const { uiFeedbackConcurrency, paused } = get();
      const next = { backgroundConcurrency, uiFeedbackConcurrency, paused };
      writeMediaJobSettings(next);
      applyConcurrency(backgroundConcurrency, uiFeedbackConcurrency);
      set(next);
    },
    setUiFeedbackConcurrency(uiFeedbackConcurrency) {
      const { backgroundConcurrency, paused } = get();
      const next = { backgroundConcurrency, uiFeedbackConcurrency, paused };
      writeMediaJobSettings(next);
      applyConcurrency(backgroundConcurrency, uiFeedbackConcurrency);
      set(next);
    },
    setPaused(paused) {
      const { backgroundConcurrency, uiFeedbackConcurrency } = get();
      const next = { backgroundConcurrency, uiFeedbackConcurrency, paused };
      writeMediaJobSettings(next);
      set(next);
    },
    reset() {
      const next = {
        backgroundConcurrency: DEFAULT_BACKGROUND_CONCURRENCY,
        uiFeedbackConcurrency: DEFAULT_UI_FEEDBACK_CONCURRENCY,
        paused: false,
      };
      writeMediaJobSettings(next);
      applyConcurrency(next.backgroundConcurrency, next.uiFeedbackConcurrency);
      set(next);
    },
  };
});

type PersistedMediaJobSettings = Pick<
  MediaJobSettingsState,
  'backgroundConcurrency' | 'uiFeedbackConcurrency' | 'paused'
>;

function applyConcurrency(background: BackgroundConcurrency, uiFeedback: UiFeedbackConcurrency): void {
  backgroundMediaPool.setLimit(resolveBackgroundConcurrency(background));
  uiFeedbackPool.setLimit(uiFeedback);
}

function readMediaJobSettings(): PersistedMediaJobSettings {
  if (typeof localStorage === 'undefined') {
    return {
      backgroundConcurrency: DEFAULT_BACKGROUND_CONCURRENCY,
      uiFeedbackConcurrency: DEFAULT_UI_FEEDBACK_CONCURRENCY,
      paused: false,
    };
  }
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<PersistedMediaJobSettings>;
    return {
      backgroundConcurrency: normalizeBackgroundConcurrency(parsed.backgroundConcurrency),
      uiFeedbackConcurrency: normalizeUiFeedbackConcurrency(parsed.uiFeedbackConcurrency),
      paused: typeof parsed.paused === 'boolean' ? parsed.paused : false,
    };
  } catch {
    return {
      backgroundConcurrency: DEFAULT_BACKGROUND_CONCURRENCY,
      uiFeedbackConcurrency: DEFAULT_UI_FEEDBACK_CONCURRENCY,
      paused: false,
    };
  }
}

function writeMediaJobSettings(settings: PersistedMediaJobSettings): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function normalizeBackgroundConcurrency(value: unknown): BackgroundConcurrency {
  return BACKGROUND_CONCURRENCY_OPTIONS.includes(value as BackgroundConcurrency)
    ? (value as BackgroundConcurrency)
    : DEFAULT_BACKGROUND_CONCURRENCY;
}

function normalizeUiFeedbackConcurrency(value: unknown): UiFeedbackConcurrency {
  const numeric = typeof value === 'number' ? value : Number(value);
  return UI_FEEDBACK_CONCURRENCY_OPTIONS.includes(numeric as UiFeedbackConcurrency)
    ? (numeric as UiFeedbackConcurrency)
    : DEFAULT_UI_FEEDBACK_CONCURRENCY;
}
