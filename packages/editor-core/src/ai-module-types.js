/**
 * Shared types for AI module error handling, loading state, and i18n support.
 *
 * All AI algorithm modules in editor-core are pure computation and cannot
 * import the desktop app's t() directly. Instead, wrapper functions accept
 * an optional TranslateFn parameter that the UI layer supplies.
 */
/** Identity translator that returns the key itself (used as default) */
export const identityTranslator = (key) => key;
//# sourceMappingURL=ai-module-types.js.map