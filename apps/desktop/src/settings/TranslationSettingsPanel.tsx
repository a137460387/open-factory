import { zhCN } from '../i18n/strings';
import type { TranslationProvider } from '../store/translationSettingsStore';

export function TranslationSettingsPanel({
  provider,
  apiKey,
  apiKeyError,
  targetLanguage,
  onProviderChange,
  onApiKeyChange,
  onTargetLanguageChange,
}: {
  provider: TranslationProvider;
  apiKey: string;
  apiKeyError?: string;
  targetLanguage: string;
  onProviderChange(provider: TranslationProvider): void;
  onApiKeyChange(apiKey: string): void | Promise<void>;
  onTargetLanguageChange(targetLanguage: string): void;
}) {
  const t = zhCN.settings.translation;
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-ink">{t.title}</h3>
        <p className="text-xs text-slate-500">{t.description}</p>
      </div>
      <div
        className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800"
        data-testid="translation-third-party-warning"
      >
        {t.thirdPartyWarning}
      </div>
      <label className="block text-xs font-medium text-slate-600">
        {t.provider}
        <select
          className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
          value={provider}
          data-testid="translation-provider-select"
          onChange={(event) => onProviderChange(event.target.value === 'google' ? 'google' : 'deepl')}
        >
          <option value="deepl">DeepL</option>
          <option value="google">Google</option>
        </select>
      </label>
      <div>
        <label className="block text-xs font-medium text-slate-600">
          {t.apiKey}
          <input
            className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm text-ink"
            type="password"
            value={apiKey}
            data-testid="translation-api-key-input"
            onChange={(event) => void onApiKeyChange(event.target.value)}
          />
        </label>
        <p className="mt-1 text-xs text-slate-500">{t.keyStorageNote}</p>
        {apiKeyError ? (
          <p className="mt-1 text-xs font-medium text-amber-700" data-testid="translation-api-key-error">
            {apiKeyError}
          </p>
        ) : null}
      </div>
      <label className="block text-xs font-medium text-slate-600">
        {t.targetLanguage}
        <input
          className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm uppercase text-ink"
          value={targetLanguage}
          data-testid="translation-target-language-input"
          onChange={(event) => onTargetLanguageChange(event.target.value)}
        />
      </label>
      <div className="rounded-md border border-line bg-panel p-3 text-xs text-slate-600">{t.localOnlyNote}</div>
    </div>
  );
}
