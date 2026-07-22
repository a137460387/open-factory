import re

filepath = r'D:\code\Ai\open-factory\apps\desktop\src\export\ExportDialog.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')

# Find the StemSection closing tag and the batch paths section
stem_close = None
batch_paths_start = None
for i, line in enumerate(lines):
    if line.strip() == '/>' and i > 2700:
        # Check if this is the StemSection close
        if i > 2730 and i < 2750:
            stem_close = i
    if 'exportMode' not in line and 'batchPaths' in line and 'label' in line:
        batch_paths_start = i
        break

print(f"stem_close={stem_close}, batch_paths_start={batch_paths_start}")

if stem_close is not None and batch_paths_start is not None:
    # Find the exact line of ") : (" before batchPaths
    else_line = None
    for i in range(batch_paths_start - 1, stem_close, -1):
        if ') : (' in lines[i] or lines[i].strip().startswith(') : ('):
            else_line = i
            break

    print(f"else_line={else_line}")

    if else_line is not None:
        # Remove lines from stem_close+1 to else_line (inclusive of the ) : ( line)
        # Keep the StemSection /> line and the ) : ( line
        # Actually we need to remove everything between stem_close+1 and the line before ") : ("
        # But the ") : (" should stay as-is since it connects to the batch paths
        remove_start = stem_close + 1
        remove_end = else_line  # keep this line

        removed = remove_end - remove_start
        lines[remove_start:remove_end] = []
        print(f"Removed {removed} leftover stem lines")

        content = '\n'.join(lines)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"File written, {len(lines)} lines")
    else:
        print("Could not find else line")
else:
    print("Could not find stem_close or batch_paths_start")
