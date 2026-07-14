import type { PreflightResult } from '@open-factory/editor-core';
import { formatDuration } from '../lib/pipelineHelpers';
import { AlertTriangle } from 'lucide-react';
import { zhCN } from '../../i18n/strings';

export function PreflightPanel({
  issues,
  onDismiss,
  onContinue,
  onRelink,
}: {
  issues: PreflightResult[];
  onDismiss(): void;
  onContinue(): void;
  onRelink?: () => void;
}) {
  const hasBlocking = issues.some((issue) => issue.severity === 'blocking');
  const hasMissingMedia = issues.some((issue) => issue.type === 'missing-media');
  return (
    <section
      className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950"
      data-testid="export-preflight-panel"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle size={16} className="mt-0.5 flex-none" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">
            {hasBlocking ? zhCN.exportDialog.preflight.blockedTitle : zhCN.exportDialog.preflight.warningTitle}
          </div>
          <div className="mt-1 text-amber-900">
            {hasBlocking ? zhCN.exportDialog.preflight.blockedMessage : zhCN.exportDialog.preflight.warningMessage}
          </div>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {issues.map((issue) => (
          <div
            key={issue.id}
            className="rounded border border-amber-200 bg-white/70 p-2"
            data-testid="export-preflight-issue"
            data-severity={issue.severity}
            data-type={issue.type}
          >
            <div className="flex items-center gap-2">
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${issue.severity === 'blocking' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}
              >
                {zhCN.exportDialog.preflight.severity[issue.severity]}
              </span>
              <span className="font-semibold text-slate-800">{formatPreflightTitle(issue)}</span>
            </div>
            <div className="mt-1 text-slate-600">{formatPreflightMessage(issue)}</div>
            {issue.items.length > 0 ? (
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-700">
                {issue.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {hasMissingMedia && onRelink ? (
          <button
            className="rounded-md border border-line bg-white px-2 py-1.5 font-medium text-slate-700 hover:bg-panel"
            type="button"
            data-testid="export-preflight-relink-button"
            onClick={onRelink}
          >
            {zhCN.exportDialog.preflight.relink}
          </button>
        ) : null}
        <button
          className="rounded-md border border-line bg-white px-2 py-1.5 font-medium text-slate-700 hover:bg-panel"
          type="button"
          data-testid="export-preflight-dismiss-button"
          onClick={onDismiss}
        >
          {zhCN.common.close}
        </button>
        {!hasBlocking ? (
          <button
            className="rounded-md bg-brand px-2 py-1.5 font-medium text-white hover:bg-[#176858]"
            type="button"
            data-testid="export-preflight-continue-button"
            onClick={onContinue}
          >
            {zhCN.exportDialog.preflight.continue}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function formatPreflightTitle(issue: PreflightResult): string {
  return zhCN.exportDialog.preflight.issueTitle[issue.type];
}

function formatPreflightMessage(issue: PreflightResult): string {
  if (issue.type === 'missing-media') {
    return zhCN.exportDialog.preflight.missingMediaMessage(issue.items.length);
  }
  if (issue.type === 'missing-font') {
    return zhCN.exportDialog.preflight.missingFontMessage(issue.items.length);
  }
  if (issue.type === 'whisper-path') {
    return issue.items[0] ?? zhCN.exportDialog.preflight.whisperMessage;
  }
  if (issue.type === 'platform-duration') {
    return zhCN.exportDialog.preflight.platformDurationMessage(
      formatPlatformPresetName(issue.platformPreset),
      formatDuration(issue.durationSeconds),
      formatDuration(issue.limitSeconds),
    );
  }
  if (issue.type === 'vfr-media') {
    return zhCN.exportDialog.preflight.vfrMediaMessage(issue.items.length);
  }
  if (issue.type === 'frame-rate-mismatch') {
    return zhCN.exportDialog.preflight.frameRateMismatchMessage(issue.items.length, issue.projectFrameRate ?? 30);
  }
  return zhCN.exportDialog.preflight.ffmpegMessage;
}

function formatPlatformPresetName(platformPreset: PreflightResult['platformPreset']): string {
  if (platformPreset === 'youtube-1080p') {
    return zhCN.exportPresets.builtins.youtube1080p.name;
  }
  if (platformPreset === 'youtube-shorts') {
    return zhCN.exportPresets.builtins.youtubeShorts.name;
  }
  if (platformPreset === 'tiktok') {
    return zhCN.exportPresets.builtins.tiktok.name;
  }
  if (platformPreset === 'instagram-reels') {
    return zhCN.exportPresets.builtins.instagramReels.name;
  }
  if (platformPreset === 'twitter-x') {
    return zhCN.exportPresets.builtins.twitterX.name;
  }
  if (platformPreset === 'bilibili') {
    return zhCN.exportPresets.builtins.bilibili.name;
  }
  return zhCN.exportDialog.preset;
}
