import csv, re

with open('client/public/Multifamily_ClassA_National_Pipeline_FINAL.csv', encoding='utf-8') as f:
    rows = list(csv.DictReader(f))
print(f'Total rows: {len(rows)}')

has_coords = [r for r in rows if r.get('Latitude','').strip() and r.get('Longitude','').strip() and r['Latitude'] != '0' and r['Longitude'] != '0']
print(f'Rows with lat/lng in CSV: {len(has_coords)}')

msas = set(r.get('MSA','').strip() for r in rows if r.get('MSA','').strip())
print(f'Unique MSAs in CSV: {len(msas)}')

with open('client/src/data/msaCoordinates.js', encoding='utf-8') as f:
    js = f.read()
keys = re.findall(r'"([^"]+)":\s*\[', js)
lookup_set = set(keys)
print(f'MSAs in coordinate lookup: {len(lookup_set)}')

missing = msas - lookup_set
matched = msas & lookup_set
print(f'MSAs matched: {len(matched)}')
print(f'MSAs MISSING from lookup: {len(missing)}')

total_missing_rows = 0
if missing:
    for m in sorted(missing):
        count = sum(1 for r in rows if r.get('MSA','').strip() == m)
        total_missing_rows += count
        print(f'  MISSING: "{m}" ({count} rows)')
print(f'Total rows without coordinates: {total_missing_rows}')
print(f'Total rows that SHOULD show on map: {len(rows) - total_missing_rows + len(has_coords) - len(has_coords)}')
