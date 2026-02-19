import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Play, Copy, Check, Download, Trash, ArrowClockwise, ArrowSquareOut, Info } from '@phosphor-icons/react'

interface StremioManifest {
  id: string
  version: string
  name: string
  description: string
  resources: string[]
  types: string[]
}

interface StremioAddonInfo {
  manifest: StremioManifest
  totalLinks: number
  installUrl: string
  addonUrl: string
  stremioUrl: string
}

interface DiscoveryJob {
  id: string
  sourceUrl: string
  triggeredBy: 'stream-request' | 'manual'
  status: 'pending' | 'crawling' | 'completed' | 'failed'
  progress: number
  discoveredLinksCount: number
  playlistUrl?: string
  startedAt: string
  completedAt?: string
  error?: string
}

interface PlaylistSummary {
  id: string
  name: string
  category: string
  linksCount: number
  format: 'm3u' | 'm3u8'
  createdAt: string
  sourceUrl: string
  downloadUrl: string
}

interface StremioIntegrationProps {
  extractedLinks?: Array<{
    url: string
    title?: string
    category?: string
    contentType?: string
  }>
  onLinksExported?: () => void
}

export function StremioIntegration({ extractedLinks = [], onLinksExported }: StremioIntegrationProps) {
  const [addonInfo, setAddonInfo] = useState<StremioAddonInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [copiedType, setCopiedType] = useState<string | null>(null)

  // Auto-discovery state
  const [discoveryJobs, setDiscoveryJobs] = useState<DiscoveryJob[]>([])
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([])
  const [discoveryUrl, setDiscoveryUrl] = useState('')
  const [discoveryTitle, setDiscoveryTitle] = useState('')
  const [discoveryCategory, setDiscoveryCategory] = useState('')
  const [discoveryLoading, setDiscoveryLoading] = useState(false)
  
  // Manifest customization
  const [customName, setCustomName] = useState('')
  const [customDescription, setCustomDescription] = useState('')
  const [customLogo, setCustomLogo] = useState('')
  
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

  useEffect(() => {
    fetchAddonInfo()
    fetchAutoDiscoveryData()
  }, [])

  const fetchAddonInfo = async () => {
    try {
      const response = await fetch(`${backendUrl}/stremio/api/info`)
      if (!response.ok) throw new Error('Failed to fetch addon info')
      const data = await response.json()
      setAddonInfo(data)
      setCustomName(data.manifest.name)
      setCustomDescription(data.manifest.description)
      setCustomLogo(data.manifest.logo || '')
    } catch (err) {
      console.error('Error fetching addon info:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch addon info')
    }
  }

  const fetchAutoDiscoveryData = async () => {
    try {
      const [jobsResponse, playlistsResponse] = await Promise.all([
        fetch(`${backendUrl}/stremio/api/discovery/jobs`),
        fetch(`${backendUrl}/stremio/api/playlists`)
      ])

      if (jobsResponse.ok) {
        const jobsData = await jobsResponse.json()
        setDiscoveryJobs(jobsData.jobs || [])
      }

      if (playlistsResponse.ok) {
        const playlistsData = await playlistsResponse.json()
        setPlaylists(playlistsData.playlists || [])
      }
    } catch (err) {
      console.error('Error fetching auto-discovery data:', err)
    }
  }

  const exportToStremio = async () => {
    if (extractedLinks.length === 0) {
      setError('No links to export. Please extract some links first.')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      // Classify links by content type
      const classifiedLinks = extractedLinks.map(link => ({
        url: link.url,
        title: link.title || 'Untitled',
        category: link.category || 'General',
        type: classifyContentType(link.contentType || '', link.title || '', link.url)
      }))

      const response = await fetch(`${backendUrl}/stremio/api/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          links: classifiedLinks,
          category: 'extracted'
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to export links')
      }

      const result = await response.json()
      setSuccess(`Successfully exported ${result.totalLinks} links to Stremio addon!`)
      
      await fetchAddonInfo()
      onLinksExported?.()
    } catch (err) {
      console.error('Error exporting to Stremio:', err)
      setError(err instanceof Error ? err.message : 'Failed to export to Stremio')
    } finally {
      setLoading(false)
    }
  }

  const startAutoDiscovery = async () => {
    if (!discoveryUrl.trim()) {
      setError('Please enter a URL to start auto-discovery.')
      return
    }

    setDiscoveryLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`${backendUrl}/stremio/api/discovery/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: discoveryUrl.trim(),
          title: discoveryTitle.trim() || undefined,
          category: discoveryCategory.trim() || undefined
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to start discovery')
      }

      setSuccess('Auto-discovery started successfully!')
      setDiscoveryUrl('')
      setDiscoveryTitle('')
      setDiscoveryCategory('')
      await fetchAutoDiscoveryData()
    } catch (err) {
      console.error('Error starting auto-discovery:', err)
      setError(err instanceof Error ? err.message : 'Failed to start discovery')
    } finally {
      setDiscoveryLoading(false)
    }
  }

  const addDiscoveredToAddon = async (jobId: string) => {
    setDiscoveryLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`${backendUrl}/stremio/api/discovery/add-to-addon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add discovered links')
      }

      const result = await response.json()
      setSuccess(result.message || 'Discovered links added to addon')
      await fetchAddonInfo()
      await fetchAutoDiscoveryData()
    } catch (err) {
      console.error('Error adding discovered links:', err)
      setError(err instanceof Error ? err.message : 'Failed to add discovered links')
    } finally {
      setDiscoveryLoading(false)
    }
  }

  const getStatusBadgeVariant = (status: DiscoveryJob['status']) => {
    if (status === 'completed') return 'secondary'
    if (status === 'failed') return 'destructive'
    return 'outline'
  }

  const classifyContentType = (contentType: string, title: string, url: string): 'movie' | 'series' | 'tv' | 'channel' => {
    const lower = `${contentType} ${title} ${url}`.toLowerCase()
    
    if (lower.includes('live') || lower.includes('channel') || lower.includes('tv')) {
      return 'tv'
    }
    if (lower.includes('series') || lower.includes('episode') || lower.includes('season')) {
      return 'series'
    }
    if (lower.includes('movie') || lower.includes('film')) {
      return 'movie'
    }
    
    return 'channel'
  }

  const updateManifest = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`${backendUrl}/stremio/api/manifest`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customName,
          description: customDescription,
          logo: customLogo
        })
      })

      if (!response.ok) throw new Error('Failed to update manifest')
      
      const result = await response.json()
      setSuccess('Addon manifest updated successfully!')
      await fetchAddonInfo()
    } catch (err) {
      console.error('Error updating manifest:', err)
      setError(err instanceof Error ? err.message : 'Failed to update manifest')
    } finally {
      setLoading(false)
    }
  }

  const clearLinks = async () => {
    if (!confirm('Are you sure you want to clear all links from the Stremio addon?')) {
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`${backendUrl}/stremio/api/links`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to clear links')
      
      setSuccess('All links cleared from Stremio addon')
      await fetchAddonInfo()
    } catch (err) {
      console.error('Error clearing links:', err)
      setError(err instanceof Error ? err.message : 'Failed to clear links')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setCopiedType(type)
      setTimeout(() => {
        setCopied(false)
        setCopiedType(null)
      }, 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const openInStremio = () => {
    if (addonInfo?.stremioUrl) {
      window.location.href = addonInfo.stremioUrl
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Play weight="fill" className="w-6 h-6 text-purple-500" />
            <div>
              <CardTitle>Stremio Integration</CardTitle>
              <CardDescription>
                Stream your extracted media links directly in Stremio
              </CardDescription>
            </div>
          </div>
          {addonInfo && (
            <Badge variant="secondary">
              {addonInfo.totalLinks} links
            </Badge>
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

        <Tabs defaultValue="export" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="export">Export Links</TabsTrigger>
            <TabsTrigger value="install">Install Addon</TabsTrigger>
            <TabsTrigger value="discovery">Auto-Discovery</TabsTrigger>
            <TabsTrigger value="configure">Configure</TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Export Extracted Links</h3>
              <p className="text-sm text-muted-foreground">
                Export your extracted media links to the Stremio addon. Links will be categorized
                automatically based on their content type.
              </p>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">{extractedLinks.length} links ready to export</p>
                <p className="text-sm text-muted-foreground">
                  {addonInfo ? `${addonInfo.totalLinks} links currently in addon` : 'Loading...'}
                </p>
              </div>
              <Button
                onClick={exportToStremio}
                disabled={loading || extractedLinks.length === 0}
                className="gap-2"
              >
                {loading ? (
                  <ArrowClockwise className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Export to Stremio
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={fetchAddonInfo}
                disabled={loading}
                className="flex-1"
              >
                <ArrowClockwise className="w-4 h-4 mr-2" />
                Refresh Status
              </Button>
              <Button
                variant="outline"
                onClick={clearLinks}
                disabled={loading || !addonInfo || addonInfo.totalLinks === 0}
                className="flex-1 text-red-600 hover:text-red-700"
              >
                <Trash className="w-4 h-4 mr-2" />
                Clear All Links
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="install" className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Install Addon in Stremio</h3>
              <p className="text-sm text-muted-foreground">
                Click the button below to install the addon in Stremio, or copy the URL manually.
              </p>
            </div>

            {addonInfo && (
              <div className="space-y-4">
                <Button
                  onClick={openInStremio}
                  className="w-full gap-2"
                  size="lg"
                >
                  <Play weight="fill" className="w-5 h-5" />
                  Open in Stremio
                </Button>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Install URL</Label>
                    <div className="flex gap-2">
                      <Input
                        value={addonInfo.installUrl}
                        readOnly
                        className="font-mono text-xs"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(addonInfo.installUrl, 'install')}
                      >
                        {copied && copiedType === 'install' ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Stremio Protocol URL</Label>
                    <div className="flex gap-2">
                      <Input
                        value={addonInfo.stremioUrl}
                        readOnly
                        className="font-mono text-xs"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(addonInfo.stremioUrl, 'stremio')}
                      >
                        {copied && copiedType === 'stremio' ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    <strong>How to install:</strong> Click "Open in Stremio" or paste the Install URL
                    into Stremio's addon search. Make sure your backend server is running and accessible.
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </TabsContent>

          <TabsContent value="discovery" className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Auto-Discovery & Playlists</h3>
              <p className="text-sm text-muted-foreground">
                When Stremio plays a stream, the addon automatically crawls the source domain and
                generates a playlist. You can also start a manual discovery.
              </p>
            </div>

            <div className="space-y-3 p-4 border rounded-lg">
              <div className="space-y-2">
                <Label htmlFor="discovery-url">Source URL</Label>
                <Input
                  id="discovery-url"
                  value={discoveryUrl}
                  onChange={(e) => setDiscoveryUrl(e.target.value)}
                  placeholder="https://example.com/media"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="discovery-title">Title (optional)</Label>
                  <Input
                    id="discovery-title"
                    value={discoveryTitle}
                    onChange={(e) => setDiscoveryTitle(e.target.value)}
                    placeholder="My Media Source"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discovery-category">Category (optional)</Label>
                  <Input
                    id="discovery-category"
                    value={discoveryCategory}
                    onChange={(e) => setDiscoveryCategory(e.target.value)}
                    placeholder="discovered"
                  />
                </div>
              </div>

              <Button
                onClick={startAutoDiscovery}
                disabled={discoveryLoading}
                className="w-full"
              >
                {discoveryLoading ? (
                  <ArrowClockwise className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ArrowSquareOut className="w-4 h-4 mr-2" />
                )}
                Start Auto-Discovery
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={fetchAutoDiscoveryData}
                disabled={discoveryLoading}
                className="flex-1"
              >
                <ArrowClockwise className="w-4 h-4 mr-2" />
                Refresh Jobs & Playlists
              </Button>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-medium">Discovery Jobs</h4>
              {discoveryJobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No discovery jobs yet.</p>
              ) : (
                <div className="space-y-2">
                  {discoveryJobs.map(job => (
                    <div key={job.id} className="flex flex-col gap-2 p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium truncate">{job.sourceUrl}</div>
                        <Badge variant={getStatusBadgeVariant(job.status)} className="text-xs">
                          {job.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {job.discoveredLinksCount} links · {job.progress}% · {job.triggeredBy}
                      </div>
                      {job.error && (
                        <div className="text-xs text-red-600">{job.error}</div>
                      )}
                      <div className="flex gap-2">
                        {job.playlistUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`${backendUrl}${job.playlistUrl}`, '_blank')}
                          >
                            <Download className="w-3 h-3 mr-2" />
                            Download Playlist
                          </Button>
                        )}
                        {job.status === 'completed' && job.discoveredLinksCount > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addDiscoveredToAddon(job.id)}
                            disabled={discoveryLoading}
                          >
                            Add to Addon
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-medium">Generated Playlists</h4>
              {playlists.length === 0 ? (
                <p className="text-sm text-muted-foreground">No playlists generated yet.</p>
              ) : (
                <div className="space-y-2">
                  {playlists.map(playlist => (
                    <div key={playlist.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="text-sm font-medium">{playlist.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {playlist.linksCount} links · {playlist.format} · {playlist.category}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`${backendUrl}${playlist.downloadUrl}`, '_blank')}
                      >
                        <Download className="w-3 h-3 mr-2" />
                        Download
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="configure" className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Customize Addon</h3>
              <p className="text-sm text-muted-foreground">
                Personalize your Stremio addon's appearance and metadata.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="addon-name">Addon Name</Label>
                <Input
                  id="addon-name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="My Custom Addon"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="addon-description">Description</Label>
                <Textarea
                  id="addon-description"
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  placeholder="Describe your addon..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="addon-logo">Logo URL (optional)</Label>
                <Input
                  id="addon-logo"
                  type="url"
                  value={customLogo}
                  onChange={(e) => setCustomLogo(e.target.value)}
                  placeholder="https://example.com/logo.png"
                />
                <p className="text-xs text-muted-foreground">
                  Recommended size: 256x256px
                </p>
              </div>

              <Button
                onClick={updateManifest}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <ArrowClockwise className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Update Addon Configuration
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {addonInfo && (
          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium mb-2">Addon Information</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">Version:</div>
              <div className="font-mono">{addonInfo.manifest.version}</div>
              
              <div className="text-muted-foreground">Resources:</div>
              <div className="flex gap-1 flex-wrap">
                {addonInfo.manifest.resources.map(resource => (
                  <Badge key={resource} variant="outline" className="text-xs">
                    {resource}
                  </Badge>
                ))}
              </div>
              
              <div className="text-muted-foreground">Content Types:</div>
              <div className="flex gap-1 flex-wrap">
                {addonInfo.manifest.types.map(type => (
                  <Badge key={type} variant="outline" className="text-xs">
                    {type}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
