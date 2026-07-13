/**
 * 硬件加速解码性能基准测试
 *
 * 对比硬件加速与软件解码在不同分辨率/码率下的性能差异。
 * 直接调用 FFmpeg CLI 进行基准测试（与 hw_decode.rs 使用相同的解码方式）。
 *
 * 用法:
 *   node scripts/hw-decode-benchmark.mjs [--video=<path>] [--frames=10] [--report=<path>]
 *
 * 输出:
 *   - 每种解码模式的平均帧解码时间
 *   - FPS 对比
 *   - 性能提升百分比
 *   - JSON 报告文件
 */

import { writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const DEFAULT_REPORT_PATH = path.join(ROOT_DIR, 'hw-decode-benchmark-report.json');
const DEFAULT_FRAME_COUNT = 10;

// 硬件加速后端配置
const HW_BACKENDS = [
  { name: 'software', hwaccel: '', hwaccelOutputFormat: '', label: '软件解码' },
  { name: 'cuda', hwaccel: 'cuda', hwaccelOutputFormat: 'cuda', label: 'CUDA (NVIDIA)' },
  { name: 'vaapi', hwaccel: 'vaapi', hwaccelOutputFormat: 'vaapi', label: 'VAAPI (AMD/Intel Linux)' },
  { name: 'qsv', hwaccel: 'qsv', hwaccelOutputFormat: 'qsv', label: 'QuickSync (Intel)' },
  { name: 'd3d11va', hwaccel: 'd3d11va', hwaccelOutputFormat: 'd3d11va', label: 'D3D11VA (Windows)' },
  { name: 'videotoolbox', hwaccel: 'videotoolbox', hwaccelOutputFormat: 'videotoolbox', label: 'VideoToolbox (macOS)' },
];

/**
 * 生成测试用的合成视频（如果未提供视频文件）
 */
function generateTestVideo(outputPath, resolution, durationSec = 5) {
  const [width, height] = resolution.split('x');
  const cmd = [
    'ffmpeg', '-y',
    '-f', 'lavfi', '-i', `testsrc2=size=${width}x${height}:rate=30:duration=${durationSec}`,
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '18',
    '-pix_fmt', 'yuv420p',
    outputPath
  ].join(' ');

  try {
    execSync(cmd, { stdio: 'pipe', timeout: 30000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * 使用指定解码模式解码单帧并测量耗时
 */
function decodeSingleFrame(videoPath, backend, timestamp) {
  const args = [];

  // 添加硬件加速参数
  if (backend.hwaccel) {
    args.push('-hwaccel', backend.hwaccel);
    args.push('-hwaccel_output_format', backend.hwaccelOutputFormat);
  }

  args.push('-ss', String(timestamp));
  args.push('-i', videoPath);
  args.push('-vframes', '1');
  args.push('-f', 'rawvideo');
  args.push('-pix_fmt', 'rgba');
  args.push('-');

  const cmd = `ffmpeg ${args.map(a => `"${a}"`).join(' ')}`;

  try {
    const start = performance.now();
    execSync(cmd, { stdio: 'pipe', timeout: 30000 });
    const elapsed = performance.now() - start;
    return { success: true, elapsedMs: elapsed };
  } catch (error) {
    return { success: false, elapsedMs: 0, error: error.message?.slice(0, 100) };
  }
}

/**
 * 获取视频信息
 */
function getVideoInfo(videoPath) {
  try {
    const output = execSync(
      `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration,codec_name,r_frame_rate,bit_rate -of json "${videoPath}"`,
      { encoding: 'utf8', timeout: 10000 }
    );
    const info = JSON.parse(output);
    const stream = info.streams?.[0];
    if (!stream) return null;

    const [num, den] = (stream.r_frame_rate || '30/1').split('/').map(Number);
    return {
      width: stream.width,
      height: stream.height,
      duration: parseFloat(stream.duration || '0'),
      codec: stream.codec_name,
      frameRate: den > 0 ? num / den : 30,
      bitRate: parseInt(stream.bit_rate || '0', 10),
    };
  } catch {
    return null;
  }
}

/**
 * 检测可用的硬件加速后端
 */
function detectAvailableBackends() {
  const available = [];

  // 软件解码始终可用
  available.push('software');

  // 检测 CUDA
  try {
    execSync('nvidia-smi', { stdio: 'pipe', timeout: 5000 });
    available.push('cuda');
  } catch { /* not available */ }

  // 检测 D3D11VA (Windows)
  if (process.platform === 'win32') {
    available.push('d3d11va');
  }

  // 检测 QuickSync
  if (process.platform === 'win32') {
    try {
      const output = execSync('wmic path win32_videocontroller get name', { encoding: 'utf8', timeout: 5000 });
      if (output.toLowerCase().includes('intel')) {
        available.push('qsv');
      }
    } catch { /* not available */ }
  }

  // 检测 VAAPI (Linux)
  if (process.platform === 'linux') {
    try {
      execSync('test -e /dev/dri/renderD128', { stdio: 'pipe', timeout: 5000 });
      available.push('vaapi');
    } catch { /* not available */ }
  }

  // 检测 VideoToolbox (macOS)
  if (process.platform === 'darwin') {
    available.push('videotoolbox');
  }

  return available;
}

/**
 * 对单个后端运行基准测试
 */
function runBackendBenchmark(videoPath, backend, frameCount, videoDuration) {
  const results = [];
  const maxTimestamp = Math.max(0, videoDuration - 0.1);

  for (let i = 0; i < frameCount; i++) {
    // 在视频的不同位置采样
    const timestamp = maxTimestamp > 0 ? (i / frameCount) * maxTimestamp : i * 0.5;
    const result = decodeSingleFrame(videoPath, backend, timestamp);
    results.push(result);
  }

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  if (successful.length === 0) {
    return {
      backend: backend.name,
      label: backend.label,
      available: false,
      successCount: 0,
      failCount: failed.length,
      avgDecodeMs: 0,
      minDecodeMs: 0,
      maxDecodeMs: 0,
      fps: 0,
      errorSample: failed[0]?.error || 'Unknown error',
    };
  }

  const times = successful.map(r => r.elapsedMs);
  const avgMs = times.reduce((a, b) => a + b, 0) / times.length;
  const minMs = Math.min(...times);
  const maxMs = Math.max(...times);

  return {
    backend: backend.name,
    label: backend.label,
    available: true,
    successCount: successful.length,
    failCount: failed.length,
    avgDecodeMs: round(avgMs, 2),
    minDecodeMs: round(minMs, 2),
    maxDecodeMs: round(maxMs, 2),
    fps: round(1000 / avgMs, 2),
  };
}

/**
 * 运行完整基准测试
 */
export async function runHwDecodeBenchmark(options = {}) {
  const frameCount = options.frameCount || DEFAULT_FRAME_COUNT;
  const videoPath = options.video;
  const resolutions = options.resolutions || ['1920x1080', '3840x2160'];
  const tempDir = path.join(ROOT_DIR, '.benchmark-temp');

  // 检测可用后端
  const availableBackendNames = detectAvailableBackends();
  const backendsToTest = HW_BACKENDS.filter(
    b => b.name === 'software' || availableBackendNames.includes(b.name)
  );

  console.log(`检测到可用后端: ${availableBackendNames.join(', ')}`);
  console.log(`将测试 ${backendsToTest.length} 种解码模式\n`);

  const allResults = [];

  for (const resolution of resolutions) {
    let testVideoPath = videoPath;

    // 如果未提供视频，生成合成测试视频
    if (!testVideoPath) {
      testVideoPath = path.join(tempDir, `test-${resolution.replace('x', 'x')}.mp4`);
      console.log(`生成 ${resolution} 测试视频...`);
      const generated = generateTestVideo(testVideoPath, resolution, 3);
      if (!generated) {
        console.log(`  跳过 ${resolution}: 无法生成测试视频`);
        continue;
      }
    }

    const videoInfo = getVideoInfo(testVideoPath);
    if (!videoInfo) {
      console.log(`  跳过: 无法读取视频信息`);
      continue;
    }

    console.log(`\n=== ${resolution} (${videoInfo.codec}, ${videoInfo.frameRate.toFixed(1)}fps) ===`);

    const resolutionResults = [];

    for (const backend of backendsToTest) {
      process.stdout.write(`  测试 ${backend.label}...`);
      const result = runBackendBenchmark(testVideoPath, backend, frameCount, videoInfo.duration);
      resolutionResults.push(result);

      if (result.available) {
        console.log(` ✓ ${result.avgDecodeMs}ms/帧 (${result.fps} FPS)`);
      } else {
        console.log(` ✗ 不可用`);
      }
    }

    // 计算性能对比
    const softwareResult = resolutionResults.find(r => r.backend === 'software');
    const comparisons = resolutionResults
      .filter(r => r.backend !== 'software' && r.available && softwareResult?.available)
      .map(hwResult => ({
        backend: hwResult.backend,
        label: hwResult.label,
        speedup: softwareResult.avgDecodeMs > 0
          ? round(softwareResult.avgDecodeMs / hwResult.avgDecodeMs, 2)
          : 0,
        timeSavedMs: round(softwareResult.avgDecodeMs - hwResult.avgDecodeMs, 2),
      }));

    allResults.push({
      resolution,
      videoCodec: videoInfo.codec,
      frameRate: videoInfo.frameRate,
      bitRate: videoInfo.bitRate,
      frameCount,
      backends: resolutionResults,
      comparisons,
    });
  }

  // 生成报告
  const report = {
    generatedAt: new Date().toISOString(),
    platform: process.platform,
    availableBackends: availableBackendNames,
    testFrames: frameCount,
    results: allResults,
    summary: generateSummary(allResults),
  };

  return report;
}

/**
 * 生成测试摘要
 */
function generateSummary(allResults) {
  const bestResults = [];

  for (const res of allResults) {
    const available = res.backends.filter(b => b.available);
    if (available.length === 0) continue;

    const best = available.reduce((a, b) => a.fps > b.fps ? a : b);
    const software = available.find(b => b.backend === 'software');

    bestResults.push({
      resolution: res.resolution,
      bestBackend: best.backend,
      bestLabel: best.label,
      bestFps: best.fps,
      softwareFps: software?.fps || 0,
      speedup: software && software.avgDecodeMs > 0
        ? round(software.avgDecodeMs / best.avgDecodeMs, 2)
        : 1,
    });
  }

  return bestResults;
}

function round(value, decimals = 2) {
  return Math.round(value * 10 ** decimals) / 10 ** decimals;
}

// CLI 入口
async function main() {
  const args = process.argv.slice(2);
  const options = {
    frameCount: DEFAULT_FRAME_COUNT,
    reportPath: DEFAULT_REPORT_PATH,
    resolutions: ['1920x1080', '3840x2160'],
  };

  for (const arg of args) {
    const [key, value] = arg.split('=');
    if (key === '--video') options.video = value;
    else if (key === '--frames') options.frameCount = parseInt(value, 10) || DEFAULT_FRAME_COUNT;
    else if (key === '--report') options.reportPath = value;
    else if (key === '--json') options.reportPath = undefined;
    else if (key === '--resolutions') options.resolutions = value.split(',');
  }

  console.log('=== 硬件加速解码性能基准测试 ===\n');

  const report = await runHwDecodeBenchmark(options);

  // 输出摘要
  console.log('\n=== 性能摘要 ===');
  for (const item of report.summary) {
    const speedupText = item.speedup > 1 ? ` (⚡ ${item.speedup}x 加速)` : '';
    console.log(`  ${item.resolution}: 最佳=${item.bestLabel} ${item.bestFps} FPS${speedupText}`);
  }

  // 写入报告
  if (options.reportPath) {
    await writeFile(options.reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`\n报告已保存: ${options.reportPath}`);
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
}

main().catch((error) => {
  console.error('基准测试失败:', error);
  process.exit(1);
});
