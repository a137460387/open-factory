import re
import os

EXPORT_DIALOG = 'apps/desktop/src/export/ExportDialog.tsx'
COMPONENTS_DIR = 'apps/desktop/src/export/components'

with open(EXPORT_DIALOG, 'r', encoding='utf-8') as f:
    lines = f.readlines()

def find_functions(lines):
    funcs = []
    i = 0
    while i < len(lines):
        m = re.match(r'^(export )?function ([A-Z]\w+)\(', lines[i])
        if m:
            name = m.group(2)
            start = i
            depth = 0
            for j in range(i, len(lines)):
                depth += lines[j].count('{') - lines[j].count('}')
                if depth == 0 and j > start:
                    funcs.append((name, start, j))
                    i = j + 1
                    break
            else:
                i += 1
        else:
            i += 1
    return funcs

funcs = find_functions(lines)
func_map = {name: (start, end) for name, start, end in funcs}

component_groups = [
    ('PipelineSection.tsx', ['PipelineSection']),
    ('VersionedBatchReportTable.tsx', ['VersionedBatchReportTable']),
    ('MasterProcessingSection.tsx', ['MasterProcessingSection']),
    ('SubtitleLanguageSection.tsx', ['SubtitleLanguageSection']),
    ('ColorManagementSection.tsx', ['ColorManagementSection']),
    ('AudioVisualizationSection.tsx', ['ThemePreviewButton', 'AudioVisualizationSection']),
    ('MonitoringAndPostScript.tsx', ['MonitoringSection', 'PostExportScriptSection']),
    ('WatermarkSection.tsx', ['WatermarkSection']),
    ('AIExportSuggestionPanel.tsx', ['AIExportSuggestionPanel']),
]

