/**
 * 批量导出引擎
 *
 * 编排多平台并行导出，复用现有 export-queue 和 scheduling 基础设施。
 * 为每个目标平台生成独立的导出任务，统一管理进度和错误处理。
 */
import { getDistributionPlatform } from './platform-presets';
import { cropResultToReframeOffset } from './smart-crop';
import { getTimelinePlaybackDuration } from '../timeline';
/**
 * 估算单个平台导出的成本
 * 基于码率和时长的简单估算
 */
function estimateExportCost(project, platform) {
    const durationSecs = getTimelinePlaybackDuration(project.timeline);
    // 视频文件大小 = 视频码率 × 时长 + 音频码率 × 时长
    const videoBitrateBps = parseBitrate(platform.videoBitrate);
    const audioBitrateBps = parseBitrate(platform.audioBitrate);
    const fileSizeBytes = Math.round(((videoBitrateBps + audioBitrateBps) * durationSecs) / 8);
    // 导出时间估算：假设 2x 实时速度
    const estimatedDurationSecs = durationSecs / 2;
    return {
        durationSecs: estimatedDurationSecs,
        fileSizeBytes,
    };
}
/** 解析码率字符串为 bps */
function parseBitrate(bitrate) {
    const match = bitrate.match(/^(\d+(?:\.\d+)?)\s*([kKmMgG])?/);
    if (!match)
        return 5_000_000; // 默认 5Mbps
    const value = Number(match[1]);
    const unit = (match[2] ?? '').toLowerCase();
    switch (unit) {
        case 'k':
            return value * 1_000;
        case 'm':
            return value * 1_000_000;
        case 'g':
            return value * 1_000_000_000;
        default:
            return value;
    }
}
// ─── 文件名模板 ────────────────────────────────────────────
/**
 * 应用文件名模板
 *
 * 支持的占位符：
 * - {platform}: 平台名称
 * - {platform_id}: 平台 ID
 * - {date}: 当前日期 (YYYY-MM-DD)
 * - {project}: 项目名称
 * - {resolution}: 分辨率 (如 1920x1080)
 * - {aspect}: 宽高比 (如 16-9)
 */
export function applyDistributionTemplate(template, platform, projectName) {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return template
        .replace(/\{platform\}/g, platform.name)
        .replace(/\{platform_id\}/g, platform.id)
        .replace(/\{date\}/g, dateStr)
        .replace(/\{project\}/g, projectName)
        .replace(/\{resolution\}/g, `${platform.width}x${platform.height}`)
        .replace(/\{aspect\}/g, platform.aspectRatio.replace(':', '-'));
}
// ─── 导出设置构建 ────────────────────────────────────────────
const DEFAULT_DISTRIBUTION_TEMPLATE = '{project}-{platform}-{resolution}';
/**
 * 为指定平台构建导出设置
 */
export function buildPlatformExportSettings(platform, outputDir, projectName, template = DEFAULT_DISTRIBUTION_TEMPLATE, cropResult, override) {
    const fileName = applyDistributionTemplate(template, platform, projectName);
    const outputPath = `${outputDir}/${fileName}.${platform.format}`;
    const reframeOffset = cropResult ? cropResultToReframeOffset(cropResult) : { reframeOffsetX: 0, reframeOffsetY: 0 };
    const settings = {
        width: platform.width,
        height: platform.height,
        fps: platform.fps,
        sampleRate: 44100,
        videoCodec: platform.videoCodec,
        audioCodec: platform.audioCodec,
        format: platform.format,
        outputPath,
        videoBitrate: platform.videoBitrate,
        audioBitrate: platform.audioBitrate,
        videoProfile: platform.videoProfile,
        scaleMode: 'fit',
        targetAspectRatio: 'source',
        reframeOffsetX: reframeOffset.reframeOffsetX,
        reframeOffsetY: reframeOffset.reframeOffsetY,
        hardwareEncoding: false,
        loudnessNormalization: platform.loudnessTarget ?? 'off',
        platformPreset: mapPlatformIdToExportPreset(platform.id),
        ...override,
    };
    return settings;
}
/** 将 DistributionPlatformId 映射到 ExportPlatformPreset */
function mapPlatformIdToExportPreset(id) {
    const mapping = {
        'youtube-1080p': 'youtube-1080p',
        'youtube-shorts': 'youtube-shorts',
        tiktok: 'tiktok',
        'instagram-reels': 'instagram-reels',
        'instagram-feed': 'instagram-reels',
        'twitter-x': 'twitter-x',
        bilibili: 'bilibili',
        'weixin-channels': 'bilibili',
        kuaishou: 'tiktok',
        pinterest: 'instagram-reels',
    };
    return mapping[id];
}
// ─── 批量任务生成 ────────────────────────────────────────────
/**
 * 生成分发批次任务列表
 *
 * @param request 批量分发请求
 * @returns 批次结果，包含所有平台的导出任务
 */
