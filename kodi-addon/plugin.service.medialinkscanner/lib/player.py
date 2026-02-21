"""
player.py — xbmc.Player subclass

Intercepts Kodi playback events and orchestrates metadata extraction
and API capture. All heavy work (metadata + HTTP) is handed off so
the player hook returns instantly and never stalls playback.
"""

import threading
import time

try:
    import xbmc  # type: ignore[import-not-found]
except Exception:  # Fallback for local dev outside Kodi
    class _KodiStub:
        LOGWARNING = 2

        class Player:
            def getPlayingFile(self):
                return ''

        def log(self, *args, **kwargs):
            pass

    xbmc = _KodiStub()

from lib import metadata as meta_extractor
from lib import api_client
from lib import kodi_sync
from lib.settings import is_enabled, send_repo_meta, log


class MediaLinkPlayer(xbmc.Player):
    """
    Subclass of xbmc.Player.

    Kodi calls the on* methods synchronously from its event thread.
    We do the minimum work here — spawn a thread for everything else.
    """

    def __init__(self, session_id: str):
        super().__init__()
        self._session_id    = session_id
        self._current_url   = ''
        self._capture_timer = None  # delayed-capture timer handle

    # ------------------------------------------------------------------
    # Playback started
    # ------------------------------------------------------------------

    def onPlayBackStarted(self) -> None:
        """
        Fired the moment Kodi begins loading a stream.
        At this exact instant InfoLabels may not yet be populated —
        we wait 2 seconds then read them (Kodi convention).
        """
        if not is_enabled():
            return

        # Capture the raw URL immediately (it's available right away)
        try:
            url = self.getPlayingFile() or ''
        except Exception:
            url = ''

        self._current_url = url
        log(f'onPlayBackStarted: {url[:100]}')

        # Cancel any pending capture from a previous rapid-switch
        self._cancel_pending_capture()

        # Delay slightly so Kodi finishes populating all InfoLabels
        self._capture_timer = threading.Timer(2.0, self._do_capture)
        self._capture_timer.daemon = True
        self._capture_timer.start()

    # ------------------------------------------------------------------
    # Playback AV started (Kodi 18+)
    # ------------------------------------------------------------------

    def onAVStarted(self) -> None:
        """
        Fired when audio/video data actually starts rendering (Kodi 18+).
        At this point ALL InfoLabels (codec, resolution, channel, headers) are live.

        This is the primary hook for /api/kodi-sync/receive — it fires after
        inputstream has resolved headers and the Referer/Origin values are populated.
        Also re-sends /api/extension/capture if the CDN URL differs from the initial URL.
        """
        if not is_enabled():
            return

        try:
            url = self.getPlayingFile() or ''
        except Exception:
            return

        # Always transmit to the Harvester via kodi-sync — full headers are live now
        session_id = self._session_id
        t = threading.Thread(
            target=kodi_sync.transmit,
            args=(self, session_id),
            daemon=True,
        )
        t.start()

        # Also re-send extension capture if CDN URL changed (existing behaviour)
        if url and url != self._current_url:
            log(f'onAVStarted URL differs from initial — re-capturing: {url[:100]}')
            self._current_url = url
            self._cancel_pending_capture()
            self._capture_timer = threading.Timer(0.5, self._do_capture)
            self._capture_timer.daemon = True
            self._capture_timer.start()

    # ------------------------------------------------------------------
    # Playback ended / stopped
    # ------------------------------------------------------------------

    def onPlayBackStopped(self) -> None:
        self._cancel_pending_capture()
        log('onPlayBackStopped')

    def onPlayBackEnded(self) -> None:
        self._cancel_pending_capture()
        log('onPlayBackEnded')

    def onPlayBackError(self) -> None:
        self._cancel_pending_capture()
        log('onPlayBackError', level=xbmc.LOGWARNING)

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _cancel_pending_capture(self) -> None:
        if self._capture_timer and self._capture_timer.is_alive():
            self._capture_timer.cancel()
        self._capture_timer = None

    def _do_capture(self) -> None:
        """
        Called 2 seconds after playback starts from a background thread.
        Extracts full metadata and ships it to the API.
        """
        try:
            if not self.isPlaying():
                log('_do_capture: no longer playing — skipping')
                return

            payload = meta_extractor.extract(self)

            if not send_repo_meta():
                # Strip addon/repository layers if the user opted out
                payload.pop('addon', None)
                payload.pop('repository', None)

            log(f'Metadata extracted — content type: {payload.get("content", {}).get("type")} '
                f'| addon: {payload.get("addon", {}).get("id", "none")} '
                f'| repo candidates: {len(payload.get("repository", {}).get("candidates", []))}')

            api_client.capture(self._session_id, payload)

        except Exception as exc:
            log(f'_do_capture error: {exc}', level=xbmc.LOGWARNING)
