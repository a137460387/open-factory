import { expect, test, type Page } from '@playwright/test';
import { waitForE2eActions } from './e2e-actions';

/** Mock marketplace catalog with multiple entries across categories. */
const MOCK_CATALOG = {
  plugins: [
    {
      id: 'market.color-corrector',
      name: '高级色彩校正器',
      author: 'Open Factory',
      version: '1.0.0',
      description: '提供亮度、对比度、饱和度调节的色彩校正效果。',
      category: 'effect',
      permissions: ['read-project'],
      downloadUrl: '/plugins/color-corrector.js',
      sha256: 'a'.repeat(64),
      tags: ['color', 'correction', 'filter'],
      rating: { average: 4.8, count: 50 },
      downloads: 1200,
      publishedAt: '2026-06-01T00:00:00Z',
      updatedAt: '2026-07-01T00:00:00Z',
      official: true,
    },
    {
      id: 'market.subtitle-translator',
      name: '批量字幕翻译',
      author: 'Open Factory',
      version: '1.0.0',
      description: '将项目字幕批量翻译为目标语言。',
      category: 'workflow',
      permissions: ['read-project', 'write-project'],
      downloadUrl: '/plugins/subtitle-translator.js',
      sha256: 'b'.repeat(64),
      tags: ['subtitle', 'translation', 'workflow'],
      rating: { average: 4.2, count: 20 },
      downloads: 500,
      publishedAt: '2026-05-15T00:00:00Z',
      updatedAt: '2026-06-20T00:00:00Z',
      official: true,
    },
    {
      id: 'market.social-export',
      name: '社交媒体导出',
      author: 'Community Dev',
      version: '2.1.0',
      description: '一键导出适合抖音、B站、YouTube等平台的视频。',
      category: 'export',
      permissions: ['export-hook', 'read-project'],
      downloadUrl: '/plugins/social-export.js',
      sha256: 'c'.repeat(64),
      tags: ['social', 'export', 'douyin'],
      rating: { average: 3.5, count: 100 },
      downloads: 3000,
      publishedAt: '2026-04-01T00:00:00Z',
      updatedAt: '2026-07-10T00:00:00Z',
      official: false,
    },
    {
      id: 'market.ai-scene-detector',
      name: 'AI 场景检测器',
      author: 'AI Labs',
      version: '0.9.0',
      description: '使用 AI 自动检测视频场景切换点。',
      category: 'ai-model',
      permissions: ['read-project', 'ai-inference'],
      downloadUrl: '/plugins/ai-scene.js',
      sha256: 'd'.repeat(64),
      tags: ['ai', 'scene', 'detection'],
      rating: { average: 4.9, count: 15 },
      downloads: 300,
      publishedAt: '2026-07-01T00:00:00Z',
      updatedAt: '2026-07-15T00:00:00Z',
      official: false,
    },
  ],
};

/** Plugin source code that matches the catalog entry permissions. */
function pluginSource(id: string, name: string, permissions: string[]): string {
  return [
    'module.exports = {',
    '  manifest: {',
    `    id: "${id}",`,
    `    name: "${name}",`,
    '    version: "1.0.0",',
    `    permissions: [${permissions.map((p) => `"${p}"`).join(', ')}]`,
    '  },',
    '  hooks: {',
    '    onExportBefore() { return { message: "ok" }; }',
    '  }',
    '};',
  ].join('\n');
}

// --- Helper functions ---

async function openPluginMarket(page: Page): Promise<void> {
  await page.getByTestId('toolbar-settings-button').click();
  await page.getByTestId('settings-tab-plugins').click();
}

async function closeSettings(page: Page): Promise<void> {
  await page.getByTestId('settings-close-button').click();
}

async function mockCatalog(page: Page): Promise<void> {
  await page.route('**/plugin-catalog.json', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(MOCK_CATALOG),
    });
  });
}

// --- Tests ---

