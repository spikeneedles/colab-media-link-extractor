import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(__dirname, '../../data/media.db')
const storagePath = path.join(__dirname, '../../data/media-storage')

// Ensure directories exist
const dataDir = path.dirname(dbPath)
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}
if (!fs.existsSync(storagePath)) {
  fs.mkdirSync(storagePath, { recursive: true })
}

const logger = {
  info: (msg: string, ...args: any[]) => console.log(`[MediaDB] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[MediaDB] ${msg}`, ...args),
}

export interface MediaItem {
  id: string
  url: string
  title: string
  category: 'live tv' | 'movies' | 'series'
  addedAt: number
  metadata?: {
    duration?: number
    resolution?: string
    format?: string
    source?: string
    [key: string]: any
  }
}

export interface MediaList {
  id: string
  category: 'live tv' | 'movies' | 'series'
  items: MediaItem[]
  lastUpdated: number
  itemCount: number
}

export class FirebaseService {
  private static instance: FirebaseService
  private db: Database.Database
  private initialized = false

  private constructor() {
    this.db = new Database(dbPath)
  }

  static getInstance(): FirebaseService {
    if (!FirebaseService.instance) {
      FirebaseService.instance = new FirebaseService()
    }
    return FirebaseService.instance
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      // Create tables
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS media_lists (
          id TEXT PRIMARY KEY,
          category TEXT NOT NULL UNIQUE,
          items TEXT NOT NULL,
          lastUpdated INTEGER NOT NULL,
          itemCount INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS media_items (
          id TEXT PRIMARY KEY,
          category TEXT NOT NULL,
          url TEXT NOT NULL,
          title TEXT NOT NULL,
          addedAt INTEGER NOT NULL,
          metadata TEXT,
          FOREIGN KEY (category) REFERENCES media_lists(category) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_category ON media_items(category);
        CREATE INDEX IF NOT EXISTS idx_title ON media_items(title);
      `)

      this.initialized = true
      logger.info('SQLite database initialized successfully')
      await this.initializeMediaLists()
    } catch (error) {
      logger.error('Failed to initialize database:', error)
      throw error
    }
  }

  // Media List Management

  async getMediaList(category: 'live tv' | 'movies' | 'series'): Promise<MediaList | null> {
    try {
      const stmt = this.db.prepare('SELECT * FROM media_lists WHERE category = ?')
      const row = stmt.get(category) as any

      if (!row) {
        return null
      }

      return {
        id: row.id,
        category: row.category,
        items: JSON.parse(row.items),
        lastUpdated: row.lastUpdated,
        itemCount: row.itemCount,
      }
    } catch (error) {
      logger.error(`Failed to get media list for ${category}:`, error)
      return null
    }
  }

  async getAllMediaLists(): Promise<MediaList[]> {
    try {
      const stmt = this.db.prepare('SELECT * FROM media_lists')
      const rows = stmt.all() as any[]

      return rows.map((row) => ({
        id: row.id,
        category: row.category,
        items: JSON.parse(row.items),
        lastUpdated: row.lastUpdated,
        itemCount: row.itemCount,
      }))
    } catch (error) {
      logger.error('Failed to get all media lists:', error)
      return []
    }
  }

  async addMediaToList(
    category: 'live tv' | 'movies' | 'series',
    media: Omit<MediaItem, 'id'>
  ): Promise<MediaItem | null> {
    try {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const mediaItem: MediaItem = {
        ...media,
        id,
      }

      // Get or create media list
      let mediaList = await this.getMediaList(category)

      if (!mediaList) {
        mediaList = {
          id: category,
          category,
          items: [],
          lastUpdated: Date.now(),
          itemCount: 0,
        }
      }

      // Add item to list
      mediaList.items.push(mediaItem)
      mediaList.itemCount = mediaList.items.length
      mediaList.lastUpdated = Date.now()

      // Save to database
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO media_lists (id, category, items, lastUpdated, itemCount)
        VALUES (?, ?, ?, ?, ?)
      `)

      stmt.run(
        mediaList.id,
        mediaList.category,
        JSON.stringify(mediaList.items),
        mediaList.lastUpdated,
        mediaList.itemCount
      )

      logger.info(`Added media to ${category}: ${mediaItem.title}`)
      return mediaItem
    } catch (error) {
      logger.error(`Failed to add media to ${category}:`, error)
      return null
    }
  }

