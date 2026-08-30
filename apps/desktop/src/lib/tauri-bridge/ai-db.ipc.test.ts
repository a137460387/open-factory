// @vitest-environment jsdom
// 源文件：apps/desktop/src/lib/tauri-bridge/ai-db.ts（272 可执行行，五期前覆盖 1.10%）
// 覆盖目标：≥75%。模式：与 export/media 同构——mockIPC 数据驱动断言 command 名与参数，
// 辅以 __TAURI_MOCKS__ 路径与浏览器回退（默认值 / no-op / 抛错）。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockIPC, clearMocks } from '@tauri-apps/api/mocks';

import {
  callAiApi,
  extractAiFrames,
  testAiConnection,
  readAiApiKey,
  writeAiApiKey,
  checkOllamaReachable,
  listOllamaModels,
  callTtsApi,
  writeVideoSummary,
  initMediaIndexDb,
  upsertMediaAsset,
  batchUpsertMediaAssets,
  deleteMediaAsset,
  searchMediaAssets,
  autoTagAsset,
  batchAutoTagAssets,
  getAllTags,
  addManualTag,
  removeManualTag,
  getHwDecodeCapabilities,
  initHardwareDecoder,
  decodeVideoFrame,
  decodeVideoFrames,
  getDecoderVideoInfo,
  getHwDecodeSettings,
  setHwDecodeSettings,
  releaseDecoder,
} from './ai-db';

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

interface BridgeCase {
  name: string;
  run: () => Promise<unknown>;
  cmd: string;
  args: Record<string, unknown>;
  mockName: string;
  /** 浏览器回退断言：resolve 值或 reject 消息片段。 */
  browser: { resolve?: unknown; reject?: string };
}

