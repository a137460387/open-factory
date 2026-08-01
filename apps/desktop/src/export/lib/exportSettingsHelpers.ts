// Barrel re-export – all public API preserved.
// Split into: constants, draft-normalizers, format-updates, audio-vis-updates,
//             settings-updates, watermark-helpers, project-helpers.

export {
  WATERMARK_POSITIONS,
  AUDIO_VISUALIZATION_FORMATS,
  VIDEO_EXPORT_FORMATS,
  AUDIO_VISUALIZATION_STYLES,
  AUDIO_VISUALIZATION_BACKGROUND_TYPES,
  SUBTITLE_FORMATS,
  DEFAULT_AUDIO_VISUALIZATION,
  DEFAULT_TIMECODE_BURN_IN,
  MANUAL_AUDIO_VISUALIZATION_THEME_ID,
  type SubtitleLanguageOption,
} from './constants';

export {
  buildExportPreviewOutputPaths,
  normalizeDraftSettings,
  supportsLoudnessNormalization,
  timecodeBurnInFrom,
  normalizeWatermarkPosition,
  isWatermarkPosition,
} from './draft-normalizers';

export {
  enableWatermark,
  imageWatermarkFrom,
  textWatermarkFrom,
} from './watermark-helpers';

export {
  updateNumberSetting,
  updateStringSetting,
  updateOutputMode,
  updateFormat,
} from './format-updates';

export {
  updateAudioVisualizationStyle,
  updateAudioVisualizationTheme,
  updateAudioVisualizationColor,
  updateAudioVisualizationBackgroundType,
  updateAudioVisualizationBackgroundColor,
  updateAudioVisualizationBackgroundImagePath,
  updateSubtitleMode,
  updateSubtitleFormat,
  updateExportSidecarSubtitle,
  updateSubtitleLanguageSelection,
  updateSubtitleBurnInLanguage,
} from './audio-vis-updates';

export {
  updateScaleMode,
  updateTargetAspectRatio,
  updateReframeOffset,
  updateHardwareEncoding,
  updateHardwareEncoderId,
  updateHardwareEncoderPreset,
  updateHardwareRateControlMode,
  updateHardwareCq,
  updateHardwareVideoBitrate,
  updateHardwareMaxBitrate,
  updateHardwareGopSize,
  updateHardwareBFrames,
  updateLoudnessNormalization,
  updateMasterProcessing,
  updateMasterEqEnabled,
  updateMasterEqBand,
  updateMasterStereoEnabled,
  updateMasterStereoAmount,
  updateMasterLimiterEnabled,
  updateMasterLimiterLevel,
  updateColorManagement,
  updatePostExportScriptCommand,
  updateTimecodeBurnInEnabled,
  updateTimecodeBurnInPosition,
  updateTimecodeBurnInFontSize,
  updateTimecodeBurnInColor,
  updateTimecodeBurnInFrameNumber,
  updateSlateEnabled,
  updateWatermarkEnabled,
  updateWatermarkType,
  updateWatermarkPosition,
  updateImageWatermarkPath,
  updateImageWatermarkScale,
  updateImageWatermarkOpacity,
  updateTextWatermarkText,
  updateTextWatermarkFont,
  updateTextWatermarkColor,
  updateTextWatermarkSize,
} from './settings-updates';

export {
  countSpatialDenoiseClips,
  safePresetPackageFileName,
  choosePresetPackageConflictMode,
  collectSubtitleLanguageOptions,
  formatSubtitleLanguageLabel,
} from './project-helpers';
