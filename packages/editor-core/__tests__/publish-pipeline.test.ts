import { describe, expect, it } from 'vitest';
import {
  appendPublishLogsToReleaseRecord,
  buildProjectReleaseRecord,
  buildPublishNodeLog,
  buildSmtpExportEmailHtml,
  buildWebhookExportCompleteBody,
  createProject,
  createPublishAutomationPipeline,
  isWithinPublishWindow,
  normalizeExportPipeline,
  runReleaseChecklist,
  type ProjectReleaseRecord
} from '../src';

const outputInfo = {
  file: 'C:/Exports/final.mp4',
  duration: 12.3456,
  size: 123456,
  project: 'Launch Cut',
  exportedAt: '2026-06-18T10:00:00.000Z'
};

describe('publish pipeline', () => {
  it('formats SMTP export notification HTML', () => {
    const html = buildSmtpExportEmailHtml({ ...outputInfo, file: 'C:/Exports/<final>.mp4' });

    expect(html).toContain('<h1>Export complete</h1>');
    expect(html).toContain('C:/Exports/&lt;final&gt;.mp4');
    expect(html).toContain('12.346 s');
    expect(html).toContain('123456 bytes');
  });

  it('builds webhook POST body fields', () => {
    expect(buildWebhookExportCompleteBody(outputInfo)).toEqual({
      event: 'export_complete',
      file: 'C:/Exports/final.mp4',
      duration: 12.346,
      size: 123456,
      project: 'Launch Cut'
    });
  });

  it('keeps webhook authorization headers during normalization', () => {
    const pipeline = normalizeExportPipeline({
      nodes: [
        {
          id: 'webhook',
          type: 'webhook-callback',
          name: 'Webhook',
          webhook: {
            url: 'https://hooks.example.test/export',
            headers: { Authorization: 'Bearer local-token', ' X-Trace ': ' publish ' }
          }
        }
      ]
    });

    expect(pipeline.nodes[0].webhook).toMatchObject({
      url: 'https://hooks.example.test/export',
      headers: { Authorization: 'Bearer local-token', 'X-Trace': 'publish' },
      timeoutMs: 5000
    });
  });

  it('checks weekday publishing windows by local offset and hour', () => {
    const window = { daysOfWeek: [1, 2, 3, 4, 5], startHour: 9, endHour: 18, timezoneOffsetMinutes: 8 * 60 };

    expect(isWithinPublishWindow(new Date('2026-06-18T01:30:00.000Z'), window)).toBe(true);
    expect(isWithinPublishWindow(new Date('2026-06-18T10:30:00.000Z'), window)).toBe(false);
    expect(isWithinPublishWindow(new Date('2026-06-20T02:00:00.000Z'), window)).toBe(false);
  });

  it('records node execution log fields', () => {
    expect(
      buildPublishNodeLog({
        nodeId: 'email',
        nodeType: 'email-notification',
        status: 'success',
        startedAt: '2026-06-18T10:00:00.000Z',
        finishedAt: '2026-06-18T10:00:01.250Z',
        message: 'sent'
      })
    ).toEqual({
      nodeId: 'email',
      nodeType: 'email-notification',
      status: 'success',
      startedAt: '2026-06-18T10:00:00.000Z',
      finishedAt: '2026-06-18T10:00:01.250Z',
      durationMs: 1250,
      message: 'sent'
    });
  });

  it('updates release records with publish logs', () => {
    const record = releaseRecord();
    const log = buildPublishNodeLog({
      nodeId: 'webhook',
      nodeType: 'webhook-callback',
      status: 'success',
      startedAt: '2026-06-18T10:00:00.000Z',
      finishedAt: '2026-06-18T10:00:00.100Z',
      message: 'posted'
    });

    expect(appendPublishLogsToReleaseRecord(record, [log]).publishLogs).toEqual([log]);
  });

  it('creates publish automation pipeline nodes', () => {
    const pipeline = createPublishAutomationPipeline('After Export');

    expect(pipeline.nodes.map((node) => node.type)).toEqual([
      'export-mp4',
      'email-notification',
      'publish-platform',
      'webhook-callback',
      'write-release-record'
    ]);
    expect(pipeline.edges).toEqual([
      { from: 'node-export-mp4', to: 'node-email-notification' },
      { from: 'node-export-mp4', to: 'node-publish-platform' },
      { from: 'node-export-mp4', to: 'node-webhook-callback' },
      { from: 'node-export-mp4', to: 'node-release-record' }
    ]);
  });

  it('drops email node SMTP when settings are missing', () => {
    const pipeline = normalizeExportPipeline({
      nodes: [
        { id: 'email', type: 'email-notification', name: 'Email' }
      ]
    });

    expect(pipeline.nodes[0]).not.toHaveProperty('smtp');
  });

  it('drops webhook node config when URL is missing', () => {
    const pipeline = normalizeExportPipeline({
      nodes: [
        { id: 'hook', type: 'webhook-callback', name: 'Hook' }
      ]
    });

    expect(pipeline.nodes[0]).not.toHaveProperty('webhook');
  });
});

function releaseRecord(): ProjectReleaseRecord {
  const project = createProject('Publish Release');
  return buildProjectReleaseRecord({
    project,
    version: '0.1.1',
    releasedAt: '2026-06-18T10:00:00.000Z',
    checklist: runReleaseChecklist(project, {}, { exportPresetId: 'web-1080p' }),
    exportPath: 'C:/Exports/final.mp4',
    snapshotPath: 'C:/Projects/final.cutproj.json'
  });
}
