import type {ShortcutScheme} from "./shortcut-types.js";

export {PREMIERE_SCHEME} from './premiere-scheme.js';
export {FINAL_CUT_SCHEME} from './final-cut-scheme.js';
export {DAVINCI_RESOLVE_SCHEME} from './davinci-resolve-scheme.js';

import {PREMIERE_SCHEME} from './premiere-scheme.js';
import {FINAL_CUT_SCHEME} from './final-cut-scheme.js';
import {DAVINCI_RESOLVE_SCHEME} from './davinci-resolve-scheme.js';

/** 所有预设方案 */
export const ALL_SHORTCUT_SCHEMES: ShortcutScheme[] = [
  PREMIERE_SCHEME,
  FINAL_CUT_SCHEME,
  DAVINCI_RESOLVE_SCHEME,
];
