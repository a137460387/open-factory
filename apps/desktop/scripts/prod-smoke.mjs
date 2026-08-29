/**
 * 生产产物冒烟（web 层）：vite build 产物经 vite preview 静态服务后，
 * 无头 Chromium 加载首页并断言 React 完成挂载。
 *
 * 背景（v4.78.0 真机冒烟事故）：生产构建 vendor 分块拆分下，
 * vendor-utils ↔ vendor-react 双向循环求值导致入口模块在 React 初始化
 * 前崩溃，#root 为空、启动黑屏。既有 e2e 跑 dev server（无生产分块），
 * 无法拦截此类回归——本脚本补上"生产产物可启动"这道门禁。
 *
 * 断言：
 *   1. #root childElementCount > 0（React 挂载成功）
 *   2. 加载全程零 pageerror（含模块求值期 TypeError）
 *
 * 前置：dist/ 已由 vite build 产出。用法：node scripts/prod-smoke.mjs
 */
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopDir = resolve(scriptDir, '..');
const PREVIEW_PORT = 4173;
const PREVIEW_URL = `http://localhost:${PREVIEW_PORT}`;
const PAGE_MOUNT_TIMEOUT_MS = 30_000;

const previewProcess = spawn('bunx', ['vite', 'preview', '--host', 'localhost', '--port', String(PREVIEW_PORT), '--strictPort'], {
  cwd: desktopDir,
  stdio: 'ignore',
  shell: true
});

let browser;
let exitCode = 1;
try {
  await waitForPreviewReady(PREVIEW_URL, 30_000);
  browser = await chromium.launch();
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  await page.goto(PREVIEW_URL, { waitUntil: 'domcontentloaded', timeout: PAGE_MOUNT_TIMEOUT_MS });
  await page.waitForFunction(
    () => {
      const root = document.getElementById('root');
      return root !== null && root.childElementCount > 0;
    },
    null,
    { timeout: PAGE_MOUNT_TIMEOUT_MS }
  );
  const rootChildElementCount = await page.evaluate(() => document.getElementById('root')?.childElementCount ?? 0);

  const passed = rootChildElementCount > 0 && pageErrors.length === 0;
  console.log(JSON.stringify({ passed, url: PREVIEW_URL, rootChildElementCount, pageErrors }, null, 2));
  exitCode = passed ? 0 : 1;
} catch (error) {
  console.log(JSON.stringify({ passed: false, url: PREVIEW_URL, error: String(error) }, null, 2));
  exitCode = 1;
} finally {
  await browser?.close();
  previewProcess.kill();
}

process.exit(exitCode);

/** 轮询 preview 服务直至 200 就绪，超时抛错。 */
async function waitForPreviewReady(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`vite preview 未在 ${timeoutMs}ms 内就绪：${String(lastError ?? 'no response')}`);
}
