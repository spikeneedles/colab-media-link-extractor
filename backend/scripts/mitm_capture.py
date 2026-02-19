from mitmproxy import http

MEDIA_HINTS = [
    "m3u", "m3u8", "mpd", "ism", "isml", "f4m", "ts", "mp4", "mkv", "webm", "mov", "avi",
    "mp3", "aac", "flac", "wav", "ogg", "opus", "m4a", "ac3", "dts",
    "jpg", "jpeg", "png", "gif", "webp", "bmp", "tiff", "svg",
    "srt", "vtt", "ass", "ssa", "sub", "idx"
]


def response(flow: http.HTTPFlow) -> None:
    url = flow.request.pretty_url
    lower = url.lower()
    if any(ext in lower for ext in MEDIA_HINTS) or any(key in lower for key in ["playlist", "stream", "live", "video", "media", "cdn", "hls", "dash", "manifest"]):
        print(url, flush=True)
