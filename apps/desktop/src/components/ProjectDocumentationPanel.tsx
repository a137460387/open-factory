import { useEffect, useState } from 'react';
import {
  PROJECT_DOCUMENTATION_SECTIONS,
  UpdateProjectDocumentationCommand,
  buildProjectDocumentationHtml,
  renderSimpleMarkdown,
  type Project,
  type ProjectDocumentation
} from '@open-factory/editor-core';
import DOMPurify from 'dompurify';
import { Download } from 'lucide-react';
import { zhCN } from '../i18n/strings';
import { commandManager, projectAccessor } from '../store/commandManager';
import { saveFileDialog, writeFile } from '../lib/tauri-bridge';
import { showToast } from '../lib/toast';

interface ProjectDocumentationPanelProps {
  project: Project;
}

export function ProjectDocumentationPanel({ project }: ProjectDocumentationPanelProps) {
  const [draft, setDraft] = useState<ProjectDocumentation>(project.documentation ?? {});

  useEffect(() => {
    setDraft(project.documentation ?? {});
  }, [project.documentation]);

  const commitSection = (sectionId: string, value: string) => {
    const next = { ...project.documentation, [sectionId]: value };
    commandManager.execute(new UpdateProjectDocumentationCommand(projectAccessor, next));
  };

  const exportHtml = async () => {
    try {
      const outputPath = await saveFileDialog(`${project.name || 'open-factory'}-项目文档.html`, [{ name: zhCN.fileDialogs.htmlReport, extensions: ['html', 'htm'] }]);
      if (!outputPath) {
        return;
      }
      await writeFile(outputPath, buildProjectDocumentationHtml({ ...project, documentation: draft }));
      showToast({ kind: 'success', title: zhCN.projectDocumentation.exported, message: outputPath });
    } catch (error) {
      showToast({ kind: 'warning', title: zhCN.projectDocumentation.exportFailed, message: error instanceof Error ? error.message : zhCN.projectDocumentation.exportFailedMessage });
    }
  };

  return (
    <aside className="flex min-h-0 flex-col bg-white" data-testid="project-documentation-panel">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{zhCN.projectDocumentation.title}</div>
          <div className="text-xs text-slate-500">{zhCN.projectDocumentation.subtitle}</div>
        </div>
        <button
          className="rounded-md border border-line p-2 text-slate-700 hover:bg-panel"
          type="button"
          title={zhCN.projectDocumentation.exportHtml}
          aria-label={zhCN.projectDocumentation.exportHtml}
          data-testid="project-documentation-export-button"
          onClick={() => void exportHtml()}
        >
          <Download size={16} />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {PROJECT_DOCUMENTATION_SECTIONS.map((section) => {
          const value = draft[section.id] ?? '';
          const sectionTitle = zhCN.projectDocumentation.sections[section.id];
          return (
            <details key={section.id} className="rounded-md border border-line bg-white" open data-testid={`project-documentation-section-${section.id}`}>
              <summary className="cursor-pointer px-2 py-2 text-xs font-semibold text-slate-700">{sectionTitle}</summary>
              <div className="space-y-2 border-t border-line p-2">
                <textarea
                  className="min-h-28 w-full rounded-md border border-line px-2 py-1.5 text-sm text-ink"
                  value={value}
                  placeholder={zhCN.projectDocumentation.placeholder(sectionTitle)}
                  data-testid={`project-documentation-input-${section.id}`}
                  onChange={(event) => setDraft((current) => ({ ...current, [section.id]: event.target.value }))}
                  onBlur={(event) => commitSection(section.id, event.target.value)}
                />
                <div
                  className="prose prose-sm max-w-none rounded-md bg-panel p-2 text-xs text-slate-700"
                  data-testid={`project-documentation-preview-${section.id}`}
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderSimpleMarkdown(value) || `<p>${zhCN.projectDocumentation.emptyPreview}</p>`) }}
                />
              </div>
            </details>
          );
        })}
      </div>
    </aside>
  );
}
