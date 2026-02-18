/**
 * Community Pattern Hub Service
 * 
 * Provides integration with the online community pattern sharing hub.
 * Users can publish patterns, browse community contributions, subscribe to updates,
 * rate patterns, and collaborate with other users.
 */

import type { StreamingPattern, PatternSubmission, PatternReview } from './patternLibrary'

export interface HubUser {
  id: string
  username: string
  displayName: string
  avatar?: string
  bio?: string
  website?: string
  github?: string
  reputation: number
  patternsPublished: number
  totalDownloads: number
  followers: number
  following: number
  joinedAt: string
  verified: boolean
  badges: UserBadge[]
}

export interface UserBadge {
  id: string
  name: string
  description: string
  icon: string
  earnedAt: string
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
}

export interface CommunityPattern extends StreamingPattern {
  hubId: string
  userId: string
  username: string
  userAvatar?: string
  publishedAt: string
  lastUpdated: string
  views: number
  stars: number
  forks: number
  comments: number
  reviews: PatternReview[]
  collections: string[]
  isOfficial: boolean
  isFeatured: boolean
  isTrending: boolean
  weeklyDownloads: number
  monthlyDownloads: number
  changelog?: ChangelogEntry[]
  dependencies?: string[]
  compatibleWith?: string[]
  replaces?: string[]
  license: 'MIT' | 'Apache-2.0' | 'GPL-3.0' | 'BSD-3-Clause' | 'CC0-1.0' | 'Unlicense'
}

export interface ChangelogEntry {
  version: string
  date: string
  changes: string[]
  breaking: boolean
}

export interface PatternCollection {
  id: string
  name: string
  description: string
  author: string
  authorId: string
  patterns: string[]
  followers: number
  isPublic: boolean
  createdAt: string
  updatedAt: string
  tags: string[]
  thumbnail?: string
}

export interface PatternComment {
  id: string
  patternId: string
  userId: string
  username: string
  userAvatar?: string
  content: string
  parentId?: string
  replies: PatternComment[]
  upvotes: number
  downvotes: number
  createdAt: string
  updatedAt: string
  edited: boolean
}

export interface HubStats {
  totalPatterns: number
  totalUsers: number
  totalDownloads: number
  totalStars: number
  patternsThisWeek: number
  activeUsers: number
  topCategories: { category: string; count: number }[]
  topAuthors: { username: string; patterns: number; downloads: number }[]
}

export interface PublishOptions {
  pattern: PatternSubmission
  visibility: 'public' | 'unlisted' | 'private'
  license: CommunityPattern['license']
  allowForks: boolean
  allowComments: boolean
  enableVersioning: boolean
  notifyFollowers: boolean
}

export interface SearchFilters {
  query?: string
  category?: string
  tags?: string[]
  author?: string
  verified?: boolean
  featured?: boolean
  minRating?: number
  minDownloads?: number
  license?: string[]
  updatedAfter?: string
  sortBy?: 'trending' | 'recent' | 'popular' | 'rating' | 'downloads'
  limit?: number
  offset?: number
}

export interface SubscriptionUpdate {
  patternId: string
  patternName: string
  updateType: 'new-version' | 'security-fix' | 'breaking-change' | 'deprecation'
  version: string
  summary: string
  timestamp: string
}

// Simulated backend storage (replace with actual API calls)
const LOCAL_HUB_PATTERNS_KEY = 'community-hub-patterns'
const LOCAL_HUB_USERS_KEY = 'community-hub-users'
const LOCAL_HUB_SUBSCRIPTIONS_KEY = 'community-hub-subscriptions'
const LOCAL_HUB_USER_PROFILE_KEY = 'community-hub-user-profile'

/**
 * Get the current authenticated user's profile
 */
export function getCurrentUser(): HubUser | null {
  const stored = localStorage.getItem(LOCAL_HUB_USER_PROFILE_KEY)
  if (stored) {
    return JSON.parse(stored)
  }

  // Create anonymous user if none exists
  const anonymousUser: HubUser = {
    id: `user-${Date.now()}`,
    username: 'anonymous',
    displayName: 'Anonymous User',
    reputation: 0,
    patternsPublished: 0,
    totalDownloads: 0,
    followers: 0,
    following: 0,
    joinedAt: new Date().toISOString(),
    verified: false,
    badges: []
  }

  localStorage.setItem(LOCAL_HUB_USER_PROFILE_KEY, JSON.stringify(anonymousUser))
  return anonymousUser
}

