import re, sys

with open('coverage/lcov.info', 'r') as f:
    content = f.read()

blocks = content.split('end_of_record')

# Check each source file
for block in blocks:
    lines = block.strip().split('\n')
    sf = [l for l in lines if l.startswith('SF:')]
    if not sf:
        continue
    path = sf[0][3:]
    # Normalize path separators
    path = path.replace(chr(92), '/')

    lh = [l for l in lines if l.startswith('LH:')]
    lf = [l for l in lines if l.startswith('LF:')]
    lh_val = int(lh[0].split(':')[1]) if lh else 0
    lf_val = int(lf[0].split(':')[1]) if lf else 0

    if lh_val > 0 and 'editor-core' in path:
        print(f'  LH={lh_val}/{lf_val} {path}')

print()

# Summary of all packages
pkg_summary = {}
for block in blocks:
    lines = block.strip().split('\n')
    sf = [l for l in lines if l.startswith('SF:')]
    if not sf:
        continue
    path = sf[0][3:].replace(chr(92), '/')
    parts = path.split('/')
    if len(parts) >= 2:
        pkg = parts[0] + '/' + parts[1]
    else:
        pkg = 'root'

    lh = [l for l in lines if l.startswith('LH:')]
    lf = [l for l in lines if l.startswith('LF:')]
    lh_val = int(lh[0].split(':')[1]) if lh else 0
    lf_val = int(lf[0].split(':')[1]) if lf else 0

    if pkg not in pkg_summary:
        pkg_summary[pkg] = {'files': 0, 'files_with_hits': 0, 'lf': 0, 'lh': 0}
    pkg_summary[pkg]['files'] += 1
    pkg_summary[pkg]['lf'] += lf_val
    pkg_summary[pkg]['lh'] += lh_val
    if lh_val > 0:
        pkg_summary[pkg]['files_with_hits'] += 1

print('Package summary:')
for pkg, s in sorted(pkg_summary.items()):
    pct = s['lh']/s['lf']*100 if s['lf'] > 0 else 0
    print(f'  {pkg}: {s["files_with_hits"]}/{s["files"]} files, LH={s["lh"]}/{s["lf"]} ({pct:.1f}%)')
