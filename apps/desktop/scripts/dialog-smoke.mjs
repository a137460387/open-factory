import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { releaseExecutablePath, requireReleaseExecutable, shouldSkipNativeAppSmoke, spawnProcess, waitForExitOrKill } from './smoke-platform.mjs';

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

const automation = await closeNativeDialog(title, child.pid);
const result = await waitForExitOrKill(child, 30_000);

if (!existsSync(reportPath)) {
  const fallback = { nativeDialogFound: automation.found, dialogReturned: false, error: 'Smoke report was not written.' };
  writeFileSync(reportPath, JSON.stringify(fallback, null, 2));
  console.error(JSON.stringify(fallback, null, 2));
  process.exit(1);
}

const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const combined = { ...report, nativeDialogFound: automation.found, automation };
console.log(JSON.stringify(combined, null, 2));

if (result.exitCode !== 0 || result.timedOut || !combined.windowExists || !combined.nativeDialogFound || !combined.dialogReturned || !combined.dialogCanceled) {
  process.exit(1);
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
$title = ${JSON.stringify(windowTitle)}
$pid = [uint32]${Number(processId) || 0}
$found = $false
$closed = $false
$candidates = New-Object System.Collections.ArrayList
for ($i = 0; $i -lt 80; $i++) {
  $hwnd = [NativeDialogSmoke]::FindWindow($null, $title)
  if ($hwnd -ne [IntPtr]::Zero) {
    $found = $true
    $closed = [NativeDialogSmoke]::PostMessage($hwnd, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)
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
    [void]$candidates.Add(@{ title = $text; className = $class; pid = $windowPid })
    if ($text -like "*$title*" -or $class -eq "#32770" -or ($class -like "*Cabinet*" -and $text -match "Open|Select|Browse|Choose")) {
      $script:target = $handle
      return $false
    }
    return $true
  }
  [void][NativeDialogSmoke]::EnumWindows($callback, [IntPtr]::Zero)
  if ($script:target -ne [IntPtr]::Zero) {
    $found = $true
    $closed = [NativeDialogSmoke]::PostMessage($script:target, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)
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
