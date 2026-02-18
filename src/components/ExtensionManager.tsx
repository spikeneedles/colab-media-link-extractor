import React, { useState, useEffect } from 'react'
import {
  Plug,
  Radio,
  Link,
  Zap,
  Trash2,
  Play,
  Download,
  Settings,
  Loader,
  Check,
  AlertCircle,
  Copy,
  Globe,
  TrendingUp,
} from 'lucide-react'
import useExtensionBridge from '../hooks/useExtensionBridge'
import useAutoCrawler from '../hooks/useAutoCrawler'
import MockMediaPlayer from './MockMediaPlayer'

export function ExtensionManager() {
  const bridge = useExtensionBridge()
  const crawler = useAutoCrawler()
  const [isInitializing, setIsInitializing] = useState(false)
  const [expandedSession, setExpandedSession] = useState<string | null>(null)
  const [mockUrl, setMockUrl] = useState('')
  const [mockTitle, setMockTitle] = useState('Test Video')
  const [showMockPlayer, setShowMockPlayer] = useState(false)
  const [selectedMedia, setSelectedMedia] = useState<Set<string>>(new Set())
  const [activeCrawl, setActiveCrawl] = useState<string | null>(null)
  const [crawlCleanup, setCrawlCleanup] = useState<(() => void) | null>(null)

  // Initialize extension bridge on mount
  useEffect(() => {
    const init = async () => {
      setIsInitializing(true)
      try {
        await bridge.registerExtension('Media Link Extractor')
      } catch (err) {
        console.error('Failed to initialize bridge:', err)
      } finally {
        setIsInitializing(false)
      }
    }

    init()

    return () => {
      bridge.disconnect()
      if (crawlCleanup) {
        crawlCleanup()
      }
    }
  }, [])

  const handleCaptureMock = async () => {
    if (mockUrl) {
      const result = await fetch('/api/extension/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: bridge.sessionId,
          url: mockUrl,
          title: mockTitle,
        }),
      }).then((r) => r.json())

      if (result.success && result.crawlSessionId) {
        // Start polling crawl status
        setActiveCrawl(result.crawlSessionId)
        const cleanup = crawler.startPolling(result.crawlSessionId, 2000)
        setCrawlCleanup(() => cleanup)
      }

      setMockUrl('')
      setMockTitle('Test Video')
      setShowMockPlayer(false)

      // Refresh media list
      await bridge.fetchAllMedia()
    }
  }

  const handleProcessMedia = async (mediaId: string) => {
    const result = await bridge.processMedia(mediaId)
    if (result) {
      alert(`Ready to process with crawlers:\n${result.media.url}`)
    }
  }

  const handleDeleteMedia = (mediaId: string) => {
    // This would need a delete endpoint
    setSelectedMedia((prev) => {
      const next = new Set(prev)
      next.delete(mediaId)
      return next
    })
  }

  const uniqueDomains = new Set(
    bridge.capturedMedia.map((m) => {
      try {
        return new URL(m.url).hostname
      } catch {
        return 'unknown'
      }
    })
  ).size

  return (
    <div className="min-h-screen bg-linear-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-neutral-900 dark:text-white mb-2 flex items-center gap-3">
              <Plug className="w-8 h-8 text-indigo-600" />
              Extension Manager
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400">
              Connect extensions and capture media streams for processing
            </p>
          </div>

          {bridge.isConnected && (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Connected
            </div>
          )}
        </div>

        {/* Connection Status */}
        {bridge.error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900 dark:text-red-300">Error</p>
              <p className="text-sm text-red-800 dark:text-red-400">{bridge.error}</p>
            </div>
          </div>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 border border-neutral-200 dark:border-neutral-700">
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">Active Sessions</p>
            <p className="text-3xl font-bold text-neutral-900 dark:text-white">
              {bridge.stats.sessionsActive}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
              Total sessions: {bridge.stats.totalCaptured}
            </p>
          </div>

          <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 border border-neutral-200 dark:border-neutral-700">
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">Media Captured</p>
            <p className="text-3xl font-bold text-neutral-900 dark:text-white">
              {bridge.stats.totalCaptured}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
              From {uniqueDomains} domain{uniqueDomains !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Auto-Crawl Status */}
        {crawler.crawlStatus && (
          <div className="bg-linear-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-600" />
                Domain Crawl in Progress
              </h3>
              {crawler.crawlStatus.status === 'crawling' && (
                <button
                  onClick={() => {
                    if (activeCrawl) {
                      crawler.cancelCrawl(activeCrawl)
                    }
                  }}
                  className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition"
                >
                  Cancel
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-2">
                  Crawling: <span className="font-semibold">{crawler.crawlStatus.domain}</span>
                </p>
                <div className="w-full bg-neutral-300 dark:bg-neutral-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-linear-to-r from-blue-500 to-cyan-500 h-full transition-all duration-500"
                    style={{ width: `${crawler.crawlStatus.progress}%` }}
                  />
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                  {crawler.crawlStatus.progress}% complete
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400">URLs Found</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {crawler.crawlStatus.discoveredUrls}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400">Media Links</p>
                  <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                    {crawler.crawlStatus.mediaLinksFound}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400">Pages Processed</p>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {crawler.crawlStatus.pagesProcessed}
                  </p>
                </div>
              </div>

              {crawler.crawlStatus.status === 'completed' && (
                <div className="bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-800 rounded p-3 flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Crawl completed! Found {crawler.mediaLinks.length} unique media links.
                  </p>
                </div>
              )}

              {crawler.crawlStatus.error && (
                <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded p-3 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  <p className="text-sm text-red-700 dark:text-red-300">{crawler.crawlStatus.error}</p>
                </div>
              )}
            </div>

            {/* Discovered Media Links */}
            {crawler.mediaLinks.length > 0 && (
              <div className="mt-6 pt-6 border-t border-blue-200 dark:border-blue-800">
                <h4 className="text-sm font-semibold text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Discovered Media Links ({crawler.mediaLinks.length})
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {crawler.mediaLinks.slice(0, 10).map((link, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 p-2 bg-white dark:bg-neutral-800 rounded border border-neutral-200 dark:border-neutral-700 text-xs"
                    >
                      <code className="text-neutral-600 dark:text-neutral-400 truncate flex-1">
                        {link.url}
                      </code>
                      <button
                        onClick={() => navigator.clipboard.writeText(link.url)}
                        className="p-1 bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded transition shrink-0"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {crawler.mediaLinks.length > 10 && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center p-2">
                      +{crawler.mediaLinks.length - 10} more links...
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mock Player Section */}
        {!showMockPlayer ? (
          <button
            onClick={() => setShowMockPlayer(true)}
            className="w-full bg-linear-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition mb-8 flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5" />
            Launch Mock Media Player
          </button>
        ) : (
          <div className="mb-8 p-6 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Mock Player</h3>
              <button
                onClick={() => setShowMockPlayer(false)}
                className="text-neutral-500 hover:text-neutral-700"
              >
                ✕
              </button>
            </div>

            <MockMediaPlayer
              url={mockUrl}
              title={mockTitle}
              isExtensionConnected={bridge.isConnected}
              onMediaCapture={async (mediaData) => {
                const result = await bridge.captureMedia(
                  mediaData.url,
                  mediaData.title
                )
                if (result) {
                  setTimeout(() => bridge.fetchAllMedia(), 500)
                }
              }}
            />

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Media URL
                </label>
                <input
                  type="text"
                  value={mockUrl}
                  onChange={(e) => setMockUrl(e.target.value)}
                  placeholder="https://example.com/video.m3u8"
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={mockTitle}
                  onChange={(e) => setMockTitle(e.target.value)}
                  placeholder="Video title"
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={handleCaptureMock}
                disabled={!mockUrl}
                className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:bg-neutral-400 transition"
              >
                Capture & Send to Bridge
              </button>
            </div>
          </div>
        )}

        {/* Sessions */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
            <Radio className="w-6 h-6 text-indigo-600" />
            Connected Sessions
          </h2>

          {bridge.sessions.length === 0 ? (
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-8 border border-neutral-200 dark:border-neutral-700 text-center">
              <Plug className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
              <p className="text-neutral-600 dark:text-neutral-400">
                No extensions connected yet. Install the browser extension to capture media streams.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {bridge.sessions.map((session) => (
                <div
                  key={session.id}
                  className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden"
                >
                  <div
                    className="p-4 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition flex items-center justify-between"
                    onClick={() =>
                      setExpandedSession(expandedSession === session.id ? null : session.id)
                    }
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          session.isAlive
                            ? 'bg-green-500 animate-pulse'
                            : 'bg-neutral-400'
                        }`}
                      />
                      <div>
                        <p className="font-semibold text-neutral-900 dark:text-white">
                          {session.name}
                        </p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          {session.capturedCount} media items captured
                        </p>
                      </div>
                    </div>
                    <span className="text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-full">
                      {session.isAlive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {expandedSession === session.id && (
                    <div className="bg-neutral-50 dark:bg-neutral-700/50 border-t border-neutral-200 dark:border-neutral-700 p-4">
                      <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-2">
                        Connected: {new Date(session.connectedAt).toLocaleString()}
                      </p>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400">
                        Last active: {new Date(session.lastHeartbeat).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Captured Media */}
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
            <Link className="w-6 h-6 text-indigo-600" />
            Captured Media
          </h2>

          {bridge.capturedMedia.length === 0 ? (
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-8 border border-neutral-200 dark:border-neutral-700 text-center">
              <Zap className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
              <p className="text-neutral-600 dark:text-neutral-400">
                No media captured yet. Extensions will send captured URLs here.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {bridge.capturedMedia.slice(0, 20).map((media) => (
                <div
                  key={media.id}
                  className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700 hover:shadow-lg transition"
                >
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={selectedMedia.has(media.id)}
                      onChange={(e) => {
                        const next = new Set(selectedMedia)
                        if (e.target.checked) {
                          next.add(media.id)
                        } else {
                          next.delete(media.id)
                        }
                        setSelectedMedia(next)
                      }}
                      className="mt-1 w-4 h-4"
                    />

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-neutral-900 dark:text-white truncate">
                        {media.title || 'Untitled'}
                      </p>
                      <code className="text-xs text-neutral-600 dark:text-neutral-400 break-all block mt-1">
                        {media.url}
                      </code>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                        {new Date(media.timestamp).toLocaleString()}
                        {media.sessionName && ` • From: ${media.sessionName}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleProcessMedia(media.id)}
                        className="p-2 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 rounded hover:bg-indigo-200 dark:hover:bg-indigo-800 transition"
                        title="Process with Crawler"
                      >
                        <Zap className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => navigator.clipboard.writeText(media.url)}
                        className="p-2 bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 rounded hover:bg-neutral-200 dark:hover:bg-neutral-600 transition"
                        title="Copy URL"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteMedia(media.id)}
                        className="p-2 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/40 transition"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {bridge.capturedMedia.length > 20 && (
                <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center p-4">
                  Showing 20 of {bridge.capturedMedia.length} items
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ExtensionManager
