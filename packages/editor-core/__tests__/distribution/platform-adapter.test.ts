import { describe, it, expect } from 'vitest';
import {
  getPlatformAdaptation,
  getBatchPlatformAdaptations,
  getAdaptedPlatformIds,
  analyzeAdaptationNeeds,
  calculatePlatformRhythm,
  type PlatformAdaptation,
  type PlatformRhythmParams,
} from '../../src/distribution/platform-adapter';

// ─── 测试用例 ────────────────────────────────────────────

describe('platform-adapter', () => {
  describe('getPlatformAdaptation', () => {
    it('应返回 YouTube 平台适配方案', () => {
      const adaptation = getPlatformAdaptation('youtube-1080p');

      expect(adaptation.platform.id).toBe('youtube-1080p');
      expect(adaptation.platform.name).toBe('YouTube');
      expect(adaptation.rhythmStyle).toBe('medium');
      expect(adaptation.transitionStyle).toBe('smooth');
    });

    it('应返回 TikTok 平台适配方案', () => {
      const adaptation = getPlatformAdaptation('tiktok');

      expect(adaptation.platform.id).toBe('tiktok');
      expect(adaptation.rhythmStyle).toBe('fast');
      expect(adaptation.optimizations.hookDurationSecs).toBe(3);
      expect(adaptation.optimizations.loopFriendly).toBe(true);
    });

    it('应返回 Bilibili 平台适配方案', () => {
      const adaptation = getPlatformAdaptation('bilibili');

      expect(adaptation.platform.id).toBe('bilibili');
      expect(adaptation.subtitleAdaptation.showSpeakerLabel).toBe(true);
      expect(adaptation.subtitleAdaptation.backgroundStyle).toBe('semi-transparent');
    });

    it('每个平台应有完整的字幕适配', () => {
      const platforms: Array<'youtube-1080p' | 'tiktok' | 'bilibili' | 'youtube-shorts'> = [
        'youtube-1080p',
        'tiktok',
        'bilibili',
        'youtube-shorts',
      ];

      for (const platformId of platforms) {
        const adaptation = getPlatformAdaptation(platformId);
        const sub = adaptation.subtitleAdaptation;

        expect(sub.fontSizeRatio).toBeGreaterThan(0);
        expect(sub.fontSizeRatio).toBeLessThan(0.1);
        expect(sub.verticalPosition).toBeGreaterThanOrEqual(0);
        expect(sub.verticalPosition).toBeLessThanOrEqual(1);
        expect(sub.fontWeight).toMatch(/^(normal|bold|extrabold)$/);
        expect(sub.maxCharsPerLine).toBeGreaterThan(0);
        expect(sub.animationType).toMatch(/^(none|fade|pop|slide|typewriter)$/);
      }
    });

    it('每个平台应有完整的片头片尾配置', () => {
      const adaptation = getPlatformAdaptation('youtube-1080p');

      expect(adaptation.intro).toBeDefined();
      expect(adaptation.intro.durationSecs).toBeGreaterThanOrEqual(0);
      expect(adaptation.outro).toBeDefined();
      expect(adaptation.outro.durationSecs).toBeGreaterThanOrEqual(0);
    });

    it('每个平台应有优化策略', () => {
      const adaptation = getPlatformAdaptation('tiktok');

      expect(adaptation.optimizations).toBeDefined();
      expect(adaptation.optimizations.hookDurationSecs).toBeGreaterThan(0);
      expect(typeof adaptation.optimizations.addOpeningHook).toBe('boolean');
      expect(typeof adaptation.optimizations.loopFriendly).toBe('boolean');
      expect(typeof adaptation.optimizations.silentModeFriendly).toBe('boolean');
    });

    it('短视频平台应有更快的节奏', () => {
      const tiktok = getPlatformAdaptation('tiktok');
      const youtube = getPlatformAdaptation('youtube-1080p');

      expect(tiktok.clipsPerMinute).toBeGreaterThan(youtube.clipsPerMinute);
      expect(tiktok.clipDurationRange.min).toBeLessThan(youtube.clipDurationRange.min);
    });

    it('抖音应有前3秒强吸引配置', () => {
      const adaptation = getPlatformAdaptation('tiktok');

      expect(adaptation.optimizations.addOpeningHook).toBe(true);
      expect(adaptation.optimizations.hookDurationSecs).toBeGreaterThanOrEqual(2);
    });

    it('未知平台应使用默认规则', () => {
      // 使用一个没有专属规则的平台
      const adaptation = getPlatformAdaptation('pinterest');

      expect(adaptation.platform.id).toBe('pinterest');
      expect(adaptation.rhythmStyle).toBeDefined();
      expect(adaptation.subtitleAdaptation).toBeDefined();
    });
  });

  describe('getBatchPlatformAdaptations', () => {
    it('应批量获取多个平台的适配方案', () => {
      const adaptations = getBatchPlatformAdaptations(['youtube-1080p', 'tiktok', 'bilibili']);

      expect(adaptations.length).toBe(3);
      expect(adaptations[0].platform.id).toBe('youtube-1080p');
      expect(adaptations[1].platform.id).toBe('tiktok');
      expect(adaptations[2].platform.id).toBe('bilibili');
    });

    it('空列表应返回空数组', () => {
      const adaptations = getBatchPlatformAdaptations([]);
      expect(adaptations).toEqual([]);
    });
  });

  describe('getAdaptedPlatformIds', () => {
    it('应返回已注册适配规则的平台 ID', () => {
      const ids = getAdaptedPlatformIds();

      expect(ids.length).toBeGreaterThan(0);
      expect(ids).toContain('youtube-1080p');
      expect(ids).toContain('tiktok');
      expect(ids).toContain('bilibili');
    });
  });

  describe('analyzeAdaptationNeeds', () => {
    const baseProject = {
      width: 1920,
      height: 1080,
      durationSecs: 120,
      hasSubtitles: true,
      hasIntro: true,
      hasOutro: true,
      clipsPerMinute: 10,
    };

    it('完美匹配时应无建议', () => {
      const suggestions = analyzeAdaptationNeeds(baseProject, 'youtube-1080p');

      // YouTube 推荐 8 clips/min，我们的 10 差异在 5 以内
      const criticalSuggestions = suggestions.filter((s) => s.severity === 'critical');
      expect(criticalSuggestions.length).toBe(0);
    });

    it('缺少字幕时应提供建议', () => {
      const suggestions = analyzeAdaptationNeeds(
        { ...baseProject, hasSubtitles: false },
        'tiktok',
      );

      const subtitleSuggestions = suggestions.filter((s) => s.type === 'subtitle');
      expect(subtitleSuggestions.length).toBeGreaterThan(0);
    });

    it('缺少片头时应提供建议', () => {
      const suggestions = analyzeAdaptationNeeds(
        { ...baseProject, hasIntro: false },
        'youtube-1080p',
      );

      const introSuggestions = suggestions.filter((s) => s.type === 'intro');
      expect(introSuggestions.length).toBeGreaterThan(0);
    });

    it('视频超时应生成严重警告', () => {
      const suggestions = analyzeAdaptationNeeds(
        { ...baseProject, durationSecs: 700 },
        'tiktok',
      );

      const criticalSuggestions = suggestions.filter((s) => s.severity === 'critical');
      expect(criticalSuggestions.length).toBeGreaterThan(0);
      expect(criticalSuggestions[0].message).toContain('超出');
    });

    it('抖音应提示前3秒强吸引', () => {
      const suggestions = analyzeAdaptationNeeds(baseProject, 'tiktok');

      const hookSuggestions = suggestions.filter((s) => s.type === 'optimization' && s.message.includes('强吸引'));
      expect(hookSuggestions.length).toBeGreaterThan(0);
    });

    it('剪辑密度差异大时应警告', () => {
      const suggestions = analyzeAdaptationNeeds(
        { ...baseProject, clipsPerMinute: 20 },
        'youtube-1080p',
      );

      const rhythmSuggestions = suggestions.filter((s) => s.type === 'rhythm');
      expect(rhythmSuggestions.length).toBeGreaterThan(0);
    });

    it('建议应包含平台 ID', () => {
      const suggestions = analyzeAdaptationNeeds(baseProject, 'tiktok');

      for (const suggestion of suggestions) {
        expect(suggestion.platformId).toBe('tiktok');
      }
    });
  });

  describe('calculatePlatformRhythm', () => {
    it('应返回节奏参数', () => {
      const adaptation = getPlatformAdaptation('youtube-1080p');
      const rhythm = calculatePlatformRhythm(adaptation, 120);

      expect(rhythm.targetBpm).toBeGreaterThan(0);
      expect(rhythm.clipDurations.length).toBeGreaterThan(0);
      expect(rhythm.transitionInterval).toBeGreaterThan(0);
      expect(rhythm.beatsPerSecond).toBeGreaterThan(0);
    });

    it('快节奏平台应有更高 BPM', () => {
      const fastAdaptation = getPlatformAdaptation('tiktok');
      const slowAdaptation = getPlatformAdaptation('youtube-1080p');

      const fastRhythm = calculatePlatformRhythm(fastAdaptation, 60);
      const slowRhythm = calculatePlatformRhythm(slowAdaptation, 60);

      expect(fastRhythm.targetBpm).toBeGreaterThan(slowRhythm.targetBpm);
    });

    it('片段时长应在平台范围内', () => {
      const adaptation = getPlatformAdaptation('tiktok');
      const rhythm = calculatePlatformRhythm(adaptation, 30);

      for (const duration of rhythm.clipDurations) {
        expect(duration).toBeGreaterThanOrEqual(adaptation.clipDurationRange.min * 0.5);
        expect(duration).toBeLessThanOrEqual(adaptation.clipDurationRange.max * 1.5);
      }
    });

    it('更长的视频应生成更多片段', () => {
      const adaptation = getPlatformAdaptation('tiktok');
      const shortRhythm = calculatePlatformRhythm(adaptation, 15);
      const longRhythm = calculatePlatformRhythm(adaptation, 60);

      expect(longRhythm.clipDurations.length).toBeGreaterThan(shortRhythm.clipDurations.length);
    });
  });
});
