# Write a tailored script that matches the user's VS Code folder structure and file name pattern,
# handles varied column names, excludes Alaska, preserves FIPS/GEOID columns, and supports resume.
# It enriches each per-state CSV with Zillow rental/sold counts and writes merged output.

from textwrap import dedent

script = dedent(r'''
    import asyncio
    import csv
    import glob
    import json
    import os
    import random
    import re
    import sys
    import time
    from typing import Dict, List, Optional, Tuple

    # Playwright for Zillow
    try:
        from playwright.async_api import async_playwright
    except Exception:
        async_playwright = None

    # --------------- CONFIG ---------------
    # Usage:
    #   python enrich_city_counts.py "<input_dir>" "<output_dir>"
    #
    # Example (Windows PowerShell):
    #   python enrich_city_counts.py "C:\Users\hello\Documents\GitHub\Marketfinder.AI\multifamily-app\public\data\all us cities pop" ".\states_output"
    #
    # Example (bash):
    #   python enrich_city_counts.py "./multifamily-app/public/data/all us cities pop" "./states_output"

    MERGED_OUTPUT = "all_states_with_counts.csv"

    # Accept common variants
    CITY_COL_CANDIDATES = ["city", "City", "NAME", "Name", "place", "Place", "city_name", "CityName"]
    STATE_COL_CANDIDATES = ["state", "State", "slug"]  # treat 'slug' as state name if needed

    # Zillow modes
    FETCH_RENTALS = True
    FETCH_SOLD = True

    EXCLUDE_STATE_NAMES = {"Alaska"}  # exclude AK entirely

    STATE_TO_ABBR = {
        "Alabama":"AL","Alaska":"AK","Arizona":"AZ","Arkansas":"AR","California":"CA","Colorado":"CO","Connecticut":"CT",
        "Delaware":"DE","Florida":"FL","Georgia":"GA","Hawaii":"HI","Idaho":"ID","Illinois":"IL","Indiana":"IN","Iowa":"IA",
        "Kansas":"KS","Kentucky":"KY","Louisiana":"LA","Maine":"ME","Maryland":"MD","Massachusetts":"MA","Michigan":"MI",
        "Minnesota":"MN","Mississippi":"MS","Missouri":"MO","Montana":"MT","Nebraska":"NE","Nevada":"NV","New Hampshire":"NH",
        "New Jersey":"NJ","New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND","Ohio":"OH",
        "Oklahoma":"OK","Oregon":"OR","Pennsylvania":"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD",
        "Tennessee":"TN","Texas":"TX","Utah":"UT","Vermont":"VT","Virginia":"VA","Washington":"WA","West Virginia":"WV",
        "Wisconsin":"WI","Wyoming":"WY","District of Columbia":"DC"
    }

    def find_col(row_keys, candidates):
        for c in candidates:
            for k in row_keys:
                if k.lower() == c.lower():
                    return k
        return None

    def ensure_state_abbr(state_name: str) -> Optional[str]:
        if not state_name:
            return None
        s = state_name.strip()
        if len(s) == 2 and s.isalpha():
            return s.upper()
        return STATE_TO_ABBR.get(s)

    def slugify_city_for_zillow(city: str) -> str:
        x = city.strip()
        x = re.sub(r"&", "and", x)
        x = re.sub(r"[’'`]", "", x)
        x = re.sub(r"[^A-Za-z0-9\s\-\.]", " ", x)
        x = re.sub(r"\s+", " ", x).strip()
        x = x.replace(" ", "-")
        return x

    def zillow_url(city_slug: str, state_abbr: str, mode: str) -> str:
        base = f"https://www.zillow.com/{city_slug}-{state_abbr}/"
        if mode == "rent":
            return base + "rentals/"
        elif mode == "sold":
            return base + "sold/"
        elif mode == "sale":
            return base + "homes/"
        else:
            raise ValueError("bad mode")

    async def fetch_count_from_zillow(page, url: str) -> Optional[int]:
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=60000)
            json_text = await page.evaluate("""() => {
                const el = document.getElementById('__NEXT_DATA__');
                return el ? el.textContent : null;
            }""")
            if not json_text:
                await page.wait_for_timeout(1500)
                json_text = await page.evaluate("""() => {
                    const el = document.getElementById('__NEXT_DATA__');
                    return el ? el.textContent : null;
                }""")
            if not json_text:
                return None
            data = json.loads(json_text)
            paths = [
                ["props","pageProps","searchPageState","totalResultCount"],
                ["props","pageProps","searchPageState","cat1","searchResults","totalResultCount"],
                ["props","pageProps","searchPageState","cat2","searchResults","totalResultCount"],
            ]
            def dig(obj, path):
                cur = obj
                for p in path:
                    if isinstance(cur, dict) and p in cur:
                        cur = cur[p]
                    else:
                        return None
                return cur
            for p in paths:
                val = dig(data, p)
                if isinstance(val, int):
                    return val
                if isinstance(val, str) and val.isdigit():
                    return int(val)
            return None
        except Exception:
            return None

    async def get_counts(play, city: str, state_abbr: str) -> Tuple[Optional[int], Optional[int]]:
        city_slug = slugify_city_for_zillow(city)
        browser = await play.firefox.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        rentals = None
        sold = None
        if FETCH_RENTALS:
            rentals = await fetch_count_from_zillow(page, zillow_url(city_slug, state_abbr, "rent"))
            await page.wait_for_timeout(random.randint(400, 1000))
        if FETCH_SOLD:
            sold = await fetch_count_from_zillow(page, zillow_url(city_slug, state_abbr, "sold"))

        await context.close()
        await browser.close()
        return rentals, sold

    def read_csv_rows(path: str) -> List[Dict[str, str]]:
        rows = []
        with open(path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for r in reader:
                rows.append(r)
        return rows

    def write_csv(path: str, fieldnames: List[str], rows: List[Dict[str, str]]):
        with open(path, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=fieldnames)
            w.writeheader()
            for r in rows:
                w.writerow(r)

    def is_alaska_row(row: Dict[str, str], state_col: Optional[str]) -> bool:
        vals = [row.get(state_col, ""), row.get("state",""), row.get("State",""), row.get("slug","")]
        for v in vals:
            if (v or "").strip() in EXCLUDE_STATE_NAMES or (v or "").strip().upper() == "AK":
                return True
        return False

    async def process_file(play, in_path: str, out_dir: str) -> str:
        os.makedirs(out_dir, exist_ok=True)
        base = os.path.basename(in_path)
        out_path = os.path.join(out_dir, base.replace(".csv", "_with_counts.csv"))

        rows = read_csv_rows(in_path)
        if not rows:
            # create empty passthrough with minimal header
            write_csv(out_path, ["state","city","state_abbr","zillow_city_slug","rental_count","sold_count"], [])
            return out_path

        keys = rows[0].keys()
        city_col = find_col(keys, CITY_COL_CANDIDATES)
        state_col = find_col(keys, STATE_COL_CANDIDATES)
        if city_col is None or state_col is None:
            raise RuntimeError(f"Missing 'city' or 'state' column in {in_path}. Found keys: {list(keys)}")

        # Build fieldnames (preserve originals)
        fieldnames = list(keys)
        if "state_abbr" not in fieldnames: fieldnames.append("state_abbr")
        if "zillow_city_slug" not in fieldnames: fieldnames.append("zillow_city_slug")
        if "rental_count" not in fieldnames: fieldnames.append("rental_count")
        if "sold_count" not in fieldnames: fieldnames.append("sold_count")

        # Resume support: if out exists, load existing rows to skip already-completed ones
        completed = {}
        if os.path.exists(out_path):
            try:
                for r in read_csv_rows(out_path):
                    key = (r.get(city_col,"").lower(), r.get("state_abbr",""))
                    if r.get("rental_count") or r.get("sold_count"):
                        completed[key] = r
            except Exception:
                completed = {}

        out_rows = []
        for idx, r in enumerate(rows, 1):
            # Skip Alaska rows explicitly
            if is_alaska_row(r, state_col):
                continue

            city = (r.get(city_col) or "").strip()
            state_val = (r.get(state_col) or "").strip()
            abbr = ensure_state_abbr(state_val)
            if abbr is None:
                abbr = ensure_state_abbr(r.get("state") or r.get("State") or r.get("slug") or "") or ""

            zslug = slugify_city_for_zillow(city) if city else ""

            key = (city.lower(), abbr)
            if key in completed:
                o = dict(completed[key])
                # merge back any new columns
                for k,v in r.items():
                    if k not in o or (o[k] in (None,"") and v not in (None,"")):
                        o[k] = v
                out_rows.append(o)
                print(f"  [resume] {idx}/{len(rows)} {city}, {abbr} -> rentals={o.get('rental_count')} sold={o.get('sold_count')}")
                continue

            rentals = ""
            sold = ""
            if city and abbr:
                try:
                    rentals, sold = await get_counts(play, city, abbr)
                except Exception:
                    rentals, sold = None, None
                rentals = rentals if rentals is not None else ""
                sold = sold if sold is not None else ""

            o = dict(r)
            o["state_abbr"] = abbr
            o["zillow_city_slug"] = zslug
            o["rental_count"] = rentals
            o["sold_count"] = sold
            out_rows.append(o)
            print(f"  {idx}/{len(rows)}  {city}, {abbr} -> rentals={rentals} sold={sold}")
            time.sleep(random.uniform(0.4, 1.0))

        write_csv(out_path, fieldnames, out_rows)
        return out_path

    async def run_folder(input_dir: str, output_dir: str) -> str:
        if async_playwright is None:
            raise RuntimeError("Playwright not installed. Do: pip install playwright && python -m playwright install")

        # Match the user's naming scheme (two common patterns in the screenshot)
        patterns = [
            os.path.join(input_dir, "*_Cities_with_State_Column__FIPS_and_GEOID.csv"),
            os.path.join(input_dir, "*-cities-by-population-2025.csv"),
            os.path.join(input_dir, "*.csv"),
        ]
        paths = []
        for p in patterns:
            paths.extend(glob.glob(p))
        # Dedup while keeping order
        seen = set()
        csvs = []
        for p in paths:
            if p not in seen and os.path.isfile(p):
                seen.add(p)
                csvs.append(p)

        if not csvs:
            raise RuntimeError(f"No CSV files found in: {input_dir}")

        os.makedirs(output_dir, exist_ok=True)

        out_files = []
        async with async_playwright() as play:
            for fp in csvs:
                # Skip any Alaska-specific file by name, just in case
                if re.search(r'alaska', os.path.basename(fp), flags=re.I):
                    print(f"Skipping Alaska file: {fp}")
                    continue
                print(f"Processing: {fp}")
                out_fp = await process_file(play, fp, output_dir)
                out_files.append(out_fp)

        # Merge
        merged_path = os.path.join(output_dir, MERGED_OUTPUT)
        fieldnames = None
        with open(merged_path, "w", newline="", encoding="utf-8") as out:
            writer = None
            for fp in out_files:
                with open(fp, "r", encoding="utf-8") as f:
                    reader = csv.DictReader(f)
                    if fieldnames is None:
                        fieldnames = reader.fieldnames
                        writer = csv.DictWriter(out, fieldnames=fieldnames)
                        writer.writeheader()
                    for row in reader:
                        # double-check Alaska got filtered
                        st = (row.get("state") or row.get("State") or "").strip()
                        sabbr = (row.get("state_abbr") or "").strip()
                        if st in EXCLUDE_STATE_NAMES or sabbr == "AK":
                            continue
                        writer.writerow(row)
        return merged_path

    def usage():
        print("Usage:")
        print("  python enrich_city_counts.py <input_dir> <output_dir>")

    if __name__ == "__main__":
        if len(sys.argv) != 3:
            usage()
            sys.exit(1)
        input_dir = sys.argv[1]
        output_dir = sys.argv[2]
        merged = asyncio.run(run_folder(input_dir, output_dir))
        print(f"Done. Merged master at: {merged}")
''')

path = "/mnt/data/enrich_city_counts.py"
with open(path, "w", encoding="utf-8") as f:
    f.write(script)

path
