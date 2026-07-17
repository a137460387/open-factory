/**
 * 高级色彩校正器 - 效果插件示例
 *
 * 功能：提供亮度、对比度、饱和度、色温调节
 * 用法：在时间线片段上应用此效果，通过参数面板调整色彩参数
 */
module.exports = {
  manifest: {
    id: 'open-factory.example.color-corrector',
    name: '高级色彩校正器',
    version: '1.0.0',
    description: '提供亮度、对比度、饱和度调节和色温偏移的色彩校正效果插件。',
    category: 'effect',
    permissions: ['read-project'],
  },
  hooks: {
    /**
     * 导出前钩子：记录色彩校正参数供 FFmpeg 滤镜使用
     */
    onExportBefore(payload) {
      const { project } = payload;
      const clipCount = project.timeline.tracks.reduce(
        (count, track) => count + track.clips.length,
        0,
      );
      return {
        message: `色彩校正器：已处理 ${clipCount} 个片段`,
        ffmpegFilter: buildColorFilter({
          brightness: 0,
          contrast: 1.0,
          saturation: 1.0,
          temperature: 0,
        }),
      };
    },
  },
};

/**
 * 构建 FFmpeg 色彩校正滤镜字符串
 * @param {object} params - 色彩参数
 * @returns {string} FFmpeg 滤镜表达式
 */
function buildColorFilter(params) {
  const filters = [];

  // 亮度和对比度使用 eq 滤镜
  if (params.brightness !== 0 || params.contrast !== 1.0) {
    filters.push(`eq=brightness=${params.brightness}:contrast=${params.contrast}`);
  }

  // 饱和度
  if (params.saturation !== 1.0) {
    filters.push(`eq=saturation=${params.saturation}`);
  }

  // 色温偏移使用 colorbalance
  if (params.temperature !== 0) {
    const warmth = params.temperature / 100;
    if (warmth > 0) {
      filters.push(`colorbalance=rs=${warmth * 0.3}:gs=0:bs=${-warmth * 0.3}`);
    } else {
      filters.push(`colorbalance=rs=${warmth * 0.3}:gs=0:bs=${-warmth * 0.3}`);
    }
  }

  return filters.join(',');
}

// 导出构建函数供测试使用
module.exports.buildColorFilter = buildColorFilter;
