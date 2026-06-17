import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { confirm, message as dialogMessage } from '@tauri-apps/plugin-dialog';
import { open as openShellPath } from '@tauri-apps/plugin-shell';
import type { BeatSensitivity, ColorMatchFrameSample, ExportPreviewSamplePlan, ExportReport, FfmpegCapabilities, FfmpegExportPlan, MotionTrackPoint, PostExportQualityAssuranceResult, ProxyPlan } from '@open-factory/editor-core';
import { zhCN } from '../i18n/strings';
import { isTauriRuntime } from './tauri';

export interface FileDialogFilter {
  name: string;
  extensions: string[];
}

export interface FileStat {
  path: string;
  size: number;
  mtimeMs: number;
}

export interface ExportResult {
  success: boolean;
  outputPath: string;
  durationMs: number;
  warnings: string[];
  report?: ExportReport;
}

export interface ExportPreviewSamplesRequest {
  samples: ExportPreviewSamplePlan[];
  timeoutMs?: number;
}

export interface ExportPreviewSampleResult {
  id: string;
  kind: ExportPreviewSamplePlan['kind'];
  label: string;
  time: number;
  path: string;
  durationMs: number;
}

export interface ExportPreviewSamplesResult {
  samples: ExportPreviewSampleResult[];
  durationMs: number;
}

export interface PreviewWindowBounds {
  x?: number;
  y?: number;
  width: number;
  height: number;
}

export type PreviewWindowResolutionScale = 1 | 0.5 | 0.25;

export interface PreviewWindowRequest {
  bounds: PreviewWindowBounds;
  alwaysOnTop: boolean;
  resolutionScale: PreviewWindowResolutionScale;
}

export interface PreviewWindowState {
  open: boolean;
  label: string;
  bounds?: PreviewWindowBounds;
  alwaysOnTop: boolean;
  fullscreen: boolean;
  resolutionScale: PreviewWindowResolutionScale;
}

export interface ExportTrayLabels {
  showWindow: string;
  pauseQueue: string;
  cancelAll: string;
  exit: string;
}

export interface SharePackageFileEntry {
  sourcePath: string;
  archivePath: string;
}

export interface SharePackageRequest {
  outputPath: string;
  projectFileName: string;
  projectContents: string;
  readmeContents: string;
  exportedVideo: SharePackageFileEntry;
  mediaFiles: SharePackageFileEntry[];
}

export interface SharePackageResult {
  outputPath: string;
  fileCount: number;
  durationMs: number;
}

export interface SharedLibraryArchiveFileEntry {
  sourcePath: string;
  archivePath: string;
}

export interface SharedLibraryArchiveRequest {
  outputPath: string;
  manifestContents: string;
  files: SharedLibraryArchiveFileEntry[];
}

export interface SharedLibraryArchiveResult {
  outputPath: string;
  fileCount: number;
  durationMs: number;
}

export interface SharedLibraryImportRequest {
  archivePath: string;
  destinationDir: string;
}

export interface SharedLibraryImportResult {
  destinationDir: string;
  fileCount: number;
  manifestContents: string;
}

export interface WebdavProjectBackupRequest {
  url: string;
  username?: string;
  password?: string;
  projectPath: string;
  contents: string;
}

export interface WebdavProjectBackupResult {
  status: number;
}

export interface WebdavExportUploadRequest {
  url: string;
  username?: string;
  password?: string;
  sourcePath: string;
}

export interface WebdavExportUploadResult {
  status: number;
  bytes: number;
}

export interface WebdavTextRequest {
  url: string;
  username?: string;
  password?: string;
}

export interface WebdavTextResult {
  status: number;
  contents: string;
}

export interface WebdavTextPutRequest extends WebdavTextRequest {
  contents: string;
  contentType?: string;
}

export type TranslationApiProvider = 'deepl' | 'google';

export interface SharePackageProgressEvent {
  stage: 'readme' | 'project' | 'export' | 'media' | 'finished';
  progress: number;
  progressPct: number;
  current: number;
  total: number;
  outputPath: string;
}

export interface MediaProbe {
  hasAudio: boolean;
  audioChannels?: number;
  audioSampleRate?: number;
  audioCodec?: string;
  videoCodec?: string;
  frameRate?: number;
  avgFrameRate?: string;
  realFrameRate?: string;
  variableFrameRate?: boolean;
  fieldOrder?: string;
}

export interface SystemResourceSnapshot {
  cpuUsage: number;
  totalMemoryBytes: number;
  availableMemoryBytes: number;
  usedMemoryBytes: number;
}

export interface MediaFormatInfo {
  formatName?: string;
  formatLongName?: string;
  duration?: number;
  bitRate?: number;
  size?: number;
}

export interface MediaVideoStreamInfo {
  index: number;
  codecName?: string;
  codecLongName?: string;
  duration?: number;
  width?: number;
  height?: number;
  frameRate?: number;
  bitRate?: number;
  colorSpace?: string;
  colorTransfer?: string;
  colorPrimaries?: string;
  pixelFormat?: string;
  fieldOrder?: string;
  hdrMetadata: string[];
}

export interface MediaAudioStreamInfo {
  index: number;
  codecName?: string;
  codecLongName?: string;
  duration?: number;
  sampleRate?: number;
  channels?: number;
  channelLayout?: string;
  bitRate?: number;
  integratedLufs?: number;
}

export interface MediaBitratePoint {
  time: number;
  bitRate: number;
}

export interface MediaAnalysis {
  path: string;
  fileSize?: number;
  createdTimeMs?: number;
  format: MediaFormatInfo;
  videoStreams: MediaVideoStreamInfo[];
  audioStreams: MediaAudioStreamInfo[];
  bitratePoints: MediaBitratePoint[];
  loudnessError?: string;
}

export interface MediaIntegrityScanResult {
  path: string;
  ok: boolean;
  errorOutput?: string;
}

export interface AudioSpectrumStats {
  integratedLufs?: number;
  dynamicRangeLu?: number;
  truePeakDbfs?: number;
  peakDb?: number;
  rmsDb?: number;
}

export interface AudioSpectrumAnalysis {
  path: string;
  spectrogramPath?: string;
  spectrogramError?: string;
  stats: AudioSpectrumStats;
  statsError?: string;
}

