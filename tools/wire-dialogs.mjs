import { readFileSync, writeFileSync } from 'fs';

// ====== Fix EditorShell.tsx - add dialog rendering ======
let es = readFileSync('apps/desktop/src/components/EditorShell.tsx', 'utf8');

if (!es.includes('<ErrorKnowledgeDialog')) {
  // Find the MacroHistoryDialog line and insert after it
  const macroDialogAnchor = "{macroHistoryOpen ? <MacroHistoryDialog entries={macroHistory} onClose={() => setMacroHistoryOpen(false)} /> : null}";
  const dialogJSX = macroDialogAnchor + `
          {errorKnowledgeOpen ? (
            <ErrorKnowledgeDialog
              stderr={""}
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
              projectDuration={getTimelineDuration(project.timeline)}
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
          ) : null}`;
  es = es.replace(macroDialogAnchor, dialogJSX);
  writeFileSync('apps/desktop/src/components/EditorShell.tsx', es, 'utf8');
  console.log('[EditorShell] Added dialog rendering JSX');
} else {
  console.log('[EditorShell] Dialog rendering already present');
}

// ====== Fix Toolbar.tsx - add sequence compare menu ======
let tb = readFileSync('apps/desktop/src/components/Toolbar.tsx', 'utf8');

if (!tb.includes('toolbar-view-sequence-compare')) {
  const lines = tb.split('\n');
  let insertAfter = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('toolbar-view-timeline-compare') && lines[i].includes('data-testid')) {
      // Find the closing </button> after this
      for (let j = i; j < Math.min(i + 10, lines.length); j++) {
        if (lines[j].includes('</button>')) {
          insertAfter = j;
          break;
        }
      }
      break;
    }
  }
  if (insertAfter >= 0) {
    const newItem = [
      '            <button',
      '              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-panel"',
      '              type="button"',
      '              data-testid="toolbar-view-sequence-compare"',
      '              onClick={() => {',
      '                setViewMenuOpen(false);',
      '                props.onOpenSequenceCompare();',
      '              }}',
      '            >',
      "              <span>{t.sequenceCompare?.title ?? '\u5e8f\u5217\u5bf9\u6bd4'}</span>",
      '            </button>',
    ].join('\n');
    lines.splice(insertAfter + 1, 0, newItem);
    tb = lines.join('\n');
    writeFileSync('apps/desktop/src/components/Toolbar.tsx', tb, 'utf8');
    console.log('[Toolbar] Added sequence compare menu item');
  } else {
    console.log('[Toolbar] Could not find timeline compare anchor');
  }
} else {
  console.log('[Toolbar] Sequence compare already present');
}

console.log('Done');

