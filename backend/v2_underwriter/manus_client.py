# =============================================================================
# MANUS API CLIENT — Stage 2 Pitch Deck Designer
# Handles task creation, polling, and result retrieval from Manus API
# =============================================================================

import os
import time
import logging
import requests

log = logging.getLogger(__name__)

MANUS_API_BASE = "https://api.manus.ai/v1"


def _get_headers(api_key: str = None) -> dict:
    """Build Manus API request headers."""
    key = api_key or os.getenv("MANUS_API_KEY")
    if not key:
        raise ValueError("MANUS_API_KEY not configured")
    return {
        "API_KEY": key,
        "Content-Type": "application/json",
    }


def create_task(prompt: str, api_key: str = None) -> str:
    """
    Create a new Manus task.
    
    Args:
        prompt: The full prompt for Manus (Stage 2 design prompt with deal summary injected)
        api_key: Optional API key override
        
    Returns:
        task_id string
    """
    headers = _get_headers(api_key)
    payload = {
        "prompt": prompt,
        "agentProfile": "manus-1.6-max",
        "taskMode": "agent",
    }

    log.info(f"[Manus] Creating task (prompt length: {len(prompt)} chars)")
    resp = requests.post(f"{MANUS_API_BASE}/tasks", json=payload, headers=headers, timeout=30)
    resp.raise_for_status()

    data = resp.json()
    task_id = data.get("task_id") or data.get("id")
    if not task_id:
        raise ValueError(f"Manus API did not return a task_id: {data}")

    log.info(f"[Manus] Task created: {task_id}")
    return task_id


def get_task_status(task_id: str, api_key: str = None) -> dict:
    """
    Check the status of a Manus task.
    
    Returns:
        dict with at minimum { "status": "running"|"completed"|"failed", ... }
    """
    headers = _get_headers(api_key)
    resp = requests.get(f"{MANUS_API_BASE}/tasks/{task_id}", headers=headers, timeout=15)
    resp.raise_for_status()
    return resp.json()


def poll_until_complete(task_id: str, api_key: str = None,
                        poll_interval: int = 10, max_wait: int = 600) -> dict:
    """
    Poll a Manus task until it completes or fails.
    
    Args:
        task_id: The task to poll
        api_key: Optional API key override
        poll_interval: Seconds between polls (default 10)
        max_wait: Maximum seconds to wait (default 600 = 10 minutes)
        
    Returns:
        Completed task dict
        
    Raises:
        TimeoutError: if max_wait exceeded
        RuntimeError: if task fails
    """
    elapsed = 0
    while elapsed < max_wait:
        status_data = get_task_status(task_id, api_key)
        status = (status_data.get("status") or "").lower()

        log.info(f"[Manus] Task {task_id} status: {status} (elapsed: {elapsed}s)")

        if status == "completed":
            return status_data
        elif status == "failed":
            error_msg = status_data.get("error") or status_data.get("message") or "Unknown error"
            raise RuntimeError(f"Manus task failed: {error_msg}")

        time.sleep(poll_interval)
        elapsed += poll_interval

    raise TimeoutError(f"Manus task {task_id} did not complete within {max_wait}s")


def upload_file(file_path: str, api_key: str = None) -> str:
    """
    Upload a file to Manus (e.g., for supplementary data).
    
    Returns:
        file_id string
    """
    key = api_key or os.getenv("MANUS_API_KEY")
    if not key:
        raise ValueError("MANUS_API_KEY not configured")

    headers = {"API_KEY": key}  # No Content-Type for multipart

    with open(file_path, "rb") as f:
        resp = requests.post(
            f"{MANUS_API_BASE}/files",
            headers=headers,
            files={"file": f},
            timeout=60,
        )
    resp.raise_for_status()
    data = resp.json()
    file_id = data.get("file_id") or data.get("id")
    log.info(f"[Manus] File uploaded: {file_id}")
    return file_id


def extract_slides_from_task(task_result: dict) -> list:
    """
    Parse completed Manus task result to extract HTML slide content.
    
    Manus returns files in the task output — look for slide_01.html through slide_16.html.
    
    Returns:
        List of dicts: [{"slideNumber": 1, "title": "...", "html": "..."}, ...]
    """
    slides = []
    
    # Manus may return output in different structures
    # Try "output" / "files" / "artifacts" keys
    output = task_result.get("output") or task_result.get("result") or {}
    files = output.get("files") or task_result.get("files") or task_result.get("artifacts") or []
    
    if isinstance(files, list):
        for f in files:
            name = f.get("name") or f.get("filename") or ""
            content = f.get("content") or f.get("data") or ""
            
            if name.startswith("slide_") and name.endswith(".html"):
                try:
                    num = int(name.replace("slide_", "").replace(".html", ""))
                except ValueError:
                    num = len(slides) + 1
                
                slides.append({
                    "slideNumber": num,
                    "title": f"Slide {num}",
                    "html": content,
                })
    
    # Sort by slide number
    slides.sort(key=lambda s: s["slideNumber"])
    
    if not slides:
        log.warning(f"[Manus] No slide files found in task result. Keys: {list(task_result.keys())}")
        # If no structured files, check if there's raw text output with HTML
        raw_output = task_result.get("output") or task_result.get("result") or ""
        if isinstance(raw_output, str) and "<html" in raw_output.lower():
            slides.append({
                "slideNumber": 1,
                "title": "Full Deck",
                "html": raw_output,
            })
    
    return slides


def is_available() -> bool:
    """Check if Manus API key is configured."""
    return bool(os.getenv("MANUS_API_KEY"))