export type GapFillMediaRequest =
  | { kind: 'freeze-frame'; sourcePath: string; sourceTime: number; width: number; height: number }
  | { kind: 'solid-color'; color: string; width: number; height: number };

export interface GapFillMediaResult {
  path: string;
  name: string;
  width: number;
  height: number;
}

export type CoverFrameExtractionMode = 'i-frame' | 'interval';

export interface CoverFrameExtractionRequest {
  clipId: string;
  sourcePath: string;
  outputDir: string;
  outputStem: string;
  mode: CoverFrameExtractionMode;
  count?: number;
  timestamps?: number[];
}

export interface CoverFrameResult {
  index: number;
  path: string;
  timestamp?: number;
}

export interface CoverFrameExtractionResult {
  clipId: string;
  frames: CoverFrameResult[];
}

export interface CoverFrameBatchTaskRequest {
  assetId: string;
  sourcePath: string;
  outputFileName: string;
}

export interface CoverFrameBatchRequest {
  outputDir: string;
  tasks: CoverFrameBatchTaskRequest[];
}

export interface CoverFrameBatchTaskResult {
  assetId: string;
  sourcePath: string;
  outputPath?: string;
  status: 'completed' | 'failed';
  error?: string;
}

export interface CoverFrameBatchResult {
  results: CoverFrameBatchTaskResult[];
}

export interface CoverFrameProgressEvent {
  taskId: string;
  status: 'running' | 'completed' | 'failed';
  current: number;
  total: number;
  progress: number;
  progressPct: number;
  outputPath?: string;
}

export interface ProxyResult {
  assetId: string;
  proxyPath: string;
  durationMs: number;
}

export interface AnalyzeClipRequest {
  clipId: string;
  mediaPath: string;
  duration: number;
}

export interface AnalyzeClipResult {
  clipId: string;
  trfPath: string;
  durationMs: number;
}

export interface AnalyzeMotionTrackRequest {
  clipId: string;
  mediaPath: string;
  duration: number;
}

export interface AnalyzeMotionTrackResult {
  clipId: string;
  points: MotionTrackPoint[];
  durationMs: number;
}

export interface ClipAnalysisProgressEvent {
  clipId: string;
  progress: number;
  progressPct: number;
}

export interface MotionTrackProgressEvent {
  clipId: string;
  progress: number;
  progressPct: number;
}

export interface QualityEvaluationRequest {
  taskId: string;
  sourcePath: string;
  outputPath: string;
  duration?: number;
}

export interface QualityEvaluationResult {
  taskId: string;
  ssim?: number;
  psnr?: number;
  vmaf?: number;
  vmafAvailable: boolean;
  durationMs: number;
}

export interface QualityEvaluationProgressEvent {
  taskId: string;
  progress: number;
  progressPct: number;
}

export interface PostExportQualityAssuranceRequest {
  taskId: string;
  outputPath: string;
  expectedDuration?: number;
  fps?: number;
  expectedWidth?: number;
  expectedHeight?: number;
  duration: boolean;
  blackFrames: boolean;
  silence: boolean;
  fileSize: boolean;
  resolution: boolean;
  minFileSizeBytes?: number;
  maxFileSizeBytes?: number;
  blackFrameDurationSeconds: number;
  silenceThresholdDb: number;
  silenceDurationSeconds: number;
  autoRetry: boolean;
}

export type GifDitherAlgorithm = 'bayer' | 'floyd_steinberg';

export interface GifExportRequest {
  sourcePath: string;
  outputPath: string;
  frameRate: number;
  scaleWidth: number;
  startTime: number;
  duration: number;
  loopCount: number;
  dither: GifDitherAlgorithm;
}

export interface GifPreviewRequest {
  sourcePath: string;
  frameRate: number;
  startTime: number;
  duration: number;
  dither: GifDitherAlgorithm;
}

export interface GifWorkflowResult {
  outputPath: string;
  fullArgs: string[];
  durationMs: number;
}

export type BatchTranscodePreset = 'h264-720p' | 'h264-1080p' | 'prores-proxy';

export interface BatchTranscodeTaskRequest {
  taskId: string;
  sourcePath: string;
}

export interface BatchTranscodeRequest {
  tasks: BatchTranscodeTaskRequest[];
  preset: BatchTranscodePreset;
}

export interface BatchTranscodeProgressEvent {
  taskId: string;
  sourcePath: string;
  outputPath?: string;
  status: 'running' | 'completed' | 'failed' | 'canceled';
  progress: number;
  progressPct: number;
  current: number;
  total: number;
}

export interface BatchTranscodeTaskResult {
  taskId: string;
  sourcePath: string;
  outputPath?: string;
  status: 'completed' | 'failed' | 'canceled';
  error?: string;
  durationMs: number;
}

export interface BatchTranscodeResponse {
  results: BatchTranscodeTaskResult[];
}

export interface SceneDetectRequest {
  path: string;
  threshold?: number;
  duration?: number;
  taskId?: string;
  frameRate?: number;
}

export interface SceneDetectionResult {
  sceneTimes: number[];
  limited?: boolean;
  analyzedDuration?: number;
}

export interface SceneDetectProgressEvent {
  progress: number;
  ptsTime?: number | null;
  analyzedFrames?: number | null;
  totalFrames?: number | null;
}

export interface WhisperRequest {
  executablePath: string;
  modelPath: string;
  audioPath: string;
  clipId: string;
}

export interface WhisperResult {
  srtPath: string;
  contents: string;
  durationMs: number;
}

export interface WhisperProgressEvent {
  clipId: string;
  progress: number;
  progressPct: number;
}

export interface DemucsRequest {
  executablePath: string;
  mediaPath: string;
  clipId: string;
}

export interface DemucsResult {
  vocalsPath: string;
  accompanimentPath: string;
  outputDir: string;
  durationMs: number;
}

export interface DemucsProgressEvent {
  clipId: string;
  progress: number;
  progressPct: number;
}

export interface PrivacyDetectionRequest {
  modelPath: string;
  mediaPath: string;
  clipId: string;
  duration?: number;
}

export interface PrivacyDetectionBox {
  time: number;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  confidence?: number;
}

export interface PrivacyDetectionResult {
  clipId: string;
  boxes: PrivacyDetectionBox[];
  durationMs: number;
}

