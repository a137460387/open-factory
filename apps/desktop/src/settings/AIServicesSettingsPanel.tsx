import { useState } from 'react';
import { ChevronDown, ChevronRight, Plug, TestTube, Trash2 } from 'lucide-react';
import { zhCN } from '../i18n/strings';
import { useAISettingsStore, type AIServiceType } from '../store/aiSettingsStore';
import type { AIProvider } from '@open-factory/editor-core';
import { AIUsageStatsPanel } from '../components/AIUsageStats/AIUsageStatsPanel';

const SERVICE_TYPES: AIServiceType[] = ['subtitle-polish', 'chapter-title', 'vision-analysis', 'voiceover', 'color-grading-suggestion', 'rough-cut', 'export-suggestion'];

export function AIServicesSettingsPanel() {
  const t = zhCN.settings.aiServices;
  const store = useAISettingsStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, boolean | null>>({});
  const [customName, setCustomName] = useState('');
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [customModel, setCustomModel] = useState('');

  const handleToggle = (providerId: string, enabled: boolean) => {
    store.toggleProvider(providerId, enabled);
  };

  const handleTestConnection = async (providerId: string) => {
    setTestingId(providerId);
    try {
      const ok = await store.testConnection(providerId);
      setTestResult((prev) => ({ ...prev, [providerId]: ok }));
    } finally {
      setTestingId(null);
    }
  };

  const handleAddCustom = () => {
    if (!customName.trim() || !customEndpoint.trim()) return;
    const id = `custom-${Date.now()}`;
    const provider: AIProvider = {
      id,
      name: customName.trim(),
      protocol: 'openai-compatible',
      baseUrl: customEndpoint.trim(),
      defaultModel: customModel.trim() || 'gpt-4o',
      enabled: true,
      isBuiltIn: false
    };
    store.addCustomProvider(provider);
    setCustomName('');
    setCustomEndpoint('');
    setCustomModel('');
    setExpandedId(id);
  };

  const handleRemoveCustom = (providerId: string) => {
    store.removeCustomProvider(providerId);
    if (expandedId === providerId) setExpandedId(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-ink">{t.title}</h3>
        <p className="text-xs text-slate-500">{t.description}</p>
      </div>

      <div className="rounded-md border border-line bg-panel p-3 text-xs text-slate-600">
        {t.privacyNote}
      </div>

      <div className="space-y-1" data-testid="ai-provider-list">
        {store.providers.map((provider) => {
          const isExpanded = expandedId === provider.id;
          return (
            <div key={provider.id} className="rounded-md border border-line bg-white" data-testid={`ai-provider-${provider.id}`}>
              <div className="flex items-center gap-2 px-3 py-2">
                <button
                  className="flex items-center gap-1 text-left text-xs font-medium text-ink hover:text-blue-600"
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : provider.id)}
                >
                  {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  {provider.name}
                </button>
                {provider.id === 'ollama' && store.ollamaReachable ? (
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">{t.ollamaReachable}</span>
                ) : null}
                <div className="ml-auto flex items-center gap-2">
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={provider.enabled}
                      onChange={(e) => handleToggle(provider.id, e.target.checked)}
                      data-testid={`ai-provider-toggle-${provider.id}`}
                    />
                    <div className="h-4 w-7 rounded-full bg-slate-300 after:absolute after:left-[2px] after:top-[2px] after:h-3 after:w-3 after:rounded-full after:bg-white after:transition-all peer-checked:bg-blue-500 peer-checked:after:translate-x-3" />
                  </label>
                  {!provider.isBuiltIn ? (
                    <button
                      className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      type="button"
                      onClick={() => handleRemoveCustom(provider.id)}
                      title={t.removeCustom}
                      data-testid={`ai-provider-remove-${provider.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>
              {isExpanded ? (
                <div className="border-t border-line px-3 py-2 space-y-2" data-testid={`ai-provider-detail-${provider.id}`}>
                  <label className="block text-xs font-medium text-slate-600">
                    {t.endpoint}
                    <input
                      className="mt-1 w-full rounded-md border border-line bg-panel px-2 py-1.5 text-xs text-ink"
                      value={provider.baseUrl}
                      readOnly={provider.isBuiltIn && provider.id !== 'ollama'}
                      onChange={(e) => store.updateProvider(provider.id, { baseUrl: e.target.value })}
                      data-testid={`ai-provider-endpoint-${provider.id}`}
                    />
                  </label>
                  <label className="block text-xs font-medium text-slate-600">
                    {t.apiKey}
                    <input
                      className="mt-1 w-full rounded-md border border-line bg-panel px-2 py-1.5 text-xs text-ink"
                      type="password"
                      value={provider.apiKey ?? ''}
                      placeholder={provider.id === 'ollama' ? t.ollamaNoKey : ''}
                      onChange={(e) => void store.setProviderApiKey(provider.id, e.target.value)}
                      data-testid={`ai-provider-key-${provider.id}`}
                    />
                  </label>
                  <label className="block text-xs font-medium text-slate-600">
                    {t.model}
                    {provider.id === 'ollama' && store.ollamaModels.length > 0 ? (
                      <select
                        className="mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-xs text-ink"
                        value={provider.defaultModel}
                        onChange={(e) => store.updateProvider(provider.id, { defaultModel: e.target.value })}
                        data-testid={`ai-provider-model-select-${provider.id}`}
                      >
                        {store.ollamaModels.map((model) => (
                          <option key={model} value={model}>{model}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="mt-1 w-full rounded-md border border-line bg-panel px-2 py-1.5 text-xs text-ink"
                        value={provider.defaultModel}
                        onChange={(e) => store.updateProvider(provider.id, { defaultModel: e.target.value })}
                        data-testid={`ai-provider-model-${provider.id}`}
                      />
                    )}
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      className="flex items-center gap-1 rounded-md border border-line bg-panel px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-white disabled:opacity-50"
                      type="button"
                      disabled={testingId === provider.id}
                      onClick={() => void handleTestConnection(provider.id)}
                      data-testid={`ai-provider-test-${provider.id}`}
                    >
                      <TestTube className="h-3 w-3" />
                      {testingId === provider.id ? t.testing : t.testConnection}
                    </button>
                    {testResult[provider.id] === true ? (
                      <span className="text-[10px] font-medium text-emerald-700">{t.testOk}</span>
                    ) : null}
                    {testResult[provider.id] === false ? (
                      <span className="text-[10px] font-medium text-rose-700">{t.testFail}</span>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="rounded-md border border-line bg-panel p-3 space-y-2">
        <h4 className="text-xs font-semibold text-ink">{t.addCustomTitle}</h4>
        <div className="grid grid-cols-3 gap-2">
          <input
            className="rounded-md border border-line bg-white px-2 py-1.5 text-xs text-ink"
            placeholder={t.customNamePlaceholder}
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            data-testid="ai-custom-name"
          />
          <input
            className="rounded-md border border-line bg-white px-2 py-1.5 text-xs text-ink"
            placeholder={t.customEndpointPlaceholder}
            value={customEndpoint}
            onChange={(e) => setCustomEndpoint(e.target.value)}
            data-testid="ai-custom-endpoint"
          />
          <input
            className="rounded-md border border-line bg-white px-2 py-1.5 text-xs text-ink"
            placeholder={t.customModelPlaceholder}
            value={customModel}
            onChange={(e) => setCustomModel(e.target.value)}
            data-testid="ai-custom-model"
          />
        </div>
        <button
          className="rounded-md border border-line bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
          type="button"
          disabled={!customName.trim() || !customEndpoint.trim()}
          onClick={handleAddCustom}
          data-testid="ai-custom-add"
        >
          <Plug className="mr-1 inline h-3 w-3" />
          {t.addCustom}
        </button>
      </div>

      <div className="rounded-md border border-line bg-panel p-3 space-y-2">
        <h4 className="text-xs font-semibold text-ink">{t.serviceMappingTitle}</h4>
        {SERVICE_TYPES.map((service) => (
          <div key={service} className="flex items-center gap-2">
            <span className="w-28 text-xs text-slate-600">{t.serviceLabels[service]}</span>
            <select
              className="flex-1 rounded-md border border-line bg-white px-2 py-1 text-xs text-ink"
              value={store.serviceMapping[service] ?? ''}
              onChange={(e) => store.setServiceMapping(service, e.target.value)}
              data-testid={`ai-service-mapping-${service}`}
            >
              {store.providers.filter((p) => p.enabled).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <AIUsageStatsPanel />
    </div>
  );
}
