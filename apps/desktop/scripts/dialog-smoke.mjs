import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { releaseExecutablePath, requireReleaseExecutable, shouldSkipNativeAppSmoke, spawnProcess } from './smoke-platform.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopDir = resolve(scriptDir, '..');
const reportPath = join(desktopDir, 'src-tauri', 'target', 'open-factory-dialog-smoke-report.json');
const title = 'Open Factory Dialog Smoke';

if (shouldSkipNativeAppSmoke('smoke:dialog', reportPath)) {
  process.exit(0);
}
const executable = releaseExecutablePath(desktopDir);
requireReleaseExecutable(executable, 'bun run tauri:build');

rmSync(reportPath, { force: true });

const child = spawnProcess(executable, [], {
  env: {
    ...process.env,
    OPEN_FACTORY_DIALOG_SMOKE: '1',
    OPEN_FACTORY_DIALOG_SMOKE_REPORT: reportPath
  },
  stdio: 'inherit'
});

const automation = compactDialogAutomation(await closeNativeDialog(title, child.pid));
const result = await waitForReportOrExit(child, reportPath, 30_000);

if (!existsSync(reportPath)) {
  const fallback = { nativeDialogFound: automation.found, dialogReturned: false, error: 'Smoke report was not written.', automation };
  writeFileSync(reportPath, JSON.stringify(fallback, null, 2));
  console.error(JSON.stringify(fallback, null, 2));
  process.exit(1);
}

const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const combined = { ...report, nativeDialogFound: automation.found, automation, process: result };
console.log(JSON.stringify(combined, null, 2));

if ((!result.reportFound && result.exitCode !== 0) || result.timedOut || !combined.windowExists || !combined.nativeDialogFound || !combined.dialogReturned || !combined.dialogCanceled) {
  process.exit(1);
}

function waitForReportOrExit(childProcess, path, timeoutMs) {
  return new Promise((resolveExit) => {
    let settled = false;
    const finish = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      clearInterval(interval);
      clearTimeout(timer);
      resolveExit(result);
    };
    const interval = setInterval(() => {
      if (!existsSync(path)) {
        return;
      }
      const shouldTerminate = childProcess.exitCode === null && !childProcess.killed;
      if (shouldTerminate) {
        childProcess.kill();
      }
      finish({ exitCode: 0, timedOut: false, reportFound: true, terminatedAfterReport: shouldTerminate });
    }, 100);
    const timer = setTimeout(() => {
      childProcess.kill();
      finish({ exitCode: 1, timedOut: true, reportFound: existsSync(path), terminatedAfterReport: true });
    }, timeoutMs);
    childProcess.on('exit', (code) => {
      finish({ exitCode: code ?? 1, timedOut: false, reportFound: existsSync(path), terminatedAfterReport: false });
    });
  });
}

function compactDialogAutomation(automation) {
  const candidates = Array.isArray(automation?.candidates) ? automation.candidates : [];
  return {
    ...automation,
    candidateCount: candidates.length,
    candidates: candidates.slice(-12)
  };
}

async function closeNativeDialog(windowTitle, processId) {
  const script = `
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class NativeDialogSmoke {
  [DllImport("user32.dll", CharSet=CharSet.Unicode)]
  public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
  [DllImport("user32.dll")]
  public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
  [DllImport("user32.dll")]
  public static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
  [DllImport("user32.dll")]
  public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")]
  public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")]
  public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll")]
  public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)]
  public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
}
"@
Add-Type -AssemblyName System.Windows.Forms
function Close-SmokeDialog([IntPtr]$handle) {
  if ($handle -eq [IntPtr]::Zero) { return $false }
  [void][NativeDialogSmoke]::ShowWindow($handle, 9)
  [void][NativeDialogSmoke]::SetForegroundWindow($handle)
  Start-Sleep -Milliseconds 100
  [void][NativeDialogSmoke]::SendMessage($handle, 0x0111, [IntPtr]2, [IntPtr]::Zero)
  Start-Sleep -Milliseconds 100
  [System.Windows.Forms.SendKeys]::SendWait("{ESC}")
  Start-Sleep -Milliseconds 100
  return [NativeDialogSmoke]::PostMessage($handle, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)
}
$title = ${JSON.stringify(windowTitle)}
$pid = [uint32]${Number(processId) || 0}
$found = $false
$closed = $false
$candidates = New-Object System.Collections.ArrayList
for ($i = 0; $i -lt 80; $i++) {
  $hwnd = [NativeDialogSmoke]::FindWindow($null, $title)
  if ($hwnd -ne [IntPtr]::Zero) {
    $found = $true
    $closed = Close-SmokeDialog $hwnd
    break
  }
  $script:target = [IntPtr]::Zero
  $callback = [NativeDialogSmoke+EnumWindowsProc]{
    param([IntPtr]$handle, [IntPtr]$lparam)
    if (-not [NativeDialogSmoke]::IsWindowVisible($handle)) { return $true }
    $windowPid = [uint32]0
    [void][NativeDialogSmoke]::GetWindowThreadProcessId($handle, [ref]$windowPid)
    $textBuilder = New-Object System.Text.StringBuilder 512
    $classBuilder = New-Object System.Text.StringBuilder 256
    [void][NativeDialogSmoke]::GetWindowText($handle, $textBuilder, $textBuilder.Capacity)
    [void][NativeDialogSmoke]::GetClassName($handle, $classBuilder, $classBuilder.Capacity)
    $text = $textBuilder.ToString()
    $class = $classBuilder.ToString()
    $sameProcess = $pid -eq 0 -or $windowPid -eq $pid
    [void]$candidates.Add(@{ title = $text; className = $class; pid = $windowPid })
    if ($text -like "*$title*" -or ($sameProcess -and ($class -eq "#32770" -or ($class -like "*Cabinet*" -and $text -match "Open|Select|Browse|Choose")))) {
      $script:target = $handle
      return $false
    }
    return $true
  }
  [void][NativeDialogSmoke]::EnumWindows($callback, [IntPtr]::Zero)
  if ($script:target -ne [IntPtr]::Zero) {
    $found = $true
    $closed = Close-SmokeDialog $script:target
    break
  }
  Start-Sleep -Milliseconds 250
}
ConvertTo-Json @{ found = $found; closed = $closed; candidates = $candidates } -Depth 4
`;
  const result = await new Promise((resolveAutomation) => {
    const ps = spawnProcess('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    ps.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    ps.on('exit', () => {
      try {
        resolveAutomation(JSON.parse(stdout));
      } catch {
        resolveAutomation({ found: false, closed: false });
      }
    });
  });
  return result;
}
