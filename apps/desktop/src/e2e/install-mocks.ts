import {
  AddKeyframeCommand,
  DEFAULT_CLIP_SPEED,
  DEFAULT_COLOR_CORRECTION,
  DEFAULT_TRANSFORM,
  DEFAULT_PRIMARY_SEQUENCE_NAME,
  PRIMARY_SEQUENCE_ID,
  createProject,
  createTrack,
  type FfmpegExportPlan,
  type KeyframeProperty,
  type Clip,
  type MediaAsset,
  type ProjectFileV2
} from '@open-factory/editor-core';
import { commandManager, timelineAccessor } from '../store/commandManager';
import { useEditorStore } from '../store/editorStore';
import type { BatchTranscodeTaskResult, TauriMocks, WebdavProjectBackupRequest } from '../lib/tauri-bridge';
import { clearPluginHookLog, getPluginHookLog, refreshPluginRegistry } from '../plugins/plugin-manager';

const PERSISTED_FILES_KEY = 'open-factory:e2e-files';
const PERSISTED_MTIMES_KEY = 'open-factory:e2e-mtimes';
const files = new Map<string, string>();
const exists = new Map<string, boolean>();
const mtimes = new Map<string, number>();
const cache = new Map<string, string>();
const listeners = new Map<string, Set<(payload: unknown) => void>>();
let openFileDialogPaths: string[] = [];
let savePath = 'C:/Exports/open-factory-test.mp4';
let openDirectoryPath = 'C:/Relink';
let lastExportPlan: FfmpegExportPlan | undefined;
let exportRunCalls: Array<{ taskId?: string; fullArgs: string[]; duration: number }> = [];
const canceledExportTaskIds = new Set<string>();
const canceledTranscodeTaskIds = new Set<string>();
let exportGateHeld = false;
const exportGates: Array<{ taskId?: string; release: () => void }> = [];
let mockSceneTimes = [1];
let lastConfirmMessage: string | undefined;
let availableMemoryBytes = 8 * 1024 * 1024 * 1024;
let webdavPassword: string | undefined;
let lastWebdavPutRequest: WebdavProjectBackupRequest | undefined;
let minimizedToTray = false;
let lastTrayProgress: { progress: number; runningCount: number } | undefined;
let powerActionCalls: Array<{ action: 'shutdown' | 'hibernate'; allowPowerActions: boolean }> = [];

const sampleProjectPath = 'C:/Projects/sample.cutproj.json';
const missingProjectPath = 'C:/Projects/missing.cutproj.json';
const batchMissingProjectPath = 'C:/Projects/batch-missing.cutproj.json';
const tinyVideo = 'C:/Media/tiny-video.mp4';
const fourKHevcVideo = 'C:/Media/four-k-hevc.mov';
const tinyVideoB = 'C:/Media/camera-b.mp4';
const tinyAudio = 'C:/Media/tiny-audio.wav';
const tinyImage = 'C:/Media/test-image.png';
const duplicateVideoA = 'C:/Media/duplicate-a.mp4';
const duplicateVideoB = 'C:/Media/duplicate-b.mp4';
const pngFrame001 = 'C:/Media/frame001.png';
const pngFrame002 = 'C:/Media/frame002.png';
const pngFrame003 = 'C:/Media/frame003.png';
const tinySrt = 'C:/Media/tiny-subtitles.srt';
const silencePatternAudio = 'C:/Media/silence-pattern.wav';
const whisperExecutable = 'C:/Tools/whisper.exe';
const whisperModel = 'C:/Models/base.bin';
const relinkedVideo = 'C:/Relink/tiny-video.mp4';
const relinkedAudio = 'C:/Relink/tiny-audio.wav';
const relinkedImage = 'C:/Relink/test-image.png';
const appDataDir = 'C:/Users/E2E/AppData/Roaming/open-factory';
const settingsPath = `${appDataDir}/settings.json`;
const exportPresetsPath = `${appDataDir}/presets.json`;
const lutLibraryPath = `${appDataDir}/luts/Warm Contrast.cube`;
const lutFavoritesPath = `${appDataDir}/lut-favorites.json`;
const keybindingsPath = `${appDataDir}/keybindings.json`;
const macrosPath = `${appDataDir}/macros.json`;
const macroHistoryPath = `${appDataDir}/macro-history.json`;
const pluginDir = `${appDataDir}/plugins`;
const pluginPath = `${pluginDir}/export-count.js`;
const permissionDeniedPluginPath = `${pluginDir}/missing-permission.js`;
const brokenPluginPath = `${pluginDir}/broken.js`;

