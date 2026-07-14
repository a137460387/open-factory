import { PROJECT_TEMPLATES, type ProjectTemplateId } from '@open-factory/editor-core';
import { X } from 'lucide-react';
import { zhCN } from '../i18n/strings';

interface ProjectTemplateDialogProps {
  onSelect(templateId: ProjectTemplateId): void;
  onClose(): void;
}

const TEMPLATE_COPY: Record<ProjectTemplateId, { name: string; description: string }> = {
  'vertical-short': zhCN.projectTemplates.templates.verticalShort,
  'youtube-horizontal': zhCN.projectTemplates.templates.youtubeHorizontal,
  'square-social': zhCN.projectTemplates.templates.squareSocial,
  podcast: zhCN.projectTemplates.templates.podcast,
  cinema: zhCN.projectTemplates.templates.cinema,
};

export function ProjectTemplateDialog({ onSelect, onClose }: ProjectTemplateDialogProps) {
  const t = zhCN.projectTemplates;
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 p-4"
      data-testid="project-template-dialog"
    >
      <section className="w-full max-w-2xl rounded-md border border-line bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">{t.title}</h2>
            <p className="text-xs text-slate-500">{t.subtitle}</p>
          </div>
          <button
            className="rounded p-1 text-slate-500 hover:bg-panel"
            aria-label={t.close}
            onClick={onClose}
            data-testid="project-template-close-button"
          >
            <X size={18} />
          </button>
        </div>
        <div className="grid gap-2 p-4 sm:grid-cols-2">
          {PROJECT_TEMPLATES.map((template) => {
            const copy = TEMPLATE_COPY[template.id];
            return (
              <button
                key={template.id}
                className="rounded-md border border-line p-3 text-left transition hover:border-brand hover:bg-panel"
                type="button"
                data-testid={`project-template-${template.id}`}
                onClick={() => onSelect(template.id)}
              >
                <div className="text-sm font-semibold text-ink">{copy.name}</div>
                <div className="mt-1 text-xs text-slate-500">{copy.description}</div>
                <div className="mt-3 text-xs font-medium text-brand">{t.select}</div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
