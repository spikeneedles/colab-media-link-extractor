#!/usr/bin/env python3
"""
mock_kodi_test.py — Kodi Payload Extractor: Mock Injector

Simulates a live Kodi environment using unittest.mock, then fires real
HTTP payloads to the local backend at /api/kodi-sync/receive.

Three test scenarios:
  A — Tier 1: addon.xml carries a direct GitHub source URL
  B — Tier 2: stream with Referer + Origin headers (no addon source)
  C — Tier 3: generic plugin:// URL, addon ID only, no headers

Usage:
  python mock_kodi_test.py
  python mock_kodi_test.py --url http://localhost:3001
  python mock_kodi_test.py --dry-run        (build payloads only, no HTTP)

Requirements: Python 3.8+, no third-party packages (uses urllib + unittest.mock)
"""

import argparse
import json
import sys
import os
import textwrap
import urllib.request
import urllib.error
from typing import Any
from unittest.mock import MagicMock, patch, mock_open

# ---------------------------------------------------------------------------
# 1.  Inject stub Kodi modules BEFORE any lib import
#     (xbmc, xbmcaddon, xbmcvfs are only available inside a running Kodi)
# ---------------------------------------------------------------------------

# ── xbmc stub ───────────────────────────────────────────────────────────────
xbmc_stub              = MagicMock()
xbmc_stub.LOGDEBUG     = 0
xbmc_stub.LOGINFO      = 1
xbmc_stub.LOGWARNING   = 2
xbmc_stub.LOGERROR     = 3
xbmc_stub.LOGFATAL     = 4

def _stub_log(msg: str, level: int = 0) -> None:
    prefix = {0: 'DEBUG', 1: 'INFO', 2: 'WARN', 3: 'ERROR', 4: 'FATAL'}.get(level, 'LOG')
    print(f'  [KODI/{prefix}] {msg}')

xbmc_stub.log = _stub_log
# getInfoLabel — overridden per-scenario below
xbmc_stub.getInfoLabel = MagicMock(return_value='')

# ── xbmcaddon stub ──────────────────────────────────────────────────────────
xbmcaddon_stub = MagicMock()

# ── xbmcvfs stub ────────────────────────────────────────────────────────────
xbmcvfs_stub        = MagicMock()
xbmcvfs_stub.exists = MagicMock(return_value=False)   # overridden per-scenario
xbmcvfs_stub.File   = MagicMock()

# Register stubs before importing anything from lib/
sys.modules['xbmc']       = xbmc_stub
sys.modules['xbmcaddon']  = xbmcaddon_stub
sys.modules['xbmcvfs']    = xbmcvfs_stub

# ---------------------------------------------------------------------------
# 2.  Now we can safely add lib/ to sys.path and import our real code
# ---------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

import lib.kodi_sync as kodi_sync          # noqa: E402 (import after stub setup)
import lib.settings   as settings_mod       # noqa: E402


# ---------------------------------------------------------------------------
# 3.  Scenario definitions
# ---------------------------------------------------------------------------