export function createDistributionBatch(request) {
    const batchId = generateBatchId();
    const projectName = request.project.name ?? 'Untitled';
    const template = request.template ?? DEFAULT_DISTRIBUTION_TEMPLATE;
    const tasks = request.platforms.map((platformId, index) => {
        const platform = getDistributionPlatform(platformId);
        const cropResult = request.cropResults?.get(platformId);
        const settings = buildPlatformExportSettings(platform, request.outputDir, projectName, template, cropResult, request.settingsOverride);
        const cost = estimateExportCost(request.project, platform);
        return {
            id: `${batchId}-${index}`,
            platform,
            settings,
            estimatedDurationSecs: cost.durationSecs,
            estimatedFileSizeBytes: cost.fileSizeBytes,
            status: 'pending',
            progress: 0,
        };
    });
    const totalEstimatedDurationSecs = tasks.reduce((sum, t) => sum + t.estimatedDurationSecs, 0);
    const totalEstimatedFileSizeBytes = tasks.reduce((sum, t) => sum + t.estimatedFileSizeBytes, 0);
    return {
        batchId,
        tasks,
        totalEstimatedDurationSecs,
        totalEstimatedFileSizeBytes,
    };
}
// ─── 进度更新 ────────────────────────────────────────────
/** 更新任务进度 */
export function updateDistributionTaskProgress(tasks, taskId, progress) {
    return tasks.map((task) => (task.id === taskId ? { ...task, progress: Math.max(0, Math.min(1, progress)) } : task));
}
/** 完成任务 */
export function finishDistributionTask(tasks, taskId) {
    return tasks.map((task) => (task.id === taskId ? { ...task, status: 'success', progress: 1 } : task));
}
/** 任务失败 */
export function failDistributionTask(tasks, taskId, error) {
    return tasks.map((task) => (task.id === taskId ? { ...task, status: 'error', error } : task));
}
/** 取消任务 */
export function cancelDistributionTask(tasks, taskId) {
    return tasks.map((task) => (task.id === taskId ? { ...task, status: 'canceled' } : task));
}
/** 检查批次是否全部完成 */
export function isDistributionBatchComplete(tasks) {
    return tasks.every((t) => t.status === 'success' || t.status === 'error' || t.status === 'canceled');
}
/** 获取批次统计 */
export function getDistributionBatchStats(tasks) {
    return {
        total: tasks.length,
        pending: tasks.filter((t) => t.status === 'pending').length,
        running: tasks.filter((t) => t.status === 'running').length,
        success: tasks.filter((t) => t.status === 'success').length,
        error: tasks.filter((t) => t.status === 'error').length,
        canceled: tasks.filter((t) => t.status === 'canceled').length,
    };
}
// ─── 工具函数 ────────────────────────────────────────────
function generateBatchId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `dist-${timestamp}-${random}`;
}
/** 格式化文件大小 */
export function formatFileSize(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
//# sourceMappingURL=batch-export.js.map