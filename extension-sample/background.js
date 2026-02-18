/**
 * Media Link Extractor - Background Service Worker
 * Handles extension registration and communication with web app
 */

const WEB_APP_URL = 'http://localhost:5173' // Change to your web app URL
const API_BASE = `${WEB_APP_URL}/api/extension`

class MediaLinkBridge {
  constructor() {
    this.sessionId = null
    this.isConnected = false
    this.capturedUrls = new Set()
    this.heartbeatInterval = null
  }

  /**
   * Initialize the bridge on extension install
   */
  async init() {
    console.log('[MLE] Initializing extension bridge...')

    // Load saved session ID
    const stored = await chrome.storage.local.get('sessionId')
    if (stored.sessionId) {
      this.sessionId = stored.sessionId
      console.log('[MLE] Using stored session ID:', this.sessionId)
      this.startHeartbeat()
    } else {
      // Register new session
      await this.register()
    }

    // Setup listeners
    this.setupListeners()
  }

  /**
   * Register extension with web app
   */
  async register() {
    try {
      const response = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extensionId: chrome.runtime.id,
          name: 'Chrome Media Extractor Extension',
        }),
      })

      if (!response.ok) throw new Error('Registration failed')

      const data = await response.json()
      this.sessionId = data.sessionId
      this.isConnected = true

      // Save session ID
      await chrome.storage.local.set({ sessionId: this.sessionId })

      console.log('[MLE] Extension registered:', this.sessionId)
      this.startHeartbeat()

      // Notify popup
      chrome.runtime.sendMessage({
        type: 'CONNECTION_STATUS',
        connected: true,
      }).catch(() => {})
    } catch (error) {
      console.error('[MLE] Registration error:', error)
      this.isConnected = false
    }
  }

  /**
   * Send heartbeat to keep session alive
   */
  startHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval)

    this.heartbeatInterval = setInterval(() => {
      fetch(`${API_BASE}/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: this.sessionId }),
      })
        .then(() => {
          this.isConnected = true
        })
        .catch((error) => {
          console.warn('[MLE] Heartbeat failed:', error)
          this.isConnected = false
        })
    }, 15000) // Every 15 seconds
  }

  /**
   * Capture media URL
   */
  async captureMedia(url, title, metadata = {}) {
    if (!this.sessionId) {
      console.warn('[MLE] Not connected, registering...')
      await this.register()
    }

    // Avoid duplicates
    if (this.capturedUrls.has(url)) {
      return
    }

    try {
      const response = await fetch(`${API_BASE}/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          url,
          title,
          metadata: {
            ...metadata,
            capturedAt: new Date().toISOString(),
            extensionId: chrome.runtime.id,
          },
        }),
      })

      if (!response.ok) throw new Error('Capture failed')

      const data = await response.json()
      this.capturedUrls.add(url)

      console.log('[MLE] Media captured:', data.mediaId)

      // Notify popup
      chrome.runtime.sendMessage({
        type: 'MEDIA_CAPTURED',
        mediaId: data.mediaId,
        url,
        title,
      }).catch(() => {})

      return data.mediaId
    } catch (error) {
      console.error('[MLE] Capture error:', error)
    }
  }

  /**
   * Setup event listeners
   */
  setupListeners() {
    // Listen for messages from content scripts and popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'CAPTURE_MEDIA') {
        this.captureMedia(request.url, request.title, request.metadata)
          .then((mediaId) => sendResponse({ success: true, mediaId }))
          .catch((error) => sendResponse({ success: false, error: error.message }))
        return true // Keep channel open for async response
      }

      if (request.type === 'GET_STATUS') {
        sendResponse({
          connected: this.isConnected,
          sessionId: this.sessionId,
          capturedCount: this.capturedUrls.size,
        })
      }
    })

    // Intercept fetch requests for media URLs
    chrome.webRequest?.onBeforeRequest?.addListener?.(
      (details) => {
        const url = details.url
        if (
          url.includes('.m3u8') ||
          url.includes('.ts') ||
          url.includes('.mp4') ||
          url.includes('stream') ||
          url.includes('video')
        ) {
          this.captureMedia(url, `Stream from ${new URL(url).hostname}`, {
            type: 'network-intercept',
            method: details.method,
            tabId: details.tabId,
          }).catch(console.warn)
        }
      },
      { urls: ['<all_urls>'] }
    )
  }

  /**
   * Get stats
   */
  async getStats() {
    return {
      connected: this.isConnected,
      sessionId: this.sessionId,
      capturedCount: this.capturedUrls.size,
      webAppUrl: WEB_APP_URL,
    }
  }
}

// Initialize bridge
const bridge = new MediaLinkBridge()

chrome.runtime.onInstalled.addListener(() => {
  console.log('[MLE] Extension installed, initializing...')
  bridge.init()
})

// Reinit on startup
chrome.runtime.onStartup?.addListener(() => {
  console.log('[MLE] Chrome started, reinitializing...')
  bridge.init()
})
