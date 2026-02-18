import NodeCache from 'node-cache'

export interface CacheConfig {
  enabled: boolean
  ttl: number
}

export class CacheManager {
  private cache: NodeCache | null = null
  private enabled: boolean

  constructor(config: CacheConfig) {
    this.enabled = config.enabled
    if (this.enabled) {
      this.cache = new NodeCache({
        stdTTL: config.ttl,
        checkperiod: config.ttl * 0.2,
        useClones: false,
      })
      console.log(`🗄️  Cache initialized with TTL: ${config.ttl}s`)
    }
  }

  get<T = any>(key: string): T | undefined {
    if (!this.enabled || !this.cache) {
      return undefined
    }
    return this.cache.get<T>(key)
  }

  set<T = any>(key: string, value: T): boolean {
    if (!this.enabled || !this.cache) {
      return false
    }
    return this.cache.set(key, value)
  }

  delete(key: string): number {
    if (!this.enabled || !this.cache) {
      return 0
    }
    return this.cache.del(key)
  }

  flush(): void {
    if (this.enabled && this.cache) {
      this.cache.flushAll()
    }
  }

  getStats() {
    if (!this.enabled || !this.cache) {
      return {
        keys: 0,
        hits: 0,
        misses: 0,
        ksize: 0,
        vsize: 0,
      }
    }

    return this.cache.getStats()
  }
}
