import {
  BUILT_IN_TIMELINE_TEMPLATES,
  getMissingTimelineTemplatePlaceholders,
  instantiateTimelineTemplateProject,
  renderTimelineTemplatePreviewSvg,
  serializeTimelineTemplate,
  type Project,
  type TimelineTemplateDefinition,
  type TimelineTemplatePlaceholderBindings
} from '@open-factory/editor-core';
import { X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { zhCN } from '../i18n/strings';
import { openFileDialog } from '../lib/tauri-bridge';
import { showToast } from '../lib/toast';
import { loadTimelineTemplates, saveTimelineTemplate } from './timelineTemplates';

interface TimelineTemplateDialogProps {
  mode: 'save' | 'new';
  project: Project;
  selectedClipIds: string[];
  onCreate(project: Project): void;
  onSaved(): void;
  onClose(): void;
}

export function TimelineTemplateDialog({ mode, project, selectedClipIds, onCreate, onSaved, onClose }: TimelineTemplateDialogProps) {
  const copy = zhCN.timelineTemplates;
  const [name, setName] = useState(project.name || copy.defaultName);
  const [templates, setTemplates] = useState<TimelineTemplateDefinition[]>([...BUILT_IN_TIMELINE_TEMPLATES]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(BUILT_IN_TIMELINE_TEMPLATES[0]?.id ?? '');
  const [bindings, setBindings] = useState<TimelineTemplatePlaceholderBindings>({});
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? templates[0];
  const previewSvg = useMemo(() => (selectedTemplate ? renderTimelineTemplatePreviewSvg(selectedTemplate, { width: 560 }) : ''), [selectedTemplate]);
  const missingPlaceholders = selectedTemplate ? getMissingTimelineTemplatePlaceholders(selectedTemplate, bindings) : [];

  useEffect(() => {
    if (mode !== 'new') {
      return;
    }
    let canceled = false;
    loadTimelineTemplates()
      .then((loaded) => {
        if (!canceled) {
          setTemplates(loaded);
          setSelectedTemplateId(loaded[0]?.id ?? '');
        }
      })
      .catch((error) => {
        console.warn('Unable to load timeline templates', error);
        showToast({ kind: 'warning', title: copy.loadFailed, message: error instanceof Error ? error.message : copy.loadFailedMessage });
      });
    return () => {
      canceled = true;
    };
  }, [copy.loadFailed, copy.loadFailedMessage, mode]);

  const saveTemplate = async () => {
    try {
      const template = serializeTimelineTemplate(project, {
        name,
        clipIds: selectedClipIds.length > 0 ? selectedClipIds : undefined
      });
      await saveTimelineTemplate(template);
      showToast({ kind: 'success', title: copy.savedTitle, message: copy.savedMessage(template.name) });
      onSaved();
    } catch (error) {
      showToast({ kind: 'warning', title: copy.saveFailed, message: error instanceof Error ? error.message : copy.saveFailedMessage });
    }
  };

  const choosePlaceholderFile = async (placeholderId: string) => {
    const paths = await openFileDialog(false, [{ name: zhCN.fileDialogs.media, extensions: ['mp4', 'mov', 'webm', 'mkv', 'mp3', 'wav', 'png', 'jpg', 'jpeg'] }]);
    const path = paths[0];
    if (!path) {
      return;
    }
    setBindings((current) => ({ ...current, [placeholderId]: path }));
  };

  const createFromTemplate = () => {
    if (!selectedTemplate) {
      return;
    }
    const fallbackBindings: TimelineTemplatePlaceholderBindings = {};
    for (const placeholder of selectedTemplate.placeholders) {
      fallbackBindings[placeholder.id] = bindings[placeholder.id] ?? placeholder.originalPath ?? '';
    }
    onCreate(instantiateTimelineTemplateProject(selectedTemplate, fallbackBindings));
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 p-4" data-testid="timeline-template-dialog">
      <section className="grid max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-md border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">{mode === 'save' ? copy.saveTitle : copy.newTitle}</h2>
            <p className="text-xs text-slate-500">{mode === 'save' ? copy.saveSubtitle : copy.newSubtitle}</p>
          </div>
          <button className="rounded p-1 text-slate-500 hover:bg-panel" type="button" aria-label={copy.close} data-testid="timeline-template-close-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto p-4">
          {mode === 'save' ? (
            <div className="space-y-3">
              <label className="block text-xs font-medium text-slate-600">
                {copy.name}
                <input
                  className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink"
                  value={name}
                  data-testid="timeline-template-name-input"
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <div className="rounded-md border border-line bg-panel p-3 text-xs text-slate-600" data-testid="timeline-template-selection-summary">
                {selectedClipIds.length > 0 ? copy.selectedClipSummary(selectedClipIds.length) : copy.wholeTimelineSummary}
              </div>
              <button
                className="inline-flex h-9 items-center rounded-md bg-brand px-3 text-sm font-semibold text-white hover:bg-[#176858]"
                type="button"
                data-testid="timeline-template-save-button"
                onClick={() => void saveTemplate()}
              >
                {copy.save}
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
              <div className="space-y-2">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    className={`w-full rounded-md border p-3 text-left ${selectedTemplateId === template.id ? 'border-brand bg-panel' : 'border-line bg-white hover:bg-panel'}`}
                    type="button"
                    data-testid="timeline-template-card"
                    onClick={() => {
                      setSelectedTemplateId(template.id);
                      setBindings({});
                    }}
                  >
                    <div className="text-sm font-semibold text-ink">{template.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{template.description ?? copy.customTemplate}</div>
                    <div className="mt-2 text-[11px] font-medium text-slate-500">{copy.trackCount(template.tracks.length)}</div>
                  </button>
                ))}
              </div>
              {selectedTemplate ? (
                <div className="min-w-0 space-y-3">
                  <div className="overflow-hidden rounded-md border border-line bg-panel p-2" data-testid="timeline-template-preview" dangerouslySetInnerHTML={{ __html: previewSvg }} />
                  {selectedTemplate.placeholders.length > 0 ? (
                    <div className="space-y-2" data-testid="timeline-template-placeholders">
                      {selectedTemplate.placeholders.map((placeholder) => (
                        <div key={placeholder.id} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-md border border-line bg-white p-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-ink">{placeholder.name}</div>
                            <div className="truncate text-xs text-slate-500">{bindingLabel(bindings[placeholder.id]) ?? placeholder.originalPath ?? copy.notSelected}</div>
                          </div>
                          <button
                            className="rounded-md border border-line bg-panel px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white"
                            type="button"
                            data-testid={`timeline-template-placeholder-${placeholder.id}`}
                            onClick={() => void choosePlaceholderFile(placeholder.id)}
                          >
                            {copy.chooseFile}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <button
                    className="inline-flex h-9 items-center rounded-md bg-brand px-3 text-sm font-semibold text-white hover:bg-[#176858]"
                    type="button"
                    data-testid="timeline-template-create-button"
                    onClick={createFromTemplate}
                  >
                    {missingPlaceholders.length > 0 ? copy.createWithMissing(missingPlaceholders.length) : copy.create}
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function bindingLabel(binding: TimelineTemplatePlaceholderBindings[string]): string | undefined {
  if (typeof binding === 'string') {
    return binding || undefined;
  }
  return binding?.path;
}
