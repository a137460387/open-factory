#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT_DIR = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const WORK_DIR = path.join(ROOT_DIR, '.tmp', 'media-compat');
const DEFAULT_REPORT_PATH = path.join(ROOT_DIR, 'media-compat-report.json');
const FIXTURE_DURATION_SECONDS = 2;
const REQUIRED_CASE_IDS = new Set(['h264-mp4', 'h265-mp4', 'aac-m4a']);

export const MEDIA_COMPAT_CASES = Object.freeze([
  {
    id: 'h264-mp4',
    label: 'H.264/MP4',
    inputFileName: 'h264.mp4',
    kind: 'video',
    required: true,
    generateArgs: (inputPath) => [
      '-y',
      '-f',
      'lavfi',
      '-i',
      videoSource(),
      '-f',
      'lavfi',
      '-i',
      audioSource(),
      '-shortest',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-movflags',
      '+faststart',
      inputPath
    ]
  },
  {
    id: 'h265-mp4',
    label: 'H.265/MP4',
    inputFileName: 'h265.mp4',
    kind: 'video',
    required: true,
    generateArgs: (inputPath) => [
      '-y',
      '-f',
      'lavfi',
      '-i',
      videoSource(),
      '-f',
      'lavfi',
      '-i',
      audioSource(),
      '-shortest',
      '-c:v',
      'libx265',
      '-tag:v',
      'hvc1',
      '-pix_fmt',
      'yuv420p',
      '-x265-params',
      'log-level=error',
      '-c:a',
      'aac',
      inputPath
    ]
  },
  {
    id: 'vp9-webm',
    label: 'VP9/WebM',
    inputFileName: 'vp9.webm',
    kind: 'video',
    required: false,
    generateArgs: (inputPath) => [
      '-y',
      '-f',
      'lavfi',
      '-i',
      videoSource(),
      '-f',
      'lavfi',
      '-i',
      audioSource(),
      '-shortest',
      '-c:v',
      'libvpx-vp9',
      '-b:v',
      '1M',
      '-c:a',
      'libopus',
      inputPath
    ]
  },
  {
    id: 'prores-mov',
    label: 'ProRes/MOV',
    inputFileName: 'prores.mov',
    kind: 'video',
    required: false,
    generateArgs: (inputPath) => [
      '-y',
      '-f',
      'lavfi',
      '-i',
      videoSource(),
      '-c:v',
      'prores_ks',
      '-profile:v',
      '3',
      '-pix_fmt',
      'yuv422p10le',
      '-an',
      inputPath
    ]
  },
  {
    id: 'aac-m4a',
    label: 'AAC/M4A',
    inputFileName: 'audio.m4a',
    kind: 'audio',
    required: true,
    generateArgs: (inputPath) => ['-y', '-f', 'lavfi', '-i', audioSource(), '-c:a', 'aac', '-b:a', '128k', inputPath]
  },
  {
    id: 'flac',
    label: 'FLAC',
    inputFileName: 'audio.flac',
    kind: 'audio',
    required: false,
    generateArgs: (inputPath) => ['-y', '-f', 'lavfi', '-i', audioSource(), '-c:a', 'flac', inputPath]
  }
]);

export async function runMediaCompatTest(options = {}) {
  const workDir = options.workDir ?? WORK_DIR;
  const reportPath = options.reportPath ?? DEFAULT_REPORT_PATH;
  await ensureFfmpegAvailable();
  await rm(workDir, { recursive: true, force: true });
  await mkdir(workDir, { recursive: true });

  const cases = [];
  for (const testCase of MEDIA_COMPAT_CASES) {
    cases.push(await runCompatCase(testCase, workDir));
  }

  const report = createMediaCompatReport({ cases, workDir });
  assertMediaCompatReport(report);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return report;
}

export function createMediaCompatReport({ cases, workDir, generatedAt = new Date().toISOString() }) {
  const supported = cases.filter((testCase) => testCase.supported);
  const required = cases.filter((testCase) => REQUIRED_CASE_IDS.has(testCase.id));
  return {
    generatedAt,
    workDir,
    cases,
    summary: {
      total: cases.length,
      supported: supported.length,
      passed: cases.filter((testCase) => testCase.passed).length,
      requiredPassed: required.every((testCase) => testCase.passed),
      allSupportedPassed: supported.every((testCase) => testCase.passed)
    }
  };
}