export type RecordingSource = 'screen' | 'camera';

export interface RecordingRequest {
  taskId: string;
  source: RecordingSource;
  width: number;
  height: number;
  frameRate: number;
}

export interface RecordingStartResult {
  taskId: string;
  outputPath: string;
}

export interface RecordingStopResult {
  taskId: string;
  outputPath: string;
  durationMs: number;
}

export type NativeSilenceRange = [number, number];

export type UnsavedCloseAction = 'save' | 'discard' | 'cancel';

export interface PreviewSmokeConfig {
  enabled: boolean;
  fixtureName?: string;
  mediaPath: string;
  proxyMediaPath?: string;
  reportPath: string;
}

export interface CancelSmokeConfig {
  enabled: boolean;
  mediaPath: string;
  outputPath: string;
  reportPath: string;
}

export type TauriMocks = Partial<{
  confirm(message: string, options?: unknown): Promise<boolean> | boolean;
  chooseUnsavedCloseAction(): Promise<UnsavedCloseAction> | UnsavedCloseAction;
  openFileDialog(options: { multiple: boolean; filters: FileDialogFilter[] }): Promise<string[]> | string[];
  saveFileDialog(options: { defaultPath?: string; filters: FileDialogFilter[] }): Promise<string | undefined> | string | undefined;
  openDirectoryDialog(): Promise<string | undefined> | string | undefined;
  readFile(path: string): Promise<string> | string;
  writeFile(path: string, contents: string): Promise<void> | void;
  encryptProjectFile(path: string, contents: string, password: string): Promise<void> | void;
  decryptProjectFile(path: string, password: string): Promise<string> | string;
  isEncryptedProjectFile(path: string): Promise<boolean> | boolean;
  writeClipReport(path: string, html: string): Promise<void> | void;
  removeFile(path: string): Promise<void> | void;
  copyFile(sourcePath: string, destinationPath: string): Promise<void> | void;
  fsExists(path: string): Promise<boolean> | boolean;
  readColorMatchFrameSample(path: string): Promise<ColorMatchFrameSample | undefined> | ColorMatchFrameSample | undefined;
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
  runExportPreviewSamples(request: ExportPreviewSamplesRequest): Promise<ExportPreviewSamplesResult> | ExportPreviewSamplesResult;
  createSharePackage(request: SharePackageRequest): Promise<SharePackageResult> | SharePackageResult;
  createSharedLibraryArchive(request: SharedLibraryArchiveRequest): Promise<SharedLibraryArchiveResult> | SharedLibraryArchiveResult;
  importSharedLibraryArchive(request: SharedLibraryImportRequest): Promise<SharedLibraryImportResult> | SharedLibraryImportResult;
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
  analyzeClip(request: AnalyzeClipRequest): Promise<AnalyzeClipResult> | AnalyzeClipResult;
  analyzeMotionTrack(request: AnalyzeMotionTrackRequest): Promise<AnalyzeMotionTrackResult> | AnalyzeMotionTrackResult;
  evaluateExportQuality(request: QualityEvaluationRequest): Promise<QualityEvaluationResult> | QualityEvaluationResult;
  runPostExportQualityAssurance(request: PostExportQualityAssuranceRequest): Promise<PostExportQualityAssuranceResult> | PostExportQualityAssuranceResult;
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
  setPreviewWindowResolutionScale(resolutionScale: PreviewWindowResolutionScale): Promise<PreviewWindowState> | PreviewWindowState;
  minimizeToTray(labels?: ExportTrayLabels): Promise<void> | void;
  showMainWindow(): Promise<void> | void;
  updateExportTrayProgress(progress: number, runningCount: number): Promise<void> | void;
  runExportPowerAction(action: 'shutdown' | 'hibernate', allowPowerActions: boolean): Promise<void> | void;
  sendNotification(title: string, body: string): Promise<void> | void;
  probeMediaPath(path: string): Promise<Partial<import('@open-factory/editor-core').MediaAsset>> | Partial<import('@open-factory/editor-core').MediaAsset>;
  probeMedia(path: string): Promise<MediaProbe> | MediaProbe;
  analyzeMedia(path: string): Promise<MediaAnalysis> | MediaAnalysis;
  scanMediaIntegrity(path: string): Promise<MediaIntegrityScanResult> | MediaIntegrityScanResult;
  analyzeAudioSpectrum(path: string): Promise<AudioSpectrumAnalysis> | AudioSpectrumAnalysis;
  generateGapFillMedia(request: GapFillMediaRequest): Promise<GapFillMediaResult> | GapFillMediaResult;
  extractCoverFrames(request: CoverFrameExtractionRequest): Promise<CoverFrameExtractionResult> | CoverFrameExtractionResult;
  batchExtractCoverFrames(request: CoverFrameBatchRequest): Promise<CoverFrameBatchResult> | CoverFrameBatchResult;
  analyzeWaveform(path: string, samplesPerSec: number): Promise<number[]> | number[];
  detectBeats(path: string, sensitivity: BeatSensitivity): Promise<number[]> | number[];
  detectSilence(path: string, thresholdDb: number, minGapMs: number): Promise<NativeSilenceRange[]> | NativeSilenceRange[];
  generateProxy(plan: ProxyPlan): Promise<ProxyResult> | ProxyResult;
  detectSceneChanges(request: SceneDetectRequest): Promise<SceneDetectionResult> | SceneDetectionResult;
  cancelSceneDetection(taskId: string): Promise<void> | void;
  runWhisper(request: WhisperRequest): Promise<WhisperResult> | WhisperResult;
  runDemucs(request: DemucsRequest): Promise<DemucsResult> | DemucsResult;
  cancelDemucs(clipId: string): Promise<void> | void;
  detectPrivacyRegions(request: PrivacyDetectionRequest): Promise<PrivacyDetectionResult> | PrivacyDetectionResult;
  startRecording(request: RecordingRequest): Promise<RecordingStartResult> | RecordingStartResult;
  stopRecording(taskId: string): Promise<RecordingStopResult> | RecordingStopResult;
  getPreviewSmokeConfig(): Promise<PreviewSmokeConfig | undefined> | PreviewSmokeConfig | undefined;
  getCancelSmokeConfig(): Promise<CancelSmokeConfig | undefined> | CancelSmokeConfig | undefined;
  listen<T>(event: string, handler: (payload: T) => void): Promise<() => void> | (() => void);
  emit<T>(event: string, payload: T): Promise<void> | void;
}>;