/**
 * Update current user profile
 */
export function updateUserProfile(updates: Partial<HubUser>): HubUser {
  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new Error('No user profile found')
  }

  const updatedUser = { ...currentUser, ...updates }
  localStorage.setItem(LOCAL_HUB_USER_PROFILE_KEY, JSON.stringify(updatedUser))
  return updatedUser
}

/**
 * Get all patterns from the community hub
 */
export function getHubPatterns(): CommunityPattern[] {
  const stored = localStorage.getItem(LOCAL_HUB_PATTERNS_KEY)
  if (stored) {
    return JSON.parse(stored)
  }
  return []
}

/**
 * Save patterns to the hub
 */
function saveHubPatterns(patterns: CommunityPattern[]): void {
  localStorage.setItem(LOCAL_HUB_PATTERNS_KEY, JSON.stringify(patterns))
}

/**
 * Publish a pattern to the community hub
 */
export async function publishPattern(options: PublishOptions): Promise<CommunityPattern> {
  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new Error('You must be logged in to publish patterns')
  }

  const newPattern: CommunityPattern = {
    // StreamingPattern fields
    id: `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: options.pattern.name,
    description: options.pattern.description,
    author: currentUser.displayName,
    category: options.pattern.category,
    patterns: options.pattern.patterns,
    exampleUrls: options.pattern.exampleUrls,
    testUrls: options.pattern.testUrls,
    tags: options.pattern.tags,
    popularity: 0,
    rating: 0,
    downloads: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    verified: false,
    providerHints: options.pattern.providerHints,
    scrapingRules: options.pattern.scrapingRules,
    validationRules: options.pattern.validationRules,

    // CommunityPattern fields
    hubId: `hub-${Date.now()}`,
    userId: currentUser.id,
    username: currentUser.username,
    userAvatar: currentUser.avatar,
    publishedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    views: 0,
    stars: 0,
    forks: 0,
    comments: 0,
    reviews: [],
    collections: [],
    isOfficial: false,
    isFeatured: false,
    isTrending: false,
    weeklyDownloads: 0,
    monthlyDownloads: 0,
    license: options.license
  }

  // Add to hub patterns
  const allPatterns = getHubPatterns()
  allPatterns.push(newPattern)
  saveHubPatterns(allPatterns)

  // Update user stats
  updateUserProfile({
    patternsPublished: currentUser.patternsPublished + 1,
    reputation: currentUser.reputation + 10
  })

  return newPattern
}

/**
 * Search patterns in the community hub
 */
export function searchHubPatterns(filters: SearchFilters): CommunityPattern[] {
  let patterns = getHubPatterns()

  // Apply filters
  if (filters.query) {
    const query = filters.query.toLowerCase()
    patterns = patterns.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query) ||
      p.tags.some(t => t.toLowerCase().includes(query)) ||
      p.username.toLowerCase().includes(query)
    )
  }

  if (filters.category) {
    patterns = patterns.filter(p => p.category === filters.category)
  }

  if (filters.tags && filters.tags.length > 0) {
    patterns = patterns.filter(p =>
      filters.tags!.some(tag => p.tags.includes(tag))
    )
  }

  if (filters.author) {
    patterns = patterns.filter(p => p.username === filters.author)
  }

  if (filters.verified !== undefined) {
    patterns = patterns.filter(p => p.verified === filters.verified)
  }

  if (filters.featured !== undefined) {
    patterns = patterns.filter(p => p.isFeatured === filters.featured)
  }

  if (filters.minRating !== undefined) {
    patterns = patterns.filter(p => p.rating >= filters.minRating!)
  }

  if (filters.minDownloads !== undefined) {
    patterns = patterns.filter(p => p.downloads >= filters.minDownloads!)
  }

  if (filters.license && filters.license.length > 0) {
    patterns = patterns.filter(p => filters.license!.includes(p.license))
  }

  if (filters.updatedAfter) {
    const afterDate = new Date(filters.updatedAfter).getTime()
    patterns = patterns.filter(p => new Date(p.lastUpdated).getTime() >= afterDate)
  }

  // Sort patterns
  const sortBy = filters.sortBy || 'trending'
  patterns = [...patterns].sort((a, b) => {
    switch (sortBy) {
      case 'trending':
        return (b.weeklyDownloads * 2 + b.stars - a.weeklyDownloads * 2 - a.stars)
      case 'recent':
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      case 'popular':
        return b.downloads - a.downloads
      case 'rating':
        return b.rating - a.rating
      case 'downloads':
        return b.downloads - a.downloads
      default:
        return 0
    }
  })

  // Apply pagination
  const offset = filters.offset || 0
  const limit = filters.limit || 50
  patterns = patterns.slice(offset, offset + limit)

  return patterns
}

/**
 * Get a specific pattern by ID
 */
export function getHubPattern(patternId: string): CommunityPattern | null {
  const patterns = getHubPatterns()
  const pattern = patterns.find(p => p.id === patternId || p.hubId === patternId)
  
  if (pattern) {
    // Increment view count
    pattern.views += 1
    saveHubPatterns(patterns)
  }

  return pattern || null
}

/**
 * Download a pattern from the hub
 */
export async function downloadPattern(patternId: string): Promise<CommunityPattern> {
  const patterns = getHubPatterns()
  const pattern = patterns.find(p => p.id === patternId || p.hubId === patternId)

  if (!pattern) {
    throw new Error('Pattern not found')
  }

  // Increment download counts
  pattern.downloads += 1
  pattern.weeklyDownloads += 1
  pattern.monthlyDownloads += 1
  saveHubPatterns(patterns)

  // Update pattern author's stats
  const author = pattern.username
  // In a real implementation, this would update the author's total downloads

  return pattern
}

/**
 * Star/unstar a pattern
 */
export function togglePatternStar(patternId: string): { starred: boolean; stars: number } {
  const patterns = getHubPatterns()
  const pattern = patterns.find(p => p.id === patternId || p.hubId === patternId)

  if (!pattern) {
    throw new Error('Pattern not found')
  }

  // Check if user has already starred
  const starredKey = `starred-${patternId}`
  const isStarred = localStorage.getItem(starredKey) === 'true'

  if (isStarred) {
    pattern.stars = Math.max(0, pattern.stars - 1)
    localStorage.removeItem(starredKey)
  } else {
    pattern.stars += 1
    localStorage.setItem(starredKey, 'true')
  }

  saveHubPatterns(patterns)

  return { starred: !isStarred, stars: pattern.stars }
}

/**
 * Fork a pattern
 */
export async function forkPattern(patternId: string, newName?: string): Promise<CommunityPattern> {
  const originalPattern = getHubPattern(patternId)
  if (!originalPattern) {
    throw new Error('Pattern not found')
  }

  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new Error('You must be logged in to fork patterns')
  }

  const forkedPattern: CommunityPattern = {
    ...originalPattern,
    id: `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    hubId: `hub-${Date.now()}`,
    name: newName || `${originalPattern.name} (Fork)`,
    author: currentUser.displayName,
    userId: currentUser.id,
    username: currentUser.username,
    userAvatar: currentUser.avatar,
    publishedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    downloads: 0,
    stars: 0,
    forks: 0,
    views: 0,
    reviews: [],
    weeklyDownloads: 0,
    monthlyDownloads: 0,
    isOfficial: false,
    isFeatured: false,
    isTrending: false
  }

  // Increment fork count on original
  const patterns = getHubPatterns()
  const originalIndex = patterns.findIndex(p => p.id === patternId)
  if (originalIndex !== -1) {
    patterns[originalIndex].forks += 1
  }

  patterns.push(forkedPattern)
  saveHubPatterns(patterns)

  return forkedPattern
}

