import re
import json

with open('D:/code/Ai/open-factory/lint-output2.txt', encoding='utf-8') as f:
    lines = f.readlines()

assigned_unused = {}
defined_unused = {}
any_warnings = {}

current_file = None
for line in lines:
    line = line.rstrip()
    if line and not line[0].isspace() and ('\\' in line or '/' in line) and not line.startswith('$'):
        current_file = line.strip()
        continue
    if current_file and line.strip():
        m = re.match(r"\s+(\d+):(\d+)\s+warning\s+'([^']+)'\s+is assigned a value but never used", line)
        if m:
            line_no, col, name = m.groups()
            assigned_unused.setdefault(current_file, []).append((int(line_no), int(col), name))
            continue
        m = re.match(r"\s+(\d+):(\d+)\s+warning\s+'([^']+)'\s+is defined but never used", line)
        if m:
            line_no, col, name = m.groups()
            defined_unused.setdefault(current_file, []).append((int(line_no), int(col), name))
            continue
        m = re.match(r"\s+(\d+):(\d+)\s+warning\s+Unexpected any", line)
        if m:
            line_no, col = m.groups()[:2]
            any_warnings.setdefault(current_file, []).append((int(line_no), int(col), 'any'))

total_assigned = sum(len(v) for v in assigned_unused.values())
total_defined = sum(len(v) for v in defined_unused.values())
total_any = sum(len(v) for v in any_warnings.values())
print(f"Remaining 'is assigned but never used': {total_assigned} in {len(assigned_unused)} files")
print(f"Remaining 'is defined but never used': {total_defined} in {len(defined_unused)} files")
print(f"'no-explicit-any': {total_any} in {len(any_warnings)} files")

# Save assigned unused for fixing
with open('D:/code/Ai/open-factory/assigned-unused.json', 'w') as f:
    json.dump(assigned_unused, f, indent=2)

# Show top files
print("\nTop files with 'assigned but never used':")
sorted_files = sorted(assigned_unused.items(), key=lambda x: -len(x[1]))
for path, issues in sorted_files[:20]:
    short = path.split('open-factory\\')[-1]
    print(f"  {len(issues):4d} {short}")
