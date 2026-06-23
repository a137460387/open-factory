import { describe, expect, it } from 'vitest';
import {
  STRESS_SCENARIOS,
  generateMegaClipsProject,
  generateLongTimelineProject,
  generateMassKeyframesProject,
  generateDeepNestedProject,
  generateStressScenario,
  measurePerfMetrics,
  compareWithBaseline,
  buildStressReport,
  serializeStressReport,
  createIsolatedProjectContext,
  type StressBaseline,
  type StressPerfMetrics,
} from '../src';

describe('STRESS_SCENARIOS', () => {
  it('defines exactly 4 scenarios', () => {
    expect(STRESS_SCENARIOS).toHaveLength(4);
  });

  it('each scenario has id, label, and description', () => {
    for (const s of STRESS_SCENARIOS) {
      expect(s.id).toBeTruthy();
      expect(s.label).toBeTruthy();
      expect(s.description).toBeTruthy();
    }
  });
});

describe('generateMegaClipsProject', () => {
  it('generates 520+ clips by default', () => {
    const { project } = generateMegaClipsProject();
    const totalClips = project.timeline.tracks.reduce((sum, t) => sum + t.clips.length, 0);
    expect(totalClips).toBeGreaterThanOrEqual(520);
  });

  it('respects custom clip count', () => {
    const { project } = generateMegaClipsProject(10);
    const totalClips = project.timeline.tracks.reduce((sum, t) => sum + t.clips.length, 0);
    expect(totalClips).toBe(10);
  });

  it('clips have sequential start times', () => {
    const { project } = generateMegaClipsProject(5);
    const clips = project.timeline.tracks[0].clips;
    for (let i = 1; i < clips.length; i++) {
      expect(clips[i].start).toBeGreaterThan(clips[i - 1].start);
    }
  });
});

describe('generateLongTimelineProject', () => {
  it('generates timeline exceeding 4 hours', () => {
    const { project } = generateLongTimelineProject();
    const totalClips = project.timeline.tracks.reduce((sum, t) => sum + t.clips.length, 0);
    const totalDuration = totalClips * 60;
    expect(totalDuration).toBeGreaterThanOrEqual(4 * 3600);
  });

  it('respects custom hours target', () => {
    const { project } = generateLongTimelineProject(0.5);
    const totalClips = project.timeline.tracks.reduce((sum, t) => sum + t.clips.length, 0);
    expect(totalClips).toBe(Math.ceil(0.5 * 3600 / 60));
  });
});

describe('generateMassKeyframesProject', () => {
  it('generates 120+ keyframes by default', () => {
    const { project, clipId } = generateMassKeyframesProject();
    const clip = project.timeline.tracks[0].clips.find((c) => c.id === clipId) as any;
    expect(clip?.keyframes?.length).toBeGreaterThanOrEqual(120);
  });

  it('respects custom keyframe count', () => {
    const { project, clipId } = generateMassKeyframesProject(50);
    const clip = project.timeline.tracks[0].clips.find((c) => c.id === clipId) as any;
    expect(clip?.keyframes?.length).toBe(50);
  });

  it('keyframe times span the clip duration', () => {
    const { project, clipId } = generateMassKeyframesProject(10);
    const clip = project.timeline.tracks[0].clips.find((c) => c.id === clipId) as any;
    const kfs = clip?.keyframes;
    expect(kfs[0].time).toBe(0);
    expect(kfs[kfs.length - 1].time).toBe(clip.duration);
  });
});

describe('generateDeepNestedProject', () => {
  it('generates 5 levels of nesting by default', () => {
    const { sequenceIds } = generateDeepNestedProject();
    expect(sequenceIds).toHaveLength(5);
  });

  it('respects custom depth', () => {
    const { sequenceIds } = generateDeepNestedProject(3);
    expect(sequenceIds).toHaveLength(3);
  });

  it('project has sequences and activeSequenceId', () => {
    const { project, sequenceIds } = generateDeepNestedProject();
    expect(project.sequences).toBeDefined();
    expect(project.sequences!.length).toBe(sequenceIds.length);
    expect(project.activeSequenceId).toBe(sequenceIds[sequenceIds.length - 1]);
  });
});

