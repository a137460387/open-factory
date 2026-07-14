import {
  AddKeyframeCommand,
  DEFAULT_CLIP_SPEED,
  DEFAULT_COLOR_CORRECTION,
  DEFAULT_SUBTITLE_MODE,
  DEFAULT_SUBTITLE_STYLE,
  DEFAULT_TRANSFORM,
  DEFAULT_PRIMARY_SEQUENCE_NAME,
  PRIMARY_SEQUENCE_ID,
  createProject,
  createTrack,
  createVideoFingerprint,
  type FfmpegExportPlan,
  type KeyframeProperty,
  type Clip,
  type DenoiseFilterRecommendation,
  type MediaAsset,
  type Project,
  type ProjectFileV2,
  createMulticamClip
} from '@open-factory/editor-core';
import { commandManager, timelineAccessor } from '../store/commandManager';
import { useEditorUIStore } from '../store/editorUIStore';
import { collaborationController } from '../collaboration/local-network';
import { useCollaborationStore } from '../store/collaborationStore';
import { useEditorStore } from '../store/editorStore';
import { usePrivacyDetectionSettingsStore } from '../store/privacyDetectionSettingsStore';
import { useEditorSettingsStore } from '../store/editorSettingsStore';
import { useAISettingsStore } from '../store/aiSettingsStore';
import type {
  BatchTranscodeTaskResult,
  ExportPreviewSamplesResult,
  GifExportRequest,
  GifPreviewRequest,
  PreviewWindowRequest,
  PreviewWindowResolutionScale,
  PreviewWindowState,
  SmtpEmailRequest,
  TauriMocks,
  TranslationApiProvider,
  WebhookJsonRequest,
  WebdavExportUploadRequest,
  WebdavProjectBackupRequest,
  WebdavTextPutRequest
} from '../lib/tauri-bridge';
import { clearPluginHookLog, getPluginHookLog, refreshPluginRegistry } from '../plugins/plugin-manager';
import { useExportQueueStore } from '../export/export-queue-store';
import { useMediaJobStore } from '../media/media-job-store';

const PERSISTED_FILES_KEY = 'open-factory:e2e-files';
const PERSISTED_MTIMES_KEY = 'open-factory:e2e-mtimes';
const PERSISTED_WEBDAV_TEXT_KEY = 'open-factory:e2e-webdav-text';
const files = new Map<string, string>();
const exists = new Map<string, boolean>();
const mtimes = new Map<string, number>();
const cache = new Map<string, string>();
const listeners = new Map<string, Set<(payload: unknown) => void>>();
let openFileDialogPaths: string[] = [];
let savePath = 'C:/Exports/open-factory-test.mp4';
let openDirectoryPath = 'C:/Relink';
let lastExportPlan: FfmpegExportPlan | undefined;
let exportRunCalls: Array<{ taskId?: string; fullArgs: string[]; duration: number; outputPath?: string; settings?: FfmpegExportPlan['settings'] }> = [];
let lastExportPreviewSamplesResult: ExportPreviewSamplesResult | undefined;
let exportPreviewRunCalls: Array<{ id: string; fullArgs: string[]; time: number; outputPath: string }> = [];
let lastGifExportRequest: GifExportRequest | undefined;
let lastGifPreviewRequest: GifPreviewRequest | undefined;
const canceledExportTaskIds = new Set<string>();
const canceledTranscodeTaskIds = new Set<string>();
const canceledQualityEvaluationTaskIds = new Set<string>();
let postExportQualityStatus: 'pass' | 'warning' | 'fail' = 'pass';
let exportGateHeld = false;
const exportGates: Array<{ taskId?: string; release: () => void }> = [];
let exportWarmupDelayMs = 0;
let proxyGenerationDelayMs = 10;
let nextExportError: string | undefined;
let effectPresetCommunityResponse: string | undefined;
let mockSceneTimes = [1];
let lastConfirmMessage: string | undefined;
let availableMemoryBytes = 8 * 1024 * 1024 * 1024;
let webdavPassword: string | undefined;
let exportUploadWebdavPassword: string | undefined;
let exportPresetSyncWebdavPassword: string | undefined;
const translationApiKeys = new Map<TranslationApiProvider, string>();
const aiApiKeys = new Map<string, string>();
let lastWebdavPutRequest: WebdavProjectBackupRequest | undefined;
let lastWebdavExportUploadRequest: WebdavExportUploadRequest | undefined;
let lastWebdavTextPutRequest: WebdavTextPutRequest | undefined;
let lastSmtpEmailRequest: SmtpEmailRequest | undefined;
let lastWebhookJsonRequest: WebhookJsonRequest | undefined;
const webdavTextFiles = new Map<string, string>();
let minimizedToTray = false;
let previewWindowState: PreviewWindowState = {
  open: false,
  label: 'preview',
  bounds: { width: 960, height: 540 },
  alwaysOnTop: false,
  fullscreen: false,
  resolutionScale: 1
};
let lastTrayProgress: { progress: number; runningCount: number } | undefined;
let powerActionCalls: Array<{ action: 'shutdown' | 'hibernate'; allowPowerActions: boolean }> = [];
let notifications: Array<{ title: string; body: string }> = [];
let recordingTasks = new Map<string, { outputPath: string; startedAt: number }>();
const damagedMediaPaths = new Set<string>();
let collaborationHostActive = false;
let collaborationHostPort = 37822;
let collaborationBroadcastMessages: string[] = [];

const sampleProjectPath = 'C:/Projects/sample.cutproj.json';
const missingProjectPath = 'C:/Projects/missing.cutproj.json';
const batchMissingProjectPath = 'C:/Projects/batch-missing.cutproj.json';
const tinyVideo = 'C:/Media/tiny-video.mp4';
const whisperVideo = 'C:/Media/whisper-video.mp4';
const vfrVideo = 'C:/Media/vfr-phone.mp4';
const twentyFiveFpsVideo = 'C:/Media/clip-25fps.mp4';
const fourKHevcVideo = 'C:/Media/four-k-hevc.mov';
const displayP3Video = 'C:/Media/display-p3.mov';
const tinyVideoB = 'C:/Media/camera-b.mp4';
const tinyAudio = 'C:/Media/tiny-audio.wav';
const autoSyncPrimaryAudio = 'C:/Media/auto-sync-primary.wav';
const autoSyncSecondaryAudio = 'C:/Media/auto-sync-secondary.wav';
const tinyImage = 'C:/Media/test-image.png';
const duplicateVideoA = 'C:/Media/duplicate-a.mp4';
const duplicateVideoB = 'C:/Media/duplicate-b.mp4';
const pngFrame001 = 'C:/Media/frame001.png';
const pngFrame002 = 'C:/Media/frame002.png';
const pngFrame003 = 'C:/Media/frame003.png';
const tinySrt = 'C:/Media/tiny-subtitles.srt';
const tinySubtitleCsv = 'C:/Media/tiny-subtitles.csv';
const liveSubtitleCsv = 'C:/Media/live-score.csv';
const silencePatternAudio = 'C:/Media/silence-pattern.wav';
const whisperExecutable = 'C:/Tools/whisper.exe';
const whisperModel = 'C:/Models/base.bin';
const demucsExecutable = 'C:/Tools/demucs.exe';
const privacyDetectionModel = 'C:/Models/face_detection_yunet.onnx';

