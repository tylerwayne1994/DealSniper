"""
legend_normalizer.py
--------------------
Standalone utility to normalize and audit zoning legend mappings.
Used by zoning_agent.py to enrich downloaded GeoJSON with standardized categories.
"""

import json
import re
from pathlib import Path


# ─────────────────────────────────────────────────────────────────────────────
# Standard Category Colors for Leaflet
# ─────────────────────────────────────────────────────────────────────────────

STANDARD_COLORS = {
    "Residential":          "#FDE68A",
    "Commercial":           "#FCA5A5",
    "Industrial":           "#9CA3AF",
    "Mixed Use":            "#C4B5FD",
    "Agricultural":         "#6EE7B7",
    "Public/Institutional": "#93C5FD",
    "Overlay/Other":        "#E5E7EB",
}

STANDARD_CATEGORIES = list(STANDARD_COLORS.keys())


# ─────────────────────────────────────────────────────────────────────────────
# Common Zoning Code Patterns (regex-based fallback)
# ─────────────────────────────────────────────────────────────────────────────

FALLBACK_PATTERNS = [
    # Residential
    (r"^R[-\s]?\d",          "Residential",          "Residential District"),
    (r"^RS[-\s]?\d",         "Residential",          "Single Family Residential"),
    (r"^RM[-\s]?\d",         "Residential",          "Multi-Family Residential"),
    (r"^MF[-\s]?\d",         "Residential",          "Multi-Family Residential"),
    (r"^SF[-\s]?\d",         "Residential",          "Single Family Residential"),
    (r"^RR[-\s]?\d",        "Residential",          "Rural Residential"),
    (r"^RE[-\s]?\d",         "Residential",          "Residential Estate"),
    (r"^RH[-\s]?\d",         "Residential",          "Residential High Density"),
    (r"^RL[-\s]?\d",         "Residential",          "Residential Low Density"),
    (r"^AG[-\s]?R",          "Residential",          "Agricultural Residential"),
    (r"^RESIDENTIAL",        "Residential",          "Residential"),

    # Commercial
    (r"^C[-\s]?\d",          "Commercial",           "Commercial District"),
    (r"^CB[-\s]?\d",         "Commercial",           "Central Business District"),
    (r"^B[-\s]?\d",          "Commercial",           "Business District"),
    (r"^NC[-\s]?\d",         "Commercial",           "Neighborhood Commercial"),
    (r"^GC[-\s]?\d",         "Commercial",           "General Commercial"),
    (r"^HC[-\s]?\d",         "Commercial",           "Highway Commercial"),
    (r"^RC[-\s]?\d",         "Commercial",           "Regional Commercial"),
    (r"^COMMERCIAL",         "Commercial",           "Commercial"),
    (r"^RETAIL",             "Commercial",           "Retail"),
    (r"^OFFICE",             "Commercial",           "Office"),

    # Industrial
    (r"^I[-\s]?\d",          "Industrial",           "Industrial District"),
    (r"^LI[-\s]?\d",         "Industrial",           "Light Industrial"),
    (r"^HI[-\s]?\d",         "Industrial",           "Heavy Industrial"),
    (r"^M[-\s]?\d",          "Industrial",           "Manufacturing District"),
    (r"^ML[-\s]?\d",         "Industrial",           "Light Manufacturing"),
    (r"^MH[-\s]?\d",         "Industrial",           "Heavy Manufacturing"),
    (r"^INDUSTRIAL",         "Industrial",           "Industrial"),
    (r"^WAREHOUSE",          "Industrial",           "Warehouse/Distribution"),

    # Mixed Use
    (r"^MU[-\s]?\d",         "Mixed Use",            "Mixed Use District"),
    (r"^MX[-\s]?\d",         "Mixed Use",            "Mixed Use District"),
    (r"^TC[-\s]?\d",         "Mixed Use",            "Town Center"),
    (r"^TOD[-\s]?\d",        "Mixed Use",            "Transit Oriented Development"),
    (r"^MIXED",              "Mixed Use",            "Mixed Use"),

    # Agricultural
    (r"^A[-\s]?\d",          "Agricultural",         "Agricultural District"),
    (r"^AG[-\s]?\d",         "Agricultural",         "Agricultural District"),
    (r"^F[-\s]?\d",          "Agricultural",         "Farming District"),
    (r"^FARM",               "Agricultural",         "Farming"),
    (r"^AGRICULTURAL",       "Agricultural",         "Agricultural"),
    (r"^RURAL",              "Agricultural",         "Rural"),

    # Public/Institutional
    (r"^P[-\s]?\d",          "Public/Institutional", "Public District"),
    (r"^PF[-\s]?\d",         "Public/Institutional", "Public Facility"),
    (r"^PI[-\s]?\d",         "Public/Institutional", "Public/Institutional"),
    (r"^OS[-\s]?\d",         "Public/Institutional", "Open Space"),
    (r"^PR[-\s]?\d",         "Public/Institutional", "Parks and Recreation"),
    (r"^PARK",               "Public/Institutional", "Park"),
    (r"^PUBLIC",             "Public/Institutional", "Public"),
    (r"^INSTITUTIONAL",      "Public/Institutional", "Institutional"),
    (r"^OPEN.SPACE",         "Public/Institutional", "Open Space"),
    (r"^CONSERVATION",       "Public/Institutional", "Conservation"),
    (r"^GOVERNMENT",         "Public/Institutional", "Government"),
]


