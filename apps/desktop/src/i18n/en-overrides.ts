import type {LocaleStrings} from './strings.js';

type DeepPartial<T> = T extends (...args: any[]) => any
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

import {core} from './locales/en/core.js';
import {settingsGroup} from './locales/en/settings.js';
import {updater} from './locales/en/updater.js';
import {media} from './locales/en/media.js';
import {ai} from './locales/en/ai.js';
import {editor} from './locales/en/editor.js';
import {preview} from './locales/en/preview.js';
import {timelineGroup} from './locales/en/timeline.js';
import {collaboration} from './locales/en/collaboration.js';
import {inspector} from './locales/en/inspector.js';
import {exportGroup} from './locales/en/export.js';
import {exportTools} from './locales/en/export-tools.js';
import {toast} from './locales/en/toast.js';
import {tools} from './locales/en/tools.js';

export const enOverrides: DeepPartial<LocaleStrings> = {
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
};
