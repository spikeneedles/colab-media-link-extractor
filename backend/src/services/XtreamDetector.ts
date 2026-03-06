import axios from 'axios';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface XtreamDetectResult {
  isXtream: boolean;
  panelUrl?: string;
  version?: string;
  serverInfo?: Record<string, unknown>;
}

export interface XtreamContent {
  liveCategories: XtreamCategory[];
  vodCategories: XtreamCategory[];
  seriesCategories: XtreamCategory[];
  liveStreams: XtreamStream[];
  vodStreams: XtreamStream[];
  series: XtreamSeries[];
}

export interface XtreamCategory {
  category_id: string;
  category_name: string;
  parent_id?: number;
}

export interface XtreamStream {
  stream_id: number;
  name: string;
  stream_url?: string;
  category_id?: string;
  stream_icon?: string;
  epg_channel_id?: string;
  [key: string]: unknown;
}

export interface XtreamSeries {
  series_id: number;
  name: string;
  category_id?: string;
  cover?: string;
  [key: string]: unknown;
}

export interface StalkerDetectResult {
  isStalker: boolean;
  portalUrl?: string;
  token?: string;
}

export interface StalkerContent {
  channels: unknown[];
  vod: unknown[];
  series: unknown[];
}

// ---------------------------------------------------------------------------
// Content-type → stream type map
// ---------------------------------------------------------------------------

const CONTENT_TYPE_MAP: Record<string, string> = {
  'application/x-mpegurl': 'HLS',
  'application/vnd.apple.mpegurl': 'HLS',
  'application/dash+xml': 'DASH',
  'video/mp2t': 'TS',
  'application/octet-stream': 'TS',
  'video/mp4': 'MP4',
};

// ---------------------------------------------------------------------------
// Extended protocol regex
// ---------------------------------------------------------------------------

