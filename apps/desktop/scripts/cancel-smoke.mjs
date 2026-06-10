import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findResidualFfmpegProcesses, releaseExecutablePath, requireReleaseExecutable, run, shouldSkipNativeAppSmoke, spawnProcess, waitForExitOrKill } from './smoke-platform.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopDir = resolve(scriptDir, '..');
const smokeDir = join(tmpdir(), 'open-factory-cancel-smoke');
const fixturePath = join(smokeDir, 'cancel-source.mp4');
const outputPath = join(smokeDir, 'cancel-output.mp4');
const reportPath = join(desktopDir, 'src-tauri', 'target', 'open-factory-cancel-smoke-report.json');

if (shouldSkipNativeAppSmoke('smoke:cancel', reportPath)) {
  process.exit(0);
}
const executable = releaseExecutablePath(desktopDir);
requireReleaseExecutable(executable, 'bun run tauri:build');

mkdirSync(smokeDir, { recursive: true });
rmSync(reportPath, { force: true });
rmSync(fixturePath, { force: true });
rmSync(outputPath, { force: true });

await createCancelFixture(fixturePath);

const child = spawnProcess(executable, [], {
  env: {
    ...process.env,
    OPEN_FACTORY_CANCEL_SMOKE: '1',
    OPEN_FACTORY_CANCEL_SMOKE_MEDIA: fixturePath,
    OPEN_FACTORY_CANCEL_SMOKE_OUTPUT: outputPath,
    OPEN_FACTORY_CANCEL_SMOKE_REPORT: reportPath
  },
  stdio: 'inherit'
});

const result = await waitForExitOrKill(child, 180_000);

if (!existsSync(reportPath)) {
  console.error(`Cancel smoke report was not written: ${reportPath}`);
  process.exit(1);
}

const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const residualFfmpegProcesses = await findResidualFfmpegProcesses(smokeDir);
report.residualFfmpegProcesses = residualFfmpegProcesses;
report.outputExistsAfterScript = existsSync(outputPath);
report.outputSizeAfterScript = existsSync(outputPath) ? statSync(outputPath).size : 0;
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

const passed =
  result.exitCode === 0 &&
  !result.timedOut &&
  report.success === true &&
  report.exportStartedEventSeen === true &&
  report.cancelButtonClicked === true &&
  report.runnerInactiveAfterCancel === true &&
  report.partialOutputExistsAfterCancel === false &&
  report.finalOutputExists === true &&
  report.outputExistsAfterScript === true &&
  report.outputSizeAfterScript > 0 &&
  residualFfmpegProcesses.length === 0;

if (!passed) {
  process.exit(1);
}

async function createCancelFixture(outputPath) {
  const args = [
    '-hide_banner',
    '-y',
    '-f',
    'lavfi',
    '-i',
    'testsrc2=size=960x540:rate=30:duration=30',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:sample_rate=44100:duration=30',
    '-shortest',
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-movflags',
    '+faststart',
    outputPath
  ];
  const exitCode = await run('ffmpeg', args);
  if (exitCode !== 0 || !existsSync(outputPath)) {
    throw new Error('Unable to create cancel smoke fixture with ffmpeg.');
  }
}
