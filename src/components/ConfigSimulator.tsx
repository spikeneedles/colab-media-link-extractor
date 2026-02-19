import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Download, FileText, Globe, Play, ArrowClockwise } from '@phosphor-icons/react'
import {
  extractLinks,
  parseKodiFile,
  scanConfigFilesForLinks,
  getMediaType,
  detectContentType,
  type ConfigFile,
  type LinkWithCount,
  type ContentType
} from '@/lib/linkExtractor'
import { downloadM3UFile, generateM3UsByCategory } from '@/lib/m3uGenerator'

interface CatalogSummary {
  name: string
  type: string
  count: number
}

interface StremioManifest {
  id: string
  version: string
  name: string
  description: string
  resources: string[]
  types: string[]
  catalogs: Array<{
    type: string
    id: string
    name: string
  }>
}

interface ExtensionMediaItem {
  id: string
  url: string
  title?: string
  timestamp: string
  metadata?: Record<string, any>
}

export function ConfigSimulator() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [stremioUrl, setStremioUrl] = useState('')
  const [kodiUrl, setKodiUrl] = useState('')
  const [links, setLinks] = useState<LinkWithCount[]>([])
  const [catalogs, setCatalogs] = useState<CatalogSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [manifestInfo, setManifestInfo] = useState<StremioManifest | null>(null)
  const [autoFeedEnabled, setAutoFeedEnabled] = useState(false)
  const lastAutoFeedTimestampRef = useRef<number>(0)

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

  const totalLinks = links.length

  const typeCounts = useMemo(() => {
    const counts = new Map<ContentType, number>()
    links.forEach(link => {
      const type = link.contentType || 'unknown'
      counts.set(type, (counts.get(type) || 0) + 1)
    })
    return Array.from(counts.entries())
  }, [links])

  const groupedLinks = useMemo(() => {
    return {
      'live-tv': links.filter(link => link.contentType === 'live-tv'),
      movie: links.filter(link => link.contentType === 'movie'),
      'tv-series': links.filter(link => link.contentType === 'tv-series')
    }
  }, [links])

  useEffect(() => {
    if (!autoFeedEnabled) return

    const pollExtensionFeed = async () => {
      try {
        const response = await fetch(`${backendUrl}/api/extension/media/all?limit=10`)
        if (!response.ok) return
        const data = await response.json()
        const media: ExtensionMediaItem[] = data.media || []

        const latest = media.find(item => {
          const timestamp = new Date(item.timestamp).getTime()
          if (timestamp <= lastAutoFeedTimestampRef.current) return false
          const fileName = getFileNameFromUrl(item.url)
          return isKodiConfig(fileName)
        })

        if (latest) {
          lastAutoFeedTimestampRef.current = new Date(latest.timestamp).getTime()
          setKodiUrl(latest.url)
          await simulateKodiUrl(latest.url, true)
          setSuccess(`Auto-fed Kodi config: ${latest.url}`)
        }
      } catch (err) {
        console.error('Auto-feed polling failed:', err)
      }
    }

    pollExtensionFeed()
    const interval = window.setInterval(pollExtensionFeed, 5000)

    return () => window.clearInterval(interval)
  }, [autoFeedEnabled, backendUrl])

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setSelectedFiles(files)
  }

  const runConfigSimulation = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select at least one config file.')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const configFiles: ConfigFile[] = []
      const kodiLinks: string[] = []

      for (const file of selectedFiles) {
        const content = await file.text()
        const fileName = file.name

        configFiles.push({
          path: fileName,
          name: fileName,
          content,
          size: file.size,
          type: getConfigType(fileName)
        })

        if (isKodiConfig(fileName)) {
          kodiLinks.push(...parseKodiFile(content, fileName))
        }
      }

      const { links: configLinks } = scanConfigFilesForLinks(configFiles)
      const allLinks = dedupeLinks([...configLinks, ...kodiLinks])

      const linksWithCounts = allLinks.map(url => {
        const contentType = normalizeContentType(detectContentType(url))
        return {
          url,
          count: 1,
          mediaType: getMediaType(url),
          contentType,
          filePaths: configFiles.map(file => file.path)
        }
      })

      setLinks(linksWithCounts)
      setCatalogs(buildCatalogSummary(linksWithCounts))
      setSuccess(`Loaded ${linksWithCounts.length} links from config files.`)
    } catch (err) {
      console.error('Config simulation failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to process config files')
    } finally {
      setLoading(false)
    }
  }

  const runStremioSimulation = async () => {
    if (!stremioUrl.trim()) {
      setError('Please enter a Stremio addon URL or manifest URL.')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const manifestUrl = normalizeManifestUrl(stremioUrl.trim())
      const manifest = await fetchManifestWithFallback(manifestUrl)

      if (!manifest) {
        throw new Error('Failed to fetch Stremio manifest (CORS or invalid URL)')
      }

      setManifestInfo(manifest)
      const baseUrl = manifestUrl.replace(/\/manifest\.json$/i, '')

      const { links: streamLinks, catalogs: catalogInfo } = await fetchStremioCatalogs(baseUrl, manifest)

      const linksWithCounts = streamLinks.map(url => {
        const contentType = normalizeContentType(detectContentType(url))
        return {
          url,
          count: 1,
          mediaType: getMediaType(url),
          contentType,
          filePaths: [manifestUrl]
        }
      })

      setLinks(dedupeLinksWithCounts(linksWithCounts))
      setCatalogs(catalogInfo)
      setSuccess(`Loaded ${linksWithCounts.length} links from Stremio catalogs.`)
    } catch (err) {
      console.error('Stremio simulation failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to process Stremio addon')
    } finally {
      setLoading(false)
    }
  }

  const runKodiUrlSimulation = async () => {
    if (!kodiUrl.trim()) {
      setError('Please enter a Kodi config URL.')
      return
    }

    await simulateKodiUrl(kodiUrl.trim(), false)
  }

  const simulateKodiUrl = async (url: string, silent: boolean) => {
    if (!silent) {
      setError(null)
      setSuccess(null)
    }
    setLoading(true)

    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to fetch config file (${response.status})`)
      }

      const content = await response.text()
      const fileName = getFileNameFromUrl(url)

      const configFile: ConfigFile = {
        path: fileName,
        name: fileName,
        content,
        size: content.length,
        type: getConfigType(fileName)
      }

      const kodiLinks = isKodiConfig(fileName) ? parseKodiFile(content, fileName) : []
      const contentLinks = extractLinks(content)
      const allLinks = dedupeLinks([...contentLinks, ...kodiLinks])

      const linksWithCounts = allLinks.map(linkUrl => {
        const contentType = normalizeContentType(detectContentType(linkUrl))
        return {
          url: linkUrl,
          count: 1,
          mediaType: getMediaType(linkUrl),
          contentType,
          filePaths: [configFile.path]
        }
      })

      setLinks(linksWithCounts)
      setCatalogs(buildCatalogSummary(linksWithCounts))

      if (!silent) {
        setSuccess(`Loaded ${linksWithCounts.length} links from Kodi config URL.`)
      }
    } catch (err) {
      console.error('Kodi URL simulation failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to process Kodi config URL')
    } finally {
      setLoading(false)
    }
  }

  const downloadAllPlaylist = () => {
    if (links.length === 0) {
      setError('No links available to generate a playlist.')
      return
    }

    const m3uResult = generateM3UsByCategory(links)
    downloadM3UFile(m3uResult.all, 'config-simulator-all.m3u')
  }

  const downloadByType = () => {
    if (links.length === 0) {
      setError('No links available to generate playlists.')
      return
    }

    const m3uResult = generateM3UsByCategory(links)
    downloadM3UFile(m3uResult.movies, 'config-simulator-movies.m3u')
    downloadM3UFile(m3uResult.tvSeries, 'config-simulator-series.m3u')
    downloadM3UFile(m3uResult.liveTV, 'config-simulator-live-tv.m3u')
  }

  const downloadCategoryPlaylist = (category: ContentType) => {
    if (links.length === 0) {
      setError('No links available to generate playlists.')
      return
    }

    const m3uResult = generateM3UsByCategory(links)

    if (category === 'movie') {
      downloadM3UFile(m3uResult.movies, 'config-simulator-movies.m3u')
      return
    }

    if (category === 'tv-series') {
      downloadM3UFile(m3uResult.tvSeries, 'config-simulator-series.m3u')
      return
    }

    if (category === 'live-tv') {
      downloadM3UFile(m3uResult.liveTV, 'config-simulator-live-tv.m3u')
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-accent" />
            <div>
              <CardTitle>Config Simulator</CardTitle>
              <CardDescription>
                Apply Kodi and Stremio configs, extract media links, and generate playlists.
              </CardDescription>
            </div>
          </div>
          {totalLinks > 0 && (
            <Badge variant="secondary">{totalLinks} links</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert>
            <AlertDescription className="text-green-600">{success}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="files" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="files">Config Files</TabsTrigger>
            <TabsTrigger value="kodi">Kodi Config URL</TabsTrigger>
            <TabsTrigger value="stremio">Stremio Addon URL</TabsTrigger>
          </TabsList>

          <TabsContent value="files" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="config-files">Upload Kodi/Stremio config files</Label>
              <Input
                id="config-files"
                type="file"
                multiple
                onChange={handleFileSelection}
                accept=".xml,.nfo,.xsp,.strm,.py,.json,.ini,.conf,.cfg,.txt,.m3u,.m3u8"
              />
              <p className="text-xs text-muted-foreground">
                Supports Kodi files (.strm, .xsp, .nfo, addon.xml, sources.xml) and JSON/XML configs.
              </p>
            </div>

            <Button onClick={runConfigSimulation} disabled={loading} className="w-full">
              {loading ? (
                <ArrowClockwise className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Run Config Simulation
            </Button>
          </TabsContent>

          <TabsContent value="kodi" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="kodi-url">Kodi config file URL</Label>
              <Input
                id="kodi-url"
                value={kodiUrl}
                onChange={(event) => setKodiUrl(event.target.value)}
                placeholder="https://example.com/addon.xml"
              />
              <p className="text-xs text-muted-foreground">
                Supports addon.xml, sources.xml, favourites.xml, .strm, .xsp, .nfo, .py. CORS restrictions may apply.
              </p>
            </div>

            <Button onClick={runKodiUrlSimulation} disabled={loading} className="w-full">
              {loading ? (
                <ArrowClockwise className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Globe className="w-4 h-4 mr-2" />
              )}
              Fetch Kodi Config
            </Button>
          </TabsContent>

          <TabsContent value="stremio" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="stremio-url">Stremio install or manifest URL</Label>
              <Input
                id="stremio-url"
                value={stremioUrl}
                onChange={(event) => setStremioUrl(event.target.value)}
                placeholder="https://your-addon.com/manifest.json"
              />
              <p className="text-xs text-muted-foreground">
                Paste an install URL or manifest URL. The simulator will fetch catalogs and stream links.
              </p>
            </div>

            <Button onClick={runStremioSimulation} disabled={loading} className="w-full">
              {loading ? (
                <ArrowClockwise className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Globe className="w-4 h-4 mr-2" />
              )}
              Fetch Stremio Catalogs
            </Button>

            {manifestInfo && (
              <Alert>
                <AlertDescription className="text-xs">
                  <strong>Manifest:</strong> {manifestInfo.name} · {manifestInfo.version}
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex flex-col gap-3 border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium">Auto-feed from Extension</h4>
              <p className="text-xs text-muted-foreground">
                Polls captured media and auto-processes new Kodi config URLs.
              </p>
            </div>
            <Button
              variant={autoFeedEnabled ? 'default' : 'outline'}
              onClick={() => setAutoFeedEnabled((prev) => !prev)}
              disabled={loading}
            >
              {autoFeedEnabled ? 'Stop Auto-Feed' : 'Start Auto-Feed'}
            </Button>
          </div>
        </div>

        {links.length > 0 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Sorted Playlists</h4>
              <p className="text-xs text-muted-foreground">
                Generate separate playlists for Live TV, Movies, and Series.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  onClick={() => downloadCategoryPlaylist('live-tv')}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Live TV Playlist
                </Button>
                <Button
                  variant="outline"
                  onClick={() => downloadCategoryPlaylist('movie')}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Movies Playlist
                </Button>
                <Button
                  variant="outline"
                  onClick={() => downloadCategoryPlaylist('tv-series')}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Series Playlist
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Sorted Links</h4>
              <p className="text-xs text-muted-foreground">
                Links are grouped by category for quick review.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold">Live TV</div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadCategoryPlaylist('live-tv')}
                      className="h-7 px-2 text-xs"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Download
                    </Button>
                  </div>
                  <div className="max-h-40 overflow-auto text-xs space-y-1">
                    {groupedLinks['live-tv'].length === 0 ? (
                      <div className="text-muted-foreground">No live TV links</div>
                    ) : (
                      groupedLinks['live-tv'].map(link => (
                        <div key={link.url} className="truncate" title={link.url}>
                          {link.url}
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold">Movies</div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadCategoryPlaylist('movie')}
                      className="h-7 px-2 text-xs"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Download
                    </Button>
                  </div>
                  <div className="max-h-40 overflow-auto text-xs space-y-1">
                    {groupedLinks.movie.length === 0 ? (
                      <div className="text-muted-foreground">No movie links</div>
                    ) : (
                      groupedLinks.movie.map(link => (
                        <div key={link.url} className="truncate" title={link.url}>
                          {link.url}
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold">Series</div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadCategoryPlaylist('tv-series')}
                      className="h-7 px-2 text-xs"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Download
                    </Button>
                  </div>
                  <div className="max-h-40 overflow-auto text-xs space-y-1">
                    {groupedLinks['tv-series'].length === 0 ? (
                      <div className="text-muted-foreground">No series links</div>
                    ) : (
                      groupedLinks['tv-series'].map(link => (
                        <div key={link.url} className="truncate" title={link.url}>
                          {link.url}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {typeCounts.map(([type, count]) => (
                <Badge key={type} variant="outline" className="text-xs">
                  {type}: {count}
                </Badge>
              ))}
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Catalog Summary</h4>
              {catalogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No catalog data available.</p>
              ) : (
                <div className="space-y-1">
                  {catalogs.map((catalog) => (
                    <div key={`${catalog.type}-${catalog.name}`} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{catalog.name}</span>
                      <span className="font-medium">{catalog.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={downloadAllPlaylist} className="gap-2">
                <Download className="w-4 h-4" />
                Download All (M3U)
              </Button>
              <Button variant="outline" onClick={downloadByType} className="gap-2">
                <Download className="w-4 h-4" />
                Download by Type
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function getConfigType(fileName: string): ConfigFile['type'] {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.json')) return 'json'
  if (lower.endsWith('.xml')) return 'xml'
  if (lower.endsWith('.ini')) return 'ini'
  if (lower.endsWith('.conf')) return 'conf'
  if (lower.endsWith('.cfg')) return 'cfg'
  if (lower.endsWith('.m3u')) return 'm3u'
  if (lower.endsWith('.m3u8')) return 'm3u8'
  if (lower.endsWith('.py')) return 'py'
  if (lower.endsWith('.txt')) return 'txt'
  return 'other'
}

function isKodiConfig(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return (
    lower.endsWith('.strm') ||
    lower.endsWith('.xsp') ||
    lower.endsWith('.nfo') ||
    lower.endsWith('.py') ||
    lower === 'addon.xml' ||
    lower === 'sources.xml' ||
    lower === 'favourites.xml' ||
    lower === 'advancedsettings.xml' ||
    lower === 'playercorefactory.xml'
  )
}

function dedupeLinks(links: string[]): string[] {
  return Array.from(new Set(links))
}

function normalizeContentType(contentType: ContentType): ContentType {
  if (contentType === 'unknown') {
    return 'live-tv'
  }
  if (contentType === 'vod') {
    return 'movie'
  }
  return contentType
}

function dedupeLinksWithCounts(links: LinkWithCount[]): LinkWithCount[] {
  const map = new Map<string, LinkWithCount>()
  links.forEach(link => {
    if (!map.has(link.url)) {
      map.set(link.url, link)
    }
  })
  return Array.from(map.values())
}

function buildCatalogSummary(links: LinkWithCount[]): CatalogSummary[] {
  const summary = new Map<string, CatalogSummary>()
  links.forEach(link => {
    const type = link.contentType || 'unknown'
    const name = type
    const key = `${type}-${name}`
    const existing = summary.get(key)
    if (existing) {
      existing.count += 1
    } else {
      summary.set(key, { type, name, count: 1 })
    }
  })
  return Array.from(summary.values())
}

function normalizeManifestUrl(url: string): string {
  if (url.startsWith('stremio://')) {
    return `https://${url.slice('stremio://'.length)}`
  }
  if (!url.endsWith('/manifest.json')) {
    return url.replace(/\/$/, '') + '/manifest.json'
  }
  return url
}

