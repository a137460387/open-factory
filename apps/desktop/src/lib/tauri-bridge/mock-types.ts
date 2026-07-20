import type {
  BeatSensitivity,
  ColorMatchFrameSample,
  FfmpegCapabilities,
  FfmpegExportPlan,
  MediaAsset,
  PostExportQualityAssuranceResult,
  ProxyPlan,
} from '@open-factory/editor-core';
import type {
  AnalyzeClipRequest,
  AnalyzeClipResult,
  AnalyzeMotionTrackRequest,
  AnalyzeMotionTrackResult,
  AppUpdateCheckOptions,
  AudioSpectrumAnalysis,
  AvailableAppUpdate,
  BatchTranscodeRequest,
  BatchTranscodeResponse,
  CancelSmokeConfig,
  CollaborationHostRequest,
  CollaborationHostState,
  CoverFrameBatchRequest,
  CoverFrameBatchResult,
  CoverFrameExtractionRequest,
  CoverFrameExtractionResult,
  DemucsRequest,
  DemucsResult,
  ExportResult,
  ExportPreviewSamplesRequest,
  ExportPreviewSamplesResult,
  ExportTrayLabels,
  FileDialogFilter,
  FileStat,
  GapFillMediaRequest,
  GapFillMediaResult,
  GifExportRequest,
  GifPreviewRequest,
  GifWorkflowResult,
  MediaAnalysis,
  MediaIntegrityScanResult,
  MediaProbe,
  NativeSilenceRange,
  NoiseReductionRequest,
  NoiseReductionResult,
  PostExportQualityAssuranceRequest,
  PreviewSmokeConfig,
  PreviewWindowRequest,
  PreviewWindowResolutionScale,
  PreviewWindowState,
  PrivacyDetectionRequest,
  PrivacyDetectionResult,
  ProxyResult,
  QualityEvaluationRequest,
  QualityEvaluationResult,
  RecordingRequest,
  RecordingStartResult,
  RecordingStopResult,
  SceneDetectRequest,
  SceneDetectionResult,
  SharedLibraryArchiveRequest,
  SharedLibraryArchiveResult,
  SharedLibraryImportRequest,
  SharedLibraryImportResult,
  SharePackageRequest,
  SharePackageResult,
  SmtpEmailRequest,
  SpatialAudioAssets,
  SystemResourceSnapshot,
  TranslationApiProvider,
  UnsavedCloseAction,
  WebdavExportUploadRequest,
  WebdavExportUploadResult,
  WebdavProjectBackupRequest,
  WebdavProjectBackupResult,
  WebdavTextPutRequest,
  WebdavTextRequest,
  WebdavTextResult,
  WebhookJsonRequest,
  WhisperRequest,
  WhisperResult,
} from './types';
import type {
  AutoTagRequest,
  AutoTagResult,
  CallAiApiRequest,
  CallAiApiResult,
  CallTtsApiRequest,
  CallTtsApiResult,
  DecoderConfig,
  DecoderHandle,
  DecodedFrame,
  ExtractAiFramesRequest,
  ExtractAiFramesResult,
  HardwareCapabilities,
  HwDecodeSettings,
  MediaIndexAsset,
  MediaSearchQuery,
  MediaSearchResult,
  OllamaModelsResult,
  TagWithCount,
  VideoInfo,
} from '../tauri-bridge';

