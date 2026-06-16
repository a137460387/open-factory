import { expect, test } from '@playwright/test';
import { addMediaCardToTimeline, waitForE2eActions } from './e2e-actions';

test('adds and resolves a collaboration note', async ({ page }) => {
  await page.goto('/');
  await waitForE2eActions(page);
  await page.evaluate(() => window.__E2E_ACTIONS__!.clearE2eFiles!());
  await page.getByTestId('import-media-button').click();
  await addMediaCardToTimeline(page, 0);
  await page.evaluate(() => window.__E2E_ACTIONS__!.setPlayheadTime!(2));

  await page.getByTestId('toolbar-tools-menu-button').click();
  await page.getByTestId('toolbar-tools-collaboration-notes-menu-item').click();
  await expect(page.getByTestId('collaboration-notes-panel')).toBeVisible();

  await page.getByTestId('collaboration-note-input').fill('这里需要换一个镜头');
  await page.getByTestId('collaboration-add-note-button').click();

  await expect(page.getByTestId('collaboration-note-card')).toContainText('这里需要换一个镜头');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const [note] = window.__E2E_ACTIONS__!.getProjectSnapshot!().collaborationNotes;
        return note ? { text: note.text, start: note.start, resolved: note.resolved, authorName: note.authorName } : undefined;
      })
    )
    .toMatchObject({ text: '这里需要换一个镜头', start: 2, resolved: false, authorName: '我' });

  await page.getByTestId('collaboration-resolve-button').click();
  await expect(page.getByTestId('collaboration-note-card')).toHaveAttribute('data-resolved', 'true');
  await expect.poll(() => page.evaluate(() => window.__E2E_ACTIONS__!.getProjectSnapshot!().collaborationNotes[0]?.resolved)).toBe(true);
});
