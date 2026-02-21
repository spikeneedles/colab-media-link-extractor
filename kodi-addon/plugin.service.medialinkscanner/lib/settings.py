"""
settings.py — Addon settings manager

Reads and writes all user-configurable values from Kodi's settings system.
Generates and persists a stable session UUID across restarts.
"""

import uuid
try:
    import xbmc  # type: ignore[import-not-found]
    import xbmcaddon  # type: ignore[import-not-found]
except Exception:  # Fallback for local dev outside Kodi
    class _KodiStub:
        LOGDEBUG = 0

        def log(self, *args, **kwargs):
            pass

        def getInfoLabel(self, *args, **kwargs):
            return ''

    class _AddonStub:
        def getSetting(self, *args, **kwargs):
            return ''

        def getSettingBool(self, *args, **kwargs):
            return False

        def getAddonInfo(self, *args, **kwargs):
            return ''

        def setSetting(self, *args, **kwargs):
            pass

    class _AddonModuleStub:
        def Addon(self, *args, **kwargs):
            return _AddonStub()

    xbmc = _KodiStub()
    xbmcaddon = _AddonModuleStub()

ADDON_ID = 'plugin.service.medialinkscanner'

# Default values
DEFAULT_API_URL       = 'http://localhost:3001'
DEFAULT_API_KEY       = ''
DEFAULT_ENABLED       = True
DEFAULT_DEBUG         = False
DEFAULT_SEND_REPO     = True
DEFAULT_HEARTBEAT_SEC = 30
DEFAULT_DEEP_SCAN      = True
DEFAULT_SCAN_ARCHIVES  = True
DEFAULT_SCAN_SQLITE    = True
DEFAULT_MAX_FILE_MB    = 20


def _addon():
    """Always fetch a fresh Addon instance so settings changes are reflected immediately."""
    return xbmcaddon.Addon(id=ADDON_ID)


def get_api_url() -> str:
    url = _addon().getSetting('api_url').strip()
    return url if url else DEFAULT_API_URL


def get_api_key() -> str:
    return _addon().getSetting('api_key').strip()


def is_enabled() -> bool:
    val = _addon().getSetting('enabled')
    return val.lower() == 'true' if val else DEFAULT_ENABLED


def is_debug() -> bool:
    val = _addon().getSetting('debug_log')
    return val.lower() == 'true' if val else DEFAULT_DEBUG


def send_repo_meta() -> bool:
    val = _addon().getSetting('send_repo_meta')
    return val.lower() == 'true' if val else DEFAULT_SEND_REPO


def get_heartbeat_interval() -> int:
    try:
        return int(_addon().getSetting('heartbeat_interval')) or DEFAULT_HEARTBEAT_SEC
    except (ValueError, TypeError):
        return DEFAULT_HEARTBEAT_SEC


def is_deep_scan_enabled() -> bool:
    try:
        val = _addon().getSetting('deep_scan')
        return val.lower() == 'true' if val else DEFAULT_DEEP_SCAN
    except Exception:
        return DEFAULT_DEEP_SCAN


def is_archive_scan_enabled() -> bool:
    try:
        val = _addon().getSetting('scan_archives')
        return val.lower() == 'true' if val else DEFAULT_SCAN_ARCHIVES
    except Exception:
        return DEFAULT_SCAN_ARCHIVES


def is_sqlite_scan_enabled() -> bool:
    try:
        val = _addon().getSetting('scan_sqlite')
        return val.lower() == 'true' if val else DEFAULT_SCAN_SQLITE
    except Exception:
        return DEFAULT_SCAN_SQLITE


def get_max_file_mb() -> int:
    try:
        value = int(_addon().getSetting('max_file_mb'))
        return value if value > 0 else DEFAULT_MAX_FILE_MB
    except (ValueError, TypeError):
        return DEFAULT_MAX_FILE_MB


def get_session_id() -> str:
    """
    Return a stable session UUID persisted in addon settings.
    Generated once on first run; survives Kodi restarts.
    """
    addon = _addon()
    existing = addon.getSetting('session_id').strip()
    if existing:
        return existing
    new_id = f'kodi-{uuid.uuid4()}'
    addon.setSetting('session_id', new_id)
    return new_id


def get_kodi_version() -> str:
    """Return Kodi major.minor version string."""
    build = xbmc.getInfoLabel('System.BuildVersion')
    # e.g. "21.0 (21.0.0) Git:20240101-..." → "21.0"
    return build.split(' ')[0] if build else 'unknown'


def log(message: str, level: int = xbmc.LOGDEBUG) -> None:
    """Prefixed logger respecting the debug toggle."""
    if level == xbmc.LOGDEBUG and not is_debug():
        return
    xbmc.log(f'[MediaLinkScanner] {message}', level=level)
