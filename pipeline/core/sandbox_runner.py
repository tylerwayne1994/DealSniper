"""Sandbox entry point for generated adapters. Run as a subprocess by
core/selfheal.py with a scrubbed environment (no ANTHROPIC_API_KEY, no
DATABASE_URL). It loads one generated module, fetches + maps a row sample, and
writes canonical rows as JSONL (geometry as WKT) to a temp output path. The
parent process does all validation and every DB write.

Usage: python -m core.sandbox_runner <module_path> <context_json> <out_path>
"""
from __future__ import annotations

import importlib.util
import json
import sys
from dataclasses import asdict


def main() -> int:
    module_path, context_path, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
    with open(context_path, "r", encoding="utf-8") as fh:
        ctx = json.load(fh)

    from core.config import Config
    from core.models import SourceRecord, TargetRecord

    cfg = Config.load(ctx.get("config_path"))
    target = TargetRecord(**ctx["target"])
    source = SourceRecord.from_dict(ctx["source"])
    layer = ctx["layer"]
    sample_n = int(ctx["sample_n"])

    spec = importlib.util.spec_from_file_location("sandboxed_adapter", module_path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    adapter_cls = getattr(mod, "GeneratedAdapter")
    adapter = adapter_cls(layer, target, source, cfg)

    n = 0
    with open(out_path, "w", encoding="utf-8") as out:
        for raw in adapter.fetch(target, source, cfg, max_rows=sample_n):
            row = adapter.map_row(raw)
            d = asdict(row)
            geom = d.pop("geom", None)
            d["geom_wkt"] = geom.wkt if geom is not None else None
            out.write(json.dumps(d, default=str) + "\n")
            n += 1
            if n >= sample_n:
                break
    meta = {"rows": n, "unmapped_zone_codes": getattr(adapter, "unmapped_zone_codes", {})}
    with open(out_path + ".meta", "w", encoding="utf-8") as fh:
        json.dump(meta, fh)
    return 0


if __name__ == "__main__":
    sys.exit(main())
