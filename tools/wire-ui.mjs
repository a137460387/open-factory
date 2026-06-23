import { readFileSync, writeFileSync } from 'fs';

// ====== EditorShell.tsx ======
let es = readFileSync('apps/desktop/src/components/EditorShell.tsx', 'utf8');

// 1. Add lazy imports after ThumbnailGeneratorDialog
const lazyImportAnchor = "const ThumbnailGeneratorDialog = lazy(() => import('../thumbnail/ThumbnailGeneratorDialog').then((module) => ({ default: module.ThumbnailGeneratorDialog })));";
const lazyInsert = `
const ErrorKnowledgeDialog = lazy(() => import('../export-error-knowledge/ErrorKnowledgeDialog').then((module) => ({ default: module.ErrorKnowledgeDialog })));
const SequenceCompareDialog = lazy(() => import('../sequence-compare/SequenceCompareDialog').then((module) => ({ default: module.SequenceCompareDialog })));
const SubtitleSyncPanel = lazy(() => import('../subtitle-sync-monitor/SubtitleSyncPanel').then((module) => ({ default: module.SubtitleSyncPanel })));
const ProxyBatchVerifyDialog = lazy(() => import('../proxy-batch-verify/ProxyBatchVerifyDialog').then((module) => ({ default: module.ProxyBatchVerifyDialog })));`;
if (!es.includes("ErrorKnowledgeDialog")) {
  es = es.replace(lazyImportAnchor, lazyImportAnchor + lazyInsert);
  console.log('[EditorShell] Added lazy imports');
} else {
  console.log('[EditorShell] Lazy imports already present');
}

// 2. Add useState hooks after autoAudioSyncOpen
const stateAnchor = "const [autoAudioSyncOpen, setAutoAudioSyncOpen] = useState(false);";
const stateInsert = `
  const [errorKnowledgeOpen, setErrorKnowledgeOpen] = useState(false);
  const [sequenceCompareOpen, setSequenceCompareOpen] = useState(false);
  const [subtitleSyncOpen, setSubtitleSyncOpen] = useState(false);
  const [proxyVerifyOpen, setProxyVerifyOpen] = useState(false);`;
if (!es.includes("errorKnowledgeOpen")) {
  es = es.replace(stateAnchor, stateAnchor + stateInsert);
  console.log('[EditorShell] Added useState hooks');
} else {
  console.log('[EditorShell] useState hooks already present');
}

// 3. Add toolbar callbacks near onOpenSettings
const toolbarAnchor = 'onOpenSettings={() => setSettingsOpen(true)}';
const toolbarInsert = `
              onOpenErrorKnowledge={() => setErrorKnowledgeOpen(true)}
              onOpenSequenceCompare={() => setSequenceCompareOpen(true)}
              onOpenSubtitleSync={() => setSubtitleSyncOpen(true)}
              onOpenProxyVerify={() => setProxyVerifyOpen(true)}`;
if (!es.includes("onOpenErrorKnowledge")) {
  es = es.replace(toolbarAnchor, toolbarAnchor + toolbarInsert);
  console.log('[EditorShell] Added toolbar callbacks');
} else {
  console.log('[EditorShell] Toolbar callbacks already present');
}

// 4. Render dialogs before </Suspense>
const suspenseCloseAnchor = '</Suspense>';
const lastSuspenseIdx = es.lastIndexOf(suspenseCloseAnchor);
if (lastSuspenseIdx > 0 && !es.includes("ErrorKnowledgeDialog")) {
  // Find the line before </Suspense> to insert before it
  const beforeSuspense = es.substring(0, lastSuspenseIdx);
  const afterSuspense = es.substring(lastSuspenseIdx);
  const dialogInsert = `
          {errorKnowledgeOpen ? (
            <ErrorKnowledgeDialog
              stderr=""
              onClose={() => setErrorKnowledgeOpen(false)}
            />
          ) : null}
          {sequenceCompareOpen ? (
            <SequenceCompareDialog
              project={project}
              onClose={() => setSequenceCompareOpen(false)}
            />
          ) : null}
          {subtitleSyncOpen ? (
            <SubtitleSyncPanel
              tracks={project.timeline.tracks}
              timingRefs={[]}
              projectDuration={getTimelinePlaybackDuration(project.timeline)}
              onClose={() => setSubtitleSyncOpen(false)}
              onRepairSubtitle={(id, start, duration) => {
                commandManager.execute(new UpdateClipCommand(projectAccessor, id, { start, duration }));
              }}
            />
          ) : null}
          {proxyVerifyOpen ? (
            <ProxyBatchVerifyDialog
              media={project.media}
              onClose={() => setProxyVerifyOpen(false)}
            />
          ) : null}
`;
  es = beforeSuspense + dialogInsert + afterSuspense;
  console.log('[EditorShell] Added dialog rendering');
} else {
  console.log('[EditorShell] Dialog rendering already present or Suspense not found');
}

writeFileSync('apps/desktop/src/components/EditorShell.tsx', es, 'utf8');
console.log('[EditorShell] Done');

// ====== Toolbar.tsx ======
let tb = readFileSync('apps/desktop/src/components/Toolbar.tsx', 'utf8');

