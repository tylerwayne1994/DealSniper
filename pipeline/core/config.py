"""Config loading with ${VAR} env expansion and fail-fast validation.

Nothing operational is hardcoded in code: every URL, threshold, path, and model
name comes from config/pipeline.yaml, which in turn pulls secrets and
environment-specific values from the process environment (pipeline/.env is
loaded first when present).
"""
from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any, Iterable

import yaml

ENV_PATTERN = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}")

PIPELINE_ROOT = Path(__file__).resolve().parent.parent


class ConfigError(SystemExit):
    """Raised (exits non-zero) on invalid or incomplete configuration."""

    def __init__(self, message: str):
        super().__init__(f"config error: {message}")
        self.message = message


class MissingEnv(str):
    """Sentinel left in the config tree where an env var was unset.

    Subclasses str so accidental string ops don't crash mid-run; any *use* of
    the value should be preceded by Config.require_env for the relevant group.
    """

    def __new__(cls, var: str):
        obj = super().__new__(cls, f"${{{var}}}")
        obj.var = var
        return obj


def _sanitize_geo_env() -> None:
    """Drop machine-wide GDAL/PROJ overrides that point outside this venv.

    A system GDAL install (e.g. C:\\Program Files\\GDAL) exporting
    GDAL_DRIVER_PATH/GDAL_DATA/PROJ_LIB makes pyogrio's bundled GDAL load
    incompatible plugin DLLs — crashing with STATUS_ENTRYPOINT_NOT_FOUND on
    Windows. The pipeline always uses the wheel-bundled libraries.
    """
    import sys
    prefix = str(Path(sys.prefix).resolve()).lower()
    for var in ("GDAL_DRIVER_PATH", "GDAL_DATA", "PROJ_LIB"):
        val = os.environ.get(var)
        if val and not str(Path(val).resolve()).lower().startswith(prefix):
            os.environ.pop(var, None)


def _load_dotenv(root: Path) -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    env_file = root / ".env"
    if env_file.exists():
        load_dotenv(env_file, override=False)


def _expand(node: Any, missing: set[str]) -> Any:
    if isinstance(node, dict):
        return {k: _expand(v, missing) for k, v in node.items()}
    if isinstance(node, list):
        return [_expand(v, missing) for v in node]
    if isinstance(node, str):
        matches = ENV_PATTERN.findall(node)
        if not matches:
            return node
        # Whole-string single var: preserve type sentinel when unset
        if len(matches) == 1 and node.strip() == f"${{{matches[0]}}}":
            val = os.environ.get(matches[0])
            if val is None or val == "":
                missing.add(matches[0])
                return MissingEnv(matches[0])
            return val
        def sub(m: re.Match) -> str:
            val = os.environ.get(m.group(1))
            if val is None or val == "":
                missing.add(m.group(1))
                return m.group(0)
            return val
        return ENV_PATTERN.sub(sub, node)
    return node


class Config:
    def __init__(self, tree: dict, unset_env: set[str], root: Path):
        self._tree = tree
        self.unset_env = unset_env
        self.root = root

    @classmethod
    def load(cls, path: str | Path | None = None) -> "Config":
        root = PIPELINE_ROOT
        _sanitize_geo_env()
        _load_dotenv(root)
        cfg_path = Path(path) if path else root / "config" / "pipeline.yaml"
        if not cfg_path.exists():
            raise ConfigError(f"config file not found: {cfg_path}")
        with open(cfg_path, "r", encoding="utf-8") as fh:
            raw = yaml.safe_load(fh)
        if not isinstance(raw, dict):
            raise ConfigError(f"config file is not a mapping: {cfg_path}")
        missing: set[str] = set()
        tree = _expand(raw, missing)
        return cls(tree, missing, root)

    def get(self, dotted: str, default: Any = ...) -> Any:
        node: Any = self._tree
        for part in dotted.split("."):
            if isinstance(node, dict) and part in node:
                node = node[part]
            else:
                if default is ...:
                    raise ConfigError(f"missing config key: {dotted}")
                return default
        if isinstance(node, MissingEnv):
            raise ConfigError(
                f"config key {dotted} requires env var {node.var}, which is not set"
            )
        return node

    def section(self, dotted: str) -> dict:
        val = self.get(dotted)
        if not isinstance(val, dict):
            raise ConfigError(f"config key {dotted} is not a mapping")
        return val

    def path(self, key: str) -> Path:
        """Resolve a paths.* entry relative to the pipeline root."""
        p = Path(str(self.get(f"paths.{key}")))
        return p if p.is_absolute() else self.root / p

    def require_env(self, groups: Iterable[str]) -> None:
        """Fail fast, listing every unset env var any of the given groups needs."""
        needed: list[str] = []
        req = self.section("required_env")
        for g in groups:
            if g not in req:
                raise ConfigError(f"unknown required_env group: {g}")
            needed.extend(req[g] or [])
        unset = sorted({v for v in needed if not os.environ.get(v)})
        if unset:
            raise ConfigError(
                "missing required environment variables: " + ", ".join(unset)
                + " (see pipeline/.env.example)"
            )