SCENARIOS: list[dict[str, Any]] = [

    # ── Scenario A — Tier 1: GitHub source URL in addon.xml ─────────────
    {
        'id':    'A',
        'label': 'Tier 1 — addon.xml GitHub source URL',
        'playing_file':  'plugin://plugin.video.seren/play/movie/tt1234567',
        'info_labels': {
            'Player.Filenameandpath':   'plugin://plugin.video.seren/play/movie/tt1234567',
            'Container.PluginName':     'plugin.video.seren',
            'Container.FolderPath':     'plugin://plugin.video.seren/',
            'Player.Title':             'Interstellar',
            'VideoPlayer.OriginalTitle':'Interstellar',
            'VideoPlayer.Year':         '2014',
            'VideoPlayer.IMDBNumber':   'tt0816692',
            'ListItem.MediaType':       'movie',
            'VideoPlayer.ChannelName':  '',
            # No inputstream headers — Tier 2 signals absent
            'ListItem.Property(inputstream.adaptive.stream_headers)': '',
        },
        'addon_info': {
            'id':          'plugin.video.seren',
            'name':        'Seren',
            'version':     '2.0.3',
            'author':       'Nixgates',
            # source → direct GitHub URL (Tier 1 signal)
            'source':      'https://github.com/nixgates/plugin.video.seren',
            'path':        '/fake/addons/plugin.video.seren',
        },
        # addon.xml returns a website field too
        'addon_xml': textwrap.dedent("""\
            <?xml version="1.0" encoding="UTF-8"?>
            <addon id="plugin.video.seren" version="2.0.3" name="Seren" provider-name="Nixgates">
              <source>https://github.com/nixgates/plugin.video.seren</source>
              <website>https://nixgates.github.io/packages</website>
            </addon>
        """),
        'expected_tier': 1,
    },

    # ── Scenario B — Tier 2: Referer header, no addon source ────────────
    {
        'id':    'B',
        'label': 'Tier 2 — Referer + Origin headers (no addon source URL)',
        'playing_file':  'https://cdn.example.tv/hls/live/channel1/index.m3u8',
        'info_labels': {
            'Player.Filenameandpath':   'https://cdn.example.tv/hls/live/channel1/index.m3u8',
            'Container.PluginName':     'plugin.video.iptv.simple',
            'Container.FolderPath':     'plugin://plugin.video.iptv.simple/',
            'Player.Title':             'Sky Sports 1',
            'VideoPlayer.ChannelName':  'Sky Sports 1',
            'VideoPlayer.ChannelNumber':'101',
            'ListItem.MediaType':       '',
            # Tier 2 signals present in inputstream headers
            'ListItem.Property(inputstream.adaptive.stream_headers)':
                'User-Agent=Mozilla%2F5.0+(compatible)&Referer=https://stream.skysports.com/live&Origin=https://stream.skysports.com',
        },
        'addon_info': {
            'id':      'plugin.video.iptv.simple',
            'name':    'IPTV Simple Client',
            'version': '21.1.0',
            'author':  'kodi',
            'source':  '',   # blank — no Tier 1 signal
            'path':    '/fake/addons/plugin.video.iptv.simple',
        },
        'addon_xml': textwrap.dedent("""\
            <?xml version="1.0" encoding="UTF-8"?>
            <addon id="plugin.video.iptv.simple" version="21.1.0">
              <!-- no <source> or <website> tags -->
            </addon>
        """),
        'expected_tier': 2,
    },

    # ── Scenario C — Tier 3: plugin:// URL only, no headers, no source ──
    {
        'id':    'C',
        'label': 'Tier 3 — generic plugin:// URL, addon ID only',
        'playing_file':  'plugin://plugin.video.unknown.addon/play/stream/42',
        'info_labels': {
            'Player.Filenameandpath':   'plugin://plugin.video.unknown.addon/play/stream/42',
            'Container.PluginName':     'plugin.video.unknown.addon',
            'Container.FolderPath':     'plugin://plugin.video.unknown.addon/',
            'Player.Title':             '',
            'VideoPlayer.ChannelName':  '',
            'ListItem.MediaType':       'episode',
            # No inputstream headers
            'ListItem.Property(inputstream.adaptive.stream_headers)': '',
        },
        'addon_info': {
            'id':      'plugin.video.unknown.addon',
            'name':    'Unknown Addon',
            'version': '1.0.0',
            'author':  'unknown',
            'source':  '',   # no Tier 1
            'path':    '/fake/addons/plugin.video.unknown.addon',
        },
        'addon_xml': '',   # empty — no file on disk
        'expected_tier': 3,
    },
]


# ---------------------------------------------------------------------------
# 4.  Mock builder — configures stubs for a single scenario
# ---------------------------------------------------------------------------

