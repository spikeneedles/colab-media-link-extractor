/**
 * DnsDiscoveryService
 *
 * Brute-forces DNS subdomains for known IPTV-related prefixes to discover
 * unlisted IPTV panels, Xtream Codes servers, and streaming endpoints.
 *
 * Strategy:
 *   1. For each base domain, resolve each subdomain from the wordlist via DNS.
 *   2. For every resolved host, probe common IPTV ports (8080, 25461, 8096, etc.).
 *   3. Verify Xtream Codes compatibility via /player_api.php probe.
 *   4. Emit discovered panels for archiving.
 *
 * Env vars:
 *   DNS_DISCOVERY_CONCURRENCY — parallel DNS lookups (default: 50)
 *   DNS_DISCOVERY_TIMEOUT     — DNS lookup timeout ms (default: 3000)
 */

import dns              from 'dns/promises'
import http             from 'http'
import https            from 'https'
import net              from 'net'
import { EventEmitter } from 'events'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DiscoveredHost {
  domain:     string      // full subdomain.base
  subdomain:  string      // the prefix portion
  baseDomain: string
  ip:         string[]    // resolved IPs
  openPorts:  number[]
  isXtream:   boolean
  xtreamUrl?: string
  discoveredAt: number
}

export interface DnsScanResult {
  discovered: DiscoveredHost[]
  scanned:    number
  resolved:   number
  duration:   number
}

// ── Wordlist ───────────────────────────────────────────────────────────────────

const IPTV_SUBDOMAINS = [
  // Primary IPTV terms
  'iptv', 'stream', 'live', 'panel', 'tv', 'media', 'play',
  'radio', 'vod', 'epg', 'api', 'proxy', 'gate', 'hls',
  // Server roles
  'xtream', 'xtreams', 'code', 'codes', 'server', 'cdn',
  // Common panel paths
  'portal', 'admin', 'dashboard', 'backend', 'app', 'web',
  // Regional/service hints
  'us', 'uk', 'eu', 'global', 'free', 'premium', 'vip',
  // Tech hints
  'rtmp', 'rtsp', 'hls2', 'dash', 'catchup', 'replay',
  'playlist', 'm3u', 'token', 'auth', 'login',
  // Infrastructure
  'edge', 'relay', 'origin', 'lb', 'loadbalancer',
  'node1', 'node2', 'node3', 's1', 's2', 's3',
]

const XTREAM_PORTS = [8080, 25461, 80, 8096, 8000, 2082, 8888, 443]

// ── Semaphore ─────────────────────────────────────────────────────────────────

class Semaphore {
  private slots: number
  private queue: (() => void)[] = []
  constructor(slots: number) { this.slots = slots }
  acquire(): Promise<void> {
    if (this.slots > 0) { this.slots--; return Promise.resolve() }
    return new Promise(r => this.queue.push(r))
  }
  release(): void {
    if (this.queue.length) this.queue.shift()!()
    else this.slots++
  }
}

// ── Service ────────────────────────────────────────────────────────────────────

export class DnsDiscoveryService extends EventEmitter {
  private concurrency: number
  private dnsTimeout:  number