def apply_fallback_pattern(code: str) -> tuple:
    """Apply regex-based fallback patterns to categorize an unknown zoning code."""
    code_upper = code.upper().strip()
    for pattern, category, description in FALLBACK_PATTERNS:
        if re.match(pattern, code_upper, re.IGNORECASE):
            return category, description
    return "Overlay/Other", code


def build_enriched_legend(legend_mapping: dict) -> dict:
    """Enrich a legend mapping with color codes."""
    enriched = {}
    for code, entry in legend_mapping.items():
        category = entry.get("standardized_category", "Overlay/Other")
        if category not in STANDARD_CATEGORIES:
            category = "Overlay/Other"
        enriched[code] = {
            "description":           entry.get("description", code),
            "standardized_category": category,
            "color":                 STANDARD_COLORS.get(category, "#E5E7EB"),
        }
    return enriched


def audit_legend(legend_mapping: dict) -> dict:
    """Audit a legend mapping for completeness."""
    report = {
        "total_codes":        len(legend_mapping),
        "by_category":        {},
        "missing_description": [],
        "invalid_category":   [],
    }
    for code, entry in legend_mapping.items():
        cat = entry.get("standardized_category", "")
        if cat not in STANDARD_CATEGORIES:
            report["invalid_category"].append(code)
        if not entry.get("description"):
            report["missing_description"].append(code)
        report["by_category"][cat] = report["by_category"].get(cat, 0) + 1
    return report


def apply_legend_to_geojson(
    geojson: dict,
    legend_mapping: dict,
    zoning_field: str,
    city: str = "Unknown",
) -> dict:
    """
    Apply an enriched legend to a GeoJSON FeatureCollection.
    Adds 'standard_zone', 'zone_description', and 'zone_color' to each feature.
    """
    enriched_legend = build_enriched_legend(legend_mapping)
    legend_lookup   = {k.upper(): v for k, v in enriched_legend.items()}

    matched  = 0
    fallback = 0
    unmatched = 0

    for feature in geojson.get("features", []):
        props = feature.get("properties", {})

        # Find the zoning code — try specified field + common fallbacks
        raw_code = None
        for field in [zoning_field, "ZONING", "ZONE", "CODE", "ZONE_CLASS",
                      "ZONING_LBL", "ZONING_CODE", "ZONE_CODE", "ZONING_TYPE",
                      "ZONE_TYPE", "ZONE_NAME", "ZONING_DIST"]:
            if field and field in props and props[field]:
                raw_code = str(props[field]).strip()
                break

        if not raw_code:
            props["standard_zone"]    = "Overlay/Other"
            props["zone_description"] = "Unknown"
            props["zone_color"]       = STANDARD_COLORS["Overlay/Other"]
            unmatched += 1
            continue

        # Try exact match
        entry = legend_lookup.get(raw_code.upper())

        # Try prefix match
        if not entry:
            for key, val in legend_lookup.items():
                if raw_code.upper().startswith(key):
                    entry = val
                    break

        if entry:
            props["standard_zone"]    = entry["standardized_category"]
            props["zone_description"] = entry["description"]
            props["zone_color"]       = entry["color"]
            matched += 1
        else:
            cat, desc = apply_fallback_pattern(raw_code)
            props["standard_zone"]    = cat
            props["zone_description"] = desc
            props["zone_color"]       = STANDARD_COLORS.get(cat, "#E5E7EB")
            fallback += 1

        feature["properties"] = props

    total = matched + fallback + unmatched
    print(f"[{city}] Legend applied: {matched} exact, {fallback} fallback, {unmatched} unknown / {total} total")

    return geojson
