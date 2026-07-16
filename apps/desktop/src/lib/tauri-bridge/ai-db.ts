import { invoke } from '@tauri-apps/api/core';
import { getTauriMocks } from './mock-types';
import { isTauriRuntime } from '../tauri';

// ========== AI API ==========

interface CallAiApiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export interface CallAiApiRequest {
  providerId: string;
  baseUrl: string;
  model: string;
  messages: CallAiApiMessage[];
  customHeaders?: Record<string, string>;
  maxTokens?: number;
  temperature?: number;
  timeoutSecs?: number;
}

export interface CallAiApiResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

interface OllamaModel {
  name: string;
  size: number;
}

export interface OllamaModelsResult {
  reachable: boolean;
  models: OllamaModel[];
}

export interface CallTtsApiRequest {
  baseUrl: string;
  voiceId: string;
  text: string;
  speed: number;
  stability?: number;
  engine?: string;
  model?: string;
}

export interface CallTtsApiResult {
  audioBase64: string;
  latencyMs: number;
}

export async function callAiApi(request: CallAiApiRequest, apiKey?: string): Promise<CallAiApiResult> {
  const mock = getTauriMocks()?.callAiApi;
  if (mock) {
    return mock(request, apiKey);
  }
  return invoke<CallAiApiResult>('call_ai_api', { request, apiKey });
}

export interface ExtractAiFramesRequest {
  sourcePath: string;
  times: number[];
}

export interface ExtractAiFramesResult {
  frames: string[];
}

export async function extractAiFrames(request: ExtractAiFramesRequest): Promise<ExtractAiFramesResult> {
  const mock = getTauriMocks()?.extractAiFrames;
  if (mock) {
    return mock(request);
  }
  return invoke<ExtractAiFramesResult>('extract_ai_frames', { request });
}

export async function testAiConnection(baseUrl: string, apiKey?: string, providerId?: string): Promise<boolean> {
  const mock = getTauriMocks()?.testAiConnection;
  if (mock) {
    return mock(baseUrl, apiKey, providerId);
  }
  return invoke<boolean>('test_ai_connection', { baseUrl, apiKey, providerId: providerId ?? 'custom' });
}

export async function readAiApiKey(providerId: string): Promise<string | undefined> {
  const mock = getTauriMocks()?.readAiApiKey;
  if (mock) {
    return mock(providerId);
  }
  if (!isTauriRuntime()) {
    return undefined;
  }
  return invoke<string | undefined>('read_ai_api_key', { providerId });
}

export async function writeAiApiKey(providerId: string, apiKey?: string): Promise<void> {
  const mock = getTauriMocks()?.writeAiApiKey;
  if (mock) {
    await mock(providerId, apiKey);
    return;
  }
  if (!isTauriRuntime()) {
    throw new Error('AI API Key storage requires the Tauri runtime.');
  }
  await invoke('write_ai_api_key', { providerId, key: apiKey });
}

export async function checkOllamaReachable(): Promise<boolean> {
  const mock = getTauriMocks()?.checkOllamaReachable;
  if (mock) {
    return mock();
  }
  return invoke<boolean>('check_ollama_reachable');
}

export async function listOllamaModels(): Promise<OllamaModelsResult> {
  const mock = getTauriMocks()?.listOllamaModels;
  if (mock) {
    return mock();
  }
  return invoke<OllamaModelsResult>('list_ollama_models');
}

export async function callTtsApi(request: CallTtsApiRequest, apiKey?: string): Promise<CallTtsApiResult> {
  const mock = getTauriMocks()?.callTtsApi;
  if (mock) {
    return mock(request, apiKey);
  }
  return invoke<CallTtsApiResult>('call_tts_api', { request, apiKey });
}
export async function writeVideoSummary(path: string, html: string): Promise<void> {
  const mock = getTauriMocks()?.writeVideoSummary;
  if (mock) {
    await mock(path, html);
    return;
  }
  await invoke('write_video_summary', { path, html });
}

// ========== 媒体索引与高级检索 ==========

export interface MediaIndexAsset {
  id: string;
  path: string;
  name: string;
  assetType: string;
  fileSize?: number;
  durationMs?: number;
  width?: number;
  height?: number;
  frameRate?: number;
  videoCodec?: string;
  audioCodec?: string;
  colorSpace?: string;
  labelColor?: string;
  rating?: number;
  flag?: string;
  importedAt: string;
  thumbnailPath?: string;
  proxyPath?: string;
}