// 1. Add new props to ToolbarProps interface
const lastToolbarProp = "onOpenMacroHistory(): void;";
const newToolbarProps = `
  onOpenErrorKnowledge(): void;
  onOpenSequenceCompare(): void;
  onOpenSubtitleSync(): void;
  onOpenProxyVerify(): void;`;
if (!tb.includes("onOpenErrorKnowledge")) {
  tb = tb.replace(lastToolbarProp, lastToolbarProp + newToolbarProps);
  console.log('[Toolbar] Added new props to interface');
} else {
  console.log('[Toolbar] Props already present');
}

// 2. Add menu items - Error Knowledge in tools menu near color analysis
const colorAnalysisAnchor = 'data-testid="toolbar-tools-color-analysis-menu-item"';
if (tb.includes(colorAnalysisAnchor) && !tb.includes('toolbar-tools-error-knowledge')) {
  // Find the closing tag of color analysis button and insert after it
  const idx = tb.indexOf(colorAnalysisAnchor);
  // Find the next </button> after this point
  const btnClose = tb.indexOf('</button>', idx);
  const insertAfter = btnClose + '</button>'.length;
  const errorKnowledgeItem = `
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-tools-error-knowledge-menu-item"
              onClick={() => {
                setToolsMenuOpen(false);
                props.onOpenErrorKnowledge();
              }}
            >
              <span>{t.errorKnowledge?.title ?? '\u5bfc\u51fa\u9519\u8bef\u8bca\u65ad'}</span>
            </button>`;
  tb = tb.substring(0, insertAfter) + '\n' + errorKnowledgeItem + tb.substring(insertAfter);
  console.log('[Toolbar] Added error knowledge menu item in tools');
} else {
  console.log('[Toolbar] Error knowledge menu item already present or anchor not found');
}

// 3. Add Sequence Compare in view menu near timeline compare
const timelineCompareAnchor = 'data-testid="toolbar-view-timeline-compare"';
if (tb.includes(timelineCompareAnchor) && !tb.includes('toolbar-view-sequence-compare')) {
  const idx = tb.indexOf(timelineCompareAnchor);
  const btnClose = tb.indexOf('</button>', idx);
  const insertAfter = btnClose + '</button>'.length;
  const seqCompareItem = `
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-view-sequence-compare"
              onClick={() => {
                setViewMenuOpen(false);
                props.onOpenSequenceCompare();
              }}
            >
              <span>{t.sequenceCompare?.title ?? '\u5e8f\u5217\u5bf9\u6bd4'}</span>
            </button>`;
  tb = tb.substring(0, insertAfter) + '\n' + seqCompareItem + tb.substring(insertAfter);
  console.log('[Toolbar] Added sequence compare menu item in view');
} else {
  console.log('[Toolbar] Sequence compare menu item already present or anchor not found');
}

// 4. Add Subtitle Sync in tools menu
const rhythmAnchor = 'data-testid="toolbar-tools-rhythm-analysis-menu-item"';
if (tb.includes(rhythmAnchor) && !tb.includes('toolbar-tools-subtitle-sync')) {
  const idx = tb.indexOf(rhythmAnchor);
  const btnClose = tb.indexOf('</button>', idx);
  const insertAfter = btnClose + '</button>'.length;
  const subtitleSyncItem = `
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-tools-subtitle-sync-menu-item"
              onClick={() => {
                setToolsMenuOpen(false);
                props.onOpenSubtitleSync();
              }}
            >
              <span>{t.subtitleSyncMonitor?.title ?? '\u5b57\u5e55\u540c\u6b65\u68c0\u6d4b'}</span>
            </button>`;
  tb = tb.substring(0, insertAfter) + '\n' + subtitleSyncItem + tb.substring(insertAfter);
  console.log('[Toolbar] Added subtitle sync menu item in tools');
} else {
  console.log('[Toolbar] Subtitle sync menu item already present or anchor not found');
}

// 5. Add Proxy Verify in tools menu
const precheckAnchor = 'data-testid="toolbar-tools-media-precheck-menu-item"';
if (tb.includes(precheckAnchor) && !tb.includes('toolbar-tools-proxy-verify')) {
  const idx = tb.indexOf(precheckAnchor);
  const btnClose = tb.indexOf('</button>', idx);
  const insertAfter = btnClose + '</button>'.length;
  const proxyVerifyItem = `
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"
              type="button"
              data-testid="toolbar-tools-proxy-verify-menu-item"
              onClick={() => {
                setToolsMenuOpen(false);
                props.onOpenProxyVerify();
              }}
            >
              <span>{t.proxyBatchVerify?.title ?? '\u4ee3\u7406\u9a8c\u8bc1'}</span>
            </button>`;
  tb = tb.substring(0, insertAfter) + '\n' + proxyVerifyItem + tb.substring(insertAfter);
  console.log('[Toolbar] Added proxy verify menu item in tools');
} else {
  console.log('[Toolbar] Proxy verify menu item already present or anchor not found');
}

writeFileSync('apps/desktop/src/components/Toolbar.tsx', tb, 'utf8');
console.log('[Toolbar] Done');

console.log('\\n=== All UI wiring complete ===');

