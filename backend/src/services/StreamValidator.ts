import axios, { AxiosRequestConfig } from 'axios';
import { EventEmitter } from 'events';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface HLSVariant {
  url: string;
  bandwidth: number;
  resolution?: string;
  codecs?: string;
  frameRate?: number;
  isAudio: boolean;
}

export interface DASHRepresentation {
  url: string;
  bandwidth: number;
  codecs: string;
  width?: number;
  height?: number;
  mimeType: string;
}

export interface StreamHealthResult {
  url: string;
  alive: boolean;
  contentType?: string;
  statusCode: number;
  responseMs: number;
  error?: string;
}

export type QualityTier = 'UHD' | 'FHD' | 'HD' | 'SD' | 'UNKNOWN';

export interface QualityInfo {
  resolution?: string;
  codec?: string;
  bandwidth?: number;
  qualityTier: QualityTier;
}

// ---------------------------------------------------------------------------
// Dead-URL LRU cache
// ---------------------------------------------------------------------------

interface DeadEntry {
  reason: string;
  timestamp: number;
}

class LRUCache<V> {
  private map = new Map<string, V>();
  constructor(private readonly maxSize: number) {}

  set(key: string, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= this.maxSize) {
      // evict oldest (first inserted)
      this.map.delete(this.map.keys().next().value as string);
    }
    this.map.set(key, value);
  }

  get(key: string): V | undefined {
    return this.map.get(key);
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  delete(key: string): void {
    this.map.delete(key);
  }
}

// ---------------------------------------------------------------------------
// StreamValidator
// ---------------------------------------------------------------------------

export class StreamValidator extends EventEmitter {
  private readonly deadUrls = new LRUCache<DeadEntry>(10_000);
  private prunerTimer: ReturnType<typeof setInterval> | null = null;

  // -------------------------------------------------------------------------
  // HLS manifest chasing
  // -------------------------------------------------------------------------

  async parseHLSManifest(url: string): Promise<HLSVariant[]> {
    try {
      const response = await axios.get<string>(url, {
        responseType: 'text',
        timeout: 10_000,
        maxRedirects: 10,
        headers: { 'User-Agent': 'StreamValidator/1.0' },
      });

      const finalUrl = (response.request?.res?.responseUrl as string | undefined) ?? url;
      const text: string = response.data;
      return this._parseHLSText(text, finalUrl);
    } catch {
      return [];
    }
  }

  private _parseHLSText(text: string, baseUrl: string): HLSVariant[] {
    const variants: HLSVariant[] = [];
    const lines = text.split('\n').map((l) => l.trim());

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Audio / subtitle tracks from #EXT-X-MEDIA
      if (line.startsWith('#EXT-X-MEDIA:')) {
        const attrs = this._parseAttributes(line.substring('#EXT-X-MEDIA:'.length));
        const uri = attrs['URI'];
        if (uri) {
          variants.push({
            url: this._resolveUrl(uri, baseUrl),
            bandwidth: 0,
            isAudio: true,
            codecs: attrs['CODECS'],
          });
        }
        continue;
      }

      // Video variants from #EXT-X-STREAM-INF
      if (line.startsWith('#EXT-X-STREAM-INF:')) {
        const attrs = this._parseAttributes(line.substring('#EXT-X-STREAM-INF:'.length));
        const nextLine = lines[i + 1];
        if (nextLine && !nextLine.startsWith('#')) {
          variants.push({
            url: this._resolveUrl(nextLine, baseUrl),
            bandwidth: parseInt(attrs['BANDWIDTH'] ?? '0', 10),
            resolution: attrs['RESOLUTION'],
            codecs: attrs['CODECS'],
            frameRate: attrs['FRAME-RATE'] ? parseFloat(attrs['FRAME-RATE']) : undefined,
            isAudio: false,
          });
          i++;
        }
        continue;
      }
    }

