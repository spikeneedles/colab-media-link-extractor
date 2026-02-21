"""
service.py — Main daemon entry point for plugin.service.medialinkscanner

Lifecycle:
  1. Read settings, obtain stable session UUID
  2. Register session with the Media Link Scanner backend
  3. Instantiate MediaLinkPlayer + MediaLinkMonitor
  4. Run the heartbeat loop until Kodi signals abort
  5. Disconnect cleanly on exit

Kodi calls this file directly as the xbmc.service library.
"""

import sys
import time

try:
    import xbmc  # type: ignore[import-not-found]
except Exception:  # Fallback for local dev outside Kodi
    class _KodiStub:
        LOGINFO = 1
        LOGWARNING = 2

        def log(self, *args, **kwargs):
            pass

        def sleep(self, *args, **kwargs):
            pass

    xbmc = _KodiStub()

# Ensure lib/ is on the path (Kodi doesn't always add the addon dir automatically)
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'lib'))

from lib.settings import (
    get_session_id,
    get_heartbeat_interval,
    is_enabled,
    log,
    get_api_url,
)
from lib.api_client import register, send_heartbeat, disconnect, announce_session
from lib.player import MediaLinkPlayer
from lib.monitor import MediaLinkMonitor


def run():
    log('═══════════════════════════════════════════', level=xbmc.LOGINFO)
    log('  Media Link Scanner service starting', level=xbmc.LOGINFO)
    log(f'  Backend: {get_api_url()}', level=xbmc.LOGINFO)
    log('═══════════════════════════════════════════', level=xbmc.LOGINFO)

    session_id = get_session_id()
    log(f'Session ID: {session_id}', level=xbmc.LOGINFO)
    announce_session(session_id, kodi_source='Kodi Media Link Scanner')

    # ----------------------------------------------------------------
    # Register with backend
    # Retry up to 3 times — backend may still be booting
    # ----------------------------------------------------------------
    registered = False
    for attempt in range(1, 4):
        if register(session_id):
            registered = True
            break
        log(f'Registration attempt {attempt}/3 failed — retrying in 10s', level=xbmc.LOGWARNING)
        xbmc.sleep(10_000)

    if not registered:
        log(
            'Could not register with backend after 3 attempts. '
            'Heartbeats and captures will still be attempted.',
            level=xbmc.LOGWARNING,
        )

    # ----------------------------------------------------------------
    # Instantiate player + monitor
    # ----------------------------------------------------------------
    player  = MediaLinkPlayer(session_id=session_id)
    monitor = MediaLinkMonitor(player=player)

    log('Player and monitor active — watching for playback events', level=xbmc.LOGINFO)

    # ----------------------------------------------------------------
    # Heartbeat loop
    # Runs until Kodi calls abortRequested() (system shutdown/restart)
    # ----------------------------------------------------------------
    elapsed_since_heartbeat = 0
    SLEEP_TICK_MS           = 1_000  # 1 second resolution

    while not monitor.abortRequested():
        monitor.waitForAbort(1)  # sleep 1s; wakes immediately on abort
        elapsed_since_heartbeat += 1

        # Settings may have changed — interval is re-read on every cycle
        heartbeat_interval = get_heartbeat_interval()

        if elapsed_since_heartbeat >= heartbeat_interval:
            elapsed_since_heartbeat = 0
            if is_enabled():
                send_heartbeat(session_id)

        if monitor.consume_settings_changed():
            log(f'Settings reloaded — heartbeat interval now {heartbeat_interval}s')

    # ----------------------------------------------------------------
    # Kodi is shutting down — clean up
    # ----------------------------------------------------------------
    log('Abort requested — shutting down gracefully', level=xbmc.LOGINFO)
    disconnect(session_id)
    log('Media Link Scanner service stopped', level=xbmc.LOGINFO)


if __name__ == '__main__':
    run()
