/**
 * Media Link Extractor - Content Script
 * Runs on every page and captures video elements
 */

class ContentScriptBridge {
  constructor() {
    this.observedElements = new Set()
    this.capturedUrls = new Set()
  }

  async init() {
    console.log('[MLE] Content script loaded')

    // Capture existing video elements
    this.captureVideoElements()

    // Watch for new video elements
    this.observeDOMChanges()

    // Capture from network requests (if available)
    this.interceptMediaRequests()
  }

  /**
   * Capture URLs from existing video elements
   */
  captureVideoElements() {
    // Video elements with source tags
    document.querySelectorAll('video').forEach((video) => {
      this.processVideoElement(video)
    })

    // Video in iframes
    document.querySelectorAll('iframe').forEach((iframe) => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
        if (iframeDoc) {
          iframeDoc.querySelectorAll('video').forEach((video) => {
            this.processVideoElement(video)
          })
        }
      } catch (e) {
        // Cross-origin iframe, skip
      }
    })

    // Look for streaming URLs in data attributes
    document.querySelectorAll('[data-src], [data-url], [data-stream]').forEach((el) => {
      const url = el.dataset.src || el.dataset.url || el.dataset.stream
      if (url && this.isMediaUrl(url)) {
        this.captureUrl(url, el.textContent || 'Media Stream')
      }
    })
  }

  /**
   * Process a video element
   */
  processVideoElement(video) {
    if (this.observedElements.has(video)) return

    this.observedElements.add(video)

    // Check for source children
    video.querySelectorAll('source').forEach((source) => {
      if (source.src) {
        this.captureUrl(source.src, video.title || document.title)
      }
    })

    // Check src attribute
    if (video.src) {
      this.captureUrl(video.src, video.title || document.title)
    }

    // Watch for changes
    const observer = new MutationObserver(() => {
      video.querySelectorAll('source').forEach((source) => {
        if (source.src) {
          this.captureUrl(source.src, video.title || document.title)
        }
      })
    })

    observer.observe(video, {
      childList: true,
      attributes: true,
      attributeFilter: ['src'],
    })

    // Intercept play event
    video.addEventListener(
      'play',
      () => {
        if (video.src) {
          this.captureUrl(video.src, video.title || document.title)
        }
      },
      true
    )
  }

  /**
   * Observe DOM for new elements
   */
  observeDOMChanges() {
    const observer = new MutationObserver(() => {
      this.captureVideoElements()
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    // Also check periodically
    setInterval(() => this.captureVideoElements(), 5000)
  }

  /**
   * Try to intercept media requests
   */
  interceptMediaRequests() {
    // Hook into XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open
    XMLHttpRequest.prototype.open = function (method, url, ...args) {
      if (typeof url === 'string' && this.isMediaUrl?.(url)) {
        // Let parent know about the request
        window.postMessage(
          {
            type: 'MEDIA_REQUEST',
            url,
            method,
            source: 'xhr',
          },
          '*'
        )
      }
      return originalXHROpen.apply(this, [method, url, ...args])
    }

    // Hook into fetch
    const originalFetch = window.fetch
    window.fetch = function (url, options) {
      if (typeof url === 'string' && this.isMediaUrl?.(url)) {
        window.postMessage(
          {
            type: 'MEDIA_REQUEST',
            url,
            method: options?.method || 'GET',
            source: 'fetch',
          },
          '*'
        )
      }
      return originalFetch.apply(this, arguments)
    }

    // Listen for messages from page
    window.addEventListener('message', (event) => {
      if (event.data.type === 'MEDIA_REQUEST') {
        this.captureUrl(event.data.url, document.title, {
          source: event.data.source,
        })
      }
    })
  }

  /**
   * Check if URL is likely a media URL
   */
  isMediaUrl(url) {
    if (typeof url !== 'string') return false

    const mediaPatterns = [
      '.m3u8',
      '.m3u',
      '.ts',
      '.mp4',
      '.mkv',
      '.webm',
      '.avi',
      '.mov',
      '.flv',
      'stream',
      'video',
      'live',
      'hls',
      'dash',
      'rtmp',
      'playlist',
    ]

    return mediaPatterns.some((pattern) => url.toLowerCase().includes(pattern))
  }

  /**
   * Capture a URL
   */
  captureUrl(url, title = 'Media', metadata = {}) {
    if (!url || this.capturedUrls.has(url)) return

    try {
      new URL(url) // Validate URL
    } catch {
      return // Invalid URL
    }

    this.capturedUrls.add(url)

    // Send to background script
    chrome.runtime.sendMessage(
      {
        type: 'CAPTURE_MEDIA',
        url,
        title,
        metadata: {
          hostname: window.location.hostname,
          pathname: window.location.pathname,
          ...metadata,
        },
      },
      (response) => {
        if (response?.success) {
          console.log('[MLE] Captured:', url)
        }
      }
    )
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const bridge = new ContentScriptBridge()
    bridge.init()
  })
} else {
  const bridge = new ContentScriptBridge()
  bridge.init()
}
