"""HTTP helpers shared by adapters and discover.

All timeouts, retry counts, and backoff values come from config. Failures raise
FetchError carrying status + body snippet so callers can build full error
context for logs, ingest_runs, and the self-heal bundle.
"""
from __future__ import annotations

import time
from pathlib import Path
from typing import Any, Callable, Optional

import requests

from .log import get_logger

log = get_logger("http")


class FetchError(Exception):
    def __init__(self, message: str, url: str, status: Optional[int] = None,
                 body_snippet: Optional[str] = None):
        super().__init__(message)
        self.url = url
        self.status = status
        self.body_snippet = body_snippet


class Http:
    """Thin requests wrapper with config-driven retry/backoff.

    `session_factory` is injectable for tests (pass a fake session).
    """

    def __init__(self, timeout_s: float, max_retries: int, backoff_base_s: float,
                 user_agent: Optional[str] = None,
                 session_factory: Callable[[], Any] = requests.Session):
        self.timeout_s = timeout_s
        self.max_retries = max_retries
        self.backoff_base_s = backoff_base_s
        self.session = session_factory()
        if user_agent:
            self.session.headers["User-Agent"] = user_agent

    @classmethod
    def from_config(cls, cfg, section: str = "ingest", user_agent: Optional[str] = None) -> "Http":
        return cls(
            timeout_s=float(cfg.get(f"{section}.request_timeout_s")),
            max_retries=int(cfg.get("ingest.max_retries_per_run")),
            backoff_base_s=float(cfg.get("ingest.backoff_base_s")),
            user_agent=user_agent,
        )

    def _request(self, method: str, url: str, **kw) -> Any:
        last_exc: Optional[Exception] = None
        for attempt in range(self.max_retries + 1):
            try:
                resp = self.session.request(method, url, timeout=self.timeout_s, **kw)
                if resp.status_code >= 500 or resp.status_code == 429:
                    raise FetchError(
                        f"HTTP {resp.status_code} from {url}", url,
                        status=resp.status_code, body_snippet=resp.text[:4096],
                    )
                if resp.status_code >= 400:
                    raise FetchError(
                        f"HTTP {resp.status_code} from {url}", url,
                        status=resp.status_code, body_snippet=resp.text[:4096],
                    )
                return resp
            except FetchError as e:
                # 4xx (except 429) is not retryable
                if e.status is not None and 400 <= e.status < 500 and e.status != 429:
                    raise
                last_exc = e
            except requests.RequestException as e:
                last_exc = FetchError(f"{type(e).__name__}: {e}", url)
            if attempt < self.max_retries:
                delay = self.backoff_base_s * (2 ** attempt)
                log.warning("retrying %s in %.1fs (%s)", url, delay, last_exc)
                time.sleep(delay)
        raise last_exc  # type: ignore[misc]

    def get_json(self, url: str, params: Optional[dict] = None) -> Any:
        resp = self._request("GET", url, params=params)
        try:
            return resp.json()
        except ValueError as e:
            raise FetchError(f"non-JSON response: {e}", url, status=resp.status_code,
                             body_snippet=resp.text[:4096])

    def get_text(self, url: str, params: Optional[dict] = None) -> str:
        return self._request("GET", url, params=params).text

    def download(self, url: str, dest: Path) -> Path:
        """Stream a (possibly large) file to dest. Supports file:// for fixtures."""
        if url.startswith("file://"):
            src = Path(requests.utils.urlparse(url).path.lstrip("/"))
            dest.write_bytes(src.read_bytes())
            return dest
        with self.session.get(url, timeout=self.timeout_s, stream=True) as resp:
            if resp.status_code >= 400:
                raise FetchError(f"HTTP {resp.status_code} downloading {url}", url,
                                 status=resp.status_code, body_snippet=resp.text[:1024])
            with open(dest, "wb") as fh:
                for chunk in resp.iter_content(chunk_size=1 << 20):
                    fh.write(chunk)
        return dest
