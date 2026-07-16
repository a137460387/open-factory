import type { DownloadEvent as TauriUpdateDownloadEvent } from '@tauri-apps/plugin-updater';
import type {
  ExportPreviewSamplePlan,
  ExportReport,
  MotionTrackPoint,
} from '@open-factory/editor-core';

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

export interface SpatialAudioAssets {
  hrtfPath: string;
  roomImpulseResponses: Record<'small-room' | 'hall' | 'outdoor', string>;
  copied: boolean;
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

export interface SmtpEmailRequest {
  host: string;
  port: number;
  username?: string;
  password?: string;
  from: string;
  to: string[];
  subject: string;
  html: string;
  secure?: boolean;
}

export interface WebhookJsonRequest {
  url: string;
  headers?: Record<string, string>;
  body: Record<string, unknown>;
  timeoutMs?: number;
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
  colorSpace?: string;
  colorTransfer?: string;
  colorPrimaries?: string;
}

export interface SystemResourceSnapshot {
  cpuUsage: number;
  totalMemoryBytes: number;
  availableMemoryBytes: number;
  usedMemoryBytes: number;
}

export type AppUpdateDownloadEvent = TauriUpdateDownloadEvent;

export interface AppUpdateCheckOptions {
  headers?: HeadersInit;
  timeout?: number;
  target?: string;
  allowDowngrades?: boolean;
}

export interface AvailableAppUpdate {
  currentVersion: string;
  version: string;
  date?: string;
  body?: string;
  rawJson: Record<string, unknown>;
  downloadAndInstall(onEvent?: (event: AppUpdateDownloadEvent) => void): Promise<void>;
  close?(): Promise<void>;
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

export interface NoiseReductionRequest {
  mediaPath: string;
  clipId: string;
  strength: number;
}

export interface NoiseReductionResult {
  outputPath: string;
  originalPath: string;
  durationMs: number;
  noiseReductionDb: number;
}

export interface NoiseReductionProgressEvent {
  clipId: string;
  progress: number;
  stage: string;
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

export interface CollaborationHostRequest {
  port: number;
  networkMode?: string;
  authToken?: string;
}

export interface CollaborationHostState {
  active: boolean;
  port: number;
}

export interface RenderPreviewCacheProgressEvent {
  projectId: string;
  progress: number;
  stage: string;
}
