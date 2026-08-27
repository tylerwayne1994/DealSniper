"""Adapter registry: rung name -> adapter class, plus dynamic generated modules."""
from __future__ import annotations

import importlib
import importlib.util
from pathlib import Path


def get_adapter_class(rung: str, adapter_module: str | None, cfg):
    """Resolve the adapter class for a source record.

    Generated adapters (written by self-heal) are loaded from the configured
    generated_adapters_dir by module file name and must expose GeneratedAdapter.
    """
    if adapter_module:
        gen_dir = cfg.path("generated_adapters_dir")
        mod_path = gen_dir / f"{adapter_module}.py"
        if mod_path.exists():
            spec = importlib.util.spec_from_file_location(
                f"adapters.generated.{adapter_module}", mod_path
            )
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)  # type: ignore[union-attr]
            return getattr(mod, "GeneratedAdapter")
    mapping = {
        "bulk_download": ("adapters.bulk_download", "BulkDownloadAdapter"),
        "arcgis_rest": ("adapters.arcgis_rest", "ArcGISRestAdapter"),
        "socrata": ("adapters.socrata", "SocrataAdapter"),
        "ckan": ("adapters.ckan", "CkanAdapter"),
        "statewide": ("adapters.statewide", "StatewideAdapter"),
    }
    if rung not in mapping:
        raise ValueError(f"no adapter for rung {rung!r} (module={adapter_module!r})")
    mod_name, cls_name = mapping[rung]
    return getattr(importlib.import_module(mod_name), cls_name)
