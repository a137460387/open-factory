import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import type { FfmpegExportPlan, PostExportQualityAssuranceResult } from '@open-factory/editor-core';
import type {
  AnalyzeClipRequest,
  AnalyzeClipResult,
  AnalyzeMotionTrackRequest,
  AnalyzeMotionTrackResult,
  BatchTranscodeRequest,
  BatchTranscodeResponse,
  ExportPreviewSamplesRequest,
  ExportPreviewSamplesResult,
  ExportResult,
  GifExportRequest,
  GifPreviewRequest,
  GifWorkflowResult,
  PostExportQualityAssuranceRequest,
  QualityEvaluationRequest,
  QualityEvaluationResult,
  SharePackageRequest,
  SharePackageResult,
  SharedLibraryArchiveRequest,
  SharedLibraryArchiveResult,
  SharedLibraryImportRequest,
  SharedLibraryImportResult,
  SmtpEmailRequest,
  TranslationApiProvider,
  WebdavExportUploadRequest,
  WebdavExportUploadResult,
  WebdavProjectBackupRequest,
  WebdavProjectBackupResult,
  WebdavTextPutRequest,
  WebdavTextRequest,
  WebdavTextResult,
  WebhookJsonRequest,
} from './types';
import { getTauriMocks } from './mock-types';
import { isTauriRuntime } from '../tauri';

export async function runExport(plan: FfmpegExportPlan, taskId?: string): Promise<ExportResult> {
  const mock = getTauriMocks()?.runExport;
  if (mock) {
    return mock(plan, taskId);
  }
  return invoke<ExportResult>('run_export', taskId ? { plan, taskId } : { plan });
}

export async function runExportPreviewSamples(
  request: ExportPreviewSamplesRequest,
): Promise<ExportPreviewSamplesResult> {
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

export async function createSharedLibraryArchive(
  request: SharedLibraryArchiveRequest,
): Promise<SharedLibraryArchiveResult> {
  const mock = getTauriMocks()?.createSharedLibraryArchive;
  if (mock) {
    return mock(request);
  }
  return invoke<SharedLibraryArchiveResult>('create_shared_library_archive', { request });
}

export async function importSharedLibraryArchive(
  request: SharedLibraryImportRequest,
): Promise<SharedLibraryImportResult> {
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

export async function readSmtpPassword(profile: string): Promise<string | undefined> {
  const mock = getTauriMocks()?.readSmtpPassword;
  if (mock) {
    return mock(profile);
  }
  return invoke<string | undefined>('read_smtp_password', { profile });
}

export async function writeSmtpPassword(profile: string, password?: string): Promise<void> {
  const mock = getTauriMocks()?.writeSmtpPassword;
  if (mock) {
    await mock(profile, password);
    return;
  }
  await invoke('write_smtp_password', { profile, password });
}

export async function sendSmtpEmail(request: SmtpEmailRequest): Promise<void> {
  const mock = getTauriMocks()?.sendSmtpEmail;
  if (mock) {
    await mock(request);
    return;
  }
  await invoke('send_smtp_email', { request });
}

export async function postWebhookJson(request: WebhookJsonRequest): Promise<{ status: number }> {
  const mock = getTauriMocks()?.postWebhookJson;
  if (mock) {
    return mock(request);
  }
  return invoke<{ status: number }>('post_webhook_json', { request });
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

export async function runPostExportQualityAssurance(
  request: PostExportQualityAssuranceRequest,
): Promise<PostExportQualityAssuranceResult> {
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

export interface RenderPreviewCacheRequest {
  projectId: string;
  startSec: number;
  endSec: number;
  sourcePath: string;
  width: number;
  height: number;
}

export interface RenderPreviewCacheResult {
  outputPath: string;
  durationMs: number;
  success: boolean;
  error?: string;
}

interface RenderPreviewCacheProgressEvent {
  projectId: string;
  progress: number;
  stage: string;
}

export async function renderPreviewCache(request: RenderPreviewCacheRequest): Promise<RenderPreviewCacheResult> {
  return await invoke<RenderPreviewCacheResult>('render_preview_cache', { request });
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