describe('generateStressScenario', () => {
  it.each(['mega-clips', 'long-timeline', 'mass-keyframes', 'deep-nested'] as const)(
    'generates valid project for %s',
    (scenarioId) => {
      const { project, metrics } = generateStressScenario(scenarioId);
      expect(project).toBeDefined();
      expect(project.timeline).toBeDefined();
      expect(metrics.clipCount).toBeGreaterThan(0);
    },
  );

  it('mega-clips scenario has 500+ clips', () => {
    const { metrics } = generateStressScenario('mega-clips');
    expect(metrics.clipCount).toBeGreaterThanOrEqual(500);
  });

  it('long-timeline scenario has 4h+ duration', () => {
    const { metrics } = generateStressScenario('long-timeline');
    expect(metrics.totalDurationSec).toBeGreaterThanOrEqual(4 * 3600);
  });

  it('mass-keyframes scenario has 100+ keyframes', () => {
    const { metrics } = generateStressScenario('mass-keyframes');
    expect(metrics.maxKeyframesPerClip).toBeGreaterThanOrEqual(100);
  });

  it('deep-nested scenario has 5 levels', () => {
    const { metrics } = generateStressScenario('deep-nested');
    expect(metrics.nestingDepth).toBe(5);
  });
});

describe('measurePerfMetrics', () => {
  it('merges base metrics with perf values', () => {
    const base = { clipCount: 520, totalDurationSec: 1040, maxKeyframesPerClip: 0, nestingDepth: 1 };
    const result = measurePerfMetrics(base, 123.456, 512.789, 42.123);
    expect(result.clipCount).toBe(520);
    expect(result.renderTimeMs).toBe(123.456);
    expect(result.memoryUsageMb).toBe(512.789);
    expect(result.exportEstimateSec).toBe(42.123);
  });
});

describe('compareWithBaseline', () => {
  const metrics: StressPerfMetrics = {
    clipCount: 520, totalDurationSec: 1040, maxKeyframesPerClip: 0, nestingDepth: 1,
    renderTimeMs: 200, memoryUsageMb: 512, exportEstimateSec: 30,
  };

  it('degrades to only-show-current when baseline is undefined', () => {
    const verdicts = compareWithBaseline(metrics, undefined);
    expect(verdicts).toHaveLength(3);
    for (const v of verdicts) {
      expect(v.baseline).toBeUndefined();
      expect(v.degraded).toBe(false);
    }
  });

  it('reports not degraded when within threshold', () => {
    const baseline: StressBaseline = { renderTimeMs: 200, memoryUsageMb: 512, exportEstimateSec: 30 };
    const verdicts = compareWithBaseline(metrics, baseline);
    for (const v of verdicts) {
      expect(v.degraded).toBe(false);
    }
  });

  it('reports degraded when exceeding threshold', () => {
    const baseline: StressBaseline = { renderTimeMs: 100, memoryUsageMb: 200, exportEstimateSec: 10 };
    const verdicts = compareWithBaseline(metrics, baseline);
    const renderVerdict = verdicts.find((v) => v.metric === 'renderTimeMs')!;
    expect(renderVerdict.degraded).toBe(true);
    expect(renderVerdict.baseline).toBe(100);
  });

  it('does not flag degradation just under threshold', () => {
    const baseline: StressBaseline = { renderTimeMs: 134, memoryUsageMb: 342, exportEstimateSec: 20 };
    const verdicts = compareWithBaseline(metrics, baseline);
    for (const v of verdicts) {
      expect(v.degraded).toBe(false);
    }
  });
});

describe('buildStressReport', () => {
  it('builds a complete report', () => {
    const metrics = measurePerfMetrics(
      { clipCount: 520, totalDurationSec: 1040, maxKeyframesPerClip: 0, nestingDepth: 1 },
      200, 512, 30,
    );
    const report = buildStressReport('mega-clips', Date.now() - 1000, metrics, undefined, '3.9.0');
    expect(report.scenarioId).toBe('mega-clips');
    expect(report.version).toBe('3.9.0');
    expect(report.completedAt).toBeGreaterThanOrEqual(report.startedAt);
    expect(report.verdicts).toHaveLength(3);
  });
});

describe('serializeStressReport', () => {
  it('produces valid JSON', () => {
    const metrics = measurePerfMetrics(
      { clipCount: 10, totalDurationSec: 20, maxKeyframesPerClip: 0, nestingDepth: 1 },
      50, 128, 10,
    );
    const report = buildStressReport('mega-clips', Date.now(), metrics, undefined, '3.9.0');
    const json = serializeStressReport(report);
    const parsed = JSON.parse(json);
    expect(parsed.scenarioId).toBe('mega-clips');
  });
});

describe('createIsolatedProjectContext', () => {
  it('returns result and cleanup function', () => {
    const { result, cleanup } = createIsolatedProjectContext(() => ({ value: 42 }));
    expect(result.value).toBe(42);
    expect(typeof cleanup).toBe('function');
  });

  it('cleanup does not throw', () => {
    const { cleanup } = createIsolatedProjectContext(() => null);
    expect(() => cleanup()).not.toThrow();
  });
});