function makeSceneThumb(fill: string): string {
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="9"><rect width="16" height="9" fill="${encodeURIComponent(fill)}"/></svg>`;
}
const relinkedVideo = 'C:/Relink/tiny-video.mp4';
const relinkedAudio = 'C:/Relink/tiny-audio.wav';
const relinkedImage = 'C:/Relink/test-image.png';
const appDataDir = 'C:/Users/E2E/AppData/Roaming/open-factory';
const settingsPath = `${appDataDir}/settings.json`;
const exportQueueStatePath = `${appDataDir}/export-queue-state.json`;
const exportPresetsPath = `${appDataDir}/presets.json`;
const subtitleStylesPath = `${appDataDir}/subtitle-styles.json`;
const lutLibraryPath = `${appDataDir}/luts/Warm Contrast.cube`;
const lutFavoritesPath = `${appDataDir}/lut-favorites.json`;
const keybindingsPath = `${appDataDir}/keybindings.json`;
const macrosPath = `${appDataDir}/macros.json`;
const macroHistoryPath = `${appDataDir}/macro-history.json`;
const pluginDir = `${appDataDir}/plugins`;
const pluginCatalogCachePath = `${appDataDir}/plugin-catalog-cache.json`;
const presetMarketCachePath = `${appDataDir}/market-cache/presets.json`;
const presetMarketRatingsPath = `${appDataDir}/market-cache/ratings.json`;
const effectPresetCommunityCachePath = `${appDataDir}/effect-presets/community.json`;
const pluginPath = `${pluginDir}/export-count.js`;
const permissionDeniedPluginPath = `${pluginDir}/missing-permission.js`;
const brokenPluginPath = `${pluginDir}/broken.js`;
const devPluginDir = `${pluginDir}/dev-reload`;
const devPluginManifestPath = `${devPluginDir}/plugin.json`;
const devPluginEntryPath = `${devPluginDir}/index.js`;

files.set(sampleProjectPath, JSON.stringify(makeProjectFile(tinyVideo, false), null, 2));
files.set(missingProjectPath, JSON.stringify(makeProjectFile('C:/Missing/tiny-video.mp4', true), null, 2));
files.set(batchMissingProjectPath, JSON.stringify(makeBatchMissingProjectFile(), null, 2));
files.set(
  tinySrt,
  ['1', '00:00:00,500 --> 00:00:02,000', 'Hello subtitle', '', '2', '00:00:02,500 --> 00:00:04,000', 'Second subtitle', ''].join('\n')
);
files.set(tinySubtitleCsv, ['start_time,end_time,text', '0.25,1.25,CSV subtitle A', '00:00:01.500,00:00:02.500,CSV subtitle B', '3,4,CSV subtitle C'].join('\n'));
files.set(liveSubtitleCsv, ['time,name,score,text', '0.5,Ada,12,Ada 12', '1.5,Lin,18,Lin 18'].join('\n'));
files.set(lutLibraryPath, makeWarmContrastCube());
files.set(
  pluginPath,
  [
    'module.exports = {',
    '  manifest: {',
    '    id: "e2e.export-count",',
    '    name: "E2E Export Count",',
    '    version: "1.0.0",',
    '    description: "Counts clips before export.",',
    '    permissions: ["export-hook"]',
    '  },',
    '  hooks: {',
    '    onExportBefore(payload) {',
    '      return { clipCount: payload.project.timeline.tracks.reduce((count, track) => count + track.clips.length, 0) };',
    '    }',
    '  }',
    '};'
  ].join('\n')
);
files.set(
  permissionDeniedPluginPath,
  [
    'module.exports = {',
    '  manifest: {',
    '    id: "e2e.missing-permission",',
    '    name: "E2E Missing Permission",',
    '    version: "1.0.0",',
    '    description: "Registers an export hook without permission.",',
    '    permissions: []',
    '  },',
    '  hooks: {',
    '    onExportBefore() {',
    '      return { shouldNotRun: true };',
    '    }',
    '  }',
    '};'
  ].join('\n')
);
files.set(brokenPluginPath, 'throw new Error("broken plugin");');
for (const path of [
  tinyVideo,
  whisperVideo,
  vfrVideo,
  twentyFiveFpsVideo,
  fourKHevcVideo,
  displayP3Video,
  tinyVideoB,
  tinyAudio,
  tinyImage,
  duplicateVideoA,
  duplicateVideoB,
  pngFrame001,
  pngFrame002,
  pngFrame003,
  tinySrt,
  liveSubtitleCsv,
  silencePatternAudio,
  whisperExecutable,
  whisperModel,
  demucsExecutable,
  privacyDetectionModel,
  relinkedVideo,
  relinkedAudio,
  relinkedImage,
  lutLibraryPath,
  pluginPath,
  permissionDeniedPluginPath,
  brokenPluginPath,
  sampleProjectPath,
  missingProjectPath,
  batchMissingProjectPath
]) {
  exists.set(path, true);
  mtimes.set(path, path.includes('Relink') ? 2_000 : 1_000);
}
exists.set(pluginDir, true);
exists.set('C:/Missing/tiny-video.mp4', false);
exists.set('C:/Missing/tiny-audio.wav', false);
exists.set('C:/Missing/test-image.png', false);
restorePersistedFiles();
ensureTutorialSkippedByDefault(false);

const mocks: TauriMocks = {
  confirm: (message) => {
    lastConfirmMessage = String(message);
    return true;
  },
  openFileDialog: ({ filters }) => {
    if (openFileDialogPaths.length > 0) {
      const paths = openFileDialogPaths;
      openFileDialogPaths = [];
      return paths;
    }
    const firstFilter = filters[0]?.extensions.join(',');
    if (firstFilter?.includes('cutproj')) {
      return [sampleProjectPath];
    }
    if (firstFilter?.includes('srt')) {
      return [tinySrt];
    }
    if (firstFilter?.includes('csv') || firstFilter?.includes('json')) {
      return [tinySubtitleCsv];
    }
    if (firstFilter?.includes('mp4') && !firstFilter.includes('wav') && !firstFilter.includes('png')) {
      return [tinyVideo, fourKHevcVideo];
    }
    return [tinyVideo, tinyAudio, tinyImage];
  },
  saveFileDialog: () => savePath,
  openDirectoryDialog: () => openDirectoryPath,
  readFile: (path) => {
    const value = files.get(path);
    if (value === undefined) {
      throw new Error(`Mock file not found: ${path}`);
    }
    return value;
  },
  writeFile: (path, contents) => {
    files.set(path, contents);
    exists.set(path, true);
    mtimes.set(path, Date.now());
    persistFiles();
  },
  writeBinaryFile: (path, base64Data) => {
    exists.set(path, true);
    mtimes.set(path, Date.now());
  },
  encryptProjectFile: (path, contents, password) => {
    files.set(path, `OFCUTENC1\n${password}\n${contents}`);
    exists.set(path, true);
    mtimes.set(path, Date.now());
    persistFiles();
  },
  decryptProjectFile: (path, password) => {
    const contents = files.get(path) ?? '';
    const prefix = `OFCUTENC1\n${password}\n`;
    if (!contents.startsWith(prefix)) {
      throw new Error('密码错误');
    }
    return contents.slice(prefix.length);
  },
  isEncryptedProjectFile: (path) => (files.get(path) ?? '').startsWith('OFCUTENC1\n'),
  writeClipReport: (path, html) => {
    files.set(path, html);
    exists.set(path, true);
    mtimes.set(path, Date.now());
    persistFiles();
  },
  removeFile: (path) => {
    files.delete(path);
    exists.set(path, false);
    mtimes.delete(path);
    persistFiles();
  },
  trashFile: (path) => {
    files.delete(path);
    exists.set(path, false);
    mtimes.delete(path);
    persistFiles();
  },
  copyFile: (sourcePath, destinationPath) => {
    const value = files.get(sourcePath) ?? `mock copy of ${sourcePath}`;
    files.set(destinationPath, value);
    exists.set(destinationPath, true);
    mtimes.set(destinationPath, Date.now());
    persistFiles();
  },
  moveFile: (sourcePath, destinationPath) => {
    const value = files.get(sourcePath) ?? `mock move of ${sourcePath}`;
    files.delete(sourcePath);
    files.set(destinationPath, value);
    exists.set(sourcePath, false);
    exists.set(destinationPath, true);
    mtimes.delete(sourcePath);
    mtimes.set(destinationPath, Date.now());
    persistFiles();
  },
  fsExists: (path) => {
    if (path.includes('/shared-library/index.json')) {
      return files.has(path);
    }
    return exists.get(path) ?? !path.endsWith('.autosave');
  },
  ensureSpatialAudioAssets: () => {
    const hrtfPath = `${appDataDir}/hrtf/kemar.bin`;
    const roomImpulseResponses = {
      'small-room': `${appDataDir}/hrtf/ir/small-room.wav`,
      hall: `${appDataDir}/hrtf/ir/hall.wav`,
      outdoor: `${appDataDir}/hrtf/ir/outdoor.wav`
    };
    files.set(hrtfPath, 'mock clean-room hrtf');
    exists.set(hrtfPath, true);
    Object.values(roomImpulseResponses).forEach((path) => {
      files.set(path, 'mock ir');
      exists.set(path, true);
    });
    persistFiles();
    return { hrtfPath, roomImpulseResponses, copied: true };
  },
  readColorMatchFrameSample: (path) => {
    if (path === tinyImage) {
      return solidColorSample([217, 85, 63]);
    }
    if (path === tinyVideo) {
      return solidColorSample([45, 108, 223]);
    }
    return solidColorSample([128, 128, 128]);
  },
  getAppDataDir: () => appDataDir,
  getTempSegmentsDir: async () => {
    if (exportWarmupDelayMs > 0) {
      await wait(exportWarmupDelayMs);
    }
    return 'C:/Temp/open-factory/segments';
  },
  getFileStat: (path) => ({
    path,
    size: path === silencePatternAudio ? createSilencePatternWav().byteLength : path === tinyAudio || path === relinkedAudio ? createToneWav().byteLength : path === fourKHevcVideo ? 500 * 1024 * 1024 : path.endsWith('.wav') ? 2048 : 4096,
    mtimeMs: mtimes.get(path) ?? (path.includes('Relink') ? 2_000 : 1_000)
  }),
  scanDirectory: (path) => {
    if (path.includes('/snapshots/')) {
      return Array.from(files.keys()).filter((candidate) => candidate.startsWith(`${path}/`) && exists.get(candidate) !== false);
    }
    if (Array.from(files.keys()).some((candidate) => candidate.startsWith(`${path.replace(/[\\/]+$/, '')}/`))) {
      const root = path.replace(/[\\/]+$/, '');
      return Array.from(files.keys()).filter((candidate) => candidate.startsWith(`${root}/`) && exists.get(candidate) !== false);
    }
    if (path === pluginDir) {
      return [pluginPath, permissionDeniedPluginPath, brokenPluginPath].filter((candidate) => exists.get(candidate) !== false);
    }
    if (path === appDataDir) {
      return [lutLibraryPath, `${appDataDir}/luts/readme.txt`, pluginPath, permissionDeniedPluginPath, brokenPluginPath].filter((candidate) => exists.get(candidate) !== false);
    }
    return [relinkedVideo, relinkedAudio, relinkedImage, 'C:/Relink/other.mp4'];
  },
  detectFfmpeg: () => true,
  getFfmpegCapabilities: () => ({
    available: true,
    version: 'ffmpeg mock 6.0',
    hasLibx264: true,
    hasAac: true,
    hasDrawtext: true,
    hasLibfreetype: true,
    hasMinterpolate: true,
    hasArnndn: true,
    hasLibvmaf: true,
    hardwareEncoderAvailable: true,
    hardwareEncoder: 'h264_nvenc',
    drawtextWarning: null
  }),
  getAvailableMemoryBytes: () => availableMemoryBytes,
  getSystemResourceSnapshot: () => ({
    cpuUsage: 37,
    totalMemoryBytes: 16 * 1024 * 1024 * 1024,
    availableMemoryBytes,
    usedMemoryBytes: 16 * 1024 * 1024 * 1024 - availableMemoryBytes
  }),
  runExport: async (plan, taskId) => {
    lastExportPlan = plan;
    exportRunCalls.push({ taskId, fullArgs: [...plan.fullArgs], duration: plan.duration, outputPath: plan.fullArgs.at(-1), settings: plan.settings });
    const cancelKey = exportCancelKey(taskId);
    canceledExportTaskIds.delete(cancelKey);
    emit('export-progress', taskId ? { taskId, progress: 0.2 } : 0.2);
    const outputPath = plan.fullArgs.at(-1) ?? savePath;
    if (outputPath.endsWith('.partial.mp4')) {
      files.set(outputPath, 'mock partial mp4');
      exists.set(outputPath, true);
      mtimes.set(outputPath, Date.now());
      persistFiles();
    }
    await waitForExportGate(taskId);
    if (canceledExportTaskIds.has(cancelKey)) {
      throw new Error('Export canceled.');
    }
    if (nextExportError) {
      const message = nextExportError;
      nextExportError = undefined;
      throw new Error(message);
    }
    emit('export-progress', taskId ? { taskId, progress: 1 } : 1);
    if (outputPath.includes('%')) {
      for (const frame of ['0001', '0002', '0003']) {
        const framePath = outputPath.replace(/%0?\d*d/, frame);
        files.set(framePath, `mock png frame ${frame}`);
        exists.set(framePath, true);
        mtimes.set(framePath, Date.now());
      }
    } else {
      files.set(outputPath, outputPath.endsWith('.png') || outputPath.endsWith('.jpg') || outputPath.endsWith('.jpeg') ? 'mock image frame' : 'mock mp4');
      exists.set(outputPath, true);
      mtimes.set(outputPath, Date.now());
    }
    persistFiles();
    const logPath = `${appDataDir}/export-logs/${exportCancelKey(taskId)}.log`;
    files.set(logPath, [`ffmpeg mock log`, `task=${exportCancelKey(taskId)}`, `args=${plan.fullArgs.join(' ')}`, `stderr=mock export completed`].join('\n'));
    exists.set(logPath, true);
    mtimes.set(logPath, Date.now());
    persistFiles();
    const postExportScript = buildMockPostExportScriptResult(plan);
    return {
      success: true,
      outputPath,
      durationMs: 20,
      warnings: plan.warnings,
      report: {
        ...(plan.passes?.some((pass) => pass.kind === 'loudness-analysis') ? { loudness: { integratedLoudness: -14.1 } } : {}),
        ...(postExportScript ? { postExportScript } : {})
      }
    };
  },
  runExportPreviewSamples: async ({ samples }) => {
    exportPreviewRunCalls = samples.map((sample) => ({
      id: sample.id,
      fullArgs: [...sample.plan.fullArgs],
      time: sample.time,
      outputPath: sample.outputPath
    }));
    await Promise.all(
      samples.map(async (sample, index) => {
        await wait(10);
        files.set(sample.outputPath, `mock export preview ${index}`);
        exists.set(sample.outputPath, true);
        mtimes.set(sample.outputPath, Date.now());
      })
    );
    persistFiles();
    lastExportPreviewSamplesResult = {
      samples: samples.map((sample) => ({
        id: sample.id,
        kind: sample.kind,
        label: sample.label,
        time: sample.time,
        path: sample.outputPath,
        durationMs: 10
      })),
      durationMs: 10
    };
    return lastExportPreviewSamplesResult;
  },
  generateGifPreview: async (request) => {
    lastGifPreviewRequest = request;
    const outputPath = `${appDataDir}/gif-previews/e2e-preview.gif`;
    files.set(outputPath, 'mock gif preview');
    exists.set(outputPath, true);
    mtimes.set(outputPath, Date.now());
    persistFiles();
    return {
      outputPath,
      fullArgs: buildMockGifArgs(request, outputPath, 128, 0),
      durationMs: 10
    };
  },
  exportMediaGif: async (request) => {
    lastGifExportRequest = request;
    files.set(request.outputPath, 'mock dedicated gif export');
    exists.set(request.outputPath, true);
    mtimes.set(request.outputPath, Date.now());
    persistFiles();
    return {
      outputPath: request.outputPath,
      fullArgs: buildMockGifArgs(request, request.outputPath, request.scaleWidth, request.loopCount),
      durationMs: 12
    };
  },
  createSharePackage: async (request) => {
    const entries = [
      'README.txt',
      request.projectFileName,
      request.exportedVideo.archivePath,
      ...request.mediaFiles.map((entry) => entry.archivePath)
    ];
    const total = entries.length;
    emit('share-package-progress', { stage: 'readme', progress: total > 0 ? 1 / total : 1, progressPct: total > 0 ? 100 / total : 100, current: 1, total, outputPath: request.outputPath });
    await wait(10);
    const payload = JSON.stringify({ entries, project: request.projectContents, readme: request.readmeContents });
    files.set(request.outputPath, `mock share package\n${payload}`);
    exists.set(request.outputPath, true);
    mtimes.set(request.outputPath, Date.now());
    persistFiles();
    emit('share-package-progress', { stage: 'finished', progress: 1, progressPct: 100, current: total, total, outputPath: request.outputPath });
    return { outputPath: request.outputPath, fileCount: entries.length, durationMs: 10 };
  },
  createSharedLibraryArchive: async (request) => {
    const payload = JSON.stringify({ manifest: request.manifestContents, files: request.files.map((entry) => entry.archivePath) });
    files.set(request.outputPath, `mock shared library archive\n${payload}`);
    exists.set(request.outputPath, true);
    mtimes.set(request.outputPath, Date.now());
    persistFiles();
    return { outputPath: request.outputPath, fileCount: request.files.length + 1, durationMs: 10 };
  },
  importSharedLibraryArchive: async (request) => {
    const raw = files.get(request.archivePath) ?? '';
    const payload = raw.startsWith('mock shared library archive\n') ? JSON.parse(raw.slice('mock shared library archive\n'.length)) : { manifest: '{"schemaVersion":1,"resources":[]}', files: [] };
    persistFiles();
    return { destinationDir: request.destinationDir, fileCount: 1 + (payload.files?.length ?? 0), manifestContents: String(payload.manifest ?? '{"schemaVersion":1,"resources":[]}') };
  },
  putWebdavProject: async (request) => {
    lastWebdavPutRequest = request;
    return { status: 201 };
  },
  putWebdavExportFile: async (request) => {
    lastWebdavExportUploadRequest = request;
    if (!files.has(request.sourcePath)) {
      throw new Error(`Mock export upload source not found: ${request.sourcePath}`);
    }
    return { status: 201, bytes: files.get(request.sourcePath)?.length ?? 0 };
  },
  getWebdavText: async (request) => {
    const contents = webdavTextFiles.get(request.url);
    if (contents === undefined) {
      throw new Error(`Mock WebDAV text not found: ${request.url}`);
    }
    return { status: 200, contents };
  },
  putWebdavText: async (request) => {
    lastWebdavTextPutRequest = request;
    webdavTextFiles.set(request.url, request.contents);
    persistFiles();
    return { status: 201 };
  },
  readWebdavPassword: () => webdavPassword,
  writeWebdavPassword: (password) => {
    webdavPassword = password?.trim() ? password : undefined;
  },
  readExportUploadWebdavPassword: () => exportUploadWebdavPassword,
  writeExportUploadWebdavPassword: (password) => {
    exportUploadWebdavPassword = password?.trim() ? password : undefined;
  },
  readExportPresetSyncWebdavPassword: () => exportPresetSyncWebdavPassword,
  writeExportPresetSyncWebdavPassword: (password) => {
    exportPresetSyncWebdavPassword = password?.trim() ? password : undefined;
  },
  readTranslationApiKey: (provider) => translationApiKeys.get(provider),
  writeTranslationApiKey: (provider, apiKey) => {
    const normalized = apiKey?.trim();
    if (normalized) {
      translationApiKeys.set(provider, normalized);
    } else {
      translationApiKeys.delete(provider);
    }
  },
  readSmtpPassword: () => 'mock-smtp-password',
  writeSmtpPassword: () => undefined,
  sendSmtpEmail: (request) => {
    lastSmtpEmailRequest = request;
  },
  postWebhookJson: (request) => {
    lastWebhookJsonRequest = request;
    return { status: 200 };
  },
  analyzeClip: async ({ clipId }) => {
    emit('clip-analysis-progress', { clipId, progress: 0.35, progressPct: 35 });
    await wait(10);
    emit('clip-analysis-progress', { clipId, progress: 1, progressPct: 100 });
    const trfPath = `C:/Users/E2E/AppData/Roaming/open-factory/stabilization/${clipId}.trf`;
    files.set(trfPath, 'mock vidstab transforms');
    exists.set(trfPath, true);
    mtimes.set(trfPath, Date.now());
    persistFiles();
    return { clipId, trfPath, durationMs: 10 };
  },
  analyzeMotionTrack: async ({ clipId }) => {
    emit('motion-track-progress', { clipId, progress: 0.25, progressPct: 25 });
    await wait(10);
    emit('motion-track-progress', { clipId, progress: 1, progressPct: 100 });
    return {
      clipId,
      points: [
        { time: 0, dx: 0, dy: 0 },
        { time: 0.25, dx: 0.05, dy: 0.02 },
        { time: 0.5, dx: 0.1, dy: 0.04 },
        { time: 0.75, dx: 0.15, dy: 0.06 }
      ],
      durationMs: 10
    };
  },
  evaluateExportQuality: async ({ taskId }) => {
    canceledQualityEvaluationTaskIds.delete(taskId);
    emit('quality-evaluation-progress', { taskId, progress: 0.5, progressPct: 50 });
    await wait(10);
    if (canceledQualityEvaluationTaskIds.has(taskId)) {
      throw new Error('Quality evaluation canceled.');
    }
    emit('quality-evaluation-progress', { taskId, progress: 1, progressPct: 100 });
    return { taskId, ssim: 0.9912, psnr: 41.3, vmaf: 92.4, vmafAvailable: true, durationMs: 10 };
  },
  runPostExportQualityAssurance: async (request) => ({
    status: postExportQualityStatus,
    completedAt: new Date().toISOString(),
    retryRecommended: postExportQualityStatus === 'fail' && request.autoRetry,
    checks: [
      ...(request.duration ? [{ id: 'duration' as const, status: postExportQualityStatus === 'fail' ? 'fail' as const : 'pass' as const, message: postExportQualityStatus === 'fail' ? '导出时长误差超过 1 帧' : '导出时长在 1 帧误差内', expected: request.expectedDuration, actual: request.expectedDuration }] : []),
      ...(request.blackFrames ? [{ id: 'blackFrames' as const, status: postExportQualityStatus === 'warning' ? 'warning' as const : 'pass' as const, message: postExportQualityStatus === 'warning' ? '检测到意外黑帧 1 段' : '未检测到意外黑帧', actual: postExportQualityStatus === 'warning' ? 1 : 0 }] : []),
      ...(request.silence ? [{ id: 'silence' as const, status: 'pass' as const, message: '未检测到意外静音', actual: 0 }] : []),
      ...(request.fileSize ? [{ id: 'fileSize' as const, status: 'pass' as const, message: '导出文件大小在预期范围内', actual: files.get(request.outputPath)?.length ?? 4096 }] : []),
      ...(request.resolution ? [{ id: 'resolution' as const, status: 'pass' as const, message: '输出分辨率与预设一致', expected: `${request.expectedWidth}x${request.expectedHeight}`, actual: `${request.expectedWidth}x${request.expectedHeight}` }] : [])
    ]
  }),
  cancelMotionTracking: () => undefined,
  cancelQualityEvaluation: (taskId) => {
    canceledQualityEvaluationTaskIds.add(taskId);
  },
  cancelExport: (taskId) => {
    canceledExportTaskIds.add(exportCancelKey(taskId));
    releaseExportGateForTask(taskId);
  },
  batchTranscodeMedia: async ({ tasks, preset }) => {
    const results: BatchTranscodeTaskResult[] = [];
    for (const task of tasks) {
      emit('batch-transcode-progress', { taskId: task.taskId, sourcePath: task.sourcePath, status: 'running', progress: 0.25, progressPct: 25, current: results.length + 1, total: tasks.length });
      await wait(10);
      if (canceledTranscodeTaskIds.has(task.taskId)) {
        emit('batch-transcode-progress', { taskId: task.taskId, sourcePath: task.sourcePath, status: 'canceled', progress: 0, progressPct: 0, current: results.length + 1, total: tasks.length });
        results.push({ taskId: task.taskId, sourcePath: task.sourcePath, status: 'canceled', durationMs: 10 });
        continue;
      }
      const outputPath = `${appDataDir}/transcodes/${fileStem(task.sourcePath)}-${preset}.${preset === 'prores-proxy' ? 'mov' : 'mp4'}`;
      files.set(outputPath, `mock transcode ${preset} from ${task.sourcePath}`);
      exists.set(outputPath, true);
      mtimes.set(outputPath, Date.now());
      persistFiles();
      emit('batch-transcode-progress', { taskId: task.taskId, sourcePath: task.sourcePath, outputPath, status: 'completed', progress: 1, progressPct: 100, current: results.length + 1, total: tasks.length });
      results.push({ taskId: task.taskId, sourcePath: task.sourcePath, outputPath, status: 'completed', durationMs: 10 });
    }
    return { results };
  },
  cancelBatchTranscodeTask: (taskId) => {
    canceledTranscodeTaskIds.add(taskId);
  },
  getCacheDir: () => 'C:/Cache/open-factory',
  readCache: (path) => cache.get(path) ?? null,
  writeCache: (path, contents) => {
    cache.set(path, contents);
  },
  removeCacheFile: (path) => {
    cache.delete(path);
  },
  clearCache: () => {
    cache.clear();
  },
  getCacheSize: () => Array.from(cache.values()).reduce((total, value) => total + value.length, 0),
  openPath: () => undefined,
  forceCloseWindow: () => undefined,
  openPreviewWindow: (request: PreviewWindowRequest) => {
    previewWindowState = {
      open: true,
      label: 'preview',
      bounds: request.bounds,
      alwaysOnTop: request.alwaysOnTop,
      fullscreen: false,
      resolutionScale: request.resolutionScale
    };
    return previewWindowState;
  },
  closePreviewWindow: () => {
    previewWindowState = { ...previewWindowState, open: false };
    emit('preview-window-closed', previewWindowState);
    return previewWindowState;
  },
  getPreviewWindowState: () => previewWindowState,
  setPreviewWindowAlwaysOnTop: (alwaysOnTop: boolean) => {
    previewWindowState = { ...previewWindowState, alwaysOnTop };
    return previewWindowState;
  },
  setPreviewWindowFullscreen: (fullscreen: boolean) => {
    previewWindowState = { ...previewWindowState, fullscreen };
    return previewWindowState;
  },
  setPreviewWindowResolutionScale: (resolutionScale: PreviewWindowResolutionScale) => {
    previewWindowState = { ...previewWindowState, resolutionScale };
    return previewWindowState;
  },
  minimizeToTray: () => {
    minimizedToTray = true;
  },
  showMainWindow: () => {
    minimizedToTray = false;
  },
  updateExportTrayProgress: (progress, runningCount) => {
    lastTrayProgress = { progress, runningCount };
  },
  runExportPowerAction: (action, allowPowerActions) => {
    powerActionCalls.push({ action, allowPowerActions });
  },
  sendNotification: (title, body) => {
    notifications.push({ title, body });
  },
  probeMedia: (path) => {
    const isVfr = path === vfrVideo;
    const is25Fps = path === twentyFiveFpsVideo;
    const isDisplayP3 = path === displayP3Video;
    return {
      hasAudio: path.endsWith('.mp4') || path.endsWith('.wav'),
      audioChannels: path.endsWith('.mp4') || path.endsWith('.wav') ? 2 : undefined,
      audioSampleRate: path.endsWith('.mp4') || path.endsWith('.wav') ? 44_100 : undefined,
      audioCodec: path.endsWith('.mp4') ? 'aac' : path.endsWith('.wav') ? 'pcm_s16le' : undefined,
      videoCodec: path === fourKHevcVideo ? 'hevc' : path.endsWith('.mp4') || path.endsWith('.mov') ? 'h264' : undefined,
      frameRate: isVfr ? 23.976 : is25Fps ? 25 : path.endsWith('.mp4') || path.endsWith('.mov') ? 30 : undefined,
      avgFrameRate: isVfr ? '24000/1001' : is25Fps ? '25/1' : path.endsWith('.mp4') || path.endsWith('.mov') ? '30/1' : undefined,
      realFrameRate: isVfr ? '30/1' : is25Fps ? '25/1' : path.endsWith('.mp4') || path.endsWith('.mov') ? '30/1' : undefined,
      variableFrameRate: isVfr,
      fieldOrder: path.endsWith('.mp4') || path.endsWith('.mov') ? 'tt' : undefined,
      colorSpace: path === fourKHevcVideo ? 'bt2020nc' : path.endsWith('.mp4') || path.endsWith('.mov') ? 'bt709' : undefined,
      colorTransfer: path === fourKHevcVideo ? 'smpte2084' : isDisplayP3 ? 'iec61966-2-1' : path.endsWith('.mp4') || path.endsWith('.mov') ? 'bt709' : undefined,
      colorPrimaries: path === fourKHevcVideo ? 'bt2020' : isDisplayP3 ? 'smpte432' : path.endsWith('.mp4') || path.endsWith('.mov') ? 'bt709' : undefined
    };
  },
  analyzeMedia: (path) => ({
    path,
    fileSize: path === fourKHevcVideo ? 500 * 1024 * 1024 : 4096,
    createdTimeMs: 1_700_000_000_000,
    format: {
      formatName: path.endsWith('.wav') ? 'wav' : 'mov,mp4,m4a,3gp,3g2,mj2',
      formatLongName: path.endsWith('.wav') ? 'WAV / WAVE' : 'QuickTime / MOV',
      duration: 6,
      bitRate: path === fourKHevcVideo ? 42_000_000 : 2_400_000,
      size: path === fourKHevcVideo ? 500 * 1024 * 1024 : 4096
    },
    videoStreams: path.endsWith('.wav')
      ? []
      : [
          {
            index: 0,
            codecName: path === fourKHevcVideo ? 'hevc' : 'h264',
            codecLongName: path === fourKHevcVideo ? 'H.265 / HEVC' : 'H.264 / AVC',
            duration: path === tinyVideo ? 6 : 6,
            width: path === fourKHevcVideo ? 3840 : 1280,
            height: path === fourKHevcVideo ? 2160 : 720,
            frameRate: 30,
            bitRate: path === fourKHevcVideo ? 42_000_000 : 2_200_000,
            colorSpace: path === fourKHevcVideo ? 'bt2020nc' : 'bt709',
            colorTransfer: path === fourKHevcVideo ? 'smpte2084' : 'bt709',
            colorPrimaries: path === fourKHevcVideo ? 'bt2020' : 'bt709',
            pixelFormat: path === fourKHevcVideo ? 'yuv420p10le' : 'yuv420p',
            fieldOrder: 'tt',
            hdrMetadata: path === fourKHevcVideo ? ['Mastering display metadata'] : []
          }
        ],
    audioStreams: path.endsWith('.png')
      ? []
      : [
          {
            index: path.endsWith('.wav') ? 0 : 1,
            codecName: path.endsWith('.wav') ? 'pcm_s16le' : 'aac',
            codecLongName: path.endsWith('.wav') ? 'PCM signed 16-bit little-endian' : 'AAC',
            duration: path === tinyVideo ? 6 : 6,
            sampleRate: 44_100,
            channels: 2,
            channelLayout: 'stereo',
            bitRate: path.endsWith('.wav') ? 1_411_200 : 192_000,
            integratedLufs: -18.4
          }
        ],
    bitratePoints: [
      { time: 0, bitRate: 2_000_000 },
      { time: 1, bitRate: 2_400_000 },
      { time: 2, bitRate: 1_900_000 }
    ],
    loudnessError: undefined
  }),
  scanMediaIntegrity: (path) => {
    if (damagedMediaPaths.has(path)) {
      return {
        path,
        ok: false,
        errorOutput: 'Invalid data found when processing input'
      };
    }
    return { path, ok: true };
  },
  analyzeAudioSpectrum: (path) => ({
    path,
    spectrogramPath: 'C:/Users/E2E/AppData/Roaming/open-factory/spectrum/mock-spectrum.png',
    stats: {
      integratedLufs: -18.4,
      dynamicRangeLu: 7.2,
      truePeakDbfs: -1.3,
      peakDb: -0.9,
      rmsDb: -20.6
    }
  }),
  generateGapFillMedia: (request) => {
    const suffix = request.kind === 'freeze-frame' ? 'freeze' : request.color === '#ffffff' ? 'white' : 'black';
    const path = `${appDataDir}/gap-fill/e2e-${suffix}-${Date.now()}.png`;
    files.set(path, `mock ${request.kind} gap fill`);
    exists.set(path, true);
    mtimes.set(path, Date.now());
    persistFiles();
    return {
      path,
      name: `e2e-${suffix}.png`,
      width: request.width,
      height: request.height
    };
  },
  extractCoverFrames: (request) => {
    const frames = Array.from({ length: request.count ?? 6 }, (_item, index) => {
      const path = `${request.outputDir}/${request.outputStem}-${String(index + 1).padStart(3, '0')}.png`;
      files.set(path, `mock cover frame ${index + 1}`);
      exists.set(path, true);
      mtimes.set(path, Date.now());
      emit('cover-frame-progress', {
        taskId: request.clipId,
        status: index + 1 === (request.count ?? 6) ? 'completed' : 'running',
        current: index + 1,
        total: request.count ?? 6,
        progress: (index + 1) / (request.count ?? 6),
        progressPct: Math.round(((index + 1) / (request.count ?? 6)) * 100),
        outputPath: path
      });
      return {
        index,
        path,
        timestamp: request.timestamps?.[index]
      };
    });
    persistFiles();
    return { clipId: request.clipId, frames };
  },
  batchExtractCoverFrames: (request) => {
    const results = request.tasks.map((task, index) => {
      const path = `${request.outputDir}/${task.outputFileName}`;
      files.set(path, `mock batch cover ${task.assetId}`);
      exists.set(path, true);
      mtimes.set(path, Date.now());
      emit('cover-frame-progress', {
        taskId: task.assetId,
        status: 'completed',
        current: index + 1,
        total: request.tasks.length,
        progress: (index + 1) / Math.max(1, request.tasks.length),
        progressPct: Math.round(((index + 1) / Math.max(1, request.tasks.length)) * 100),
        outputPath: path
      });
      return { assetId: task.assetId, sourcePath: task.sourcePath, outputPath: path, status: 'completed' as const };
    });
    persistFiles();
    return { results };
  },
  analyzeWaveform: (path, samplesPerSec) => {
    if (path === autoSyncPrimaryAudio || path === autoSyncSecondaryAudio) {
      return makeAutoSyncWaveform(path, samplesPerSec);
    }
    const total = Math.max(1, Math.ceil(6 * Math.max(1, samplesPerSec)));
    return Array.from({ length: total }, (_, index) => {
      const time = index / Math.max(1, samplesPerSec);
      if (path === whisperVideo) {
        return Math.abs(time - 0.2) <= 0.025 || Math.abs(time - 1.55) <= 0.025 ? 0.9 : 0.01;
      }
      return path === tinyVideo && time >= 1 && time < 2.25 ? 0.8 : 0.01;
    });
  },
  detectBeats: () => [1, 2, 3, 4],
  generateProxy: async (plan) => {
    await wait(proxyGenerationDelayMs);
    files.set(plan.outputPath, 'mock proxy');
    exists.set(plan.outputPath, true);
    cache.set(plan.outputPath.replace(`${appDataDir}/`, ''), JSON.stringify({ proxyPath: plan.outputPath }));
    return { assetId: plan.assetId, proxyPath: plan.outputPath, durationMs: 10 };
  },
  detectSceneChanges: async (request) => {
    const frameRate = request.frameRate ?? 30;
    const totalFrames = request.duration ? Math.ceil(request.duration * frameRate) : undefined;
    emit('scene-detect-progress', { progress: 0.35, ptsTime: request.duration ? request.duration * 0.35 : undefined, analyzedFrames: totalFrames ? Math.round(totalFrames * 0.35) : undefined, totalFrames });
    await wait(10);
    emit('scene-detect-progress', { progress: 1, ptsTime: request.duration, analyzedFrames: totalFrames, totalFrames });
    return { sceneTimes: mockSceneTimes, limited: false, analyzedDuration: request.duration ?? 0 };
  },
  cancelSceneDetection: () => undefined,
  runWhisper: async ({ clipId }) => {
    emit('whisper-progress', { clipId, progress: 0.35, progressPct: 35 });
    await wait(10);
    emit('whisper-progress', { clipId, progress: 1, progressPct: 100 });
    const srtPath = `C:/Users/E2E/AppData/Roaming/open-factory/whisper/${clipId}.srt`;
    const contents = ['1', '00:00:00,000 --> 00:00:01,200', 'First generated caption', '', '2', '00:00:01,400 --> 00:00:02,400', 'Second generated caption', ''].join('\n');
    files.set(srtPath, contents);
    exists.set(srtPath, true);
    mtimes.set(srtPath, Date.now());
    persistFiles();
    return { srtPath, contents, durationMs: 10 };
  },
  runDemucs: async ({ clipId }) => {
    emit('demucs-progress', { clipId, progress: 0.35, progressPct: 35 });
    await wait(10);
    emit('demucs-progress', { clipId, progress: 1, progressPct: 100 });
    const outputDir = `C:/Users/E2E/AppData/Roaming/open-factory/demucs/${clipId}`;
    const vocalsPath = `${outputDir}/vocals.wav`;
    const accompanimentPath = `${outputDir}/no_vocals.wav`;
    files.set(vocalsPath, 'mock vocals');
    files.set(accompanimentPath, 'mock accompaniment');
    exists.set(vocalsPath, true);
    exists.set(accompanimentPath, true);
    mtimes.set(vocalsPath, Date.now());
    mtimes.set(accompanimentPath, Date.now());
    persistFiles();
    return { vocalsPath, accompanimentPath, outputDir, durationMs: 10 };
  },
  cancelDemucs: () => undefined,
  processAudioNoiseReduction: async ({ mediaPath, clipId }) => {
    emit('noise-reduction-progress', { clipId, progress: 0.1, stage: 'decoding' });
    await wait(50);
    emit('noise-reduction-progress', { clipId, progress: 0.5, stage: 'processing' });
    await wait(50);
    emit('noise-reduction-progress', { clipId, progress: 1.0, stage: 'complete' });
    const outputPath = mediaPath.replace(/(\.[^.]+)$/, '-denoised$1');
    return { outputPath, originalPath: mediaPath, durationMs: 15, noiseReductionDb: 6.5 };
  },
  cancelAudioNoiseReduction: () => undefined,
  detectPrivacyRegions: async ({ clipId }) => {
    await wait(10);
    return {
      clipId,
      boxes: [
        { time: 0, x: 0.18, y: 0.22, w: 0.22, h: 0.24, label: 'face', confidence: 0.92 },
        { time: 0.5, x: 0.24, y: 0.25, w: 0.2, h: 0.22, label: 'face', confidence: 0.9 }
      ],
      durationMs: 10
    };
  },
  startRecording: ({ taskId, source }) => {
    const outputPath = `${appDataDir}/recordings/${source}-${taskId}.mp4`;
    recordingTasks.set(taskId, { outputPath, startedAt: Date.now() });
    return { taskId, outputPath };
  },
  stopRecording: (taskId) => {
    const task = recordingTasks.get(taskId);
    if (!task) {
      throw new Error('Recording task not found');
    }
    recordingTasks.delete(taskId);
    files.set(task.outputPath, 'mock recording');
    exists.set(task.outputPath, true);
    mtimes.set(task.outputPath, Date.now());
    persistFiles();
    return { taskId, outputPath: task.outputPath, durationMs: Date.now() - task.startedAt };
  },
  startCollaborationHost: ({ port }) => {
    collaborationHostActive = true;
    collaborationHostPort = port || 37822;
    return { active: true, port: collaborationHostPort };
  },
  stopCollaborationHost: () => {
    collaborationHostActive = false;
  },
  broadcastCollaborationMessage: (message) => {
    collaborationBroadcastMessages.push(message);
    emit('collaboration-message', message);
  },
  probeMediaPath: (path) => {
    const base = {
      duration: path === silencePatternAudio ? 2.5 : path.endsWith('.png') ? 0 : 6,
      width: path.endsWith('.wav') ? 0 : path === fourKHevcVideo ? 3840 : 1280,
      height: path.endsWith('.wav') ? 0 : path === fourKHevcVideo ? 2160 : 720,
      thumbnail: 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AA/vuUAAA='
    };
    return base;
  },
  listen: (event, handler) => {
    const set = listeners.get(event) ?? new Set();
    set.add(handler as (payload: unknown) => void);
    listeners.set(event, set);
    return () => set.delete(handler as (payload: unknown) => void);
  },
  callAiApi: async (request) => {
    await new Promise(r => setTimeout(r, 100));
    const systemContent = typeof request.messages[0]?.content === 'string' ? request.messages[0].content : '';
    if (systemContent.includes('字幕编辑助手')) {
      return {
        content: JSON.stringify([
          { index: 0, text: '你好，世界。' },
          { index: 1, text: '今天天气真好。' },
          { index: 2, text: '我们去散步吧。' }
        ]),
        inputTokens: 100,
        outputTokens: 50,
        latencyMs: 10
      };
    }
    if (systemContent.includes('章节标题助手')) {
      return {
        content: JSON.stringify([
          { time: 0.5, title: '开场问候' },
          { time: 40, title: '天气话题' },
          { time: 80, title: '户外散步' }
        ]),
        inputTokens: 100,
        outputTokens: 50,
        latencyMs: 10
      };
    }
    if (systemContent.includes('调色助手')) {
      return {
        content: JSON.stringify({
          style: '电影感',
          issues: ['画面偏暗', '饱和度不足'],
          suggestions: [
            { parameter: 'brightness', currentValue: 0, recommendedValue: 0.2, reason: '提升画面亮度' },
            { parameter: 'saturation', currentValue: 1, recommendedValue: 1.3, reason: '增强色彩饱和度' },
            { parameter: 'contrast', currentValue: 1, recommendedValue: 1.1, reason: '适当增加对比度' }
          ]
        }),
        inputTokens: 100,
        outputTokens: 50,
        latencyMs: 10
      };
    }
    if (systemContent.includes('视频编辑助手')) {
      return {
        content: JSON.stringify([{ action: 'setSpeed', clipId: 'clip-chat-video', value: 0.5 }]),
        inputTokens: 100,
        outputTokens: 50,
        latencyMs: 10
      };
    }
    if (systemContent.includes('截帧图片')) {
      return {
        content: JSON.stringify({
          title: 'AI生成的视频摘要',
          summary: '这是一个测试视频项目，包含精彩的开场和结尾场景。',
          scenes: [{ time: 0, description: '开场场景' }, { time: 3, description: '结尾场景' }],
          emotionArc: '从平静到激动',
          keyMoments: [{ time: 0, description: '视频开场' }],
          tags: ['测试', 'E2E']
        }),
        inputTokens: 100,
        outputTokens: 50,
        latencyMs: 10
      };
    }
    if (systemContent.includes('旁白撰稿人')) {
      return {
        content: JSON.stringify([
          { markerTime: 0, duration: 3, text: '开场旁白文稿内容。', speakerNote: '语速平稳' },
          { markerTime: 3, duration: 3, text: '第二段旁白内容。', speakerNote: '略微加快' },
          { markerTime: 6, duration: 2, text: '结尾旁白总结。', speakerNote: '语气沉稳' }
        ]),
        inputTokens: 100,
        outputTokens: 50,
        latencyMs: 10
      };
    }
    if (systemContent.includes('视频内容分析助手')) {
      return {
        content: JSON.stringify({
          tags: ['室内', '访谈', '对话'],
          scene: '室内访谈场景',
          mood: '轻松愉快',
          objects: ['人物', '桌子']
        }),
        inputTokens: 100,
        outputTokens: 50,
        latencyMs: 10
      };
    }
    if (systemContent.includes('视频粗剪助手')) {
      return {
        content: JSON.stringify([
          { mediaId: 'media-rough-cut-a', startTime: 0, duration: 3, trackIndex: 0, reason: '产品外观展示' },
          { mediaId: 'media-rough-cut-b', startTime: 1, duration: 4, trackIndex: 0, reason: '使用场景演示' },
          { mediaId: 'media-rough-cut-c', startTime: 0, duration: 2, trackIndex: 0, reason: '结尾场景' }
        ]),
        inputTokens: 100,
        outputTokens: 50,
        latencyMs: 10
      };
    }
    if (systemContent.includes('video encoding advisor')) {
      return {
        content: JSON.stringify([
          { parameter: 'videoBitrate', currentValue: 'auto', suggestedValue: '8M', reason: '4K内容建议提高码率', priority: 'high' },
          { parameter: 'loudnessNormalization', currentValue: 'off', suggestedValue: 'ebu', reason: '建议启用EBU响度标准化', priority: 'medium' },
          { parameter: 'subtitleFormat', currentValue: 'none', suggestedValue: 'srt', reason: '项目含字幕轨，建议导出SRT', priority: 'low' }
        ]),
        inputTokens: 100,
        outputTokens: 50,
        latencyMs: 10
      };
    }
    if (systemContent.includes('视频导演助手')) {
      return {
        content: JSON.stringify({
          segments: [
            { mediaId: 'media-director-a', trimStart: 0, duration: 3, trackIndex: 0, order: 0, reason: '产品外观展示' },
            { mediaId: 'media-director-b', trimStart: 1, duration: 4, trackIndex: 0, order: 1, reason: '使用场景演示' },
            { mediaId: 'media-director-c', trimStart: 0, duration: 2, trackIndex: 0, order: 2, reason: '结尾场景' }
          ],
          markers: [
            { time: 0, label: '开场' },
            { time: 7, label: '结尾' }
          ],
          musicTrackPlaceholder: false
        }),
        inputTokens: 100,
        outputTokens: 50,
        latencyMs: 10
      };
    }
    if (systemContent.includes('音乐推荐助手')) {
      return {
        content: JSON.stringify({
          mood: '活力积极',
          tempo: 'medium',
          genres: ['流行', '电子'],
          keywords: ['活力', '积极', '产品展示'],
          searchSuggestions: ['upbeat corporate background music', 'energetic product showcase']
        }),
        inputTokens: 100,
        outputTokens: 50,
        latencyMs: 10
      };
    }
    if (systemContent.includes('视频集锦编辑助手')) {
      return {
        content: JSON.stringify({
          selectedIds: ['clip-highlight-a', 'clip-highlight-c'],
          transitionNotes: ['快速过渡到精彩结尾']
        }),
        inputTokens: 100,
        outputTokens: 50,
        latencyMs: 10
      };
    }
    if (systemContent.includes('字幕翻译术语提取助手')) {
      return {
        content: JSON.stringify({
          terms: [
            { original: 'OpenFactory', type: 'product', translation: 'OpenFactory' },
            { original: '张三', type: 'person', translation: 'Zhang San' },
            { original: '北京', type: 'place', translation: 'Beijing' }
          ]
        }),
        inputTokens: 100,
        outputTokens: 50,
        latencyMs: 10
      };
    }
    if (systemContent.includes('字幕翻译助手')) {
      return {
        content: JSON.stringify([
          { index: 0, translatedText: 'Hello, welcome to OpenFactory' },
          { index: 1, translatedText: 'Zhang San works in Beijing' },
          { index: 2, translatedText: 'Thanks for using our product' }
        ]),
        inputTokens: 100,
        outputTokens: 50,
        latencyMs: 10
      };
    }
    if (systemContent.includes('语义搜索助手')) {
      return {
        content: JSON.stringify({
          results: [
            { mediaId: 'media-ai-search-a', score: 0.92, reason: '室外阳光明媚的场景，与搜索描述高度匹配' },
            { mediaId: 'media-ai-search-b', score: 0.75, reason: '包含户外元素，部分匹配搜索关键词' }
          ]
        }),
        inputTokens: 100,
        outputTokens: 50,
        latencyMs: 10
      };
    }
    if (systemContent.includes('素材推荐助手')) {
      return {
        content: JSON.stringify({
          similar: [
            { mediaId: 'media-scene-match-a', score: 0.9, reason: '场景相近，适合连续使用' },
            { mediaId: 'media-scene-match-b', score: 0.7, reason: '氛围类似' },
            { mediaId: 'media-scene-match-c', score: 0.5, reason: '色调一致' }
          ],
          contrast: [
            { mediaId: 'media-scene-match-d', score: 0.85, reason: '明暗对比鲜明' },
            { mediaId: 'media-scene-match-e', score: 0.6, reason: '节奏变化' },
            { mediaId: 'media-scene-match-f', score: 0.4, reason: '色彩反差' }
          ]
        }),
        inputTokens: 100,
        outputTokens: 50,
        latencyMs: 10
      };
    }
    if (systemContent.includes('字幕样式推荐助手')) {
      return {
        content: JSON.stringify({
          recommended: [
            { templateId: 'variety-bold', reason: '视频风格活泼适合综艺综字，色彩醒目', confidence: 0.9 },
            { templateId: 'social-bold', reason: '适合短视频风格，字大醒目', confidence: 0.75 },
            { templateId: 'cinema-white', reason: '简约大气适合正式内容', confidence: 0.6 }
          ]
        }),
        inputTokens: 100,
        outputTokens: 50,
        latencyMs: 10
      };
    }
    if (systemContent.includes('质量评估助手')) {
      return {
        content: JSON.stringify({
          overallScore: 85,
          issues: [
            { type: '曝光', severity: 'medium', description: '画面整体偏暗，亮部细节不足', suggestedFix: '建议调整亮度+0.3' },
            { type: '噪点', severity: 'low', description: '暗部有轻微噪点', suggestedFix: '建议开启去噪' }
          ]
        }),
        inputTokens: 100,
        outputTokens: 50,
        latencyMs: 10
      };
    }
    if (systemContent.includes('降噪推荐助手')) {
      return {
        content: JSON.stringify({
       recommendedFilters: [
          { filter: 'afftdn' as const, params: { nr: 20, nf: -25 }, reason: '检测到嗡声(hum)干扰，建议使用自适应降噪' },
          { filter: 'highpass' as const, params: { f: 80 }, reason: '检测到嗡声低频干扰，建议高通滤波' }
        ],
          confidence: 0.85
        }),
        inputTokens: 100, outputTokens: 50, latencyMs: 10
      };
    }
    if (systemContent.includes('B-roll推荐助手')) {
      return {
        content: JSON.stringify({
          suggestions: [
            { segmentId: 'subtitle-clip-long', mediaId: 'media-broll-nature', insertTime: 1, reason: '自然风景与文本匹配', confidence: 0.88 },
            { segmentId: 'subtitle-clip-long', mediaId: 'media-broll-city', insertTime: 1.5, reason: '城市场景对比', confidence: 0.72 }
          ]
        }),
        inputTokens: 100, outputTokens: 50, latencyMs: 10
      };
    }
    if (systemContent.includes('版本对比摘要助手')) {
      return {
        content: JSON.stringify({
          summary: '两个版本之间有3处变化：新增2个剪辑、修改1个修剪点',
          highlights: ['新增了clip-new-1和clip-new-2', '修剪点变化超过0.1秒阈值', '轨道数量保持不变']
        }),
        inputTokens: 100, outputTokens: 50, latencyMs: 10
      };
    }
    return { content: '{}', inputTokens: 100, outputTokens: 50, latencyMs: 10 };
  },
  extractAiFrames: (request) => ({
    frames: request.times.map((_, i) => `fake-base64-${i}`)
  }),
  testAiConnection: () => true,
  readAiApiKey: (providerId) => aiApiKeys.get(providerId),
  writeAiApiKey: (providerId, apiKey) => {
    const normalized = apiKey?.trim();
    if (normalized) {
      aiApiKeys.set(providerId, normalized);
    } else {
      aiApiKeys.delete(providerId);
    }
  },
  checkOllamaReachable: () => false,
  listOllamaModels: () => ({ reachable: false, models: [] }),
  callTtsApi: (request) => ({
    audioBase64: 'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYqK0NcAAAAAAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYqK0Nc',
    latencyMs: 50
  }),
  emit: (event, payload) => emit(event, payload)
};

window.__TAURI_MOCKS__ = mocks;
const silencePatternWav = createSilencePatternWav();
const tinyAudioWav = createToneWav();
const realFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
  if (url.includes('api-free.deepl.com/v2/translate')) {
    const body = init?.body as URLSearchParams;
    const texts = body.getAll('text');
    return Promise.resolve(new Response(JSON.stringify({ translations: texts.map((text) => ({ text: `${text} 翻译` })) }), { status: 200 }));
  }
  if (url.includes('translation.googleapis.com/language/translate/v2')) {
    const body = JSON.parse(String(init?.body ?? '{}')) as { q?: string[] };
    const texts = Array.isArray(body.q) ? body.q : [];
    return Promise.resolve(new Response(JSON.stringify({ data: { translations: texts.map((text) => ({ translatedText: `${text} 翻译` })) } }), { status: 200 }));
  }
  if (url.includes('export-preset-market')) {
    return Promise.resolve(new Response('offline', { status: 503 }));
  }
  if (url.includes('effect-preset-library')) {
    return Promise.resolve(
      effectPresetCommunityResponse
        ? new Response(effectPresetCommunityResponse, { status: 200, headers: { 'Content-Type': 'application/json' } })
        : new Response('offline', { status: 503 })
    );
  }
  if (url === silencePatternAudio) {
    return Promise.resolve(new Response(silencePatternWav.buffer.slice(0) as ArrayBuffer, { headers: { 'Content-Type': 'audio/wav' } }));
  }
  if (url === tinyAudio || url === relinkedAudio) {
    return Promise.resolve(new Response(tinyAudioWav.buffer.slice(0) as ArrayBuffer, { headers: { 'Content-Type': 'audio/wav' } }));
  }
  if (/^C:\/(Media|Relink)\//.test(url) || /^C:\/Users\/E2E\//.test(url)) {
    const bytes = new Uint8Array(4096);
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = (index * 17) % 255;
    }
    return Promise.resolve(new Response(bytes));
  }
  return realFetch(input as RequestInfo | URL, init);
};
window.__E2E_ACTIONS__ = {
  setupLargeTimelineFixture: (clipCountInput?: unknown) => {
    const clipCount = typeof clipCountInput === 'number' && Number.isFinite(clipCountInput) && clipCountInput > 0 ? Math.floor(clipCountInput) : 500;
    const project = createProject('Large Timeline E2E');
    const mediaId = 'media-large-timeline-video';
    const asset: MediaAsset = {
      id: mediaId,
      type: 'video',
      name: 'large-timeline-video.mp4',
      path: tinyVideo,
      duration: 2,
      width: 1280,
      height: 720,
      size: 4096,
      mtimeMs: 1_000,
      hasAudio: false
    };
    const trackCount = 5;
    const tracks = Array.from({ length: trackCount }, (_, trackIndex) =>
      createTrack({
        id: `track-large-${trackIndex}`,
        type: 'video',
        name: `Video ${trackIndex + 1}`,
        clips: []
      })
    );
    for (let index = 0; index < clipCount; index += 1) {
      const trackIndex = index % trackCount;
      const localIndex = Math.floor(index / trackCount);
      const track = tracks[trackIndex];
      track.clips.push(makeLargeTimelineVideoClip(`clip-large-${String(index).padStart(4, '0')}`, track.id, mediaId, localIndex * 1.25));
    }
    const timeline = { transitions: [], markers: [], tracks };
    useEditorStore.getState().setProject({
      ...project,
      media: [asset],
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    commandManager.clear();
  },
  createLargeProject: (options?: unknown) => {
    const opts = (options && typeof options === 'object') ? options as Record<string, unknown> : {};
    const clipCountOpt = typeof opts.clipCount === 'number' && Number.isFinite(opts.clipCount) && opts.clipCount > 0 ? Math.floor(opts.clipCount) : 0;
    const trackCountOpt = typeof opts.trackCount === 'number' && Number.isFinite(opts.trackCount) && opts.trackCount > 0 ? Math.floor(opts.trackCount) : 0;
    const clipsPerTrackOpt = typeof opts.clipsPerTrack === 'number' && Number.isFinite(opts.clipsPerTrack) && opts.clipsPerTrack > 0 ? Math.floor(opts.clipsPerTrack) : 0;

    const project = createProject('Large Project E2E');
    const mediaId = 'media-large-project-video';
    const asset: MediaAsset = {
      id: mediaId,
      type: 'video',
      name: 'large-project-video.mp4',
      path: tinyVideo,
      duration: 2,
      width: 1280,
      height: 720,
      size: 4096,
      mtimeMs: 1_000,
      hasAudio: false
    };

    let trackCount: number;
    let totalClips: number;
    if (trackCountOpt > 0 && clipsPerTrackOpt > 0) {
      trackCount = trackCountOpt;
      totalClips = trackCount * clipsPerTrackOpt;
    } else {
      trackCount = 5;
      totalClips = clipCountOpt > 0 ? clipCountOpt : 500;
    }

    const tracks = Array.from({ length: trackCount }, (_, trackIndex) =>
      createTrack({
        id: `track-large-project-${trackIndex}`,
        type: 'video',
        name: `Video ${trackIndex + 1}`,
        clips: []
      })
    );
    for (let index = 0; index < totalClips; index += 1) {
      const trackIndex = index % trackCount;
      const localIndex = Math.floor(index / trackCount);
      const track = tracks[trackIndex];
      track.clips.push(makeLargeTimelineVideoClip(`clip-lp-${String(index).padStart(4, '0')}`, track.id, mediaId, localIndex * 1.25));
    }
    const timeline = { transitions: [], markers: [], tracks };
    useEditorStore.getState().setProject({
      ...project,
      media: [asset],
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    commandManager.clear();
  },
  enableHeatmap: (enabled?: unknown) => {
    const flag = typeof enabled === 'boolean' ? enabled : true;
    useEditorSettingsStore.getState().setTimelineHeatmap((current) => ({ ...current, enabled: flag }));
  },
  setupMediaLibraryFixture: () => {
    const project = createProject('Media Library E2E');
    const videoAsset: MediaAsset = {
      id: 'media-video',
      type: 'video',
      name: 'tiny-video.mp4',
      path: tinyVideo,
      duration: 6,
      width: 1280,
      height: 720,
      size: 4096,
      mtimeMs: 1_000,
      hasAudio: true,
      audioChannels: 2,
      audioSampleRate: 44_100,
      audioCodec: 'aac',
      videoCodec: 'h264',
      frameRate: 30
    };
    const audioAsset: MediaAsset = {
      id: 'media-audio',
      type: 'audio',
      name: 'tiny-audio.wav',
      path: tinyAudio,
      duration: 6,
      width: 0,
      height: 0,
      size: 4096,
      mtimeMs: 1_000,
      hasAudio: true,
      audioChannels: 2,
      audioSampleRate: 44_100,
      audioCodec: 'pcm_s16le'
    };
    const imageAsset: MediaAsset = {
      id: 'media-image',
      type: 'image',
      name: 'test-image.png',
      path: tinyImage,
      duration: 0,
      width: 1280,
      height: 720,
      size: 2048,
      mtimeMs: 1_000,
      hasAudio: false
    };
    useEditorStore.getState().setProject({
      ...project,
      media: [videoAsset, audioAsset, imageAsset],
      timeline: { transitions: [], markers: [], tracks: [] },
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline: { transitions: [], markers: [], tracks: [] } }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    commandManager.clear();
  },
  setupEfficientEditingFixture: () => {
    const project = createProject('Efficient Editing E2E');
    const asset: MediaAsset = {
      id: 'media-editing-video',
      type: 'video',
      name: 'editing-video.mp4',
      path: tinyVideo,
      duration: 8,
      width: 1280,
      height: 720,
      size: 4096,
      mtimeMs: 1_000,
      hasAudio: true,
      audioChannels: 2,
      audioSampleRate: 44_100,
      audioCodec: 'aac'
    };
    const timeline = {
      transitions: [],
      markers: [],
      tracks: [
        createTrack({
          id: 'track-video',
          type: 'video',
          name: 'Video 1',
          clips: [
            makeEditingVideoClip('clip-edit-a', 0, 2, 0, 4),
            makeEditingVideoClip('clip-edit-b', 2, 2, 0, 0),
            makeEditingVideoClip('clip-edit-c', 4, 2, 0, 0)
          ]
        }),
        createTrack({ id: 'track-audio', type: 'audio', name: 'Audio 1', clips: [] }),
        createTrack({ id: 'track-text', type: 'text', name: 'Text 1', clips: [] })
      ]
    };
    useEditorStore.getState().setProject({
      ...project,
      media: [asset],
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    useEditorStore.getState().setSelectedClipIds([]);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },
  setupGapFillFixture: () => {
    const project = createProject('Gap Fill E2E');
    const asset: MediaAsset = {
      id: 'media-gap-video',
      type: 'video',
      name: 'gap-source.mp4',
      path: tinyVideo,
      duration: 8,
      width: 1280,
      height: 720,
      size: 4096,
      mtimeMs: 1_000,
      hasAudio: true,
      audioChannels: 2,
      audioSampleRate: 44_100,
      audioCodec: 'aac',
      videoCodec: 'h264'
    };
    const timeline = {
      transitions: [],
      markers: [],
      tracks: [
        createTrack({
          id: 'track-video',
          type: 'video',
          name: 'Video 1',
          clips: [
            { ...makeEditingVideoClip('clip-gap-a', 0, 2, 0, 0), mediaId: asset.id, name: 'Gap A' },
            { ...makeEditingVideoClip('clip-gap-b', 4, 2, 0, 0), mediaId: asset.id, name: 'Gap B' }
          ]
        }),
        createTrack({ id: 'track-audio', type: 'audio', name: 'Audio 1', clips: [] }),
        createTrack({ id: 'track-text', type: 'text', name: 'Text 1', clips: [] })
      ]
    };
    useEditorStore.getState().setProject({
      ...project,
      media: [asset],
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    useEditorStore.getState().setSelectedClipIds([]);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },
  setupSmartRecommendationsFixture: () => {
    const project = createProject('Smart Recommendations E2E');
    const usedAsset: MediaAsset = {
      id: 'media-smart-used',
      type: 'video',
      name: 'used-cool-open.mp4',
      path: tinyVideo,
      duration: 8,
      width: 1280,
      height: 720,
      thumbnail: makeSceneThumb('#64748b'),
      size: 4096,
      mtimeMs: 1_000,
      hasAudio: true,
      audioChannels: 2,
      audioSampleRate: 44_100,
      audioCodec: 'aac',
      videoCodec: 'h264'
    };
    const recommendedAsset: MediaAsset = {
      id: 'media-smart-recommended',
      type: 'video',
      name: 'recommended-fill.mp4',
      path: tinyVideoB,
      duration: 2.1,
      width: 1280,
      height: 720,
      thumbnail: makeSceneThumb('#64748b'),
      size: 4096,
      mtimeMs: 1_000,
      hasAudio: true,
      audioChannels: 2,
      audioSampleRate: 44_100,
      audioCodec: 'aac',
      videoCodec: 'h264'
    };
    const distantAsset: MediaAsset = {
      id: 'media-smart-distant',
      type: 'video',
      name: 'distant-warm-long.mp4',
      path: fourKHevcVideo,
      duration: 7,
      width: 1920,
      height: 1080,
      thumbnail: makeSceneThumb('#f97316'),
      size: 4096,
      mtimeMs: 1_000,
      hasAudio: true,
      audioChannels: 2,
      audioSampleRate: 44_100,
      audioCodec: 'aac',
      videoCodec: 'h264'
    };
    const timeline = {
      transitions: [],
      markers: [],
      tracks: [
        createTrack({
          id: 'track-video',
          type: 'video',
          name: 'Video 1',
          clips: [
            { ...makeEditingVideoClip('clip-smart-a', 0, 2, 0, 0), mediaId: usedAsset.id, name: 'Smart A' },
            { ...makeEditingVideoClip('clip-smart-b', 4, 2, 0, 0), mediaId: usedAsset.id, name: 'Smart B' }
          ]
        }),
        createTrack({ id: 'track-audio', type: 'audio', name: 'Audio 1', clips: [] }),
        createTrack({ id: 'track-text', type: 'text', name: 'Text 1', clips: [] })
      ]
    };
    useEditorStore.getState().setProject({
      ...project,
      media: [usedAsset, recommendedAsset, distantAsset],
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    useEditorStore.getState().setSelectedClipIds([]);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },
  setupComplexityScoreFixture: () => {
    const project = createProject('Complexity Score E2E');
    const asset: MediaAsset = {
      id: 'media-complex-video',
      type: 'video',
      name: 'complexity-source.mp4',
      path: tinyVideo,
      duration: 12,
      width: 1920,
      height: 1080,
      size: 4096,
      mtimeMs: 1_000,
      hasAudio: true,
      audioChannels: 2,
      audioSampleRate: 44_100,
      audioCodec: 'aac',
      videoCodec: 'h264',
      frameRate: 30
    };
    const clipA = {
      ...makeEditingVideoClip('clip-complex-a', 0, 3, 0, 0),
      mediaId: asset.id,
      name: 'Complex A',
      colorCorrection: { ...DEFAULT_COLOR_CORRECTION, brightness: 0.25, saturation: 1.4 },
      effects: [{ id: 'fx-complex-blur', type: 'blur' as const, enabled: true, params: { radius: 8 } }],
      keyframes: {
        opacity: [
          { id: 'kf-complex-1', time: 0, value: 1, easing: 'linear' as const },
          { id: 'kf-complex-2', time: 1, value: 0.6, easing: 'ease-in' as const }
        ]
      }
    };
    const clipB = {
      ...makeEditingVideoClip('clip-complex-b', 3, 3, 0, 0),
      mediaId: asset.id,
      name: 'Complex B',
      effects: [{ id: 'fx-complex-shader', type: 'custom-shader' as const, enabled: true, params: {} }]
    };
    const timeline = {
      transitions: [],
      markers: [],
      tracks: [
        createTrack({ id: 'track-video', type: 'video', name: 'Video 1', clips: [clipA, clipB] }),
        createTrack({
          id: 'track-audio',
          type: 'audio',
          name: 'Audio 1',
          volume: 0.8,
          pan: 0.25,
          compressor: { enabled: true, threshold: -18, ratio: 3, attack: 5, release: 120, makeupGain: 1 },
          clips: []
        }),
        createTrack({ id: 'track-text', type: 'text', name: 'Text 1', clips: [] })
      ]
    };
    useEditorStore.getState().setProject({
      ...project,
      media: [asset],
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    useEditorStore.getState().setSelectedClipIds([]);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },
  setupExportOptimizationFixture: () => {
    const project = createProject('Export Optimization E2E');
    const asset: MediaAsset = {
      id: 'media-optimization-4k',
      type: 'video',
      name: 'four-k-optimization.mov',
      path: fourKHevcVideo,
      duration: 8,
      width: 3840,
      height: 2160,
      size: 8192,
      mtimeMs: 1_000,
      hasAudio: true,
      audioChannels: 2,
      audioSampleRate: 48_000,
      audioCodec: 'aac',
      videoCodec: 'hevc',
      frameRate: 60
    };
    const timeline = {
      transitions: [],
      markers: [],
      tracks: [
        createTrack({
          id: 'track-video',
          type: 'video',
          name: 'Video 1',
          clips: [{ ...makeEditingVideoClip('clip-optimization-4k', 0, 8, 0, 0), mediaId: asset.id, name: '4K Optimization' }]
        }),
        createTrack({ id: 'track-audio', type: 'audio', name: 'Audio 1', clips: [] }),
        createTrack({ id: 'track-text', type: 'text', name: 'Text 1', clips: [] })
      ]
    };
    useEditorStore.getState().setProject({
      ...project,
      media: [asset],
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    useEditorStore.getState().setSelectedClipIds([]);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },
  setupStyleTransferFixture: () => {
    const project = createProject('Style Transfer E2E');
    const asset: MediaAsset = {
      id: 'media-style-video',
      type: 'video',
      name: 'style-source.mp4',
      path: tinyVideo,
      duration: 8,
      width: 1280,
      height: 720,
      size: 4096,
      mtimeMs: 1_000,
      hasAudio: true,
      audioChannels: 2,
      audioSampleRate: 44_100,
      audioCodec: 'aac',
      videoCodec: 'h264'
    };
    const source = {
      ...makeEditingVideoClip('clip-style-source', 0, 2, 0, 0),
      mediaId: asset.id,
      name: 'Style Source',
      colorCorrection: { ...DEFAULT_COLOR_CORRECTION, brightness: 0.6, saturation: 1.6, lutPath: 'C:/Looks/warm.cube' },
      effects: [{ id: 'style-sharpen', type: 'sharpen' as const, enabled: true, params: { strength: 2 } }]
    };
    const target = {
      ...makeEditingVideoClip('clip-style-target', 3, 2, 0, 0),
      mediaId: asset.id,
      name: 'Style Target',
      colorCorrection: { ...DEFAULT_COLOR_CORRECTION, brightness: 0, saturation: 1, lutPath: null },
      effects: []
    };
    const timeline = {
      transitions: [],
      markers: [],
      tracks: [
        createTrack({ id: 'track-video', type: 'video', name: 'Video 1', clips: [source, target] }),
        createTrack({ id: 'track-audio', type: 'audio', name: 'Audio 1', clips: [] }),
        createTrack({ id: 'track-text', type: 'text', name: 'Text 1', clips: [] })
      ]
    };
    useEditorStore.getState().setProject({
      ...project,
      media: [asset],
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    useEditorStore.getState().setSelectedClipIds(['clip-style-target']);
    useEditorStore.getState().setPlayheadTime(3);
    commandManager.clear();
  },
  setupMultilingualSubtitleFixture: () => {
    const project = createProject('Multilingual Subtitle E2E');
    const asset: MediaAsset = {
      id: 'media-subtitle-video',
      type: 'video',
      name: 'subtitle-source.mp4',
      path: tinyVideo,
      duration: 4,
      width: 1280,
      height: 720,
      size: 4096,
      mtimeMs: 1_000,
      hasAudio: true,
      audioChannels: 2,
      audioSampleRate: 44_100,
      audioCodec: 'aac'
    };
    const timeline = {
      transitions: [],
      markers: [],
      tracks: [
        createTrack({
          id: 'track-video',
          type: 'video',
          name: 'Video 1',
          clips: [
            {
              id: 'clip-subtitle-video',
              type: 'video',
              name: 'subtitle-source.mp4',
              mediaId: asset.id,
              trackId: 'track-video',
              start: 0,
              duration: 4,
              trimStart: 0,
              trimEnd: 0,
              speed: DEFAULT_CLIP_SPEED,
              colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
              transform: { ...DEFAULT_TRANSFORM },
              volume: 1
            }
          ]
        }),
        createTrack({ id: 'track-audio', type: 'audio', name: 'Audio 1', clips: [] }),
        createTrack({ id: 'track-text', type: 'text', name: 'Text 1', clips: [] }),
        createTrack({
          id: 'track-subtitle-zh',
          type: 'subtitle',
          name: '中文字幕',
          language: 'zh',
          clips: [makeMockSubtitleClip('subtitle-zh-e2e', 'track-subtitle-zh', '你好，字幕', 0.2)]
        }),
        createTrack({
          id: 'track-subtitle-en',
          type: 'subtitle',
          name: 'English Subtitles',
          language: 'en',
          clips: [makeMockSubtitleClip('subtitle-en-e2e', 'track-subtitle-en', 'Hello subtitle', 0.2)]
        })
      ]
    };
    useEditorStore.getState().setProject({
      ...project,
      media: [asset],
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    useEditorStore.getState().setSelectedClipIds([]);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },
  setupSubtitleProofreadingFixture: () => {
    const project = createProject('Subtitle Proofreading E2E');
    const shortSubtitle = { ...makeMockSubtitleClip('sub-proof-short', 'track-subtitle-proof', '太短', 0), duration: 0.4 };
    const okSubtitle = { ...makeMockSubtitleClip('sub-proof-ok', 'track-subtitle-proof', '正常字幕', 2), duration: 2 };
    const timeline = {
      transitions: [],
      markers: [],
      tracks: [
        createTrack({ id: 'track-video', type: 'video', name: 'Video 1', clips: [] }),
        createTrack({ id: 'track-audio', type: 'audio', name: 'Audio 1', clips: [] }),
        createTrack({ id: 'track-text', type: 'text', name: 'Text 1', clips: [] }),
        createTrack({
          id: 'track-subtitle-proof',
          type: 'subtitle',
          name: 'Proofreading Subtitles',
          language: 'zh',
          clips: [shortSubtitle, okSubtitle]
        })
      ]
    };
    useEditorStore.getState().setProject({
      ...project,
      media: [],
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    useEditorStore.getState().setSelectedClipIds([shortSubtitle.id]);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },
  setupBeatDetectionFixture: () => {
    const project = createProject('Beat Detection E2E');
    const media: MediaAsset[] = [
      {
        id: 'media-beat-video',
        type: 'video',
        name: 'beat-source.mp4',
        path: tinyVideo,
        duration: 4,
        width: 1280,
        height: 720,
        size: 4096,
        mtimeMs: 1_000,
        hasAudio: true,
        audioChannels: 2,
        audioSampleRate: 44_100,
        audioCodec: 'aac',
        videoCodec: 'h264'
      },
      {
        id: 'media-beat-audio',
        type: 'audio',
        name: 'beat-source.wav',
        path: tinyAudio,
        duration: 4,
        width: 0,
        height: 0,
        size: 2048,
        mtimeMs: 1_000,
        hasAudio: true,
        audioChannels: 2,
        audioSampleRate: 44_100,
        audioCodec: 'pcm_s16le'
      }
    ];
    const timeline = {
      transitions: [],
      markers: [],
      tracks: [
        createTrack({
          id: 'track-video',
          type: 'video',
          name: 'Video 1',
          clips: [
            makeBeatVideoClip('clip-beat-a', 'Clip Beat A', 0.97),
            makeBeatVideoClip('clip-beat-b', 'Clip Beat B', 2.03)
          ]
        }),
        createTrack({ id: 'track-audio', type: 'audio', name: 'Audio 1', clips: [makeBeatAudioClip()] }),
        createTrack({ id: 'track-text', type: 'text', name: 'Text 1', clips: [] })
      ]
    };
    useEditorStore.getState().setProject({
      ...project,
      media,
      beatMarkers: [],
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    useEditorStore.getState().setSelectedClipIds(['clip-beat-audio']);
    useEditorStore.getState().setSelectedClipId('clip-beat-audio');
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },
  setupAutoAudioSyncFixture: () => {
    const project = createProject('Auto Audio Sync E2E');
    const media: MediaAsset[] = [
      makeAutoSyncMedia('media-auto-primary', 'Camera Reference', autoSyncPrimaryAudio),
      makeAutoSyncMedia('media-auto-secondary', 'Mic Secondary', autoSyncSecondaryAudio)
    ];
    const timeline = {
      transitions: [],
      markers: [],
      tracks: [
        createTrack({
          id: 'track-auto-primary',
          type: 'audio',
          name: 'Camera Audio',
          clips: [makeAutoSyncAudioClip('clip-auto-primary', 'Camera Reference', 'media-auto-primary', 'track-auto-primary', 0)]
        }),
        createTrack({
          id: 'track-auto-secondary',
          type: 'audio',
          name: 'Boom Mic',
          clips: [makeAutoSyncAudioClip('clip-auto-secondary', 'Boom Mic', 'media-auto-secondary', 'track-auto-secondary', 1)]
        }),
        createTrack({ id: 'track-text', type: 'text', name: 'Text 1', clips: [] })
      ]
    };
    useEditorStore.getState().setProject({
      ...project,
      media,
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    useEditorStore.getState().setSelectedClipId('clip-auto-primary');
    useEditorStore.getState().setSelectedClipIds(['clip-auto-primary', 'clip-auto-secondary']);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },
  setupStoryboardFixture: () => {
    const project = createProject('Storyboard E2E');
    const media: MediaAsset[] = [
      {
        id: 'media-story-a',
        type: 'video',
        name: 'story-a.mp4',
        path: tinyVideo,
        duration: 8,
        width: 1280,
        height: 720,
        thumbnail: makeSceneThumb('#f8fafc'),
        size: 4096,
        mtimeMs: 1_000,
        hasAudio: true,
        audioChannels: 2,
        audioSampleRate: 44_100,
        audioCodec: 'aac',
        videoCodec: 'h264'
      },
      {
        id: 'media-story-b',
        type: 'image',
        name: 'story-b.png',
        path: tinyImage,
        duration: 0,
        width: 1280,
        height: 720,
        thumbnail: makeSceneThumb('#111827'),
        size: 4096,
        mtimeMs: 1_000
      },
      {
        id: 'media-story-c',
        type: 'video',
        name: 'story-c.mp4',
        path: tinyVideoB,
        duration: 8,
        width: 1280,
        height: 720,
        thumbnail: makeSceneThumb('#64748b'),
        size: 4096,
        mtimeMs: 1_000,
        hasAudio: true,
        audioChannels: 2,
        audioSampleRate: 44_100,
        audioCodec: 'aac',
        videoCodec: 'h264'
      },
      {
        id: 'media-story-d',
        type: 'video',
        name: 'story-d.mp4',
        path: tinyVideoB,
        duration: 8,
        width: 1280,
        height: 720,
        thumbnail: makeSceneThumb('#cbd5e1'),
        size: 4096,
        mtimeMs: 1_000,
        hasAudio: true,
        audioChannels: 2,
        audioSampleRate: 44_100,
        audioCodec: 'aac',
        videoCodec: 'h264'
      }
    ];
    const timeline = {
      transitions: [],
      markers: [],
      tracks: [
        createTrack({
          id: 'track-video',
          type: 'video',
          name: 'Video 1',
          clips: [
            makeStoryboardClip('clip-story-a', 'video', 'Opening Card', 'media-story-a', 0, 2),
            makeStoryboardClip('clip-story-b', 'image', 'Insert Card', 'media-story-b', 2, 3),
            makeStoryboardClip('clip-story-c', 'video', 'Middle Card', 'media-story-c', 5, 1),
            makeStoryboardClip('clip-story-d', 'video', 'Final Card', 'media-story-d', 6, 2)
          ]
        }),
        createTrack({ id: 'track-audio', type: 'audio', name: 'Audio 1', clips: [] }),
        createTrack({ id: 'track-text', type: 'text', name: 'Text 1', clips: [] })
      ]
    };
    useEditorStore.getState().setProject({
      ...project,
      media,
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    useEditorStore.getState().setSelectedClipIds([]);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },
  setupSmartRoughCutFixture: () => {
    const project = createProject('Smart Rough Cut E2E');
    const asset: MediaAsset = {
      id: 'media-smart-video',
      type: 'video',
      name: 'smart-video.mp4',
      path: silencePatternAudio,
      duration: 2.5,
      width: 1280,
      height: 720,
      size: silencePatternWav.byteLength,
      mtimeMs: 1_000,
      hasAudio: true,
      audioChannels: 1,
      audioSampleRate: 44_100,
      audioCodec: 'pcm_s16le',
      videoCodec: 'h264'
    };
    const timeline = {
      transitions: [],
      markers: [],
      tracks: [
        createTrack({ id: 'track-video', type: 'video', name: 'Video 1', clips: [makeSmartRoughCutVideoClip()] }),
        createTrack({ id: 'track-audio', type: 'audio', name: 'Audio 1', clips: [] }),
        createTrack({ id: 'track-text', type: 'text', name: 'Text 1', clips: [] })
      ]
    };
    useEditorStore.getState().setProject({
      ...project,
      media: [asset],
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    useEditorStore.getState().setSelectedClipIds(['clip-smart-video']);
    useEditorStore.getState().setSelectedClipId('clip-smart-video');
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },
  setupAIRoughCutFixture: async () => {
    const project = createProject('AI Rough Cut E2E');
    const mediaAssets: MediaAsset[] = [
      {
        id: 'media-rough-cut-a',
        type: 'video',
        name: 'product-intro.mp4',
        path: tinyVideo,
        duration: 5,
        width: 1920,
        height: 1080,
        size: 8192,
        mtimeMs: 1_000,
        hasAudio: true,
        aiAnalysis: { tags: ['产品', '外观'], scene: '产品展示', mood: '专业', objects: ['产品', '桌子'], analysisTime: '2025-01-01T00:00:00Z', providerId: 'mock' }
      },
      {
        id: 'media-rough-cut-b',
        type: 'video',
        name: 'usage-demo.mp4',
        path: tinyVideo,
        duration: 8,
        width: 1920,
        height: 1080,
        size: 16384,
        mtimeMs: 2_000,
        hasAudio: true,
        aiAnalysis: { tags: ['演示', '使用'], scene: '使用场景', mood: '轻松', objects: ['人物', '产品'], analysisTime: '2025-01-01T00:00:00Z', providerId: 'mock' }
      },
      {
        id: 'media-rough-cut-c',
        type: 'video',
        name: 'ending-scene.mp4',
        path: tinyVideo,
        duration: 4,
        width: 1920,
        height: 1080,
        size: 4096,
        mtimeMs: 3_000,
        hasAudio: true,
        aiAnalysis: { tags: ['结尾', '场景'], scene: '结尾', mood: '温馨', objects: ['场景', '灯光'], analysisTime: '2025-01-01T00:00:00Z', providerId: 'mock' }
      }
    ];
    const timeline = {
      transitions: [],
      markers: [],
      tracks: [createTrack({ id: 'track-video', type: 'video', name: 'Video 1', clips: [] })]
    };
    useEditorStore.getState().setProject({
      ...project,
      media: mediaAssets,
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    useEditorStore.getState().setSelectedClipIds([]);
    useEditorStore.getState().setPlayheadTime(0);
    await useAISettingsStore.getState().setProviderApiKey('openai', 'test-openai-key');
    useAISettingsStore.getState().toggleProvider('openai', true);
    useAISettingsStore.getState().setServiceMapping('rough-cut', 'openai');
    commandManager.clear();
  },
  setupMulticamFixture: () => {
    const project = createProject('Multicam E2E');
    const media: MediaAsset[] = [
      {
        id: 'media-camera-a',
        type: 'video',
        name: 'camera-a.mp4',
        path: tinyVideo,
        duration: 4,
        width: 1280,
        height: 720,
        size: 4096,
        mtimeMs: 1_000,
        hasAudio: true,
        audioChannels: 2,
        audioSampleRate: 44_100,
        audioCodec: 'aac'
      },
      {
        id: 'media-camera-b',
        type: 'video',
        name: 'camera-b.mp4',
        path: tinyVideoB,
        duration: 4,
        width: 1280,
        height: 720,
        size: 4096,
        mtimeMs: 1_000,
        hasAudio: true,
        audioChannels: 2,
        audioSampleRate: 44_100,
        audioCodec: 'aac'
      }
    ];
    const timeline = {
      transitions: [],
      markers: [],
      tracks: [
        createTrack({ id: 'track-camera-a', type: 'video', name: 'Camera A', clips: [makeMulticamVideoClip('clip-camera-a', 'media-camera-a', 'track-camera-a', 'Camera A')] }),
        createTrack({ id: 'track-camera-b', type: 'video', name: 'Camera B', clips: [makeMulticamVideoClip('clip-camera-b', 'media-camera-b', 'track-camera-b', 'Camera B')] }),
        createTrack({ id: 'track-audio', type: 'audio', name: 'Audio 1', clips: [] }),
        createTrack({ id: 'track-text', type: 'text', name: 'Text 1', clips: [] })
      ]
    };
    useEditorStore.getState().setProject({
      ...project,
      media,
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    useEditorStore.getState().setSelectedClipIds(['clip-camera-a', 'clip-camera-b']);
    useEditorStore.getState().setPlayheadTime(1);
    commandManager.clear();
  },
  setupIndependentMulticamFixture: () => {
    const project = createProject('Independent Multicam E2E');
    const media: MediaAsset[] = [
      {
        id: 'media-cam-1',
        type: 'video',
        name: 'cam-1.mp4',
        path: tinyVideo,
        duration: 10,
        width: 1280,
        height: 720,
        size: 4096,
        mtimeMs: 1_000,
        hasAudio: true,
        audioChannels: 2,
        audioSampleRate: 44_100,
        audioCodec: 'aac'
      },
      {
        id: 'media-cam-2',
        type: 'video',
        name: 'cam-2.mp4',
        path: tinyVideoB,
        duration: 10,
        width: 1280,
        height: 720,
        size: 4096,
        mtimeMs: 1_000,
        hasAudio: true,
        audioChannels: 2,
        audioSampleRate: 44_100,
        audioCodec: 'aac'
      },
      {
        id: 'media-cam-3',
        type: 'video',
        name: 'cam-3.mp4',
        path: tinyVideo,
        duration: 10,
        width: 1280,
        height: 720,
        size: 4096,
        mtimeMs: 1_000,
        hasAudio: true,
        audioChannels: 2,
        audioSampleRate: 44_100,
        audioCodec: 'aac'
      }
    ];
    const multicamClip = createMulticamClip(
      [
        { id: 'angle-1', mediaId: 'media-cam-1', name: 'Camera 1', offset: 0, volume: 1, muted: false },
        { id: 'angle-2', mediaId: 'media-cam-2', name: 'Camera 2', offset: 0, volume: 1, muted: false },
        { id: 'angle-3', mediaId: 'media-cam-3', name: 'Camera 3', offset: 0, volume: 1, muted: false }
      ],
      'audio',
      0
    );
    multicamClip.start = 0;
    multicamClip.duration = 10;
    multicamClip.trackId = 'track-main';
    const timeline = {
      transitions: [],
      markers: [],
      tracks: [
        createTrack({ id: 'track-main', type: 'video', name: 'Video 1', clips: [multicamClip] }),
        createTrack({ id: 'track-audio', type: 'audio', name: 'Audio 1', clips: [] })
      ]
    };
    useEditorStore.getState().setProject({
      ...project,
      media,
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    useEditorStore.getState().setSelectedClipIds([multicamClip.id]);
    useEditorStore.getState().enterMulticamEditMode(multicamClip.id);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },
  setupWhisperFixture: () => {
    const project = createProject('Whisper E2E');
    const asset: MediaAsset = {
      id: 'media-whisper-video',
      type: 'video',
      name: 'whisper-video.mp4',
      path: whisperVideo,
      duration: 4,
      width: 1280,
      height: 720,
      size: 4096,
      mtimeMs: 1_000,
      hasAudio: true,
      audioChannels: 2,
      audioSampleRate: 44_100,
      audioCodec: 'aac'
    };
    const timeline = {
      transitions: [],
      markers: [],
      tracks: [
        createTrack({ id: 'track-video', type: 'video', name: 'Video 1', clips: [makeWhisperVideoClip()] }),
        createTrack({ id: 'track-audio', type: 'audio', name: 'Audio 1', clips: [] }),
        createTrack({ id: 'track-text', type: 'text', name: 'Text 1', clips: [] })
      ]
    };
    useEditorStore.getState().setProject({
      ...project,
      media: [asset],
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    commandManager.clear();
  },
  setupSilenceDetectionFixture: () => {
    const project = createProject('Silence Detection E2E');
    const asset: MediaAsset = {
      id: 'media-silence-pattern',
      type: 'audio',
      name: 'silence-pattern.wav',
      path: silencePatternAudio,
      duration: 2.5,
      width: 0,
      height: 0,
      size: silencePatternWav.byteLength,
      mtimeMs: 1_000,
      hasAudio: true,
      audioChannels: 1,
      audioSampleRate: 44_100,
      audioCodec: 'pcm_s16le'
    };
    useEditorStore.getState().setProject({
      ...project,
      media: [asset],
      timeline: {
        transitions: [],
        markers: [],
        tracks: [
          createTrack({ id: 'track-audio', type: 'audio', name: 'Audio 1', clips: [makeSilencePatternClip()] }),
          createTrack({ id: 'track-video', type: 'video', name: 'Video 1', clips: [] }),
          createTrack({ id: 'track-text', type: 'text', name: 'Text 1', clips: [] })
        ]
      }
    });
    commandManager.clear();
  },
  setupProjectHealthFixture: () => {
    const project = createProject('Project Health E2E');
    const missingAsset: MediaAsset = {
      id: 'media-health-missing',
      type: 'video',
      name: 'tiny-video.mp4',
      path: 'C:/Missing/tiny-video.mp4',
      duration: 6,
      width: 1280,
      height: 720,
      missing: true,
      size: 4096,
      mtimeMs: 1_000,
      hasAudio: true,
      audioChannels: 2,
      audioSampleRate: 44_100,
      audioCodec: 'aac',
      videoCodec: 'h264',
      proxyStatus: 'none'
    };
    const orphanAsset: MediaAsset = {
      id: 'media-health-orphan',
      type: 'audio',
      name: 'tiny-audio.wav',
      path: tinyAudio,
      duration: 6,
      width: 0,
      height: 0,
      size: 2048,
      mtimeMs: 1_000,
      hasAudio: true,
      audioChannels: 2,
      audioSampleRate: 44_100,
      audioCodec: 'pcm_s16le'
    };
    const timeline = {
      transitions: [],
      markers: [],
      tracks: [
        createTrack({ id: 'track-video', type: 'video', name: 'Video 1', clips: [makeHealthVideoClip()] }),
        createTrack({ id: 'track-audio', type: 'audio', name: 'Audio 1', clips: [] }),
        createTrack({ id: 'track-text', type: 'text', name: 'Text 1', clips: [] })
      ]
    };
    useEditorStore.getState().setProject({
      ...project,
      media: [missingAsset, orphanAsset],
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    commandManager.clear();
  },
  setupDuplicateMediaFixture: () => {
    const project = createProject('Duplicate Media E2E');
    const fingerprint = createVideoFingerprint(['ffff0000ffff0000', '0000ffff0000ffff', 'f0f0f0f00f0f0f0f']);
    const media: MediaAsset[] = [
      {
        id: 'media-duplicate-a',
        type: 'video',
        name: 'duplicate-a.mp4',
        path: duplicateVideoA,
        duration: 6,
        width: 1280,
        height: 720,
        size: 4096,
        mtimeMs: 1_000,
        hasAudio: true,
        audioChannels: 2,
        audioSampleRate: 44_100,
        audioCodec: 'aac',
        videoCodec: 'h264'
      },
      {
        id: 'media-duplicate-b',
        type: 'video',
        name: 'duplicate-b.mp4',
        path: duplicateVideoB,
        duration: 6,
        width: 1280,
        height: 720,
        size: 4096,
        mtimeMs: 1_000,
        hasAudio: true,
        audioChannels: 2,
        audioSampleRate: 44_100,
        audioCodec: 'aac',
        videoCodec: 'h264'
      }
    ];
    const timeline = {
      transitions: [],
      markers: [],
      tracks: [
        createTrack({ id: 'track-video', type: 'video', name: 'Video 1', clips: [makeDuplicateVideoClip()] }),
        createTrack({ id: 'track-audio', type: 'audio', name: 'Audio 1', clips: [] }),
        createTrack({ id: 'track-text', type: 'text', name: 'Text 1', clips: [] })
      ]
    };
    useEditorStore.getState().setProject({
      ...project,
      media,
      mediaMetadata: {
        'media-duplicate-a': { fingerprint },
        'media-duplicate-b': { fingerprint }
      },
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    commandManager.clear();
  },
  setupMediaOrganizerFixture: () => {
    const project = createProject('Media Organizer E2E');
    const fingerprint = createVideoFingerprint(['ffff0000ffff0000', '0000ffff0000ffff', 'f0f0f0f00f0f0f0f']);
    const media: MediaAsset[] = [
      {
        id: 'media-organizer-a',
        type: 'video',
        name: 'duplicate-a.mp4',
        path: duplicateVideoA,
        duration: 6,
        width: 1280,
        height: 720,
        size: 4096,
        mtimeMs: 1_000,
        hasAudio: true,
        audioChannels: 2,
        audioSampleRate: 44_100,
        audioCodec: 'aac',
        videoCodec: 'h264',
        importedAt: '2026-06-17T12:00:00.000Z'
      },
      {
        id: 'media-organizer-b',
        type: 'video',
        name: 'duplicate-b.mp4',
        path: duplicateVideoB,
        duration: 6,
        width: 1280,
        height: 720,
        size: 4096,
        mtimeMs: 1_000,
        hasAudio: true,
        audioChannels: 2,
        audioSampleRate: 44_100,
        audioCodec: 'aac',
        videoCodec: 'h264',
        importedAt: '2026-06-17T12:00:00.000Z'
      },
      {
        id: 'media-organizer-keep',
        type: 'video',
        name: 'duplicate-master.mp4',
        path: tinyVideo,
        duration: 6,
        width: 1920,
        height: 1080,
        size: 4096,
        mtimeMs: 1_000,
        hasAudio: true,
        audioChannels: 2,
        audioSampleRate: 44_100,
        audioCodec: 'aac',
        videoCodec: 'h264',
        importedAt: '2026-06-17T12:00:00.000Z'
      }
    ];
    const timeline = {
      transitions: [],
      markers: [],
      tracks: [
        createTrack({ id: 'track-video', type: 'video', name: 'Video 1', clips: [] }),
        createTrack({ id: 'track-audio', type: 'audio', name: 'Audio 1', clips: [] }),
        createTrack({ id: 'track-text', type: 'text', name: 'Text 1', clips: [] })
      ]
    };
    useEditorStore.getState().setProject({
      ...project,
      media,
      mediaMetadata: Object.fromEntries(media.map((asset) => [asset.id, { fingerprint }])),
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    commandManager.clear();
  },
  setupRenderFarmFixture: () => {
    const project = createProject('Render Farm E2E');
    const asset: MediaAsset = {
      id: 'media-render-farm',
      type: 'video',
      name: 'render-farm-long.mp4',
      path: tinyVideo,
      duration: 65,
      width: 1280,
      height: 720,
      size: 4096,
      mtimeMs: 1_000,
      hasAudio: true,
      audioChannels: 2,
      audioSampleRate: 44_100,
      audioCodec: 'aac',
      videoCodec: 'h264'
    };
    const timeline = {
      transitions: [],
      markers: [],
      tracks: [
        createTrack({ id: 'track-video', type: 'video', name: 'Video 1', clips: [makeRenderFarmVideoClip()] }),
        createTrack({ id: 'track-audio', type: 'audio', name: 'Audio 1', clips: [] }),
        createTrack({ id: 'track-text', type: 'text', name: 'Text 1', clips: [] })
      ]
    };
    useEditorStore.getState().setProject({
      ...project,
      media: [asset],
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    commandManager.clear();
    exportRunCalls = [];
    lastExportPreviewSamplesResult = undefined;
    exportPreviewRunCalls = [];
  },
  setupFrameSearchFixture: () => {
    const project = createProject('Frame Search E2E');
    const media: MediaAsset[] = [
      {
        id: 'media-opening',
        type: 'video',
        name: 'opening-shot.mov',
        path: tinyVideo,
        duration: 6,
        width: 1280,
        height: 720,
        size: 4096,
        mtimeMs: 1_000,
        hasAudio: true,
        audioChannels: 2,
        audioSampleRate: 44_100,
        audioCodec: 'aac',
        videoCodec: 'h264'
      },
      {
        id: 'media-interview',
        type: 'video',
        name: 'interview-take.mov',
        path: tinyVideoB,
        duration: 6,
        width: 1280,
        height: 720,
        size: 4096,
        mtimeMs: 1_000,
        hasAudio: true,
        audioChannels: 2,
        audioSampleRate: 44_100,
        audioCodec: 'aac',
        videoCodec: 'h264'
      }
    ];
    const timeline = {
      transitions: [],
      markers: [{ id: 'marker-action-beat', time: 2.5, label: 'Action Beat', color: '#f97316' }],
      tracks: [
        createTrack({
          id: 'track-video',
          type: 'video',
          name: 'Video 1',
          clips: [
            {
              id: 'clip-opening',
              type: 'video' as const,
              name: 'Opening Shot',
              mediaId: 'media-opening',
              trackId: 'track-video',
              start: 0,
              duration: 3,
              trimStart: 0,
              trimEnd: 0,
              speed: DEFAULT_CLIP_SPEED,
              colorCorrection: DEFAULT_COLOR_CORRECTION,
              transform: DEFAULT_TRANSFORM,
              volume: 1
            },
            {
              id: 'clip-interview',
              type: 'video' as const,
              name: 'Interview Clip',
              mediaId: 'media-interview',
              trackId: 'track-video',
              start: 3,
              duration: 3,
              trimStart: 0,
              trimEnd: 0,
              speed: DEFAULT_CLIP_SPEED,
              colorCorrection: DEFAULT_COLOR_CORRECTION,
              transform: DEFAULT_TRANSFORM,
              volume: 1
            }
          ]
        }),
        createTrack({ id: 'track-audio', type: 'audio', name: 'Audio 1', clips: [] }),
        createTrack({ id: 'track-text', type: 'text', name: 'Text 1', clips: [] })
      ]
    };
    useEditorStore.getState().setProject({
      ...project,
      settings: { fps: 24, timecodeFormat: 'ndf', width: 1280, height: 720 },
      media,
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    useEditorStore.getState().setSelectedClipIds([]);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },
  setupPrivacyBlurFixture: () => {
    const project = createProject('Privacy Blur E2E');
    const asset: MediaAsset = {
      id: 'media-privacy-video',
      type: 'video',
      name: 'privacy-source.mp4',
      path: tinyVideo,
      duration: 3,
      width: 1280,
      height: 720,
      size: 4096,
      mtimeMs: 1_000,
      hasAudio: true,
      audioChannels: 2,
      audioSampleRate: 44_100,
      audioCodec: 'aac',
      videoCodec: 'h264'
    };
    const clip: Extract<Clip, { type: 'video' }> = {
      id: 'clip-privacy-video',
      type: 'video',
      name: 'Privacy Source',
      mediaId: asset.id,
      trackId: 'track-video',
      start: 0,
      duration: 3,
      trimStart: 0,
      trimEnd: 0,
      speed: DEFAULT_CLIP_SPEED,
      colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
      transform: { ...DEFAULT_TRANSFORM },
      volume: 1
    };
    const timeline = {
      transitions: [],
      markers: [],
      tracks: [
        createTrack({ id: 'track-video', type: 'video', name: 'Video 1', clips: [clip] }),
        createTrack({ id: 'track-audio', type: 'audio', name: 'Audio 1', clips: [] }),
        createTrack({ id: 'track-text', type: 'text', name: 'Text 1', clips: [] })
      ]
    };
    useEditorStore.getState().setProject({
      ...project,
      media: [asset],
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    useEditorStore.getState().setSelectedClipIds([clip.id]);
    usePrivacyDetectionSettingsStore.getState().setModelPath(privacyDetectionModel);
    commandManager.clear();
  },
  getTimelineSnapshot: () => useEditorStore.getState().project.timeline,
  setProjectSnapshot: (project: unknown) => {
    if (!project || typeof project !== 'object') {
      throw new Error('Invalid setProjectSnapshot E2E action input.');
    }
    useEditorStore.getState().setProject(project as Project);
    useEditorStore.getState().setSelectedClipIds([]);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },
  getPlayheadTime: () => useEditorStore.getState().playheadTime,
  isPreviewWindowOpen: () => previewWindowState.open,
  closePreviewWindow: () => {
    previewWindowState = { ...previewWindowState, open: false };
    emit('preview-window-closed', previewWindowState);
    useEditorUIStore.getState().setPreviewWindowOpen(false);
  },
  getPreviewWindowState: () => previewWindowState,
  setPlayheadTime: (time: unknown) => {
    if (typeof time === 'number' && Number.isFinite(time)) {
      useEditorStore.getState().setPlayheadTime(time);
    }
  },
  enableMockCollaboration: async (input: unknown) => {
    const options = (input && typeof input === 'object' ? input : {}) as {
      mode?: 'host' | 'client';
      permission?: 'read-only' | 'edit';
      port?: number;
      userId?: string;
      name?: string;
      color?: string;
    };
    if (options.mode === 'host') {
      await collaborationController.enableHost({ port: options.port ?? 37822, userId: options.userId ?? 'local-e2e' });
    } else {
      await collaborationController.enableClient({ permission: options.permission ?? 'edit', userId: options.userId ?? 'local-e2e' });
    }
    collaborationController.updatePresence(useEditorStore.getState().playheadTime, options.name ?? 'E2E Local', options.color ?? '#38bdf8');
    return collaborationController.getState();
  },
  disableMockCollaboration: async () => {
    await collaborationController.disable();
    useCollaborationStore.getState().reset();
  },
  emitMockCollaborationMessage: (message: unknown) => {
    emit('collaboration-message', typeof message === 'string' ? message : JSON.stringify(message));
  },
  getCollaborationState: () => collaborationController.getState(),
  getCollaborationBroadcastMessages: () => [...collaborationBroadcastMessages],
  getCollaborationHostState: () => ({ active: collaborationHostActive, port: collaborationHostPort }),
  getSelectedClipIds: () => useEditorStore.getState().selectedClipIds,
  selectClip: (clipId: unknown) => {
    if (typeof clipId === 'string') {
      useEditorStore.getState().setSelectedClipId(clipId);
    }
  },
  enqueueMockMediaJob: (input: unknown) => {
    const job = input as { id?: string; assetId?: string; assetName?: string; type?: string; status?: string; progress?: number; priority?: string; error?: string };
    return useMediaJobStore.getState().enqueueMonitorJob({
      id: job.id,
      assetId: job.assetId ?? 'mock-asset',
      assetName: job.assetName ?? 'mock-task.mov',
      type: job.type === 'gif-preview' || job.type === 'vfr-conversion' || job.type === 'frame-rate-conversion' || job.type === 'stabilization-analysis' || job.type === 'waveform' ? job.type : 'proxy',
      status: job.status === 'running' || job.status === 'success' || job.status === 'error' || job.status === 'canceled' ? job.status : 'pending',
      progress: typeof job.progress === 'number' ? job.progress : 0,
      priority: job.priority === 'high' ? 'high' : 'low',
      error: job.error
    });
  },
  getMediaJobs: () => useMediaJobStore.getState().jobs,
  getExportRanges: () => useEditorStore.getState().project.exportRanges,
  getProjectSnapshot: () => useEditorStore.getState().project,
  getProjectMedia: () => useEditorStore.getState().project.media,
  setOpenFileDialogPaths: (paths: unknown) => {
    openFileDialogPaths = Array.isArray(paths) ? (paths as string[]) : [];
  },
  setSavePath: (path: unknown) => {
    if (typeof path === 'string') {
      savePath = path;
    }
  },
  setDamagedMediaPaths: (paths: unknown) => {
    damagedMediaPaths.clear();
    if (Array.isArray(paths)) {
      for (const path of paths) {
        if (typeof path === 'string') {
          damagedMediaPaths.add(path);
        }
      }
    }
  },
  setOpenDirectoryPath: (path: unknown) => {
    if (typeof path === 'string') {
      openDirectoryPath = path;
    }
  },
  setSceneDetectionTimes: (times: unknown) => {
    mockSceneTimes = Array.isArray(times) ? times.filter((time): time is number => typeof time === 'number' && Number.isFinite(time)) : [1];
  },
  setAvailableMemoryBytes: (bytes: unknown) => {
    if (typeof bytes === 'number' && Number.isFinite(bytes)) {
      availableMemoryBytes = bytes;
    }
  },
  setExportWarmupDelay: (delayMs: unknown) => {
    if (typeof delayMs === 'number' && Number.isFinite(delayMs)) {
      exportWarmupDelayMs = Math.max(0, delayMs);
    }
  },
  setProxyGenerationDelay: (delayMs: unknown) => {
    if (typeof delayMs === 'number' && Number.isFinite(delayMs)) {
      proxyGenerationDelayMs = Math.max(0, delayMs);
    }
  },
  setPostExportQualityStatus: (status: unknown) => {
    postExportQualityStatus = status === 'warning' || status === 'fail' ? status : 'pass';
  },
  setNextExportError: (message: unknown) => {
    nextExportError = typeof message === 'string' && message.trim() ? message : undefined;
  },
  getWrittenFile: (path: unknown) => (typeof path === 'string' ? files.get(path) : undefined),
  getWrittenFileSize: (path: unknown) => (typeof path === 'string' ? files.get(path)?.length ?? 0 : 0),
  setPresetMarketCache: (contents: unknown) => {
    if (typeof contents !== 'string') {
      throw new Error('Invalid setPresetMarketCache E2E action input.');
    }
    files.set(presetMarketCachePath, contents);
    exists.set(presetMarketCachePath, true);
    mtimes.set(presetMarketCachePath, Date.now());
    persistFiles();
  },
  getPresetMarketCachePath: () => presetMarketCachePath,
  setEffectPresetCommunityCache: (contents: unknown) => {
    if (typeof contents !== 'string') {
      throw new Error('Invalid setEffectPresetCommunityCache E2E action input.');
    }
    files.set(effectPresetCommunityCachePath, contents);
    exists.set(effectPresetCommunityCachePath, true);
    mtimes.set(effectPresetCommunityCachePath, Date.now());
    persistFiles();
  },
  setEffectPresetCommunityResponse: (contents: unknown) => {
    if (typeof contents !== 'string') {
      throw new Error('Invalid setEffectPresetCommunityResponse E2E action input.');
    }
    effectPresetCommunityResponse = contents;
  },
  getEffectPresetCommunityCachePath: () => effectPresetCommunityCachePath,
  getReleaseFiles: () => Array.from(files.keys()).filter((path) => path.includes('/releases/') && path.endsWith('.json') && exists.get(path) !== false),
  getBackupFiles: (path: unknown) => {
    if (typeof path !== 'string') {
      return [];
    }
    const root = path.replace(/[\\/]+$/, '');
    return Array.from(files.keys()).filter((candidate) => candidate.startsWith(`${root}/`) && candidate.endsWith('.cutproj.json') && exists.get(candidate) !== false);
  },
  getLastConfirmMessage: () => lastConfirmMessage,
  getLastExportPlan: () => lastExportPlan,
  getExportRunCalls: () => exportRunCalls,
  getLastExportPreviewSamplesResult: () => lastExportPreviewSamplesResult,
  getExportPreviewRunCalls: () => exportPreviewRunCalls,
  getLastGifExportRequest: () => lastGifExportRequest,
  getLastGifPreviewRequest: () => lastGifPreviewRequest,
  getLastTrayProgress: () => lastTrayProgress,
  wasMinimizedToTray: () => minimizedToTray,
  getPowerActionCalls: () => powerActionCalls,
  getNotifications: () => notifications,
  getLastWebdavPutRequest: () => lastWebdavPutRequest,
  getLastWebdavExportUploadRequest: () => lastWebdavExportUploadRequest,
  getLastSmtpEmailRequest: () => lastSmtpEmailRequest,
  getLastWebhookJsonRequest: () => lastWebhookJsonRequest,
  addKeyframe: (clipId: unknown, property: unknown, time: unknown, value: unknown) => {
    if (typeof clipId !== 'string' || !isKeyframeProperty(property) || typeof time !== 'number' || typeof value !== 'number') {
      throw new Error('Invalid addKeyframe E2E action input.');
    }
    commandManager.execute(new AddKeyframeCommand(timelineAccessor, clipId, property, { time, value, easing: 'linear' }));
  },
  getCacheKeys: () => Array.from(cache.keys()),
  holdExportGate: () => {
    exportGateHeld = true;
  },
  releaseExportGate: () => {
    const next = exportGates.shift();
    next?.release();
    exportGateHeld = exportGates.length > 0;
  },
  releaseAllExportGates: () => {
    while (exportGates.length > 0) {
      exportGates.shift()?.release();
    }
    exportGateHeld = false;
  },
  setMissingProjectNext: () => {
    openFileDialogPaths = [missingProjectPath];
  },
  setBatchMissingProjectNext: () => {
    openFileDialogPaths = [batchMissingProjectPath];
  },
  getFileExists: (path: unknown) => (typeof path === 'string' ? exists.get(path) ?? false : false),
  setMockFile: (path: unknown, contents: unknown) => {
    if (typeof path !== 'string' || typeof contents !== 'string') {
      throw new Error('Invalid setMockFile E2E action input.');
    }
    files.set(path, contents);
    exists.set(path, true);
    mtimes.set(path, Date.now());
    persistFiles();
  },
  setMockMtime: (path: unknown, mtimeMsValue: unknown) => {
    if (typeof path !== 'string' || typeof mtimeMsValue !== 'number' || !Number.isFinite(mtimeMsValue)) {
      throw new Error('Invalid setMockMtime E2E action input.');
    }
    mtimes.set(path, mtimeMsValue);
    persistFiles();
  },
  setTutorialProgress: (settings: unknown) => {
    const input = settings && typeof settings === 'object' ? (settings as Record<string, unknown>) : {};
    writeTutorialProgressSettings(
      {
        tutorialStep: typeof input.tutorialStep === 'number' && Number.isFinite(input.tutorialStep) ? Math.round(input.tutorialStep) : 0,
        tutorialSkipped: input.tutorialSkipped === true,
        tutorialCompleted: input.tutorialCompleted === true
      },
      true
    );
  },
  clearE2eFiles: () => {
    canceledExportTaskIds.clear();
    canceledTranscodeTaskIds.clear();
    canceledQualityEvaluationTaskIds.clear();
    useExportQueueStore.setState({
      tasks: [],
      history: [],
      runnerActive: false,
      resourcePaused: false,
      queuePaused: false,
      maxConcurrent: 2,
      lastCompletedPath: undefined
    });
    localStorage.removeItem(PERSISTED_FILES_KEY);
    localStorage.removeItem(PERSISTED_MTIMES_KEY);
    localStorage.removeItem(PERSISTED_WEBDAV_TEXT_KEY);
    localStorage.removeItem('open-factory:demucs-executable-path');
    localStorage.removeItem('open-factory:privacy-detection-model-path');
    usePrivacyDetectionSettingsStore.getState().setModelPath('');
    localStorage.removeItem('open-factory:recording-width');
    localStorage.removeItem('open-factory:recording-height');
    localStorage.removeItem('open-factory:recording-frame-rate');
    for (const path of Array.from(files.keys()).filter((item) => item.endsWith('.autosave'))) {
      files.delete(path);
      exists.set(path, false);
      mtimes.delete(path);
    }
    for (const path of Array.from(files.keys()).filter((item) => item.includes('/snapshots/') || item.includes('/releases/'))) {
      files.delete(path);
      exists.set(path, false);
      mtimes.delete(path);
    }
    files.delete(exportPresetsPath);
    exists.set(exportPresetsPath, false);
    mtimes.delete(exportPresetsPath);
    files.delete(subtitleStylesPath);
    exists.set(subtitleStylesPath, false);
    mtimes.delete(subtitleStylesPath);
    files.delete(lutFavoritesPath);
    exists.set(lutFavoritesPath, false);
    mtimes.delete(lutFavoritesPath);
    files.delete(keybindingsPath);
    exists.set(keybindingsPath, false);
    mtimes.delete(keybindingsPath);
    files.delete(macrosPath);
    exists.set(macrosPath, false);
    mtimes.delete(macrosPath);
    files.delete(macroHistoryPath);
    exists.set(macroHistoryPath, false);
    mtimes.delete(macroHistoryPath);
    files.delete(settingsPath);
    exists.set(settingsPath, false);
    mtimes.delete(settingsPath);
    ensureTutorialSkippedByDefault(false);
    files.delete(exportQueueStatePath);
    exists.set(exportQueueStatePath, false);
    mtimes.delete(exportQueueStatePath);
    lastGifExportRequest = undefined;
    lastGifPreviewRequest = undefined;
    files.delete(pluginCatalogCachePath);
    exists.set(pluginCatalogCachePath, false);
    mtimes.delete(pluginCatalogCachePath);
    files.delete(presetMarketCachePath);
    exists.set(presetMarketCachePath, false);
    mtimes.delete(presetMarketCachePath);
    files.delete(presetMarketRatingsPath);
    exists.set(presetMarketRatingsPath, false);
    mtimes.delete(presetMarketRatingsPath);
    files.delete(effectPresetCommunityCachePath);
    exists.set(effectPresetCommunityCachePath, false);
    mtimes.delete(effectPresetCommunityCachePath);
    for (const path of Array.from(files.keys()).filter((item) => item.includes('/market-cache/installed/'))) {
      files.delete(path);
      exists.set(path, false);
      mtimes.delete(path);
    }
    for (const path of Array.from(files.keys()).filter((item) => item.includes('/effect-presets/') && item.endsWith('.ofeffect.json'))) {
      files.delete(path);
      exists.set(path, false);
      mtimes.delete(path);
    }
    for (const path of Array.from(files.keys()).filter((item) => item.includes('/scripts/') && item.endsWith('.js'))) {
      files.delete(path);
      exists.set(path, false);
      mtimes.delete(path);
    }
    for (const path of [devPluginManifestPath, devPluginEntryPath]) {
      files.delete(path);
      exists.set(path, false);
      mtimes.delete(path);
    }
    for (const path of Array.from(files.keys()).filter((item) => item.includes('/Backups/') || item.startsWith('C:/Backups/'))) {
      files.delete(path);
      exists.set(path, false);
      mtimes.delete(path);
    }
    for (const path of Array.from(files.keys()).filter((item) => item.includes('/shared-library/') || item.includes('/timeline-templates/'))) {
      files.delete(path);
      exists.set(path, false);
      mtimes.delete(path);
    }
    webdavPassword = undefined;
    exportUploadWebdavPassword = undefined;
    exportPresetSyncWebdavPassword = undefined;
    translationApiKeys.clear();
    aiApiKeys.clear();
    lastWebdavPutRequest = undefined;
    lastWebdavExportUploadRequest = undefined;
    lastWebdavTextPutRequest = undefined;
    lastSmtpEmailRequest = undefined;
    lastWebhookJsonRequest = undefined;
    webdavTextFiles.clear();
    lastExportPlan = undefined;
    exportRunCalls = [];
    lastExportPreviewSamplesResult = undefined;
    exportPreviewRunCalls = [];
    minimizedToTray = false;
    previewWindowState = {
      open: false,
      label: 'preview',
      bounds: { width: 960, height: 540 },
      alwaysOnTop: false,
      fullscreen: false,
      resolutionScale: 1
    };
    lastTrayProgress = undefined;
    powerActionCalls = [];
    notifications = [];
    recordingTasks = new Map();
    collaborationHostActive = false;
    collaborationHostPort = 37822;
    collaborationBroadcastMessages = [];
    void collaborationController.disable();
    useCollaborationStore.getState().reset();
    exportWarmupDelayMs = 0;
    proxyGenerationDelayMs = 10;
    nextExportError = undefined;
    postExportQualityStatus = 'pass';
    localStorage.removeItem('open-factory:proxy-settings');
    localStorage.removeItem('open-factory:plugins');
    localStorage.removeItem('open-factory:settings');
    ensureTutorialSkippedByDefault(true);
  },
  clearExportPresets: () => {
    files.delete(exportPresetsPath);
    exists.set(exportPresetsPath, false);
    mtimes.delete(exportPresetsPath);
    persistFiles();
  },
  setExportPresetSyncRemotePackage: (url: unknown, contents: unknown) => {
    if (typeof url === 'string' && typeof contents === 'string') {
      webdavTextFiles.set(url, contents);
      persistFiles();
    }
  },
  getExportPresetSyncRemotePackage: (url: unknown) => (typeof url === 'string' ? webdavTextFiles.get(url) : undefined),
  getLastWebdavTextPutRequest: () => lastWebdavTextPutRequest,
  setExportPresetSyncSettings: (settings: unknown, password: unknown) => {
    const currentSettings = files.has(settingsPath) ? JSON.parse(files.get(settingsPath) ?? '{}') : {};
    files.set(settingsPath, JSON.stringify({ ...currentSettings, exportPresetSync: settings }, null, 2));
    exists.set(settingsPath, true);
    mtimes.set(settingsPath, Date.now());
    exportPresetSyncWebdavPassword = typeof password === 'string' && password.trim() ? password : undefined;
    persistFiles();
  },
  refreshPluginRegistry: () => refreshPluginRegistry(),
  getPluginHookLog: () => getPluginHookLog(),
  clearPluginHookLog: () => clearPluginHookLog(),
  installDevReloadPlugin: (version: unknown = 'v1') => {
    files.set(devPluginManifestPath, makeDevPluginManifest());
    files.set(devPluginEntryPath, makeDevPluginEntry(typeof version === 'string' ? version : 'v1'));
    exists.set(devPluginDir, true);
    exists.set(devPluginManifestPath, true);
    exists.set(devPluginEntryPath, true);
    const now = Date.now();
    mtimes.set(devPluginManifestPath, now);
    mtimes.set(devPluginEntryPath, now);
    persistFiles();
    return refreshPluginRegistry();
  },
  updateDevReloadPlugin: (version: unknown = 'v2') => {
    files.set(devPluginEntryPath, makeDevPluginEntry(typeof version === 'string' ? version : 'v2'));
    exists.set(devPluginEntryPath, true);
    mtimes.set(devPluginEntryPath, Date.now());
    persistFiles();
  },
  setupAIServiceConfigFixture: () => {
    const project = createProject('AI Service Config E2E');
    const timeline = { transitions: [], markers: [], tracks: [] };
    useEditorStore.getState().setProject({
      ...project,
      media: [],
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    useEditorStore.getState().setSelectedClipIds([]);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },
  setupAISubtitlePolishFixture: async () => {
    const project = createProject('AI Subtitle Polish E2E');
    const sub1 = makeMockSubtitleClip('ai-sub-1', 'track-ai-subtitle', '你好，世界', 0);
    const sub2 = makeMockSubtitleClip('ai-sub-2', 'track-ai-subtitle', '今天天气很好', 2);
    const sub3 = makeMockSubtitleClip('ai-sub-3', 'track-ai-subtitle', '我们去散步吧', 4);
    const timeline = {
      transitions: [],
      markers: [],
      tracks: [
        createTrack({ id: 'track-ai-video', type: 'video', name: 'Video 1', clips: [] }),
        createTrack({ id: 'track-ai-subtitle', type: 'subtitle', name: 'AI Subtitles', language: 'zh', clips: [sub1, sub2, sub3] })
      ]
    };
    useEditorStore.getState().setProject({
      ...project,
      media: [],
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    await useAISettingsStore.getState().setProviderApiKey('mimo', 'test-mimo-key');
    useAISettingsStore.getState().toggleProvider('mimo', true);
    useAISettingsStore.getState().setServiceMapping('subtitle-polish', 'mimo');
    useEditorStore.getState().setSelectedClipIds(['ai-sub-1', 'ai-sub-2', 'ai-sub-3']);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },
  setupAIChapterTitlesFixture: async () => {
    const project = createProject('AI Chapter Titles E2E');
    const sub1 = makeMockSubtitleClip('ai-ch-sub-1', 'track-ai-chapter', '开场白，大家好', 0);
    const sub2 = makeMockSubtitleClip('ai-ch-sub-2', 'track-ai-chapter', '今天我们来聊聊天气', 40);
    const sub3 = makeMockSubtitleClip('ai-ch-sub-3', 'track-ai-chapter', '户外散步真舒服', 80);
    const timeline = {
      transitions: [],
      markers: [],
      tracks: [
        createTrack({ id: 'track-ai-video', type: 'video', name: 'Video 1', clips: [] }),
        createTrack({ id: 'track-ai-chapter', type: 'subtitle', name: 'AI Chapter Subtitles', language: 'zh', clips: [sub1, sub2, sub3] })
      ]
    };
    useEditorStore.getState().setProject({
      ...project,
      media: [],
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    await useAISettingsStore.getState().setProviderApiKey('mimo', 'test-mimo-key');
    useAISettingsStore.getState().toggleProvider('mimo', true);
    useAISettingsStore.getState().setServiceMapping('chapter-title', 'mimo');
    useEditorStore.getState().setSelectedClipIds(['ai-ch-sub-1']);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },
  setupAIChatEditorFixture: async () => {
    const project = createProject('AI Chat Editor E2E');
    const videoClip = {
      id: 'clip-chat-video',
      type: 'video' as const,
      name: 'chat-video.mp4',
      mediaId: 'media-chat-video',
      trackId: 'track-chat-video',
      start: 0,
      duration: 6,
      trimStart: 0,
      trimEnd: 0,
      speed: DEFAULT_CLIP_SPEED,
      colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
      transform: { ...DEFAULT_TRANSFORM },
      volume: 1
    };
    const timeline = {
      transitions: [],
      markers: [],
      tracks: [
        createTrack({ id: 'track-chat-video', type: 'video', name: 'Video 1', clips: [videoClip] })
      ]
    };
    useEditorStore.getState().setProject({
      ...project,
      media: [{
        id: 'media-chat-video',
        type: 'video' as const,
        name: 'chat-video.mp4',
        path: tinyVideo,
        duration: 6,
        width: 1280,
        height: 720,
        size: 4096,
        mtimeMs: 1_000,
        hasAudio: true,
        audioChannels: 2,
        audioSampleRate: 48_000,
        audioCodec: 'aac'
      }],
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    await useAISettingsStore.getState().setProviderApiKey('openai', 'test-openai-key');
    useAISettingsStore.getState().toggleProvider('openai', true);
    useEditorStore.getState().setSelectedClipIds(['clip-chat-video']);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },
  setupAIVideoSummaryFixture: async () => {
    const project = createProject('AI Video Summary E2E');
    const asset: MediaAsset = {
      id: 'media-summary-video',
      type: 'video',
      name: 'summary-video.mp4',
      path: tinyVideo,
      duration: 6,
      width: 1280,
      height: 720,
      size: 4096,
      mtimeMs: 1_000,
      hasAudio: true,
      audioChannels: 2,
      audioSampleRate: 48_000,
      audioCodec: 'aac'
    };
    const videoClip = {
      id: 'clip-summary-video',
      type: 'video' as const,
      name: 'summary-video.mp4',
      mediaId: 'media-summary-video',
      trackId: 'track-summary-video',
      start: 0,
      duration: 6,
      trimStart: 0,
      trimEnd: 0,
      speed: DEFAULT_CLIP_SPEED,
      colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
      transform: { ...DEFAULT_TRANSFORM },
      volume: 1
    };
    const timeline = {
      transitions: [],
      markers: [],
      tracks: [
        createTrack({ id: 'track-summary-video', type: 'video', name: 'Video 1', clips: [videoClip] })
      ]
    };
    useEditorStore.getState().setProject({
      ...project,
      media: [asset],
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    await useAISettingsStore.getState().setProviderApiKey('openai', 'test-openai-key');
    useAISettingsStore.getState().updateProvider('openai', { defaultModel: 'gpt-4o' });
    useAISettingsStore.getState().toggleProvider('openai', true);
    useAISettingsStore.getState().setServiceMapping('video-summary', 'openai');
    commandManager.clear();
  },
  setupAINarrationScriptFixture: async () => {
    const project = createProject('AI Narration Script E2E');
    const videoClip = {
      id: 'clip-narration-video',
      type: 'video' as const,
      name: 'narration-video.mp4',
      mediaId: 'media-narration-video',
      trackId: 'track-narration-video',
      start: 0,
      duration: 8,
      trimStart: 0,
      trimEnd: 0,
      speed: DEFAULT_CLIP_SPEED,
      colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
      transform: { ...DEFAULT_TRANSFORM },
      volume: 1
    };
    const timeline = {
      transitions: [],
      markers: [
        { time: 0, label: '开场', id: 'marker-narr-0', color: '#3b82f6' },
        { time: 3, label: '中段', id: 'marker-narr-1', color: '#22c55e' },
        { time: 6, label: '结尾', id: 'marker-narr-2', color: '#f59e0b' },
      ],
      tracks: [
        createTrack({ id: 'track-narration-video', type: 'video', name: 'Video 1', clips: [videoClip] })
      ]
    };
    useEditorStore.getState().setProject({
      ...project,
      media: [{
        id: 'media-narration-video',
        type: 'video' as const,
        name: 'narration-video.mp4',
        path: tinyVideo,
        duration: 8,
        width: 1280,
        height: 720,
        size: 4096,
        mtimeMs: 1_000,
        hasAudio: true,
        audioChannels: 2,
        audioSampleRate: 48_000,
        audioCodec: 'aac'
      }],
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    await useAISettingsStore.getState().setProviderApiKey('openai', 'test-openai-key');
    useAISettingsStore.getState().toggleProvider('openai', true);
    useAISettingsStore.getState().setServiceMapping('narration-script', 'openai');
    commandManager.clear();
  },
  setupAIUsageStatsFixture: async () => {
    const project = createProject('AI Usage Stats E2E');
    const timeline = { transitions: [], markers: [], tracks: [] };
    useEditorStore.getState().setProject({
      ...project,
      media: [],
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    await useAISettingsStore.getState().setProviderApiKey('openai', 'test-openai-key');
    useAISettingsStore.getState().toggleProvider('openai', true);
    // Add 3 usage records for different AI features
    const now = Date.now();
    useAISettingsStore.getState().addUsageRecord({
      providerId: 'openai',
      timestamp: now,
      inputTokens: 100,
      outputTokens: 50,
      estimatedCostCny: 0.05,
      service: 'subtitle-polish'
    });
    useAISettingsStore.getState().addUsageRecord({
      providerId: 'openai',
      timestamp: now - 60000,
      inputTokens: 200,
      outputTokens: 100,
      estimatedCostCny: 0.10,
      service: 'chapter-title'
    });
    useAISettingsStore.getState().addUsageRecord({
      providerId: 'openai',
      timestamp: now - 120000,
      inputTokens: 150,
      outputTokens: 80,
      estimatedCostCny: 0.08,
      service: 'narration-script'
    });
    commandManager.clear();
  },
  setupAIContentTagsFixture: async () => {
    const project = createProject('AI Content Tags E2E');
    const assetId = 'media-ai-content-video';
    const asset: MediaAsset = {
      id: assetId,
      type: 'video',
      name: 'ai-content-video.mp4',
      path: tinyVideo,
      duration: 30,
      width: 1280,
      height: 720,
      size: 4096,
      mtimeMs: 1_000,
      hasAudio: false
    };
    const timeline = { transitions: [], markers: [], tracks: [] };
    useEditorStore.getState().setProject({
      ...project,
      media: [asset],
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    await useAISettingsStore.getState().setProviderApiKey('mimo', 'test-mimo-key');
    useAISettingsStore.getState().updateProvider('mimo', { defaultModel: 'gpt-4o' });
    useAISettingsStore.getState().toggleProvider('mimo', true);
    useAISettingsStore.getState().setServiceMapping('vision-analysis', 'mimo');
    useEditorStore.getState().setSelectedClipIds([]);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },
  setupAISemanticSearchFixture: async () => {
    const project = createProject('AI Semantic Search E2E');
    const assetA: MediaAsset = {
      id: 'media-ai-search-a', type: 'video', name: 'outdoor-sunny.mp4',
      path: tinyVideo, duration: 30, width: 1280, height: 720, size: 4096, mtimeMs: 1_000, hasAudio: false,
      aiAnalysis: { tags: ['户外', '阳光'], scene: '阳光明媚的户外场景', mood: '愉快', objects: ['天空', '草地'], analysisTime: new Date().toISOString(), providerId: 'mimo' }
    };
    const assetB: MediaAsset = {
      id: 'media-ai-search-b', type: 'video', name: 'park-walk.mp4',
      path: tinyVideo, duration: 20, width: 1280, height: 720, size: 3072, mtimeMs: 1_000, hasAudio: false,
      aiAnalysis: { tags: ['户外', '散步'], scene: '公园散步场景', mood: '放松', objects: ['树木', '小路'], analysisTime: new Date().toISOString(), providerId: 'mimo' }
    };
    const assetC: MediaAsset = {
      id: 'media-ai-search-unanalyzed', type: 'video', name: 'unanalyzed-clip.mp4',
      path: tinyVideo, duration: 10, width: 640, height: 360, size: 2048, mtimeMs: 1_000, hasAudio: false
    };
    const timeline = { transitions: [], markers: [], tracks: [] };
    useEditorStore.getState().setProject({
      ...project,
      media: [assetA, assetB, assetC],
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    await useAISettingsStore.getState().setProviderApiKey('mimo', 'test-mimo-key');
    useAISettingsStore.getState().updateProvider('mimo', { defaultModel: 'gpt-4o' });
    useAISettingsStore.getState().toggleProvider('mimo', true);
    useEditorStore.getState().setSelectedClipIds([]);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },
  setupAISceneMatchFixture: async () => {
    const project = createProject('AI Scene Match E2E');
    const assetA: MediaAsset = {
      id: 'media-scene-match-a', type: 'video', name: 'outdoor-sunny.mp4',
      path: tinyVideo, duration: 30, width: 1280, height: 720, size: 4096, mtimeMs: 1_000, hasAudio: false,
      aiAnalysis: { tags: ['outdoor', 'sunny'], scene: 'outdoor sunny scene', mood: 'cheerful', objects: ['sky', 'grass'], analysisTime: new Date().toISOString(), providerId: 'mimo' }
    };
    const assetB: MediaAsset = {
      id: 'media-scene-match-b', type: 'video', name: 'park-walk.mp4',
      path: tinyVideo, duration: 20, width: 1280, height: 720, size: 3072, mtimeMs: 1_000, hasAudio: false,
      aiAnalysis: { tags: ['outdoor', 'walk'], scene: 'park walking scene', mood: 'relaxed', objects: ['trees', 'path'], analysisTime: new Date().toISOString(), providerId: 'mimo' }
    };
    const assetC: MediaAsset = {
      id: 'media-scene-match-c', type: 'video', name: 'nature-forest.mp4',
      path: tinyVideo, duration: 15, width: 1280, height: 720, size: 3072, mtimeMs: 1_000, hasAudio: false,
      aiAnalysis: { tags: ['nature', 'forest'], scene: 'forest nature scene', mood: 'calm', objects: ['trees', 'river'], analysisTime: new Date().toISOString(), providerId: 'mimo' }
    };
    const assetD: MediaAsset = {
      id: 'media-scene-match-d', type: 'video', name: 'night-city.mp4',
      path: tinyVideo, duration: 25, width: 1280, height: 720, size: 3072, mtimeMs: 1_000, hasAudio: false,
      aiAnalysis: { tags: ['night', 'city'], scene: 'night cityscape', mood: 'moody', objects: ['buildings', 'lights'], analysisTime: new Date().toISOString(), providerId: 'mimo' }
    };
    const assetE: MediaAsset = {
      id: 'media-scene-match-e', type: 'video', name: 'unanalyzed-1.mp4',
      path: tinyVideo, duration: 10, width: 640, height: 360, size: 2048, mtimeMs: 1_000, hasAudio: false
    };
    const assetF: MediaAsset = {
      id: 'media-scene-match-f', type: 'video', name: 'unanalyzed-2.mp4',
      path: tinyVideo, duration: 8, width: 640, height: 360, size: 2048, mtimeMs: 1_000, hasAudio: false
    };
    const clipA = {
      id: 'scene-match-clip-a', type: 'video' as const, name: 'outdoor-sunny.mp4',
      mediaId: 'media-scene-match-a', trackId: 'track-scene-match-video', start: 0, duration: 30,
      trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, transform: { ...DEFAULT_TRANSFORM },
      colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, effects: [], keyframes: {}, volume: 1
    };
    const timeline = {
      transitions: [],
      markers: [],
      tracks: [
        createTrack({ id: 'track-scene-match-video', type: 'video', name: 'Video 1', clips: [clipA] })
      ]
    };
    useEditorStore.getState().setProject({
      ...project,
      media: [assetA, assetB, assetC, assetD, assetE, assetF],
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    await useAISettingsStore.getState().setProviderApiKey('mimo', 'test-mimo-key');
    useAISettingsStore.getState().updateProvider('mimo', { defaultModel: 'gpt-4o' });
    useAISettingsStore.getState().toggleProvider('mimo', true);
    useEditorStore.getState().setSelectedClipIds(['scene-match-clip-a']);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },
  setupAISubtitleStyleFixture: async () => {
    const project = createProject('AI Subtitle Style E2E');
    const assetVideo: MediaAsset = {
      id: 'media-sub-style-video', type: 'video', name: 'style-video.mp4',
      path: tinyVideo, duration: 30, width: 1920, height: 1080, size: 4096, mtimeMs: 1_000, hasAudio: false,
      aiAnalysis: { tags: ['outdoor', 'sunny'], scene: 'outdoor sunny scene', mood: 'cheerful', objects: ['sky'], analysisTime: new Date().toISOString(), providerId: 'mimo' }
    };
    const sub1 = makeMockSubtitleClip('sub-style-1', 'track-sub-style-subtitle', '你好，世界', 0);
    const sub2 = makeMockSubtitleClip('sub-style-2', 'track-sub-style-subtitle', '今天天气真好', 3);
    const sub3 = makeMockSubtitleClip('sub-style-3', 'track-sub-style-subtitle', '我们去散步吧', 6);
    const timeline = {
      transitions: [],
      markers: [],
      tracks: [
        createTrack({ id: 'track-sub-style-video', type: 'video', name: 'Video 1', clips: [] }),
        createTrack({ id: 'track-sub-style-subtitle', type: 'subtitle', name: 'Style Subtitles', language: 'zh', clips: [sub1, sub2, sub3] })
      ]
    };
    useEditorStore.getState().setProject({
      ...project,
      media: [assetVideo],
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    await useAISettingsStore.getState().setProviderApiKey('mimo', 'test-mimo-key');
    useAISettingsStore.getState().updateProvider('mimo', { defaultModel: 'gpt-4o' });
    useAISettingsStore.getState().toggleProvider('mimo', true);
    useEditorStore.getState().setSelectedClipIds(['sub-style-1']);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },
  setupAITtsVoiceoverFixture: async () => {
    const project = createProject('AI TTS Voiceover E2E');
    const sub1 = makeMockSubtitleClip('tts-sub-1', 'track-tts-subtitle', '你好，欢迎来到我们的频道', 0);
    const sub2 = makeMockSubtitleClip('tts-sub-2', 'track-tts-subtitle', '今天给大家介绍新产品', 3);
    const sub3 = makeMockSubtitleClip('tts-sub-3', 'track-tts-subtitle', '感谢观看，下期再见', 6);
    const timeline = {
      transitions: [],
      markers: [],
      tracks: [
        createTrack({ id: 'track-tts-video', type: 'video', name: 'Video 1', clips: [] }),
        createTrack({ id: 'track-tts-subtitle', type: 'subtitle', name: 'TTS Subtitles', language: 'zh', clips: [sub1, sub2, sub3] })
      ]
    };
    useEditorStore.getState().setProject({
      ...project,
      media: [],
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    await useAISettingsStore.getState().setProviderApiKey('mimo', 'test-mimo-key');
    useAISettingsStore.getState().toggleProvider('mimo', true);
    useAISettingsStore.getState().setServiceMapping('voiceover', 'mimo');
    useAISettingsStore.getState().setTtsVoiceId('mock-voice-id');
    useEditorStore.getState().setSelectedClipIds(['tts-sub-1']);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },
  setupAIExportSuggestionFixture: async () => {
    const project = createProject('AI Export Suggestion E2E');
    const assetId = 'media-export-suggest-video';
    const asset: MediaAsset = {
      id: assetId,
      type: 'video',
      name: 'export-suggest-video.mp4',
      path: tinyVideo,
      duration: 30,
      width: 3840,
      height: 2160,
      size: 4096,
      mtimeMs: 1_000,
      hasAudio: true
    };
    const clipV = {
      id: 'es-clip-video',
      type: 'video' as const,
      name: 'export-suggest-video.mp4',
      mediaId: assetId,
      trackId: 'track-es-video',
      start: 0,
      duration: 30,
      trimStart: 0,
      trimEnd: 0,
      speed: DEFAULT_CLIP_SPEED,
      transform: { ...DEFAULT_TRANSFORM },
      colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
      effects: [],
      keyframes: {},
      volume: 1
    };
    const timeline = {
      transitions: [],
      markers: [],
      tracks: [
        createTrack({ id: 'track-es-video', type: 'video', name: 'Video 1', clips: [clipV] }),
        createTrack({ id: 'track-es-audio', type: 'audio', name: 'Audio 1', clips: [] })
      ]
    };
    useEditorStore.getState().setProject({
      ...project,
      media: [asset],
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    await useAISettingsStore.getState().setProviderApiKey('openai', 'test-openai-key');
    useAISettingsStore.getState().toggleProvider('openai', true);
    useAISettingsStore.getState().setServiceMapping('export-suggestion', 'openai');
    commandManager.clear();
  },
  setupAIQualityAssessmentFixture: async () => {
    const project = createProject('AI Quality Assessment E2E');
    const asset: MediaAsset = {
      id: 'media-qa-a', type: 'video', name: 'quality-test.mp4',
      path: tinyVideo, duration: 30, width: 1280, height: 720, size: 4096, mtimeMs: 1_000, hasAudio: false
    };
    const timeline = { transitions: [], markers: [], tracks: [createTrack({ id: 'track-qa-video', type: 'video', name: 'Video 1', clips: [] })] };
    useEditorStore.getState().setProject({
      ...project,
      media: [asset],
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    await useAISettingsStore.getState().setProviderApiKey('mimo', 'test-mimo-key');
    useAISettingsStore.getState().updateProvider('mimo', { defaultModel: 'gpt-4o' });
    useAISettingsStore.getState().toggleProvider('mimo', true);
    useEditorStore.getState().setSelectedClipIds([]);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },
  setupDirectorModeFixture: async () => {
    const project = createProject('Director Mode E2E');
    const mediaAssets: MediaAsset[] = [
      {
        id: 'media-director-a', type: 'video', name: 'product-intro.mp4', path: tinyVideo,
        duration: 5, width: 1920, height: 1080, size: 8192, mtimeMs: 1_000, hasAudio: true,
        aiAnalysis: { tags: ['产品', '外观'], scene: '产品展示', mood: '专业', objects: ['产品'], analysisTime: '2025-01-01T00:00:00Z', providerId: 'mock' }
      },
      {
        id: 'media-director-b', type: 'video', name: 'usage-demo.mp4', path: tinyVideo,
        duration: 8, width: 1920, height: 1080, size: 16384, mtimeMs: 2_000, hasAudio: true,
        aiAnalysis: { tags: ['演示', '使用'], scene: '使用场景', mood: '轻松', objects: ['人物'], analysisTime: '2025-01-01T00:00:00Z', providerId: 'mock' }
      },
      {
        id: 'media-director-c', type: 'video', name: 'ending-scene.mp4', path: tinyVideo,
        duration: 4, width: 1920, height: 1080, size: 4096, mtimeMs: 3_000, hasAudio: true,
        aiAnalysis: { tags: ['结尾'], scene: '结尾', mood: '温馨', objects: ['场景'], analysisTime: '2025-01-01T00:00:00Z', providerId: 'mock' }
      }
    ];
    const timeline = { transitions: [], markers: [], tracks: [createTrack({ id: 'track-video', type: 'video', name: 'Video 1', clips: [] })] };
    useEditorStore.getState().setProject({
      ...project, media: mediaAssets, timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    useEditorStore.getState().setSelectedClipIds([]);
    useEditorStore.getState().setPlayheadTime(0);
    await useAISettingsStore.getState().setProviderApiKey('openai', 'test-openai-key');
    useAISettingsStore.getState().toggleProvider('openai', true);
    commandManager.clear();
  },
  setupMusicMatchFixture: async () => {
    const project = createProject('Music Match E2E');
    const mediaAssets: MediaAsset[] = [
      {
        id: 'media-mm-video', type: 'video', name: 'product-video.mp4', path: tinyVideo,
        duration: 10, width: 1920, height: 1080, size: 8192, mtimeMs: 1_000, hasAudio: true,
        aiAnalysis: { tags: ['产品'], scene: '产品展示', mood: '活力积极', objects: ['产品'], analysisTime: '2025-01-01T00:00:00Z', providerId: 'mock' }
      },
      {
        id: 'media-mm-audio', type: 'audio', name: 'background-music.wav', path: tinyAudio,
        duration: 15, width: 0, height: 0, size: 2048, mtimeMs: 2_000, hasAudio: true,
        aiAnalysis: { tags: ['音乐'], scene: '背景音乐', mood: '活力积极', objects: [], analysisTime: '2025-01-01T00:00:00Z', providerId: 'mock' }
      }
    ];
    const timeline = {
      transitions: [], markers: [],
      tracks: [
        createTrack({ id: 'track-video', type: 'video', name: 'Video 1', clips: [makeStoryboardClip('clip-mm-video', 'video', 'product-video.mp4', 'media-mm-video', 0, 10)] }),
        createTrack({ id: 'track-audio', type: 'audio', name: 'Audio 1', clips: [] })
      ]
    };
    useEditorStore.getState().setProject({
      ...project, media: mediaAssets, timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    useEditorStore.getState().setSelectedClipIds([]);
    useEditorStore.getState().setPlayheadTime(0);
    await useAISettingsStore.getState().setProviderApiKey('openai', 'test-openai-key');
    useAISettingsStore.getState().toggleProvider('openai', true);
    commandManager.clear();
  },
  setupHighlightReelFixture: async () => {
    const project = createProject('Highlight Reel E2E');
    const mediaAssets: MediaAsset[] = [
      {
        id: 'media-highlight-a', type: 'video', name: 'highlight-a.mp4', path: tinyVideo,
        duration: 4, width: 1920, height: 1080, size: 8192, mtimeMs: 1_000, hasAudio: true,
        aiAnalysis: { tags: ['精彩'], scene: '动作场景', mood: 'exciting 动感', objects: [], analysisTime: '2025-01-01T00:00:00Z', providerId: 'mock' }
      },
      {
        id: 'media-highlight-b', type: 'video', name: 'highlight-b.mp4', path: tinyVideo,
        duration: 3, width: 1920, height: 1080, size: 4096, mtimeMs: 2_000, hasAudio: true,
        aiAnalysis: { tags: ['日常'], scene: '日常场景', mood: '平静', objects: [], analysisTime: '2025-01-01T00:00:00Z', providerId: 'mock' }
      },
      {
        id: 'media-highlight-c', type: 'video', name: 'highlight-c.mp4', path: tinyVideo,
        duration: 5, width: 1920, height: 1080, size: 4096, mtimeMs: 3_000, hasAudio: true,
        aiAnalysis: { tags: ['高潮'], scene: '高潮片段', mood: 'energetic 激情', objects: [], analysisTime: '2025-01-01T00:00:00Z', providerId: 'mock' }
      }
    ];
    const clipA = makeStoryboardClip('clip-highlight-a', 'video', 'highlight-a.mp4', 'media-highlight-a', 0, 4);
    const clipB = makeStoryboardClip('clip-highlight-b', 'video', 'highlight-b.mp4', 'media-highlight-b', 4, 3);
    const clipC = makeStoryboardClip('clip-highlight-c', 'video', 'highlight-c.mp4', 'media-highlight-c', 7, 5);
    const timeline = {
      transitions: [], markers: [],
      tracks: [createTrack({ id: 'track-video', type: 'video', name: 'Video 1', clips: [clipA, clipB, clipC] })]
    };
    useEditorStore.getState().setProject({
      ...project, media: mediaAssets, timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    useEditorStore.getState().setSelectedClipIds([]);
    useEditorStore.getState().setPlayheadTime(0);
    await useAISettingsStore.getState().setProviderApiKey('openai', 'test-openai-key');
    useAISettingsStore.getState().toggleProvider('openai', true);
    commandManager.clear();
  },
  setupContextualTranslationFixture: async () => {
    const project = createProject('Contextual Translation E2E');
    const sub1 = makeMockSubtitleClip('ctx-sub-1', 'track-ctx-subtitle', '你好，欢迎使用OpenFactory', 0);
    const sub2 = makeMockSubtitleClip('ctx-sub-2', 'track-ctx-subtitle', '张三在北京办公', 2);
    const sub3 = makeMockSubtitleClip('ctx-sub-3', 'track-ctx-subtitle', '感谢使用我们的产品', 4);
    const timeline = {
      transitions: [], markers: [],
      tracks: [
        createTrack({ id: 'track-ctx-video', type: 'video', name: 'Video 1', clips: [] }),
        createTrack({ id: 'track-ctx-subtitle', type: 'subtitle', name: 'Subtitles', language: 'zh', clips: [sub1, sub2, sub3] })
      ]
    };
    useEditorStore.getState().setProject({
      ...project, media: [], timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    await useAISettingsStore.getState().setProviderApiKey('openai', 'test-openai-key');
    useAISettingsStore.getState().toggleProvider('openai', true);
    useEditorStore.getState().setSelectedClipIds(['ctx-sub-1', 'ctx-sub-2', 'ctx-sub-3']);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },

  setupAiReframeFixture: async () => {
    const project = createProject('AI Reframe E2E');
    const mediaAssets: MediaAsset[] = [
      {
        id: 'media-reframe-a', type: 'video', name: 'reframe-clip.mp4', path: tinyVideo,
        duration: 10, width: 1920, height: 1080, size: 8192, mtimeMs: 1_000, hasAudio: true,
      },
    ];
    const clipA = makeStoryboardClip('clip-reframe-a', 'video', 'reframe-clip.mp4', 'media-reframe-a', 0, 10);
    const timeline = {
      transitions: [], markers: [],
      tracks: [createTrack({ id: 'track-video', type: 'video', name: 'Video 1', clips: [clipA] })],
    };
    useEditorStore.getState().setProject({
      ...project, media: mediaAssets, timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID,
    });
    useEditorStore.getState().setSelectedClipIds(['clip-reframe-a']);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },

  setupAiTransitionRecommendFixture: async () => {
    const project = createProject('AI Transition Recommend E2E');
    const mediaAssets: MediaAsset[] = [
      {
        id: 'media-trans-a', type: 'video', name: 'transition-a.mp4', path: tinyVideo,
        duration: 5, width: 1920, height: 1080, size: 4096, mtimeMs: 1_000, hasAudio: true,
      },
      {
        id: 'media-trans-b', type: 'video', name: 'transition-b.mp4', path: tinyVideo,
        duration: 5, width: 1920, height: 1080, size: 4096, mtimeMs: 2_000, hasAudio: true,
      },
    ];
    const clipA = makeStoryboardClip('clip-trans-a', 'video', 'transition-a.mp4', 'media-trans-a', 0, 5);
    const clipB = makeStoryboardClip('clip-trans-b', 'video', 'transition-b.mp4', 'media-trans-b', 5, 5);
    const timeline = {
      transitions: [], markers: [],
      tracks: [createTrack({ id: 'track-video', type: 'video', name: 'Video 1', clips: [clipA, clipB] })],
    };
    useEditorStore.getState().setProject({
      ...project, media: mediaAssets, timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID,
    });
    useEditorStore.getState().setSelectedClipIds(['clip-trans-a']);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },

  setupSubtitleSpeakerDiarizationFixture: async () => {
    const project = createProject('Speaker Diarization E2E');
    const sub1 = makeMockSubtitleClip('spk-sub-1', 'track-spk-subtitle', '大家好，欢迎来到节目', 0);
    const sub2 = makeMockSubtitleClip('spk-sub-2', 'track-spk-subtitle', '今天讨论人工智能', 4.2);
    const sub3 = makeMockSubtitleClip('spk-sub-3', 'track-spk-subtitle', '感谢收看，下次再见', 8.4);
    const timeline = {
      transitions: [], markers: [],
      tracks: [
        createTrack({ id: 'track-spk-subtitle', type: 'subtitle', name: 'Subtitle 1', clips: [sub1, sub2, sub3] }),
      ],
    };
    useEditorStore.getState().setProject({
      ...project, media: [], timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID,
    });
    useEditorStore.getState().setSelectedClipIds(['spk-sub-1', 'spk-sub-2', 'spk-sub-3']);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },

  setupAnomalyDetectionFixture: async () => {
    const project = createProject('Anomaly Detection E2E');
    const mediaAssets: MediaAsset[] = [
      {
        id: 'media-anomaly-a', type: 'video', name: 'anomaly-clip.mp4', path: tinyVideo,
        duration: 5, width: 1920, height: 1080, size: 8192, mtimeMs: 1_000, hasAudio: true,
      },
    ];
    const clipA = makeStoryboardClip('clip-anomaly-a', 'video', 'anomaly-clip.mp4', 'media-anomaly-a', 0, 15);
    const timeline = {
      transitions: [], markers: [],
      tracks: [createTrack({ id: 'track-video', type: 'video', name: 'Video 1', clips: [clipA] })],
    };
    useEditorStore.getState().setProject({
      ...project, media: mediaAssets, timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID,
    });
    useEditorStore.getState().setSelectedClipIds(['clip-anomaly-a']);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },
  setupPrivacyRedactionFixture: async () => {
    const project = createProject('Privacy Redaction E2E');
    const asset: MediaAsset = {
      id: 'media-pr', type: 'video', name: 'privacy-test.mp4',
      path: tinyVideo, duration: 10, width: 1280, height: 720, size: 4096, mtimeMs: 1_000, hasAudio: false,
    };
    const clip = {
      id: 'clip-pr', type: 'video' as const, name: 'privacy-test.mp4',
      mediaId: 'media-pr', trackId: 'track-pr-video',
      start: 0, duration: 10, trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED,
      colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM }, volume: 1,
      privacyRedactions: [
        { id: 'redact-face-1', type: 'face' as const, keyframes: [
          { time: 0, x: 0.3, y: 0.2, w: 0.15, h: 0.2 },
          { time: 2, x: 0.31, y: 0.21, w: 0.15, h: 0.2 },
          { time: 4, x: 0.32, y: 0.19, w: 0.16, h: 0.21 },
        ], blurStrength: 0.8, enabled: true },
        { id: 'redact-face-2', type: 'face' as const, keyframes: [
          { time: 0, x: 0.6, y: 0.3, w: 0.12, h: 0.18 },
          { time: 2, x: 0.61, y: 0.31, w: 0.12, h: 0.18 },
          { time: 4, x: 0.6, y: 0.29, w: 0.13, h: 0.19 },
        ], blurStrength: 1, enabled: true },
      ],
    };
    const timeline = {
      transitions: [], markers: [],
      tracks: [createTrack({ id: 'track-pr-video', type: 'video', name: 'Video 1', clips: [clip] })],
    };
    useEditorStore.getState().setProject({
      ...project, media: [asset], timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID,
    });
    useEditorStore.getState().setSelectedClipIds(['clip-pr']);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },
  setupLookMatchFixture: async () => {
    const project = createProject('AI Look Match E2E');
    const asset: MediaAsset = {
      id: 'media-lm', type: 'video', name: 'look-match-test.mp4',
      path: tinyVideo, duration: 10, width: 1920, height: 1080, size: 4096, mtimeMs: 1_000, hasAudio: true,
    };
    const clip = {
      id: 'clip-lm', type: 'video' as const, name: 'look-match-test.mp4',
      mediaId: 'media-lm', trackId: 'track-lm-video',
      start: 0, duration: 10, trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED,
      colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM }, volume: 1,
      aiLookMatch: {
        sourceImageHash: 'abc123',
        wheelAdjustments: {
          lift: { r: 0.05, g: -0.02, b: -0.03 },
          gamma: { r: 0.03, g: 0, b: -0.03 },
          gain: { r: 0.04, g: 0.01, b: -0.02 },
        },
        curveControlPoints: {
          master: [{ x: 0, y: 0 }, { x: 0.25, y: 0.22 }, { x: 0.5, y: 0.52 }, { x: 0.75, y: 0.78 }, { x: 1, y: 1 }],
          r: [{ x: 0, y: 0 }, { x: 0.5, y: 0.54 }, { x: 1, y: 1 }],
          g: [{ x: 0, y: 0 }, { x: 0.5, y: 0.51 }, { x: 1, y: 1 }],
          b: [{ x: 0, y: 0 }, { x: 0.5, y: 0.46 }, { x: 1, y: 1 }],
        },
        confidence: 0.85,
        generatedAt: '2026-06-29T00:00:00.000Z',
        blendStrength: 80,
      },
    };
    const timeline = {
      transitions: [], markers: [],
      tracks: [createTrack({ id: 'track-lm-video', type: 'video', name: 'Video 1', clips: [clip] })],
    };
    useEditorStore.getState().setProject({
      ...project, media: [asset], timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID,
    });
    await useAISettingsStore.getState().setProviderApiKey('mimo', 'test-mimo-key');
    useAISettingsStore.getState().updateProvider('mimo', { defaultModel: 'gpt-4o' });
    useAISettingsStore.getState().toggleProvider('mimo', true);
    useEditorStore.getState().setSelectedClipIds(['clip-lm']);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },
  setupBeatSnapFixture: async () => {
    const project = createProject('Beat Snap E2E');
    const asset: MediaAsset = {
      id: 'media-bs', type: 'video', name: 'beat-snap-test.mp4',
      path: tinyVideo, duration: 5, width: 1920, height: 1080, size: 4096, mtimeMs: 1_000, hasAudio: true,
    };
    const clip1 = {
      id: 'clip-bs-1', type: 'video' as const, name: 'clip-1.mp4',
      mediaId: 'media-bs', trackId: 'track-bs',
      start: 0, duration: 3.0, trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED,
      colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM }, volume: 1,
      beatSnapped: true,
    };
    const clip2 = {
      id: 'clip-bs-2', type: 'video' as const, name: 'clip-2.mp4',
      mediaId: 'media-bs', trackId: 'track-bs',
      start: 3.0, duration: 4.0, trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED,
      colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM }, volume: 1,
      beatSnapped: true,
    };
    const clip3 = {
      id: 'clip-bs-3', type: 'video' as const, name: 'clip-3.mp4',
      mediaId: 'media-bs', trackId: 'track-bs',
      start: 7.0, duration: 5.0, trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED,
      colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM }, volume: 1,
      beatSnapped: false,
    };
    const timeline = {
      transitions: [], markers: [],
      tracks: [createTrack({ id: 'track-bs', type: 'video', name: 'Video 1', clips: [clip1, clip2, clip3] })],
    };
    const beatSnapSuggestions = [
      { clipId: 'clip-bs-3', edge: 'in' as const, suggestedTime: 7.12, originalTime: 7.0 },
    ];
    useEditorStore.getState().setProject({
      ...project, media: [asset], timeline, beatSnapSuggestions,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID,
    });
    useEditorStore.getState().setSelectedClipIds(['clip-bs-1', 'clip-bs-2', 'clip-bs-3']);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },
  setupMediaOrganizeFixture: async () => {
    const project = createProject('Media Organize E2E');
    const mediaAssets: MediaAsset[] = [];
    for (let i = 0; i < 25; i++) {
      mediaAssets.push({
        id: `media-organize-${i}`, type: 'video', name: `clip-${i}.mp4`, path: tinyVideo,
        duration: 5, width: 1920, height: 1080, size: 4096, mtimeMs: i * 1000, hasAudio: true,
        aiAnalysis: {
          tags: i < 10 ? ['户外', '自然'] : i < 20 ? ['室内', '人物'] : ['夜景', '城市'],
          scene: i < 10 ? '户外场景' : i < 20 ? '室内场景' : '城市夜景',
          mood: '平静', objects: [], analysisTime: '2026-01-01T00:00:00.000Z', providerId: 'mock',
        },
      });
    }
    const timeline = { transitions: [], markers: [], tracks: [createTrack({ id: 'track-mo', type: 'video', name: 'Video 1', clips: [] })] };
    const existingCollections = [
      { id: 'col-manual-1', name: '手动分组', mediaIds: ['media-organize-0'], source: 'manual' as const, createdAt: '2026-01-01T00:00:00.000Z' },
    ];
    useEditorStore.getState().setProject({
      ...project, media: mediaAssets, timeline, mediaCollections: existingCollections,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID,
    });
    useEditorStore.getState().setSelectedClipIds([]);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },
  setupMulticamAiCutFixture: () => setupMulticamAiCutFixtureInner(),
  enterMulticamEditMode: (clipId: unknown) => {
    if (typeof clipId === 'string') {
      useEditorStore.getState().enterMulticamEditMode(clipId);
    }
  },
  exitMulticamEditMode: () => {
    useEditorStore.getState().exitMulticamEditMode();
  },
  getMulticamClipState: () => {
    const state = useEditorStore.getState();
    const project = state.project;
    // Try activeMulticamClipId first, then fall back to selectedClipId
    const clipId = state.activeMulticamClipId ?? state.selectedClipId;
    if (!clipId) return undefined;
    const clip = project.timeline.tracks.flatMap((t) => t.clips).find((c) => c.id === clipId);
    if (!clip) return undefined;
    // Handle independent MulticamClip (type: 'multicam')
    if (clip.type === 'multicam') {
      const mc = clip as any;
      return {
        angleCount: mc.angles?.length ?? 0,
        switchCount: mc.switchPoints?.length ?? 0,
        switches: mc.switchPoints?.map((sp: any) => ({ time: sp.time, angleId: mc.angles?.[sp.targetAngle]?.id ?? '' })) ?? [],
        activeAngle: mc.angles?.[mc.activeAngle]?.id,
        angles: mc.angles?.map((a: any) => ({ id: a.id, name: a.name, offset: a.offset })) ?? [],
      };
    }
    // Handle NestedSequenceClip with multicam property (legacy)
    if (!(clip as any).multicam) return undefined;
    const mc = (clip as any).multicam;
    return {
      angleCount: mc.angles?.length ?? 0,
      switchCount: mc.switches?.length ?? 0,
      switches: mc.switches ?? [],
      activeAngle: mc.activeAngle,
      angles: mc.angles?.map((a: any) => ({ id: a.id, name: a.name, offset: a.offset })) ?? [],
    };
  },
  setupShakeAnalysisFixture: () => {
    const project = createProject('Shake Analysis E2E');
    const asset: MediaAsset = {
      id: 'media-shake-video', type: 'video', name: 'shaky-clip.mp4', path: tinyVideo,
      duration: 10, width: 1920, height: 1080, size: 8192, mtimeMs: 1000, hasAudio: true,
    };
    const timeline = {
      transitions: [],
      markers: [],
      tracks: [createTrack({ id: 'track-shake', type: 'video', name: 'Video 1', clips: [
        {
          id: 'clip-shake',
          type: 'video',
          name: 'shaky-clip.mp4',
          mediaId: 'media-shake-video',
          trackId: 'track-shake',
          start: 0,
          duration: 10,
          trimStart: 0,
          trimEnd: 0,
          speed: 1,
          colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
          transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
          volume: 1,
          stabilization: {
            enabled: false,
            smoothing: 5,
            zoom: 0,
            analyzed: false,
            shakeScore: 75,
            severity: 'high',
            suggestedFilter: 'vidstab',
            sampledAt: Date.now(),
          },
        },
      ] })],
    };
    useEditorStore.getState().setProject({
      ...project, media: [asset], timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID,
    });
    useEditorStore.getState().setSelectedClipIds(['clip-shake']);
    useEditorStore.getState().setSelectedClipId('clip-shake');
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },
  setupPipAvoidanceFixture: () => {
    const project = createProject('PiP Avoidance E2E');
    const asset: MediaAsset = {
      id: 'media-pip-video', type: 'video', name: 'main-video.mp4', path: tinyVideo,
      duration: 10, width: 1920, height: 1080, size: 8192, mtimeMs: 1000, hasAudio: true,
    };
    const timeline = {
      transitions: [],
      markers: [],
      tracks: [createTrack({ id: 'track-pip', type: 'video', name: 'Video 1', clips: [
        {
          id: 'clip-pip',
          type: 'video',
          name: 'pip-clip.mp4',
          mediaId: 'media-pip-video',
          trackId: 'track-pip',
          start: 0,
          duration: 10,
          trimStart: 0,
          trimEnd: 0,
          speed: 1,
          colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
          transform: { x: 0.5, y: -0.5, scale: 0.3, rotation: 0, opacity: 1 },
          volume: 1,
          aiPipSuggestion: {
            recommendedCorner: 'top-left',
            overlapReduction: 60,
            confidence: 0.85,
          },
        },
      ] })],
    };
    useEditorStore.getState().setProject({
      ...project, media: [asset], timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID,
    });
    useEditorStore.getState().setSelectedClipIds(['clip-pip']);
    useEditorStore.getState().setSelectedClipId('clip-pip');
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },
  setupPlatformFitFixture: () => {
    const project = createProject('Platform Fit E2E');
    const clips = [];
    for (let i = 0; i < 5; i++) {
      clips.push({
        id: `clip-pf-${i}`,
        type: 'video',
        name: `segment-${i}.mp4`,
        mediaId: `media-pf-${i}`,
        trackId: 'track-pf',
        start: i * 5,
        duration: 5,
        trimStart: 0,
        trimEnd: 0,
        speed: 1,
        colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
        transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
        volume: 1,
        platformFitRemoved: i >= 3 ? true : undefined,
      } as any);
    }
    const assets: MediaAsset[] = [];
    for (let i = 0; i < 5; i++) {
      assets.push({
        id: `media-pf-${i}`, type: 'video', name: `segment-${i}.mp4`, path: tinyVideo,
        duration: 5, width: 1920, height: 1080, size: 8192, mtimeMs: 1000 + i, hasAudio: true,
      });
    }
    const timeline = {
      transitions: [],
      markers: [],
      tracks: [createTrack({ id: 'track-pf', type: 'video', name: 'Video 1', clips })],
    };
    const projWithFit = {
      ...project,
      platformFitSuggestion: {
        targetPlatform: 'tiktok' as const,
        limitSeconds: 15,
        keptSegments: [
          { clipId: 'clip-pf-0', start: 0, end: 5, score: 0.9 },
          { clipId: 'clip-pf-1', start: 5, end: 10, score: 0.8 },
          { clipId: 'clip-pf-2', start: 10, end: 15, score: 0.7 },
        ],
        removedSegments: [
          { clipId: 'clip-pf-3', start: 15, end: 20, score: 0.3 },
          { clipId: 'clip-pf-4', start: 20, end: 25, score: 0.2 },
        ],
      },
    };
    useEditorStore.getState().setProject({
      ...projWithFit, media: assets, timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID,
    });
    useEditorStore.getState().setSelectedClipIds(['clip-pf-0']);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },
  setupAIDenoiseFixture: async () => {
    const project = createProject('AI Denoise E2E');
    const asset: MediaAsset = {
      id: 'media-denoise-audio', type: 'audio', name: 'test-audio.wav',
      path: tinyVideo, duration: 10, width: 0, height: 0, size: 4096, mtimeMs: 1_000,
      hasAudio: true, audioChannels: 1, audioSampleRate: 44_100
    };
    const clip = {
      id: 'denoise-clip-1', type: 'audio' as const, name: 'test-audio.wav',
      mediaId: 'media-denoise-audio', trackId: 'track-denoise-audio', start: 0, duration: 10,
      trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, volume: 1,
      colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM },
      aiDenoiseRecommendation: {
        noiseProfile: { humScore: 0.65, hissScore: 0.42, windScore: 0.1, snrEstimate: 8.5 },
        recommendedFilters: [
          { filter: 'afftdn', params: { nr: 20, nf: -25 }, reason: '检测到嗡声(hum)干扰，建议使用自适应降噪' } as DenoiseFilterRecommendation,
          { filter: 'highpass', params: { f: 80 }, reason: '检测到嗡声低频干扰，建议高通滤波' } as DenoiseFilterRecommendation
        ],
        appliedFilters: [],
        generatedAt: new Date().toISOString()
      }
    };
    const timeline = {
      transitions: [], markers: [],
      tracks: [
        createTrack({ id: 'track-denoise-audio', type: 'audio', name: 'Audio 1', clips: [clip] })
      ]
    };
    useEditorStore.getState().setProject({
      ...project, media: [asset], timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    await useAISettingsStore.getState().setProviderApiKey('mimo', 'test-mimo-key');
    useAISettingsStore.getState().updateProvider('mimo', { defaultModel: 'gpt-4o' });
    useAISettingsStore.getState().toggleProvider('mimo', true);
    useEditorStore.getState().setSelectedClipIds(['denoise-clip-1']);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },
  setupAIDenoiseFixtureNoProvider: async () => {
    const project = createProject('AI Denoise No Provider E2E');
    const asset: MediaAsset = {
      id: 'media-denoise-audio-2', type: 'audio', name: 'test-audio-2.wav',
      path: tinyVideo, duration: 10, width: 0, height: 0, size: 4096, mtimeMs: 1_000,
      hasAudio: true, audioChannels: 1, audioSampleRate: 44_100
    };
    const clip = {
      id: 'denoise-clip-2', type: 'audio' as const, name: 'test-audio-2.wav',
      mediaId: 'media-denoise-audio-2', trackId: 'track-denoise-audio-2', start: 0, duration: 10,
      trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, volume: 1,
      colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM }
    };
    const timeline = {
      transitions: [], markers: [],
      tracks: [createTrack({ id: 'track-denoise-audio-2', type: 'audio', name: 'Audio 1', clips: [clip] })]
    };
    useEditorStore.getState().setProject({ ...project, media: [asset], timeline });
    useAISettingsStore.getState().toggleProvider('mimo', false);
    useAISettingsStore.getState().updateProvider('mimo', { apiKey: '' });
    useAISettingsStore.getState().toggleProvider('ollama', false);
    useAISettingsStore.getState().updateProvider('ollama', { apiKey: '' });
    aiApiKeys.delete('mimo');
    aiApiKeys.delete('ollama');
    useEditorStore.getState().setSelectedClipIds(['denoise-clip-2']);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },
  setupAIDenoiseLocalFixture: async () => {
    const project = createProject("AI Local Denoise E2E");
    const asset: MediaAsset = { id: "media-local-denoise-audio", type: "audio", name: "noisy-audio.wav", path: tinyVideo, duration: 10, width: 0, height: 0, size: 4096, mtimeMs: 1000, hasAudio: true, audioChannels: 1, audioSampleRate: 44100 };
    const clip = { id: "local-denoise-clip-1", type: "audio" as const, name: "noisy-audio.wav", mediaId: "media-local-denoise-audio", trackId: "track-local-denoise-audio", start: 0, duration: 10, trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, volume: 1, colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM }, aiLocalDenoise: { enabled: false, strength: 0.5 } };
    const timeline = { transitions: [], markers: [], tracks: [createTrack({ id: "track-local-denoise-audio", type: "audio", name: "Audio 1", clips: [clip] })] };
    useEditorStore.getState().setProject({ ...project, media: [asset], timeline });
    useEditorStore.getState().setSelectedClipIds(["local-denoise-clip-1"]);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },
  setupAIBrollFixture: async () => {
    const project = createProject('AI B-roll E2E');
    const videoAsset: MediaAsset = {
      id: 'media-broll-video', type: 'video', name: 'main-video.mp4',
      path: tinyVideo, duration: 30, width: 1280, height: 720, size: 4096, mtimeMs: 1_000, hasAudio: false
    };
    const natureAsset: MediaAsset = {
      id: 'media-broll-nature', type: 'video', name: 'nature.mp4',
      path: tinyVideo, duration: 10, width: 1280, height: 720, size: 2048, mtimeMs: 1_000, hasAudio: false,
      aiAnalysis: { tags: ['nature', 'forest', 'tree'], scene: 'nature scene', mood: 'calm', objects: ['tree'], analysisTime: new Date().toISOString(), providerId: 'mimo' }
    };
    const cityAsset: MediaAsset = {
      id: 'media-broll-city', type: 'video', name: 'city.mp4',
      path: tinyVideo, duration: 8, width: 1280, height: 720, size: 2048, mtimeMs: 1_000, hasAudio: false,
      aiAnalysis: { tags: ['city', 'urban', 'building'], scene: 'city scene', mood: 'busy', objects: ['building'], analysisTime: new Date().toISOString(), providerId: 'mimo' }
    };
    const mainClip = {
      id: 'broll-main-clip', type: 'video' as const, name: 'main-video.mp4',
      mediaId: 'media-broll-video', trackId: 'track-broll-video', start: 0, duration: 30,
      trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, volume: 1,
      colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM }
    };
    const longSubtitleClip = {
      id: 'subtitle-clip-long', type: 'subtitle' as const, name: 'Long subtitle',
      trackId: 'track-broll-subtitle', start: 0, duration: 5, text: 'nature forest walking',
      trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, style: { ...DEFAULT_SUBTITLE_STYLE },
      subtitleMode: DEFAULT_SUBTITLE_MODE,
      colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM },
      brollSuggestions: [
        { segmentId: 'subtitle-clip-long', mediaId: 'media-broll-nature', insertTime: 1, reason: '自然场景匹配', confidence: 0.85, status: 'pending' as const },
        { segmentId: 'subtitle-clip-long', mediaId: 'media-broll-city', insertTime: 1.5, reason: '城市场景匹配', confidence: 0.72, status: 'pending' as const }
      ]
    };
    const timeline = {
      transitions: [], markers: [],
      tracks: [
        createTrack({ id: 'track-broll-video', type: 'video', name: 'Video 1', clips: [mainClip] }),
        createTrack({ id: 'track-broll-subtitle', type: 'subtitle', name: 'Subtitles', clips: [longSubtitleClip] })
      ]
    };
    useEditorStore.getState().setProject({
      ...project, media: [videoAsset, natureAsset, cityAsset], timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    await useAISettingsStore.getState().setProviderApiKey('mimo', 'test-mimo-key');
    useAISettingsStore.getState().updateProvider('mimo', { defaultModel: 'gpt-4o' });
    useAISettingsStore.getState().toggleProvider('mimo', true);
    useEditorStore.getState().setSelectedClipIds(['subtitle-clip-long']);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },
  setupAIBrollFixtureNoGaps: async () => {
    const project = createProject('AI B-roll No Gaps E2E');
    const videoAsset: MediaAsset = {
      id: 'media-broll-video-2', type: 'video', name: 'main-video-2.mp4',
      path: tinyVideo, duration: 30, width: 1280, height: 720, size: 4096, mtimeMs: 1_000, hasAudio: false
    };
    const mainClip = {
      id: 'broll-main-clip-2', type: 'video' as const, name: 'main-video-2.mp4',
      mediaId: 'media-broll-video-2', trackId: 'track-broll-video-2', start: 0, duration: 30,
      trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, volume: 1,
      colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM }
    };
    const shortClip = {
      id: 'subtitle-clip-short', type: 'subtitle' as const, name: 'Short subtitle',
      trackId: 'track-broll-subtitle-2', start: 0, duration: 2, text: 'hi',
      trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, style: { ...DEFAULT_SUBTITLE_STYLE },
      subtitleMode: DEFAULT_SUBTITLE_MODE,
      colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM }
    };
    const timeline = {
      transitions: [], markers: [],
      tracks: [
        createTrack({ id: 'track-broll-video-2', type: 'video', name: 'Video 1', clips: [mainClip] }),
        createTrack({ id: 'track-broll-subtitle-2', type: 'subtitle', name: 'Subtitles', clips: [shortClip] })
      ]
    };
    useEditorStore.getState().setProject({ ...project, media: [videoAsset], timeline });
    await useAISettingsStore.getState().setProviderApiKey('mimo', 'test-mimo-key');
    useAISettingsStore.getState().updateProvider('mimo', { defaultModel: 'gpt-4o' });
    useAISettingsStore.getState().toggleProvider('mimo', true);
    useEditorStore.getState().setSelectedClipIds(['subtitle-clip-short']);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  },
  setupAIVersionDiffFixture: async () => {
    const project = createProject('AI Version Diff E2E');
    const asset: MediaAsset = {
      id: 'media-version-diff', type: 'video', name: 'test-video.mp4',
      path: tinyVideo, duration: 10, width: 1280, height: 720, size: 4096, mtimeMs: 1_000, hasAudio: false
    };
    const clipA = {
      id: 'clip-vdiff-a', type: 'video' as const, name: 'test-video.mp4',
      mediaId: 'media-version-diff', trackId: 'track-vdiff', start: 0, duration: 5,
      trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, volume: 1,
      colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM }
    };
    const timeline = {
      transitions: [], markers: [],
      tracks: [createTrack({ id: 'track-vdiff', type: 'video', name: 'Video 1', clips: [clipA] })]
    };
    useEditorStore.getState().setProject({
      ...project, media: [asset], timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    await useAISettingsStore.getState().setProviderApiKey('mimo', 'test-mimo-key');
    useAISettingsStore.getState().updateProvider('mimo', { defaultModel: 'gpt-4o' });
    useAISettingsStore.getState().toggleProvider('mimo', true);
    commandManager.clear();
  },
  setupAILoudnessFixture: () => {
    const project = createProject('AI Loudness E2E');
    const asset: MediaAsset = {
      id: 'media-loudness-audio', type: 'audio', name: 'loud-audio.wav',
      path: tinyVideo, duration: 10, width: 0, height: 0, size: 4096, mtimeMs: 1_000,
      hasAudio: true, audioChannels: 1, audioSampleRate: 44_100
    };
    const clip = {
      id: 'loudness-clip-1', type: 'audio' as const, name: 'loud-audio.wav',
      mediaId: 'media-loudness-audio', trackId: 'track-loudness-audio', start: 0, duration: 10,
      trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, volume: 1,
      colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM }
    };
    const timeline = {
      transitions: [], markers: [],
      tracks: [createTrack({ id: 'track-loudness-audio', type: 'audio', name: 'Audio 1', clips: [clip] })]
    };
    useEditorStore.getState().setProject({
      ...project, media: [asset], timeline,
      loudnessSuggestion: { measuredLUFS: -24, targetPlatform: 'youtube', targetLUFS: -14, suggestedGainDb: 10, appliedAt: null },
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    commandManager.clear();
  },
  setupFlashWarningFixture: () => {
    const project = createProject('Flash Warning E2E');
    const asset = { id: 'media-flash-video', type: 'video' as const, name: 'flash-video.mp4', path: tinyVideo, duration: 10, width: 1920, height: 1080, size: 4096, mtimeMs: 1_000, hasAudio: false };
    const clip = {
      id: 'clip-flash-1', type: 'video' as const, name: 'flash-video.mp4', mediaId: 'media-flash-video', trackId: 'track-flash-video', start: 0, duration: 10, trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, volume: 1, colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM },
      flashWarnings: [
        { startTime: 2, endTime: 4, flashRate: 5, severity: 'medium' as const, isRedFlash: false },
        { startTime: 6, endTime: 8, flashRate: 8, severity: 'high' as const, isRedFlash: true },
      ]
    };
    const timeline = { transitions: [], markers: [], tracks: [createTrack({ id: 'track-flash-video', type: 'video', name: 'Video 1', clips: [clip] })] };
    useEditorStore.getState().setProject({ ...project, media: [asset], timeline, sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }], activeSequenceId: PRIMARY_SEQUENCE_ID });
    commandManager.clear();
  },
  setupFlashWarningReduceFixture: () => {
    const project = createProject('Flash Warning Reduce E2E');
    const asset = { id: 'media-flash-reduce', type: 'video' as const, name: 'flash-reduce.mp4', path: tinyVideo, duration: 10, width: 1920, height: 1080, size: 4096, mtimeMs: 1_000, hasAudio: false };
    const clip = {
      id: 'clip-flash-reduce', type: 'video' as const, name: 'flash-reduce.mp4', mediaId: 'media-flash-reduce', trackId: 'track-flash-reduce', start: 0, duration: 10, trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, volume: 1, colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM },
      flashWarnings: [
        { startTime: 2, endTime: 4, flashRate: 4, severity: 'low' as const, isRedFlash: false },
      ]
    };
    const timeline = { transitions: [], markers: [], tracks: [createTrack({ id: 'track-flash-reduce', type: 'video', name: 'Video 1', clips: [clip] })] };
    useEditorStore.getState().setProject({ ...project, media: [asset], timeline, sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }], activeSequenceId: PRIMARY_SEQUENCE_ID });
    commandManager.clear();
  },
  setupContinuityWarningFixture: () => {
    const project = createProject('Continuity Check E2E');
    const assetA = { id: 'media-cont-a', type: 'video' as const, name: 'cont-a.mp4', path: tinyVideo, duration: 5, width: 1920, height: 1080, size: 4096, mtimeMs: 1_000, hasAudio: false };
    const assetB = { id: 'media-cont-b', type: 'video' as const, name: 'cont-b.mp4', path: tinyVideo, duration: 5, width: 1920, height: 1080, size: 4096, mtimeMs: 1_000, hasAudio: false };
    const clipA = { id: 'clip-cont-a', type: 'video' as const, name: 'cont-a.mp4', mediaId: 'media-cont-a', trackId: 'track-cont-video', start: 0, duration: 5, trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, volume: 1, colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM } };
    const clipB = { id: 'clip-cont-b', type: 'video' as const, name: 'cont-b.mp4', mediaId: 'media-cont-b', trackId: 'track-cont-video', start: 5, duration: 5, trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, volume: 1, colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM } };
    const timeline = {
      transitions: [], markers: [],
      tracks: [createTrack({ id: 'track-cont-video', type: 'video', name: 'Video 1', clips: [clipA, clipB] })],
      continuityWarnings: [
        { clipAId: 'clip-cont-a', clipBId: 'clip-cont-b', type: 'axis_jump' as const, confidence: 0.9, reason: '同场景内左突变为右' },
        { clipAId: 'clip-cont-a', clipBId: 'clip-cont-b', type: 'jump_cut' as const, confidence: 0.85, reason: '构图中心距离<5%, 时长差<0.5s' },
      ]
    };
    useEditorStore.getState().setProject({ ...project, media: [assetA, assetB], timeline, sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }], activeSequenceId: PRIMARY_SEQUENCE_ID });
    commandManager.clear();
  },
  setupMusicStructureFixture: () => {
    const project = createProject('Music Structure E2E');
    const asset = { id: 'media-music', type: 'audio' as const, name: 'music.wav', path: tinyVideo, duration: 30, width: 0, height: 0, size: 4096, mtimeMs: 1_000, hasAudio: true, audioChannels: 1, audioSampleRate: 44_100 };
    const clip = { id: 'clip-music-1', type: 'audio' as const, name: 'music.wav', mediaId: 'media-music', trackId: 'track-music', start: 0, duration: 30, trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, volume: 1, colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM } };
    const timeline = {
      transitions: [], markers: [],
      tracks: [createTrack({
        id: 'track-music', type: 'audio', name: 'Audio 1', clips: [clip],
        musicStructure: [
          { time: 8, type: 'energy_rise' as const, confidence: 0.8 },
          { time: 16, type: 'timbre_shift' as const, confidence: 0.7 },
          { time: 24, type: 'energy_drop' as const, confidence: 0.6 },
        ]
      })]
    };
    useEditorStore.getState().setProject({ ...project, media: [asset], timeline, sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }], activeSequenceId: PRIMARY_SEQUENCE_ID });
    commandManager.clear();
  },
  setupSubtitleReadingSpeedFixture: () => {
    const project = createProject('Subtitle Reading Speed E2E');
    const asset = { id: 'media-sub-rs', type: 'video' as const, name: 'sub-rs.mp4', path: tinyVideo, duration: 30, width: 1920, height: 1080, size: 4096, mtimeMs: 1_000, hasAudio: false };
    const subClip1 = {
      id: 'clip-sub-rs-1', type: 'subtitle' as const, name: '字幕1', mediaId: '', trackId: 'track-sub-rs', start: 0, duration: 0.5, trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, volume: 0, colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM },
      text: '这是一段非常长的中文字幕内容', style: { ...DEFAULT_SUBTITLE_STYLE },
      readingSpeedWarning: { charsPerSecond: 12, recommendedMax: 6, severity: 'critical' as const },
      subtitleMode: DEFAULT_SUBTITLE_MODE,
    };
    const subClip2 = {
      id: 'clip-sub-rs-2', type: 'subtitle' as const, name: '字幕2', mediaId: '', trackId: 'track-sub-rs', start: 1, duration: 1.5, trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, volume: 0, colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM },
      text: '另一段速度偏快的字幕', style: { ...DEFAULT_SUBTITLE_STYLE },
      readingSpeedWarning: { charsPerSecond: 7.2, recommendedMax: 6, severity: 'warning' as const },
      subtitleMode: DEFAULT_SUBTITLE_MODE,
    };
    const timeline = { transitions: [], markers: [], tracks: [createTrack({ id: 'track-sub-rs', type: 'subtitle', name: 'Subtitle 1', clips: [subClip1, subClip2] })] };
    useEditorStore.getState().setProject({ ...project, media: [asset], timeline, sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }], activeSequenceId: PRIMARY_SEQUENCE_ID });
    commandManager.clear();
  },
  applyFlashReduction: (clipIdInput?: unknown) => {
    const clipId = typeof clipIdInput === 'string' ? clipIdInput : '';
    const state = useEditorStore.getState();
    const p = state.project;
    if (!p) return;
    const newTracks = p.timeline.tracks.map((t) => ({
      ...t,
      clips: t.clips.map((c) => {
        if (c.id !== clipId || !('flashWarnings' in c)) return c;
        return { ...c, flashWarnings: (c.flashWarnings ?? []).filter((fw) => fw.severity !== 'low') };
      }),
    }));
    const timeline = { ...p.timeline, tracks: newTracks };
    useEditorStore.getState().setProject({ ...p, timeline, sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }], activeSequenceId: PRIMARY_SEQUENCE_ID });
  },
  insertContinuityTransition: (_unused?: unknown) => {
    const state = useEditorStore.getState();
    const p = state.project;
    if (!p) return;
    const timeline = { ...p.timeline, continuityWarnings: [] as Array<never> };
    useEditorStore.getState().setProject({ ...p, timeline, sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }], activeSequenceId: PRIMARY_SEQUENCE_ID });
  },
  snapClipToStructure: (clipIdInput?: unknown, trackIdInput?: unknown) => {
    const clipId = typeof clipIdInput === 'string' ? clipIdInput : '';
    const trackId = typeof trackIdInput === 'string' ? trackIdInput : '';
    const state = useEditorStore.getState();
    const p = state.project;
    if (!p) return;
    const track = p.timeline.tracks.find((t) => t.id === trackId);
    if (!track || !track.musicStructure) return;
    const clip = track.clips.find((c) => c.id === clipId);
    if (!clip) return;
    const boundaryTime = clip.start + clip.duration;
    let bestPoint = track.musicStructure[0];
    let bestDist = Math.abs(boundaryTime - bestPoint.time);
    for (const pt of track.musicStructure) {
      const d = Math.abs(boundaryTime - pt.time);
      if (d < bestDist) { bestDist = d; bestPoint = pt; }
    }
    if (bestDist > 0.3) return;
    const newDuration = bestPoint.time - clip.start;
    const newTracks = p.timeline.tracks.map((t) => ({
      ...t,
      clips: t.clips.map((c) => c.id === clipId ? { ...c, duration: newDuration } : c),
    }));
    const timeline = { ...p.timeline, tracks: newTracks };
    useEditorStore.getState().setProject({ ...p, timeline, sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }], activeSequenceId: PRIMARY_SEQUENCE_ID });
  },
  autoSplitSubtitle: (clipIdInput?: unknown, trackIdInput?: unknown) => {
    const clipId = typeof clipIdInput === 'string' ? clipIdInput : '';
    const trackId = typeof trackIdInput === 'string' ? trackIdInput : '';
    const state = useEditorStore.getState();
    const p = state.project;
    if (!p) return;
    const newTracks = p.timeline.tracks.map((t) => {
      if (t.id !== trackId) return t;
      return {
        ...t,
        clips: t.clips.map((c) => {
          if (c.id !== clipId || c.type !== 'subtitle' || !('text' in c)) return c;
          const text = c.text;
          const mid = Math.ceil(text.length / 2);
          const splitTime = c.start + c.duration / 2;
          return { ...c, text: text.slice(0, mid), duration: c.duration / 2, readingSpeedWarning: null };
        }),
      };
    });
    const timeline = { ...p.timeline, tracks: newTracks };
    useEditorStore.getState().setProject({ ...p, timeline, sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }], activeSequenceId: PRIMARY_SEQUENCE_ID });
  },
  extendSubtitleDuration: (clipIdInput?: unknown, trackIdInput?: unknown, nextStartInput?: unknown) => {
    const clipId = typeof clipIdInput === 'string' ? clipIdInput : '';
    const trackId = typeof trackIdInput === 'string' ? trackIdInput : '';
    const nextStart = typeof nextStartInput === 'number' ? nextStartInput : Infinity;
    const state = useEditorStore.getState();
    const p = state.project;
    if (!p) return;
    const clip = p.timeline.tracks.find((t) => t.id === trackId)?.clips.find((c) => c.id === clipId);
    if (!clip || !('text' in clip)) return;
    const chars = clip.text.length;
    const safeDuration = chars / 6;
    const newEnd = clip.start + safeDuration;
    if (newEnd > nextStart) return;
    const newTracks = p.timeline.tracks.map((t) => ({
      ...t,
      clips: t.clips.map((c) => c.id === clipId ? { ...c, duration: safeDuration, readingSpeedWarning: null } : c),
    }));
    const timeline = { ...p.timeline, tracks: newTracks };
    useEditorStore.getState().setProject({ ...p, timeline, sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }], activeSequenceId: PRIMARY_SEQUENCE_ID });
  },
  commandManager: { undo: () => commandManager.undo(), redo: () => commandManager.redo() } as any,
  setupMotionTypeFixture: () => {
    const project = createProject('Motion Type E2E');
    const assetPan = { id: 'media-mt-pan', type: 'video' as const, name: 'pan.mp4', path: tinyVideo, duration: 5, width: 1920, height: 1080, size: 4096, mtimeMs: 1_000, hasAudio: false };
    const assetTilt = { id: 'media-mt-tilt', type: 'video' as const, name: 'tilt.mp4', path: tinyVideo, duration: 5, width: 1920, height: 1080, size: 4096, mtimeMs: 1_000, hasAudio: false };
    const assetStatic = { id: 'media-mt-static', type: 'video' as const, name: 'static.mp4', path: tinyVideo, duration: 5, width: 1920, height: 1080, size: 4096, mtimeMs: 1_000, hasAudio: false };
    const clipPan = { id: 'clip-mt-pan', type: 'video' as const, name: 'pan.mp4', mediaId: 'media-mt-pan', trackId: 'track-mt-video', start: 0, duration: 5, trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, volume: 1, colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM }, motionType: { type: 'pan' as const, confidence: 0.92, analyzedAt: new Date().toISOString() } };
    const clipTilt = { id: 'clip-mt-tilt', type: 'video' as const, name: 'tilt.mp4', mediaId: 'media-mt-tilt', trackId: 'track-mt-video', start: 5, duration: 5, trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, volume: 1, colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM }, motionType: { type: 'tilt' as const, confidence: 0.88, analyzedAt: new Date().toISOString() } };
    const clipStatic = { id: 'clip-mt-static', type: 'video' as const, name: 'static.mp4', mediaId: 'media-mt-static', trackId: 'track-mt-video', start: 10, duration: 5, trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, volume: 1, colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM }, motionType: { type: 'static' as const, confidence: 0.95, analyzedAt: new Date().toISOString() } };
    const timeline = { transitions: [], markers: [], tracks: [createTrack({ id: 'track-mt-video', type: 'video', name: 'Video 1', clips: [clipPan, clipTilt, clipStatic] })] };
    useEditorStore.getState().setProject({ ...project, media: [assetPan, assetTilt, assetStatic], timeline, sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }], activeSequenceId: PRIMARY_SEQUENCE_ID });
    commandManager.clear();
  },
  filterByMotionType: (motionTypeInput?: unknown) => {
    const mt = typeof motionTypeInput === 'string' ? motionTypeInput : 'pan';
    const p = useEditorStore.getState().project;
    if (!p) return 0;
    const matched = p.media.filter((m) => {
      const clip = p.timeline.tracks.flatMap((t) => t.clips).find((c) => 'mediaId' in c && c.mediaId === m.id && 'motionType' in c && (c as { motionType?: { type: string } }).motionType?.type === mt);
      return clip != null;
    });
    return matched.length;
  },
  setupColorConsistencyFixture: () => {
    const project = createProject('Color Consistency E2E');
    const assetA = { id: 'media-cc-a', type: 'video' as const, name: 'cc-a.mp4', path: tinyVideo, duration: 5, width: 1920, height: 1080, size: 4096, mtimeMs: 1_000, hasAudio: false };
    const assetB = { id: 'media-cc-b', type: 'video' as const, name: 'cc-b.mp4', path: tinyVideo, duration: 5, width: 1920, height: 1080, size: 4096, mtimeMs: 1_000, hasAudio: false };
    const clipA = { id: 'clip-cc-a', type: 'video' as const, name: 'cc-a.mp4', mediaId: 'media-cc-a', trackId: 'track-cc-video', start: 0, duration: 5, trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, volume: 1, colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM } };
    const clipB = { id: 'clip-cc-b', type: 'video' as const, name: 'cc-b.mp4', mediaId: 'media-cc-b', trackId: 'track-cc-video', start: 5, duration: 5, trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, volume: 1, colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM } };
    const timeline = {
      transitions: [], markers: [],
      tracks: [createTrack({ id: 'track-cc-video', type: 'video', name: 'Video 1', clips: [clipA, clipB] })],
      colorConsistencyWarnings: [
        { clipAId: 'clip-cc-a', clipBId: 'clip-cc-b', type: 'skin_tone' as const, deltaRGB: 45.2, reason: '肤色ΔRGB=45.2 > 30' },
      ]
    };
    useEditorStore.getState().setProject({ ...project, media: [assetA, assetB], timeline, sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }], activeSequenceId: PRIMARY_SEQUENCE_ID });
    commandManager.clear();
  },
  applyColorCompensation: () => {
    const p = useEditorStore.getState().project;
    if (!p) return;
    const warnings = (p.timeline.colorConsistencyWarnings ?? []).filter((w) => !(w.clipAId === 'clip-cc-a' && w.clipBId === 'clip-cc-b'));
    const timeline = { ...p.timeline, colorConsistencyWarnings: warnings };
    useEditorStore.getState().setProject({ ...p, timeline, sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }], activeSequenceId: PRIMARY_SEQUENCE_ID });
  },
  injectMalformedColorWarnings: () => {
    const p = useEditorStore.getState().project;
    if (!p) return;
    const malformedWarnings = [
      { clipAId: null, clipBId: null, type: null, deltaRGB: null, reason: null },
      { clipAId: undefined, clipBId: undefined, type: undefined, deltaRGB: undefined, reason: undefined },
      {},
      { clipAId: 123, clipBId: true, type: 42, deltaRGB: 'not-a-number', reason: {} },
    ];
    const timeline = { ...p.timeline, colorConsistencyWarnings: malformedWarnings as unknown as typeof p.timeline.colorConsistencyWarnings };
    useEditorStore.getState().setProject({ ...p, timeline, sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }], activeSequenceId: PRIMARY_SEQUENCE_ID });
  },
  setupSfxMatchFixture: () => {
    const project = createProject('SFX Match E2E');
    const asset = { id: 'media-sfx', type: 'video' as const, name: 'sfx-clip.mp4', path: tinyVideo, duration: 20, width: 1920, height: 1080, size: 4096, mtimeMs: 1_000, hasAudio: false };
    const clip1 = { id: 'clip-sfx-1', type: 'video' as const, name: 'sfx-clip.mp4', mediaId: 'media-sfx', trackId: 'track-sfx-video', start: 0, duration: 10, trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, volume: 1, colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM } };
    const clip2 = { id: 'clip-sfx-2', type: 'video' as const, name: 'sfx-clip-b.mp4', mediaId: 'media-sfx', trackId: 'track-sfx-video', start: 10, duration: 10, trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, volume: 1, colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM } };
    const timeline = {
      transitions: [], markers: [],
      tracks: [createTrack({ id: 'track-sfx-video', type: 'video', name: 'Video 1', clips: [clip1, clip2] })],
      sfxSuggestions: [
        { time: 3.0, category: 'footstep', confidence: 0.85, matchedAssetId: 'sfx-footstep-1', status: 'pending' as const },
        { time: 12.0, category: 'door_slam', confidence: 0.72, matchedAssetId: null, status: 'pending' as const },
      ]
    };
    useEditorStore.getState().setProject({ ...project, media: [asset], timeline, sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }], activeSequenceId: PRIMARY_SEQUENCE_ID });
    commandManager.clear();
  },
  insertSfx: (sfxIndexInput?: unknown) => {
    const idx = typeof sfxIndexInput === 'number' ? sfxIndexInput : 0;
    const p = useEditorStore.getState().project;
    if (!p) return;
    const suggestions = [...(p.timeline.sfxSuggestions ?? [])];
    if (idx >= 0 && idx < suggestions.length) {
      suggestions[idx] = { ...suggestions[idx], status: 'accepted' };
    }
    const timeline = { ...p.timeline, sfxSuggestions: suggestions };
    useEditorStore.getState().setProject({ ...p, timeline, sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }], activeSequenceId: PRIMARY_SEQUENCE_ID });
  },
  setupPacingAnalysisFixture: () => {
    const project = createProject('Pacing Analysis E2E');
    const asset = { id: 'media-pacing', type: 'video' as const, name: 'pacing.mp4', path: tinyVideo, duration: 90, width: 1920, height: 1080, size: 4096, mtimeMs: 1_000, hasAudio: false };
    const clips = Array.from({ length: 18 }, (_, i) => ({
      id: `clip-pacing-${i}`, type: 'video' as const, name: `pacing-${i}.mp4`, mediaId: 'media-pacing', trackId: 'track-pacing', start: i * 5, duration: 5, trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, volume: 1, colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM },
    }));
    const cpmCurve = Array.from({ length: 30 }, (_, i) => ({ time: i * 3, cpm: i >= 20 && i <= 24 ? 1.0 : 4.0 }));
    const pacingAnalysis = {
      cpmCurve,
      slowSegments: [{ start: 60, end: 75 }],
      fastSegments: [] as Array<{ start: number; end: number }>,
      overallAvgCPM: 3.5,
    };
    const timeline = { transitions: [], markers: [], tracks: [createTrack({ id: 'track-pacing', type: 'video', name: 'Video 1', clips })] };
    useEditorStore.getState().setProject({ ...project, media: [asset], timeline, pacingAnalysis, sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }], activeSequenceId: PRIMARY_SEQUENCE_ID });
    commandManager.clear();
  },
  setupCharacterTimelineFixture: () => {
    const project = createProject('Character Timeline E2E');
    const asset = { id: 'media-char', type: 'video' as const, name: 'char-clip.mp4', path: tinyVideo, duration: 10, width: 1920, height: 1080, size: 4096, mtimeMs: 1_000, hasAudio: false };
    const clip1 = { id: 'clip-char-1', type: 'video' as const, name: 'char-clip-1.mp4', mediaId: 'media-char', trackId: 'track-char-video', start: 0, duration: 5, trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, volume: 1, colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM } };
    const clip2 = { id: 'clip-char-2', type: 'video' as const, name: 'char-clip-2.mp4', mediaId: 'media-char', trackId: 'track-char-video', start: 5, duration: 5, trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, volume: 1, colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM } };
    const characterTimeline = {
      characters: {
        character_1: { label: '戴眼镜的男性', appearances: [{ clipId: 'clip-char-1', startTime: 0, endTime: 4, confidence: 0.85 }] },
        character_2: { label: '红色上衣的女性', appearances: [{ clipId: 'clip-char-2', startTime: 5, endTime: 9, confidence: 0.78 }] },
      },
      lastAnalyzedAt: new Date().toISOString(),
    };
    const timeline = { transitions: [], markers: [], tracks: [createTrack({ id: 'track-char-video', type: 'video', name: 'Video 1', clips: [clip1, clip2] })] };
    useEditorStore.getState().setProject({ ...project, media: [asset], timeline, characterTimeline, sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }], activeSequenceId: PRIMARY_SEQUENCE_ID });
    commandManager.clear();
  },
  setupCharacterTimelineMergeFixture: () => {
    const project = createProject('Character Timeline Merge E2E');
    const asset = { id: 'media-char-merge', type: 'video' as const, name: 'char-merge.mp4', path: tinyVideo, duration: 10, width: 1920, height: 1080, size: 4096, mtimeMs: 1_000, hasAudio: false };
    const clip1 = { id: 'clip-char-merge-1', type: 'video' as const, name: 'char-merge-1.mp4', mediaId: 'media-char-merge', trackId: 'track-char-merge', start: 0, duration: 5, trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, volume: 1, colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM } };
    const clip2 = { id: 'clip-char-merge-2', type: 'video' as const, name: 'char-merge-2.mp4', mediaId: 'media-char-merge', trackId: 'track-char-merge', start: 5, duration: 5, trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, volume: 1, colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM } };
    const characterTimeline = {
      characters: {
        character_1: { label: '戴眼镜, 蓝色上衣, 男性', appearances: [{ clipId: 'clip-char-merge-1', startTime: 0, endTime: 4, confidence: 0.85 }, { clipId: 'clip-char-merge-2', startTime: 5, endTime: 9, confidence: 0.82 }] },
      },
      lastAnalyzedAt: new Date().toISOString(),
    };
    const timeline = { transitions: [], markers: [], tracks: [createTrack({ id: 'track-char-merge', type: 'video', name: 'Video 1', clips: [clip1, clip2] })] };
    useEditorStore.getState().setProject({ ...project, media: [asset], timeline, characterTimeline, sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }], activeSequenceId: PRIMARY_SEQUENCE_ID });
    commandManager.clear();
  },
  setupPreflightChecklistFixture: () => {
    const project = createProject('Preflight Checklist E2E');
    const asset = { id: 'media-preflight', type: 'video' as const, name: 'preflight.mp4', path: tinyVideo, duration: 10, width: 1920, height: 1080, size: 4096, mtimeMs: 1_000, hasAudio: false };
    const clip1 = {
      id: 'clip-preflight-1', type: 'video' as const, name: 'preflight-1.mp4', mediaId: 'media-preflight', trackId: 'track-preflight', start: 0, duration: 5, trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, volume: 1, colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM },
      flashWarnings: [{ startTime: 1.0, endTime: 2.0, flashRate: 5.0, severity: 'high' as const, isRedFlash: true }],
    };
    const clip2 = {
      id: 'clip-preflight-2', type: 'video' as const, name: 'preflight-2.mp4', mediaId: 'media-preflight', trackId: 'track-preflight', start: 5, duration: 5, trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, volume: 1, colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM },
    };
    const timeline = {
      transitions: [], markers: [],
      tracks: [createTrack({ id: 'track-preflight', type: 'video', name: 'Video 1', clips: [clip1, clip2] })],
      continuityWarnings: [{ clipAId: 'clip-preflight-1', clipBId: 'clip-preflight-2', type: 'jump_cut' as const, confidence: 0.9, reason: '跳切检测' }],
    };
    useEditorStore.getState().setProject({ ...project, media: [asset], timeline, sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }], activeSequenceId: PRIMARY_SEQUENCE_ID });
    commandManager.clear();
  },
  setupPreflightAcknowledgeFixture: () => {
    const project = createProject('Preflight Acknowledge E2E');
    const asset = { id: 'media-preflight-ack', type: 'video' as const, name: 'preflight-ack.mp4', path: tinyVideo, duration: 10, width: 1920, height: 1080, size: 4096, mtimeMs: 1_000, hasAudio: false };
    const clip1 = {
      id: 'clip-preflight-ack-1', type: 'video' as const, name: 'preflight-ack-1.mp4', mediaId: 'media-preflight-ack', trackId: 'track-preflight-ack', start: 0, duration: 5, trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, volume: 1, colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM },
      flashWarnings: [{ startTime: 1.0, endTime: 2.0, flashRate: 5.0, severity: 'high' as const, isRedFlash: true }],
    };
    const clip2 = {
      id: 'clip-preflight-ack-2', type: 'video' as const, name: 'preflight-ack-2.mp4', mediaId: 'media-preflight-ack', trackId: 'track-preflight-ack', start: 5, duration: 5, trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, volume: 1, colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM },
    };
    const timeline = {
      transitions: [], markers: [],
      tracks: [createTrack({ id: 'track-preflight-ack', type: 'video', name: 'Video 1', clips: [clip1, clip2] })],
      continuityWarnings: [{ clipAId: 'clip-preflight-ack-1', clipBId: 'clip-preflight-ack-2', type: 'jump_cut' as const, confidence: 0.9, reason: '跳切检测' }],
    };
    const flashIssueId = 'flash-clip-preflight-ack-1-1';
    const continuityIssueId = 'continuity-clip-preflight-ack-1-clip-preflight-ack-2-jump_cut';
    const preflightReport = {
      generatedAt: new Date().toISOString(),
      issuesByCategory: {
        flash: [{ id: flashIssueId, category: 'flash' as const, severity: 'critical' as const, message: '闪烁警告: flashRate=5.0, severity=high, 红色闪烁', time: 1.0, clipId: 'clip-preflight-ack-1' }],
        continuity: [{ id: continuityIssueId, category: 'continuity' as const, severity: 'warning' as const, message: '连续性警告: jump_cut - 跳切检测', clipId: 'clip-preflight-ack-1' }],
      },
      aiSummary: '发现1个严重问题和1个警告',
      totalCritical: 1,
      totalWarnings: 1,
      acknowledgedIssueIds: [],
    };
    useEditorStore.getState().setProject({ ...project, media: [asset], timeline, preflightReport, sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }], activeSequenceId: PRIMARY_SEQUENCE_ID });
    commandManager.clear();
  },
  setupEmotionToneFixture: () => {
    const project = createProject('Emotion Tone E2E');
    const asset = { id: 'media-emo', type: 'video' as const, name: 'emo.mp4', path: tinyVideo, duration: 10, width: 1920, height: 1080, size: 4096, mtimeMs: 1_000, hasAudio: false };
    const clipWithEmotion = {
      id: 'clip-emo-1', type: 'video' as const, name: 'emo-1.mp4', mediaId: 'media-emo', trackId: 'track-emo', start: 0, duration: 5, trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, volume: 1, colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM },
      emotionAnalysis: { emotionTone: 'calm' as const, intensity: 0.8, reason: '平静的水面', analyzedAt: new Date().toISOString() },
    };
    const clipWithoutEmotion = {
      id: 'clip-emo-2', type: 'video' as const, name: 'emo-2.mp4', mediaId: 'media-emo', trackId: 'track-emo', start: 5, duration: 5, trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, volume: 1, colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM },
    };
    const timeline = { transitions: [], markers: [], tracks: [createTrack({ id: 'track-emo', type: 'video', name: 'Video 1', clips: [clipWithEmotion, clipWithoutEmotion] })] };
    useEditorStore.getState().setProject({ ...project, media: [asset], timeline, sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }], activeSequenceId: PRIMARY_SEQUENCE_ID });
    commandManager.clear();
  },
  setupEmotionToneMultiFixture: () => {
    const project = createProject('Emotion Tone Multi E2E');
    const asset1 = { id: 'media-emo-m1', type: 'video' as const, name: 'emo-m1.mp4', path: tinyVideo, duration: 5, width: 1920, height: 1080, size: 4096, mtimeMs: 1_000, hasAudio: false };
    const asset2 = { id: 'media-emo-m2', type: 'video' as const, name: 'emo-m2.mp4', path: tinyVideo, duration: 5, width: 1920, height: 1080, size: 4096, mtimeMs: 2_000, hasAudio: false };
    const asset3 = { id: 'media-emo-m3', type: 'video' as const, name: 'emo-m3.mp4', path: tinyVideo, duration: 5, width: 1920, height: 1080, size: 4096, mtimeMs: 3_000, hasAudio: false };
    const clipCalm = {
      id: 'clip-emo-calm', type: 'video' as const, name: 'emo-calm.mp4', mediaId: 'media-emo-m1', trackId: 'track-emo-multi', start: 0, duration: 3, trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, volume: 1, colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM },
      emotionAnalysis: { emotionTone: 'calm' as const, intensity: 0.75, reason: '安静的湖面', analyzedAt: new Date().toISOString() },
    };
    const clipEnergetic = {
      id: 'clip-emo-energetic', type: 'video' as const, name: 'emo-energetic.mp4', mediaId: 'media-emo-m2', trackId: 'track-emo-multi', start: 3, duration: 3, trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, volume: 1, colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM },
      emotionAnalysis: { emotionTone: 'energetic' as const, intensity: 0.9, reason: '快节奏舞蹈', analyzedAt: new Date().toISOString() },
    };
    const clipTense = {
      id: 'clip-emo-tense', type: 'video' as const, name: 'emo-tense.mp4', mediaId: 'media-emo-m3', trackId: 'track-emo-multi', start: 6, duration: 3, trimStart: 0, trimEnd: 0, speed: DEFAULT_CLIP_SPEED, volume: 1, colorCorrection: { ...DEFAULT_COLOR_CORRECTION }, transform: { ...DEFAULT_TRANSFORM },
      emotionAnalysis: { emotionTone: 'tense' as const, intensity: 0.85, reason: '追逐场景', analyzedAt: new Date().toISOString() },
    };
    const timeline = { transitions: [], markers: [], tracks: [createTrack({ id: 'track-emo-multi', type: 'video', name: 'Video 1', clips: [clipCalm, clipEnergetic, clipTense] })] };
    useEditorStore.getState().setProject({ ...project, media: [asset1, asset2, asset3], timeline, sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }], activeSequenceId: PRIMARY_SEQUENCE_ID });
    commandManager.clear();
  },
  setupDubbingAdaptationCompressFixture: () => {
    const project = createProject('Dubbing Adaptation E2E');
    useEditorStore.getState().setProject({
      ...project,
      ttsSegments: [
        { id: 'tts-seg-1', subtitleClipId: 'clip-sub-1', originalDuration: 10, dubbedDuration: 13 },
      ],
    });
    commandManager.clear();
  },
  setupDubbingAdaptationPadFixture: () => {
    const project = createProject('Dubbing Adaptation Pad E2E');
    useEditorStore.getState().setProject({
      ...project,
      ttsSegments: [
        { id: 'tts-seg-short', subtitleClipId: 'clip-sub-s', originalDuration: 10, dubbedDuration: 7 },
        { id: 'tts-seg-extreme', subtitleClipId: 'clip-sub-e', originalDuration: 10, dubbedDuration: 20 },
      ],
    });
    commandManager.clear();
  },
  setupAISubtitleWorkflowFixture: () => {
    const project = createProject('AISubtitleWorkflow E2E');
    const asset: MediaAsset = {
      id: 'media-subtitle-workflow-video',
      type: 'video',
      name: 'subtitle-workflow-video.mp4',
      path: tinyVideo,
      duration: 8,
      width: 1920,
      height: 1080,
      size: 8192,
      mtimeMs: 1_000,
      hasAudio: true,
      audioChannels: 2,
      audioSampleRate: 44_100,
      audioCodec: 'aac'
    };
    const timeline = {
      transitions: [],
      markers: [],
      tracks: [
        createTrack({
          id: 'track-subtitle-workflow-video',
          type: 'video',
          name: 'Video 1',
          clips: [
            {
              id: 'clip-subtitle-workflow-video',
              type: 'video',
              name: 'subtitle-workflow-video.mp4',
              mediaId: 'media-subtitle-workflow-video',
              trackId: 'track-subtitle-workflow-video',
              start: 0,
              duration: 8,
              trimStart: 0,
              trimEnd: 0,
              speed: DEFAULT_CLIP_SPEED,
              colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
              transform: { ...DEFAULT_TRANSFORM },
              volume: 1,
            },
          ]
        }),
      ]
    };
    useEditorStore.getState().setProject({
      ...project,
      media: [asset],
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID,
    });
    useEditorStore.getState().setSelectedClipIds([]);
    useEditorStore.getState().setPlayheadTime(0);
    useEditorUIStore.getState().setAiSubtitleWorkflowOpen(true);
    commandManager.clear();
  },
  setupAISubtitleWorkflowFixtureWithClip: () => {
    const project = createProject('AISubtitleWorkflow E2E');
    const asset: MediaAsset = {
      id: 'media-subtitle-workflow-video',
      type: 'video',
      name: 'subtitle-workflow-video.mp4',
      path: tinyVideo,
      duration: 8,
      width: 1920,
      height: 1080,
      size: 8192,
      mtimeMs: 1_000,
      hasAudio: true,
      audioChannels: 2,
      audioSampleRate: 44_100,
      audioCodec: 'aac'
    };
    const timeline = {
      transitions: [],
      markers: [],
      tracks: [
        createTrack({
          id: 'track-subtitle-workflow-video',
          type: 'video',
          name: 'Video 1',
          clips: [
            {
              id: 'clip-subtitle-workflow-video',
              type: 'video',
              name: 'subtitle-workflow-video.mp4',
              mediaId: 'media-subtitle-workflow-video',
              trackId: 'track-subtitle-workflow-video',
              start: 0,
              duration: 8,
              trimStart: 0,
              trimEnd: 0,
              speed: DEFAULT_CLIP_SPEED,
              colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
              transform: { ...DEFAULT_TRANSFORM },
              volume: 1,
            },
          ]
        }),
      ]
    };
    useEditorStore.getState().setProject({
      ...project,
      media: [asset],
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID,
    });
    useEditorStore.getState().setSelectedClipIds(['clip-subtitle-workflow-video']);
    useEditorStore.getState().setSelectedClipId('clip-subtitle-workflow-video');
    useEditorStore.getState().setPlayheadTime(0);
    useEditorUIStore.getState().setAiSubtitleWorkflowOpen(true);
    commandManager.clear();
  },
  setupSmartCreationDeepFixture: () => {
    const project = createProject('Smart Creation Deep E2E');
    const assetA: MediaAsset = {
      id: 'media-scene-outdoor',
      type: 'video',
      name: 'outdoor-sunny.mp4',
      path: tinyVideo,
      duration: 12,
      width: 1920,
      height: 1080,
      size: 16384,
      mtimeMs: 1_000,
      hasAudio: true,
      audioChannels: 2,
      audioSampleRate: 48_000,
      audioCodec: 'aac',
      videoCodec: 'h264',
      frameRate: 30,
      colorProfile: { sourceColorSpace: 'rec709', label: 'SDR', colorPrimaries: 'bt709', colorTransfer: 'bt709' },
      aiAnalysis: { tags: ['户外', '阳光'], scene: 'outdoor sunny', mood: 'energetic', objects: ['天空', '草地'], analysisTime: '2026-01-01T00:00:00Z', providerId: 'mock' }
    };
    const assetB: MediaAsset = {
      id: 'media-scene-indoor',
      type: 'video',
      name: 'indoor-calm.mp4',
      path: tinyVideoB,
      duration: 8,
      width: 1280,
      height: 720,
      size: 8192,
      mtimeMs: 2_000,
      hasAudio: true,
      audioChannels: 2,
      audioSampleRate: 44_100,
      audioCodec: 'aac',
      videoCodec: 'h264',
      frameRate: 24,
      aiAnalysis: { tags: ['室内', '平静'], scene: 'indoor calm', mood: 'calm', objects: ['家具', '灯光'], analysisTime: '2026-01-01T00:00:00Z', providerId: 'mock' }
    };
    const assetC: MediaAsset = {
      id: 'media-scene-night',
      type: 'video',
      name: 'night-city.mp4',
      path: fourKHevcVideo,
      duration: 10,
      width: 3840,
      height: 2160,
      size: 32768,
      mtimeMs: 3_000,
      hasAudio: true,
      audioChannels: 6,
      audioSampleRate: 48_000,
      audioCodec: 'aac',
      videoCodec: 'hevc',
      frameRate: 60,
      colorProfile: { sourceColorSpace: 'rec2020', label: 'HDR', colorPrimaries: 'bt2020', colorTransfer: 'smpte2084' },
      aiAnalysis: { tags: ['夜景', '城市'], scene: 'night action', mood: 'exciting', objects: ['霓虹灯', '街道'], analysisTime: '2026-01-01T00:00:00Z', providerId: 'mock' }
    };
    const timeline = {
      transitions: [],
      markers: [],
      tracks: [
        createTrack({ id: 'track-video', type: 'video', name: 'Video 1', clips: [] }),
        createTrack({ id: 'track-audio', type: 'audio', name: 'Audio 1', clips: [] }),
        createTrack({ id: 'track-text', type: 'text', name: 'Text 1', clips: [] })
      ]
    };
    useEditorStore.getState().setProject({
      ...project,
      media: [assetA, assetB, assetC],
      timeline,
      sequences: [{ id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline }],
      activeSequenceId: PRIMARY_SEQUENCE_ID
    });
    useEditorStore.getState().setSelectedClipIds([]);
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
  }
};

function makeWhisperVideoClip(): Extract<import('@open-factory/editor-core').Clip, { type: 'video' }> {
  return {
    id: 'clip-whisper-video',
    type: 'video',
    name: 'whisper-video.mp4',
    mediaId: 'media-whisper-video',
    trackId: 'track-video',
    start: 0,
    duration: 4,
    trimStart: 0,
    trimEnd: 0,
    speed: DEFAULT_CLIP_SPEED,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
    transform: { ...DEFAULT_TRANSFORM },
    volume: 1
  };
}

function makeHealthVideoClip(): Extract<import('@open-factory/editor-core').Clip, { type: 'video' }> {
  return {
    id: 'clip-health-missing',
    type: 'video',
    name: 'Health Missing Video',
    mediaId: 'media-health-missing',
    trackId: 'track-video',
    start: 0,
    duration: 4,
    trimStart: 0,
    trimEnd: 0,
    speed: DEFAULT_CLIP_SPEED,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
    transform: { ...DEFAULT_TRANSFORM },
    volume: 1
  };
}

function makeDuplicateVideoClip(): Extract<import('@open-factory/editor-core').Clip, { type: 'video' }> {
  return {
    id: 'clip-duplicate-b',
    type: 'video',
    name: 'Duplicate B',
    mediaId: 'media-duplicate-b',
    trackId: 'track-video',
    start: 0,
    duration: 4,
    trimStart: 0,
    trimEnd: 0,
    speed: DEFAULT_CLIP_SPEED,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
    transform: { ...DEFAULT_TRANSFORM },
    volume: 1
  };
}

function makeRenderFarmVideoClip(): Extract<import('@open-factory/editor-core').Clip, { type: 'video' }> {
  return {
    id: 'clip-render-farm',
    type: 'video',
    name: 'Render Farm Long',
    mediaId: 'media-render-farm',
    trackId: 'track-video',
    start: 0,
    duration: 65,
    trimStart: 0,
    trimEnd: 0,
    speed: DEFAULT_CLIP_SPEED,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
    transform: { ...DEFAULT_TRANSFORM },
    volume: 1
  };
}

function makeEditingVideoClip(id: string, start: number, duration: number, trimStart: number, trimEnd: number): Extract<Clip, { type: 'video' }> {
  return {
    id,
    type: 'video',
    name: `${id}.mp4`,
    mediaId: 'media-editing-video',
    trackId: 'track-video',
    start,
    duration,
    trimStart,
    trimEnd,
    speed: DEFAULT_CLIP_SPEED,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
    transform: { ...DEFAULT_TRANSFORM },
    volume: 1
  };
}

function makeLargeTimelineVideoClip(id: string, trackId: string, mediaId: string, start: number): Extract<Clip, { type: 'video' }> {
  return {
    id,
    type: 'video',
    name: `${id}.mp4`,
    mediaId,
    trackId,
    start,
    duration: 1,
    trimStart: 0,
    trimEnd: 0,
    speed: DEFAULT_CLIP_SPEED,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
    transform: { ...DEFAULT_TRANSFORM },
    volume: 1
  };
}

function makeMockSubtitleClip(id: string, trackId: string, text: string, start: number): Extract<Clip, { type: 'subtitle' }> {
  return {
    id,
    type: 'subtitle',
    name: text,
    trackId,
    start,
    duration: 1.8,
    trimStart: 0,
    trimEnd: 0,
    speed: DEFAULT_CLIP_SPEED,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
    transform: { ...DEFAULT_TRANSFORM },
    text,
    style: { ...DEFAULT_SUBTITLE_STYLE },
    subtitleMode: DEFAULT_SUBTITLE_MODE
  };
}

function makeBeatVideoClip(id: string, name: string, start: number): Extract<Clip, { type: 'video' }> {
  return {
    id,
    type: 'video',
    name,
    mediaId: 'media-beat-video',
    trackId: 'track-video',
    start,
    duration: 0.5,
    trimStart: 0,
    trimEnd: 0,
    speed: DEFAULT_CLIP_SPEED,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
    transform: { ...DEFAULT_TRANSFORM },
    volume: 1
  };
}

function makeBeatAudioClip(): Extract<Clip, { type: 'audio' }> {
  return {
    id: 'clip-beat-audio',
    type: 'audio',
    name: 'Beat Source',
    mediaId: 'media-beat-audio',
    trackId: 'track-audio',
    start: 0,
    duration: 4,
    trimStart: 0,
    trimEnd: 0,
    speed: DEFAULT_CLIP_SPEED,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
    transform: { ...DEFAULT_TRANSFORM },
    volume: 1
  };
}

function makeAutoSyncMedia(id: string, name: string, path: string): MediaAsset {
  return {
    id,
    type: 'audio',
    name,
    path,
    duration: 4,
    width: 0,
    height: 0,
    size: 2048,
    mtimeMs: 1_000,
    hasAudio: true,
    audioChannels: 1,
    audioSampleRate: 48_000,
    audioCodec: 'pcm_s16le'
  };
}

function makeAutoSyncAudioClip(id: string, name: string, mediaId: string, trackId: string, start: number): Extract<Clip, { type: 'audio' }> {
  return {
    id,
    type: 'audio',
    name,
    mediaId,
    trackId,
    start,
    duration: 4,
    trimStart: 0,
    trimEnd: 0,
    speed: DEFAULT_CLIP_SPEED,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
    transform: { ...DEFAULT_TRANSFORM },
    volume: 1
  };
}

function makeAutoSyncWaveform(path: string, samplesPerSec: number): number[] {
  const rate = Math.max(1, samplesPerSec);
  const delay = path === autoSyncSecondaryAudio ? 0.35 : 0;
  const peaks = [0.8 + delay, 2.15 + delay];
  const total = Math.max(1, Math.ceil(4 * rate));
  return Array.from({ length: total }, (_, index) => {
    const time = index / rate;
    return peaks.some((peak) => Math.abs(time - peak) <= 0.012) ? 1 : 0.01;
  });
}

function makeStoryboardClip(
  id: string,
  type: 'video' | 'image',
  name: string,
  mediaId: string,
  start: number,
  duration: number
): Extract<Clip, { type: 'video' | 'image' }> {
  const base = {
    id,
    type,
    name,
    mediaId,
    trackId: 'track-video',
    start,
    duration,
    trimStart: 0,
    trimEnd: 0,
    speed: DEFAULT_CLIP_SPEED,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
    transform: { ...DEFAULT_TRANSFORM }
  };
  return type === 'video' ? { ...base, type, volume: 1 } : { ...base, type };
}

function makeSmartRoughCutVideoClip(): Extract<Clip, { type: 'video' }> {
  return {
    id: 'clip-smart-video',
    type: 'video',
    name: 'smart-video.mp4',
    mediaId: 'media-smart-video',
    trackId: 'track-video',
    start: 0,
    duration: 2.5,
    trimStart: 0,
    trimEnd: 0,
    speed: DEFAULT_CLIP_SPEED,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
    transform: { ...DEFAULT_TRANSFORM },
    volume: 1
  };
}

function makeMulticamVideoClip(id: string, mediaId: string, trackId: string, name: string): Extract<import('@open-factory/editor-core').Clip, { type: 'video' }> {
  return {
    id,
    type: 'video',
    name,
    mediaId,
    trackId,
    start: 0,
    duration: 4,
    trimStart: 0,
    trimEnd: 0,
    speed: DEFAULT_CLIP_SPEED,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
    transform: { ...DEFAULT_TRANSFORM },
    volume: 1
  };
}

function makeSilencePatternClip(): Extract<import('@open-factory/editor-core').Clip, { type: 'audio' }> {
  return {
    id: 'clip-silence-pattern',
    type: 'audio',
    name: 'silence-pattern.wav',
    mediaId: 'media-silence-pattern',
    trackId: 'track-audio',
    start: 0,
    duration: 2.5,
    trimStart: 0,
    trimEnd: 0,
    speed: DEFAULT_CLIP_SPEED,
    colorCorrection: { ...DEFAULT_COLOR_CORRECTION },
    transform: { ...DEFAULT_TRANSFORM },
    volume: 1
  };
}

function createToneWav(duration = 6, hz = 440): Uint8Array {
  const sampleRate = 44_100;
  const totalSamples = Math.floor(sampleRate * duration);
  const bytes = createWavContainer(totalSamples, sampleRate);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < totalSamples; index += 1) {
    const time = index / sampleRate;
    const amplitude = Math.sin(2 * Math.PI * hz * time) * 0.5;
    view.setInt16(44 + index * 2, Math.round(amplitude * 32767), true);
  }
  return bytes;
}

function createSilencePatternWav(): Uint8Array {
  const sampleRate = 44_100;
  const duration = 2.5;
  const totalSamples = Math.floor(sampleRate * duration);
  const bytes = createWavContainer(totalSamples, sampleRate);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < totalSamples; index += 1) {
    const time = index / sampleRate;
    const amplitude = time >= 1 && time < 1.5 ? 0 : Math.sin(2 * Math.PI * 440 * time) * 0.5;
    view.setInt16(44 + index * 2, Math.round(amplitude * 32767), true);
  }
  return bytes;
}

function createWavContainer(totalSamples: number, sampleRate: number): Uint8Array {
  const bytes = new Uint8Array(44 + totalSamples * 2);
  const view = new DataView(bytes.buffer);
  writeAscii(bytes, 0, 'RIFF');
  view.setUint32(4, bytes.byteLength - 8, true);
  writeAscii(bytes, 8, 'WAVE');
  writeAscii(bytes, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(bytes, 36, 'data');
  view.setUint32(40, totalSamples * 2, true);
  return bytes;
}

function writeAscii(bytes: Uint8Array, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    bytes[offset + index] = value.charCodeAt(index);
  }
}

function isKeyframeProperty(value: unknown): value is KeyframeProperty {
  return (
    value === 'x' ||
    value === 'y' ||
    value === 'scaleX' ||
    value === 'scaleY' ||
    value === 'opacity' ||
    value === 'volume' ||
    value === 'speed' ||
    value === 'yaw' ||
    value === 'pitch' ||
    value === 'roll' ||
    value === 'pathStartOffset'
  );
}

function emit(event: string, payload: unknown): void {
  for (const handler of listeners.get(event) ?? []) {
    handler(payload);
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForExportGate(taskId?: string): Promise<void> {
  if (!exportGateHeld) {
    return wait(20);
  }
  return new Promise((resolve) => {
    exportGates.push({ taskId, release: resolve });
  });
}

function releaseExportGateForTask(taskId?: string): void {
  const key = exportCancelKey(taskId);
  const index = exportGates.findIndex((gate) => exportCancelKey(gate.taskId) === key);
  if (index < 0) {
    return;
  }
  const [gate] = exportGates.splice(index, 1);
  gate.release();
  exportGateHeld = exportGates.length > 0;
}

function exportCancelKey(taskId?: string): string {
  return taskId ?? '__default_export__';
}

function buildMockPostExportScriptResult(plan: FfmpegExportPlan) {
  const command = plan.postExportScript?.command?.trim();
  if (!command) {
    return undefined;
  }
  const outputPath = plan.fullArgs.at(-1) ?? savePath;
  const resolvedCommand = command
    .replaceAll('{output}', outputPath)
    .replaceAll('{project}', plan.projectName ?? 'Untitled Project')
    .replaceAll('{duration}', Number.isFinite(plan.duration) ? String(Math.round(plan.duration * 1000) / 1000) : '0')
    .replaceAll('{date}', '20260614');
  const echo = resolvedCommand.match(/^echo\s+(.+)$/i);
  const stdout = echo ? `${echo[1].replace(/^"|"$/g, '')}\n` : '';
  return {
    command,
    resolvedCommand,
    program: resolvedCommand.split(/\s+/)[0] ?? '',
    args: resolvedCommand.split(/\s+/).slice(1),
    stdout,
    stderr: '',
    exitCode: 0,
    success: true
  };
}

function buildMockGifArgs(request: GifPreviewRequest | GifExportRequest, outputPath: string, scaleWidth: number, loopCount: number): string[] {
  return [
    '-y',
    '-hide_banner',
    '-ss',
    String(request.startTime),
    '-t',
    String(request.duration),
    '-i',
    request.sourcePath,
    '-filter_complex',
    `[0:v]fps=${request.frameRate},scale=w='min(${scaleWidth},iw)':h=-2:flags=lanczos,split[gifsrc][gifpal];[gifpal]palettegen=stats_mode=diff[gifpalette];[gifsrc][gifpalette]paletteuse=dither=${request.dither}:diff_mode=rectangle[gifout]`,
    '-map',
    '[gifout]',
    '-an',
    '-loop',
    String(loopCount),
    '-f',
    'gif',
    outputPath
  ];
}

function fileStem(path: string): string {
  return path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? 'media';
}

function solidColorSample([r, g, b]: [number, number, number]) {
  const width = 8;
  const height = 8;
  const data = Array.from({ length: width * height }, () => [r, g, b, 255]).flat();
  return { width, height, data };
}

function makeWarmContrastCube(): string {
  return [
    'TITLE "Warm Contrast"',
    'LUT_3D_SIZE 2',
    '0 0 0',
    '1 0.08 0',
    '0.05 1 0',
    '1 1 0.04',
    '0.05 0 1',
    '1 0.08 1',
    '0.05 1 1',
    '1 1 1'
  ].join('\n');
}

function makeDevPluginManifest(): string {
  return JSON.stringify(
    {
      id: 'e2e.dev-reload',
      name: 'E2E Dev Reload',
      version: '1.0.0',
      description: 'Reloads automatically when its local files change.',
      main: 'index.js',
      dev: true,
      permissions: ['export-hook']
    },
    null,
    2
  );
}

function makeDevPluginEntry(version: string): string {
  return [
    'module.exports = {',
    '  hooks: {',
    '    onExportBefore() {',
    `      return { devReloadVersion: "${version}" };`,
    '    }',
    '  }',
    '};'
  ].join('\n');
}

function persistFiles(): void {
  localStorage.setItem(PERSISTED_FILES_KEY, JSON.stringify(Array.from(files.entries())));
  localStorage.setItem(PERSISTED_MTIMES_KEY, JSON.stringify(Array.from(mtimes.entries())));
  localStorage.setItem(PERSISTED_WEBDAV_TEXT_KEY, JSON.stringify(Array.from(webdavTextFiles.entries())));
}

function restorePersistedFiles(): void {
  try {
    const rawFiles = localStorage.getItem(PERSISTED_FILES_KEY);
    const rawMtimes = localStorage.getItem(PERSISTED_MTIMES_KEY);
    const rawWebdavText = localStorage.getItem(PERSISTED_WEBDAV_TEXT_KEY);
    const fileEntries = rawFiles ? (JSON.parse(rawFiles) as Array<[string, string]>) : [];
    const mtimeEntries = rawMtimes ? (JSON.parse(rawMtimes) as Array<[string, number]>) : [];
    const webdavTextEntries = rawWebdavText ? (JSON.parse(rawWebdavText) as Array<[string, string]>) : [];
    for (const [path, contents] of fileEntries) {
      files.set(path, contents);
      exists.set(path, true);
    }
    for (const [path, mtime] of mtimeEntries) {
      mtimes.set(path, mtime);
    }
    for (const [url, contents] of webdavTextEntries) {
      webdavTextFiles.set(url, contents);
    }
  } catch {
    localStorage.removeItem(PERSISTED_FILES_KEY);
    localStorage.removeItem(PERSISTED_MTIMES_KEY);
    localStorage.removeItem(PERSISTED_WEBDAV_TEXT_KEY);
  }
}

function ensureTutorialSkippedByDefault(persist: boolean): void {
  if (exists.get(settingsPath) !== true) {
    writeTutorialProgressSettings({ tutorialStep: 0, tutorialSkipped: true, tutorialCompleted: false }, persist);
  }
}

function writeTutorialProgressSettings(
  progress: { tutorialStep: number; tutorialSkipped: boolean; tutorialCompleted: boolean },
  persist: boolean
): void {
  const current = parseMockJsonFile(settingsPath);
  const next = {
    ...current,
    tutorialStep: Math.min(8, Math.max(0, Math.round(progress.tutorialStep))),
    tutorialSkipped: progress.tutorialSkipped,
    tutorialCompleted: progress.tutorialCompleted
  };
  files.set(settingsPath, JSON.stringify(next, null, 2));
  exists.set(settingsPath, true);
  mtimes.set(settingsPath, Date.now());
  if (persist) {
    persistFiles();
  }
}

function parseMockJsonFile(path: string): Record<string, unknown> {
  try {
    const raw = files.get(path);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function makeProjectFile(path: string, missing: boolean): ProjectFileV2 {
  const media: MediaAsset[] = [
    {
      id: 'media-video',
      type: 'video',
      name: 'tiny-video.mp4',
      path,
      relativePath: missing ? null : '../Media/tiny-video.mp4',
      originalAbsolutePath: path,
      duration: 6,
      width: 1280,
      height: 720,
      missing,
      size: 4096,
      mtimeMs: 1000
    }
  ];
  return {
    schemaVersion: 2,
    project: {
      id: 'project-e2e',
      name: 'E2E Project',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      settings: { fps: 30, timecodeFormat: 'ndf', width: 1280, height: 720 },
      media,
      timeline: {
        tracks: [
          {
            id: 'track-video',
            type: 'video',
            name: 'Video 1',
            clips: [
              {
                id: 'clip-video',
                type: 'video',
                name: 'tiny-video.mp4',
                mediaId: 'media-video',
                trackId: 'track-video',
                start: 0,
                duration: 6,
                trimStart: 0,
                trimEnd: 0,
                speed: 1,
                colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
                transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
                volume: 1
              }
            ]
          },
          { id: 'track-audio', type: 'audio', name: 'Audio 1', clips: [] },
          { id: 'track-text', type: 'text', name: 'Text 1', clips: [] }
        ]
      }
    }
  };
}

function makeBatchMissingProjectFile(): ProjectFileV2 {
  const media: MediaAsset[] = [
    makeMissingAsset('media-video', 'video', 'tiny-video.mp4', 'C:/Missing/tiny-video.mp4', 6, 1280, 720),
    makeMissingAsset('media-audio', 'audio', 'tiny-audio.wav', 'C:/Missing/tiny-audio.wav', 6, 0, 0),
    makeMissingAsset('media-image', 'image', 'test-image.png', 'C:/Missing/test-image.png', 0, 1280, 720)
  ];
  return {
    schemaVersion: 2,
    project: {
      id: 'project-e2e-batch-missing',
      name: 'E2E Batch Missing Project',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      settings: { fps: 30, timecodeFormat: 'ndf', width: 1280, height: 720 },
      media,
      timeline: {
        tracks: [
          { id: 'track-video', type: 'video', name: 'Video 1', clips: [] },
          { id: 'track-audio', type: 'audio', name: 'Audio 1', clips: [] },
          { id: 'track-text', type: 'text', name: 'Text 1', clips: [] }
        ]
      }
    }
  };
}

function makeMissingAsset(
  id: string,
  type: MediaAsset['type'],
  name: string,
  path: string,
  duration: number,
  width: number,
  height: number
): MediaAsset {
  return {
    id,
    type,
    name,
    path,
    relativePath: null,
    originalAbsolutePath: path,
    duration,
    width,
    height,
    missing: true,
    size: 4096,
    mtimeMs: 1000,
  };
}

function setupMulticamAiCutFixtureInner() {
    const project = createProject('Multicam AI Cut E2E');
    const mcTimeline = {
      transitions: [],
      markers: [],
      tracks: [
        createTrack({ id: 'track-angle-a', type: 'video', name: 'Angle A', clips: [] }),
        createTrack({ id: 'track-angle-b', type: 'video', name: 'Angle B', clips: [] }),
        createTrack({ id: 'track-angle-c', type: 'video', name: 'Angle C', clips: [] }),
      ],
    };
    const timeline = {
      transitions: [],
      markers: [],
      tracks: [
        createTrack({ id: 'track-mc', type: 'video', name: 'Video 1', clips: [
          {
            id: 'clip-mc-nested',
            type: 'nested-sequence',
            name: 'Multicam Clip',
            trackId: 'track-mc',
            start: 0,
            duration: 10,
            trimStart: 0,
            trimEnd: 0,
            speed: 1,
            colorCorrection: { brightness: 0, contrast: 1, saturation: 1, hue: 0 },
            transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
            volume: 1,
            sequenceId: 'seq-mc-nested',
            multicam: {
              angles: [
                { id: 'angle-a', clipId: 'clip-angle-a', trackId: 'track-angle-a', name: 'Camera A', offset: 0 },
                { id: 'angle-b', clipId: 'clip-angle-b', trackId: 'track-angle-b', name: 'Camera B', offset: 0 },
                { id: 'angle-c', clipId: 'clip-angle-c', trackId: 'track-angle-c', name: 'Camera C', offset: 0 },
              ],
              switches: [
                { id: 'sw-init', time: 0, angleId: 'angle-a' },
              ],
              aiCutSuggestions: [
                { time: 2, angleId: 'angle-b', confidence: 0.92, reason: 'active speaker' },
                { time: 4.5, angleId: 'angle-c', confidence: 0.85, reason: 'wide shot' },
                { time: 7, angleId: 'angle-a', confidence: 0.78, reason: 'close-up' },
              ],
            },
          } as any,
        ]}),
      ],
    };
    useEditorStore.getState().setProject({
      ...project, media: [], timeline,
      sequences: [
        { id: PRIMARY_SEQUENCE_ID, name: DEFAULT_PRIMARY_SEQUENCE_NAME, timeline },
        { id: 'seq-mc-nested', name: 'Multicam Nested', timeline: mcTimeline },
      ],
      activeSequenceId: PRIMARY_SEQUENCE_ID,
    });
    useEditorStore.getState().setSelectedClipIds(['clip-mc-nested']);
    useEditorStore.getState().setSelectedClipId('clip-mc-nested');
    useEditorStore.getState().setPlayheadTime(0);
    commandManager.clear();
}
