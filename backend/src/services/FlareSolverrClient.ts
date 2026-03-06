/**
 * FlareSolverrClient
 *
 * Thin wrapper around the FlareSolverr proxy API (https://github.com/FlareSolverr/FlareSolverr).
 * Used as a fallback when a site blocks our normal requests with Cloudflare protection
 * (detected by CF-Ray response header, HTTP 403/503 with "Just a moment" body, or
 * the "checking your browser" challenge page).
 *
 * FlareSolverr must be running at FLARESOLVERR_URL (default: http://localhost:8191).
 * Configure in .env: FLARESOLVERR_URL=http://localhost:8191
 *
 * If FlareSolverr is not reachable, all calls return null — the caller
 * falls back to normal Puppeteer / axios behaviour.
 */

import axios, { AxiosInstance } from 'axios'
import { captchaSolver }         from './CaptchaSolverService.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FlareSolverrSolution {
  url:         string
  status:      number
  headers:     Record<string, string>
  response:    string         // full HTML body
  cookies:     Array<{ name: string; value: string; domain: string; path: string; secure: boolean; httpOnly: boolean; sameSite: string; expires?: number }>
  userAgent:   string
}

export interface FlareSolverrResult {
  status:    'ok' | 'warning' | 'error'
  message:   string
  solution:  FlareSolverrSolution
  startTimestamp: number
  endTimestamp:   number
  version:   string
}

// ── Cloudflare detection ──────────────────────────────────────────────────────

/**
 * Returns true if the HTTP response or error looks like a Cloudflare challenge.
 */
export function isCloudflareBlocked(opts: {
  status?:  number
  headers?: Record<string, string>
  body?:    string
}): boolean {
  const { status, headers = {}, body = '' } = opts

  if (headers['cf-ray'] || headers['server']?.toLowerCase().includes('cloudflare')) {
    if (status === 403 || status === 503 || status === 429) return true
  }

  if (
    body.includes('Just a moment') ||
    body.includes('Checking your browser') ||
    body.includes('cf-browser-verification') ||
    body.includes('cloudflare') ||
    body.includes('Ray ID:')
  ) {
    return true
  }

  return false
}

// ── Client class ──────────────────────────────────────────────────────────────

class FlareSolverrClient {
  private http:    AxiosInstance
  private baseUrl: string
  private enabled: boolean
  private maxTimeout: number

