import { expect, test } from '@playwright/test';
import { openExportDialog, waitForE2eActions } from './e2e-actions';

test('bolds part of a rich text clip and exports multiple drawtext filters', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);

  await page.getByTestId('add-text-clip-button').click();
  const textClip = page.locator('[data-clip-type="text"]').first();
  await expect(textClip).toBeVisible();
  await textClip.click();

  // 07-24 bd315fd6 将富文本编辑面抽成 RichTextEditor 组件，testid 由
  // clip-text-input 重命名为 rich-text-editor-content（同一 contentEditable），
  // 其余 fill/选区/加粗/导出断言流程等价。
  const editor = page.getByTestId('rich-text-editor-content');
  await editor.fill('Bold Normal');
  await editor.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let textNode = walker.nextNode();
    while (textNode && !textNode.textContent?.includes('Bold')) {
      textNode = walker.nextNode();
    }
    if (!textNode) {
      throw new Error('missing text node');
    }
    const start = textNode.textContent?.indexOf('Bold') ?? 0;
    const range = document.createRange();
    range.setStart(textNode, start);
    range.setEnd(textNode, start + 4);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  await page.getByTestId('rich-text-bold-button').click();

  await page.evaluate(() => window.__E2E_ACTIONS__!.setSavePath!('C:/Exports/advanced-rich-text.mp4'));
  await openExportDialog(page);
  await page.getByTestId('export-enqueue-button').click();
  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!())).toBeTruthy();

  const plan = (await page.evaluate(() => window.__E2E_ACTIONS__!.getLastExportPlan!())) as {
    filterComplex: string;
    textArtifacts: Array<{ text: string }>;
  };
  expect(plan.filterComplex.match(/drawtext=textfile=__TEXTFILE_/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  expect(plan.textArtifacts.map((artifact) => artifact.text)).toEqual(expect.arrayContaining(['Bold', ' Normal']));
});
