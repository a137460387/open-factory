import json, sys
sys.stdout.reconfigure(encoding='utf-8')
with open(r'D:\code\Ai\open-factory\e2e-json-output.txt', encoding='utf-8') as f:
    d = json.load(f)
specs = d.get('suites', [])
failed_specs = []
total = 0
for suite in specs:
    for spec in suite.get('specs', []):
        total += 1
        tests = spec.get('tests', [])
        for t in tests:
            for r in t.get('results', []):
                if r.get('status') == 'failed':
                    failed_specs.append(f"{suite.get('title','?')}/{spec.get('title','?')}")
                    break
print(f'Total specs: {total}, Failed: {len(failed_specs)}')
for s in failed_specs[:70]:
    print(s)