export type TauriMocks = Partial<{
  confirm(message: string, options?: unknown): Promise<boolean> | boolean;
  chooseUnsavedCloseAction(): Promise<UnsavedCloseAction> | UnsavedCloseAction;
  openFileDialog(options: { multiple: boolean; filters: FileDialogFilter[] }): Promise<string[]> | string[];
  saveFileDialog(options: {
    defaultPath?: string;
    filters: FileDialogFilter[];
  }): Promise<string | undefined> | string | undefined;
  openDirectoryDialog(): Promise<string | undefined> | string | undefined;
  readFile(path: string): Promise<string> | string;
  readFileHeaderBytes(path: string, byteCount?: number): Promise<Uint8Array> | Uint8Array;
  writeFile(path: string, contents: string): Promise<void> | void;
  writeBinaryFile(path: string, base64Data: string): Promise<void> | void;
  encryptProjectFile(path: string, contents: string, password: string): Promise<void> | void;
  decryptProjectFile(path: string, password: string): Promise<string> | string;
  isEncryptedProjectFile(path: string): Promise<boolean> | boolean;
  writeClipReport(path: string, html: string): Promise<void> | void;
  writeVideoSummary(path: string, html: string): Promise<void> | void;
  removeFile(path: string): Promise<void> | void;
  trashFile(path: string): Promise<void> | void;
  copyFile(sourcePath: string, destinationPath: string): Promise<void> | void;
  moveFile(sourcePath: string, destinationPath: string): Promise<void> | void;
  fsExists(path: string): Promise<boolean> | boolean;
  ensureSpatialAudioAssets(): Promise<SpatialAudioAssets> | SpatialAudioAssets;
  readColorMatchFrameSample(
    path: string,
  ): Promise<ColorMatchFrameSample | undefined> | ColorMatchFrameSample | undefined;
  getAppDataDir(): Promise<string> | string;
  getTempSegmentsDir(): Promise<string> | string;
  getFileStat(path: string): Promise<FileStat> | FileStat;
  scanDirectory(path: string, depth?: number): Promise<string[]> | string[];
  authorizePaths(paths: string[]): Promise<void> | void;
  detectFfmpeg(): Promise<boolean> | boolean;
  getFfmpegCapabilities(): Promise<FfmpegCapabilities> | FfmpegCapabilities;
  getAvailableMemoryBytes(): Promise<number> | number;
  getSystemResourceSnapshot(): Promise<SystemResourceSnapshot> | SystemResourceSnapshot;
  runExport(plan: FfmpegExportPlan, taskId?: string): Promise<ExportResult> | ExportResult;
  runExportPreviewSamples(
    request: ExportPreviewSamplesRequest,
  ): Promise<ExportPreviewSamplesResult> | ExportPreviewSamplesResult;
  createSharePackage(request: SharePackageRequest): Promise<SharePackageResult> | SharePackageResult;
  createSharedLibraryArchive(
    request: SharedLibraryArchiveRequest,
  ): Promise<SharedLibraryArchiveResult> | SharedLibraryArchiveResult;
  importSharedLibraryArchive(
    request: SharedLibraryImportRequest,
  ): Promise<SharedLibraryImportResult> | SharedLibraryImportResult;
  putWebdavProject(request: WebdavProjectBackupRequest): Promise<WebdavProjectBackupResult> | WebdavProjectBackupResult;
  putWebdavExportFile(request: WebdavExportUploadRequest): Promise<WebdavExportUploadResult> | WebdavExportUploadResult;
  getWebdavText(request: WebdavTextRequest): Promise<WebdavTextResult> | WebdavTextResult;
  putWebdavText(request: WebdavTextPutRequest): Promise<{ status: number }> | { status: number };
  readWebdavPassword(): Promise<string | undefined> | string | undefined;
  writeWebdavPassword(password?: string): Promise<void> | void;
  readExportUploadWebdavPassword(): Promise<string | undefined> | string | undefined;
  writeExportUploadWebdavPassword(password?: string): Promise<void> | void;
  readExportPresetSyncWebdavPassword(): Promise<string | undefined> | string | undefined;
  writeExportPresetSyncWebdavPassword(password?: string): Promise<void> | void;
  readTranslationApiKey(provider: TranslationApiProvider): Promise<string | undefined> | string | undefined;
  writeTranslationApiKey(provider: TranslationApiProvider, apiKey?: string): Promise<void> | void;
  readSmtpPassword(profile: string): Promise<string | undefined> | string | undefined;
  writeSmtpPassword(profile: string, password?: string): Promise<void> | void;
  callAiApi(request: CallAiApiRequest, apiKey?: string): Promise<CallAiApiResult> | CallAiApiResult;
  extractAiFrames(request: ExtractAiFramesRequest): Promise<ExtractAiFramesResult> | ExtractAiFramesResult;
  testAiConnection(baseUrl: string, apiKey?: string, providerId?: string): Promise<boolean> | boolean;
  readAiApiKey(providerId: string): Promise<string | undefined> | string | undefined;
  writeAiApiKey(providerId: string, apiKey?: string): Promise<void> | void;
  checkOllamaReachable(): Promise<boolean> | boolean;
  listOllamaModels(): Promise<OllamaModelsResult> | OllamaModelsResult;
  callTtsApi(request: CallTtsApiRequest, apiKey?: string): Promise<CallTtsApiResult> | CallTtsApiResult;
  sendSmtpEmail(request: SmtpEmailRequest): Promise<void> | void;
  postWebhookJson(request: WebhookJsonRequest): Promise<{ status: number }> | { status: number };
  analyzeClip(request: AnalyzeClipRequest): Promise<AnalyzeClipResult> | AnalyzeClipResult;
  analyzeMotionTrack(request: AnalyzeMotionTrackRequest): Promise<AnalyzeMotionTrackResult> | AnalyzeMotionTrackResult;
  evaluateExportQuality(request: QualityEvaluationRequest): Promise<QualityEvaluationResult> | QualityEvaluationResult;
  runPostExportQualityAssurance(
    request: PostExportQualityAssuranceRequest,
  ): Promise<PostExportQualityAssuranceResult> | PostExportQualityAssuranceResult;
  exportMediaGif(request: GifExportRequest): Promise<GifWorkflowResult> | GifWorkflowResult;
  generateGifPreview(request: GifPreviewRequest): Promise<GifWorkflowResult> | GifWorkflowResult;
  cancelExport(taskId?: string): Promise<void> | void;
  cancelMotionTracking(clipId: string): Promise<void> | void;
  cancelQualityEvaluation(taskId: string): Promise<void> | void;
  batchTranscodeMedia(request: BatchTranscodeRequest): Promise<BatchTranscodeResponse> | BatchTranscodeResponse;
  cancelBatchTranscodeTask(taskId: string): Promise<void> | void;
  getCacheDir(): Promise<string> | string;
  readCache(path: string): Promise<string | null> | string | null;
  writeCache(path: string, contents: string): Promise<void> | void;
  removeCacheFile(path: string): Promise<void> | void;
  clearCache(): Promise<void> | void;
  getCacheSize(): Promise<number> | number;
  openPath(path: string): Promise<void> | void;
  forceCloseWindow(): Promise<void> | void;
  openPreviewWindow(request: PreviewWindowRequest): Promise<PreviewWindowState> | PreviewWindowState;
  closePreviewWindow(): Promise<PreviewWindowState> | PreviewWindowState;
  getPreviewWindowState(): Promise<PreviewWindowState> | PreviewWindowState;
  setPreviewWindowAlwaysOnTop(alwaysOnTop: boolean): Promise<PreviewWindowState> | PreviewWindowState;
  setPreviewWindowFullscreen(fullscreen: boolean): Promise<PreviewWindowState> | PreviewWindowState;
  setPreviewWindowResolutionScale(
    resolutionScale: PreviewWindowResolutionScale,
  ): Promise<PreviewWindowState> | PreviewWindowState;
  minimizeToTray(labels?: ExportTrayLabels): Promise<void> | void;
  showMainWindow(): Promise<void> | void;
  updateExportTrayProgress(progress: number, runningCount: number): Promise<void> | void;
  runExportPowerAction(action: 'shutdown' | 'hibernate', allowPowerActions: boolean): Promise<void> | void;
  sendNotification(title: string, body: string): Promise<void> | void;
  getAppVersion(): Promise<string> | string;
  checkAppUpdate(options?: AppUpdateCheckOptions): Promise<AvailableAppUpdate | null> | AvailableAppUpdate | null;
  relaunchApp(): Promise<void> | void;
  startCollaborationHost(request: CollaborationHostRequest): Promise<CollaborationHostState> | CollaborationHostState;
  stopCollaborationHost(): Promise<void> | void;
  broadcastCollaborationMessage(message: string): Promise<void> | void;
  probeMediaPath(path: string): Promise<Partial<MediaAsset>> | Partial<MediaAsset>;
  probeMedia(path: string): Promise<MediaProbe> | MediaProbe;
  analyzeMedia(path: string): Promise<MediaAnalysis> | MediaAnalysis;
  scanMediaIntegrity(path: string): Promise<MediaIntegrityScanResult> | MediaIntegrityScanResult;
  analyzeAudioSpectrum(path: string): Promise<AudioSpectrumAnalysis> | AudioSpectrumAnalysis;
  generateGapFillMedia(request: GapFillMediaRequest): Promise<GapFillMediaResult> | GapFillMediaResult;
  extractCoverFrames(
    request: CoverFrameExtractionRequest,
  ): Promise<CoverFrameExtractionResult> | CoverFrameExtractionResult;
  batchExtractCoverFrames(request: CoverFrameBatchRequest): Promise<CoverFrameBatchResult> | CoverFrameBatchResult;
  analyzeWaveform(path: string, samplesPerSec: number): Promise<number[]> | number[];
  detectBeats(path: string, sensitivity: BeatSensitivity): Promise<number[]> | number[];
  detectSilence(
    path: string,
    thresholdDb: number,
    minGapMs: number,
  ): Promise<NativeSilenceRange[]> | NativeSilenceRange[];
  generateProxy(plan: ProxyPlan): Promise<ProxyResult> | ProxyResult;
  detectSceneChanges(request: SceneDetectRequest): Promise<SceneDetectionResult> | SceneDetectionResult;
  cancelSceneDetection(taskId: string): Promise<void> | void;
  runWhisper(request: WhisperRequest): Promise<WhisperResult> | WhisperResult;
  runDemucs(request: DemucsRequest): Promise<DemucsResult> | DemucsResult;
  cancelDemucs(clipId: string): Promise<void> | void;
  processAudioNoiseReduction(request: NoiseReductionRequest): Promise<NoiseReductionResult> | NoiseReductionResult;
  cancelAudioNoiseReduction(clipId: string): Promise<void> | void;
  detectPrivacyRegions(request: PrivacyDetectionRequest): Promise<PrivacyDetectionResult> | PrivacyDetectionResult;
  startRecording(request: RecordingRequest): Promise<RecordingStartResult> | RecordingStartResult;
  stopRecording(taskId: string): Promise<RecordingStopResult> | RecordingStopResult;
  getPreviewSmokeConfig(): Promise<PreviewSmokeConfig | undefined> | PreviewSmokeConfig | undefined;
  getCancelSmokeConfig(): Promise<CancelSmokeConfig | undefined> | CancelSmokeConfig | undefined;
  listen<T>(event: string, handler: (payload: T) => void): Promise<() => void> | (() => void);
  emit<T>(event: string, payload: T): Promise<void> | void;
  initMediaIndexDb(projectPath: string): Promise<void> | void;
  upsertMediaAsset(projectPath: string, asset: MediaIndexAsset): Promise<void> | void;
  batchUpsertMediaAssets(projectPath: string, assets: MediaIndexAsset[]): Promise<number> | number;
  deleteMediaAsset(projectPath: string, id: string): Promise<void> | void;
  searchMediaAssets(query: MediaSearchQuery): Promise<MediaSearchResult> | MediaSearchResult;
  autoTagAsset(request: AutoTagRequest): Promise<AutoTagResult> | AutoTagResult;
  batchAutoTagAssets(projectPath: string, requests: AutoTagRequest[]): Promise<AutoTagResult[]> | AutoTagResult[];
  getAllTags(projectPath: string): Promise<TagWithCount[]> | TagWithCount[];
  addManualTag(projectPath: string, assetId: string, tagName: string): Promise<void> | void;
  removeManualTag(projectPath: string, assetId: string, tagName: string): Promise<void> | void;
  getHwDecodeCapabilities(): Promise<HardwareCapabilities> | HardwareCapabilities;
  initHardwareDecoder(config: DecoderConfig): Promise<DecoderHandle> | DecoderHandle;
  decodeVideoFrame(handle: DecoderHandle, timestamp: number): Promise<DecodedFrame> | DecodedFrame;
  decodeVideoFrames(handle: DecoderHandle, timestamps: number[]): Promise<DecodedFrame[]> | DecodedFrame[];
  getDecoderVideoInfo(handle: DecoderHandle): Promise<VideoInfo> | VideoInfo;
  getHwDecodeSettings(): Promise<HwDecodeSettings> | HwDecodeSettings;
  setHwDecodeSettings(settings: HwDecodeSettings): Promise<void> | void;
  releaseDecoder(handle: DecoderHandle): Promise<void> | void;
}>;

export function getTauriMocks(): TauriMocks | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  return window.__TAURI_MOCKS__;
}
