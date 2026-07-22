import re

filepath = r'D:\code\Ai\open-factory\apps\desktop\src\export\ExportDialog.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Step 1: Add new imports after line 134 (ExportVersionBatchSection import)
old_import_line = "import { ExportVersionBatchSection, type VersionedExportRowState, type VersionWatermarkMode, type VersionRangeMode } from './components/ExportVersionBatchSection';"
new_imports_block = old_import_line + "\n" + \
    "import { CodecCompareSection } from './components/CodecCompareSection';\n" + \
    "import { SequenceBatchSection, type SequenceBatchPresetMode, type SequenceBatchRow } from './components/SequenceBatchSection';\n" + \
    "import { StemSection, type StemTrack } from './components/StemSection';"

if old_import_line in content:
    content = content.replace(old_import_line, new_imports_block)
    print("Added new imports")
else:
    print("WARNING: import line not found!")

# Step 2: Remove SequenceBatchPresetMode type definition (line 398 area)
old_type_def = "type SequenceBatchPresetMode = 'shared' | 'individual';\ntype SequenceBatchPresetMode = 'shared' | 'individual';\n"
if old_type_def in content:
    content = content.replace(old_type_def, '')
    print("Removed duplicate SequenceBatchPresetMode type")
else:
    # Try single occurrence
    old_type_single = "\ntype SequenceBatchPresetMode = 'shared' | 'individual';\n"
    if old_type_single in content:
        content = content.replace(old_type_single, '', 1)
        print("Removed SequenceBatchPresetMode type (single)")

# Step 3: Find and replace codec-compare block using line-based approach
lines = content.split('\n')

# Find start of codec-compare block
codec_start = None
codec_end = None
for i, line in enumerate(lines):
    if "exportMode === 'codec-compare'" in line and '? (' in line:
        codec_start = i
    if codec_start is not None and i > codec_start:
        if "exportMode === 'version-batch'" in line and '? (' in line:
            codec_end = i
            break

if codec_start is not None and codec_end is not None:
    new_codec_lines = [
        "          ) : exportMode === 'codec-compare' ? (",
        "            <CodecCompareSection",
        "              presets={presets}",
        "              codecComparePresetIds={codecComparePresetIds}",
        "              codecCompareRecommendationMode={codecCompareRecommendationMode}",
        "              setCodecCompareRecommendationMode={setCodecCompareRecommendationMode}",
        "              codecCompareRecommendation={codecCompareRecommendation}",
        "              codecCompareEvaluatingTaskId={codecCompareEvaluatingTaskId}",
        "              codecCompareResults={codecCompareResults}",
        "              sortedCodecCompareResults={sortedCodecCompareResults}",
        "              codecCompareSort={codecCompareSort}",
        "              toggleCodecComparePreset={toggleCodecComparePreset}",
        "              toggleCodecCompareSort={toggleCodecCompareSort}",
        "              setPresetId={setPresetId}",
        "            />",
    ]
    lines[codec_start:codec_end] = new_codec_lines
    print(f"Replaced codec-compare section (lines {codec_start+1}-{codec_end}, saved {codec_end - codec_start - len(new_codec_lines)} lines)")
else:
    print(f"WARNING: codec-compare block not found (start={codec_start}, end={codec_end})")

content = '\n'.join(lines)

# Step 4: Replace version-batch block
lines = content.split('\n')
vb_start = None
vb_end = None
for i, line in enumerate(lines):
    if "exportMode === 'version-batch'" in line and '? (' in line:
        vb_start = i
    if vb_start is not None and i > vb_start:
        if "exportMode === 'sequence-batch'" in line and '? (' in line:
            vb_end = i
            break