const cases: BridgeCase[] = [
  {
    name: 'callAiApi',
    run: () => callAiApi({ providerId: 'openai', baseUrl: 'http://x', model: 'gpt', messages: [] }, 'key'),
    cmd: 'call_ai_api',
    args: { request: { providerId: 'openai', baseUrl: 'http://x', model: 'gpt', messages: [] }, apiKey: 'key' },
    mockName: 'callAiApi',
    browser: {},
  },
  {
    name: 'extractAiFrames',
    run: () => extractAiFrames({ sourcePath: '/a.mp4', times: [1] }),
    cmd: 'extract_ai_frames',
    args: { request: { sourcePath: '/a.mp4', times: [1] } },
    mockName: 'extractAiFrames',
    browser: {},
  },
  {
    name: 'testAiConnection',
    run: () => testAiConnection('http://x', 'key', 'ollama'),
    cmd: 'test_ai_connection',
    args: { baseUrl: 'http://x', apiKey: 'key', providerId: 'ollama' },
    mockName: 'testAiConnection',
    browser: {},
  },
  {
    name: 'readAiApiKey',
    run: () => readAiApiKey('openai'),
    cmd: 'read_ai_api_key',
    args: { providerId: 'openai' },
    mockName: 'readAiApiKey',
    browser: { resolve: undefined },
  },
  {
    name: 'writeAiApiKey',
    run: () => writeAiApiKey('openai', 'key'),
    cmd: 'write_ai_api_key',
    args: { providerId: 'openai', key: 'key' },
    mockName: 'writeAiApiKey',
    browser: { reject: 'Tauri runtime' },
  },
  {
    name: 'checkOllamaReachable',
    run: () => checkOllamaReachable(),
    cmd: 'check_ollama_reachable',
    args: {},
    mockName: 'checkOllamaReachable',
    browser: {},
  },
  {
    name: 'listOllamaModels',
    run: () => listOllamaModels(),
    cmd: 'list_ollama_models',
    args: {},
    mockName: 'listOllamaModels',
    browser: {},
  },
  {
    name: 'callTtsApi',
    run: () => callTtsApi({ baseUrl: 'http://x', voiceId: 'v', text: 'hi', speed: 1 }, 'key'),
    cmd: 'call_tts_api',
    args: { request: { baseUrl: 'http://x', voiceId: 'v', text: 'hi', speed: 1 }, apiKey: 'key' },
    mockName: 'callTtsApi',
    browser: {},
  },
  {
    name: 'writeVideoSummary',
    run: () => writeVideoSummary('/sum.html', '<html/>'),
    cmd: 'write_video_summary',
    args: { path: '/sum.html', html: '<html/>' },
    mockName: 'writeVideoSummary',
    browser: {},
  },
  {
    name: 'initMediaIndexDb',
    run: () => initMediaIndexDb('/proj'),
    cmd: 'init_media_index_db',
    args: { projectPath: '/proj' },
    mockName: 'initMediaIndexDb',
    browser: { resolve: undefined },
  },
  {
    name: 'upsertMediaAsset',
    run: () =>
      upsertMediaAsset('/proj', {
        id: 'a1',
        path: '/a.mp4',
        name: 'a',
        assetType: 'video',
        importedAt: 'now',
      } as never),
    cmd: 'upsert_media_asset',
    args: {
      projectPath: '/proj',
      asset: { id: 'a1', path: '/a.mp4', name: 'a', assetType: 'video', importedAt: 'now' },
    },
    mockName: 'upsertMediaAsset',
    browser: { resolve: undefined },
  },
  {
    name: 'batchUpsertMediaAssets',
    run: () => batchUpsertMediaAssets('/proj', []),
    cmd: 'batch_upsert_media_assets',
    args: { projectPath: '/proj', assets: [] },
    mockName: 'batchUpsertMediaAssets',
    browser: { resolve: 0 },
  },
  {
    name: 'deleteMediaAsset',
    run: () => deleteMediaAsset('/proj', 'a1'),
    cmd: 'delete_media_asset',
    args: { projectPath: '/proj', id: 'a1' },
    mockName: 'deleteMediaAsset',
    browser: { resolve: undefined },
  },
  {
    name: 'searchMediaAssets',
    run: () => searchMediaAssets({ projectPath: '/proj' }),
    cmd: 'search_media_assets',
    args: { query: { projectPath: '/proj' } },
    mockName: 'searchMediaAssets',
    browser: { resolve: { assets: [], total: 0, page: 1, pageSize: 50 } },
  },
  {
    name: 'autoTagAsset',
    run: () => autoTagAsset({ projectPath: '/proj', assetId: 'a1', name: 'a', assetType: 'video' } as never),
    cmd: 'auto_tag_asset',
    args: { request: { projectPath: '/proj', assetId: 'a1', name: 'a', assetType: 'video' } },
    mockName: 'autoTagAsset',
    browser: { resolve: { tags: [] } },
  },
  {
    name: 'batchAutoTagAssets',
    run: () =>
      batchAutoTagAssets('/proj', [{ projectPath: '/proj', assetId: 'a1', name: 'a', assetType: 'video' } as never]),
    cmd: 'batch_auto_tag_assets',
    args: { projectPath: '/proj', requests: [{ projectPath: '/proj', assetId: 'a1', name: 'a', assetType: 'video' }] },
    mockName: 'batchAutoTagAssets',
    browser: { resolve: [{ tags: [] }] },
  },
  {
    name: 'getAllTags',
    run: () => getAllTags('/proj'),
    cmd: 'get_all_tags',
    args: { projectPath: '/proj' },
    mockName: 'getAllTags',
    browser: { resolve: [] },
  },
  {
    name: 'addManualTag',
    run: () => addManualTag('/proj', 'a1', 'hero'),
    cmd: 'add_manual_tag',
    args: { projectPath: '/proj', assetId: 'a1', tagName: 'hero' },
    mockName: 'addManualTag',
    browser: { resolve: undefined },
  },
  {
    name: 'removeManualTag',
    run: () => removeManualTag('/proj', 'a1', 'hero'),
    cmd: 'remove_manual_tag',
    args: { projectPath: '/proj', assetId: 'a1', tagName: 'hero' },
    mockName: 'removeManualTag',
    browser: { resolve: undefined },
  },
  {
    name: 'getHwDecodeCapabilities',
    run: () => getHwDecodeCapabilities(),
    cmd: 'get_hw_decode_capabilities',
    args: {},
    mockName: 'getHwDecodeCapabilities',
    browser: { resolve: { availableBackends: [], recommendedBackend: 'Software', supportedCodecs: [] } },
  },
  {
    name: 'initHardwareDecoder',
    run: () => initHardwareDecoder({ path: '/a.mp4' }),
    cmd: 'init_hardware_decoder',
    args: { config: { path: '/a.mp4' } },
    mockName: 'initHardwareDecoder',
    browser: { reject: 'Tauri 运行时' },
  },
  {
    name: 'decodeVideoFrame',
    run: () => decodeVideoFrame({ 0: 1 } as never, 1.5),
    cmd: 'decode_video_frame',
    args: { handle: { 0: 1 }, timestamp: 1.5 },
    mockName: 'decodeVideoFrame',
    browser: { reject: 'Tauri 运行时' },
  },
  {
    name: 'decodeVideoFrames',
    run: () => decodeVideoFrames({ 0: 1 } as never, [1, 2]),
    cmd: 'decode_video_frames',
    args: { handle: { 0: 1 }, timestamps: [1, 2] },
    mockName: 'decodeVideoFrames',
    browser: { reject: 'Tauri 运行时' },
  },
  {
    name: 'getDecoderVideoInfo',
    run: () => getDecoderVideoInfo({ 0: 1 } as never),
    cmd: 'get_decoder_video_info',
    args: { handle: { 0: 1 } },
    mockName: 'getDecoderVideoInfo',
    browser: { reject: 'Tauri 运行时' },
  },
  {
    name: 'getHwDecodeSettings',
    run: () => getHwDecodeSettings(),
    cmd: 'get_hw_decode_settings',
    args: {},
    mockName: 'getHwDecodeSettings',
    browser: {
      resolve: {
        mode: 'auto',
        preferredBackend: 'Auto',
        enableFrameCache: true,
        frameCacheSize: 30,
        enablePreDecode: true,
        preDecodeFrameCount: 5,
      },
    },
  },
  {
    name: 'setHwDecodeSettings',
    run: () =>
      setHwDecodeSettings({
        mode: 'auto',
        preferredBackend: 'Auto',
        enableFrameCache: false,
        frameCacheSize: 10,
        enablePreDecode: false,
        preDecodeFrameCount: 2,
      } as never),
    cmd: 'set_hw_decode_settings',
    args: {
      settings: {
        mode: 'auto',
        preferredBackend: 'Auto',
        enableFrameCache: false,
        frameCacheSize: 10,
        enablePreDecode: false,
        preDecodeFrameCount: 2,
      },
    },
    mockName: 'setHwDecodeSettings',
    browser: { resolve: undefined },
  },
  {
    name: 'releaseDecoder',
    run: () => releaseDecoder({ 0: 1 } as never),
    cmd: 'release_decoder',
    args: { handle: { 0: 1 } },
    mockName: 'releaseDecoder',
    browser: { resolve: undefined },
  },
];

