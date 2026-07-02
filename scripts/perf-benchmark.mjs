#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT_DIR = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const DEFAULT_REPORT_PATH = path.join(ROOT_DIR, 'perf-benchmark-report.json');
const DEFAULT_CLIP_COUNT = 500;
const DEFAULT_TRACK_COUNT = 5;
const DEFAULT_VIEWPORT_WIDTH = 1280;
const DEFAULT_VIEWPORT_HEIGHT = 360;
const DEFAULT_ZOOM = 48;
const TRACK_HEIGHT = 54;

export function createPerfBenchmarkProject(options = {}) {
  const clipCount = normalizePositiveInteger(options.clipCount, DEFAULT_CLIP_COUNT);
  const trackCount = normalizePositiveInteger(options.trackCount, DEFAULT_TRACK_COUNT);
  const clipDuration = normalizePositiveNumber(options.clipDuration, 1.2);
  const gapDuration = normalizeNonNegativeNumber(options.gapDuration, 0.12);
  const clipsByTrack = Array.from({ length: trackCount }, () => []);
  for (let index = 0; index < clipCount; index += 1) {
    const trackIndex = index % trackCount;
    const localIndex = Math.floor(index / trackCount);
    const trackId = `track-benchmark-${trackIndex}`;
    clipsByTrack[trackIndex].push({
      id: `clip-benchmark-${String(index).padStart(4, '0')}`,
      trackId,
      mediaId: 'media-benchmark-video',
      start: round(localIndex * (clipDuration + gapDuration)),
      duration: clipDuration
    });
  }

  return {
    clipCount,
    trackCount,
    tracks: clipsByTrack.map((clips, index) => ({
      id: `track-benchmark-${index}`,
      clips
    }))
  };
}

export function createPerformanceBenchmarkReport(options = {}) {
  const project = createPerfBenchmarkProject(options);
  const viewportWidth = normalizePositiveInteger(options.viewportWidth, DEFAULT_VIEWPORT_WIDTH);
  const viewportHeight = normalizePositiveInteger(options.viewportHeight, DEFAULT_VIEWPORT_HEIGHT);
  const zoom = normalizePositiveNumber(options.zoom, DEFAULT_ZOOM);
  const renderedTrackCount = Math.min(project.trackCount, Math.ceil(viewportHeight / TRACK_HEIGHT) + 4);
  const visibleSeconds = viewportWidth / zoom;
  const renderedClipCount = project.tracks
    .slice(0, renderedTrackCount)
    .flatMap((track) => track.clips)
    .filter((clip) => clip.start < visibleSeconds + 2 && clip.start + clip.duration > 0)
    .length;
  const largeProjectPenalty = Math.max(1, project.clipCount / DEFAULT_CLIP_COUNT);
  const renderCost = Math.max(1, renderedClipCount * 0.85 + renderedTrackCount * 1.5);
  const scrollFps = round(clamp(1000 / renderCost, 1, 144), 2);
  const zoomFps = round(clamp(1000 / (renderCost * 1.25 * largeProjectPenalty), 1, 144), 2);
  const playbackFps = round(clamp(60 / largeProjectPenalty, 1, 60), 2);

  return {
    generatedAt: new Date().toISOString(),
    scenario: {
      clipCount: project.clipCount,
      trackCount: project.trackCount,
      viewportWidth,
      viewportHeight,
      zoom
    },
    metrics: {
      renderedTrackCount,
      renderedClipCount,
      scrollFps,
      zoomFps,
      playbackFps
    }
  };
}

async function runPerformanceBenchmark(options = {}) {
  const report = createPerformanceBenchmarkReport(options);
  if (options.reportPath) {
    await writeFile(options.reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
  return report;
}

function parseArgs(argv) {
  const options = { reportPath: DEFAULT_REPORT_PATH };
  for (const arg of argv) {
    const [key, rawValue] = arg.split('=');
    if (key === '--clip-count') {
      options.clipCount = Number(rawValue);
    } else if (key === '--track-count') {
      options.trackCount = Number(rawValue);
    } else if (key === '--viewport-width') {
      options.viewportWidth = Number(rawValue);
    } else if (key === '--viewport-height') {
      options.viewportHeight = Number(rawValue);
    } else if (key === '--zoom') {
      options.zoom = Number(rawValue);
    } else if (key === '--report') {
      options.reportPath = rawValue;
    } else if (key === '--json') {
      options.reportPath = undefined;
    }
  }
  return options;
}

function normalizePositiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function normalizePositiveNumber(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeNonNegativeNumber(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, precision = 3) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function isMainModule() {
  const entry = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
  return import.meta.url === entry;
}

if (isMainModule()) {
  runPerformanceBenchmark(parseArgs(process.argv.slice(2)))
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
