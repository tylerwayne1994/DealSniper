import re

with open('backend/zoning_router.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Add region SW to all CA entries that don't have region yet
content = re.sub(
    r'("ca_\w+":\s*\{\s*\n\s*"label":\s*"[^"]+",\n)(\s*"state":\s*"CA")',
    r'\1        "region": "SW",\n\2',
    content
)

# Add region SE to all NC entries that don't have region yet
content = re.sub(
    r'("nc_\w+":\s*\{\s*\n\s*"label":\s*"[^"]+",\n)(\s*"state":\s*"NC")',
    r'\1        "region": "SE",\n\2',
    content
)

# Add region SE to all SC entries that don't have region yet
content = re.sub(
    r'("sc_\w+":\s*\{\s*\n\s*"label":\s*"[^"]+",\n)(\s*"state":\s*"SC")',
    r'\1        "region": "SE",\n\2',
    content
)

with open('backend/zoning_router.py', 'w', encoding='utf-8') as f:
    f.write(content)

# Count results
count = content.count('"region"')
print(f"Done — {count} entries now have region field")