  async removeMediaFromList(category: 'live tv' | 'movies' | 'series', mediaId: string): Promise<boolean> {
    try {
      const mediaList = await this.getMediaList(category)

      if (!mediaList) {
        return false
      }

      mediaList.items = mediaList.items.filter((item) => item.id !== mediaId)
      mediaList.itemCount = mediaList.items.length
      mediaList.lastUpdated = Date.now()

      const stmt = this.db.prepare(`
        UPDATE media_lists SET items = ?, lastUpdated = ?, itemCount = ? WHERE category = ?
      `)

      stmt.run(JSON.stringify(mediaList.items), mediaList.lastUpdated, mediaList.itemCount, category)

      logger.info(`Removed media from ${category}: ${mediaId}`)
      return true
    } catch (error) {
      logger.error(`Failed to remove media from ${category}:`, error)
      return false
    }
  }

  async bulkAddMedia(
    category: 'live tv' | 'movies' | 'series',
    mediaItems: Omit<MediaItem, 'id'>[]
  ): Promise<MediaItem[]> {
    try {
      const addedItems: MediaItem[] = []

      for (const media of mediaItems) {
        const item = await this.addMediaToList(category, media)
        if (item) {
          addedItems.push(item)
        }
      }

      logger.info(`Bulk added ${addedItems.length} items to ${category}`)
      return addedItems
    } catch (error) {
      logger.error(`Failed to bulk add media to ${category}:`, error)
      return []
    }
  }

  // Storage operations for media files (local file system)

  async uploadMediaFile(
    category: 'live tv' | 'movies' | 'series',
    fileName: string,
    data: Buffer
  ): Promise<string | null> {
    try {
      const categoryPath = path.join(storagePath, category)
      if (!fs.existsSync(categoryPath)) {
        fs.mkdirSync(categoryPath, { recursive: true })
      }

      const filePath = path.join(categoryPath, fileName)
      fs.writeFileSync(filePath, data)

      logger.info(`Uploaded file to ${path.relative(storagePath, filePath)}`)
      return path.relative(storagePath, filePath)
    } catch (error) {
      logger.error(`Failed to upload media file:`, error)
      return null
    }
  }

  async downloadMediaFile(filePath: string): Promise<Buffer | null> {
    try {
      const fullPath = path.join(storagePath, filePath)
      const data = fs.readFileSync(fullPath)

      logger.info(`Downloaded file from ${filePath}`)
      return data
    } catch (error) {
      logger.error(`Failed to download media file:`, error)
      return null
    }
  }

  async deleteMediaFile(filePath: string): Promise<boolean> {
    try {
      const fullPath = path.join(storagePath, filePath)
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath)
        logger.info(`Deleted file from ${filePath}`)
        return true
      }
      return false
    } catch (error) {
      logger.error(`Failed to delete media file:`, error)
      return false
    }
  }

  async listMediaFiles(category: 'live tv' | 'movies' | 'series'): Promise<string[]> {
    try {
      const categoryPath = path.join(storagePath, category)
      if (!fs.existsSync(categoryPath)) {
        return []
      }

      const files = fs.readdirSync(categoryPath)
      return files.map((file) => path.relative(storagePath, path.join(categoryPath, file)))
    } catch (error) {
      logger.error(`Failed to list media files for ${category}:`, error)
      return []
    }
  }

  // Utility methods

  async initializeMediaLists(): Promise<void> {
    try {
      const categories: Array<'live tv' | 'movies' | 'series'> = ['live tv', 'movies', 'series']

      for (const category of categories) {
        const existing = await this.getMediaList(category)
        if (!existing) {
          const newList: MediaList = {
            id: category,
            category,
            items: [],
            lastUpdated: Date.now(),
            itemCount: 0,
          }

          const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO media_lists (id, category, items, lastUpdated, itemCount)
            VALUES (?, ?, ?, ?, ?)
          `)

          stmt.run(
            newList.id,
            newList.category,
            JSON.stringify(newList.items),
            newList.lastUpdated,
            newList.itemCount
          )

          logger.info(`Initialized media list for ${category}`)
        }
      }
    } catch (error) {
      logger.error('Failed to initialize media lists:', error)
    }
  }

  async searchMedia(query: string): Promise<MediaItem[]> {
    try {
      const lists = await this.getAllMediaLists()
      const results: MediaItem[] = []

      const lowerQuery = query.toLowerCase()

      for (const list of lists) {
        const matching = list.items.filter(
          (item) =>
            item.title.toLowerCase().includes(lowerQuery) ||
            (item.metadata?.source && item.metadata.source.toLowerCase().includes(lowerQuery))
        )
        results.push(...matching)
      }

      return results
    } catch (error) {
      logger.error('Failed to search media:', error)
      return []
    }
  }

  // Cleanup
  close(): void {
    if (this.db) {
      this.db.close()
      logger.info('Database closed')
    }
  }
}

export default FirebaseService
