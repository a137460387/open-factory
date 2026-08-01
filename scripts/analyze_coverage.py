import re

files = []
current_file = ''
in_editor_core = False
is_dts = False
lf = 0
lh = 0
fnf = 0
fnh = 0

with open('coverage/lcov.info', 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if line.startswith('SF:'):
            current_file = line[3:]
            in_editor_core = 'editor-core' in current_file and 'src' in current_file and '.test.' not in current_file
            is_dts = current_file.endswith('.d.ts')
            lf = 0
            lh = 0
            fnf = 0
            fnh = 0
        elif in_editor_core and not is_dts:
            if line.startswith('LF:'):
                try:
                    lf = int(line[3:])
                except ValueError:
                    lf = 0
            elif line.startswith('LH:'):
                try:
                    lh = int(line[4:])
                except ValueError:
                    lh = 0
            elif line.startswith('FNF:'):
                try:
                    fnf = int(line[4:])
                except ValueError:
                    fnf = 0
            elif line.startswith('FNH:'):
                try:
                    fnh = int(line[4:])
                except ValueError:
                    fnh = 0
            elif line == 'end_of_record':
                if lf > 0:
                    pct = lh / lf * 100
                    files.append((current_file, lf, lh, pct, fnf, fnh))

files.sort(key=lambda x: x[3])

zero_cov = [f for f in files if f[3] == 0]
low_cov = [f for f in files if 0 < f[3] < 50]
mid_cov = [f for f in files if 50 <= f[3] < 80]
high_cov = [f for f in files if f[3] >= 80]

print(f'=== editor-core/src File Coverage Distribution ===')
print(f'Total non-.d.ts source files: {len(files)}')
print(f'0% coverage: {len(zero_cov)} files')
print(f'1-49% coverage: {len(low_cov)} files')
print(f'50-79% coverage: {len(mid_cov)} files')
print(f'80-100% coverage: {len(high_cov)} files')
print()

# Total lines for each bucket
zero_lines = sum(f[1] for f in zero_cov)
low_lines = sum(f[1] for f in low_cov)
mid_lines = sum(f[1] for f in mid_cov)
high_lines = sum(f[1] for f in high_cov)
total_lines = zero_lines + low_lines + mid_lines + high_lines
print(f'=== Lines by bucket ===')
print(f'0%: {zero_lines} lines ({zero_lines/total_lines*100:.1f}%)')
print(f'1-49%: {low_lines} lines ({low_lines/total_lines*100:.1f}%)')
print(f'50-79%: {mid_lines} lines ({mid_lines/total_lines*100:.1f}%)')
print(f'80-100%: {high_lines} lines ({high_lines/total_lines*100:.1f}%)')
print()

print('=== Files with 0% line coverage (top 30) ===')
for f in zero_cov[:30]:
    path = f[0].replace(chr(92), '/')
    if 'packages/editor-core/src/' in path:
        path = path.split('packages/editor-core/src/')[1]
    print(f'  {path} ({f[1]} lines)')

print()
print('=== Files with low coverage (1-49%, top 20) ===')
for f in low_cov[:20]:
    path = f[0].replace(chr(92), '/')
    if 'packages/editor-core/src/' in path:
        path = path.split('packages/editor-core/src/')[1]
    print(f'  {path} ({f[2]}/{f[1]} lines = {f[3]:.1f}%)')

print()
print('=== Function coverage detail (files with 0 function coverage) ===')
zero_fn = [f for f in files if f[5] == 0 and f[4] > 0]
for f in zero_fn[:20]:
    path = f[0].replace(chr(92), '/')
    if 'packages/editor-core/src/' in path:
        path = path.split('packages/editor-core/src/')[1]
    print(f'  {path} ({f[4]} functions, 0 hit)')

print()
print('=== Aggregate ===')
total_lf = sum(f[1] for f in files)
total_lh = sum(f[2] for f in files)
total_fnf = sum(f[4] for f in files)
total_fnh = sum(f[5] for f in files)
print(f'Lines: {total_lh}/{total_lf} = {total_lh/total_lf*100:.2f}%')
print(f'Functions: {total_fnh}/{total_fnf} = {total_fnh/total_fnf*100:.2f}%')
