/**
 * 转场效果参数生成模块 — barrel re-export。
 * @module transitions
 */

export {
  TRANSITION_REGISTRY,
  type TransitionDefinition,
  type TransitionCategory,
  getTransitionsByCategory,
  getTransitionDefinition,
  getTransitionDefaultDuration,
  isCustomTransition,
  searchTransitions,
} from './transition-registry';

export {
  buildXfadeParams,
  getXfadeName,
  type XfadeParamsOptions,
  type XfadeFilterResult,
} from './xfade-params';

export {
  buildCustomTransitionFilters,
  type CustomFilterOptions,
  type CustomFilterResult,
} from './custom-filters';

export {
  buildTransitionThumbnailArgs,
  getCanvasPreviewParams,
  type TransitionThumbnailOptions,
  type CanvasPreviewParams,
} from './preview-args';