def _configure_stubs(scenario: dict[str, Any]) -> None:
    """Point all Kodi stubs at the values defined in the scenario."""

    info_labels = scenario['info_labels']
    addon_info  = scenario['addon_info']
    addon_xml   = scenario['addon_xml']

    # ── xbmc.getInfoLabel ───────────────────────────────────────────────────
    def _getInfoLabel(key: str) -> str:
        return info_labels.get(key, '')

    xbmc_stub.getInfoLabel = MagicMock(side_effect=_getInfoLabel)

    # ── xbmcaddon.Addon() ───────────────────────────────────────────────────
    addon_mock = MagicMock()

    def _getAddonInfo(field: str) -> str:
        return addon_info.get(field, '')

    addon_mock.getAddonInfo = MagicMock(side_effect=_getAddonInfo)
    xbmcaddon_stub.Addon   = MagicMock(return_value=addon_mock)

    # ── xbmcvfs — addon.xml on-disk read ────────────────────────────────────
    if addon_xml:
        xbmcvfs_stub.exists = MagicMock(return_value=True)

        file_mock = MagicMock()
        file_mock.__enter__ = MagicMock(return_value=file_mock)
        file_mock.__exit__  = MagicMock(return_value=False)
        file_mock.read      = MagicMock(return_value=addon_xml.encode('utf-8'))
        xbmcvfs_stub.File   = MagicMock(return_value=file_mock)
    else:
        xbmcvfs_stub.exists = MagicMock(return_value=False)
        xbmcvfs_stub.File   = MagicMock()

    # ── settings module — return sensible defaults without real Kodi ────────
    settings_mod.get_api_url    = lambda: _API_URL
    settings_mod.get_api_key    = lambda: ''
    settings_mod.is_debug       = lambda: True   # show all log lines during tests
    settings_mod.is_enabled     = lambda: True

    # Reload kodi_sync so it picks up the freshly-patched stubs
    import importlib
    importlib.reload(kodi_sync)


# ---------------------------------------------------------------------------
# 5.  Mock xbmc.Player
# ---------------------------------------------------------------------------

class MockPlayer:
    """Minimal stand-in for xbmc.Player with a fixed playing file."""

    def __init__(self, playing_file: str):
        self._playing_file = playing_file

    def getPlayingFile(self) -> str:
        return self._playing_file

    def isPlaying(self) -> bool:
        return True


# ---------------------------------------------------------------------------
# 6.  HTTP transmission
# ---------------------------------------------------------------------------