if vb_start is not None and vb_end is not None:
    new_vb_lines = [
        "          ) : exportMode === 'version-batch' ? (",
        "            <ExportVersionBatchSection",
        "              versionedBatchTemplate={versionedBatchTemplate}",
        "              setVersionedBatchTemplate={setVersionedBatchTemplate}",
        "              exportVersionedBatchTemplate={() => void exportVersionedBatchTemplate()}",
        "              importVersionedBatchTemplate={() => void importVersionedBatchTemplate()}",
        "              versionedBatchRows={versionedBatchRows}",
        "              updateVersionedBatchRow={updateVersionedBatchRow}",
        "              removeVersionedBatchRow={removeVersionedBatchRow}",
        "              addVersionedBatchRow={addVersionedBatchRow}",
        "              presets={presets}",
        "              exportSettings={exportSettings}",
        "              buildVersionSettings={buildVersionSettings}",
        "              versionedBatchReportRows={versionedBatchReportRows}",
        "            />",
    ]
    lines[vb_start:vb_end] = new_vb_lines
    print(f"Replaced version-batch section (lines {vb_start+1}-{vb_end}, saved {vb_end - vb_start - len(new_vb_lines)} lines)")
else:
    print(f"WARNING: version-batch block not found (start={vb_start}, end={vb_end})")

content = '\n'.join(lines)

# Step 5: Replace sequence-batch block
lines = content.split('\n')
sb_start = None
sb_end = None
for i, line in enumerate(lines):
    if "exportMode === 'sequence-batch'" in line and '? (' in line:
        sb_start = i
    if sb_start is not None and i > sb_start:
        if "exportMode === 'stem'" in line and '? (' in line:
            sb_end = i
            break

if sb_start is not None and sb_end is not None:
    new_sb_lines = [
        "          ) : exportMode === 'sequence-batch' ? (",
        "            <SequenceBatchSection",
        "              sequenceBatchTemplate={sequenceBatchTemplate}",
        "              setSequenceBatchTemplate={setSequenceBatchTemplate}",
        "              sequenceBatchPresetMode={sequenceBatchPresetMode}",
        "              setSequenceBatchPresetMode={setSequenceBatchPresetMode}",
        "              sequenceBatchRows={sequenceBatchRows}",
        "              toggleSequenceBatchSelection={toggleSequenceBatchSelection}",
        "              updateSequenceBatchOutput={updateSequenceBatchOutput}",
        "              updateSequenceBatchPreset={updateSequenceBatchPreset}",
        "              presets={presets}",
        "              selectedPreset={selectedPreset}",
        "            />",
    ]
    lines[sb_start:sb_end] = new_sb_lines
    print(f"Replaced sequence-batch section (lines {sb_start+1}-{sb_end}, saved {sb_end - sb_start - len(new_sb_lines)} lines)")
else:
    print(f"WARNING: sequence-batch block not found (start={sb_start}, end={sb_end})")

content = '\n'.join(lines)

# Step 6: Replace stem block
lines = content.split('\n')
stem_start = None
stem_end = None
for i, line in enumerate(lines):
    if "exportMode === 'stem'" in line and '? (' in line:
        stem_start = i
    if stem_start is not None and i > stem_start:
        # The stem block ends at the else clause for batch paths
        if line.strip().startswith(') : (') or ("exportMode" not in line and 'batchPaths' in line):
            stem_end = i
            break

if stem_start is not None and stem_end is not None:
    new_stem_lines = [
        "          ) : exportMode === 'stem' ? (",
        "            <StemSection",
        "              stemMode={stemMode}",
        "              setStemMode={setStemMode}",
        "              stemTracks={stemTracks}",
        "              setStemTracks={setStemTracks}",
        "            />",
    ]
    lines[stem_start:stem_end] = new_stem_lines
    print(f"Replaced stem section (lines {stem_start+1}-{stem_end}, saved {stem_end - stem_start - len(new_stem_lines)} lines)")
else:
    print(f"WARNING: stem block not found (start={stem_start}, end={stem_end})")

content = '\n'.join(lines)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

final_lines = len(content.split('\n'))
print(f"\nFinal file: {final_lines} lines")
