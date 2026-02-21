import React, { useState, useCallback } from 'react'
import { Globe, Zap, Loader2, CheckCircle, AlertCircle, Copy, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  detectAPIEndpoints,
  extractFromAPIEndpoints,
  streamsToLinks,
  type APIEndpoint,
  type ExtractedStream
} from '@/lib/apiContentExtractor'

export function APIContentExtractor() {
  const [input, setInput] = useState('')
  const [endpoints, setEndpoints] = useState<APIEndpoint[]>([])
  const [extractedStreams, setExtractedStreams] = useState<ExtractedStream[]>([])
  const [isExtracting, setIsExtracting] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })

  const handleDetectEndpoints = useCallback(() => {
    if (!input.trim()) {
      toast.error('Please enter API URLs or paste content containing them')
      return
    }

    const detected = detectAPIEndpoints(input)
    
    if (detected.length === 0) {
      toast.error('No API endpoints detected. Make sure URLs contain Roku, Stremio, M3U, Xtream, or similar patterns')
      return
    }

    setEndpoints(detected)
    toast.success(`Detected ${detected.length} API endpoint(s)`)
  }, [input])

  const handleExtractStreams = useCallback(async () => {
    if (endpoints.length === 0) {
      toast.error('No endpoints detected. Click "Detect Endpoints" first')
      return
    }

    setIsExtracting(true)
    setProgress({ current: 0, total: endpoints.length })

    try {
      const streams = await extractFromAPIEndpoints(endpoints, (current, total) => {
        setProgress({ current, total })
      })

      setExtractedStreams(streams)
      
      if (streams.length > 0) {
        toast.success(`Extracted ${streams.length} stream URL(s)`)
      } else {
        toast.warning('No streams extracted. The APIs might require authentication or be unavailable.')
      }
    } catch (error) {
      toast.error('Error extracting streams')
      console.error(error)
    } finally {
      setIsExtracting(false)
    }
  }, [endpoints])

  const handleCopyUrls = useCallback(() => {
    if (extractedStreams.length === 0) {
      toast.error('No streams to copy')
      return
    }

    const urls = extractedStreams.map(s => s.url).join('\n')
    navigator.clipboard.writeText(urls)
    toast.success(`Copied ${extractedStreams.length} URLs to clipboard`)
  }, [extractedStreams])

  const handleDownloadUrls = useCallback(() => {
    if (extractedStreams.length === 0) {
      toast.error('No streams to download')
      return
    }

    const content = extractedStreams
      .map(stream => {
        const title = stream.title ? ` # ${stream.title}` : ''
        const metadata = stream.quality ? ` [${stream.quality}]` : ''
        return `${stream.url}${metadata}${title}`
      })
      .join('\n')

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `extracted-streams-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success(`Downloaded ${extractedStreams.length} streams`)
  }, [extractedStreams])

  const handleClear = useCallback(() => {
    setInput('')
    setEndpoints([])
    setExtractedStreams([])
    setProgress({ current: 0, total: 0 })
  }, [])

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Globe size={24} className="text-accent" />
          <h3 className="text-lg font-bold text-foreground">API Content Extractor</h3>
        </div>

        <p className="text-sm text-muted-foreground">
          Extract playable stream URLs from content APIs like Roku, Stremio, M3U playlists, and Xtream servers
        </p>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Paste URLs or Content Containing APIs
          </label>
          <Textarea
            placeholder="Paste API endpoints like:&#10;https://content.sr.roku.com/content/v1/...&#10;https://your-stremio-addon.com/manifest.json&#10;Or paste entire config files containing API URLs..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="font-mono text-sm min-h-[120px]"
          />
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleDetectEndpoints}
            disabled={!input.trim()}
            className="flex-1"
          >
            <Zap size={16} className="mr-2" />
            Detect Endpoints
          </Button>
          <Button
            onClick={handleClear}
            variant="outline"
            className="flex-1"
          >
            Clear
          </Button>
        </div>
      </Card>

      {/* Detected Endpoints */}
      {endpoints.length > 0 && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-foreground">Detected Endpoints ({endpoints.length})</h4>
            <Badge variant="outline">{endpoints.length} found</Badge>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {endpoints.map((endpoint, idx) => (
              <div
                key={idx}
                className="p-3 bg-card/50 border border-border rounded-md text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 break-all font-mono text-xs text-muted-foreground">
                    {endpoint.url}
                  </div>
                  <Badge className="shrink-0">{endpoint.type}</Badge>
                </div>
              </div>
            ))}
          </div>

          <Button
            onClick={handleExtractStreams}
            disabled={isExtracting}
            className="w-full"
            variant="default"
          >
            {isExtracting ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Extracting... {progress.current}/{progress.total}
              </>
            ) : (
              <>
                <Zap size={16} className="mr-2" />
                Extract Streams from APIs
              </>
            )}
          </Button>
        </Card>
      )}

      {/* Extraction Progress */}
      {isExtracting && progress.total > 0 && (
        <Alert className="border-accent/30 bg-accent/5">
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          <AlertDescription className="text-foreground">
            Querying {progress.current} of {progress.total} endpoints...
          </AlertDescription>
        </Alert>
      )}

      {/* Extracted Streams */}
      {extractedStreams.length > 0 && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle size={20} className="text-green-500" />
              <h4 className="font-bold text-foreground">
                Extracted {extractedStreams.length} Stream URL(s)
              </h4>
            </div>
          </div>

          <Separator className="bg-border" />

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {extractedStreams.map((stream, idx) => (
              <div
                key={idx}
                className="p-3 bg-card/50 border border-border rounded-md space-y-1"
              >
                <div className="flex items-start justify-between gap-2">
                  <a
                    href={stream.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline font-mono text-xs break-all flex-1"
                  >
                    {stream.url}
                  </a>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(stream.url)
                      toast.success('Copied to clipboard')
                    }}
                    className="shrink-0"
                  >
                    <Copy size={14} />
                  </Button>
                </div>

                {(stream.title || stream.quality || stream.type) && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {stream.title && (
                      <Badge variant="secondary" className="text-xs">
                        {stream.title}
                      </Badge>
                    )}
                    {stream.quality && (
                      <Badge variant="outline" className="text-xs">
                        {stream.quality}
                      </Badge>
                    )}
                    {stream.type && (
                      <Badge variant="outline" className="text-xs">
                        {stream.type}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {stream.source}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <Separator className="bg-border" />

          <div className="flex gap-2">
            <Button
              onClick={handleCopyUrls}
              variant="outline"
              className="flex-1"
            >
              <Copy size={16} className="mr-2" />
              Copy All URLs
            </Button>
            <Button
              onClick={handleDownloadUrls}
              variant="outline"
              className="flex-1"
            >
              <Download size={16} className="mr-2" />
              Download as .txt
            </Button>
          </div>
        </Card>
      )}

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-sm text-muted-foreground">
          <strong>Note:</strong> Some APIs may require authentication, API keys, or may have rate limiting. If extraction fails, the API might be unavailable or restricted. Extracted URLs are added to your link database and can be validated and downloaded like any other discovered links.
        </AlertDescription>
      </Alert>
    </div>
  )
}