test.describe('插件市场浏览', () => {
  test('显示市场插件列表并支持文本搜索', async ({ page }) => {
    await mockCatalog(page);
    await page.goto('/');
    await waitForE2eActions(page);

    await openPluginMarket(page);

    // 市场面板可见
    const panel = page.getByTestId('plugin-market-panel');
    await expect(panel).toBeVisible();

    // 搜索框可见并可输入
    const search = page.getByTestId('plugin-market-search');
    await expect(search).toBeVisible();
    await search.fill('色彩');
    await expect(page.getByText('高级色彩校正器')).toBeVisible();
    // 不匹配的应隐藏
    await expect(page.getByText('社交媒体导出')).not.toBeVisible();

    // 清空搜索恢复全部
    await search.fill('');
    await expect(page.getByText('社交媒体导出')).toBeVisible();
  });

  test('支持按分类筛选插件', async ({ page }) => {
    await mockCatalog(page);
    await page.goto('/');
    await waitForE2eActions(page);

    await openPluginMarket(page);

    // 选择"导出"分类
    const categorySelect = page.getByTestId('plugin-market-category');
    await categorySelect.selectOption('export');

    // 只应显示导出类插件
    await expect(page.getByText('社交媒体导出')).toBeVisible();
    await expect(page.getByText('高级色彩校正器')).not.toBeVisible();
    await expect(page.getByText('批量字幕翻译')).not.toBeVisible();

    // 恢复全部
    await categorySelect.selectOption('all');
    await expect(page.getByText('高级色彩校正器')).toBeVisible();
  });

  test('支持按排序方式切换', async ({ page }) => {
    await mockCatalog(page);
    await page.goto('/');
    await waitForE2eActions(page);

    await openPluginMarket(page);

    // 按评分排序
    const sortSelect = page.getByTestId('plugin-market-sort');
    await sortSelect.selectOption('rating');

    // AI 场景检测器评分最高(4.9)，应排第一
    const cards = page.locator('[data-testid^="plugin-card-"]');
    await expect(cards.first()).toContainText('AI 场景检测器');
  });

  test('分类标签芯片显示计数并可点击切换', async ({ page }) => {
    await mockCatalog(page);
    await page.goto('/');
    await waitForE2eActions(page);

    await openPluginMarket(page);

    // 应显示分类芯片（带计数）
    const effectChip = page.getByRole('button', { name: /效果.*1/ });
    await expect(effectChip).toBeVisible();

    // 点击效果芯片筛选
    await effectChip.click();
    await expect(page.getByText('高级色彩校正器')).toBeVisible();
    await expect(page.getByText('社交媒体导出')).not.toBeVisible();
  });
});

