import { zhCN } from '../i18n/strings';
import { DEFAULT_POST_EXPORT_QUALITY_ASSURANCE_SETTINGS, type PostExportQualityAssuranceSettings } from '@open-factory/editor-core';

function optionalNumberFromInput(value: string): number | undefined {
  if (!value.trim()) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function requiredNumberFromInput(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function QualityAssuranceCheckbox({
  label,
  testId,
  checked,
  onChange,
}: {
  label: string;
  testId: string;
  checked: boolean;
  onChange(checked: boolean): void;
}) {
  return (
    <label className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-2 py-1.5 text-xs font-medium text-slate-700">
      <input
        className="h-4 w-4 accent-brand"
        type="checkbox"
        checked={checked}
        data-testid={testId}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

export function ExportQualityAssuranceSettingsPanel({
  settings,
  onChange,
}: {
  settings: PostExportQualityAssuranceSettings;
  onChange(patch: Partial<PostExportQualityAssuranceSettings>): void;
}) {
  const t = zhCN.settings.general.postExportQuality;
  return (
    <div className="rounded-md border border-line bg-panel p-3" data-testid="settings-export-qa-section">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-xs font-semibold text-slate-700">{t.title}</h4>
          <p className="mt-1 text-xs text-slate-500">{t.description}</p>
        </div>
        <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
          <input
            className="h-4 w-4 accent-brand"
            type="checkbox"
            checked={settings.enabled}
            data-testid="settings-export-qa-enabled"
            onChange={(event) => onChange({ enabled: event.target.checked })}
          />
          <span>{t.enabled}</span>
        </label>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <QualityAssuranceCheckbox
          label={t.duration}
          testId="settings-export-qa-duration"
          checked={settings.duration}
          onChange={(checked) => onChange({ duration: checked })}
        />
        <QualityAssuranceCheckbox
          label={t.blackFrames}
          testId="settings-export-qa-black-frames"
          checked={settings.blackFrames}
          onChange={(checked) => onChange({ blackFrames: checked })}
        />
        <QualityAssuranceCheckbox
          label={t.silence}
          testId="settings-export-qa-silence"
          checked={settings.silence}
          onChange={(checked) => onChange({ silence: checked })}
        />
        <QualityAssuranceCheckbox
          label={t.fileSize}
          testId="settings-export-qa-file-size"
          checked={settings.fileSize}
          onChange={(checked) => onChange({ fileSize: checked })}
        />
        <QualityAssuranceCheckbox
          label={t.resolution}
          testId="settings-export-qa-resolution"
          checked={settings.resolution}
          onChange={(checked) => onChange({ resolution: checked })}
        />
        <QualityAssuranceCheckbox
          label={t.autoRetry}
          testId="settings-export-qa-auto-retry"
          checked={settings.autoRetry}
          onChange={(checked) => onChange({ autoRetry: checked })}
        />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <label className="block text-xs font-medium text-slate-600">
          {t.minFileSizeBytes}
          <input
            className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
            type="number"
            min={0}
            step={1}
            value={settings.minFileSizeBytes ?? ''}
            data-testid="settings-export-qa-min-size"
            onChange={(event) => onChange({ minFileSizeBytes: optionalNumberFromInput(event.target.value) })}
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          {t.maxFileSizeBytes}
          <input
            className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
            type="number"
            min={0}
            step={1}
            value={settings.maxFileSizeBytes ?? ''}
            data-testid="settings-export-qa-max-size"
            onChange={(event) => onChange({ maxFileSizeBytes: optionalNumberFromInput(event.target.value) })}
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          {t.blackFrameDurationSeconds}
          <input
            className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
            type="number"
            min={0.1}
            step={0.1}
            value={settings.blackFrameDurationSeconds}
            data-testid="settings-export-qa-black-duration"
            onChange={(event) =>
              onChange({
                blackFrameDurationSeconds: requiredNumberFromInput(
                  event.target.value,
                  DEFAULT_POST_EXPORT_QUALITY_ASSURANCE_SETTINGS.blackFrameDurationSeconds,
                ),
              })
            }
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          {t.silenceThresholdDb}
          <input
            className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
            type="number"
            step={1}
            value={settings.silenceThresholdDb}
            data-testid="settings-export-qa-silence-threshold"
            onChange={(event) =>
              onChange({
                silenceThresholdDb: requiredNumberFromInput(
                  event.target.value,
                  DEFAULT_POST_EXPORT_QUALITY_ASSURANCE_SETTINGS.silenceThresholdDb,
                ),
              })
            }
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          {t.silenceDurationSeconds}
          <input
            className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
            type="number"
            min={0.1}
            step={0.1}
            value={settings.silenceDurationSeconds}
            data-testid="settings-export-qa-silence-duration"
            onChange={(event) =>
              onChange({
                silenceDurationSeconds: requiredNumberFromInput(
                  event.target.value,
                  DEFAULT_POST_EXPORT_QUALITY_ASSURANCE_SETTINGS.silenceDurationSeconds,
                ),
              })
            }
          />
        </label>
      </div>
    </div>
  );
}
