import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'

export interface AuthConfig {
  enabled: boolean
  apiKeys: Set<string>
  requireAuth: string[]
  rateLimitByKey: Map<string, { count: number; resetTime: number }>
}

export class AuthManager {
  private config: AuthConfig

  constructor() {
    const apiKeysEnv = process.env.API_KEYS || ''
    const apiKeys = apiKeysEnv.split(',').filter(key => key.trim().length > 0)
    
    this.config = {
      enabled: process.env.AUTH_ENABLED === 'true',
      apiKeys: new Set(apiKeys),
      requireAuth: (process.env.AUTH_REQUIRED_ENDPOINTS || '/api/media/*').split(','),
      rateLimitByKey: new Map(),
    }

    if (this.config.enabled && this.config.apiKeys.size === 0) {
      console.warn('⚠️  Authentication is enabled but no API keys are configured!')
      console.warn('⚠️  Generate API keys with: npm run generate-key')
    }
  }

  generateApiKey(): string {
    return `mls_${crypto.randomBytes(32).toString('hex')}`
  }

  isEnabled(): boolean {
    return this.config.enabled
  }

  isValidApiKey(apiKey: string): boolean {
    return this.config.apiKeys.has(apiKey)
  }

  addApiKey(apiKey: string): void {
    this.config.apiKeys.add(apiKey)
  }

  removeApiKey(apiKey: string): void {
    this.config.apiKeys.delete(apiKey)
  }

  listApiKeys(): string[] {
    return Array.from(this.config.apiKeys).map(key => 
      `${key.substring(0, 10)}...${key.substring(key.length - 10)}`
    )
  }

  shouldRequireAuth(path: string): boolean {
    if (!this.config.enabled) return false
    
    return this.config.requireAuth.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'))
      return regex.test(path)
    })
  }

  checkRateLimit(apiKey: string, maxRequests: number = 1000, windowMs: number = 3600000): boolean {
    const now = Date.now()
    const keyData = this.config.rateLimitByKey.get(apiKey)

    if (!keyData || keyData.resetTime < now) {
      this.config.rateLimitByKey.set(apiKey, {
        count: 1,
        resetTime: now + windowMs,
      })
      return true
    }

    if (keyData.count >= maxRequests) {
      return false
    }

    keyData.count++
    return true
  }

  getRateLimitInfo(apiKey: string): { count: number; resetTime: number; remaining: number } | null {
    const keyData = this.config.rateLimitByKey.get(apiKey)
    if (!keyData) return null

    const maxRequests = parseInt(process.env.API_KEY_RATE_LIMIT || '1000', 10)
    return {
      count: keyData.count,
      resetTime: keyData.resetTime,
      remaining: Math.max(0, maxRequests - keyData.count),
    }
  }

  cleanupExpiredRateLimits(): void {
    const now = Date.now()
    for (const [key, data] of this.config.rateLimitByKey.entries()) {
      if (data.resetTime < now) {
        this.config.rateLimitByKey.delete(key)
      }
    }
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.shouldRequireAuth(req.path)) {
        return next()
      }

      const apiKey = req.headers['x-api-key'] as string || 
                     req.query.apiKey as string ||
                     req.query.api_key as string

      if (!apiKey) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'API key must be provided in X-API-Key header or apiKey query parameter',
          docs: '/api/auth/docs',
        })
      }

      if (!this.isValidApiKey(apiKey)) {
        return res.status(403).json({
          error: 'Invalid API key',
          message: 'The provided API key is not valid or has been revoked',
        })
      }

      const maxRequests = parseInt(process.env.API_KEY_RATE_LIMIT || '1000', 10)
      const windowMs = parseInt(process.env.API_KEY_RATE_WINDOW || '3600000', 10)

      if (!this.checkRateLimit(apiKey, maxRequests, windowMs)) {
        const rateLimitInfo = this.getRateLimitInfo(apiKey)
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: `API key has exceeded the rate limit of ${maxRequests} requests per hour`,
          resetTime: rateLimitInfo?.resetTime,
          resetIn: rateLimitInfo ? Math.ceil((rateLimitInfo.resetTime - Date.now()) / 1000) : 0,
        })
      }

      const rateLimitInfo = this.getRateLimitInfo(apiKey)
      if (rateLimitInfo) {
        res.setHeader('X-RateLimit-Limit', maxRequests.toString())
        res.setHeader('X-RateLimit-Remaining', rateLimitInfo.remaining.toString())
        res.setHeader('X-RateLimit-Reset', rateLimitInfo.resetTime.toString())
      }

      res.locals.apiKey = apiKey
      next()
    }
  }
}

setInterval(() => {
  const authManager = global.authManager as AuthManager
  if (authManager) {
    authManager.cleanupExpiredRateLimits()
  }
}, 60000)

declare global {
  var authManager: AuthManager
}