def build_imports(func_text):
    """Build import statements based on function content."""
    imports = []

    # editor-core
    ec_items = []
    ec_fns = [
        'normalizeExportMasterProcessing', 'hasExportMasterProcessing',
        'normalizeExportColorManagement', 'normalizeSubtitleLanguageList',
        'normalizeSubtitleLanguage', 'normalizeTargetAspectRatio',
        'clampReframeOffset', 'EXPORT_COLOR_SPACES',
        'BUILTIN_AUDIO_VISUALIZATION_THEMES', 'expandAudioVisualizationTheme',
        'upsertCustomAudioVisualizationTheme', 'removeCustomAudioVisualizationTheme',
        'MANUAL_AUDIO_VISUALIZATION_THEME_ID', 'isProviderConfigured',
        'buildExportProjectInfo', 'buildExportOptimizationSystemPrompt',
        'buildExportOptimizationUserPrompt', 'parseExportOptimizationResponse',
        'sortExportSuggestionsByPriority', 'EXPORT_SUGGESTION_CACHE_TTL_MS',
        'applyExportOptimizationSuggestion',
    ]
    for fn in ec_fns:
        if re.search(r'\b' + fn + r'\b', func_text):
            ec_items.append(fn)
    ec_types = [
        'ExportPipeline', 'ExportPipelineNodeStatus', 'ExportPublishNodeLog',
        'VersionedExportReportRow', 'ExportLoudnessNormalization',
        'CustomAudioVisualizationTheme', 'AudioVisualizationThemeDefinition',
        'ExportAudioVisualizationStyle', 'ExportAudioVisualizationBackground',
        'ExportSubtitleFormat', 'AIExportSuggestion', 'Project', 'TargetAspectRatio',
    ]
    for t in ec_types:
        if re.search(r'\b' + t + r'\b', func_text):
            ec_items.append(f'type {t}')
    if ec_items:
        imports.append('import {\n  ' + ',\n  '.join(ec_items) + ',\n} from \'@open-factory/editor-core\';')

    # React
    react_items = []
    for ri in ['useState', 'useEffect', 'useMemo', 'useRef']:
        if re.search(r'\b' + ri + r'\b', func_text):
            react_items.append(ri)
    type_items = []
    for ti in ['Dispatch', 'SetStateAction', 'ReactNode']:
        if re.search(r'\b' + ti + r'\b', func_text):
            type_items.append(ti)
    if react_items or type_items:
        parts = []
        if react_items:
            parts.extend(react_items)
        if type_items:
            parts.extend([f'type {t}' for t in type_items])
        imports.append('import { ' + ', '.join(parts) + ' } from \'react\';')

    # zhCN
    if 'zhCN' in func_text:
        imports.append('import { zhCN } from \'../../i18n/strings\';')

    # lucide-react
    lucide_icons = []
    for icon in ['Cloud', 'CloudDownload', 'Clock3', 'Download', 'FolderOpen', 'Image as ImageIcon', 'ListPlus', 'Loader2', 'Minimize2', 'Save', 'Trash2', 'Upload', 'X']:
        simple = icon.split(' as ')[0]
        if re.search(r'\b' + simple + r'\b', func_text):
            lucide_icons.append(icon)
    if lucide_icons:
        imports.append('import { ' + ', '.join(lucide_icons) + ' } from \'lucide-react\';')

    # pipelineHelpers
    ph = []
    if 'pipelineStatusClass' in func_text:
        ph.append('pipelineStatusClass')
    if 'formatDuration' in func_text:
        ph.append('formatDuration')
    if ph:
        imports.append('import { ' + ', '.join(ph) + ' } from \'../lib/pipelineHelpers\';')

    # exportFormatHelpers
    efh = []
    for ef in ['formatBytes', 'formatMilliseconds', 'formatOptionalNumber', 'priorityLabel']:
        if ef in func_text:
            efh.append(ef)
    if efh:
        imports.append('import { ' + ', '.join(efh) + ' } from \'../lib/exportFormatHelpers\';')

    # PresetFields
    pf = []
    for p in ['PresetSelectField', 'PresetNumberField', 'PresetTextField', 'PresetColorField', 'PresetCheckboxField', 'WatermarkNumberField']:
        if re.search(r'\b' + p + r'\b', func_text):
            pf.append(p)
    if pf:
        imports.append('import { ' + ', '.join(pf) + ' } from \'./PresetFields\';')

    # exportSettingsHelpers
    sh = []
    sh_fns = [
        'WATERMARK_POSITIONS', 'AUDIO_VISUALIZATION_FORMATS',
        'AUDIO_VISUALIZATION_STYLES', 'AUDIO_VISUALIZATION_BACKGROUND_TYPES',
        'DEFAULT_TIMECODE_BURN_IN', 'DEFAULT_AUDIO_VISUALIZATION',
        'SubtitleLanguageOption',
        'normalizeWatermarkPosition', 'isWatermarkPosition', 'imageWatermarkFrom', 'textWatermarkFrom',
        'enableWatermark', 'updateWatermarkEnabled', 'updateWatermarkType', 'updateWatermarkPosition',
        'updateImageWatermarkPath', 'updateImageWatermarkScale', 'updateImageWatermarkOpacity',
        'updateTextWatermarkText', 'updateTextWatermarkFont', 'updateTextWatermarkColor',
        'updateTextWatermarkSize',
        'updateMasterEqEnabled', 'updateMasterEqBand', 'updateMasterStereoEnabled',
        'updateMasterStereoAmount', 'updateMasterLimiterEnabled', 'updateMasterLimiterLevel',
        'updateLoudnessNormalization', 'updateColorManagement',
        'updateSubtitleLanguageSelection', 'updateSubtitleBurnInLanguage',
        'updatePostExportScriptCommand', 'updateTimecodeBurnInEnabled',
        'updateTimecodeBurnInPosition', 'updateTimecodeBurnInFontSize',
        'updateTimecodeBurnInColor', 'updateTimecodeBurnInFrameNumber',
        'updateSlateEnabled', 'timecodeBurnInFrom',
        'updateAudioVisualizationStyle', 'updateAudioVisualizationTheme',
        'updateAudioVisualizationColor', 'updateAudioVisualizationBackgroundType',
        'updateAudioVisualizationBackgroundColor', 'updateAudioVisualizationBackgroundImagePath',
        'updateReframeOffset',
    ]
    for s in sh_fns:
        if re.search(r'\b' + s + r'\b', func_text):
            sh.append(s)
    if sh:
        imports.append('import {\n  ' + ',\n  '.join(sorted(sh)) + ',\n} from \'../lib/exportSettingsHelpers\';')

    # appSettings
    app = []
    if 'readAudioVisualizationThemeSettings' in func_text:
        app.append('readAudioVisualizationThemeSettings')
    if 'saveAudioVisualizationThemeSettings' in func_text:
        app.append('saveAudioVisualizationThemeSettings')
    if app:
        imports.append('import { ' + ', '.join(app) + ' } from \'../../settings/appSettings\';')

    # tauri-bridge
    tb = []
    if 'callAiApi' in func_text:
        tb.append('callAiApi')
    if 'readAiApiKey' in func_text:
        tb.append('readAiApiKey')
    if tb:
        imports.append('import { ' + ', '.join(tb) + ' } from \'../../lib/tauri-bridge\';')

    # showToast
    if 'showToast' in func_text:
        imports.append('import { showToast } from \'../../lib/toast\';')

    # useAISettingsStore
    if 'useAISettingsStore' in func_text:
        imports.append('import { useAISettingsStore } from \'../../store/aiSettingsStore\';')

    # drawAudioVisualizationThemePreviewFrame
    if 'drawAudioVisualizationThemePreviewFrame' in func_text:
        imports.append('import { drawAudioVisualizationThemePreviewFrame } from \'../../media/audioVisualizationThemePreview\';')

    return imports

