import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  /* 全局默认超时 60 秒(7/14 后代码规模膨胀,CI 慢机器上 30s 不够) */
  timeout: 60_000,
  expect: { timeout: 5_000 },
  /* 失败时重试 2 次（CI 环境），仅对失败用例重试 */
  retries: process.env.CI ? 2 : 0,
  /* 并行执行（每个文件内测试串行） */
  fullyParallel: true,
  /* CI 环境限制 worker 数量避免资源争抢 */
  workers: process.env.CI ? 2 : undefined,
  /* 失败时保留 trace */
  forbidOnly: !!process.env.CI,
  use: {
    baseURL: 'http://localhost:1420',
    locale: 'zh-CN',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    /* 自定义 action 超时 */
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    /* 页面跳转等 DOM 就绪即可,不等图片/字体(7/14 后首页资源变重,
       'load' 策略在 CI 慢机器上易超时) */
    gotoOptions: { waitUntil: 'domcontentloaded' }
  },
  webServer: {
    command: 'bun run dev -- --host localhost',
    url: 'http://localhost:1420',
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      VITE_E2E: 'true'
    }
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  /* 输出目录 */
  outputDir: 'test-results'
});
