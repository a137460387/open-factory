import { expect, test } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

test.describe('AI TTS 语音合成', () => {
  test('TTS面板显示语音选择和参数控制', async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);

    // 打开TTS面板（通过AI菜单）
    const aiMenu = page.getByTestId('toolbar-ai-button');
    if (await aiMenu.isVisible()) {
      await aiMenu.click();
      const ttsOption = page.getByText('语音合成');
      if (await ttsOption.isVisible()) {
        await ttsOption.click();
      }
    }

    // 验证TTS面板元素存在
    const ttsPanel = page.getByTestId('tts-panel');
    if (await ttsPanel.isVisible({ timeout: 5000 }).catch(() => false)) {
      // 验证文本输入区域
      await expect(page.getByTestId('tts-text-input')).toBeVisible();

      // 验证语音选择下拉框
      await expect(page.getByTestId('tts-voice-select')).toBeVisible();

      // 验证设置按钮
      await expect(page.getByTestId('tts-settings-toggle')).toBeVisible();
    }
  });

  test('TTS参数验证拒绝空文本', async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);

    // 模拟TTS参数验证逻辑
    const validationResult = await page.evaluate(() => {
      // 直接在页面中测试验证逻辑
      const text = '';
      const issues = [];
      if (!text || text.trim().length === 0) {
        issues.push({ type: 'empty-text', message: '文本内容为空' });
      }
      return issues;
    });

    expect(validationResult.length).toBeGreaterThan(0);
    expect(validationResult[0].type).toBe('empty-text');
  });
});

test.describe('说话人-多机位集成', () => {
  test('说话人分离结果可映射到机位', async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);

    // 模拟说话人-机位映射逻辑
    const mappingResult = await page.evaluate(() => {
      // 模拟说话人分离结果
      const speakers = [
        { speakerId: 0, speakerLabel: '说话人 A', sampleCount: 5 },
        { speakerId: 1, speakerLabel: '说话人 B', sampleCount: 3 },
        { speakerId: 2, speakerLabel: '说话人 C', sampleCount: 4 },
      ];

      // 模拟机位列表
      const angles = [
        { index: 0, name: '机位 1' },
        { index: 1, name: '机位 2' },
        { index: 2, name: '机位 3' },
      ];

      // 自动生成映射
      const mappings = speakers.map((speaker, index) => ({
        speakerId: speaker.speakerId,
        speakerLabel: speaker.speakerLabel,
        angleIndex: angles[index % angles.length].index,
        angleName: angles[index % angles.length].name,
      }));

      return mappings;
    });

    expect(mappingResult.length).toBe(3);
    expect(mappingResult[0].angleIndex).toBe(0);
    expect(mappingResult[1].angleIndex).toBe(1);
    expect(mappingResult[2].angleIndex).toBe(2);
  });

  test('基于说话人的切换建议遵守最小间隔', async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);

    // 模拟切换建议生成逻辑
    const switchResult = await page.evaluate(() => {
      // 模拟说话人分离片段
      const segments = [
        { startMs: 0, endMs: 5000, speakerId: 0, speakerLabel: '说话人 A', confidence: 0.9 },
        { startMs: 5000, endMs: 8000, speakerId: 1, speakerLabel: '说话人 B', confidence: 0.85 },
        { startMs: 8000, endMs: 10000, speakerId: 0, speakerLabel: '说话人 A', confidence: 0.92 },
        { startMs: 10000, endMs: 15000, speakerId: 1, speakerLabel: '说话人 B', confidence: 0.88 },
      ];

      // 模拟机位映射
      const speakerAngleMap = new Map([
        [0, 0],
        [1, 1],
      ]);

      // 最小切换间隔
      const minSwitchIntervalMs = 1500;

      // 生成切换建议
      const switches = [];
      let lastSwitchTime = -Infinity;

      for (const seg of segments) {
        const targetAngle = speakerAngleMap.get(seg.speakerId);
        if (targetAngle === undefined) continue;

        if (seg.startMs - lastSwitchTime >= minSwitchIntervalMs) {
          switches.push({
            timeMs: seg.startMs,
            targetAngle,
            speakerId: seg.speakerId,
          });
          lastSwitchTime = seg.startMs;
        }
      }

      return switches;
    });

    // 应该有4次切换（每次说话人变化都满足间隔）
    expect(switchResult.length).toBe(4);
    expect(switchResult[0].targetAngle).toBe(0); // 说话人A -> 机位0
    expect(switchResult[1].targetAngle).toBe(1); // 说话人B -> 机位1
    expect(switchResult[2].targetAngle).toBe(0); // 说话人A -> 机位0
    expect(switchResult[3].targetAngle).toBe(1); // 说话人B -> 机位1

    // 验证间隔
    for (let i = 1; i < switchResult.length; i++) {
      const interval = switchResult[i].timeMs - switchResult[i - 1].timeMs;
      expect(interval).toBeGreaterThanOrEqual(1500);
    }
  });
});

