import { useState, useEffect, useCallback } from 'react'

interface CrawlStatus {
  status: 'pending' | 'crawling' | 'completed' | 'error'
  progress: number
  domain: string
  discoveredUrls: number
  mediaLinksFound: number
  pagesProcessed: number
  startedAt: Date
  completedAt?: Date
  error?: string
}

interface MediaLink {
  url: string
  sourceUrl?: string
  title?: string
}

export const useAutoCrawler = () => {
  const [crawlStatus, setCrawlStatus] = useState<CrawlStatus | null>(null)
  const [mediaLinks, setMediaLinks] = useState<MediaLink[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pollCrawlStatus = useCallback(async (crawlSessionId: string) => {
    try {
      const response = await fetch(`/api/extension/crawl/${crawlSessionId}`)
      const data = await response.json()

      if (data.success) {
        setCrawlStatus({
          status: data.status,
          progress: data.progress,
          domain: data.domain,
          discoveredUrls: data.discoveredUrls,
          mediaLinksFound: data.mediaLinksFound,
          pagesProcessed: data.pagesProcessed,
          startedAt: new Date(data.startedAt),
          completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
          error: data.error,
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get crawl status')
    }
  }, [])

  const fetchMediaLinks = useCallback(async (crawlSessionId: string, limit = 100, offset = 0) => {
    try {
      const url = new URL('/api/extension/crawl/' + crawlSessionId + '/results', window.location.origin)
      url.searchParams.set('limit', limit.toString())
      url.searchParams.set('offset', offset.toString())

      const response = await fetch(url.toString())
      const data = await response.json()

      if (data.success) {
        setMediaLinks(
          data.mediaLinks.map((link: string) => ({
            url: link,
          }))
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch media links')
    }
  }, [])

  const startPolling = useCallback((crawlSessionId: string, interval = 2000) => {
    setIsLoading(true)
    const pollInterval = setInterval(async () => {
      await pollCrawlStatus(crawlSessionId)

      const newStatus = await fetch(`/api/extension/crawl/${crawlSessionId}`)
        .then((r) => r.json())

      if (newStatus.status === 'completed' || newStatus.status === 'error') {
        clearInterval(pollInterval)
        setIsLoading(false)
        // Fetch final results
        await fetchMediaLinks(crawlSessionId)
      }
    }, interval)

    // Initial poll
    pollCrawlStatus(crawlSessionId)

    return () => clearInterval(pollInterval)
  }, [pollCrawlStatus, fetchMediaLinks])

  const cancelCrawl = useCallback(async (crawlSessionId: string) => {
    try {
      const response = await fetch(`/api/extension/crawl/${crawlSessionId}/cancel`, {
        method: 'POST',
      })
      const data = await response.json()

      if (data.success) {
        setError(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel crawl')
    }
  }, [])

  return {
    crawlStatus,
    mediaLinks,
    isLoading,
    error,
    pollCrawlStatus,
    fetchMediaLinks,
    startPolling,
    cancelCrawl,
    setCrawlStatus,
    setMediaLinks,
    setError,
  }
}

export default useAutoCrawler
