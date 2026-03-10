import csv, re
rows = list(csv.DictReader(open('client/public/absorption_rates_by_msa.csv', encoding='utf-8')))
msas = set(r['MSA'].strip() for r in rows)
js = open('client/src/data/msaCoordinates.js', encoding='utf-8').read()
keys = set(re.findall(r'"([^"]+)":\s*\[', js))
missing = msas - keys
print(f'Absorption MSAs: {len(msas)}, Matched: {len(msas & keys)}, Missing: {len(missing)}')
for m in sorted(missing):
    print(f'  {m}')
