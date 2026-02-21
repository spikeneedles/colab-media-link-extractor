"""
api_client.py — Non-blocking HTTP client for the Media Link Scanner backend.

All network calls run in daemon threads so they NEVER block Kodi playback.
The client follows the same session lifecycle as the browser extension:
  1. register   → POST /api/extension/register
  2. heartbeat  → POST /api/extension/heartbeat  (every N seconds)
  3. capture    → POST /api/extension/capture     (on each playback event)
  4. disconnect → DELETE /api/extension/sessions/:id  (on shutdown)
"""

import json
import threading
import urllib.request
import urllib.error
import urllib.parse
from typing import Optional

try:
    import xbmc  # type: ignore[import-not-found]
except Exception:  # Fallback for local dev outside Kodi
    class _KodiStub:
        LOGWARNING = 2
        LOGDEBUG = 0

        def log(self, *args, **kwargs):
            pass

    xbmc = _KodiStub()

from lib.settings import get_api_url, get_api_key, is_debug, log


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _build_headers() -> dict:
    headers = {'Content-Type': 'application/json'}
    api_key = get_api_key()
    if api_key:
        headers['X-API-Key'] = api_key
    return headers


def _post(path: str, payload: dict) -> Optional[dict]:
    """
    Synchronous POST — always called from a background thread.
    Returns parsed JSON response or None on error.
    """
    url = get_api_url().rstrip('/') + path
    data = json.dumps(payload).encode('utf-8')
    headers = _build_headers()

    req = urllib.request.Request(url, data=data, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read().decode('utf-8', errors='replace')
            return json.loads(body)
    except urllib.error.HTTPError as exc:
        log(f'HTTP {exc.code} on POST {path}: {exc.reason}', level=xbmc.LOGWARNING)
    except urllib.error.URLError as exc:
        log(f'Connection error on POST {path}: {exc.reason}', level=xbmc.LOGWARNING)
    except Exception as exc:
        log(f'Unexpected error on POST {path}: {exc}', level=xbmc.LOGWARNING)
    return None


def _delete(path: str) -> bool:
    """Synchronous DELETE — called from background thread on shutdown."""
    url = get_api_url().rstrip('/') + path
    headers = _build_headers()

    req = urllib.request.Request(url, headers=headers, method='DELETE')
    try:
        with urllib.request.urlopen(req, timeout=5):
            return True
    except Exception as exc:
        log(f'DELETE {path} failed: {exc}', level=xbmc.LOGWARNING)
    return False


def _run_in_thread(fn, *args, **kwargs) -> None:
    """Fire-and-forget daemon thread wrapper."""
    t = threading.Thread(target=fn, args=args, kwargs=kwargs, daemon=True)
    t.start()


# ---------------------------------------------------------------------------
# Session lifecycle
# ---------------------------------------------------------------------------

def register(session_id: str) -> bool:
    """
    Register this Kodi instance with the backend.
    Called once at service startup.
    Returns True on success.
    """
    log(f'Registering session: {session_id}')
    result = _post('/api/extension/register', {
        'extensionId': session_id,
        'name':        f'Kodi ({session_id[:8]})',
    })
    if result and result.get('success'):
        log(f'Session registered: {result.get("sessionId")}')
        return True
    log('Registration failed — backend may be unavailable', level=xbmc.LOGWARNING)
    return False


def announce_session(session_id: str, kodi_source: Optional[str] = None) -> None:
    """
    Announce the session to the Kodi Sync API so the dashboard can auto-discover it.
    Runs in a daemon thread — never blocks playback.
    """
    payload = {
        'session_id': session_id,
        'kodi_source': kodi_source or 'Kodi Addon',
    }

    def _do():
        result = _post('/api/kodi-sync/announce', payload)
        if result and result.get('success'):
            log(f'Kodi session announced: {session_id[:8]}')
        else:
            log('Kodi session announce failed', level=xbmc.LOGWARNING)

    _run_in_thread(_do)


def send_heartbeat(session_id: str) -> None:
    """
    Send a keep-alive signal. Called every N seconds from the heartbeat loop.
    Runs in a daemon thread.
    """
    def _do():
        result = _post('/api/extension/heartbeat', {'sessionId': session_id})
        if result:
            log(f'Heartbeat OK for session {session_id[:8]}')
        else:
            log(f'Heartbeat failed for session {session_id[:8]}', level=xbmc.LOGWARNING)

    _run_in_thread(_do)


def capture(session_id: str, metadata: dict) -> None:
    """
    Send a captured media URL + full metadata to the backend.
    The backend will auto-start a domain crawl on receipt.
    Runs in a daemon thread — NEVER blocks playback.
    """
    stream_url    = metadata.get('streamUrl', '')
    display_title = metadata.get('title', '')

    if not stream_url:
        log('capture() called with empty streamUrl — skipping', level=xbmc.LOGWARNING)
        return

    log(f'Capturing: [{metadata.get("content", {}).get("type", "?")}] {display_title} → {stream_url[:80]}')

    def _do():
        result = _post('/api/extension/capture', {
            'sessionId': session_id,
            'url':       stream_url,
            'title':     display_title,
            'metadata':  metadata,
        })
        if result and result.get('success'):
            crawl_id = result.get('crawlSessionId', '')
            log(f'Capture accepted. Crawl started: {crawl_id}')
        else:
            log('Capture POST failed or rejected', level=xbmc.LOGWARNING)

    _run_in_thread(_do)


def kodi_sync_receive(payload: dict) -> None:
    """
    POST to /api/kodi-sync/receive — the Harvester's intake endpoint.

    Payload schema:
      source_url, kodi_session_id, kodi_source, media_type, metadata{}

    Runs in a daemon thread — never blocks playback.
    """
    source_url = payload.get('source_url', '')
    log(f'kodi_sync_receive → {str(source_url)[:80]}')

    def _do():
        result = _post('/api/kodi-sync/receive', payload)
        if result and result.get('success'):
            job_id = result.get('job_id', '')
            repo   = result.get('repository_detection', {})
            log(
                f'kodi_sync accepted: job={job_id} '
                f'type={repo.get("detected_type")} '
                f'confidence={repo.get("confidence")}'
            )
        else:
            log('kodi_sync_receive POST failed or rejected', level=xbmc.LOGWARNING)

    _run_in_thread(_do)


def kodi_sync_batch(payload: dict) -> None:
    """
    POST to /api/kodi-sync/batch for bulk URL ingestion.

    Payload schema:
      urls: ["https://...", ...]
      kodi_session_id, kodi_source, metadata{}
    """
    urls = payload.get('urls', [])
    log(f'kodi_sync_batch → {len(urls)} urls')

    def _do():
        result = _post('/api/kodi-sync/batch', payload)
        if result and result.get('success'):
            log(f'kodi_sync_batch accepted: {result.get("batch_size", 0)} urls')
        else:
            log('kodi_sync_batch POST failed or rejected', level=xbmc.LOGWARNING)

    _run_in_thread(_do)


def disconnect(session_id: str) -> None:
    """
    Gracefully unregister the session on Kodi shutdown.
    Called synchronously (Kodi is exiting — no point spinning a thread).
    """
    log(f'Disconnecting session: {session_id}')
    _delete(f'/api/extension/sessions/{session_id}')
