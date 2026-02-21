"""
kodi_sync.py — Kodi Payload Extractor for /api/kodi-sync/receive

Extracts a three-tier confidence payload from a live xbmc.Player and
transmits it to the Harvester via POST /api/kodi-sync/receive.

Tier 1  (high confidence)  — addon.xml: id, source URL, website URL
Tier 2  (high confidence)  — inputstream headers: Referer, Origin
Tier 3  (medium confidence)— Player.Filenameandpath (resolved CDN URL)

All fields are explicitly set to None when unavailable so the Harvester
can fall back to lower-tier heuristics without KeyError.
"""

import os
import re

try:
    import xbmc  # type: ignore[import-not-found]
    import xbmcaddon  # type: ignore[import-not-found]
    import xbmcvfs  # type: ignore[import-not-found]
except Exception:  # Fallback for local dev outside Kodi
    class _KodiStub:
        LOGWARNING = 2

        def log(self, *args, **kwargs):
            pass

        def getInfoLabel(self, *args, **kwargs):
            return ''

    class _AddonStub:
        def getAddonInfo(self, *args, **kwargs):
            return ''

    class _AddonModuleStub:
        def Addon(self, *args, **kwargs):
            return _AddonStub()

    class _VfsStub:
        def translatePath(self, path):
            return path

        def listdir(self, path):
            return ([], [])

        def exists(self, path):
            return False

        class File:
            def __init__(self, *args, **kwargs):
                pass

            def size(self):
                return 0

            def read(self):
                return ''

            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                return False

    xbmc = _KodiStub()
    xbmcaddon = _AddonModuleStub()
    xbmcvfs = _VfsStub()

from lib.settings import log


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _label(key: str):
    """Safe xbmc.getInfoLabel — returns None (not empty string) on failure."""
    try:
        value = xbmc.getInfoLabel(key)
        return value if value else None
    except Exception:
        return None


def _parse_inputstream_headers(raw: str) -> dict:
    """
    Parse Kodi's inputstream header string:
      "User-Agent=Mozilla%2F5.0&Referer=https://site.com&Origin=https://site.com"
    Returns plain dict. Values are NOT URL-decoded (passed as-is to Harvester).
    """
    if not raw:
        return {}
    result = {}
    for pair in raw.split('&'):
        if '=' in pair:
            k, _, v = pair.partition('=')
            result[k.strip()] = v.strip()
    return result


def _read_addon_xml(addon_path: str) -> dict:
    """
    Parse addon.xml from the source plugin's install directory.

    Returns a dict with keys:
      source_url, website_url, forum_url — all may be None.
    """
    out = {'source_url': None, 'website_url': None, 'forum_url': None}
    if not addon_path:
        return out

    xml_path = os.path.join(addon_path, 'addon.xml')
    try:
        if not xbmcvfs.exists(xml_path):
            return out
        with xbmcvfs.File(xml_path) as fh:
            raw = fh.read()
            if isinstance(raw, bytes):
                raw = raw.decode('utf-8', errors='replace')

        def _tag(tag: str):
            m = re.search(rf'<{tag}[^>]*>([^<]+)</{tag}>', raw, re.IGNORECASE)
            return m.group(1).strip() if m else None

        out['source_url']  = _tag('source')
        out['website_url'] = _tag('website')
        out['forum_url']   = _tag('forum')

    except Exception as exc:
        log(f'kodi_sync: addon.xml read error ({addon_path}): {exc}')

    return out


