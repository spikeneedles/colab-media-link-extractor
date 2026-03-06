/**
 * DNS Discovery Routes
 *
 * POST /api/dns-discovery/scan     — brute-force IPTV subdomains for a domain
 * POST /api/dns-discovery/probe    — probe a specific IP for IPTV ports
 * GET  /api/dns-discovery/wordlist — get the IPTV subdomain wordlist
 */

import { Router, Request, Response } from 'express'
import { dnsDiscovery }               from '../services/DnsDiscoveryService.js'

const router = Router()

// POST /api/dns-discovery/scan
// Body: { domain: string, wordlist?: string[] }
router.post('/scan', async (req: Request, res: Response) => {
  const { domain, wordlist } = req.body as { domain?: string; wordlist?: string[] }
  if (!domain) return res.status(400).json({ error: 'domain is required' })

  // Basic domain validation
  if (!/^[a-zA-Z0-9][a-zA-Z0-9\-.]+\.[a-zA-Z]{2,}$/.test(domain)) {
    return res.status(400).json({ error: 'Invalid domain format' })
  }

  try {
    const result = await dnsDiscovery.scanDomain(domain, wordlist)
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/dns-discovery/probe
// Body: { ip: string, ports?: number[] }
router.post('/probe', async (req: Request, res: Response) => {
  const { ip, ports } = req.body as { ip?: string; ports?: number[] }
  if (!ip) return res.status(400).json({ error: 'ip is required' })

  try {
    const result = await dnsDiscovery.probeHost(ip, ports)
    res.json({ host: result, found: Boolean(result) })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/dns-discovery/wordlist — returns the default IPTV subdomain wordlist
router.get('/wordlist', (_req: Request, res: Response) => {
  // Re-export the default wordlist for frontend use
  const wordlist = [
    'iptv', 'stream', 'live', 'panel', 'tv', 'media', 'play',
    'radio', 'vod', 'epg', 'api', 'proxy', 'gate', 'hls',
    'xtream', 'xtreams', 'code', 'codes', 'server', 'cdn',
    'portal', 'admin', 'dashboard', 'backend', 'app', 'web',
    'us', 'uk', 'eu', 'global', 'free', 'premium', 'vip',
    'rtmp', 'rtsp', 'hls2', 'dash', 'catchup', 'replay',
    'playlist', 'm3u', 'token', 'auth', 'login',
    'edge', 'relay', 'origin', 'lb', 'loadbalancer',
    'node1', 'node2', 'node3', 's1', 's2', 's3',
  ]
  res.json({ wordlist, count: wordlist.length })
})

export default router
