import { describe, expect, it } from 'vitest';
import { createProject } from '@open-factory/editor-core';
import { writeReviewReportFile } from './reviewReport';

describe('review report export helper', () => {
  it('writes the review report HTML to the selected file path', async () => {
    const project = createProject('Review Export');
    project.reviewAnnotations = [{ id: 'review-a', time: 1, type: 'text', text: 'Approve title', color: '#facc15', x: 0.4, y: 0.3, width: 0.22, height: 0.08 }];
    const files = new Map<string, string>();

    const outputPath = await writeReviewReportFile(project, 'C:/Reports/review.html', (path, html) => {
      files.set(path, html);
    });

    expect(outputPath).toBe('C:/Reports/review.html');
    expect(files.has('C:/Reports/review.html')).toBe(true);
    expect(files.get('C:/Reports/review.html')).toContain('Approve title');
  });
});
