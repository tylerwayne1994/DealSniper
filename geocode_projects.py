"""
Geocode the multifamily projects CSV using Nominatim (free, no API key).
Adds latitude, longitude columns and writes to client/public/development_pipeline.csv
"""
import csv
import time
import urllib.request
import urllib.parse
import json
import random

INPUT = 'client/public/For Deal sniper Multifamily Projects - 252 Nationwide - All Projects.csv'
OUTPUT = 'client/public/development_pipeline.csv'

# Cache city geocodes so we only hit the API once per city
city_cache = {}

def geocode(query):
    """Geocode a string via Nominatim. Returns (lat, lng) or None."""
    url = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode({
        'q': query, 'format': 'json', 'limit': 1, 'countrycodes': 'us'
    })
    req = urllib.request.Request(url, headers={'User-Agent': 'DealSniper-Geocoder/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            if data:
                return float(data[0]['lat']), float(data[0]['lon'])
    except Exception as e:
        print(f"  ⚠ Geocode error for '{query}': {e}")
    return None

def geocode_row(row):
    """Try to geocode: first by address+city, then by city alone."""
    city = row['city'].strip()
    address = row['address'].strip()
    
    # Try full address + city first (only if address looks like a real street address)
    has_street = any(c.isdigit() for c in address[:10]) or 'st' in address.lower() or 'ave' in address.lower() or 'blvd' in address.lower() or 'rd' in address.lower() or 'drive' in address.lower() or 'pkwy' in address.lower()
    
    if has_street:
        result = geocode(f"{address}, {city}")
        if result:
            return result
        time.sleep(1.1)  # respect rate limit
    
    # Fall back to city
    if city not in city_cache:
        result = geocode(city)
        time.sleep(1.1)
        city_cache[city] = result
    
    base = city_cache.get(city)
    if base:
        # Add jitter so same-city projects don't stack on top of each other
        jitter_lat = random.uniform(-0.015, 0.015)
        jitter_lng = random.uniform(-0.015, 0.015)
        return (base[0] + jitter_lat, base[1] + jitter_lng)
    
    return None

def main():
    with open(INPUT, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    
    print(f"Loaded {len(rows)} projects. Geocoding...")
    
    results = []
    failed = 0
    for i, row in enumerate(rows):
        coords = geocode_row(row)
        if coords:
            row['latitude'] = f"{coords[0]:.6f}"
            row['longitude'] = f"{coords[1]:.6f}"
        else:
            row['latitude'] = ''
            row['longitude'] = ''
            failed += 1
            print(f"  ✗ Failed: {row['project_name']} ({row['city']})")
        
        results.append(row)
        if (i + 1) % 10 == 0:
            print(f"  {i+1}/{len(rows)} done...")
    
    # Write output
    fieldnames = list(rows[0].keys())
    if 'latitude' not in fieldnames:
        fieldnames += ['latitude', 'longitude']
    
    with open(OUTPUT, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)
    
    print(f"\n✓ Done! {len(results) - failed}/{len(results)} geocoded. Output: {OUTPUT}")
    if failed:
        print(f"  {failed} projects could not be geocoded.")

if __name__ == '__main__':
    main()