export function getTauriMocks(): TauriMocks | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  return window.__TAURI_MOCKS__;
}

export async function bridgeConfirm(message: string, options?: unknown): Promise<boolean> {
  const mock = getTauriMocks()?.confirm;
  if (mock) {
    return mock(message, options);
  }
  if (isTauriRuntime()) {
    return confirm(message, options as Parameters<typeof confirm>[1]);
  }
  return window.confirm(message);
}

export async function chooseUnsavedCloseAction(): Promise<UnsavedCloseAction> {
  const mock = getTauriMocks()?.chooseUnsavedCloseAction;
  if (mock) {
    return mock();
  }
  if (isTauriRuntime()) {
    const result = await dialogMessage(zhCN.closeGuard.message, {
      title: zhCN.closeGuard.title,
      kind: 'warning',
      buttons: { yes: zhCN.closeGuard.save, no: zhCN.closeGuard.discard, cancel: zhCN.closeGuard.cancel }
    });
    if (result === 'Yes' || result === 'Save' || result === zhCN.closeGuard.save) {
      return 'save';
    }
    if (result === 'No' || result === 'Discard' || result === zhCN.closeGuard.discard) {
      return 'discard';
    }
    return 'cancel';
  }
  const result = window.prompt(zhCN.closeGuard.browserPrompt, 'cancel')?.trim().toLowerCase();
  return result === 'save' || result === 'discard' ? result : 'cancel';
}

export async function openFileDialog(multiple: boolean, filters: FileDialogFilter[]): Promise<string[]> {
  const mock = getTauriMocks()?.openFileDialog;
  if (mock) {
    return mock({ multiple, filters });
  }
  if (!isTauriRuntime()) {
    throw new Error('openFileDialog 需要 Tauri 或 __TAURI_MOCKS__ 实现。');
  }
  return invoke<string[]>('open_file_dialog', { multiple, filters });
}

export function convertLocalFileSrc(path: string): string {
  if (isTauriRuntime()) {
    return convertFileSrc(path);
  }
  return path;
}

export async function saveFileDialog(defaultPath: string | undefined, filters: FileDialogFilter[]): Promise<string | undefined> {
  const mock = getTauriMocks()?.saveFileDialog;
  if (mock) {
    return mock({ defaultPath, filters });
  }
  if (!isTauriRuntime()) {
    throw new Error('saveFileDialog 需要 Tauri 或 __TAURI_MOCKS__ 实现。');
  }
  return invoke<string | undefined>('save_file_dialog', { defaultPath, filters });
}

export async function openDirectoryDialog(): Promise<string | undefined> {
  const mock = getTauriMocks()?.openDirectoryDialog;
  if (mock) {
    return mock();
  }
  if (!isTauriRuntime()) {
    throw new Error('openDirectoryDialog 需要 Tauri 或 __TAURI_MOCKS__ 实现。');
  }
  return invoke<string | undefined>('open_directory_dialog');
}

export async function readFile(path: string): Promise<string> {
  const mock = getTauriMocks()?.readFile;
  if (mock) {
    return mock(path);
  }
  return invoke<string>('read_file', { path });
}

export async function writeFile(path: string, contents: string): Promise<void> {
  const mock = getTauriMocks()?.writeFile;
  if (mock) {
    await mock(path, contents);
    return;
  }
  await invoke('write_file', { path, contents });
}

export async function encryptProjectFile(path: string, contents: string, password: string): Promise<void> {
  const mock = getTauriMocks()?.encryptProjectFile;
  if (mock) {
    await mock(path, contents, password);
    return;
  }
  await invoke('encrypt_project_file', { path, contents, password });
}

export async function decryptProjectFile(path: string, password: string): Promise<string> {
  const mock = getTauriMocks()?.decryptProjectFile;
  if (mock) {
    return mock(path, password);
  }
  return invoke<string>('decrypt_project_file', { path, password });
}

export async function isEncryptedProjectFile(path: string): Promise<boolean> {
  const mock = getTauriMocks()?.isEncryptedProjectFile;
  if (mock) {
    return mock(path);
  }
  return invoke<boolean>('is_encrypted_project_file', { path });
}

export async function writeClipReport(path: string, html: string): Promise<void> {
  const mock = getTauriMocks()?.writeClipReport;
  if (mock) {
    await mock(path, html);
    return;
  }
  await invoke('write_clip_report', { path, html });
}

export async function removeFile(path: string): Promise<void> {
  const mock = getTauriMocks()?.removeFile;
  if (mock) {
    await mock(path);
    return;
  }
  await invoke('remove_file', { path });
}

export async function copyFile(sourcePath: string, destinationPath: string): Promise<void> {
  const mock = getTauriMocks()?.copyFile;
  if (mock) {
    await mock(sourcePath, destinationPath);
    return;
  }
  await invoke('copy_file', { sourcePath, destinationPath });
}

export async function sendNotification(title: string, body: string): Promise<void> {
  const mock = getTauriMocks()?.sendNotification;
  if (mock) {
    await mock(title, body);
    return;
  }
  if (isTauriRuntime()) {
    await invoke('send_notification', { title, body });
    return;
  }
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        new Notification(title, { body });
      }
    }
  }
}

export async function fsExists(path: string): Promise<boolean> {
  const mock = getTauriMocks()?.fsExists;
  if (mock) {
    return mock(path);
  }
  return invoke<boolean>('fs_exists', { path });
}

export async function getAppDataDir(): Promise<string> {
  const mock = getTauriMocks()?.getAppDataDir;
  if (mock) {
    return mock();
  }
  return invoke<string>('get_app_data_dir');
}

export async function getTempSegmentsDir(): Promise<string> {
  const mock = getTauriMocks()?.getTempSegmentsDir;
  if (mock) {
    return mock();
  }
  return invoke<string>('get_temp_segments_dir');
}

export async function getFileStat(path: string): Promise<FileStat> {
  const mock = getTauriMocks()?.getFileStat;
  if (mock) {
    return mock(path);
  }
  return invoke<FileStat>('get_file_stat', { path });
}

