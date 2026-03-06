/**
 * CaptchaSolverService
 *
 * Integrates 2captcha (https://2captcha.com) and CapMonster Cloud
 * (https://capmonster.cloud) as CAPTCHA-solving backends.
 *
 * Used as a third-tier escalation when both plain axios AND FlareSolverr
 * fail to bypass a site's bot protection.
 *
 * Supported CAPTCHA types:
 *   - reCAPTCHA v2 (invisible + visible)
 *   - reCAPTCHA v3
 *   - hCaptcha
 *   - Image/text CAPTCHA
 *   - Turnstile (Cloudflare)
 *
 * Env vars:
 *   TWOCAPTCHA_KEY    — 2captcha API key (https://2captcha.com/enterpage)
 *   CAPMONSTER_KEY    — CapMonster Cloud API key (optional)
 *   CAPTCHA_PROVIDER  — "2captcha" | "capmonster" (default: whichever key is set)
 *   CAPTCHA_TIMEOUT   — max wait seconds for solution (default: 120)
 */

import axios, { AxiosInstance } from 'axios'

// ── Types ──────────────────────────────────────────────────────────────────────

export type CaptchaType =
  | 'recaptcha_v2'
  | 'recaptcha_v3'
  | 'hcaptcha'
  | 'turnstile'
  | 'image'

export interface CaptchaTask {
  type:       CaptchaType
  siteKey:    string
  pageUrl:    string
  minScore?:  number    // reCAPTCHA v3 — minimum acceptable score (0.3–0.9)
  invisible?: boolean   // reCAPTCHA v2 invisible variant
  imageB64?:  string    // for image CAPTCHA — base64-encoded PNG/JPG
  action?:    string    // reCAPTCHA v3 action name
}

export interface CaptchaSolution {
  token:      string
  provider:   '2captcha' | 'capmonster'
  solvedInMs: number
  cost?:      number  // USD
}

// ── Service ────────────────────────────────────────────────────────────────────

export class CaptchaSolverService {
  private twoCaptchaKey:  string | undefined
  private capMonsterKey:  string | undefined
  private provider:       '2captcha' | 'capmonster' | undefined
  private maxWait:        number

  private twoCaptchaHttp: AxiosInstance
  private capMonsterHttp: AxiosInstance