describe('ai-db bridge：Tauri invoke 路径（数据驱动）', () => {
  it.each(cases)('$name → $cmd', async ({ run, cmd, args }) => {
    const handler = vi.fn(async () => 'ok');
    mockIPC(handler);
    await run();
    expect(handler).toHaveBeenCalledWith(cmd, args);
  });

  it('返回值原样透传（checkOllamaReachable/listOllamaModels）', async () => {
    mockIPC(async (cmd: string) => {
      if (cmd === 'check_ollama_reachable') return true;
      if (cmd === 'list_ollama_models') return { reachable: true, models: [{ name: 'llama3', size: 4096 }] };
      return undefined;
    });
    await expect(checkOllamaReachable()).resolves.toBe(true);
    await expect(listOllamaModels()).resolves.toEqual({ reachable: true, models: [{ name: 'llama3', size: 4096 }] });
  });

  it('invoke 抛错时错误向上传播（callAiApi）', async () => {
    mockIPC(async () => {
      throw new Error('ai provider down');
    });
    await expect(callAiApi({ providerId: 'x', baseUrl: '', model: '', messages: [] })).rejects.toThrow(
      'ai provider down',
    );
  });
});

describe('ai-db bridge：__TAURI_MOCKS__ 路径（数据驱动）', () => {
  it.each(cases)('$name → mock 短路', async ({ run, mockName }) => {
    const mock = vi.fn(async () => 'ok');
    (window as WindowWithTauri).__TAURI_MOCKS__ = { [mockName]: mock };
    await run();
    expect(mock).toHaveBeenCalledTimes(1);
  });
});

describe('ai-db bridge：浏览器回退路径（数据驱动）', () => {
  it.each(cases.filter((c) => c.browser.resolve !== undefined || c.browser.reject !== undefined))(
    '$name → 浏览器回退',
    async ({ name, run, browser }) => {
      if (browser.reject !== undefined) {
        await expect(run()).rejects.toThrow(browser.reject);
      } else {
        await expect(run()).resolves.toEqual(browser.resolve);
      }
      // 占位引用避免 lint 未使用
      expect(name).toBeTruthy();
    },
  );
});
