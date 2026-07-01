/**
 * Shared types for AI module error handling, loading state, and i18n support.
 *
 * All AI algorithm modules in editor-core are pure computation and cannot
 * import the desktop app's t() directly. Instead, wrapper functions accept
 * an optional TranslateFn parameter that the UI layer supplies.
 */

/** Translation function signature compatible with the desktop i18n t() */
export type TranslateFn = (key: string) => string;

/** Identity translator that returns the key itself (used as default) */
export const identityTranslator: TranslateFn = (key) => key;

/** Standard result wrapper for AI module safe-execution functions */
export interface AiModuleResult<T> {
  data: T;
  error: string | null;
  isProcessing: boolean;
}