/**
 * Submit a review for a pattern
 */
export function submitReview(patternId: string, rating: number, comment: string): PatternReview {
  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new Error('You must be logged in to submit reviews')
  }

  const review: PatternReview = {
    patternId,
    rating: Math.max(1, Math.min(5, rating)),
    comment,
    author: currentUser.displayName,
    helpful: 0,
    createdAt: new Date().toISOString()
  }

  const patterns = getHubPatterns()
  const pattern = patterns.find(p => p.id === patternId || p.hubId === patternId)

  if (!pattern) {
    throw new Error('Pattern not found')
  }

  pattern.reviews.push(review)

  // Recalculate average rating
  const totalRating = pattern.reviews.reduce((sum, r) => sum + r.rating, 0)
  pattern.rating = totalRating / pattern.reviews.length

  saveHubPatterns(patterns)

  return review
}

/**
 * Get hub statistics
 */
export function getHubStats(): HubStats {
  const patterns = getHubPatterns()

  const categoryCounts: Record<string, number> = {}
  const authorStats: Record<string, { patterns: number; downloads: number }> = {}

  patterns.forEach(pattern => {
    categoryCounts[pattern.category] = (categoryCounts[pattern.category] || 0) + 1

    if (!authorStats[pattern.username]) {
      authorStats[pattern.username] = { patterns: 0, downloads: 0 }
    }
    authorStats[pattern.username].patterns += 1
    authorStats[pattern.username].downloads += pattern.downloads
  })

  const topCategories = Object.entries(categoryCounts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const topAuthors = Object.entries(authorStats)
    .map(([username, stats]) => ({ username, ...stats }))
    .sort((a, b) => b.downloads - a.downloads)
    .slice(0, 10)

  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const patternsThisWeek = patterns.filter(
    p => new Date(p.publishedAt).getTime() >= oneWeekAgo
  ).length

  return {
    totalPatterns: patterns.length,
    totalUsers: new Set(patterns.map(p => p.userId)).size,
    totalDownloads: patterns.reduce((sum, p) => sum + p.downloads, 0),
    totalStars: patterns.reduce((sum, p) => sum + p.stars, 0),
    patternsThisWeek,
    activeUsers: new Set(patterns.filter(p =>
      new Date(p.lastUpdated).getTime() >= oneWeekAgo
    ).map(p => p.userId)).size,
    topCategories,
    topAuthors
  }
}

/**
 * Get featured patterns
 */
export function getFeaturedPatterns(limit: number = 5): CommunityPattern[] {
  const patterns = getHubPatterns()
  return patterns
    .filter(p => p.isFeatured || p.isOfficial)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit)
}