# Create component files
for comp_file, func_names in component_groups:
    comp_path = os.path.join(COMPONENTS_DIR, comp_file)
    all_func_code = []
    for fname in func_names:
        if fname not in func_map:
            print(f"WARNING: {fname} not found!")
            continue
        start, end = func_map[fname]
        func_code = lines[start:end+1]
        if not func_code[0].startswith('export '):
            func_code[0] = 'export ' + func_code[0]
        all_func_code.extend(func_code)
        all_func_code.append('\n')

    func_text = ''.join(all_func_code)
    import_stmts = build_imports(func_text)

    with open(comp_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(import_stmts) + '\n\n')
        f.write(func_text)

    line_count = len(func_text.splitlines())
    print(f"Created {comp_path} ({line_count} lines)")

# Now modify ExportDialog.tsx
# Build list of ranges to remove
remove_ranges = []
for comp_file, func_names in component_groups:
    for fname in func_names:
        if fname in func_map:
            start, end = func_map[fname]
            if end + 1 < len(lines) and lines[end + 1].strip() == '':
                end += 1
            remove_ranges.append((start, end))

# Also remove applyExportSuggestionToDraft and aiExportSuggestionCache
for i, line in enumerate(lines):
    if 'function applyExportSuggestionToDraft(' in line:
        start = i
        depth = 0
        for j in range(i, len(lines)):
            depth += lines[j].count('{') - lines[j].count('}')
            if depth == 0 and j > start:
                end = j
                if end + 1 < len(lines) and lines[end + 1].strip() == '':
                    end += 1
                remove_ranges.append((start, end))
                break
    if 'let aiExportSuggestionCache:' in line:
        start = i
        end = i
        if end + 1 < len(lines) and lines[end + 1].strip() == '':
            end += 1
        remove_ranges.append((start, end))

# Sort reverse
remove_ranges.sort(key=lambda r: r[0], reverse=True)

# Blank out ranges
for start, end in remove_ranges:
    for i in range(start, end + 1):
        lines[i] = ''

# Clean up consecutive blank lines
new_lines = []
blank_count = 0
for line in lines:
    if line.strip() == '':
        blank_count += 1
        if blank_count <= 2:
            new_lines.append(line)
    else:
        blank_count = 0
        new_lines.append(line)

lines = new_lines

# Find last import line
last_import = 0
i = 0
while i < len(lines):
    stripped = lines[i].strip()
    if stripped.startswith('import '):
        j = i
        while j < len(lines) and not (lines[j].strip().endswith("';") or lines[j].strip().endswith('";')):
            j += 1
        last_import = j
        i = j + 1
    else:
        i += 1

# Build new imports
new_imports = []
for comp_file, func_names in component_groups:
    module = './components/' + comp_file.replace('.tsx', '')
    new_imports.append('import { ' + ', '.join(func_names) + ' } from \'' + module + '\';\n')

# Insert
for idx, imp in enumerate(new_imports):
    lines.insert(last_import + 1 + idx, imp)

with open(EXPORT_DIALOG, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f"\nUpdated {EXPORT_DIALOG}")
print(f"Final line count: {len(lines)}")