export async function readColorMatchFrameSample(path: string): Promise<ColorMatchFrameSample | undefined> {
  const mock = getTauriMocks()?.readColorMatchFrameSample;
  return mock ? mock(path) : undefined;
}

export async function authorizePaths(paths: string[]): Promise<void> {
  const mock = getTauriMocks()?.authorizePaths;
  if (mock) {
    await mock(paths);
    return;
  }
  if (isTauriRuntime()) {
    await invoke('authorize_paths', { paths });
  }
}

export async function probeMedia(path: string): Promise<MediaProbe> {
  const mock = getTauriMocks()?.probeMedia;
  if (mock) {
    return mock(path);
  }
  if (!isTauriRuntime()) {
    return { hasAudio: false };
  }
  return invoke<MediaProbe>('probe_media', { path });
}

export async function analyzeMedia(path: string): Promise<MediaAnalysis> {
  const mock = getTauriMocks()?.analyzeMedia;
  if (mock) {
    return mock(path);
  }
  if (!isTauriRuntime()) {
    throw new Error('analyzeMedia 需要 Tauri 或 __TAURI_MOCKS__ 实现。');
  }
  return invoke<MediaAnalysis>('analyze_media', { path });
}

export async function scanMediaIntegrity(path: string): Promise<MediaIntegrityScanResult> {
  const mock = getTauriMocks()?.scanMediaIntegrity;
  if (mock) {
    return mock(path);
  }
  if (!isTauriRuntime()) {
    throw new Error('scanMediaIntegrity 需要 Tauri 或 __TAURI_MOCKS__ 实现。');
  }
  return invoke<MediaIntegrityScanResult>('scan_media_integrity', { path });
}

export async function analyzeAudioSpectrum(path: string): Promise<AudioSpectrumAnalysis> {
  const mock = getTauriMocks()?.analyzeAudioSpectrum;
  if (mock) {
    return mock(path);
  }
  if (!isTauriRuntime()) {
    throw new Error('analyzeAudioSpectrum 需要 Tauri 或 __TAURI_MOCKS__ 实现。');
  }
  return invoke<AudioSpectrumAnalysis>('analyze_audio_spectrum', { path });
}

export async function generateGapFillMedia(request: GapFillMediaRequest): Promise<GapFillMediaResult> {
  const mock = getTauriMocks()?.generateGapFillMedia;
  if (mock) {
    return mock(request);
  }
  if (!isTauriRuntime()) {
    throw new Error('generateGapFillMedia 需要 Tauri 或 __TAURI_MOCKS__ 实现。');
  }
  return invoke<GapFillMediaResult>('generate_gap_fill_media', { request });
}

export async function extractCoverFrames(request: CoverFrameExtractionRequest): Promise<CoverFrameExtractionResult> {
  const mock = getTauriMocks()?.extractCoverFrames;
  if (mock) {
    return mock(request);
  }
  if (!isTauriRuntime()) {
    throw new Error('extractCoverFrames 需要 Tauri 或 __TAURI_MOCKS__ 实现。');
  }
  return invoke<CoverFrameExtractionResult>('extract_cover_frames', { request });
}

export async function batchExtractCoverFrames(request: CoverFrameBatchRequest): Promise<CoverFrameBatchResult> {
  const mock = getTauriMocks()?.batchExtractCoverFrames;
  if (mock) {
    return mock(request);
  }
  if (!isTauriRuntime()) {
    throw new Error('batchExtractCoverFrames 需要 Tauri 或 __TAURI_MOCKS__ 实现。');
  }
  return invoke<CoverFrameBatchResult>('batch_extract_cover_frames', { request });
}

export async function analyzeWaveform(path: string, samplesPerSec: number): Promise<number[]> {
  const mock = getTauriMocks()?.analyzeWaveform;
  if (mock) {
    return mock(path, samplesPerSec);
  }
  return invoke<number[]>('analyze_waveform', { path, samplesPerSec });
}

export async function detectBeats(path: string, sensitivity: BeatSensitivity): Promise<number[]> {
  const mock = getTauriMocks()?.detectBeats;
  if (mock) {
    return mock(path, sensitivity);
  }
  return invoke<number[]>('detect_beats', { path, sensitivity });
}

export async function detectSilence(path: string, thresholdDb: number, minGapMs: number): Promise<NativeSilenceRange[]> {
  const mock = getTauriMocks()?.detectSilence;
  if (mock) {
    return mock(path, thresholdDb, minGapMs);
  }
  return invoke<NativeSilenceRange[]>('detect_silence', { path, thresholdDb, minGapMs });
}

export async function generateProxy(plan: ProxyPlan): Promise<ProxyResult> {
  const mock = getTauriMocks()?.generateProxy;
  if (mock) {
    return mock(plan);
  }
  return invoke<ProxyResult>('generate_proxy', { plan });
}

export async function detectSceneChanges(request: SceneDetectRequest): Promise<SceneDetectionResult> {
  const mock = getTauriMocks()?.detectSceneChanges;
  if (mock) {
    return mock(request);
  }
  return invoke<SceneDetectionResult>('detect_scene_changes', { request });
}

export async function cancelSceneDetection(taskId: string): Promise<void> {
  const mock = getTauriMocks()?.cancelSceneDetection;
  if (mock) {
    return mock(taskId);
  }
  return invoke<void>('cancel_scene_detection', { taskId });
}

export async function runWhisper(request: WhisperRequest): Promise<WhisperResult> {
  const mock = getTauriMocks()?.runWhisper;
  if (mock) {
    return mock(request);
  }
  return invoke<WhisperResult>('run_whisper', { request });
}

export async function runDemucs(request: DemucsRequest): Promise<DemucsResult> {
  const mock = getTauriMocks()?.runDemucs;
  if (mock) {
    return mock(request);
  }
  return invoke<DemucsResult>('run_demucs', { request });
}

export async function cancelDemucs(clipId: string): Promise<void> {
  const mock = getTauriMocks()?.cancelDemucs;
  if (mock) {
    await mock(clipId);
    return;
  }
  await invoke('cancel_demucs', { clipId });
}