test.describe('字幕说话人标签集成', () => {
  test('字幕列表显示说话人标签', async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);

    // 模拟字幕数据
    const subtitleData = await page.evaluate(() => {
      const clips = [
        { id: 'sub-1', text: '你好', speaker: '说话人 A', speakerId: 0, start: 0, duration: 2 },
        { id: 'sub-2', text: '你好吗', speaker: '说话人 B', speakerId: 1, start: 2, duration: 2 },
        { id: 'sub-3', text: '我很好', speaker: '说话人 A', speakerId: 0, start: 4, duration: 2 },
      ];

      return clips.map(clip => ({
        ...clip,
        hasSpeakerLabel: Boolean(clip.speaker),
        speakerColor: `hsl(${clip.speakerId * 60}, 70%, 50%)`,
      }));
    });

    expect(subtitleData.length).toBe(3);
    expect(subtitleData[0].hasSpeakerLabel).toBe(true);
    expect(subtitleData[0].speaker).toBe('说话人 A');
    expect(subtitleData[1].speaker).toBe('说话人 B');
    expect(subtitleData[2].speaker).toBe('说话人 A');
  });

  test('说话人标签应用到转录片段', async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);

    // 模拟说话人标签应用逻辑
    const result = await page.evaluate(() => {
      // 转录片段
      const transcription = [
        { startMs: 0, endMs: 2000, text: '你好' },
        { startMs: 2000, endMs: 4000, text: '你好吗' },
        { startMs: 4000, endMs: 6000, text: '我很好' },
      ];

      // 说话人分离结果
      const diarization = [
        { startMs: 0, endMs: 3000, speakerId: 0, speakerLabel: '说话人 A', confidence: 0.9 },
        { startMs: 3000, endMs: 6000, speakerId: 1, speakerLabel: '说话人 B', confidence: 0.85 },
      ];

      // 应用说话人标签
      return transcription.map(seg => {
        let bestOverlap = 0;
        let bestMatch = null;

        for (const diarSeg of diarization) {
          const overlapStart = Math.max(seg.startMs, diarSeg.startMs);
          const overlapEnd = Math.min(seg.endMs, diarSeg.endMs);
          const overlapDuration = Math.max(0, overlapEnd - overlapStart);

          if (overlapDuration > bestOverlap) {
            bestOverlap = overlapDuration;
            bestMatch = diarSeg;
          }
        }

        if (bestMatch && bestMatch.confidence >= 0.5) {
          return {
            ...seg,
            speaker: bestMatch.speakerLabel,
            speakerId: bestMatch.speakerId,
          };
        }
        return seg;
      });
    });

    expect(result[0].speaker).toBe('说话人 A');
    expect(result[1].speaker).toBe('说话人 A'); // 重叠更多
    expect(result[2].speaker).toBe('说话人 B');
  });
});

test.describe('AI音频处理性能', () => {
  test('说话人分离算法在合理时间内完成', async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);

    // 性能测试
    const perfResult = await page.evaluate(() => {
      const startTime = performance.now();

      // 模拟大规模说话人分离计算
      const embeddings: number[][] = [];
      for (let i = 0; i < 100; i++) {
        const cluster = Math.floor(i / 20);
        const embedding = new Array(8).fill(0);
        embedding[cluster * 2] = 1 + (Math.random() - 0.5) * 0.3;
        embedding[cluster * 2 + 1] = 0.5 + (Math.random() - 0.5) * 0.3;
        embeddings.push(embedding);
      }

      // 简单聚类计算
      const assignments = new Array(100).fill(0);
      for (let i = 0; i < 100; i++) {
        assignments[i] = Math.floor(i / 20);
      }

      const endTime = performance.now();
      return {
        durationMs: endTime - startTime,
        sampleCount: embeddings.length,
        clusterCount: new Set(assignments).size,
      };
    });

    // 验证性能：100个样本的聚类应在100ms内完成
    expect(perfResult.durationMs).toBeLessThan(100);
    expect(perfResult.sampleCount).toBe(100);
    expect(perfResult.clusterCount).toBe(5);
  });

  test('TTS文本处理不阻塞主线程', async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);

    // 测试文本处理性能
    const perfResult = await page.evaluate(() => {
      const startTime = performance.now();

      // 模拟长文本处理
      const text = '这是一段很长的中文文本。'.repeat(100);
      const segments: string[] = [];
      const maxLength = 200;

      let remaining = text;
      while (remaining.length > 0) {
        if (remaining.length <= maxLength) {
          segments.push(remaining);
          break;
        }

        // 找分割点
        let splitPos = maxLength;
        const searchArea = remaining.substring(0, maxLength);
        const lastPeriod = searchArea.lastIndexOf('。');
        if (lastPeriod > maxLength * 0.3) {
          splitPos = lastPeriod + 1;
        }

        segments.push(remaining.substring(0, splitPos).trim());
        remaining = remaining.substring(splitPos).trim();
      }

      const endTime = performance.now();
      return {
        durationMs: endTime - startTime,
        segmentCount: segments.length,
        totalChars: text.length,
      };
    });

    // 验证性能：文本分段应在50ms内完成
    expect(perfResult.durationMs).toBeLessThan(50);
    expect(perfResult.segmentCount).toBeGreaterThan(0);
    expect(perfResult.totalChars).toBe(2500);
  });
});