/**
 * Get trending patterns
 */
export function getTrendingPatterns(limit: number = 10): CommunityPattern[] {
  const patterns = getHubPatterns()
  return patterns
    .sort((a, b) => (b.weeklyDownloads * 2 + b.stars) - (a.weeklyDownloads * 2 + a.stars))
    .slice(0, limit)
}

/**
 * Get recent patterns
 */
export function getRecentPatterns(limit: number = 10): CommunityPattern[] {
  const patterns = getHubPatterns()
  return patterns
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, limit)
}

/**
 * Subscribe to pattern updates
 */
export function subscribeToPattern(patternId: string): void {
  const subscriptionsKey = LOCAL_HUB_SUBSCRIPTIONS_KEY
  const stored = localStorage.getItem(subscriptionsKey)
  const subscriptions: string[] = stored ? JSON.parse(stored) : []

  if (!subscriptions.includes(patternId)) {
    subscriptions.push(patternId)
    localStorage.setItem(subscriptionsKey, JSON.stringify(subscriptions))
  }
}

/**
 * Unsubscribe from pattern updates
 */
export function unsubscribeFromPattern(patternId: string): void {
  const subscriptionsKey = LOCAL_HUB_SUBSCRIPTIONS_KEY
  const stored = localStorage.getItem(subscriptionsKey)
  const subscriptions: string[] = stored ? JSON.parse(stored) : []

  const filtered = subscriptions.filter(id => id !== patternId)
  localStorage.setItem(subscriptionsKey, JSON.stringify(filtered))
}

/**
 * Check if subscribed to a pattern
 */
export function isSubscribedToPattern(patternId: string): boolean {
  const subscriptionsKey = LOCAL_HUB_SUBSCRIPTIONS_KEY
  const stored = localStorage.getItem(subscriptionsKey)
  const subscriptions: string[] = stored ? JSON.parse(stored) : []
  return subscriptions.includes(patternId)
}

/**
 * Get all subscribed patterns
 */
export function getSubscribedPatterns(): CommunityPattern[] {
  const subscriptionsKey = LOCAL_HUB_SUBSCRIPTIONS_KEY
  const stored = localStorage.getItem(subscriptionsKey)
  const subscriptions: string[] = stored ? JSON.parse(stored) : []

  const patterns = getHubPatterns()
  return patterns.filter(p => subscriptions.includes(p.id) || subscriptions.includes(p.hubId))
}

/**
 * Get patterns by a specific user
 */
export function getUserPatterns(username: string): CommunityPattern[] {
  const patterns = getHubPatterns()
  return patterns.filter(p => p.username === username)
}

/**
 * Delete a pattern (only by owner)
 */