def _or_none(value: str):
    """Return value if truthy, else None — keeps payload clean for Harvester."""
    return value if value else None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def build_payload(player, session_id: str) -> dict:
    """
    Build the /api/kodi-sync/receive payload from a live xbmc.Player.

    Structure matches KodiSyncJob on the backend:
      source_url, kodi_session_id, kodi_source, media_type, metadata{}

    Missing fields are explicitly None — the Harvester uses this to
    decide which confidence tier to fall back to.
    """

    # ── Tier 3: Player.Filenameandpath ──────────────────────────────────────
    # getInfoLabel gives the resolved stream path (may differ from plugin:// URL)
    filename_and_path = _label('Player.Filenameandpath')

    # Also grab the raw playing file — use as ultimate fallback for source_url
    raw_playing_file = None
    try:
        raw_playing_file = player.getPlayingFile() or None
    except Exception:
        pass

    # ── Tier 2: inputstream headers ─────────────────────────────────────────
    raw_stream_headers = _label('ListItem.Property(inputstream.adaptive.stream_headers)') or ''
    stream_headers     = _parse_inputstream_headers(raw_stream_headers)

    referer = _or_none(
        stream_headers.get('Referer')
        or stream_headers.get('referer')
    )
    origin = _or_none(
        stream_headers.get('Origin')
        or stream_headers.get('origin')
    )
    user_agent = _or_none(stream_headers.get('User-Agent') or stream_headers.get('user-agent'))

    # ── Tier 1: addon.xml introspection ─────────────────────────────────────
    plugin_name = _label('Container.PluginName')  # e.g. "plugin.video.seren"

    addon_id         = None
    addon_name       = None
    addon_version    = None
    addon_author     = None
    addon_source_url = None
    addon_website    = None

    if plugin_name:
        try:
            src_addon     = xbmcaddon.Addon(id=plugin_name)
            addon_id      = _or_none(src_addon.getAddonInfo('id'))
            addon_name    = _or_none(src_addon.getAddonInfo('name'))
            addon_version = _or_none(src_addon.getAddonInfo('version'))
            addon_author  = _or_none(src_addon.getAddonInfo('author'))
            # 'source' in Kodi == the GitHub/GitLab repo URL
            addon_source_url = _or_none(src_addon.getAddonInfo('source'))
            addon_path = src_addon.getAddonInfo('path')

            # Parse addon.xml for extra fields xbmcaddon may not surface
            xml_data = _read_addon_xml(addon_path)
            if not addon_source_url:
                addon_source_url = xml_data['source_url']
            addon_website = xml_data['website_url']

        except Exception as exc:
            log(f'kodi_sync: addon introspection failed for "{plugin_name}": {exc}')

    # ── Confidence-ranked source_url ────────────────────────────────────────
    # Tier 1 → Tier 2 → Tier 3, as defined in the Confidence Tier Map
    source_url = (
        addon_source_url       # T1: direct repo URL from addon metadata
        or addon_website       # T1: addon website URL
        or referer             # T2: Referer header
        or origin              # T2: Origin header
        or filename_and_path   # T3: resolved CDN URL
        or raw_playing_file    # T3: plugin:// URL (lowest signal)
    )

    # ── Content labels ───────────────────────────────────────────────────────
    title        = _label('Player.Title')
    channel_name = _label('VideoPlayer.ChannelName')
    media_type   = _label('ListItem.MediaType')  # 'movie' | 'episode' | 'tvshow' | None

    # Map Kodi media type to the Harvester's expected vocabulary
    _media_type_map = {
        'movie':   'movie',
        'episode': 'tv-series',
        'tvshow':  'tv-series',
        'season':  'tv-series',
        'song':    'vod',
        'album':   'vod',
    }
    harvester_media_type = _media_type_map.get(media_type.lower() if media_type else '', None)
    if not harvester_media_type and channel_name:
        harvester_media_type = 'live-tv'

    # ── Assemble final payload ───────────────────────────────────────────────
    payload = {
        # Required by /api/kodi-sync/receive
        'source_url':       source_url,
        'kodi_session_id':  session_id,
        'kodi_source':      addon_name or plugin_name,
        'media_type':       harvester_media_type,

        # metadata sub-object
        'metadata': {
            'title':       _or_none(title or channel_name),
            'category':    _or_none(channel_name),
            'source_name': addon_name or plugin_name,

            # Confidence tier data — used by the Harvester directly
            'confidence_tiers': {
                'tier1': {
                    'addon_id':         addon_id,
                    'addon_version':    addon_version,
                    'addon_author':     addon_author,
                    'addon_source_url': addon_source_url,
                    'addon_website':    addon_website,
                },
                'tier2': {
                    'referer':    referer,
                    'origin':     origin,
                    'user_agent': user_agent,
                },
                'tier3': {
                    'filename_and_path': filename_and_path,
                    'raw_playing_file':  raw_playing_file,
                },
            },
        },
    }

    return payload


def transmit(player, session_id: str) -> None:
    """
    Build and POST the kodi-sync payload.
    Runs inside a daemon thread — never blocks the Kodi event thread.
    """
    from lib import api_client  # local import avoids circular import at module load

    payload = build_payload(player, session_id)

    if not payload.get('source_url'):
        log('kodi_sync.transmit: source_url is None across all tiers — skipping POST')
        return

    log(
        f'kodi_sync: transmitting '
        f'[{payload.get("media_type") or "?"}] '
        f'"{payload["metadata"].get("title") or "untitled"}" → {str(payload["source_url"])[:80]}'
    )

    api_client.kodi_sync_receive(payload)
