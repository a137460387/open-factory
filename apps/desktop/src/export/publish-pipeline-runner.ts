import {
  appendPublishLogsToReleaseRecord,
  buildProjectReleaseRecord,
  buildPublishNodeLog,
  buildSmtpExportEmailHtml,
  buildWebhookExportCompleteBody,
  isWithinPublishWindow,
  runReleaseChecklist,
  type ExportPipelineNode,
  type ExportPublishNodeLog,
  type ExportPublishOutputInfo,
  type Project
} from '@open-factory/editor-core';
import { postWebhookJson, readSmtpPassword, sendSmtpEmail } from '../lib/tauri-bridge';
import { saveProjectReleaseRecord } from '../release/projectReleases';

export interface PublishPipelineNodeContext {
  project: Project;
  outputPath: string;
  outputSize: number;
  duration: number;
  existingLogs: ExportPublishNodeLog[];
  messages: PublishPipelineMessages;
}

export interface PublishPipelineMessages {
  outsideWindow: string;
  smtpSent: string;
  webhookPosted: string;
  releaseRecordWritten: string;
  platformRequiresUploader(platform: string): string;
  smtpMissing: string;
  webhookMissing: string;
  webhookStatus(status: number): string;
  failed: string;
}

export async function runPublishPipelineNode(node: ExportPipelineNode, context: PublishPipelineNodeContext): Promise<ExportPublishNodeLog> {
  const startedAt = new Date().toISOString();
  if (node.publishWindow && !isWithinPublishWindow(new Date(startedAt), node.publishWindow)) {
    return buildPublishNodeLog({
      nodeId: node.id,
      nodeType: publishNodeType(node),
      status: 'skipped',
      startedAt,
      finishedAt: new Date().toISOString(),
      message: context.messages.outsideWindow
    });
  }

  try {
    const info = buildOutputInfo(context, startedAt);
    if (node.type === 'email-notification') {
      await sendEmailNode(node, info, context.messages);
      return successLog(node, startedAt, context.messages.smtpSent);
    }
    if (node.type === 'webhook-callback') {
      await sendWebhookNode(node, info, context.messages);
      return successLog(node, startedAt, context.messages.webhookPosted);
    }
    if (node.type === 'write-release-record') {
      const log = successLog(node, startedAt, context.messages.releaseRecordWritten);
      await writeReleaseRecord(context, [...context.existingLogs, log]);
      return log;
    }
    return buildPublishNodeLog({
      nodeId: node.id,
      nodeType: 'publish-platform',
      status: 'skipped',
      startedAt,
      finishedAt: new Date().toISOString(),
      message: context.messages.platformRequiresUploader(node.platform ?? 'youtube')
    });
  } catch (error) {
    return buildPublishNodeLog({
      nodeId: node.id,
      nodeType: publishNodeType(node),
      status: 'failed',
      startedAt,
      finishedAt: new Date().toISOString(),
      message: error instanceof Error ? error.message : context.messages.failed
    });
  }
}

async function sendEmailNode(node: ExportPipelineNode, info: ExportPublishOutputInfo, messages: PublishPipelineMessages): Promise<void> {
  if (!node.smtp) {
    throw new Error(messages.smtpMissing);
  }
  const password = node.smtp.passwordKey ? await readSmtpPassword(node.smtp.passwordKey).catch(() => undefined) : undefined;
  await sendSmtpEmail({
    ...node.smtp,
    password,
    subject: node.smtp.subject || `${info.project} export complete`,
    html: buildSmtpExportEmailHtml(info)
  });
}

async function sendWebhookNode(node: ExportPipelineNode, info: ExportPublishOutputInfo, messages: PublishPipelineMessages): Promise<void> {
  if (!node.webhook) {
    throw new Error(messages.webhookMissing);
  }
  const result = await postWebhookJson({
    url: node.webhook.url,
    headers: node.webhook.headers,
    timeoutMs: Math.min(5000, node.webhook.timeoutMs ?? 5000),
    body: buildWebhookExportCompleteBody(info)
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(messages.webhookStatus(result.status));
  }
}

async function writeReleaseRecord(context: PublishPipelineNodeContext, logs: ExportPublishNodeLog[]): Promise<void> {
  const checklist = runReleaseChecklist(context.project, {}, { exportPresetId: 'publish-pipeline' });
  const record = buildProjectReleaseRecord({
    project: context.project,
    version: context.project.releaseVersion,
    checklist,
    exportPath: context.outputPath,
    snapshotPath: context.outputPath
  });
  await saveProjectReleaseRecord(appendPublishLogsToReleaseRecord(record, logs));
}

function buildOutputInfo(context: PublishPipelineNodeContext, exportedAt: string): ExportPublishOutputInfo {
  return {
    file: context.outputPath,
    duration: context.duration,
    size: context.outputSize,
    project: context.project.name,
    exportedAt
  };
}

function successLog(node: ExportPipelineNode, startedAt: string, message: string): ExportPublishNodeLog {
  return buildPublishNodeLog({
    nodeId: node.id,
    nodeType: publishNodeType(node),
    status: 'success',
    startedAt,
    finishedAt: new Date().toISOString(),
    message
  });
}

function publishNodeType(node: ExportPipelineNode): ExportPublishNodeLog['nodeType'] {
  if (node.type === 'email-notification' || node.type === 'webhook-callback' || node.type === 'write-release-record' || node.type === 'publish-platform') {
    return node.type;
  }
  return 'publish-platform';
}