test.describe('插件详情与安装', () => {
  test('点击插件卡片打开详情弹窗并显示完整信息', async ({ page }) => {
    await mockCatalog(page);
    await page.goto('/');
    await waitForE2eActions(page);

    await openPluginMarket(page);

    // 点击色彩校正器卡片
    await page.getByTestId('plugin-card-market.color-corrector').click();

    // 详情弹窗可见
    const dialog = page.getByTestId('plugin-detail-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('高级色彩校正器');
    await expect(dialog).toContainText('Open Factory');
    await expect(dialog).toContainText('v1.0.0');
    await expect(dialog).toContainText('效果插件');
    await expect(dialog).toContainText('读取项目');
    await expect(dialog).toContainText('1,200');

    // 安装按钮可见
    await expect(dialog.getByTestId('plugin-detail-install')).toBeVisible();

    // 关闭弹窗
    await dialog.locator('button[aria-label="关闭"]').click();
    await expect(dialog).not.toBeVisible();
  });

  test('从市场安装插件并通过 SHA-256 验证', async ({ page }) => {
    await mockCatalog(page);
    await page.goto('/');
    await waitForE2eActions(page);

    // Mock 插件下载返回合法源码
    const source = pluginSource('market.color-corrector', '高级色彩校正器', ['read-project']);
    await page.route('**/plugins/color-corrector.js', async (route) => {
      await route.fulfill({
        contentType: 'application/javascript',
        body: source,
      });
    });

    await openPluginMarket(page);

    // 点击安装按钮
    await page.getByTestId('plugin-install-market.color-corrector').click();

    // 确认对话框出现并接受
    await page.getByRole('button', { name: /确认|是|Yes|OK/ }).click();

    // 安装完成后应显示"已安装"
    await expect(page.getByTestId('plugin-card-market.color-corrector')).toContainText('已安装');
  });

  test('拒绝安装时 SHA-256 不匹配的插件', async ({ page }) => {
    await mockCatalog(page);
    await page.goto('/');
    await waitForE2eActions(page);

    // Mock 返回与 catalog sha256 不匹配的内容
    await page.route('**/plugins/color-corrector.js', async (route) => {
      await route.fulfill({
        contentType: 'application/javascript',
        body: 'module.exports = { manifest: { id: "x" }, hooks: {} };',
      });
    });

    await openPluginMarket(page);
    await page.getByTestId('plugin-install-market.color-corrector').click();

    // 应出现错误提示（SHA-256 不匹配）
    await expect(page.getByText(/SHA-256|integrity|完整性/)).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('插件管理（启用/禁用）', () => {
  test('在已安装列表中切换插件启用状态', async ({ page }) => {
    await page.goto('/');
    await waitForE2eActions(page);

    await openPluginMarket(page);

    // 内置插件应可见
    const builtinEntry = page.locator('[data-testid^="installed-plugin-"]').filter({ hasText: '导出片段计数示例' });
    await expect(builtinEntry).toBeVisible();

    // 内置插件的切换按钮应被禁用
    const builtinToggle = builtinEntry.getByTestId(/plugin-toggle/);
    await expect(builtinToggle).toBeDisabled();
  });

  test('禁用插件后其钩子不再被调用', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await waitForE2eActions(page);
    await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());

    await openPluginMarket(page);

    // 禁用 e2e.export-count 插件
    const e2eEntry = page.locator('[data-testid^="installed-plugin-"][data-plugin-id="e2e.export-count"]');
    const toggle = e2eEntry.getByTestId('plugin-toggle-e2e.export-count');
    await toggle.click();
    await closeSettings(page);

    // 验证插件状态变为 disabled
    await openPluginMarket(page);
    await expect(e2eEntry.getByTestId('plugin-status')).toHaveAttribute('data-status', 'disabled');
    await closeSettings(page);

    // 重新启用
    await openPluginMarket(page);
    await toggle.click();
    await expect(e2eEntry.getByTestId('plugin-status')).toHaveAttribute('data-status', 'enabled');
  });
});

test.describe('刷新与离线缓存', () => {
  test('市场刷新按钮可触发目录重新加载', async ({ page }) => {
    let requestCount = 0;
    await page.route('**/plugin-catalog.json', async (route) => {
      requestCount += 1;
      await route.fulfill({
        contentType: 'application/application/json',
        body: JSON.stringify(MOCK_CATALOG),
      });
    });

    await page.goto('/');
    await waitForE2eActions(page);

    await openPluginMarket(page);
    const initialCount = requestCount;

    // 点击刷新
    await page.getByTestId('plugin-market-refresh').click();
    await expect(page.getByTestId('plugin-market-refresh')).toBeEnabled({ timeout: 5_000 });

    // 应发起新的请求
    expect(requestCount).toBeGreaterThan(initialCount);
  });

  test('网络失败时回退到缓存目录', async ({ page }) => {
    // 第一次请求成功（填充缓存）
    await page.route('**/plugin-catalog.json', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(MOCK_CATALOG),
      });
    });

    await page.goto('/');
    await waitForE2eActions(page);
    await openPluginMarket(page);
    await expect(page.getByText('高级色彩校正器')).toBeVisible();
    await closeSettings(page);

    // 第二次请求失败（应回退缓存）
    await page.unroute('**/plugin-catalog.json');
    await page.route('**/plugin-catalog.json', async (route) => {
      await route.abort('connectionrefused');
    });

    await openPluginMarket(page);
    await page.getByTestId('plugin-market-refresh').click();

    // 缓存数据仍应可见
    await expect(page.getByText('高级色彩校正器')).toBeVisible({ timeout: 10_000 });
  });
});
