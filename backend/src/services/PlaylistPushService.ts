/**
 * Playlist Push Service
 * 
 * Automatically pushes master playlists to Firebase Firestore after crawl sessions
 * Supports both connected and offline mobile devices via Firestore sync
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { firebaseAdmin, PlaylistUpdate } from './FirebaseAdminService.js'
import type { CrawlResult } from './BackgroundCrawler.js'

const PLAYLISTS_DIR = path.join(process.cwd(), 'data', 'playlists')
const BACKEND_BASE_URL = process.env.BACKEND_URL || 'http://localhost:3002'

export interface PushStats {
  totalPushed: number
  categories: string[]
  timestamp: number
  success: boolean
}

export class PlaylistPushService {
  private lastPushTime = 0
  private pushDebounceMs = 30000 // Debounce rapid pushes (30s)
  private categoriesPendingPush = new Set<string>()

  constructor() {
    console.log('✓ Playlist Push Service initialized')
  }

  /**
   * Calculate file hash for change detection
   */
  private calculateFileHash(filePath: string): string {
    if (!fs.existsSync(filePath)) return ''
    const content = fs.readFileSync(filePath, 'utf8')
    return crypto.createHash('md5').update(content).digest('hex')
  }

  /**
   * Count items in M3U playlist
   */
  private countPlaylistItems(filePath: string): number {
    if (!fs.existsSync(filePath)) return 0
    const content = fs.readFileSync(filePath, 'utf8')
    const matches = content.match(/#EXTINF:/g)
    return matches ? matches.length : 0
  }

  /**
   * Get file size in bytes
   */
  private getFileSize(filePath: string): number {
    if (!fs.existsSync(filePath)) return 0
    const stats = fs.statSync(filePath)
    return stats.size
  }

  /**
   * Prepare playlist update object
   */
  private preparePlaylistUpdate(category: string, fileName: string): PlaylistUpdate | null {
    const filePath = path.join(PLAYLISTS_DIR, fileName)
    
    if (!fs.existsSync(filePath)) {
      console.warn(`Playlist file not found: ${fileName}`)
      return null
    }

    const itemCount = this.countPlaylistItems(filePath)
    const fileSize = this.getFileSize(filePath)
    const hash = this.calculateFileHash(filePath)

    // Playlist is accessible via backend API
    const playlistUrl = `${BACKEND_BASE_URL}/api/archivist/playlist/${category}`

    return {
      category,
      playlistUrl,
      itemCount,
      lastUpdated: Date.now(),
      fileSize,
      hash,
    }
  }

  /**
   * Push a single category playlist
   */
  async pushCategory(category: string): Promise<boolean> {
    if (!firebaseAdmin.isEnabled()) {
      console.log('Firebase not enabled, skipping playlist push')
      return false
    }

    const categoryFileMap: Record<string, string> = {
      'movies': 'movies_master.m3u',
      'live_tv': 'livetv_master.m3u',
      'series': 'series_master.m3u',
      'adult_movies': 'adult_movies_master.m3u',
      'adult_livetv': 'adult_livetv_master.m3u',
      'adult_series': 'adult_series_master.m3u',
    }

    const fileName = categoryFileMap[category]
    if (!fileName) {
      console.warn(`Unknown category: ${category}`)
      return false
    }

    const update = this.preparePlaylistUpdate(category, fileName)
    if (!update) {
      return false
    }

    return await firebaseAdmin.pushPlaylistUpdate(update)
  }

  /**
   * Push all master playlists
   */
  async pushAllPlaylists(): Promise<PushStats> {
    const startTime = Date.now()
    const categories = ['movies', 'live_tv', 'series', 'adult_movies', 'adult_livetv', 'adult_series']
    
    if (!firebaseAdmin.isEnabled()) {
      console.log('Firebase not enabled, skipping all playlist push')
      return {
        totalPushed: 0,
        categories: [],
        timestamp: startTime,
        success: false,
      }
    }

    const updates: PlaylistUpdate[] = []
    const categoryFileMap: Record<string, string> = {
      'movies': 'movies_master.m3u',
      'live_tv': 'livetv_master.m3u',
      'series': 'series_master.m3u',
      'adult_movies': 'adult_movies_master.m3u',
      'adult_livetv': 'adult_livetv_master.m3u',
      'adult_series': 'adult_series_master.m3u',
    }

    for (const [category, fileName] of Object.entries(categoryFileMap)) {
      const update = this.preparePlaylistUpdate(category, fileName)
      if (update) {
        updates.push(update)
      }
    }

    const totalPushed = await firebaseAdmin.pushAllPlaylists(updates)
    
    // Send notification to mobile apps
    if (totalPushed > 0) {
      await firebaseAdmin.notifyPlaylistUpdate(updates.map(u => u.category))
      await firebaseAdmin.cleanupNotifications()
    }

    const result: PushStats = {
      totalPushed,
      categories: updates.map(u => u.category),
      timestamp: Date.now(),
      success: totalPushed > 0,
    }

    this.lastPushTime = Date.now()
    console.log(`📤 Playlist push complete: ${totalPushed}/${updates.length} categories synced`)
    
    return result
  }

  /**
   * Handle crawl completion event and push playlists
   * Debounces rapid consecutive events
   */
  async onCrawlComplete(crawlResult?: CrawlResult): Promise<void> {
    const now = Date.now()
    
    // Add category to pending set if provided
    if (crawlResult?.category) {
      const categoryMap: Record<string, string> = {
        '2000': 'movies',
        '5000': 'series',
        '8000': 'adult_movies',
      }
      const category = categoryMap[crawlResult.category]
      if (category) {
        this.categoriesPendingPush.add(category)
      }
    }

    // Debounce: If last push was recent, wait
    if (now - this.lastPushTime < this.pushDebounceMs) {
      console.log(`⏱️  Debouncing playlist push (last push ${Math.round((now - this.lastPushTime) / 1000)}s ago)`)
      return
    }

    // If we have pending categories, push them
    if (this.categoriesPendingPush.size > 0) {
      console.log(`📤 Pushing ${this.categoriesPendingPush.size} pending playlist categories...`)
      for (const category of this.categoriesPendingPush) {
        await this.pushCategory(category)
      }
      this.categoriesPendingPush.clear()
    } else {
      // Otherwise push all playlists
      await this.pushAllPlaylists()
    }
  }

  /**
   * Handle full crawl cycle completion
   */
  async onCycleComplete(): Promise<void> {
    console.log('🔄 Crawl cycle completed, pushing all playlists to mobile app...')
    await this.pushAllPlaylists()
    this.categoriesPendingPush.clear()
  }

  /**
   * Manual trigger for testing
   */
  async manualPush(): Promise<PushStats> {
    console.log('🔧 Manual playlist push triggered')
    return await this.pushAllPlaylists()
  }
}

// Singleton instance
export const playlistPushService = new PlaylistPushService()
