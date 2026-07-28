import { clsx } from 'clsx';
import { zhCN } from '../../i18n/strings';
import type { WorkspaceLayoutDefinition, WorkspaceLayoutId } from '../../layout/layoutSettings';

export function WorkspaceLayoutPicker({
  layouts,
  activeLayoutId,
  onApply,
  onSave,
}: {
  layouts: WorkspaceLayoutDefinition[];
  activeLayoutId: WorkspaceLayoutId;
  onApply(layoutId: WorkspaceLayoutId): void;
  onSave(): void;
}) {
  const t = zhCN.toolbar;
  const builtInLayouts = layouts.filter((layout) => layout.builtIn);
  const customLayouts = layouts.filter((layout) => !layout.builtIn);
  return (
    <div
      className="absolute left-0 top-10 z-30 w-72 rounded-md border border-line bg-white p-3 text-xs shadow-soft"
      data-testid="workspace-layout-picker"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="font-semibold text-slate-700">{t.workspaceLayout}</div>
        <button
          className="rounded border border-line bg-panel px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-white"
          type="button"
          data-testid="workspace-layout-save-button"
          onClick={onSave}
        >
          {t.saveWorkspaceLayout}
        </button>
      </div>
      <WorkspaceLayoutGroup
        title={t.builtInWorkspaceLayouts}
        layouts={builtInLayouts}
        activeLayoutId={activeLayoutId}
        onApply={onApply}
      />
      <div className="mt-3">
        <div className="mb-1 px-1 text-[11px] font-semibold uppercase text-slate-500">{t.customWorkspaceLayouts}</div>
        {customLayouts.length > 0 ? (
          <div className="space-y-1">
            {customLayouts.map((layout) => (
              <WorkspaceLayoutOption
                key={layout.id}
                layout={layout}
                active={layout.id === activeLayoutId}
                onApply={onApply}
              />
            ))}
          </div>
        ) : (
          <div
            className="rounded border border-dashed border-line px-2 py-3 text-center text-slate-500"
            data-testid="workspace-layout-empty-custom"
          >
            {t.noCustomWorkspaceLayouts}
          </div>
        )}
      </div>
    </div>
  );
}

function WorkspaceLayoutGroup({
  title,
  layouts,
  activeLayoutId,
  onApply,
}: {
  title: string;
  layouts: WorkspaceLayoutDefinition[];
  activeLayoutId: WorkspaceLayoutId;
  onApply(layoutId: WorkspaceLayoutId): void;
}) {
  return (
    <div>
      <div className="mb-1 px-1 text-[11px] font-semibold uppercase text-slate-500">{title}</div>
      <div className="space-y-1">
        {layouts.map((layout) => (
          <WorkspaceLayoutOption
            key={layout.id}
            layout={layout}
            active={layout.id === activeLayoutId}
            onApply={onApply}
          />
        ))}
      </div>
    </div>
  );
}

function WorkspaceLayoutOption({
  layout,
  active,
  onApply,
}: {
  layout: WorkspaceLayoutDefinition;
  active: boolean;
  onApply(layoutId: WorkspaceLayoutId): void;
}) {
  const t = zhCN.toolbar;
  const name = layout.builtIn
    ? (t.workspaceLayouts[layout.id as keyof typeof t.workspaceLayouts] ?? layout.name)
    : layout.name;
  return (
    <button
      className={clsx(
        'flex w-full items-center justify-between gap-2 rounded-md border px-2 py-2 text-left hover:bg-panel',
        active ? 'border-brand bg-brand/5 text-brand' : 'border-line text-slate-700',
      )}
      type="button"
      data-testid={`workspace-layout-option-${layout.id}`}
      aria-pressed={active}
      onClick={() => onApply(layout.id)}
    >
      <span className="min-w-0 truncate font-medium">{name}</span>
      <span className="shrink-0 text-[11px] text-slate-500">
        {active ? t.workspaceLayoutActive : layout.shortcutSlot ? t.workspaceShortcut(layout.shortcutSlot) : ''}
      </span>
    </button>
  );
}
