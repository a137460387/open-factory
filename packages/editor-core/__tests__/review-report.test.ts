import { describe, expect, it } from 'vitest';
import { buildReviewReport, buildReviewReportHtml } from '../src';
import { makeProject } from './test-utils';

describe('review report', () => {
  it('builds a sorted review annotation report from project.reviewAnnotations', () => {
    const project = makeProject();
    project.reviewAnnotations = [
      { id: 'review-b', time: 4, type: 'text', text: 'Check title', color: '#facc15', x: 0.4, y: 0.2, width: 0.2, height: 0.08 },
      { id: 'review-a', time: 1, type: 'rectangle', text: 'Crop edge', color: '#38bdf8', x: 0.1, y: 0.1, width: 0.3, height: 0.2 }
    ];

    const report = buildReviewReport(project, { generatedAt: '2026-06-15T00:00:00.000Z' });

    expect(report.annotations.map((row) => row.id)).toEqual(['review-a', 'review-b']);
    expect(report.annotations[0]).toMatchObject({ index: 1, time: 1, text: 'Crop edge' });
  });

  it('renders review report HTML with overview and annotation table structure', () => {
    const project = makeProject();
    project.name = 'Client Cut';
    project.reviewAnnotations = [{ id: 'review-a', time: 1, type: 'arrow', text: 'Look here', color: '#facc15', x: 0.2, y: 0.3, width: 0.4, height: 0.1 }];

    const html = buildReviewReportHtml(project, { generatedAt: '2026-06-15T00:00:00.000Z' });

    expect(html).toContain('data-section="review-overview"');
    expect(html).toContain('data-section="review-annotations"');
    expect(html).toContain('data-review-annotation-id="review-a"');
    expect(html).toContain('Look here');
    expect(html).toContain('批注截图示意');
  });
});
