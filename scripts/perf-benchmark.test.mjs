import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { createPerfBenchmarkProject, createPerformanceBenchmarkReport } from './perf-benchmark.mjs';

describe('perf benchmark script', () => {
  it('generates a synthetic 500 clip project across tracks', () => {
    const project = createPerfBenchmarkProject({ clipCount: 500, trackCount: 5 });

    expect(project.clipCount).toBe(500);
    expect(project.tracks).toHaveLength(5);
    expect(project.tracks.flatMap((track) => track.clips)).toHaveLength(500);
  });

  it('reports scroll, zoom, and playback fps metrics', () => {
    const report = createPerformanceBenchmarkReport({ clipCount: 500 });

    expect(report.metrics.scrollFps).toBeGreaterThan(0);
    expect(report.metrics.zoomFps).toBeGreaterThan(0);
    expect(report.metrics.playbackFps).toBeGreaterThan(0);
    expect(report.metrics.renderedClipCount).toBeGreaterThan(0);
  });

  it('is executable from node and prints fps data', () => {
    const output = execFileSync(process.execPath, ['scripts/perf-benchmark.mjs', '--clip-count=500', '--json'], { encoding: 'utf8' });
    const report = JSON.parse(output);

    expect(report.scenario.clipCount).toBe(500);
    expect(report.metrics.scrollFps).toBeGreaterThan(0);
  });
});