export function deletePattern(patternId: string): boolean {
  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new Error('You must be logged in to delete patterns')
  }

  const patterns = getHubPatterns()
  const patternIndex = patterns.findIndex(p => p.id === patternId || p.hubId === patternId)

  if (patternIndex === -1) {
    throw new Error('Pattern not found')
  }

  if (patterns[patternIndex].userId !== currentUser.id) {
    throw new Error('You can only delete your own patterns')
  }

  patterns.splice(patternIndex, 1)
  saveHubPatterns(patterns)

  return true
}

/**
 * Update a pattern (only by owner)
 */
export function updatePattern(patternId: string, updates: Partial<PatternSubmission>): CommunityPattern {
  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new Error('You must be logged in to update patterns')
  }

  const patterns = getHubPatterns()
  const patternIndex = patterns.findIndex(p => p.id === patternId || p.hubId === patternId)

  if (patternIndex === -1) {
    throw new Error('Pattern not found')
  }

  if (patterns[patternIndex].userId !== currentUser.id) {
    throw new Error('You can only update your own patterns')
  }

  const updatedPattern = {
    ...patterns[patternIndex],
    ...updates,
    lastUpdated: new Date().toISOString()
  }

  patterns[patternIndex] = updatedPattern
  saveHubPatterns(patterns)

  return updatedPattern
}

/**
 * Get pattern comments
 */
export function getPatternComments(patternId: string): PatternComment[] {
  const commentsKey = `pattern-comments-${patternId}`
  const stored = localStorage.getItem(commentsKey)
  return stored ? JSON.parse(stored) : []
}

/**
 * Add a comment to a pattern
 */
export function addPatternComment(patternId: string, content: string, parentId?: string): PatternComment {
  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new Error('You must be logged in to comment')
  }

  const comment: PatternComment = {
    id: `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    patternId,
    userId: currentUser.id,
    username: currentUser.username,
    userAvatar: currentUser.avatar,
    content,
    parentId,
    replies: [],
    upvotes: 0,
    downvotes: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    edited: false
  }

  const comments = getPatternComments(patternId)
  comments.push(comment)

  const commentsKey = `pattern-comments-${patternId}`
  localStorage.setItem(commentsKey, JSON.stringify(comments))

  // Update comment count on pattern
  const patterns = getHubPatterns()
  const pattern = patterns.find(p => p.id === patternId || p.hubId === patternId)
  if (pattern) {
    pattern.comments += 1
    saveHubPatterns(patterns)
  }

  return comment
}

/**
 * Create or get a pattern collection
 */
export function createCollection(name: string, description: string): PatternCollection {
  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new Error('You must be logged in to create collections')
  }

  const collection: PatternCollection = {
    id: `collection-${Date.now()}`,
    name,
    description,
    author: currentUser.displayName,
    authorId: currentUser.id,
    patterns: [],
    followers: 0,
    isPublic: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: []
  }

  const collectionsKey = 'pattern-collections'
  const stored = localStorage.getItem(collectionsKey)
  const collections: PatternCollection[] = stored ? JSON.parse(stored) : []
  collections.push(collection)
  localStorage.setItem(collectionsKey, JSON.stringify(collections))

  return collection
}

/**
 * Add pattern to collection
 */
export function addToCollection(collectionId: string, patternId: string): void {
  const collectionsKey = 'pattern-collections'
  const stored = localStorage.getItem(collectionsKey)
  const collections: PatternCollection[] = stored ? JSON.parse(stored) : []

  const collection = collections.find(c => c.id === collectionId)
  if (!collection) {
    throw new Error('Collection not found')
  }

  if (!collection.patterns.includes(patternId)) {
    collection.patterns.push(patternId)
    collection.updatedAt = new Date().toISOString()
    localStorage.setItem(collectionsKey, JSON.stringify(collections))
  }
}

/**
 * Export pattern for sharing
 */
export function exportPatternForSharing(patternId: string): string {
  const pattern = getHubPattern(patternId)
  if (!pattern) {
    throw new Error('Pattern not found')
  }

  return JSON.stringify(pattern, null, 2)
}

/**
 * Import pattern from JSON
 */
export function importPatternFromHub(jsonString: string): CommunityPattern {
  const pattern: CommunityPattern = JSON.parse(jsonString)
  
  // Generate new IDs for imported pattern
  pattern.id = `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  pattern.hubId = `hub-${Date.now()}`
  pattern.publishedAt = new Date().toISOString()
  pattern.lastUpdated = new Date().toISOString()

  const patterns = getHubPatterns()
  patterns.push(pattern)
  saveHubPatterns(patterns)

  return pattern
}
