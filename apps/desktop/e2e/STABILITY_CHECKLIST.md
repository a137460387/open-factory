# E2E 测试稳定性检查清单

本清单用于指导 E2E 测试的编写和审查，确保测试在 CI 环境中稳定运行。

## 核心原则

### 1. 禁止使用 `waitForTimeout`

`page.waitForTimeout()` 是 flaky 测试的首要根源。它使用固定延迟，无法适应不同机器的性能差异。

**错误示范：**
```typescript
await page.keyboard.down('r');
await page.waitForTimeout(500); // ❌ 硬编码延迟
await dragHandleBy(handle, page, 80);
```

**正确做法：**
```typescript
await page.keyboard.down('r');
await timeline.waitForEditingMode('rolling-trim'); // ✅ 等待状态变化
await timeline.dragTrimHandle('clip-edit-a', 'right', 80);
```

### 2. 使用 `data-testid` 定位元素

所有可交互元素必须有 `data-testid` 属性。避免使用 CSS 选择器、文本内容或 XPath。

**错误示范：**
```typescript
await page.locator('.timeline-clip').first().click(); // ❌ CSS 类名
await page.getByText('导出').click(); // ❌ 文本内容
```

**正确做法：**
```typescript
await page.getByTestId('timeline-clip-clip-a').click(); // ✅ data-testid
```

### 3. 测试间状态隔离

每个测试必须独立运行，不依赖其他测试的状态。使用 `beforeEach` 或测试开头的状态重置。

**错误示范：**
```typescript
test('test A', async ({ page }) => {
  await page.goto('/');
  // 修改状态...
});

test('test B', async ({ page }) => {
  // ❌ 假设 test A 的状态已保留
  await page.click('...');
});
```

**正确做法：**
```typescript
test('test B', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!()); // ✅ 重置状态
  // 独立设置...
});
```

### 4. 使用 POM（Page Object Model）

优先使用页面对象封装交互逻辑，避免在测试中直接操作页面。

**错误示范：**
```typescript
test('example', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.getByTestId('toolbar-export-button').click();
  await page.getByTestId('export-preset-select').selectOption('web-1080p');
  await page.getByTestId('export-enqueue-button').click();
});
```

**正确做法：**
```typescript
test('example', async ({ toolbar, exportDialog }) => {
  await toolbar.goto();
  await toolbar.openExport();
  await exportDialog.selectPreset('web-1080p');
  await exportDialog.enqueue();
});
```

### 5. 使用条件等待替代固定延迟

等待 UI 状态变化时，使用 Playwright 的自动等待机制或 `expect.poll()`。

**推荐模式：**
```typescript
// 等待元素可见
await expect(page.getByTestId('panel')).toBeVisible();

// 等待属性变化
await expect(element).toHaveAttribute('data-status', 'ready');

// 等待异步操作完成
await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getResult!())).not.toBeUndefined();

// 等待特定编辑模式
await timeline.waitForEditingMode('rolling-trim');
```

## 常见陷阱

### 键盘快捷键

键盘快捷键在不同环境中可能不稳定。优先使用 UI 按钮操作。

**风险操作：**
```typescript
await page.keyboard.down('Shift');
await page.keyboard.press('KeyD'); // ❌ 可能不稳定
```

**更可靠的做法：**
```typescript
await toolbar.openDocumentation(); // ✅ 点击按钮
```

### 右键菜单

右键菜单操作需要确保目标元素已完全渲染和可交互。

**推荐模式：**
```typescript
const clip = timeline.getClipByIndex(0);
await expect(clip).toBeVisible(); // ✅ 确保可见
await clip.click({ button: 'right' });
await expect(page.getByTestId('context-menu')).toBeVisible(); // ✅ 等待菜单
await page.getByTestId('menu-action').click();
```

### 页面重载

页面重载后必须等待应用完全初始化。

**推荐模式：**
```typescript
await page.goto('/');
await waitForE2eActions(page);
// 等待关键 UI 元素出现
await expect(page.getByTestId('import-media-button')).toBeVisible({ timeout: 10_000 });
```

### 导出操作

导出操作是异步的，需要等待任务状态变化。

**推荐模式：**
```typescript
await exportDialog.enqueue();
await exportDialog.expectTaskStatus(0, 'success', 15_000); // ✅ 等待完成
```

## 配置建议

### Playwright 配置

```typescript
export default defineConfig({
  timeout: 30_000,           // 全局超时 30 秒
  expect: { timeout: 5_000 }, // 断言超时 5 秒
  retries: process.env.CI ? 2 : 0, // CI 环境重试 2 次
  use: {
    actionTimeout: 10_000,   // 操作超时 10 秒
    navigationTimeout: 15_000, // 导航超时 15 秒
    trace: 'retain-on-failure', // 失败时保留 trace
  }
});
```

### 超时策略

| 场景 | 推荐超时 | 说明 |
|------|---------|------|
| 全局测试 | 30s | 单个测试的最大执行时间 |
| 页面操作 | 10s | click、fill 等操作 |
| 页面导航 | 15s | goto、reload 等 |
| 断言等待 | 5-10s | expect(...).toBeVisible() |
| 异步操作 | 15-30s | 导出、保存等 |

## 审查清单

在提交 E2E 测试代码审查时，检查以下项目：

- [ ] 没有使用 `waitForTimeout`
- [ ] 所有可交互元素使用 `data-testid` 定位
- [ ] 测试间状态完全隔离
- [ ] 使用 POM 封装重复操作
- [ ] 键盘操作有备用方案（UI 按钮）
- [ ] 右键菜单操作前检查元素可见性
- [ ] 页面重载后等待应用初始化
- [ ] 异步操作使用条件等待
- [ ] 超时设置合理（不过短也不过长）
- [ ] 测试可以在 `--repeat-every=5` 模式下稳定通过
