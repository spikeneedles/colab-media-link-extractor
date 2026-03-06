/**
 * Firebase Admin Service
 * 
 * Handles server-side Firebase operations using the Firebase Admin SDK
 * Used for pushing playlist updates to Firestore for mobile app consumption
 */

import * as admin from 'firebase-admin'
import { getFirestore, Firestore, FieldValue } from 'firebase-admin/firestore'
import * as path from 'path'
import * as fs from 'fs'

export interface PlaylistUpdate {
  category: string
  playlistUrl: string
  itemCount: number
  lastUpdated: number
  fileSize: number
  hash: string
}

export class FirebaseAdminService {
  private app: admin.app.App | null = null
  private db: Firestore | null = null
  private enabled: boolean = false

  constructor() {
    this.initialize()
  }

  /**
   * Initialize Firebase Admin SDK
   */
  private initialize() {
    try {
      // Look for service account key in multiple locations
      const possiblePaths = [
        path.join(process.cwd(), 'firebase-service-account.json'),
        path.join(process.cwd(), '..', 'firebase-service-account.json'),
        process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '',
      ].filter(Boolean)

      let serviceAccountPath: string | null = null
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          serviceAccountPath = p
          break
        }
      }

      if (!serviceAccountPath) {
        console.warn('⚠️  Firebase Admin: No service account key found. Playlist push disabled.')
        console.warn('   To enable: Place firebase-service-account.json in backend/ or set FIREBASE_SERVICE_ACCOUNT_PATH')
        return
      }

      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))

      this.app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
      })

      this.db = getFirestore(this.app)
      this.enabled = true
      console.log('✓ Firebase Admin SDK initialized successfully')
    } catch (error: any) {
      console.error('❌ Firebase Admin initialization failed:', error.message)
      console.warn('   Playlist push to mobile app will be disabled')
    }
  }

  /**
   * Check if Firebase is enabled and ready
   */
  isEnabled(): boolean {
    return this.enabled && this.db !== null
  }

  /**
   * Push playlist update to Firestore
   */
  async pushPlaylistUpdate(update: PlaylistUpdate): Promise<boolean> {
    if (!this.isEnabled() || !this.db) {
      console.warn('Firebase not enabled, skipping playlist push')
      return false
    }

    try {
      const docRef = this.db.collection('playlists').doc(update.category)
      
      await docRef.set({
        ...update,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true })

      console.log(`✓ Pushed ${update.category} playlist to Firestore (${update.itemCount} items)`)
      return true
    } catch (error: any) {
      console.error(`❌ Failed to push ${update.category} playlist:`, error.message)
      return false
    }
  }

  /**
   * Push all master playlists
   */
  async pushAllPlaylists(updates: PlaylistUpdate[]): Promise<number> {
    if (!this.isEnabled()) {
      return 0
    }

    const results = await Promise.allSettled(
      updates.map(update => this.pushPlaylistUpdate(update))
    )

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value === true).length
    console.log(`✓ Pushed ${successCount}/${updates.length} playlists to Firestore`)
    return successCount
  }

  /**
   * Send notification to all devices about playlist updates
   */
  async notifyPlaylistUpdate(categories: string[]): Promise<void> {
    if (!this.isEnabled() || !this.db) {
      return
    }

    try {
      // Create a notification document that the app will listen to
      await this.db.collection('notifications').add({
        type: 'playlist_update',
        categories,
        timestamp: FieldValue.serverTimestamp(),
        read: false,
      })

      console.log(`✓ Sent playlist update notification for: ${categories.join(', ')}`)
    } catch (error: any) {
      console.error('❌ Failed to send notification:', error.message)
    }
  }

  /**
   * Get playlist metadata
   */
  async getPlaylistMetadata(category: string): Promise<any | null> {
    if (!this.isEnabled() || !this.db) {
      return null
    }

    try {
      const doc = await this.db.collection('playlists').doc(category).get()
      return doc.exists ? doc.data() : null
    } catch (error: any) {
      console.error(`Failed to get playlist metadata for ${category}:`, error.message)
      return null
    }
  }

  /**
   * Cleanup old notifications (keep last 100)
   */
  async cleanupNotifications(): Promise<void> {
    if (!this.isEnabled() || !this.db) {
      return
    }

    try {
      const snapshot = await this.db
        .collection('notifications')
        .orderBy('timestamp', 'desc')
        .offset(100)
        .get()

      const batch = this.db.batch()
      snapshot.docs.forEach((doc: admin.firestore.QueryDocumentSnapshot) => batch.delete(doc.ref))
      await batch.commit()

      if (snapshot.size > 0) {
        console.log(`✓ Cleaned up ${snapshot.size} old notifications`)
      }
    } catch (error: any) {
      console.error('Failed to cleanup notifications:', error.message)
    }
  }
}

// Singleton instance
export const firebaseAdmin = new FirebaseAdminService()
