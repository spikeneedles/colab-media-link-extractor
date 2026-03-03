/**
 * Storage Manager - Persistent Storage for Processed Media Results
 * Maintains a growing reference list for deduplication
 */

export interface StoredMediaItem {
  id: string
  title: string
  url: string
  indexer: string
  size: number
  seeders: number
  leechers: number
  contentType?: 'movie' | 'series' | 'live-tv'
  genre?: string[]
  confidence?: 'high' | 'medium' | 'low'
  processedAt: number
  jobId?: string
  source?: string
}

export interface StorageStats {
  totalItems: number
  movies: number
  series: number
  liveTV: number
  totalIndexers: Set<string>
  oldestItem: number
  newestItem: number
}

const STORAGE_KEY = 'indexer_processed_storage'
const STORAGE_VERSION = 1

/**
 * Get all stored items
 */
export function getAllStoredItems(): StoredMediaItem[] {
  try {
    if (typeof window === 'undefined') return []
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    const data = JSON.parse(stored)
    return Array.isArray(data.items) ? data.items : []
  } catch (error) {
    console.error('Failed to load stored items:', error)
    return []
  }
}

/**
 * Add items to storage
 */
export function addStoredItems(items: StoredMediaItem[]): void {
  try {
    if (typeof window === 'undefined') return
    
    console.log('[StorageManager] addStoredItems called with items:', items)
    
    const existing = getAllStoredItems()
    console.log('[StorageManager] Found existing items:', existing.length)
    
    // Deduplicate by URL
    const existingUrls = new Set(existing.map(item => item.url))
    console.log('[StorageManager] Existing URLs:', existingUrls)
    
    const newItems = items.filter(item => !existingUrls.has(item.url))
    console.log('[StorageManager] New items after dedup:', newItems)
    console.log('[StorageManager] Filtered out items (duplicates):', items.length - newItems.length)
    
    const combined = [...existing, ...newItems].slice(-10000) // Keep last 10k items max
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: STORAGE_VERSION,
      items: combined,
      updatedAt: Date.now(),
    }))
    
    console.log(`[StorageManager] Added ${newItems.length} items (${combined.length} total)`)
    console.log('[StorageManager] localStorage now contains:', localStorage.getItem(STORAGE_KEY))
    
    // Notify listeners (e.g., IPTV player) of vault update
    window.dispatchEvent(new CustomEvent('vault:updated'))
  } catch (error) {
    console.error('Failed to add stored items:', error)
  }
}

/**
 * Remove item by URL
 */
export function removeStoredItem(url: string): void {
  try {
    if (typeof window === 'undefined') return
    
    const items = getAllStoredItems()
    const filtered = items.filter(item => item.url !== url)
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: STORAGE_VERSION,
      items: filtered,
      updatedAt: Date.now(),
    }))
    
    // Notify listeners (e.g., IPTV player) of vault update
    window.dispatchEvent(new CustomEvent('vault:updated'))
  } catch (error) {
    console.error('Failed to remove item:', error)
  }
}

/**
 * Clear all stored items
 */
export function clearAllStoredItems(): void {
  try {
    if (typeof window === 'undefined') return
    localStorage.removeItem(STORAGE_KEY)
    console.log('[StorageManager] Cleared all stored items')
    
    // Notify listeners (e.g., IPTV player) of vault update
    window.dispatchEvent(new CustomEvent('vault:updated'))
  } catch (error) {
    console.error('Failed to clear storage:', error)
  }
}

/**
 * Get duplicate check - returns items matching a URL
 */
export function checkDuplicateUrl(url: string): StoredMediaItem | undefined {
  const items = getAllStoredItems()
  return items.find(item => item.url === url)
}

/**
 * Get URLs that match a magnet hash
 */
export function checkDuplicateMagnet(magnetUrl: string): StoredMediaItem[] {
  const items = getAllStoredItems()
  return items.filter(item => item.url === magnetUrl)
}

/**
 * Get storage statistics
 */
export function getStorageStats(): StorageStats {
  const items = getAllStoredItems()
  
  const stats: StorageStats = {
    totalItems: items.length,
    movies: items.filter(i => i.contentType === 'movie').length,
    series: items.filter(i => i.contentType === 'series').length,
    liveTV: items.filter(i => i.contentType === 'live-tv').length,
    totalIndexers: new Set(items.map(i => i.indexer)),
    oldestItem: items.length > 0 ? Math.min(...items.map(i => i.processedAt)) : 0,
    newestItem: items.length > 0 ? Math.max(...items.map(i => i.processedAt)) : 0,
  }
  
  return stats
}

/**
 * Filter items by content type
 */
export function getStoredItemsByType(contentType: 'movie' | 'series' | 'live-tv' | 'all'): StoredMediaItem[] {
  const items = getAllStoredItems()
  if (contentType === 'all') return items
  return items.filter(item => item.contentType === contentType)
}

/**
 * Search stored items
 */
export function searchStoredItems(query: string): StoredMediaItem[] {
  const items = getAllStoredItems()
  const lowerQuery = query.toLowerCase()
  return items.filter(item =>
    item.title.toLowerCase().includes(lowerQuery) ||
    item.indexer.toLowerCase().includes(lowerQuery) ||
    item.url.toLowerCase().includes(lowerQuery)
  )
}

/**
 * Get items by indexer
 */
export function getStoredItemsByIndexer(indexer: string): StoredMediaItem[] {
  const items = getAllStoredItems()
  return items.filter(item => item.indexer === indexer)
}

/**
 * Export items as JSON
 */
export function exportStoredItems(): string {
  const items = getAllStoredItems()
  return JSON.stringify({
    version: STORAGE_VERSION,
    exportedAt: new Date().toISOString(),
    totalItems: items.length,
    items,
  }, null, 2)
}

/**
 * Import items from JSON
 */
export function importStoredItems(jsonData: string): { success: boolean; message: string; imported: number } {
  try {
    const data = JSON.parse(jsonData)
    if (!Array.isArray(data.items)) {
      throw new Error('Invalid format: items not found')
    }
    
    const newItems = data.items as StoredMediaItem[]
    addStoredItems(newItems)
    
    return {
      success: true,
      message: `Successfully imported ${newItems.length} items`,
      imported: newItems.length,
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Import failed',
      imported: 0,
    }
  }
}
