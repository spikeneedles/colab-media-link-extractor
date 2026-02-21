"""
metadata.py — Five-layer metadata extractor

Pulls every useful signal from Kodi at the moment playback starts:
  Layer 1: Raw stream URL (xbmc.Player.getPlayingFile)
  Layer 2: InfoLabels  (title, channel, IMDB, codecs, resolution)
  Layer 3: ListItem properties (inputstream headers → Referer, User-Agent)
  Layer 4: Addon introspection (id, version, author, sourceUrl via xbmcaddon)
  Layer 5: addon.xml on-disk parse (dependencies, website, forum, raw XML)
"""

import os
import re
import json
import datetime

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

from lib.settings import log, get_kodi_version


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _label(key: str) -> str:
    """Safe xbmc.getInfoLabel wrapper — returns empty string on failure."""
    try:
        return xbmc.getInfoLabel(key) or ''
    except Exception:
        return ''


def _parse_inputstream_headers(raw: str) -> dict:
    """
    Parse Kodi's inputstream header string format:
      "User-Agent=Mozilla/5.0&Referer=https://site.com&Origin=https://site.com"
    Returns a plain dict of header_name → value.
    """
    headers = {}
    if not raw:
        return headers
    for pair in raw.split('&'):
        if '=' in pair:
            key, _, value = pair.partition('=')
            headers[key.strip()] = value.strip()
    return headers


def _parse_addon_xml(addon_path: str) -> dict:
    """
    Read addon.xml from disk and extract source, website, forum, dependencies.
    Returns a dict with extracted fields (all optional / may be empty string).
    """
    result = {
        'sourceUrl':     '',
        'websiteUrl':    '',
        'forumUrl':      '',
        'license':       '',
        'dependencies':  [],
        'rawXml':        '',
    }

    xml_path = os.path.join(addon_path, 'addon.xml')
    try:
        if not xbmcvfs.exists(xml_path):
            return result

        with xbmcvfs.File(xml_path) as fh:
            raw = fh.read()
            if isinstance(raw, bytes):
                raw = raw.decode('utf-8', errors='replace')

        result['rawXml'] = raw[:4096]  # cap payload size

        def _extract(tag: str) -> str:
            m = re.search(rf'<{tag}[^>]*>([^<]+)</{tag}>', raw, re.IGNORECASE)
            return m.group(1).strip() if m else ''

        result['sourceUrl']  = _extract('source')
        result['websiteUrl'] = _extract('website')
        result['forumUrl']   = _extract('forum')
        result['license']    = _extract('license')

        # Dependency addon IDs: <import addon="script.module.requests" .../>
        result['dependencies'] = re.findall(
            r'<import\s+addon=["\']([^"\']+)["\']', raw, re.IGNORECASE
        )

    except Exception as exc:
        log(f'addon.xml parse error ({xml_path}): {exc}')

    return result


def _classify_stream_type(url: str, extension: str) -> str:
    """Infer streaming protocol/type from URL and file extension."""
    lower = url.lower()
    if lower.startswith('rtmp'):
        return 'rtmp'
    if lower.startswith('rtsp'):
        return 'rtsp'
    if lower.startswith('mms'):
        return 'mms'
    if lower.startswith('udp') or lower.startswith('rtp'):
        return 'udp'
    if extension in ('m3u8',) or 'm3u8' in lower:
        return 'hls'
    if extension == 'mpd' or '.mpd' in lower:
        return 'dash'
    if extension == 'ts':
        return 'mpeg-ts'
    if extension in ('mp4', 'mkv', 'avi', 'webm', 'mov'):
        return 'progressive'
    if extension in ('mp3', 'aac', 'flac', 'ogg', 'm4a'):
        return 'audio'
    if 'player_api.php' in lower:
        return 'xtream-codes'
    return 'unknown'


