import json
import os
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, Request

DATA_DIR = Path(__file__).parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

USAGE_FILE = DATA_DIR / "llm_usage.json"
BALANCES_FILE = DATA_DIR / "user_token_balances.json"

router = APIRouter(prefix="/v2/llm-usage", tags=["LLM Usage"])


def _read_json(path):
    if not path.exists():
        return [] if path == USAGE_FILE else {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return [] if path == USAGE_FILE else {}


def _write_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def _now_iso():
    return datetime.utcnow().isoformat()


def get_user_id_from_request(request: Request | None):
    if not request:
        return None
    uid = None
    try:
        uid = request.headers.get("X-User-ID") or request.cookies.get("user_id")
    except Exception:
        uid = None
    if not uid:
        return None
    return uid


def log_usage(
    user_id: str | None,
    action: str,
    model: str,
    prompt_tokens: int | None = None,
    completion_tokens: int | None = None,
    total_tokens: int | None = None,
    cost_usd: float | None = None,
    metadata: dict | None = None,
    deduct_from_balance: bool = False
):
    """Append an LLM usage record to llm_usage.json and optionally deduct tokens from user balance."""
    records = _read_json(USAGE_FILE)
    rec = {
        "id": f"u-{int(datetime.utcnow().timestamp()*1000)}",
        "timestamp": _now_iso(),
        "user_id": user_id,
        "action": action,
        "model": model,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": total_tokens,
        "cost_usd": float(cost_usd) if cost_usd is not None else None,
        "metadata": metadata or {}
    }
    records.append(rec)
    _write_json(USAGE_FILE, records)

    # Adjust balance if requested and we have a user and tokens
    if deduct_from_balance and user_id and total_tokens:
        try:
            adjust_user_balance(user_id, -int(total_tokens))
        except Exception:
            pass

    return rec


def list_usage_for_user(user_id: str):
    records = _read_json(USAGE_FILE)
    return [r for r in records if r.get("user_id") == user_id]


# --- simple per-user token balance (units = tokens) ---
def _read_balances():
    return _read_json(BALANCES_FILE)


def _write_balances(data):
    _write_json(BALANCES_FILE, data)


def get_user_balance(user_id: str) -> int:
    data = _read_balances()
    return int(data.get(user_id, 0))


def set_user_balance(user_id: str, tokens: int):
    data = _read_balances()
    data[user_id] = int(tokens)
    _write_balances(data)
    return data[user_id]


def adjust_user_balance(user_id: str, delta: int) -> int:
    data = _read_balances()
    current = int(data.get(user_id, 0))
    new = current + int(delta)
    if new < 0:
        # Prevent negative balances
        new = 0
    data[user_id] = int(new)
    _write_balances(data)
    return new


@router.get("/user/{user_id}")
def api_list_usage_for_user(user_id: str):
    return {"usage": list_usage_for_user(user_id)}


@router.get("/balance/{user_id}")
def api_get_balance(user_id: str):
    return {"user_id": user_id, "tokens": get_user_balance(user_id)}


@router.post("/balance/{user_id}/adjust")
def api_adjust_balance(user_id: str, delta: int):
    new = adjust_user_balance(user_id, delta)
    return {"user_id": user_id, "tokens": new}
