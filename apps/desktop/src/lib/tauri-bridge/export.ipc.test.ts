// @vitest-environment jsdom
// 源文件：apps/desktop/src/lib/tauri-bridge/export.ts（299 可执行行，五期前覆盖 7.69%）
// 覆盖目标：≥75%。模式：mockIPC 拦截 invoke 断言 command 名与参数（数据驱动覆盖全部导出），
// 辅以 __TAURI_MOCKS__ 路径与浏览器回退分支。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockIPC, clearMocks } from '@tauri-apps/api/mocks';

import {
  runExport,
  runExportPreviewSamples,
  createSharePackageZip,
  createSharedLibraryArchive,
  importSharedLibraryArchive,
  putWebdavProject,
  putWebdavExportFile,
  getWebdavText,
  putWebdavText,
  readWebdavPassword,
  writeWebdavPassword,
  readExportUploadWebdavPassword,
  writeExportUploadWebdavPassword,
  readExportPresetSyncWebdavPassword,
  writeExportPresetSyncWebdavPassword,
  readTranslationApiKey,
  writeTranslationApiKey,
  readSmtpPassword,
  writeSmtpPassword,
  sendSmtpEmail,
  postWebhookJson,
  analyzeClip,
  analyzeMotionTrack,
  evaluateExportQuality,
  runPostExportQualityAssurance,
  exportMediaGif,
  generateGifPreview,
  cancelExport,
  cancelMotionTracking,
  cancelQualityEvaluation,
  batchTranscodeMedia,
  cancelBatchTranscodeTask,
  renderPreviewCache,
  getCacheDir,
  readCache,
  writeCache,
  removeCacheFile,
  clearCache,
  getCacheSize,
} from './export';

type WindowWithTauri = Window & {
  __TAURI_INTERNALS__?: Record<string, unknown>;
  __TAURI_MOCKS__?: Record<string, unknown>;
};

function resetBrowserEnv() {
  delete (window as WindowWithTauri).__TAURI_INTERNALS__;
  delete (window as WindowWithTauri).__TAURI_MOCKS__;
}

beforeEach(() => {
  resetBrowserEnv();
});

afterEach(() => {
  clearMocks();
  resetBrowserEnv();
});

