import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { releaseExecutablePath, requireReleaseExecutable, shouldSkipNativeAppSmoke, spawnProcess } from './smoke-platform.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopDir = resolve(scriptDir, '..');
const reportPath = join(desktopDir, 'src-tauri', 'target', 'open-factory-smoke-report.json');

if (shouldSkipNativeAppSmoke('smoke:tauri', reportPath)) {
  process.exit(0);
}
const executable = releaseExecutablePath(desktopDir);
requireReleaseExecutable(executable, 'bun run tauri:build');

rmSync(reportPath, { force: true });

const child = spawnProcess(executable, [], {
  env: {
    ...process.env,
    OPEN_FACTORY_SMOKE: '1',
    OPEN_FACTORY_SMOKE_REPORT: reportPath
  },
  stdio: 'inherit'
});

const exitCode = await new Promise((resolveExit) => {
  child.on('exit', (code) => resolveExit(code ?? 1));
});

if (!existsSync(reportPath)) {
  console.error(`Smoke report was not written: ${reportPath}`);
  process.exit(1);
}

const report = JSON.parse(readFileSync(reportPath, 'utf8'));
console.log(JSON.stringify(report, null, 2));

if (exitCode !== 0 || !report.windowExists || !report.ffmpegAvailable) {
  process.exit(1);
}