export async function detectPrivacyRegions(request: PrivacyDetectionRequest): Promise<PrivacyDetectionResult> {
  const mock = getTauriMocks()?.detectPrivacyRegions;
  if (mock) {
    return mock(request);
  }
  return invoke<PrivacyDetectionResult>('detect_privacy_regions', { request });
}

export async function startRecording(request: RecordingRequest): Promise<RecordingStartResult> {
  const mock = getTauriMocks()?.startRecording;
  if (mock) {
    return mock(request);
  }
  return invoke<RecordingStartResult>('start_recording', { request });
}

export async function stopRecording(taskId: string): Promise<RecordingStopResult> {
  const mock = getTauriMocks()?.stopRecording;
  if (mock) {
    return mock(taskId);
  }
  return invoke<RecordingStopResult>('stop_recording', { taskId });
}

export async function scanDirectory(path: string, depth = 3): Promise<string[]> {
  const mock = getTauriMocks()?.scanDirectory;
  if (mock) {
    return mock(path, depth);
  }
  return invoke<string[]>('scan_directory', { path, depth });
}

export async function getPreviewSmokeConfig(): Promise<PreviewSmokeConfig | undefined> {
  const mock = getTauriMocks()?.getPreviewSmokeConfig;
  if (mock) {
    return mock();
  }
  if (!isTauriRuntime()) {
    return undefined;
  }
  return invoke<PreviewSmokeConfig | undefined>('get_preview_smoke_config');
}

export async function getCancelSmokeConfig(): Promise<CancelSmokeConfig | undefined> {
  const mock = getTauriMocks()?.getCancelSmokeConfig;
  if (mock) {
    return mock();
  }
  if (!isTauriRuntime()) {
    return undefined;
  }
  return invoke<CancelSmokeConfig | undefined>('get_cancel_smoke_config');
}

export async function detectFfmpeg(): Promise<boolean> {
  const mock = getTauriMocks()?.detectFfmpeg;
  if (mock) {
    return mock();
  }
  return invoke<boolean>('detect_ffmpeg');
}

export async function getFfmpegCapabilities(): Promise<FfmpegCapabilities> {
  const mock = getTauriMocks()?.getFfmpegCapabilities;
  if (mock) {
    return mock();
  }
  return invoke<FfmpegCapabilities>('get_ffmpeg_capabilities');
}

export async function getAvailableMemoryBytes(): Promise<number> {
  const mock = getTauriMocks()?.getAvailableMemoryBytes;
  if (mock) {
    return mock();
  }
  return invoke<number>('get_available_memory_bytes');
}

export async function getSystemResourceSnapshot(): Promise<SystemResourceSnapshot> {
  const mock = getTauriMocks()?.getSystemResourceSnapshot;
  if (mock) {
    return mock();
  }
  return invoke<SystemResourceSnapshot>('get_system_resource_snapshot');
}

export async function runExport(plan: FfmpegExportPlan, taskId?: string): Promise<ExportResult> {
  const mock = getTauriMocks()?.runExport;
  if (mock) {
    return mock(plan, taskId);
  }
  return invoke<ExportResult>('run_export', taskId ? { plan, taskId } : { plan });
}

export async function runExportPreviewSamples(request: ExportPreviewSamplesRequest): Promise<ExportPreviewSamplesResult> {
  const mock = getTauriMocks()?.runExportPreviewSamples;
  if (mock) {
    return mock(request);
  }
  return invoke<ExportPreviewSamplesResult>('run_export_preview_samples', { request });
}

export async function createSharePackageZip(request: SharePackageRequest): Promise<SharePackageResult> {
  const mock = getTauriMocks()?.createSharePackage;
  if (mock) {
    return mock(request);
  }
  return invoke<SharePackageResult>('create_share_package', { request });
}

export async function createSharedLibraryArchive(request: SharedLibraryArchiveRequest): Promise<SharedLibraryArchiveResult> {
  const mock = getTauriMocks()?.createSharedLibraryArchive;
  if (mock) {
    return mock(request);
  }
  return invoke<SharedLibraryArchiveResult>('create_shared_library_archive', { request });
}

export async function importSharedLibraryArchive(request: SharedLibraryImportRequest): Promise<SharedLibraryImportResult> {
  const mock = getTauriMocks()?.importSharedLibraryArchive;
  if (mock) {
    return mock(request);
  }
  return invoke<SharedLibraryImportResult>('import_shared_library_archive', { request });
}

export async function putWebdavProject(request: WebdavProjectBackupRequest): Promise<WebdavProjectBackupResult> {
  const mock = getTauriMocks()?.putWebdavProject;
  if (mock) {
    return mock(request);
  }
  return invoke<WebdavProjectBackupResult>('put_webdav_project', { request });
}

export async function putWebdavExportFile(request: WebdavExportUploadRequest): Promise<WebdavExportUploadResult> {
  const mock = getTauriMocks()?.putWebdavExportFile;
  if (mock) {
    return mock(request);
  }
  return invoke<WebdavExportUploadResult>('put_webdav_export_file', { request });
}

export async function getWebdavText(request: WebdavTextRequest): Promise<WebdavTextResult> {
  const mock = getTauriMocks()?.getWebdavText;
  if (mock) {
    return mock(request);
  }
  return invoke<WebdavTextResult>('get_webdav_text', { request });
}

export async function putWebdavText(request: WebdavTextPutRequest): Promise<{ status: number }> {
  const mock = getTauriMocks()?.putWebdavText;
  if (mock) {
    return mock(request);
  }
  return invoke<{ status: number }>('put_webdav_text', { request });
}

export async function readWebdavPassword(): Promise<string | undefined> {
  const mock = getTauriMocks()?.readWebdavPassword;
  if (mock) {
    return mock();
  }
  return invoke<string | undefined>('read_webdav_password');
}

export async function writeWebdavPassword(password?: string): Promise<void> {
  const mock = getTauriMocks()?.writeWebdavPassword;
  if (mock) {
    await mock(password);
    return;
  }
  await invoke('write_webdav_password', { password });
}

export async function readExportUploadWebdavPassword(): Promise<string | undefined> {
  const mock = getTauriMocks()?.readExportUploadWebdavPassword;
  if (mock) {
    return mock();
  }
  return invoke<string | undefined>('read_export_upload_webdav_password');
}

