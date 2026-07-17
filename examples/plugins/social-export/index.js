/**
 * 社交媒体导出 - 导出插件示例
 *
 * 功能：提供抖音、B站、YouTube等平台的导出预设
 * 用法：在导出面板中选择平台预设，自动配置最佳参数
 */
module.exports = {
  manifest: {
    id: 'open-factory.example.social-export',
    name: '社交媒体导出',
    version: '1.0.0',
    description: '一键导出适合抖音、B站、YouTube等平台的视频格式与参数预设。',
    category: 'export',
    permissions: ['export-hook', 'read-project'],
  },
  hooks: {
    /**
     * 导出前钩子：根据项目信息推荐最佳预设
     */
    onExportBefore(payload) {
      const { project } = payload;
      const presets = getPlatformPresets();
      const duration = estimateDuration(project);

      return {
        message: `社交媒体导出：已加载 ${presets.length} 个平台预设`,
        presets: presets.map((p) => ({
          id: p.id,
          name: p.name,
          platform: p.platform,
        })),
        recommendedPreset: recommendPreset(project, presets),
        estimatedDuration: duration,
      };
    },
  },
};

/**
 * 平台导出预设定义
 */
function getPlatformPresets() {
  return [
    {
      id: 'douyin-vertical',
      name: '抖音竖屏',
      platform: '抖音',
      width: 1080,
      height: 1920,
      fps: 30,
      videoBitrate: '6M',
      audioBitrate: '128k',
      codec: 'h264',
      maxDuration: 600,
      format: 'mp4',
    },
    {
      id: 'bilibili-1080p',
      name: 'B站 1080P',
      platform: 'B站',
      width: 1920,
      height: 1080,
      fps: 30,
      videoBitrate: '8M',
      audioBitrate: '192k',
      codec: 'h264',
      maxDuration: 3600,
      format: 'mp4',
    },
    {
      id: 'youtube-1080p',
      name: 'YouTube 1080P',
      platform: 'YouTube',
      width: 1920,
      height: 1080,
      fps: 30,
      videoBitrate: '8M',
      audioBitrate: '256k',
      codec: 'h264',
      maxDuration: 43200,
      format: 'mp4',
    },
    {
      id: 'wechat-moments',
      name: '微信朋友圈',
      platform: '微信',
      width: 1080,
      height: 1920,
      fps: 30,
      videoBitrate: '4M',
      audioBitrate: '128k',
      codec: 'h264',
      maxDuration: 30,
      format: 'mp4',
    },
    {
      id: 'xiaohongshu',
      name: '小红书',
      platform: '小红书',
      width: 1080,
      height: 1440,
      fps: 30,
      videoBitrate: '5M',
      audioBitrate: '128k',
      codec: 'h264',
      maxDuration: 900,
      format: 'mp4',
    },
  ];
}

/**
 * 根据项目特征推荐最佳预设
 */
function recommendPreset(project, presets) {
  const tracks = project.timeline?.tracks ?? [];
  const hasVideo = tracks.some((t) => t.type === 'video');

  if (!hasVideo || presets.length === 0) {
    return presets[0]?.id ?? null;
  }

  // 默认推荐 B站 1080P
  return presets.find((p) => p.id === 'bilibili-1080p')?.id ?? presets[0].id;
}

/**
 * 估算项目时长（秒）
 */
function estimateDuration(project) {
  const tracks = project.timeline?.tracks ?? [];
  let maxEnd = 0;
  for (const track of tracks) {
    for (const clip of track.clips ?? []) {
      const end = (clip.startTime ?? 0) + (clip.duration ?? 0);
      if (end > maxEnd) maxEnd = end;
    }
  }
  return maxEnd;
}

/**
 * 为指定预设生成 FFmpeg 参数
 */
function buildExportArgs(preset) {
  return [
    '-c:v', preset.codec,
    '-b:v', preset.videoBitrate,
    '-b:a', preset.audioBitrate,
    '-r', String(preset.fps),
    '-s', `${preset.width}x${preset.height}`,
    '-movflags', '+faststart',
    '-pix_fmt', 'yuv420p',
  ];
}

module.exports.getPlatformPresets = getPlatformPresets;
module.exports.recommendPreset = recommendPreset;
module.exports.estimateDuration = estimateDuration;
module.exports.buildExportArgs = buildExportArgs;