export interface MediaSearchQuery {
  projectPath: string;
  text?: string;
  assetTypes?: string[];
  tags?: string[];
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  minDurationMs?: number;
  maxDurationMs?: number;
  minRating?: number;
  labelColor?: string;
  flag?: string;
  sortBy?: 'name' | 'duration' | 'size' | 'importedAt' | 'rating';
  sortDesc?: boolean;
  page?: number;
  pageSize?: number;
}

export interface MediaSearchResult {
  assets: MediaIndexAsset[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TagWithCount {
  id: number;
  name: string;
  count: number;
}

export interface AutoTagRequest {
  projectPath: string;
  assetId: string;
  name: string;
  assetType: string;
  durationMs?: number;
  width?: number;
  height?: number;
  frameRate?: number;
  videoCodec?: string;
  audioCodec?: string;
  colorSpace?: string;
  fileSize?: number;
}

export interface AutoTagResult {
  tags: string[];
}

export async function initMediaIndexDb(projectPath: string): Promise<void> {
  const mock = getTauriMocks()?.initMediaIndexDb;
  if (mock) {
    await mock(projectPath);
    return;
  }
  if (!isTauriRuntime()) {
    return;
  }
  await invoke('init_media_index_db', { projectPath });
}

export async function upsertMediaAsset(projectPath: string, asset: MediaIndexAsset): Promise<void> {
  const mock = getTauriMocks()?.upsertMediaAsset;
  if (mock) {
    await mock(projectPath, asset);
    return;
  }
  if (!isTauriRuntime()) {
    return;
  }
  await invoke('upsert_media_asset', { projectPath, asset });
}

export async function batchUpsertMediaAssets(projectPath: string, assets: MediaIndexAsset[]): Promise<number> {
  const mock = getTauriMocks()?.batchUpsertMediaAssets;
  if (mock) {
    return mock(projectPath, assets);
  }
  if (!isTauriRuntime()) {
    return 0;
  }
  return invoke<number>('batch_upsert_media_assets', { projectPath, assets });
}

export async function deleteMediaAsset(projectPath: string, id: string): Promise<void> {
  const mock = getTauriMocks()?.deleteMediaAsset;
  if (mock) {
    await mock(projectPath, id);
    return;
  }
  if (!isTauriRuntime()) {
    return;
  }
  await invoke('delete_media_asset', { projectPath, id });
}

export async function searchMediaAssets(query: MediaSearchQuery): Promise<MediaSearchResult> {
  const mock = getTauriMocks()?.searchMediaAssets;
  if (mock) {
    return mock(query);
  }
  if (!isTauriRuntime()) {
    return { assets: [], total: 0, page: 1, pageSize: 50 };
  }
  return invoke<MediaSearchResult>('search_media_assets', { query });
}

export async function autoTagAsset(request: AutoTagRequest): Promise<AutoTagResult> {
  const mock = getTauriMocks()?.autoTagAsset;
  if (mock) {
    return mock(request);
  }
  if (!isTauriRuntime()) {
    return { tags: [] };
  }
  return invoke<AutoTagResult>('auto_tag_asset', { request });
}

export async function batchAutoTagAssets(projectPath: string, requests: AutoTagRequest[]): Promise<AutoTagResult[]> {
  const mock = getTauriMocks()?.batchAutoTagAssets;
  if (mock) {
    return mock(projectPath, requests);
  }
  if (!isTauriRuntime()) {
    return requests.map(() => ({ tags: [] }));
  }
  return invoke<AutoTagResult[]>('batch_auto_tag_assets', { projectPath, requests });
}

export async function getAllTags(projectPath: string): Promise<TagWithCount[]> {
  const mock = getTauriMocks()?.getAllTags;
  if (mock) {
    return mock(projectPath);
  }
  if (!isTauriRuntime()) {
    return [];
  }
  return invoke<TagWithCount[]>('get_all_tags', { projectPath });
}

export async function addManualTag(projectPath: string, assetId: string, tagName: string): Promise<void> {
  const mock = getTauriMocks()?.addManualTag;
  if (mock) {
    await mock(projectPath, assetId, tagName);
    return;
  }
  if (!isTauriRuntime()) {
    return;
  }
  await invoke('add_manual_tag', { projectPath, assetId, tagName });
}

export async function removeManualTag(projectPath: string, assetId: string, tagName: string): Promise<void> {
  const mock = getTauriMocks()?.removeManualTag;
  if (mock) {
    await mock(projectPath, assetId, tagName);
    return;
  }
  if (!isTauriRuntime()) {
    return;
  }
  await invoke('remove_manual_tag', { projectPath, assetId, tagName });
}

// ==================== 硬件加速解码 ====================

export type HardwareBackend = 'Cuda' | 'Vaapi' | 'QuickSync' | 'VideoToolbox' | 'D3d11va' | 'Auto' | 'Software';

export interface HardwareBackendInfo {
  backend: HardwareBackend;
  available: boolean;
  deviceName?: string;
  supportedCodecs: string[];
}

export interface HardwareCapabilities {
  availableBackends: HardwareBackendInfo[];
  recommendedBackend: HardwareBackend;
  supportedCodecs: string[];
}

export interface DecoderConfig {
  path: string;
  preferredBackend?: HardwareBackend;
  targetWidth?: number;
  targetHeight?: number;
}

export interface DecoderHandle {
  0: number;
}

export interface DecodedFrame {
  width: number;
  height: number;
  dataBase64: string;
  timestamp: number;
  format: string;
}

export async function getHwDecodeCapabilities(): Promise<HardwareCapabilities> {
  const mock = getTauriMocks()?.getHwDecodeCapabilities;
  if (mock) {
    return mock();
  }
  if (!isTauriRuntime()) {
    return {
      availableBackends: [],
      recommendedBackend: 'Software',
      supportedCodecs: [],
    };
  }
  return invoke<HardwareCapabilities>('get_hw_decode_capabilities');
}

export async function initHardwareDecoder(config: DecoderConfig): Promise<DecoderHandle> {
  const mock = getTauriMocks()?.initHardwareDecoder;
  if (mock) {
    return mock(config);
  }
  if (!isTauriRuntime()) {
    throw new Error('initHardwareDecoder 需要 Tauri 运行时。');
  }
  return invoke<DecoderHandle>('init_hardware_decoder', { config });
}

export async function decodeVideoFrame(handle: DecoderHandle, timestamp: number): Promise<DecodedFrame> {
  const mock = getTauriMocks()?.decodeVideoFrame;
  if (mock) {
    return mock(handle, timestamp);
  }
  if (!isTauriRuntime()) {
    throw new Error('decodeVideoFrame 需要 Tauri 运行时。');
  }
  return invoke<DecodedFrame>('decode_video_frame', { handle, timestamp });
}

export async function releaseDecoder(handle: DecoderHandle): Promise<void> {
  const mock = getTauriMocks()?.releaseDecoder;
  if (mock) {
    await mock(handle);
    return;
  }
  if (!isTauriRuntime()) {
    return;
  }
  await invoke('release_decoder', { handle });
}

export interface VideoInfo {
  width: number;
  height: number;
  duration: number;
  codec: string;
  frameRate: number;
}

export interface HwDecodeSettings {
  mode: string;
  preferredBackend: HardwareBackend;
  enableFrameCache: boolean;
  frameCacheSize: number;
  enablePreDecode: boolean;
  preDecodeFrameCount: number;
}

export async function decodeVideoFrames(handle: DecoderHandle, timestamps: number[]): Promise<DecodedFrame[]> {
  const mock = getTauriMocks()?.decodeVideoFrames;
  if (mock) {
    return mock(handle, timestamps);
  }
  if (!isTauriRuntime()) {
    throw new Error('decodeVideoFrames 需要 Tauri 运行时。');
  }
  return invoke<DecodedFrame[]>('decode_video_frames', { handle, timestamps });
}

export async function getDecoderVideoInfo(handle: DecoderHandle): Promise<VideoInfo> {
  const mock = getTauriMocks()?.getDecoderVideoInfo;
  if (mock) {
    return mock(handle);
  }
  if (!isTauriRuntime()) {
    throw new Error('getDecoderVideoInfo 需要 Tauri 运行时。');
  }
  return invoke<VideoInfo>('get_decoder_video_info', { handle });
}

export async function getHwDecodeSettings(): Promise<HwDecodeSettings> {
  const mock = getTauriMocks()?.getHwDecodeSettings;
  if (mock) {
    return mock();
  }
  if (!isTauriRuntime()) {
    return {
      mode: 'auto',
      preferredBackend: 'Auto',
      enableFrameCache: true,
      frameCacheSize: 30,
      enablePreDecode: true,
      preDecodeFrameCount: 5,
    };
  }
  return invoke<HwDecodeSettings>('get_hw_decode_settings');
}

export async function setHwDecodeSettings(settings: HwDecodeSettings): Promise<void> {
  const mock = getTauriMocks()?.setHwDecodeSettings;
  if (mock) {
    await mock(settings);
    return;
  }
  if (!isTauriRuntime()) {
    return;
  }
  await invoke('set_hw_decode_settings', { settings });
}
