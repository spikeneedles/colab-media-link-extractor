"""
monitor.py — xbmc.Monitor subclass

Handles Kodi system-level events:
  - onNotification:    backup hook for Player.OnPlay (catches edge cases
                       where Player subclass hooks may not fire, e.g. IPTV Simple)
  - onSettingsChanged: reload settings without restarting the service
  - abortRequested():  signals the main daemon loop to exit cleanly
"""

import json

try:
    import xbmc  # type: ignore[import-not-found]
except Exception:  # Fallback for local dev outside Kodi
    class _KodiStub:
        LOGWARNING = 2

        class Monitor:
            def waitForAbort(self, *args, **kwargs):
                return False

            def abortRequested(self):
                return False

        def log(self, *args, **kwargs):
            pass

    xbmc = _KodiStub()

from lib.settings import is_enabled, log


class MediaLinkMonitor(xbmc.Monitor):
    """
    Subclass of xbmc.Monitor.

    Acts as a safety net alongside MediaLinkPlayer:
    some Kodi addons (especially PVR/IPTV Simple Client) raise
    system notifications rather than triggering Player hooks cleanly.
    """

    def __init__(self, player):
        super().__init__()
        self._player = player
        self._settings_changed = False

    # ------------------------------------------------------------------
    # System notifications
    # ------------------------------------------------------------------

    def onNotification(self, sender: str, method: str, data: str) -> None:
        """
        Receives all Kodi JSON-RPC notifications.

        Relevant events:
          Player.OnPlay   — stream started (backup to onPlayBackStarted)
          Player.OnStop   — stream stopped
          Player.OnResume — stream resumed
        """
        if not is_enabled():
            return

        log(f'onNotification: sender={sender} method={method}')

        if method == 'Player.OnPlay':
            # Parse the notification data to get player ID and item info
            try:
                notification_data = json.loads(data) if data else {}
                player_id = notification_data.get('player', {}).get('playerid', -1)
                item      = notification_data.get('item', {})
                item_type = item.get('type', '')

                log(f'Player.OnPlay — player_id={player_id} item_type={item_type}')

                # Only handle video/audio (not pictures)
                if player_id in (1, 2):  # 1=video, 2=audio
                    # The Player subclass should handle this, but if it already
                    # captured, this is a no-op (same URL). If the Player hook
                    # was missed (IPTV edge case), this triggers a fresh capture.
                    if hasattr(self._player, 'onPlayBackStarted'):
                        self._player.onPlayBackStarted()

            except Exception as exc:
                log(f'onNotification parse error: {exc}', level=xbmc.LOGWARNING)

        elif method == 'Player.OnStop':
            log('Player.OnStop notification received')

        elif method == 'Player.OnResume':
            log('Player.OnResume notification received')

    # ------------------------------------------------------------------
    # Settings changed
    # ------------------------------------------------------------------

    def onSettingsChanged(self) -> None:
        """
        Called when the user changes addon settings.
        Sets a flag so the daemon loop can act (e.g., update heartbeat interval).
        Settings are read lazily via settings.py — no manual reload needed.
        """
        self._settings_changed = True
        log('Settings changed — will take effect on next operation')

    def consume_settings_changed(self) -> bool:
        """Poll-and-reset the settings-changed flag."""
        changed = self._settings_changed
        self._settings_changed = False
        return changed