/** 数据驱动：每个条目 = [调用函数, 期望 command, invoke 参数, __TAURI_MOCKS__ 键名]。 */
const invokeCases: Array<{
  name: string;
  run: () => Promise<unknown>;
  cmd: string;
  args: Record<string, unknown>;
  mockName?: string;
}> = [
  { name: 'runExport(带 taskId)', run: () => runExport({ fullArgs: [] } as never, 'task-1'), cmd: 'run_export', args: { plan: { fullArgs: [] }, taskId: 'task-1' }, mockName: 'runExport' },
  { name: 'runExport(无 taskId 省略键)', run: () => runExport({ fullArgs: [] } as never), cmd: 'run_export', args: { plan: { fullArgs: [] } } },
  { name: 'runExportPreviewSamples', run: () => runExportPreviewSamples({ samples: [] } as never), cmd: 'run_export_preview_samples', args: { request: { samples: [] } } },
  { name: 'createSharePackageZip', run: () => createSharePackageZip({ projectPath: '/p' } as never), cmd: 'create_share_package', args: { request: { projectPath: '/p' } } },
  { name: 'createSharedLibraryArchive', run: () => createSharedLibraryArchive({} as never), cmd: 'create_shared_library_archive', args: { request: {} } },
  { name: 'importSharedLibraryArchive', run: () => importSharedLibraryArchive({} as never), cmd: 'import_shared_library_archive', args: { request: {} } },
  { name: 'putWebdavProject', run: () => putWebdavProject({ url: 'http://dav' } as never), cmd: 'put_webdav_project', args: { request: { url: 'http://dav' } } },
  { name: 'putWebdavExportFile', run: () => putWebdavExportFile({ url: 'http://dav' } as never), cmd: 'put_webdav_export_file', args: { request: { url: 'http://dav' } } },
  { name: 'getWebdavText', run: () => getWebdavText({ url: 'http://dav' } as never), cmd: 'get_webdav_text', args: { request: { url: 'http://dav' } } },
  { name: 'putWebdavText', run: () => putWebdavText({ url: 'http://dav' } as never), cmd: 'put_webdav_text', args: { request: { url: 'http://dav' } } },
  { name: 'readWebdavPassword', run: () => readWebdavPassword(), cmd: 'read_webdav_password', args: {} },
  { name: 'writeWebdavPassword', run: () => writeWebdavPassword('secret'), cmd: 'write_webdav_password', args: { password: 'secret' } },
  { name: 'readExportUploadWebdavPassword', run: () => readExportUploadWebdavPassword(), cmd: 'read_export_upload_webdav_password', args: {} },
  { name: 'writeExportUploadWebdavPassword', run: () => writeExportUploadWebdavPassword('secret'), cmd: 'write_export_upload_webdav_password', args: { password: 'secret' } },
  { name: 'readExportPresetSyncWebdavPassword', run: () => readExportPresetSyncWebdavPassword(), cmd: 'read_export_preset_sync_webdav_password', args: {} },
  { name: 'writeExportPresetSyncWebdavPassword', run: () => writeExportPresetSyncWebdavPassword('secret'), cmd: 'write_export_preset_sync_webdav_password', args: { password: 'secret' } },
  { name: 'readTranslationApiKey', run: () => readTranslationApiKey('deepl'), cmd: 'read_translation_api_key', args: { provider: 'deepl' } },
  { name: 'writeTranslationApiKey', run: () => writeTranslationApiKey('deepl', 'key-1'), cmd: 'write_translation_api_key', args: { provider: 'deepl', key: 'key-1' } },
  { name: 'readSmtpPassword', run: () => readSmtpPassword('default'), cmd: 'read_smtp_password', args: { profile: 'default' } },
  { name: 'writeSmtpPassword', run: () => writeSmtpPassword('default', 'pw'), cmd: 'write_smtp_password', args: { profile: 'default', password: 'pw' } },
  { name: 'sendSmtpEmail', run: () => sendSmtpEmail({ to: ['a@b.c'] } as never), cmd: 'send_smtp_email', args: { request: { to: ['a@b.c'] } } },
  { name: 'postWebhookJson', run: () => postWebhookJson({ url: 'http://hook' } as never), cmd: 'post_webhook_json', args: { request: { url: 'http://hook' } } },
  { name: 'analyzeClip', run: () => analyzeClip({ clipId: 'c1' } as never), cmd: 'analyze_clip', args: { request: { clipId: 'c1' } } },
  { name: 'analyzeMotionTrack', run: () => analyzeMotionTrack({ clipId: 'c1' } as never), cmd: 'analyze_motion_track', args: { request: { clipId: 'c1' } } },
  { name: 'evaluateExportQuality', run: () => evaluateExportQuality({ taskId: 'q1' } as never), cmd: 'evaluate_export_quality', args: { request: { taskId: 'q1' } } },
  { name: 'runPostExportQualityAssurance', run: () => runPostExportQualityAssurance({ taskId: 'qa1' } as never), cmd: 'run_post_export_quality_assurance', args: { request: { taskId: 'qa1' } } },
  { name: 'exportMediaGif', run: () => exportMediaGif({ clipId: 'c1' } as never), cmd: 'export_media_gif', args: { request: { clipId: 'c1' } } },
  { name: 'generateGifPreview', run: () => generateGifPreview({ clipId: 'c1' } as never), cmd: 'generate_gif_preview', args: { request: { clipId: 'c1' } } },
  { name: 'cancelExport', run: () => cancelExport('task-1'), cmd: 'cancel_export', args: { taskId: 'task-1' } },
  { name: 'cancelMotionTracking', run: () => cancelMotionTracking('clip-1'), cmd: 'cancel_motion_tracking', args: { clipId: 'clip-1' } },
  { name: 'cancelQualityEvaluation', run: () => cancelQualityEvaluation('task-1'), cmd: 'cancel_quality_evaluation', args: { taskId: 'task-1' } },
  { name: 'batchTranscodeMedia', run: () => batchTranscodeMedia({ tasks: [] } as never), cmd: 'batch_transcode_media', args: { request: { tasks: [] } } },
  { name: 'cancelBatchTranscodeTask', run: () => cancelBatchTranscodeTask('task-1'), cmd: 'cancel_batch_transcode_task', args: { taskId: 'task-1' } },
  { name: 'getCacheDir', run: () => getCacheDir(), cmd: 'get_cache_dir', args: {} },
  { name: 'readCache', run: () => readCache('thumb/abc'), cmd: 'read_cache', args: { path: 'thumb/abc' } },
  { name: 'writeCache', run: () => writeCache('thumb/abc', 'data'), cmd: 'write_cache', args: { path: 'thumb/abc', contents: 'data' } },
  { name: 'removeCacheFile', run: () => removeCacheFile('thumb/abc'), cmd: 'remove_cache_file', args: { path: 'thumb/abc' } },
  { name: 'clearCache', run: () => clearCache(), cmd: 'clear_cache', args: {} },
  { name: 'getCacheSize', run: () => getCacheSize(), cmd: 'get_cache_size', args: {} },
];

describe('export bridge：Tauri invoke 路径（数据驱动）', () => {
  it.each(invokeCases)('$name → $cmd', async ({ run, cmd, args }) => {
    const handler = vi.fn(async () => 'ok');
    mockIPC(handler);
    await run();
    expect(handler).toHaveBeenCalledWith(cmd, args);
  });

  it('renderPreviewCache 透传请求结构', async () => {
    const handler = vi.fn(async () => ({ outputPath: '/out.png', durationMs: 5, success: true }));
    mockIPC(handler);
    const request = { projectId: 'p1', startSec: 0, endSec: 1, sourcePath: '/a.mp4', width: 64, height: 64 };
    await expect(renderPreviewCache(request)).resolves.toEqual({ outputPath: '/out.png', durationMs: 5, success: true });
    expect(handler).toHaveBeenCalledWith('render_preview_cache', { request });
  });

  it('返回值原样透传（getCacheSize / readCache / postWebhookJson）', async () => {
    mockIPC(async (cmd: string) => {
      if (cmd === 'get_cache_size') return 4096;
      if (cmd === 'read_cache') return null;
      if (cmd === 'post_webhook_json') return { status: 204 };
      return undefined;
    });
    await expect(getCacheSize()).resolves.toBe(4096);
    await expect(readCache('x')).resolves.toBeNull();
    await expect(postWebhookJson({ url: 'http://h' } as never)).resolves.toEqual({ status: 204 });
  });

  it('invoke 抛错时错误向上传播（runExport）', async () => {
    mockIPC(async () => {
      throw new Error('export failed');
    });
    await expect(runExport({ fullArgs: [] } as never)).rejects.toThrow('export failed');
  });
});