def _classify_content_type(labels: dict) -> str:
    """Map Kodi labels to the content-type field the backend understands."""
    if labels.get('channelName') or labels.get('channelNumber'):
        return 'tv'
    if labels.get('tvShowTitle') or (labels.get('season') and labels.get('episode')):
        return 'series'
    media_type = _label('ListItem.MediaType').lower()
    if media_type == 'episode':
        return 'series'
    if media_type == 'movie':
        return 'movie'
    if media_type in ('music', 'song', 'album'):
        return 'audio'
    if media_type in ('tvshow', 'season'):
        return 'series'
    return 'channel'


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def extract(player) -> dict:
    """
    Build the complete metadata payload from a live xbmc.Player instance.
    Called immediately inside onPlayBackStarted — player state is valid.

    Returns the full dict that maps to the /api/extension/capture body.
    """

    # ------------------------------------------------------------------
    # Layer 1: Raw stream URL
    # ------------------------------------------------------------------
    playing_file = ''
    try:
        playing_file = player.getPlayingFile() or ''
    except Exception as exc:
        log(f'getPlayingFile error: {exc}')

    filename    = os.path.basename(playing_file.split('?')[0])
    extension   = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    protocol    = playing_file.split('://')[0].lower() if '://' in playing_file else 'unknown'
    stream_type = _classify_stream_type(playing_file, extension)

    # Fallback: Player.Filenameandpath may differ (plugin-resolved vs actual)
    filename_and_path = _label('Player.Filenameandpath')

    stream_layer = {
        'playingFile':      playing_file,
        'filenameAndPath':  filename_and_path,
        'filename':         filename,
        'protocol':         protocol,
        'extension':        extension,
        'streamType':       stream_type,
    }

    # ------------------------------------------------------------------
    # Layer 2: InfoLabels — content identity + stream tech
    # ------------------------------------------------------------------
    content_labels = {
        'title':           _label('Player.Title'),
        'originalTitle':   _label('VideoPlayer.OriginalTitle'),
        'channelName':     _label('VideoPlayer.ChannelName'),
        'channelNumber':   _label('VideoPlayer.ChannelNumber'),
        'tvShowTitle':     _label('VideoPlayer.TVShowTitle'),
        'season':          _label('VideoPlayer.Season'),
        'episode':         _label('VideoPlayer.Episode'),
        'year':            _label('VideoPlayer.Year'),
        'imdbId':          _label('VideoPlayer.IMDBNumber'),
        'genre':           _label('VideoPlayer.Genre'),
        'videoCodec':      _label('VideoPlayer.VideoCodec'),
        'videoResolution': _label('VideoPlayer.VideoResolution'),
        'audioCodec':      _label('VideoPlayer.AudioCodec'),
        'audioChannels':   _label('VideoPlayer.AudioChannels'),
        'mediaType':       _label('ListItem.MediaType'),
    }

    content_type   = _classify_content_type(content_labels)
    display_title  = (
        content_labels['title']
        or content_labels['channelName']
        or content_labels['tvShowTitle']
        or filename
        or playing_file
    )

    content_layer = {
        'type':            content_type,
        **content_labels,
    }

    # ------------------------------------------------------------------
    # Layer 3: ListItem inputstream headers (Referer, User-Agent, etc.)
    # ------------------------------------------------------------------
    raw_stream_headers    = _label('ListItem.Property(inputstream.adaptive.stream_headers)')
    raw_manifest_headers  = _label('ListItem.Property(inputstream.adaptive.manifest_headers)')
    raw_license_key       = _label('ListItem.Property(inputstream.adaptive.license_key)')
    inputstream_type      = _label('ListItem.Property(inputstream)')

    stream_headers   = _parse_inputstream_headers(raw_stream_headers)
    manifest_headers = _parse_inputstream_headers(raw_manifest_headers)

    # Promote the most important headers to top-level for easy scraper access
    user_agent = stream_headers.get('User-Agent', '')
    referer    = stream_headers.get('Referer', stream_headers.get('referer', ''))
    origin     = stream_headers.get('Origin', stream_headers.get('origin', ''))

    # Merge remaining non-standard headers
    skip_keys      = {'User-Agent', 'user-agent', 'Referer', 'referer', 'Origin', 'origin'}
    custom_headers = {k: v for k, v in stream_headers.items() if k not in skip_keys}

    headers_layer = {
        'userAgent':              user_agent,
        'referer':                referer,
        'origin':                 origin,
        'customHeaders':          custom_headers,
        'rawInputstreamHeaders':  raw_stream_headers,
        'rawManifestHeaders':     raw_manifest_headers,
        'inputstreamType':        inputstream_type,
        'licenseKey':             raw_license_key,
    }

    # ------------------------------------------------------------------
    # Layer 4: Addon introspection via xbmcaddon
    # ------------------------------------------------------------------
    plugin_name   = _label('Container.PluginName')   # e.g. "plugin.video.seren"
    folder_path   = _label('Container.FolderPath')   # e.g. "plugin://plugin.video.seren/"

    addon_layer       = {}
    addon_xml_layer   = {}

    if plugin_name:
        try:
            src_addon = xbmcaddon.Addon(id=plugin_name)
            addon_path = src_addon.getAddonInfo('path')

            addon_layer = {
                'id':          src_addon.getAddonInfo('id'),
                'name':        src_addon.getAddonInfo('name'),
                'version':     src_addon.getAddonInfo('version'),
                'author':      src_addon.getAddonInfo('author'),
                'path':        addon_path,
                'description': src_addon.getAddonInfo('description'),
                # 'source' field in Kodi corresponds to the GitHub/repo URL
                'sourceUrl':   src_addon.getAddonInfo('source'),
            }

            # ------------------------------------------------------------------
            # Layer 5: addon.xml on-disk parse (dependencies, website, forum)
            # ------------------------------------------------------------------
            addon_xml_layer = _parse_addon_xml(addon_path)

            # Promote sourceUrl from xml if xbmcaddon didn't surface it
            if not addon_layer['sourceUrl'] and addon_xml_layer.get('sourceUrl'):
                addon_layer['sourceUrl'] = addon_xml_layer['sourceUrl']

            addon_layer.update({
                'websiteUrl':   addon_xml_layer.get('websiteUrl', ''),
                'forumUrl':     addon_xml_layer.get('forumUrl', ''),
                'dependencies': addon_xml_layer.get('dependencies', []),
            })

        except Exception as exc:
            log(f'Addon introspection error for "{plugin_name}": {exc}')

    # ------------------------------------------------------------------
    # Repository hint — synthesised from all layers for the scraper
    # ------------------------------------------------------------------
    # Build a prioritised list of candidate repo URLs
    # The backend's repositoryDetector.ts will validate and crawl these
    repo_candidates = []

    # Tier 1 — direct from addon metadata
    if addon_layer.get('sourceUrl'):
        repo_candidates.append({
            'url':             addon_layer['sourceUrl'],
            'confidence':      'high',
            'detectionMethod': 'addon_source_field',
        })

    if addon_layer.get('websiteUrl'):
        repo_candidates.append({
            'url':             addon_layer['websiteUrl'],
            'confidence':      'high',
            'detectionMethod': 'addon_website_field',
        })

    # Tier 2 — Referer header
    if referer:
        repo_candidates.append({
            'url':             referer,
            'confidence':      'high',
            'detectionMethod': 'referer_header',
        })

    # Tier 3 — Origin header
    if origin:
        repo_candidates.append({
            'url':             origin,
            'confidence':      'medium',
            'detectionMethod': 'origin_header',
        })

    # Tier 4 — stream URL itself (existing backend detection logic handles this)
    if playing_file:
        repo_candidates.append({
            'url':             playing_file,
            'confidence':      'low',
            'detectionMethod': 'stream_url',
        })

    repository_layer = {
        'candidates':    repo_candidates,
        'primaryUrl':    repo_candidates[0]['url'] if repo_candidates else playing_file,
        'referrerUrl':   referer,
        'referrerDomain': referer.split('/')[2] if referer and '/' in referer else '',
        'addonId':       plugin_name,
    }

    container_layer = {
        'folderPath':  folder_path,
        'pluginName':  plugin_name,
    }

    # ------------------------------------------------------------------
    # Assemble final payload
    # ------------------------------------------------------------------
    return {
        'streamUrl':   playing_file,
        'title':       display_title,
        'capturedAt':  datetime.datetime.utcnow().isoformat() + 'Z',
        'kodiVersion': get_kodi_version(),
        'stream':      stream_layer,
        'content':     content_layer,
        'headers':     headers_layer,
        'addon':       addon_layer,
        'repository':  repository_layer,
        'container':   container_layer,
    }