function getFileNameFromUrl(url: string): string {
  try {
    const { pathname } = new URL(url)
    const lastSegment = pathname.split('/').filter(Boolean).pop()
    return lastSegment || 'kodi-config.xml'
  } catch {
    return 'kodi-config.xml'
  }
}

async function fetchManifestWithFallback(url: string): Promise<StremioManifest | null> {
  const attempts = url.startsWith('https://')
    ? [url, url.replace('https://', 'http://')]
    : url.startsWith('http://')
      ? [url, url.replace('http://', 'https://')]
      : [url, `https://${url}`, `http://${url}`]

  for (const attempt of attempts) {
    try {
      const response = await fetch(attempt)
      if (!response.ok) continue
      const json = await response.json()
      if (json && json.catalogs) {
        return json as StremioManifest
      }
    } catch (error) {
      continue
    }
  }

  return null
}

async function fetchStremioCatalogs(
  baseUrl: string,
  manifest: StremioManifest
): Promise<{ links: string[]; catalogs: CatalogSummary[] }> {
  const maxMetasPerCatalog = 50
  const collectedLinks: string[] = []
  const catalogSummaries: CatalogSummary[] = []

  for (const catalog of manifest.catalogs || []) {
    const catalogUrl = `${baseUrl}/catalog/${catalog.type}/${catalog.id}.json`
    try {
      const response = await fetch(catalogUrl)
      if (!response.ok) continue
      const data = await response.json()
      const metas = (data.metas || []).slice(0, maxMetasPerCatalog)

      catalogSummaries.push({
        name: catalog.name,
        type: catalog.type,
        count: metas.length
      })

      for (const meta of metas) {
        const metaType = meta.type || catalog.type
        const streamUrl = `${baseUrl}/stream/${metaType}/${meta.id}.json`
        try {
          const streamResponse = await fetch(streamUrl)
          if (!streamResponse.ok) continue
          const streamData = await streamResponse.json()
          const streams = Array.isArray(streamData.streams) ? streamData.streams : []
          streams.forEach((stream: { url?: string }) => {
            if (stream.url) {
              collectedLinks.push(stream.url)
            }
          })
        } catch (error) {
          continue
        }
      }
    } catch (error) {
      continue
    }
  }

  return { links: dedupeLinks(collectedLinks), catalogs: catalogSummaries }
}