  constructor() {
    this.twoCaptchaKey = process.env.TWOCAPTCHA_KEY
    this.capMonsterKey = process.env.CAPMONSTER_KEY
    this.maxWait = parseInt(process.env.CAPTCHA_TIMEOUT ?? '120', 10) * 1000

    // Determine active provider
    const pref = process.env.CAPTCHA_PROVIDER as '2captcha' | 'capmonster' | undefined
    if (pref === '2captcha' && this.twoCaptchaKey)      this.provider = '2captcha'
    else if (pref === 'capmonster' && this.capMonsterKey) this.provider = 'capmonster'
    else if (this.twoCaptchaKey)                          this.provider = '2captcha'
    else if (this.capMonsterKey)                          this.provider = 'capmonster'

    this.twoCaptchaHttp = axios.create({
      baseURL: 'https://2captcha.com',
      timeout: 15_000,
    })

    this.capMonsterHttp = axios.create({
      baseURL: 'https://api.capmonster.cloud',
      timeout: 15_000,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Returns true if at least one provider is configured. */
  isConfigured(): boolean {
    return Boolean(this.provider)
  }

  /**
   * Solve a CAPTCHA challenge.
   * Automatically selects the configured provider.
   */
  async solve(task: CaptchaTask): Promise<CaptchaSolution | null> {
    if (!this.provider) {
      console.warn('[Captcha] No API key configured (TWOCAPTCHA_KEY or CAPMONSTER_KEY)')
      return null
    }

    const start = Date.now()
    try {
      const token = this.provider === '2captcha'
        ? await this._solveTwoCaptcha(task)
        : await this._solveCapMonster(task)

      if (!token) return null

      return {
        token,
        provider:   this.provider,
        solvedInMs: Date.now() - start,
      }
    } catch (err: any) {
      console.error(`[Captcha] Solve failed: ${err.message}`)
      return null
    }
  }

  /** Convenience: solve reCAPTCHA v2 for a given sitekey + page. */
  async solveRecaptchaV2(siteKey: string, pageUrl: string, invisible = false): Promise<string | null> {
    const result = await this.solve({ type: 'recaptcha_v2', siteKey, pageUrl, invisible })
    return result?.token ?? null
  }

  /** Convenience: solve hCaptcha for a given sitekey + page. */
  async solveHcaptcha(siteKey: string, pageUrl: string): Promise<string | null> {
    const result = await this.solve({ type: 'hcaptcha', siteKey, pageUrl })
    return result?.token ?? null
  }

  /** Convenience: solve Cloudflare Turnstile for a given sitekey + page. */
  async solveTurnstile(siteKey: string, pageUrl: string): Promise<string | null> {
    const result = await this.solve({ type: 'turnstile', siteKey, pageUrl })
    return result?.token ?? null
  }

  /** Solve an image/text CAPTCHA from a base64-encoded image. */
  async solveImageCaptcha(imageB64: string): Promise<string | null> {
    const result = await this.solve({ type: 'image', siteKey: '', pageUrl: '', imageB64 })
    return result?.token ?? null
  }

  // ── 2captcha ───────────────────────────────────────────────────────────────

  private async _solveTwoCaptcha(task: CaptchaTask): Promise<string | null> {
    const key = this.twoCaptchaKey!

    // Build submission payload
    const params: Record<string, string> = { key, json: '1', soft_id: '0' }

    if (task.type === 'image' && task.imageB64) {
      params.method = 'base64'
      params.body   = task.imageB64
    } else if (task.type === 'recaptcha_v2') {
      params.method       = 'userrecaptcha'
      params.googlekey    = task.siteKey
      params.pageurl      = task.pageUrl
      if (task.invisible) params.invisible = '1'
    } else if (task.type === 'recaptcha_v3') {
      params.method    = 'userrecaptcha'
      params.googlekey = task.siteKey
      params.pageurl   = task.pageUrl
      params.version   = 'v3'
      params.action    = task.action ?? 'verify'
      params.min_score = String(task.minScore ?? 0.5)
    } else if (task.type === 'hcaptcha') {
      params.method  = 'hcaptcha'
      params.sitekey = task.siteKey
      params.pageurl = task.pageUrl
    } else if (task.type === 'turnstile') {
      params.method  = 'turnstile'
      params.sitekey = task.siteKey
      params.pageurl = task.pageUrl
    } else {
      return null
    }

    // Submit task
    const submitRes = await this.twoCaptchaHttp.post('/in.php', null, { params })
    const submitData = submitRes.data as any
    if (submitData.status !== 1) {
      console.warn(`[2captcha] Submit error: ${submitData.error_text ?? submitData.request}`)
      return null
    }
    const taskId = submitData.request as string

    // Poll for result
    return this._poll2Captcha(key, taskId)
  }

  private async _poll2Captcha(key: string, taskId: string): Promise<string | null> {
    const pollInterval = 5_000
    const deadline = Date.now() + this.maxWait

    while (Date.now() < deadline) {
      await this._delay(pollInterval)
      try {
        const res = await this.twoCaptchaHttp.get('/res.php', {
          params: { key, action: 'get', id: taskId, json: '1' },
        })
        const data = res.data as any
        if (data.status === 1) {
          console.log(`[2captcha] ✓ Solved task ${taskId}`)
          return data.request as string
        }
        if (data.request !== 'CAPCHA_NOT_READY') {
          console.warn(`[2captcha] Error: ${data.request}`)
          return null
        }
      } catch (err: any) {
        console.warn(`[2captcha] Poll error: ${err.message}`)
      }
    }

    console.warn(`[2captcha] Timeout waiting for task ${taskId}`)
    return null
  }

  // ── CapMonster ─────────────────────────────────────────────────────────────

  private async _solveCapMonster(task: CaptchaTask): Promise<string | null> {
    const clientKey = this.capMonsterKey!
    let taskBody: Record<string, any>

    if (task.type === 'image' && task.imageB64) {
      taskBody = { type: 'ImageToTextTask', body: task.imageB64 }
    } else if (task.type === 'recaptcha_v2') {
      taskBody = {
        type:      task.invisible ? 'NoCaptchaTaskProxyless' : 'RecaptchaV2TaskProxyless',
        websiteURL: task.pageUrl,
        websiteKey: task.siteKey,
      }
    } else if (task.type === 'recaptcha_v3') {
      taskBody = {
        type:        'RecaptchaV3TaskProxyless',
        websiteURL:  task.pageUrl,
        websiteKey:  task.siteKey,
        pageAction:  task.action ?? 'verify',
        minScore:    task.minScore ?? 0.5,
      }
    } else if (task.type === 'hcaptcha') {
      taskBody = {
        type:       'HCaptchaTaskProxyless',
        websiteURL: task.pageUrl,
        websiteKey: task.siteKey,
      }
    } else if (task.type === 'turnstile') {
      taskBody = {
        type:       'TurnstileTaskProxyless',
        websiteURL: task.pageUrl,
        websiteKey: task.siteKey,
      }
    } else {
      return null
    }

    // Create task
    const createRes = await this.capMonsterHttp.post('/createTask', {
      clientKey,
      task: taskBody,
    })
    const createData = createRes.data as any
    if (createData.errorId !== 0) {
      console.warn(`[CapMonster] Create error: ${createData.errorCode} — ${createData.errorDescription}`)
      return null
    }
    const taskId = createData.taskId as number

    // Poll for result
    return this._pollCapMonster(clientKey, taskId)
  }

  private async _pollCapMonster(clientKey: string, taskId: number): Promise<string | null> {
    const pollInterval = 3_000
    const deadline = Date.now() + this.maxWait

    while (Date.now() < deadline) {
      await this._delay(pollInterval)
      try {
        const res = await this.capMonsterHttp.post('/getTaskResult', { clientKey, taskId })
        const data = res.data as any
        if (data.status === 'ready') {
          console.log(`[CapMonster] ✓ Solved task ${taskId}`)
          return data.solution?.gRecaptchaResponse ??
                 data.solution?.token ??
                 data.solution?.text ??
                 null
        }
        if (data.errorId !== 0) {
          console.warn(`[CapMonster] Poll error: ${data.errorCode}`)
          return null
        }
      } catch (err: any) {
        console.warn(`[CapMonster] Poll error: ${err.message}`)
      }
    }

    console.warn(`[CapMonster] Timeout waiting for task ${taskId}`)
    return null
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private _delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms))
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────────

export const captchaSolver = new CaptchaSolverService()
