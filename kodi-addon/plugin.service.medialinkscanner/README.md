# plugin.service.medialinkscanner

> **The Bridge** — Kodi service addon for [Media Link Scanner](../../README.md)

Monitors Kodi playback events and forwards full stream metadata to the Media Link Scanner backend, triggering automatic source repository detection and domain crawling.

---

## How It Works

```
Kodi starts playing media
        │
        ▼
MediaLinkPlayer.onPlayBackStarted()
        │  (2s delay for InfoLabels to populate)
        ▼
metadata.py  ──── Layer 1: stream URL (getPlayingFile)
                  Layer 2: InfoLabels (title, IMDB, channel, codecs)
                  Layer 3: inputstream headers (Referer, User-Agent)
                  Layer 4: xbmcaddon introspection (addon id, author, sourceUrl)
                  Layer 5: addon.xml on-disk parse (website, forum, dependencies)
        │
        ▼
api_client.capture()  ──── POST /api/extension/capture  (background thread)
        │
        ▼
Backend auto-starts domain crawl → generates M3U playlist → available in UI
```

---

## Installation

### Method 1 — Install from ZIP (recommended)

1. Zip the `plugin.service.medialinkscanner/` folder
2. In Kodi: **Add-ons → Install from ZIP file**
3. Select the ZIP

### Method 2 — Manual install

Copy `plugin.service.medialinkscanner/` to your Kodi addons directory:

| Platform | Path |
|---|---|
| Linux | `~/.kodi/addons/` |
| Windows | `%APPDATA%\Kodi\addons\` |
| macOS | `~/Library/Application Support/Kodi/addons/` |
| Android | `/sdcard/Android/data/org.xbmc.kodi/files/.kodi/addons/` |

Then restart Kodi and enable the addon under **Add-ons → My add-ons → Services**.

---

## Configuration

Open **Add-on Settings** for the service:

| Setting | Default | Description |
|---|---|---|
| Enable | `true` | Master on/off switch |
| Backend URL | `http://localhost:3001` | Media Link Scanner backend |
| API Key | *(empty)* | Optional — only needed if `AUTH_ENABLED=true` on backend |
| Heartbeat Interval | `30s` | Keep-alive frequency |
| Send Addon & Repo Metadata | `true` | Include addon/repo data in payloads |
| Debug Logging | `false` | Verbose Kodi log output |
| Session ID | *(auto)* | Stable UUID, generated once |

---

## Payload Sent to Backend

Every playback event sends to `POST /api/extension/capture`:

```json
{
  "sessionId": "kodi-<uuid>",
  "url": "<stream URL>",
  "title": "<media title>",
  "metadata": {
    "source": "kodi",
    "stream":     { "playingFile", "streamType", "protocol", "extension" },
    "content":    { "type", "title", "channelName", "imdbId", "season", "episode" },
    "headers":    { "userAgent", "referer", "origin", "customHeaders" },
    "addon":      { "id", "name", "version", "author", "sourceUrl", "websiteUrl" },
    "repository": { "candidates": [...], "primaryUrl", "referrerUrl" },
    "container":  { "pluginName", "folderPath" }
  }
}
```

### Repository Detection Priority

| Tier | Source | Confidence |
|---|---|---|
| 1 | `addon.xml <source>` tag | **High** — direct GitHub URL |
| 1 | Addon website URL | **High** — direct crawl target |
| 2 | `Referer` header | **High** — the web page the stream came from |
| 3 | `Origin` header | **Medium** |
| 4 | Stream URL (existing backend logic) | **Low** |

---

## File Structure

```
plugin.service.medialinkscanner/
├── addon.xml              Kodi manifest — declares xbmc.service
├── service.py             Daemon entry point, heartbeat loop
├── lib/
│   ├── __init__.py
│   ├── settings.py        Settings reader + session UUID manager
│   ├── api_client.py      Non-blocking HTTP client (register/heartbeat/capture)
│   ├── metadata.py        Five-layer metadata extractor
│   ├── player.py          xbmc.Player subclass — playback hooks
│   └── monitor.py         xbmc.Monitor subclass — notification + settings hooks
└── resources/
    ├── settings.xml        Kodi settings UI definition
    └── language/English/
        └── strings.po      Localization strings
```

---

## Requirements

- Kodi 19 "Matrix" or later (Python 3)
- Media Link Scanner backend running and accessible
- No external Python dependencies — uses only Kodi built-ins + stdlib `urllib`