export async function writeExportUploadWebdavPassword(password?: string): Promise<void> {
  const mock = getTauriMocks()?.writeExportUploadWebdavPassword;
  if (mock) {
    await mock(password);
    return;
  }
  await invoke('write_export_upload_webdav_password', { password });
}

export async function readExportPresetSyncWebdavPassword(): Promise<string | undefined> {
  const mock = getTauriMocks()?.readExportPresetSyncWebdavPassword;
  if (mock) {
    return mock();
  }
  return invoke<string | undefined>('read_export_preset_sync_webdav_password');
}

export async function writeExportPresetSyncWebdavPassword(password?: string): Promise<void> {
  const mock = getTauriMocks()?.writeExportPresetSyncWebdavPassword;
  if (mock) {
    await mock(password);
    return;
  }
  await invoke('write_export_preset_sync_webdav_password', { password });
}

export async function readTranslationApiKey(provider: TranslationApiProvider): Promise<string | undefined> {
  const mock = getTauriMocks()?.readTranslationApiKey;
  if (mock) {
    return mock(provider);
  }
  if (!isTauriRuntime()) {
    return undefined;
  }
  return invoke<string | undefined>('read_translation_api_key', { provider });
}

export async function writeTranslationApiKey(provider: TranslationApiProvider, apiKey?: string): Promise<void> {
  const mock = getTauriMocks()?.writeTranslationApiKey;
  if (mock) {
    await mock(provider, apiKey);
    return;
  }
  if (!isTauriRuntime()) {
    throw new Error('Translation API Key storage requires the Tauri runtime.');
  }
  await invoke('write_translation_api_key', { provider, key: apiKey });
}

export async function analyzeClip(request: AnalyzeClipRequest): Promise<AnalyzeClipResult> {
  const mock = getTauriMocks()?.analyzeClip;
  if (mock) {
    return mock(request);
  }
  return invoke<AnalyzeClipResult>('analyze_clip', { request });
}

export async function analyzeMotionTrack(request: AnalyzeMotionTrackRequest): Promise<AnalyzeMotionTrackResult> {
  const mock = getTauriMocks()?.analyzeMotionTrack;
  if (mock) {
    return mock(request);
  }
  return invoke<AnalyzeMotionTrackResult>('analyze_motion_track', { request });
}

export async function evaluateExportQuality(request: QualityEvaluationRequest): Promise<QualityEvaluationResult> {
  const mock = getTauriMocks()?.evaluateExportQuality;
  if (mock) {
    return mock(request);
  }
  return invoke<QualityEvaluationResult>('evaluate_export_quality', { request });
}

export async function runPostExportQualityAssurance(request: PostExportQualityAssuranceRequest): Promise<PostExportQualityAssuranceResult> {
  const mock = getTauriMocks()?.runPostExportQualityAssurance;
  if (mock) {
    return mock(request);
  }
  return invoke<PostExportQualityAssuranceResult>('run_post_export_quality_assurance', { request });
}

export async function exportMediaGif(request: GifExportRequest): Promise<GifWorkflowResult> {
  const mock = getTauriMocks()?.exportMediaGif;
  if (mock) {
    return mock(request);
  }
  return invoke<GifWorkflowResult>('export_media_gif', { request });
}

export async function generateGifPreview(request: GifPreviewRequest): Promise<GifWorkflowResult> {
  const mock = getTauriMocks()?.generateGifPreview;
  if (mock) {
    return mock(request);
  }
  return invoke<GifWorkflowResult>('generate_gif_preview', { request });
}

export async function cancelExport(taskId?: string): Promise<void> {
  const mock = getTauriMocks()?.cancelExport;
  if (mock) {
    await mock(taskId);
    return;
  }
  await invoke('cancel_export', taskId ? { taskId } : {});
}

export async function cancelMotionTracking(clipId: string): Promise<void> {
  const mock = getTauriMocks()?.cancelMotionTracking;
  if (mock) {
    await mock(clipId);
    return;
  }
  await invoke('cancel_motion_tracking', { clipId });
}

export async function cancelQualityEvaluation(taskId: string): Promise<void> {
  const mock = getTauriMocks()?.cancelQualityEvaluation;
  if (mock) {
    await mock(taskId);
    return;
  }
  await invoke('cancel_quality_evaluation', { taskId });
}

export async function batchTranscodeMedia(request: BatchTranscodeRequest): Promise<BatchTranscodeResponse> {
  const mock = getTauriMocks()?.batchTranscodeMedia;
  if (mock) {
    return mock(request);
  }
  return invoke<BatchTranscodeResponse>('batch_transcode_media', { request });
}

export async function cancelBatchTranscodeTask(taskId: string): Promise<void> {
  const mock = getTauriMocks()?.cancelBatchTranscodeTask;
  if (mock) {
    await mock(taskId);
    return;
  }
  await invoke('cancel_batch_transcode_task', { taskId });
}

export async function getCacheDir(): Promise<string> {
  const mock = getTauriMocks()?.getCacheDir;
  if (mock) {
    return mock();
  }
  return invoke<string>('get_cache_dir');
}

export async function readCache(path: string): Promise<string | null> {
  const mock = getTauriMocks()?.readCache;
  if (mock) {
    return mock(path);
  }
  return invoke<string | null>('read_cache', { path });
}

export async function writeCache(path: string, contents: string): Promise<void> {
  const mock = getTauriMocks()?.writeCache;
  if (mock) {
    await mock(path, contents);
    return;
  }
  await invoke('write_cache', { path, contents });
}

export async function removeCacheFile(path: string): Promise<void> {
  const mock = getTauriMocks()?.removeCacheFile;
  if (mock) {
    await mock(path);
    return;
  }
  await invoke('remove_cache_file', { path });
}

export async function clearCache(): Promise<void> {
  const mock = getTauriMocks()?.clearCache;
  if (mock) {
    await mock();
    return;
  }
  await invoke('clear_cache');
}

export async function getCacheSize(): Promise<number> {
  const mock = getTauriMocks()?.getCacheSize;
  if (mock) {
    return mock();
  }
  return invoke<number>('get_cache_size');
}