def _post_payload(api_url: str, payload: dict) -> tuple[int, dict]:
    """
    POST payload to /api/kodi-sync/receive.
    Returns (http_status_code, response_body_dict).
    """
    endpoint = api_url.rstrip('/') + '/api/kodi-sync/receive'
    data     = json.dumps(payload).encode('utf-8')
    req      = urllib.request.Request(
        endpoint,
        data    = data,
        headers = {'Content-Type': 'application/json'},
        method  = 'POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read().decode('utf-8', errors='replace')
            return resp.status, json.loads(body)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode('utf-8', errors='replace')
        try:
            return exc.code, json.loads(body)
        except Exception:
            return exc.code, {'raw': body}
    except urllib.error.URLError as exc:
        return 0, {'error': str(exc.reason), 'detail': 'Backend unreachable'}
    except Exception as exc:
        return 0, {'error': str(exc)}


# ---------------------------------------------------------------------------
# 7.  Test runner
# ---------------------------------------------------------------------------

_API_URL = 'http://localhost:3002'

def _run_scenario(scenario: dict[str, Any], dry_run: bool) -> dict[str, Any]:
    sid = scenario['id']
    print(f'\n{"═"*60}')
    print(f'  Scenario {sid}: {scenario["label"]}')
    print(f'{"═"*60}')

    _configure_stubs(scenario)

    player  = MockPlayer(scenario['playing_file'])
    payload = kodi_sync.build_payload(player, session_id=f'kodi-mock-test-{sid}')

    # ── Display extracted payload ────────────────────────────────────────────
    tiers = payload.get('metadata', {}).get('confidence_tiers', {})
    print(f'\n  source_url   : {payload.get("source_url")}')
    print(f'  media_type   : {payload.get("media_type")}')
    print(f'  kodi_source  : {payload.get("kodi_source")}')
    print(f'  title        : {payload.get("metadata", {}).get("title")}')
    print()
    print(f'  Tier 1 — addon_source_url : {tiers.get("tier1", {}).get("addon_source_url")}')
    print(f'  Tier 1 — addon_website    : {tiers.get("tier1", {}).get("addon_website")}')
    print(f'  Tier 2 — referer          : {tiers.get("tier2", {}).get("referer")}')
    print(f'  Tier 2 — origin           : {tiers.get("tier2", {}).get("origin")}')
    print(f'  Tier 3 — filename_and_path: {tiers.get("tier3", {}).get("filename_and_path")}')

    # ── Validate source_url came from the expected tier ──────────────────────
    expected_tier   = scenario['expected_tier']
    t1_source       = tiers.get('tier1', {}).get('addon_source_url')
    t2_referer      = tiers.get('tier2', {}).get('referer')
    t3_path         = tiers.get('tier3', {}).get('filename_and_path')

    actual_source   = payload.get('source_url')
    if expected_tier == 1:
        tier_ok = actual_source == t1_source
    elif expected_tier == 2:
        tier_ok = actual_source in (t2_referer, tiers.get('tier2', {}).get('origin'))
    else:
        tier_ok = actual_source in (t3_path, scenario['playing_file'])

    tier_status = '✓ PASS' if tier_ok else '✗ FAIL'
    print(f'\n  [Tier check] Expected Tier {expected_tier} source → {tier_status}')

    # ── HTTP transmission ────────────────────────────────────────────────────
    if dry_run:
        print(f'\n  [HTTP] --dry-run: skipping POST to {_API_URL}')
        return {'scenario': sid, 'tier_check': tier_ok, 'http_status': None, 'response': None}

    print(f'\n  [HTTP] POST → {_API_URL}/api/kodi-sync/receive')
    status, response = _post_payload(_API_URL, payload)

    status_emoji = '✓' if 200 <= status < 300 else ('⚠' if status else '✗')
    print(f'  [HTTP] {status_emoji} Status: {status}')

    if status == 0:
        print(f'  [HTTP] Error : {response.get("error")} — {response.get("detail", "")}')
    else:
        print(f'  [HTTP] job_id: {response.get("job_id")}')
        repo = response.get('repository_detection', {})
        print(f'  [HTTP] repo  : type={repo.get("detected_type")}  '
              f'confidence={repo.get("confidence")}')
        if response.get('tracking'):
            print(f'  [HTTP] track : {response["tracking"].get("status_endpoint")}')

    return {'scenario': sid, 'tier_check': tier_ok, 'http_status': status, 'response': response}


# ---------------------------------------------------------------------------
# 8.  Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description='Mock Kodi Payload Extractor test injector'
    )
    parser.add_argument(
        '--url',
        default='http://localhost:3002',
        metavar='URL',
        help='Backend base URL (default: http://localhost:3002)',
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Build payloads and validate tiers but do not POST to backend',
    )
    parser.add_argument(
        '--scenario',
        choices=['A', 'B', 'C'],
        default=None,
        metavar='A|B|C',
        help='Run a single scenario (default: run all three)',
    )
    args = parser.parse_args()

    global _API_URL
    _API_URL = args.url

    print(f'\n{"█"*60}')
    print('  Kodi Payload Extractor — Mock Injector')
    print(f'  Backend : {_API_URL}')
    print(f'  Mode    : {"DRY RUN" if args.dry_run else "LIVE"}')
    print(f'{"█"*60}')

    scenarios = [s for s in SCENARIOS if args.scenario is None or s['id'] == args.scenario]
    results   = [_run_scenario(s, dry_run=args.dry_run) for s in scenarios]

    # ── Summary ──────────────────────────────────────────────────────────────
    print(f'\n{"─"*60}')
    print('  SUMMARY')
    print(f'{"─"*60}')
    all_pass = True
    for r in results:
        tier_sym = '✓' if r['tier_check'] else '✗'
        if r['http_status'] is None:
            http_sym = '─'
            http_txt = 'skipped'
        elif r['http_status'] == 0:
            http_sym = '✗'
            http_txt = 'unreachable'
        elif 200 <= r['http_status'] < 300:
            http_sym = '✓'
            http_txt = str(r['http_status'])
        else:
            http_sym = '⚠'
            http_txt = str(r['http_status'])
        all_pass = all_pass and r['tier_check']
        print(f'  Scenario {r["scenario"]}:  tier={tier_sym}  http={http_sym} {http_txt}')

    print(f'{"─"*60}')
    print(f'  Result: {"ALL TIER CHECKS PASSED ✓" if all_pass else "SOME TIER CHECKS FAILED ✗"}')
    print()

    sys.exit(0 if all_pass else 1)


if __name__ == '__main__':
    main()
