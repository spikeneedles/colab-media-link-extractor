import React, { useState, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { ScrollArea } from './ui/scroll-area'
import { Separator } from './ui/separator'
import { 
  autoScrapeRepository, 
  batchDetectAndScrape,
  detectMediaSourceRepository,
  generateRepositoryReport,
  exportRepositoryMetadata,
  type DetectedRepository,
  type AutoScrapeResult 
} from '../lib/repositoryDetector'
import { Download, Search, Loader2, CheckCircle, XCircle, AlertCircle, FileText, Link2 } from 'lucide-react'

export function RepositoryAutoScraper() {
  const [mediaUrls, setMediaUrls] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentStatus, setCurrentStatus] = useState('')
  const [results, setResults] = useState<Map<string, AutoScrapeResult>>(new Map())
  const [detectedRepo, setDetectedRepo] = useState<DetectedRepository | null>(null)
  const [allExtractedLinks, setAllExtractedLinks] = useState<string[]>([])

  const handleDetectOnly = useCallback(() => {
    const urls = mediaUrls.split('\n').filter(url => url.trim())
    if (urls.length === 0) return

    const firstUrl = urls[0].trim()
    const detected = detectMediaSourceRepository(firstUrl)
    setDetectedRepo(detected)
  }, [mediaUrls])

  const handleAutoScrape = useCallback(async () => {
    const urls = mediaUrls.split('\n').filter(url => url.trim())
    if (urls.length === 0) return

    setIsProcessing(true)
    setProgress(0)
    setResults(new Map())
    setAllExtractedLinks([])
    setCurrentStatus('Starting auto-scrape...')

    try {
      const scrapeResults = await batchDetectAndScrape(
        urls,
        (index, total, currentUrl, status) => {
          const percent = Math.floor((index / total) * 100)
          setProgress(percent)
          setCurrentStatus(`[${index + 1}/${total}] ${currentUrl.substring(0, 50)}... - ${status}`)
        }
      )

      setResults(scrapeResults)

      // Aggregate all extracted links
      const allLinks: string[] = []
      scrapeResults.forEach(result => {
        allLinks.push(...result.allMediaLinks)
      })
      setAllExtractedLinks(Array.from(new Set(allLinks)))

      setCurrentStatus(`Complete! Found ${scrapeResults.size} repositories with ${allLinks.length} total media links`)
      setProgress(100)
    } catch (error) {
      setCurrentStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsProcessing(false)
    }
  }, [mediaUrls])

  const handleExportReport = useCallback(() => {
    if (results.size === 0) return

    const reports: string[] = []
    results.forEach(result => {
      reports.push(generateRepositoryReport(result))
      reports.push('\n\n')
    })

    const blob = new Blob([reports.join('')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `repository-scrape-report-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [results])

  const handleExportMetadata = useCallback(() => {
    if (results.size === 0) return

    const metadata = exportRepositoryMetadata(results)
    const blob = new Blob([metadata], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `repository-metadata-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [results])

  const handleExportLinks = useCallback(() => {
    if (allExtractedLinks.length === 0) return

    const blob = new Blob([allExtractedLinks.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `extracted-media-links-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [allExtractedLinks])

  const handleExportM3U = useCallback(() => {
    if (allExtractedLinks.length === 0) return

    const m3uContent = ['#EXTM3U']
    
    results.forEach((result, repoUrl) => {
      m3uContent.push(`\n#EXTINF:-1 group-title="Repository: ${result.detectedRepo.type}",${repoUrl}`)
      result.allMediaLinks.forEach(link => {
        m3uContent.push(`#EXTINF:-1,${link.split('/').pop() || 'Media'}`)
        m3uContent.push(link)
      })
    })

    const blob = new Blob([m3uContent.join('\n')], { type: 'audio/x-mpegurl' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `auto-scraped-media-${Date.now()}.m3u`
    a.click()
    URL.revokeObjectURL(url)
  }, [allExtractedLinks, results])

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Repository Auto-Scraper
            </CardTitle>
            <CardDescription>
              Automatically detect source repositories from media URLs and scrape all media
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Media URLs (one per line)</label>
          <Textarea
            value={mediaUrls}
            onChange={(e) => setMediaUrls(e.target.value)}
            placeholder="https://raw.githubusercontent.com/user/repo/main/playlist.m3u&#10;https://gitlab.com/user/repo/-/raw/main/streams.m3u8&#10;https://example.com/media/channels.m3u"
            rows={6}
            className="font-mono text-sm"
            disabled={isProcessing}
          />
          <p className="text-xs text-muted-foreground">
            Paste media URLs and the system will detect their source repositories, then automatically scrape all media files
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={handleDetectOnly}
            disabled={isProcessing || !mediaUrls.trim()}
            variant="outline"
            size="sm"
          >
            <Search className="w-4 h-4 mr-2" />
            Detect Repository (First URL)
          </Button>
          <Button
            onClick={handleAutoScrape}
            disabled={isProcessing || !mediaUrls.trim()}
            size="sm"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Search className="w-4 h-4 mr-2" />
            )}
            Auto-Scrape All Repositories
          </Button>
          
          {results.size > 0 && (
            <>
              <Button onClick={handleExportReport} variant="outline" size="sm">
                <FileText className="w-4 h-4 mr-2" />
                Export Report
              </Button>
              <Button onClick={handleExportMetadata} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export Metadata (JSON)
              </Button>
              <Button onClick={handleExportLinks} variant="outline" size="sm">
                <Link2 className="w-4 h-4 mr-2" />
                Export Links
              </Button>
              <Button onClick={handleExportM3U} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export M3U Playlist
              </Button>
            </>
          )}
        </div>

        {/* Progress */}
        {isProcessing && (
          <div className="space-y-2">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-muted-foreground">{currentStatus}</p>
          </div>
        )}

        {/* Detection Result (single URL) */}
        {detectedRepo && !isProcessing && results.size === 0 && (
          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Detected Repository
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="font-semibold">Repository URL:</div>
                <div className="font-mono text-xs break-all">{detectedRepo.url}</div>
                
                <div className="font-semibold">Type:</div>
                <Badge variant="outline">{detectedRepo.type.toUpperCase()}</Badge>
                
                <div className="font-semibold">Confidence:</div>
                <Badge 
                  variant={
                    detectedRepo.confidence === 'high' ? 'default' : 
                    detectedRepo.confidence === 'medium' ? 'secondary' : 
                    'outline'
                  }
                >
                  {detectedRepo.confidence.toUpperCase()}
                </Badge>
                
                <div className="font-semibold">Reason:</div>
                <div className="text-xs">{detectedRepo.reason}</div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {results.size > 0 && !isProcessing && (
          <div className="space-y-4">
            <Separator />
            
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                Scrape Results ({results.size} {results.size === 1 ? 'repository' : 'repositories'})
              </h3>
              <Badge variant="outline" className="text-base">
                {allExtractedLinks.length} Total Media Links
              </Badge>
            </div>

            <ScrollArea className="h-[400px] rounded-md border p-4">
              <div className="space-y-6">
                {Array.from(results.entries()).map(([repoUrl, result], index) => (
                  <Card key={repoUrl} className="border-2">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-base flex items-center gap-2">
                            {result.error ? (
                              <XCircle className="w-4 h-4 text-red-500" />
                            ) : (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            )}
                            Repository #{index + 1}
                          </CardTitle>
                          <CardDescription className="font-mono text-xs break-all">
                            {repoUrl}
                          </CardDescription>
                        </div>
                        <Badge variant="outline">{result.detectedRepo.type.toUpperCase()}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="font-semibold">Confidence:</span>{' '}
                          <Badge 
                            variant={
                              result.detectedRepo.confidence === 'high' ? 'default' : 
                              result.detectedRepo.confidence === 'medium' ? 'secondary' : 
                              'outline'
                            }
                            className="ml-1"
                          >
                            {result.detectedRepo.confidence}
                          </Badge>
                        </div>
                        <div>
                          <span className="font-semibold">Media Found:</span>{' '}
                          <span className="text-blue-600 dark:text-blue-400 font-bold">
                            {result.allMediaLinks.length}
                          </span>
                        </div>
                      </div>

                      {result.scrapeResult && (
                        <div className="text-xs text-muted-foreground">
                          {'platform' in result.scrapeResult ? (
                            <div>
                              <span className="font-semibold">Repository:</span> {result.scrapeResult.owner}/{result.scrapeResult.repoName} | 
                              <span className="ml-2 font-semibold">Files Scanned:</span> {result.scrapeResult.filesScanned} | 
                              <span className="ml-2 font-semibold">Videos:</span> {result.scrapeResult.videoLinks} | 
                              <span className="ml-2 font-semibold">Audio:</span> {result.scrapeResult.audioLinks}
                            </div>
                          ) : (
                            <div>
                              <span className="font-semibold">Type:</span> {result.scrapeResult.target.type} | 
                              <span className="ml-2 font-semibold">Files Scanned:</span> {result.scrapeResult.filesScanned} | 
                              <span className="ml-2 font-semibold">Status:</span> {result.scrapeResult.status}
                            </div>
                          )}
                        </div>
                      )}

                      {result.error && (
                        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 p-2 rounded">
                          <span className="font-semibold">Error:</span> {result.error}
                        </div>
                      )}

                      {result.allMediaLinks.length > 0 && (
                        <details className="text-xs">
                          <summary className="cursor-pointer font-semibold hover:text-blue-600">
                            View {result.allMediaLinks.length} Media Links
                          </summary>
                          <ScrollArea className="h-32 mt-2">
                            <ul className="space-y-1 pl-4 font-mono">
                              {result.allMediaLinks.map((link, i) => (
                                <li key={i} className="truncate">
                                  {i + 1}. {link}
                                </li>
                              ))}
                            </ul>
                          </ScrollArea>
                        </details>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Documentation */}
        <Separator />
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>How it works:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Paste media URLs (M3U, M3U8, or direct media links)</li>
            <li>System detects the source repository (GitHub, GitLab, Bitbucket, Codeberg, Gitea, or web)</li>
            <li>Automatically scrapes the entire repository for all media files</li>
            <li>Documents the repository URL, type, and all discovered media</li>
            <li>Export results as reports, JSON metadata, link lists, or M3U playlists</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
