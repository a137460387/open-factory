// Barrel re-export — preserves the public API surface for InspectorEditors.tsx
export {roundFinite, clampUnit, clampSigned} from './curveEditorUtils';
export {SpeedCurveEditor, getSpeedCurveFrames, normalizeSpeedCurveFrames, eventToSpeedFrame, drawSpeedCurveCanvas, speedFrameToPoint, findNearestSpeedFrame, type SpeedCurveFrame} from './SpeedCurveEditorModule';
export {getCurveEditorFrames, normalizeCurveEditorFrames, drawKeyframeCurveCanvas, drawKeyframeVelocityCanvas, getInterpolatedCurveEditorValue, findNearestCurveHandle, findNearestCurveFrameIdByPoint, nextHandleMode, getKeyframeFallbackForCurve, eventToCurveEditorFrame, eventToCanvasPoint, curveFrameToPoint, findNearestCurveFrame, getCurveFrameIdsInBox, type CurveEditorDrag, type CanvasPoint, type CurveEditorFrame} from './keyframeCurveHelpers';
export {EasingPresetSelector} from './EasingPresetSelectorModule';
export {KeyframeCurveEditor, formatKeyframeProperty, formatKeyframeValue} from './KeyframeCurveEditorModule';
export {CurveEditor, CURVE_CHANNELS, drawCurveCanvas, eventToCurvePoint, findNearestCurvePoint, drawColorWheel, eventToUnitPoint, wheelPointToOffsets, wheelOffsetsToPoint, hsvToRgb, type CurveChannel} from './colorCurveEditor';