export function assertMediaCompatReport(report) {
  const failures = [];
  for (const testCase of report.cases ?? []) {
    if (testCase.required && !testCase.passed) {
      failures.push(`${testCase.label} required compatibility failed: ${testCase.error ?? 'unknown error'}`);
    }
    if (testCase.supported && !testCase.passed) {
      failures.push(`${testCase.label} supported compatibility failed: ${testCase.error ?? 'unknown error'}`);
    }
  }
  if (!report.summary?.requiredPassed) {
    failures.push('required formats did not all pass');
  }
  if (!report.summary?.allSupportedPassed) {
    failures.push('not all supported formats passed');
  }
  if (failures.length > 0) {
    throw new Error(`Media compatibility failed: ${failures.join('; ')}`);
  }
}

async function runCompatCase(testCase, workDir) {
  const inputPath = path.join(workDir, testCase.inputFileName);
  const outputPath = path.join(workDir, `${testCase.id}-export.mp4`);
  const base = {
    id: testCase.id,
    label: testCase.label,
    required: Boolean(testCase.required),
    kind: testCase.kind,
    inputPath,
    outputPath,
    supported: true,
    passed: false
  };

  try {
    await run('ffmpeg', testCase.generateArgs(inputPath));
  } catch (error) {
    return {
      ...base,
      supported: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }

  try {
    const imported = await probeMedia(inputPath);
    const timeline = createSyntheticTimeline(testCase, imported);
    await run('ffmpeg', buildExportArgs(testCase, inputPath, outputPath, imported.durationSeconds));
    const output = await probeMedia(outputPath);
    const outputStat = await stat(outputPath);
    const durationMatches = Math.abs(output.durationSeconds - Math.max(0.1, imported.durationSeconds)) <= 0.6;
    return {
      ...base,
      import: imported,
      timeline,
      export: {
        path: outputPath,
        exists: existsSync(outputPath),
        size: outputStat.size,
        durationSeconds: output.durationSeconds,
        durationMatches
      },
      passed: existsSync(outputPath) && outputStat.size > 0 && durationMatches
    };
  } catch (error) {
    return {
      ...base,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function createSyntheticTimeline(testCase, imported) {
  const trackType = testCase.kind === 'audio' ? 'audio' : 'video';
  return {
    imported: true,
    trackType,
    trackCount: 1,
    clipCount: 1,
    durationSeconds: imported.durationSeconds
  };
}

function buildExportArgs(testCase, inputPath, outputPath, durationSeconds) {
  const duration = formatSeconds(Math.max(0.1, durationSeconds));
  if (testCase.kind === 'audio') {
    return [
      '-y',
      '-f',
      'lavfi',
      '-i',
      `color=c=black:s=640x360:r=30:d=${duration}`,
      '-i',
      inputPath,
      '-shortest',
      '-map',
      '0:v:0',
      '-map',
      '1:a:0',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      outputPath
    ];
  }
  return [
    '-y',
    '-i',
    inputPath,
    '-t',
    duration,
    '-map',
    '0:v:0',
    '-map',
    '0:a:0?',
    '-vf',
    'scale=640:360,fps=30',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    outputPath
  ];
}

async function probeMedia(filePath) {
  const stdout = await runCollectStdout('ffprobe', [
    '-v',
    'error',
    '-show_streams',
    '-show_entries',
    'format=duration',
    '-of',
    'json',
    filePath
  ]);
  const parsed = JSON.parse(stdout);
  const durationSeconds = Number(parsed.format?.duration);
  const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
  return {
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : FIXTURE_DURATION_SECONDS,
    hasVideo: streams.some((stream) => stream.codec_type === 'video'),
    hasAudio: streams.some((stream) => stream.codec_type === 'audio'),
    codecs: streams.map((stream) => ({ type: stream.codec_type, codec: stream.codec_name }))
  };
}

async function ensureFfmpegAvailable() {
  await runCollectStdout('ffmpeg', ['-version']);
  await runCollectStdout('ffprobe', ['-version']);
}

function videoSource() {
  return `testsrc2=size=640x360:rate=30:duration=${formatSeconds(FIXTURE_DURATION_SECONDS)}`;
}

function audioSource() {
  return `sine=frequency=440:sample_rate=44100:duration=${formatSeconds(FIXTURE_DURATION_SECONDS)}`;
}

function formatSeconds(value) {
  return Number(value).toFixed(3);
}

function run(command, args) {
  return runCollectStdout(command, args).then(() => undefined);
}

function runCollectStdout(command, args) {
  return new Promise((resolve, reject) => {
    execFile(commandForPlatform(command), args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`${command} ${args.join(' ')} failed\n${stderr || error.message}`));
        return;
      }
      resolve(stdout);
    });
  });
}

function commandForPlatform(command) {
  if (process.platform === 'win32' && !command.endsWith('.exe')) {
    return `${command}.exe`;
  }
  return command;
}

function isMainModule() {
  const entry = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
  return import.meta.url === entry;
}

if (isMainModule()) {
  runMediaCompatTest()
    .then((report) => {
      console.log(JSON.stringify(report.summary, null, 2));
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
