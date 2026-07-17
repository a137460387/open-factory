/**
 * 批量字幕翻译 - 工作流插件示例
 *
 * 功能：将项目字幕批量翻译为目标语言
 * 用法：通过菜单触发翻译工作流，选择目标语言后自动处理
 */
module.exports = {
  manifest: {
    id: 'open-factory.example.subtitle-translator',
    name: '批量字幕翻译',
    version: '1.0.0',
    description: '将项目字幕批量翻译为目标语言，支持自定义术语表和分批处理。',
    category: 'workflow',
    permissions: ['read-project', 'write-project'],
  },
  hooks: {
    /**
     * 菜单注册钩子：注册翻译菜单项
     */
    onMenuRegister(payload) {
      payload.menus.push({
        id: 'subtitle-translator.translate',
        label: '翻译字幕…',
      });
      payload.menus.push({
        id: 'subtitle-translator.glossary',
        label: '编辑术语表…',
      });
    },

    /**
     * 导出前钩子：附加翻译元数据
     */
    onExportBefore(payload) {
      const { project } = payload;
      const subtitleTracks = project.timeline.tracks.filter(
        (track) => track.type === 'subtitle',
      );
      const totalSubtitles = subtitleTracks.reduce(
        (count, track) => count + track.clips.length,
        0,
      );
      if (totalSubtitles > 0) {
        return {
          message: `字幕翻译器：发现 ${totalSubtitles} 条字幕`,
          subtitleCount: totalSubtitles,
        };
      }
      return undefined;
    },
  },
};

/**
 * 模拟翻译函数（实际使用时应调用翻译 API）
 * @param {string} text - 原文
 * @param {string} targetLang - 目标语言代码
 * @param {object} glossary - 术语表
 * @returns {string} 翻译结果
 */
function translateText(text, targetLang, glossary = {}) {
  // 检查术语表
  if (glossary[text]) {
    return glossary[text];
  }

  // 模拟翻译（实际应接入翻译 API）
  const prefixes = {
    en: '[EN] ',
    ja: '[JA] ',
    ko: '[KO] ',
  };
  return (prefixes[targetLang] || '') + text;
}

/**
 * 分批处理字幕
 * @param {Array} subtitles - 字幕列表
 * @param {number} batchSize - 每批数量
 * @returns {Array[]} 分批结果
 */
function batchSubtitles(subtitles, batchSize = 20) {
  const batches = [];
  for (let i = 0; i < subtitles.length; i += batchSize) {
    batches.push(subtitles.slice(i, i + batchSize));
  }
  return batches;
}

module.exports.translateText = translateText;
module.exports.batchSubtitles = batchSubtitles;
