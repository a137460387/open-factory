import os

filepath = r"D:/code/Ai/open-factory/packages/editor-core/src/commands/timeline-commands.ts"
with open(filepath, "r", encoding="utf-8") as f:
    lines = f.readlines()

L = lambda n: lines[n-1].rstrip()
outdir = r"D:/code/Ai/open-factory/packages/editor-core/src/commands"

def write_file(name, content_lines):
    path = os.path.join(outdir, name)
    with open(path, "w", encoding="utf-8") as f:
        f.write("
".join(content_lines))
    print(f"{name}: {len(content_lines)} lines")

def extract(start, end):
    return [L(i) for i in range(start, end + 1)]
