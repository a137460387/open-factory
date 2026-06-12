import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('adds an annotation, saves the project, and restores it after reopening', async ({ page }) => {
  const projectPath = 'C:/Projects/annotated.cutproj.json';
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate((path) => window.__E2E_ACTIONS__!.setSavePath!(path), projectPath);

  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await page.getByTestId('toggle-annotation-mode-button').click();
  await page.getByTestId('timeline-annotation-click-layer').click({ position: { x: 240, y: 36 } });
  await page.getByTestId('annotation-text-input').fill('Review beat');
  await page.getByTestId('annotation-save-button').click();

  await expect(page.locator('[data-testid^="timeline-annotation-"]').filter({ hasText: 'Review beat' })).toBeVisible();
  await page.getByTestId('toolbar-save-project-button').click();
  await expect.poll(() => page.evaluate((path) => window.__E2E_ACTIONS__!.getWrittenFile!(path) as string | undefined, projectPath)).not.toBeUndefined();

  const annotationId = await page.evaluate((path) => {
    const saved = JSON.parse(window.__E2E_ACTIONS__!.getWrittenFile!(path) as string) as { project: { annotations: Array<{ id: string; text: string }> } };
    return saved.project.annotations.find((annotation) => annotation.text === 'Review beat')?.id;
  }, projectPath);
  expect(annotationId).toBeTruthy();

  await page.getByTestId('toolbar-new-project-button').click();
  await page.evaluate((path) => window.__E2E_ACTIONS__!.setOpenFileDialogPaths!([path]), projectPath);
  await page.getByTestId('toolbar-open-project-button').click();

  await expect(page.getByTestId(`timeline-annotation-${annotationId}`)).toContainText('Review beat');
  await expect(page.getByTestId(`annotation-list-item-${annotationId}`)).toContainText('Review beat');
});
