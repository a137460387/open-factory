import { test, expect } from './fixtures';

test('persists project documentation after save and reopen', async ({ page, toolbar }) => {
  const projectPath = 'C:/Projects/documentation.cutproj.json';
  const description = '# 项目说明\n\n**客户版** 剪辑备注\n\n- 保留片头';

  // 导航并等待应用就绪
  await toolbar.goto();
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await expect(page.getByTestId('import-media-button')).toBeVisible({ timeout: 10_000 });

  // 打开文档面板
  await toolbar.openDocumentation();
  await expect(page.getByTestId('project-documentation-panel')).toBeVisible();

  // 填写文档并验证预览
  await page.getByTestId('project-documentation-input-description').fill(description);
  await expect(page.getByTestId('project-documentation-preview-description')).toContainText('客户版');

  // 保存项目
  await page.evaluate((path) => window.__E2E_ACTIONS__!.setSavePath!(path), projectPath);
  await page.getByTestId('toolbar-save-project-button').click();
  await expect
    .poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string | undefined, projectPath))
    .not.toBeUndefined();

  // 验证保存的文件包含文档数据
  const saved = await page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string, projectPath);
  expect(JSON.parse(saved)).toMatchObject({
    schemaVersion: 2,
    project: { documentation: { description } }
  });

  // 关闭文档面板
  await toolbar.openDocumentation();
  await expect(page.getByTestId('project-documentation-panel')).not.toBeVisible();

  // 重新加载页面模拟"重新打开项目"
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__E2E_ACTIONS__)), { timeout: 15_000 })
    .toBe(true);
  await expect(page.getByTestId('import-media-button')).toBeVisible({ timeout: 10_000 });

  // 从保存的文件加载项目
  const savedProject = JSON.parse(saved).project;
  await page.evaluate((proj) => window.__E2E_ACTIONS__!.setProjectSnapshot!(proj), savedProject);

  // 等待 UI 更新
  await expect(page.getByTestId('import-media-button')).toBeVisible({ timeout: 10_000 });

  // 打开文档面板并验证内容恢复
  await toolbar.openDocumentation();
  await expect(page.getByTestId('project-documentation-panel')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('project-documentation-input-description')).toHaveValue(description);
});
