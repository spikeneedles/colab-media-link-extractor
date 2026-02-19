#!/usr/bin/env python3
"""
LinkScan mitmproxy addon — Media URL extraction and real-time forwarding.

Intercepts all HTTPS responses, identifies media URLs by:
  - File extension (.m3u8, .mpd, .ts, .mp4, etc.)
  - Content-Type header (video/*, audio/*, application/x-mpegURL, etc.)
  - Xtream Codes API patterns (player_api.php)
  - HLS/DASH manifest markers in response body

Captured URLs are POSTed to the LinkScan backend SSE ingest endpoint in a
non-blocking daemon thread so the proxy never stalls.

Usage:
  mitmdump -s scripts/mitm_addon.py --listen-port 8080 --listen-host 0.0.0.0

Environment:
  BACKEND_URL   Base URL of the LinkScan backend  (default: http://localhost:3001)
  CAPTURE_BODY  Also scan response bodies for URLs (default: 1)
  MIN_URL_LEN   Minimum URL length to consider     (default: 20)
"""

import os
import re
import json
import threading
import requests
from mitmproxy import http, ctx

# ─────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────
BACKEND_URL   = os.environ.get("BACKEND_URL", "http://localhost:3001")
INGEST_URL    = f"{BACKEND_URL}/api/runtime-capture/ingest"
CAPTURE_BODY  = os.environ.get("CAPTURE_BODY", "1") == "1"
MIN_URL_LEN   = int(os.environ.get("MIN_URL_LEN", "20"))

# ─────────────────────────────────────────────
# Detection patterns
# ─────────────────────────────────────────────

# Extensions that almost certainly indicate streamable media
MEDIA_EXT_RE = re.compile(
    r"\.(m3u8?|mpd|ts|mp4|mkv|avi|flv|webm|mov|wmv|"
    r"mp3|aac|ogg|opus|flac|m4[av]|ac3|dts|"
    r"f4[vm]|isml?|strm|mts|m2ts|vob|rmvb|asf|divx)"
    r"(\?[^\"'\s]*)?$",
    re.IGNORECASE,
)

# Non-HTTP streaming protocols (appear in logcat / extracted refs)
STREAMING_PROTO_RE = re.compile(
    r"^(rtsp|rtsps|rtmps?|rtmpe|rtmpt|mms|mmsh|rtp|udp):\/\/",
    re.IGNORECASE,
)

# Xtream Codes API — captures credentials + server in one shot
XTREAM_RE = re.compile(
    r"player_api\.php\?username=([^&\s]+)&password=([^&\s]+)",
    re.IGNORECASE,
)

# HLS/DASH in response body (catches dynamically built manifests)
BODY_URL_RE = re.compile(
    r"https?://[^\s\"'<>]{10,}\.(?:m3u8?|mpd|ts)(?:\?[^\s\"'<>]*)?",
    re.IGNORECASE,
)

# Media Content-Type headers
MEDIA_CONTENT_TYPES = {
    "video/",
    "audio/",
    "application/x-mpegurl",
    "application/vnd.apple.mpegurl",
    "application/dash+xml",
    "application/vnd.ms-sstr+xml",  # Smooth Streaming
    "application/octet-stream",      # Catch-all for binary streams
}

# Skip these — waste of capture slots
SKIP_HOSTS = {
    "clients3.google.com",
    "play.googleapis.com",
    "fcm.googleapis.com",
    "ocsp.pki.goog",
    "safebrowsing.googleapis.com",
}

# ─────────────────────────────────────────────
# State
# ─────────────────────────────────────────────
_seen: set[str] = set()
_lock = threading.Lock()

# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def _is_media_url(url: str) -> bool:
    if len(url) < MIN_URL_LEN:
        return False
    if MEDIA_EXT_RE.search(url):
        return True
    if STREAMING_PROTO_RE.match(url):
        return True
    if XTREAM_RE.search(url):
        return True
    return False

def _is_media_content_type(ct: str) -> bool:
    ct_lower = ct.lower()
    return any(ct_lower.startswith(m) for m in MEDIA_CONTENT_TYPES)

def _push(url: str, source: str, metadata: dict) -> None:
    """Non-blocking POST to backend — runs in daemon thread."""
    try:
        requests.post(
            INGEST_URL,
            json={"url": url, "source": source, "metadata": metadata},
            timeout=2,
        )
        ctx.log.info(f"[CAPTURE] {url}")
    except Exception as exc:
        ctx.log.debug(f"[PUSH FAIL] {exc}")

def _emit(url: str, source: str, metadata: dict) -> None:
    """Deduplicate then push in background thread."""
    with _lock:
        if url in _seen:
            return
        _seen.add(url)
    threading.Thread(target=_push, args=(url, source, metadata), daemon=True).start()

# ─────────────────────────────────────────────
# Addon
# ─────────────────────────────────────────────

class MediaCapture:
    def load(self, loader):
        ctx.log.info(f"[LinkScan] mitmproxy addon loaded → pushing to {INGEST_URL}")

    def response(self, flow: http.HTTPFlow) -> None:
        if flow.request.host in SKIP_HOSTS:
            return

        url = flow.request.pretty_url
        ct  = flow.response.headers.get("content-type", "")
        status = flow.response.status_code

        meta_base = {
            "host":        flow.request.host,
            "path":        flow.request.path,
            "statusCode":  status,
            "contentType": ct,
        }

        # 1. Direct media URL (extension match)
        if _is_media_url(url):
            _emit(url, "mitm-url", meta_base)

        # 2. Media by Content-Type (e.g. streamer returning binary without extension)
        elif _is_media_content_type(ct) and status == 200:
            _emit(url, "mitm-content-type", meta_base)

        # 3. Body scan — HLS/DASH manifests that reference segment URLs
        if CAPTURE_BODY and flow.response.content:
            try:
                text = flow.response.content.decode("utf-8", errors="ignore")
                for match in BODY_URL_RE.finditer(text):
                    found = match.group(0).rstrip("\"'>,;")
                    _emit(found, "mitm-body", {**meta_base, "foundIn": url})
            except Exception:
                pass

    def request(self, flow: http.HTTPFlow) -> None:
        """Catch Xtream Codes credential leaks in request URLs."""
        if XTREAM_RE.search(flow.request.pretty_url):
            _emit(
                flow.request.pretty_url,
                "mitm-xtream",
                {
                    "host": flow.request.host,
                    "path": flow.request.path,
                    "statusCode": None,
                    "contentType": None,
                },
            )


addons = [MediaCapture()]