    return variants;
  }

  // -------------------------------------------------------------------------
  // DASH MPD parsing
  // -------------------------------------------------------------------------

  async parseDASHManifest(url: string): Promise<DASHRepresentation[]> {
    try {
      const response = await axios.get<string>(url, {
        responseType: 'text',
        timeout: 10_000,
        maxRedirects: 10,
        headers: { 'User-Agent': 'StreamValidator/1.0' },
      });

      const finalUrl = (response.request?.res?.responseUrl as string | undefined) ?? url;
      return this._parseDASHText(response.data, finalUrl);
    } catch {
      return [];
    }
  }

  private _parseDASHText(xml: string, baseUrl: string): DASHRepresentation[] {
    const representations: DASHRepresentation[] = [];

    // Extract BaseURL from manifest if present
    const baseUrlMatch = xml.match(/<BaseURL[^>]*>([^<]+)<\/BaseURL>/);
    const manifestBase = baseUrlMatch
      ? this._resolveUrl(baseUrlMatch[1].trim(), baseUrl)
      : baseUrl;

    // Find each AdaptationSet
    const adaptationSets = [...xml.matchAll(/<AdaptationSet([^>]*)>([\s\S]*?)<\/AdaptationSet>/g)];

    for (const as of adaptationSets) {
      const asAttrs = this._parseAttributes(as[1]);
      const asContent = as[2];
      const mimeType = asAttrs['mimeType'] ?? '';

      if (!mimeType.startsWith('video/') && !mimeType.startsWith('audio/')) continue;

      const repMatches = [...asContent.matchAll(/<Representation([^>]*)\/?>/g)];
      for (const rep of repMatches) {
        const attrs = this._parseAttributes(rep[1]);
        const id = attrs['id'] ?? '';
        const bandwidth = parseInt(attrs['bandwidth'] ?? '0', 10);
        const codecs = attrs['codecs'] ?? asAttrs['codecs'] ?? '';
        const width = attrs['width'] ? parseInt(attrs['width'], 10) : undefined;
        const height = attrs['height'] ? parseInt(attrs['height'], 10) : undefined;

        // Resolve template URL
        let repUrl = manifestBase
          .replace('$RepresentationID$', id)
          .replace('$Bandwidth$', String(bandwidth));

        representations.push({ url: repUrl, bandwidth, codecs, width, height, mimeType });
      }
    }

    return representations;
  }

  // -------------------------------------------------------------------------
  // Stream health checking
  // -------------------------------------------------------------------------

  async checkHealth(url: string, timeoutMs = 5_000): Promise<StreamHealthResult> {
    const start = Date.now();
    try {
      const headRes = await axios.head(url, {
        timeout: timeoutMs,
        maxRedirects: 5,
        validateStatus: () => true,
        headers: { 'User-Agent': 'StreamValidator/1.0' },
      });

      const responseMs = Date.now() - start;
      const statusCode: number = headRes.status;
      const contentType: string = (headRes.headers['content-type'] as string | undefined) ?? '';
      const alive = statusCode === 200 || statusCode === 206;

      // For .m3u8 — do a quick 2 KB fetch to verify #EXTM3U header
      if (alive && (url.includes('.m3u8') || contentType.includes('mpegURL'))) {
        const verified = await this._verifyM3U8(url, timeoutMs);
        return { url, alive: verified, contentType, statusCode, responseMs };
      }

      return { url, alive, contentType, statusCode, responseMs };
    } catch (err: unknown) {
      const responseMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      return { url, alive: false, statusCode: 0, responseMs, error: message };
    }
  }

  private async _verifyM3U8(url: string, timeoutMs: number): Promise<boolean> {
    try {
      const cfg: AxiosRequestConfig = {
        timeout: timeoutMs,
        maxRedirects: 5,
        responseType: 'text',
        headers: { Range: 'bytes=0-2047', 'User-Agent': 'StreamValidator/1.0' },
        validateStatus: () => true,
      };
      const res = await axios.get<string>(url, cfg);
      return typeof res.data === 'string' && res.data.trimStart().startsWith('#EXTM3U');
    } catch {
      return false;
    }
  }

  async checkHealthBatch(
    urls: string[],
    concurrency = 20,
    timeoutMs = 5_000
  ): Promise<StreamHealthResult[]> {
    const results: StreamHealthResult[] = [];
    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency);
      const batchResults = await Promise.all(batch.map((u) => this.checkHealth(u, timeoutMs)));
      results.push(...batchResults);
    }
    return results;
  }

  // -------------------------------------------------------------------------
  // Quality detection
  // -------------------------------------------------------------------------

  async detectQuality(url: string): Promise<QualityInfo> {
    if (url.includes('.m3u8')) {
      const variants = await this.parseHLSManifest(url);
      const best = variants
        .filter((v) => !v.isAudio)
        .sort((a, b) => b.bandwidth - a.bandwidth)[0];
      if (best) {
        return {
          resolution: best.resolution,
          codec: this._detectCodec(best.codecs),
          bandwidth: best.bandwidth,
          qualityTier: this._bandwidthToTier(best.bandwidth),
        };
      }
    }

    if (url.includes('.mpd')) {
      const reps = await this.parseDASHManifest(url);
      const best = reps
        .filter((r) => r.mimeType.startsWith('video/'))
        .sort((a, b) => b.bandwidth - a.bandwidth)[0];
      if (best) {
        const resolution =
          best.width && best.height ? `${best.width}x${best.height}` : undefined;
        return {
          resolution,
          codec: this._detectCodec(best.codecs),
          bandwidth: best.bandwidth,
          qualityTier: this._bandwidthToTier(best.bandwidth),
        };
      }
    }

    return { qualityTier: 'UNKNOWN' };
  }

  private _bandwidthToTier(bps: number): QualityTier {
    if (bps >= 8_000_000) return 'UHD';
    if (bps >= 4_000_000) return 'FHD';
    if (bps >= 1_500_000) return 'HD';
    if (bps > 0) return 'SD';
    return 'UNKNOWN';
  }

  private _detectCodec(codecs?: string): string | undefined {
    if (!codecs) return undefined;
    if (/hvc1|hev1/i.test(codecs)) return 'HEVC';
    if (/av01/i.test(codecs)) return 'AV1';
    if (/avc1/i.test(codecs)) return 'H.264';
    return codecs.split(',')[0].trim();
  }

  // -------------------------------------------------------------------------
  // Dead link pruner
  // -------------------------------------------------------------------------

  isDead(url: string): boolean {
    return this.deadUrls.has(url);
  }

  markDead(url: string, reason = 'unknown'): void {
    this.deadUrls.set(url, { reason, timestamp: Date.now() });
    this.emit('dead', { url, reason });
  }

  markAlive(url: string): void {
    this.deadUrls.delete(url);
  }

  /**
   * Start periodic health-check pruner.
   * @param urls      Reactive supplier — called each interval to get current list
   * @param onDead    Called for each URL that fails its health check
   * @param intervalMs  Check interval (default 6 hours)
   * @param concurrency Parallel checks per batch (default 20)
   */
  startPruner(
    urls: () => string[],
    onDead: (url: string, reason: string) => void,
    intervalMs = 6 * 60 * 60 * 1_000,
    concurrency = 20
  ): void {
    if (this.prunerTimer) clearInterval(this.prunerTimer);

    this.prunerTimer = setInterval(async () => {
      const list = urls();
      const results = await this.checkHealthBatch(list, concurrency);
      for (const r of results) {
        if (!r.alive) {
          const reason = r.error ?? `HTTP ${r.statusCode}`;
          this.markDead(r.url, reason);
          onDead(r.url, reason);
        } else {
          this.markAlive(r.url);
        }
      }
    }, intervalMs);
  }

  stopPruner(): void {
    if (this.prunerTimer) {
      clearInterval(this.prunerTimer);
      this.prunerTimer = null;
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private _resolveUrl(relative: string, base: string): string {
    if (/^https?:\/\//i.test(relative)) return relative;
    try {
      return new URL(relative, base).toString();
    } catch {
      return relative;
    }
  }

  /** Parse a line like `KEY=VALUE,KEY2="VALUE 2"` into a plain object */
  private _parseAttributes(raw: string): Record<string, string> {
    const result: Record<string, string> = {};
    const re = /([A-Z0-9_-]+)=(?:"([^"]*)"|([\S,]*?)(?:,|$))/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
      result[m[1]] = m[2] !== undefined ? m[2] : m[3];
    }
    return result;
  }
}

// Singleton
export const streamValidator = new StreamValidator();
