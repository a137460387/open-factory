import json, os
os.chdir('D:/code/Ai/open-factory/packages/editor-core/src/commands')
with open('timeline-commands.ts.orig', 'r', encoding='utf-8') as f: orig = f.readlines()
with open('_blocks.json') as f: blocks = json.load(f)
def gb(prefix):
    for k, v in blocks.items():
        if k.startswith(prefix): return v['start']-1, v['end']-1
    return None
def gf(name):
    for k, v in blocks.items():
        if k.startswith('function ' + name): return v['start']-1, v['end']-1
    return None
def lr(s, e): return [orig[i].rstrip() for i in range(s, e+1)]
def wm(name, imps, bns):
    c = list(imps); c.append(''); f = 0
    for bn in bns:
        r = gf(bn[5:]) if bn.startswith('func:') else gb(bn)
        if r: c.extend(lr(r[0], r[1])); c.append(''); f += 1
        else: print('  MISSING: ' + bn)
    with open(name, 'w', encoding='utf-8') as fh: fh.write(chr(10).join(c))
    print(name + ': ' + str(len(c)) + ' lines, ' + str(f) + '/' + str(len(bns)))
with open('_modules_data.json') as f: modules = json.load(f)
for name, m in modules.items():
    wm(name, m['i'], m['b'])

barrel = ['// Barrel file - re-exports from all sub-modules']
for mod in ['helpers', 'clip-commands', 'track-commands', 'media-commands', 'keyframe-commands', 'timeline-markers', 'multicam-commands', 'subtitle-commands', 'sequence-commands', 'color-fx-commands', 'project-commands', 'clip-effects-commands']:
    barrel.append('export * from ' + chr(39) + './' + mod + chr(39) + ';')
with open('timeline-commands.ts', 'w', encoding='utf-8') as f: f.write(chr(10).join(barrel))
print('Barrel generated')