export async function openPath(path: string): Promise<void> {
  const mock = getTauriMocks()?.openPath;
  if (mock) {
    await mock(path);
    return;
  }
  if (isTauriRuntime()) {
    await openShellPath(path);
  }
}

export async function forceCloseWindow(): Promise<void> {
  const mock = getTauriMocks()?.forceCloseWindow;
  if (mock) {
    await mock();
    return;
  }
  if (isTauriRuntime()) {
    await invoke('force_close_window');
  } else {
    window.close();
  }
}

export async function openPreviewWindow(request: PreviewWindowRequest): Promise<PreviewWindowState> {
  const mock = getTauriMocks()?.openPreviewWindow;
  if (mock) {
    return mock(request);
  }
  if (!isTauriRuntime()) {
    return { open: true, label: 'preview', bounds: request.bounds, alwaysOnTop: request.alwaysOnTop, fullscreen: false, resolutionScale: request.resolutionScale };
  }
  return invoke<PreviewWindowState>('open_preview_window', { request });
}

export async function closePreviewWindow(): Promise<PreviewWindowState> {
  const mock = getTauriMocks()?.closePreviewWindow;
  if (mock) {
    return mock();
  }
  if (!isTauriRuntime()) {
    return { open: false, label: 'preview', alwaysOnTop: false, fullscreen: false, resolutionScale: 1 };
  }
  return invoke<PreviewWindowState>('close_preview_window');
}

export async function getPreviewWindowState(): Promise<PreviewWindowState> {
  const mock = getTauriMocks()?.getPreviewWindowState;
  if (mock) {
    return mock();
  }
  if (!isTauriRuntime()) {
    return { open: false, label: 'preview', alwaysOnTop: false, fullscreen: false, resolutionScale: 1 };
  }
  return invoke<PreviewWindowState>('get_preview_window_state');
}

export async function setPreviewWindowAlwaysOnTop(alwaysOnTop: boolean): Promise<PreviewWindowState> {
  const mock = getTauriMocks()?.setPreviewWindowAlwaysOnTop;
  if (mock) {
    return mock(alwaysOnTop);
  }
  if (!isTauriRuntime()) {
    return { open: true, label: 'preview', alwaysOnTop, fullscreen: false, resolutionScale: 1 };
  }
  return invoke<PreviewWindowState>('set_preview_window_always_on_top', { alwaysOnTop });
}

export async function setPreviewWindowFullscreen(fullscreen: boolean): Promise<PreviewWindowState> {
  const mock = getTauriMocks()?.setPreviewWindowFullscreen;
  if (mock) {
    return mock(fullscreen);
  }
  if (!isTauriRuntime()) {
    return { open: true, label: 'preview', alwaysOnTop: false, fullscreen, resolutionScale: 1 };
  }
  return invoke<PreviewWindowState>('set_preview_window_fullscreen', { fullscreen });
}

export async function setPreviewWindowResolutionScale(resolutionScale: PreviewWindowResolutionScale): Promise<PreviewWindowState> {
  const mock = getTauriMocks()?.setPreviewWindowResolutionScale;
  if (mock) {
    return mock(resolutionScale);
  }
  if (!isTauriRuntime()) {
    return { open: true, label: 'preview', alwaysOnTop: false, fullscreen: false, resolutionScale };
  }
  return invoke<PreviewWindowState>('set_preview_window_resolution_scale', { resolutionScale });
}

export async function minimizeToTray(): Promise<void> {
  const mock = getTauriMocks()?.minimizeToTray;
  const labels = zhCN.exportDialog.trayMenu;
  if (mock) {
    await mock(labels);
    return;
  }
  if (isTauriRuntime()) {
    await invoke('minimize_to_tray', { labels });
  }
}

export async function showMainWindow(): Promise<void> {
  const mock = getTauriMocks()?.showMainWindow;
  if (mock) {
    await mock();
    return;
  }
  if (isTauriRuntime()) {
    await invoke('show_main_window');
  }
}

export async function updateExportTrayProgress(progress: number, runningCount: number): Promise<void> {
  const mock = getTauriMocks()?.updateExportTrayProgress;
  if (mock) {
    await mock(progress, runningCount);
    return;
  }
  if (isTauriRuntime()) {
    await invoke('update_export_tray_progress', { progress, runningCount });
  }
}

export async function runExportPowerAction(action: 'shutdown' | 'hibernate', allowPowerActions: boolean): Promise<void> {
  const mock = getTauriMocks()?.runExportPowerAction;
  if (mock) {
    await mock(action, allowPowerActions);
    return;
  }
  if (isTauriRuntime()) {
    await invoke('run_export_power_action', { action, allowPowerActions });
  }
}

export async function listenBridge<T>(event: string, handler: (payload: T) => void): Promise<() => void> {
  const mock = getTauriMocks()?.listen;
  if (mock) {
    return mock(event, handler);
  }
  if (!isTauriRuntime()) {
    return () => undefined;
  }
  return listen<T>(event, (payload) => handler(payload.payload));
}

export async function emitBridge<T>(event: string, payload: T): Promise<void> {
  const mock = getTauriMocks()?.emit;
  if (mock) {
    await mock(event, payload);
    return;
  }
  if (isTauriRuntime()) {
    await emit(event, payload);
  }
}

export async function listenBatchTranscodeProgress(handler: (payload: BatchTranscodeProgressEvent) => void): Promise<() => void> {
  return listenBridge<BatchTranscodeProgressEvent>('batch-transcode-progress', handler);
}

export async function listenCoverFrameProgress(handler: (payload: CoverFrameProgressEvent) => void): Promise<() => void> {
  return listenBridge<CoverFrameProgressEvent>('cover-frame-progress', handler);
}

export async function listenDragDrop(handler: (event: { type: string; paths?: string[] }) => void): Promise<() => void> {
  if (!isTauriRuntime()) {
    return () => undefined;
  }
  return getCurrentWindow().onDragDropEvent((event) => {
    const payload = event.payload as { type: string; paths?: string[] };
    if (payload.type === 'drop' && payload.paths?.length) {
      void authorizePaths(payload.paths)
        .then(() => handler(payload))
        .catch((error) => {
          console.warn(zhCN.errors.droppedPathsNotAuthorized, error);
          handler({ type: payload.type, paths: [] });
        });
      return;
    }
    handler(payload);
  });
}
