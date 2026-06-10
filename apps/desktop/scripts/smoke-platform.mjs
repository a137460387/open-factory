import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function normalizePath(value) {
  return String(value).replace(/\\/g, '/');
}

export function commandForPlatform(command) {
  if (process.platform !== 'win32') {
    return command;
  }
  if (command === 'ffmpeg') {
    return 'ffmpeg.exe';
  }
  if (command === 'ffprobe') {
    return 'ffprobe.exe';
  }
  if (command === 'powershell') {
    return 'powershell.exe';
  }
  return command;
}

export function releaseExecutablePath(desktopDir) {
  const releaseDir = join(desktopDir, 'src-tauri', 'target', 'release');
  const candidates =
    process.platform === 'win32'
      ? [join(releaseDir, 'open-factory-desktop.exe')]
      : process.platform === 'darwin'
        ? [
            join(releaseDir, 'bundle', 'macos', 'open-factory.app', 'Contents', 'MacOS', 'open-factory'),
            join(releaseDir, 'bundle', 'macos', 'open-factory.app', 'Contents', 'MacOS', 'open-factory-desktop'),
            join(releaseDir, 'open-factory-desktop')
          ]
        : [join(releaseDir, 'open-factory-desktop')];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

export function defaultDrawtextFontPath() {
  const candidates =
    process.platform === 'win32'
      ? ['C:/Windows/Fonts/arial.ttf', 'C:/Windows/Fonts/msyh.ttc', 'C:/Windows/Fonts/segoeui.ttf']
      : process.platform === 'darwin'
        ? ['/System/Library/Fonts/Helvetica.ttc', '/System/Library/Fonts/Supplemental/Arial.ttf']
        : ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/dejavu/DejaVuSans.ttf'];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

export function shouldSkipNativeAppSmoke(smokeName, reportPath) {
  if (process.platform === 'win32') {
    return false;
  }
  writeJsonReport(reportPath, {
    success: true,
    skipped: true,
    smokeName,
    platform: process.platform,
    reason: 'Native app smoke launch is exercised on Windows; this platform branch validates script setup without launching the packaged app.'
  });
  return true;
}

export async function findResidualFfmpegProcesses(matchPath) {
  const needle = normalizePath(matchPath).toLowerCase();
  if (process.platform === 'win32') {
    const command = "Get-CimInstance Win32_Process -Filter \"Name = 'ffmpeg.exe'\" | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress";
    const output = await capture('powershell', ['-NoProfile', '-Command', command]);
    if (!output.trim()) {
      return [];
    }
    const parsed = JSON.parse(output);
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    return rows
      .filter((row) => normalizePath(row.CommandLine ?? '').toLowerCase().includes(needle))
      .map((row) => ({ pid: row.ProcessId, commandLine: row.CommandLine }));
  }

  const output = await capture('ps', ['-eo', 'pid=,comm=,args=']);
  return output
    .split(/\r?\n/)
    .filter((line) => /\bffmpeg\b/.test(line) && normalizePath(line).toLowerCase().includes(needle))
    .map((line) => ({ commandLine: line.trim() }));
}

export function requireReleaseExecutable(executable, commandHint) {
  if (existsSync(executable)) {
    return;
  }
  console.error(`Tauri release executable was not found: ${executable}`);
  console.error(`Run ${commandHint} before this smoke.`);
  process.exit(1);
}

export function spawnProcess(command, args, options = {}) {
  return spawn(commandForPlatform(command), args, options);
}

export function waitForExitOrKill(childProcess, timeoutMs) {
  return new Promise((resolveExit) => {
    const timer = setTimeout(() => {
      childProcess.kill();
      resolveExit({ exitCode: 1, timedOut: true });
    }, timeoutMs);
    childProcess.on('exit', (code) => {
      clearTimeout(timer);
      resolveExit({ exitCode: code ?? 1, timedOut: false });
    });
  });
}

export function run(command, args) {
  return new Promise((resolveExit) => {
    const child = spawnProcess(command, args, { stdio: 'inherit' });
    child.on('error', () => resolveExit(1));
    child.on('exit', (code) => resolveExit(code ?? 1));
  });
}

export function runChecked(command, args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawnProcess(command, args, { stdio: 'inherit' });
    child.on('error', rejectRun);
    child.on('exit', (code) => {
      if (code === 0) {
        resolveRun();
      } else {
        rejectRun(new Error(`${command} exited with status ${code}`));
      }
    });
  });
}

export function capture(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawnProcess(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || `${command} exited with ${code}`));
      }
    });
  });
}

export function captureCombined(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawnProcess(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(output || `${command} exited with ${code}`));
      }
    });
  });
}

export function runCollectStdout(command, args) {
  return new Promise((resolveRun, rejectRun) => {
    const chunks = [];
    const stderr = [];
    const child = spawnProcess(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', rejectRun);
    child.on('exit', (code) => {
      if (code === 0) {
        resolveRun(Buffer.concat(chunks));
      } else {
        rejectRun(new Error(`${command} exited with status ${code}: ${Buffer.concat(stderr).toString('utf8')}`));
      }
    });
  });
}

export function writeJsonReport(reportPath, report) {
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}