export const STREAM_PROTOCOL_REGEX =
  /(rtmp[es]?|rtsp|mms|mmst|rtspt|rtspu|srt):\/\/[^\s"'<>]+/gi;

// ---------------------------------------------------------------------------
// XtreamDetector
// ---------------------------------------------------------------------------

export class XtreamDetector {
  private readonly timeout = 8_000;
  private readonly headers = { 'User-Agent': 'XtreamDetector/1.0' };

  // -------------------------------------------------------------------------
  // Xtream Codes detection
  // -------------------------------------------------------------------------

  async detectXtream(url: string): Promise<XtreamDetectResult> {
    const base = this._normalizeBase(url);
    const probeUrl = `${base}/player_api.php?username=test&password=test`;

    try {
      const res = await axios.get<Record<string, unknown>>(probeUrl, {
        timeout: this.timeout,
        headers: this.headers,
        validateStatus: () => true,
      });

      if (res.status === 200 && res.data && typeof res.data === 'object') {
        const data = res.data as Record<string, unknown>;
        if ('user_info' in data || 'server_info' in data) {
          const serverInfo = (data['server_info'] as Record<string, unknown>) ?? {};
          return {
            isXtream: true,
            panelUrl: base,
            version: serverInfo['version'] as string | undefined,
            serverInfo,
          };
        }
      }
    } catch {
      // fall through
    }

    // Secondary probe: check /get.php for EXTM3U
    try {
      const getUrl = `${base}/get.php?username=test&password=test&type=m3u_plus&output=ts`;
      const res = await axios.get<string>(getUrl, {
        responseType: 'text',
        timeout: this.timeout,
        headers: this.headers,
        validateStatus: () => true,
      });
      if (res.status === 200 && typeof res.data === 'string' && res.data.includes('#EXTM3U')) {
        return { isXtream: true, panelUrl: base };
      }
    } catch {
      // ignore
    }

    return { isXtream: false };
  }

  async enumerateXtream(
    panelUrl: string,
    username: string,
    password: string
  ): Promise<XtreamContent> {
    const base = this._normalizeBase(panelUrl);
    const auth = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    const api = (action: string, extra = '') =>
      `${base}/player_api.php?${auth}&action=${action}${extra}`;

    const [liveCategories, vodCategories, seriesCategories, liveStreams, vodStreams, series] =
      await Promise.all([
        this._fetchJson<XtreamCategory[]>(api('get_live_categories')),
        this._fetchJson<XtreamCategory[]>(api('get_vod_categories')),
        this._fetchJson<XtreamCategory[]>(api('get_series_categories')),
        this._fetchJson<XtreamStream[]>(api('get_live_streams')),
        this._fetchJson<XtreamStream[]>(api('get_vod_streams')),
        this._fetchJson<XtreamSeries[]>(api('get_series')),
      ]);

    return {
      liveCategories: liveCategories ?? [],
      vodCategories: vodCategories ?? [],
      seriesCategories: seriesCategories ?? [],
      liveStreams: liveStreams ?? [],
      vodStreams: vodStreams ?? [],
      series: series ?? [],
    };
  }

  async getLiveStreamsByCategory(
    panelUrl: string,
    username: string,
    password: string,
    categoryId: string
  ): Promise<XtreamStream[]> {
    const base = this._normalizeBase(panelUrl);
    const auth = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    const url = `${base}/player_api.php?${auth}&action=get_live_streams&category_id=${categoryId}`;
    return (await this._fetchJson<XtreamStream[]>(url)) ?? [];
  }

  // -------------------------------------------------------------------------
  // Stalker / Ministra portal detection
  // -------------------------------------------------------------------------

  async detectStalker(url: string): Promise<StalkerDetectResult> {
    const base = this._normalizeBase(url);
    const paths = ['/server/load.php', '/stalker_portal/server/load.php'];

    for (const path of paths) {
      const portalUrl = `${base}${path}`;
      const result = await this._probeStalkerEndpoint(portalUrl);
      if (result.isStalker) return { ...result, portalUrl };
    }

    return { isStalker: false };
  }

  private async _probeStalkerEndpoint(
    endpointUrl: string
  ): Promise<{ isStalker: boolean; token?: string }> {
    try {
      const res = await axios.post<Record<string, unknown>>(
        endpointUrl,
        'action=handshake&type=stb&token=',
        {
          timeout: this.timeout,
          headers: {
            ...this.headers,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          validateStatus: () => true,
        }
      );

      if (res.status === 200 && res.data && typeof res.data === 'object') {
        const js = res.data['js'] as Record<string, unknown> | undefined;
        if (js && 'token' in js) {
          return { isStalker: true, token: js['token'] as string };
        }
      }
    } catch {
      // ignore
    }
    return { isStalker: false };
  }

  async probeStalker(url: string): Promise<StalkerContent> {
    const detect = await this.detectStalker(url);
    if (!detect.isStalker || !detect.portalUrl || !detect.token) {
      return { channels: [], vod: [], series: [] };
    }

    const { portalUrl, token } = detect;
    const authHeaders = {
      ...this.headers,
      Authorization: `Bearer ${token}`,
      Cookie: `mac=00:1A:79:00:00:01; stb_lang=en; timezone=UTC`,
    };

    const makeUrl = (action: string) =>
      `${portalUrl}?action=${action}&JsHttpRequest=1-xml`;

    const [channels, vod, series] = await Promise.all([
      this._fetchJson<unknown[]>(makeUrl('get_all_channels'), authHeaders),
      this._fetchJson<unknown[]>(makeUrl('get_ordered_list&type=vod'), authHeaders),
      this._fetchJson<unknown[]>(makeUrl('get_ordered_list&type=series'), authHeaders),
    ]);

    return {
      channels: channels ?? [],
      vod: vod ?? [],
      series: series ?? [],
    };
  }

  // -------------------------------------------------------------------------
  // Content-type analysis
  // -------------------------------------------------------------------------

  mapContentType(contentType: string): string {
    const lower = contentType.toLowerCase().split(';')[0].trim();
    return CONTENT_TYPE_MAP[lower] ?? 'UNKNOWN';
  }

  async probeContentType(url: string): Promise<string> {
    try {
      const res = await axios.head(url, {
        timeout: this.timeout,
        headers: this.headers,
        validateStatus: () => true,
      });
      const ct = (res.headers['content-type'] as string | undefined) ?? '';
      return this.mapContentType(ct);
    } catch {
      return 'UNKNOWN';
    }
  }

  // -------------------------------------------------------------------------
  // Obfuscated URL decoder
  // -------------------------------------------------------------------------

  decodeObfuscated(text: string): string[] {
    const found = new Set<string>();

    // URL-decode first pass
    const urlDecoded = this._safeDecodeURIComponent(text);
    if (this._looksLikeUrl(urlDecoded)) found.add(urlDecoded);

    // Base64
    const b64Pattern = /[A-Za-z0-9+/]{20,}={0,2}/g;
    for (const match of text.matchAll(b64Pattern)) {
      const decoded = this._tryBase64(match[0]);
      if (decoded) {
        for (const u of this._extractUrls(decoded)) found.add(u);
      }
    }

    // Hex encoding: 0x-prefixed or pure even-length hex run ≥ 20 chars
    const hexPattern = /(?:0x)?([0-9a-fA-F]{20,})/g;
    for (const match of text.matchAll(hexPattern)) {
      const decoded = this._tryHex(match[1]);
      if (decoded) {
        for (const u of this._extractUrls(decoded)) found.add(u);
      }
    }

    // JS atob() calls embedded in source
    const atobPattern = /(?:window\.)?atob\(\s*["']([^"']+)["']\s*\)/g;
    for (const match of text.matchAll(atobPattern)) {
      const decoded = this._tryBase64(match[1]);
      if (decoded) {
        for (const u of this._extractUrls(decoded)) found.add(u);
      }
    }

    // ROT13
    const rot13 = this._rot13(text);
    for (const u of this._extractUrls(rot13)) found.add(u);

    // XOR with common keys
    for (const key of [0x20, 0x55, 0x42, 0x13, 0x7f]) {
      const xored = this._xorDecode(text, key);
      for (const u of this._extractUrls(xored)) found.add(u);
    }

    // Direct URL extraction (already-clear URLs in the text)
    for (const u of this._extractUrls(text)) found.add(u);

    return [...found];
  }

  findObfuscatedURLs(pageSource: string): string[] {
    return this.decodeObfuscated(pageSource);
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private _normalizeBase(url: string): string {
    return url.replace(/\/+$/, '');
  }

  private async _fetchJson<T>(
    url: string,
    extraHeaders?: Record<string, string>
  ): Promise<T | null> {
    try {
      const res = await axios.get<T>(url, {
        timeout: this.timeout,
        headers: { ...this.headers, ...extraHeaders },
        validateStatus: () => true,
      });
      return res.status === 200 ? res.data : null;
    } catch {
      return null;
    }
  }

  private _looksLikeUrl(s: string): boolean {
    return /^https?:\/\//i.test(s.trim()) || STREAM_PROTOCOL_REGEX.test(s);
  }

  private _extractUrls(text: string): string[] {
    const urls: string[] = [];
    const httpRe = /https?:\/\/[^\s"'<>]+/gi;
    for (const m of text.matchAll(httpRe)) urls.push(m[0]);
    const streamRe = new RegExp(STREAM_PROTOCOL_REGEX.source, STREAM_PROTOCOL_REGEX.flags);
    for (const m of text.matchAll(streamRe)) urls.push(m[0]);
    return urls;
  }

  private _tryBase64(encoded: string): string | null {
    try {
      const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
      if (/[\x00-\x08\x0e-\x1f\x7f]/.test(decoded)) return null; // binary-looking
      return decoded;
    } catch {
      return null;
    }
  }

  private _tryHex(hex: string): string | null {
    try {
      if (hex.length % 2 !== 0) return null;
      return Buffer.from(hex, 'hex').toString('utf-8');
    } catch {
      return null;
    }
  }

  private _rot13(text: string): string {
    return text.replace(/[A-Za-z]/g, (c) => {
      const base = c <= 'Z' ? 65 : 97;
      return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
    });
  }

  private _xorDecode(text: string, key: number): string {
    return [...text].map((c) => String.fromCharCode(c.charCodeAt(0) ^ key)).join('');
  }

  private _safeDecodeURIComponent(s: string): string {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  }
}

// Singleton
export const xtreamDetector = new XtreamDetector();