files.set(sampleProjectPath, JSON.stringify(makeProjectFile(tinyVideo, false), null, 2));
files.set(missingProjectPath, JSON.stringify(makeProjectFile('C:/Missing/tiny-video.mp4', true), null, 2));
files.set(batchMissingProjectPath, JSON.stringify(makeBatchMissingProjectFile(), null, 2));
files.set(
  tinySrt,
  ['1', '00:00:00,500 --> 00:00:02,000', 'Hello subtitle', '', '2', '00:00:02,500 --> 00:00:04,000', 'Second subtitle', ''].join('\n')
);
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
  fourKHevcVideo,
  tinyVideoB,
  tinyAudio,
  tinyImage,
  duplicateVideoA,
  duplicateVideoB,
  pngFrame001,
  pngFrame002,
  pngFrame003,
  tinySrt,
  silencePatternAudio,
  whisperExecutable,
  whisperModel,
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
  removeFile: (path) => {
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
  fsExists: (path) => exists.get(path) ?? !path.endsWith('.autosave'),
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
  getTempSegmentsDir: () => 'C:/Temp/open-factory/segments',
  getFileStat: (path) => ({
    path,
    size: path === silencePatternAudio ? createSilencePatternWav().byteLength : path === fourKHevcVideo ? 500 * 1024 * 1024 : path.endsWith('.wav') ? 2048 : 4096,
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
    hardwareEncoderAvailable: true,
    hardwareEncoder: 'h264_nvenc',
    drawtextWarning: null
  }),
  getAvailableMemoryBytes: () => availableMemoryBytes,
  runExport: async (plan, taskId) => {
    lastExportPlan = plan;
    exportRunCalls.push({ taskId, fullArgs: [...plan.fullArgs], duration: plan.duration });
    const cancelKey = exportCancelKey(taskId);
    canceledExportTaskIds.delete(cancelKey);
    emit('export-progress', taskId ? { taskId, progress: 0.2 } : 0.2);
    await waitForExportGate(taskId);
    if (canceledExportTaskIds.has(cancelKey)) {
      throw new Error('Export canceled.');
    }
    emit('export-progress', taskId ? { taskId, progress: 1 } : 1);
    const outputPath = plan.fullArgs.at(-1) ?? savePath;
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
    return {
      success: true,
      outputPath,
      durationMs: 20,
      warnings: plan.warnings,
      report: plan.passes?.some((pass) => pass.kind === 'loudness-analysis') ? { loudness: { integratedLoudness: -14.1 } } : undefined
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
  putWebdavProject: async (request) => {
    lastWebdavPutRequest = request;
    return { status: 201 };
  },
  readWebdavPassword: () => webdavPassword,
  writeWebdavPassword: (password) => {
    webdavPassword = password?.trim() ? password : undefined;
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
  cancelMotionTracking: () => undefined,
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
  probeMedia: (path) => ({
    hasAudio: path.endsWith('.mp4') || path.endsWith('.wav'),
    audioChannels: path.endsWith('.mp4') || path.endsWith('.wav') ? 2 : undefined,
    audioSampleRate: path.endsWith('.mp4') || path.endsWith('.wav') ? 44_100 : undefined,
    audioCodec: path.endsWith('.mp4') ? 'aac' : path.endsWith('.wav') ? 'pcm_s16le' : undefined,
    videoCodec: path === fourKHevcVideo ? 'hevc' : path.endsWith('.mp4') || path.endsWith('.mov') ? 'h264' : undefined
  }),
  generateProxy: async (plan) => {
    await wait(10);
    files.set(plan.outputPath, 'mock proxy');
    exists.set(plan.outputPath, true);
    cache.set(plan.outputPath.replace(`${appDataDir}/`, ''), JSON.stringify({ proxyPath: plan.outputPath }));
    return { assetId: plan.assetId, proxyPath: plan.outputPath, durationMs: 10 };
  },
  detectSceneChanges: () => ({ sceneTimes: mockSceneTimes }),
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
  }
};

window.__TAURI_MOCKS__ = mocks;
const silencePatternWav = createSilencePatternWav();
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
  if (url === silencePatternAudio) {
    return Promise.resolve(new Response(silencePatternWav.buffer.slice(0) as ArrayBuffer, { headers: { 'Content-Type': 'audio/wav' } }));
  }
  if (/^C:\/(Media|Relink)\//.test(url)) {
    const bytes = new Uint8Array(4096);
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = (index * 17) % 255;
    }
    return Promise.resolve(new Response(bytes));
  }
  return realFetch(input as RequestInfo | URL, init);
};
window.__E2E_ACTIONS__ = {
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
  setupWhisperFixture: () => {
    const project = createProject('Whisper E2E');
    const asset: MediaAsset = {
      id: 'media-whisper-video',
      type: 'video',
      name: 'whisper-video.mp4',
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
  getTimelineSnapshot: () => useEditorStore.getState().project.timeline,
  getPlayheadTime: () => useEditorStore.getState().playheadTime,
  getSelectedClipIds: () => useEditorStore.getState().selectedClipIds,
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
  getWrittenFile: (path: unknown) => (typeof path === 'string' ? files.get(path) : undefined),
  getWrittenFileSize: (path: unknown) => (typeof path === 'string' ? files.get(path)?.length ?? 0 : 0),
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
  getLastTrayProgress: () => lastTrayProgress,
  wasMinimizedToTray: () => minimizedToTray,
  getPowerActionCalls: () => powerActionCalls,
  getLastWebdavPutRequest: () => lastWebdavPutRequest,
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
  clearE2eFiles: () => {
    localStorage.removeItem(PERSISTED_FILES_KEY);
    localStorage.removeItem(PERSISTED_MTIMES_KEY);
    for (const path of Array.from(files.keys()).filter((item) => item.endsWith('.autosave'))) {
      files.delete(path);
      exists.set(path, false);
      mtimes.delete(path);
    }
    for (const path of Array.from(files.keys()).filter((item) => item.includes('/snapshots/'))) {
      files.delete(path);
      exists.set(path, false);
      mtimes.delete(path);
    }
    files.delete(exportPresetsPath);
    exists.set(exportPresetsPath, false);
    mtimes.delete(exportPresetsPath);
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
    for (const path of Array.from(files.keys()).filter((item) => item.includes('/Backups/') || item.startsWith('C:/Backups/'))) {
      files.delete(path);
      exists.set(path, false);
      mtimes.delete(path);
    }
    webdavPassword = undefined;
    lastWebdavPutRequest = undefined;
    lastExportPlan = undefined;
    exportRunCalls = [];
    minimizedToTray = false;
    lastTrayProgress = undefined;
    powerActionCalls = [];
    localStorage.removeItem('open-factory:proxy-settings');
    localStorage.removeItem('open-factory:plugins');
    localStorage.removeItem('open-factory:settings');
  },
  clearExportPresets: () => {
    files.delete(exportPresetsPath);
    exists.set(exportPresetsPath, false);
    mtimes.delete(exportPresetsPath);
    persistFiles();
  },
  refreshPluginRegistry: () => refreshPluginRegistry(),
  getPluginHookLog: () => getPluginHookLog(),
  clearPluginHookLog: () => clearPluginHookLog()
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

function createSilencePatternWav(): Uint8Array {
  const sampleRate = 44_100;
  const duration = 2.5;
  const totalSamples = Math.floor(sampleRate * duration);
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
  for (let index = 0; index < totalSamples; index += 1) {
    const time = index / sampleRate;
    const amplitude = time >= 1 && time < 1.5 ? 0 : Math.sin(2 * Math.PI * 440 * time) * 0.5;
    view.setInt16(44 + index * 2, Math.round(amplitude * 32767), true);
  }
  return bytes;
}

function writeAscii(bytes: Uint8Array, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    bytes[offset + index] = value.charCodeAt(index);
  }
}

function isKeyframeProperty(value: unknown): value is KeyframeProperty {
  return value === 'x' || value === 'y' || value === 'scaleX' || value === 'scaleY' || value === 'opacity' || value === 'volume' || value === 'speed';
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

function persistFiles(): void {
  localStorage.setItem(PERSISTED_FILES_KEY, JSON.stringify(Array.from(files.entries())));
  localStorage.setItem(PERSISTED_MTIMES_KEY, JSON.stringify(Array.from(mtimes.entries())));
}

function restorePersistedFiles(): void {
  try {
    const rawFiles = localStorage.getItem(PERSISTED_FILES_KEY);
    const rawMtimes = localStorage.getItem(PERSISTED_MTIMES_KEY);
    const fileEntries = rawFiles ? (JSON.parse(rawFiles) as Array<[string, string]>) : [];
    const mtimeEntries = rawMtimes ? (JSON.parse(rawMtimes) as Array<[string, number]>) : [];
    for (const [path, contents] of fileEntries) {
      files.set(path, contents);
      exists.set(path, true);
    }
    for (const [path, mtime] of mtimeEntries) {
      mtimes.set(path, mtime);
    }
  } catch {
    localStorage.removeItem(PERSISTED_FILES_KEY);
    localStorage.removeItem(PERSISTED_MTIMES_KEY);
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
    mtimeMs: 1000
  };
}