describe('export bridge：__TAURI_MOCKS__ 路径', () => {
  it('mock 存在时短路 invoke 并透传参数', async () => {
    const exportResult = { success: true, durationMs: 100, warnings: [], outputPath: '/out.mp4' };
    const runExportMock = vi.fn(async () => exportResult);
    const getCacheSizeMock = vi.fn(async () => 0);
    const cancelMock = vi.fn(async () => undefined);
    (window as WindowWithTauri).__TAURI_MOCKS__ = {
      runExport: runExportMock,
      getCacheSize: getCacheSizeMock,
      cancelExport: cancelMock,
    };
    await expect(runExport({ fullArgs: [] } as never)).resolves.toBe(exportResult);
    await expect(getCacheSize()).resolves.toBe(0);
    await cancelExport('task-1');
    expect(runExportMock).toHaveBeenCalledWith({ fullArgs: [] }, undefined);
    expect(cancelMock).toHaveBeenCalledWith('task-1');
  });

  // 数据驱动补全每个函数的 mock 分支（mock 键名与函数名不一致者单独标注）
  const mockNameByCase: Record<string, string> = {
    'runExport(无 taskId 省略键)': 'runExport',
    runExportPreviewSamples: 'runExportPreviewSamples',
    createSharePackageZip: 'createSharePackage',
    createSharedLibraryArchive: 'createSharedLibraryArchive',
    importSharedLibraryArchive: 'importSharedLibraryArchive',
    putWebdavProject: 'putWebdavProject',
    putWebdavExportFile: 'putWebdavExportFile',
    getWebdavText: 'getWebdavText',
    putWebdavText: 'putWebdavText',
    readWebdavPassword: 'readWebdavPassword',
    writeWebdavPassword: 'writeWebdavPassword',
    readExportUploadWebdavPassword: 'readExportUploadWebdavPassword',
    writeExportUploadWebdavPassword: 'writeExportUploadWebdavPassword',
    readExportPresetSyncWebdavPassword: 'readExportPresetSyncWebdavPassword',
    writeExportPresetSyncWebdavPassword: 'writeExportPresetSyncWebdavPassword',
    readTranslationApiKey: 'readTranslationApiKey',
    writeTranslationApiKey: 'writeTranslationApiKey',
    readSmtpPassword: 'readSmtpPassword',
    writeSmtpPassword: 'writeSmtpPassword',
    sendSmtpEmail: 'sendSmtpEmail',
    postWebhookJson: 'postWebhookJson',
    analyzeClip: 'analyzeClip',
    analyzeMotionTrack: 'analyzeMotionTrack',
    evaluateExportQuality: 'evaluateExportQuality',
    runPostExportQualityAssurance: 'runPostExportQualityAssurance',
    exportMediaGif: 'exportMediaGif',
    generateGifPreview: 'generateGifPreview',
    cancelExport: 'cancelExport',
    cancelMotionTracking: 'cancelMotionTracking',
    cancelQualityEvaluation: 'cancelQualityEvaluation',
    batchTranscodeMedia: 'batchTranscodeMedia',
    cancelBatchTranscodeTask: 'cancelBatchTranscodeTask',
    getCacheDir: 'getCacheDir',
    readCache: 'readCache',
    writeCache: 'writeCache',
    removeCacheFile: 'removeCacheFile',
    clearCache: 'clearCache',
    getCacheSize: 'getCacheSize',
  };

  it.each(
    invokeCases.filter((c) => mockNameByCase[c.name] ?? c.mockName),
  )('$name → mock 短路', async ({ name, run, mockName }) => {
    const mock = vi.fn(async () => 'ok');
    (window as WindowWithTauri).__TAURI_MOCKS__ = { [mockNameByCase[name] ?? mockName ?? '']: mock };
    await run();
    expect(mock).toHaveBeenCalledTimes(1);
  });
});

describe('export bridge：浏览器回退路径', () => {
  it('readTranslationApiKey 浏览器下返回 undefined', async () => {
    await expect(readTranslationApiKey('deepl')).resolves.toBeUndefined();
  });

  it('writeTranslationApiKey 浏览器下抛错（需要 Tauri runtime）', async () => {
    await expect(writeTranslationApiKey('deepl', 'key')).rejects.toThrow('Tauri runtime');
  });
});