  constructor() {
    super()
    this.concurrency = parseInt(process.env.DNS_DISCOVERY_CONCURRENCY ?? '50', 10)
    this.dnsTimeout  = parseInt(process.env.DNS_DISCOVERY_TIMEOUT ?? '3000', 10)
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Scan all IPTV subdomains for a given base domain.
   * E.g. scanDomain("example.com") probes iptv.example.com, stream.example.com, etc.
   */
  async scanDomain(baseDomain: string, customWordlist?: string[]): Promise<DnsScanResult> {
    const start = Date.now()
    const wordlist = customWordlist ?? IPTV_SUBDOMAINS
    const sem = new Semaphore(this.concurrency)
    const discovered: DiscoveredHost[] = []
    let resolved = 0

    const tasks = wordlist.map(sub => async () => {
      await sem.acquire()
      try {
        const fqdn = `${sub}.${baseDomain}`
        const ips  = await this._resolve(fqdn)
        if (!ips.length) return

        resolved++
        this.emit('resolved', { domain: fqdn, ips })

        const openPorts = await this._probePorts(ips[0], XTREAM_PORTS.slice(0, 4))
        if (!openPorts.length) return

        const xtream = await this._detectXtream(ips[0], openPorts)
        const host: DiscoveredHost = {
          domain:      fqdn,
          subdomain:   sub,
          baseDomain,
          ip:          ips,
          openPorts,
          isXtream:    Boolean(xtream),
          xtreamUrl:   xtream ?? undefined,
          discoveredAt: Date.now(),
        }
        discovered.push(host)
        this.emit('discovered', host)
        console.log(`[DnsDiscovery] ✓ ${fqdn} (${ips[0]}) ports=${openPorts.join(',')}${xtream ? ' [XTREAM]' : ''}`)
      } catch {
        // DNS or probe error — skip silently
      } finally {
        sem.release()
      }
    })

    await Promise.allSettled(tasks.map(t => t()))

    return {
      discovered,
      scanned:  wordlist.length,
      resolved,
      duration: Date.now() - start,
    }
  }

  /**
   * Scan multiple domains in sequence.
   */
  async scanDomains(domains: string[]): Promise<DnsScanResult> {
    const combined: DiscoveredHost[] = []
    let totalScanned = 0
    let totalResolved = 0
    const start = Date.now()

    for (const domain of domains) {
      const result = await this.scanDomain(domain)
      combined.push(...result.discovered)
      totalScanned  += result.scanned
      totalResolved += result.resolved
    }

    return {
      discovered: combined,
      scanned:    totalScanned,
      resolved:   totalResolved,
      duration:   Date.now() - start,
    }
  }

  /**
   * Probe a specific IP + port list directly (no DNS).
   */
  async probeHost(ip: string, ports = XTREAM_PORTS): Promise<DiscoveredHost | null> {
    const openPorts = await this._probePorts(ip, ports)
    if (!openPorts.length) return null

    const xtream = await this._detectXtream(ip, openPorts)
    return {
      domain:      ip,
      subdomain:   '',
      baseDomain:  ip,
      ip:          [ip],
      openPorts,
      isXtream:    Boolean(xtream),
      xtreamUrl:   xtream ?? undefined,
      discoveredAt: Date.now(),
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _resolve(fqdn: string): Promise<string[]> {
    return Promise.race([
      dns.resolve4(fqdn).catch(() => [] as string[]),
      new Promise<string[]>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), this.dnsTimeout)
      ),
    ]).catch(() => [])
  }

  private _probePorts(ip: string, ports: number[]): Promise<number[]> {
    return Promise.all(
      ports.map(port =>
        this._tcpConnect(ip, port).then(open => open ? port : null)
      )
    ).then(results => results.filter((p): p is number => p !== null))
  }

  private _tcpConnect(ip: string, port: number, timeoutMs = 1500): Promise<boolean> {
    return new Promise(resolve => {
      const socket = new net.Socket()
      const done = (result: boolean) => { socket.destroy(); resolve(result) }
      socket.setTimeout(timeoutMs)
      socket.on('connect', () => done(true))
      socket.on('error', () => done(false))
      socket.on('timeout', () => done(false))
      socket.connect(port, ip)
    })
  }

  private async _detectXtream(ip: string, openPorts: number[]): Promise<string | null> {
    for (const port of openPorts) {
      const url = `http://${ip}:${port}`
      try {
        const body = await this._httpGet(`${url}/player_api.php?username=test&password=test&action=get_server_info`)
        if (body && this._looksLikeXtream(body)) {
          return url
        }
      } catch {
        // not Xtream
      }
    }
    return null
  }

  private _httpGet(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const mod = url.startsWith('https') ? https : http
      const req = mod.get(url, { timeout: 5000 }, res => {
        let body = ''
        res.on('data', (chunk: Buffer) => { body += chunk.toString() })
        res.on('end', () => resolve(body))
      })
      req.on('error', reject)
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    })
  }

  private _looksLikeXtream(body: string): boolean {
    try {
      const data = JSON.parse(body)
      return (
        typeof data === 'object' &&
        data !== null &&
        ('server_info' in data || 'user_info' in data || 'available_channels' in data)
      )
    } catch {
      return false
    }
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────────

export const dnsDiscovery = new DnsDiscoveryService()