  constructor() {
    this.baseUrl    = process.env.FLARESOLVERR_URL ?? 'http://localhost:8191'
    this.maxTimeout = 60_000
    this.enabled    = Boolean(this.baseUrl)

    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: this.maxTimeout + 5_000,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  /** Quick health check — returns false if FlareSolverr is not reachable. */
  async ping(): Promise<boolean> {
    if (!this.enabled) return false
    try {
      const res = await this.http.get('/', { timeout: 4_000 })
      return res.status === 200
    } catch {
      return false
    }
  }

  /**
   * Fetch a URL through FlareSolverr.
   * Returns the full solution (html body + cookies + userAgent) or null if unavailable.
   */
  async get(url: string, sessionId?: string): Promise<FlareSolverrSolution | null> {
    if (!this.enabled) return null
    try {
      const payload: Record<string, unknown> = {
        cmd:        'request.get',
        url,
        maxTimeout: this.maxTimeout,
      }
      if (sessionId) payload.session = sessionId

      const res = await this.http.post<FlareSolverrResult>('/v1', payload)
      if (res.data.status === 'ok') {
        console.log(`[FlareSolverr] ✓ Bypassed CF for ${url} (${res.data.solution.status})`)
        return res.data.solution
      }
      console.warn(`[FlareSolverr] ⚠ Non-ok status for ${url}: ${res.data.message}`)
      return null
    } catch (err: any) {
      console.warn(`[FlareSolverr] ✗ Unreachable or error: ${err.message}`)
      return null
    }
  }

  /**
   * Create a persistent browser session in FlareSolverr (reuse cookies/UA across requests).
   * Returns session ID or null.
   */
  async createSession(sessionId: string): Promise<boolean> {
    if (!this.enabled) return false
    try {
      const res = await this.http.post('/v1', { cmd: 'sessions.create', session: sessionId })
      return res.data?.status === 'ok'
    } catch {
      return false
    }
  }

  /** Destroy a FlareSolverr session. */
  async destroySession(sessionId: string): Promise<void> {
    if (!this.enabled) return
    try {
      await this.http.post('/v1', { cmd: 'sessions.destroy', session: sessionId })
    } catch {}
  }

  /**
   * High-level helper: try a normal axios GET first; if Cloudflare blocks it,
   * automatically retry via FlareSolverr.
   *
   * Returns { html, cookies, userAgent, viaSolver } or throws.
   */
  async fetchWithFallback(url: string): Promise<{
    html:       string
    cookies:    FlareSolverrSolution['cookies']
    userAgent:  string
    viaSolver:  boolean
    status:     number
  }> {
    // 1️⃣ Try plain axios first (fast, no overhead)
    try {
      const res = await axios.get<string>(url, {
        timeout:          15_000,
        responseType:     'text',
        validateStatus:   () => true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121 Safari/537.36',
          'Accept':     'text/html,application/xhtml+xml,*/*',
        },
      })

      const blocked = isCloudflareBlocked({
        status:  res.status,
        headers: res.headers as Record<string, string>,
        body:    res.data,
      })

      if (!blocked) {
        return { html: res.data, cookies: [], userAgent: '', viaSolver: false, status: res.status }
      }

      console.log(`[FlareSolverr] CF detected on ${url}, escalating to FlareSolverr…`)
    } catch (err: any) {
      console.warn(`[FlareSolverr] Plain request failed (${err.message}), trying FlareSolverr…`)
    }

    // 2️⃣ Escalate to FlareSolverr
    const solution = await this.get(url)
    if (solution) {
      return {
        html:      solution.response,
        cookies:   solution.cookies,
        userAgent: solution.userAgent,
        viaSolver: true,
        status:    solution.status,
      }
    }

    // 3️⃣ Final escalation: CAPTCHA solver (2captcha / CapMonster)
    if (captchaSolver.isConfigured()) {
      console.log(`[FlareSolverr] FlareSolverr failed for ${url}, trying CAPTCHA solver…`)
      // Extract Cloudflare Turnstile or reCAPTCHA sitekey from the page
      try {
        const rawRes = await axios.get<string>(url, {
          timeout: 15_000, responseType: 'text', validateStatus: () => true,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        })
        const html = rawRes.data ?? ''

        // Try Turnstile first (Cloudflare's newer challenge)
        const turnstileMatch = html.match(/data-sitekey=["']([0-9A-Za-z_-]{20,})["']/)
        if (turnstileMatch) {
          const token = await captchaSolver.solveTurnstile(turnstileMatch[1], url)
          if (token) {
            // Re-fetch with the solved token as cf-turnstile-response header
            const finalRes = await axios.get<string>(url, {
              timeout: 20_000, responseType: 'text', validateStatus: () => true,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'cf-turnstile-response': token,
              },
            })
            if (!isCloudflareBlocked({ status: finalRes.status, body: finalRes.data })) {
              console.log(`[FlareSolverr] ✓ Turnstile solved for ${url}`)
              return { html: finalRes.data, cookies: [], userAgent: '', viaSolver: true, status: finalRes.status }
            }
          }
        }

        // Try reCAPTCHA v2/v3
        const recaptchaMatch = html.match(/data-sitekey=["']([0-9A-Za-z_-]{40,})["']/)
        if (recaptchaMatch) {
          const token = await captchaSolver.solveRecaptchaV2(recaptchaMatch[1], url)
          if (token) {
            const finalRes = await axios.get<string>(url, {
              timeout: 20_000, responseType: 'text', validateStatus: () => true,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'g-recaptcha-response': token,
              },
            })
            if (!isCloudflareBlocked({ status: finalRes.status, body: finalRes.data })) {
              console.log(`[FlareSolverr] ✓ reCAPTCHA solved for ${url}`)
              return { html: finalRes.data, cookies: [], userAgent: '', viaSolver: true, status: finalRes.status }
            }
          }
        }
      } catch (captchaErr: any) {
        console.warn(`[FlareSolverr] CAPTCHA escalation failed: ${captchaErr.message}`)
      }
    }

    throw new Error(`All bypass methods exhausted for ${url} (FlareSolverr + CAPTCHA solver both failed)`)
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const flareSolverr = new FlareSolverrClient()
