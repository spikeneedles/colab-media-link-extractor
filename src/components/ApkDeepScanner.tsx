import { useEffect, useMemo, useRef, useState } from 'react'
import JSZip from 'jszip'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Download, Package, ArrowClockwise, WarningCircle, Lightbulb } from '@phosphor-icons/react'
import {
  extractLinks,
  generateTextFile,
  getMediaType,
  detectContentType,
  type LinkWithCount
} from '@/lib/linkExtractor'
import { downloadM3UFile, generateM3UsByCategory } from '@/lib/m3uGenerator'

const MEDIA_EXTENSIONS = [
  'm3u', 'm3u8', 'mpd', 'ism', 'isml', 'f4m', 'ts', 'mp4', 'mkv', 'webm', 'mov', 'avi',
  'mpg', 'mpeg', 'm4v', '3gp', '3g2', 'wmv', 'flv', 'm2ts', 'mts', 'vob',
  'mp3', 'aac', 'flac', 'wav', 'ogg', 'opus', 'm4a', 'ac3', 'dts', 'alac',
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'svg',
  'srt', 'vtt', 'ass', 'ssa', 'sub', 'idx',
  'cue', 'pls', 'xspf'
]

const TEXT_EXTENSIONS = [
  'txt', 'json', 'xml', 'ini', 'conf', 'cfg', 'properties', 'smali', 'java', 'kt',
  'js', 'ts', 'py', 'md', 'yaml', 'yml', 'm3u', 'm3u8', 'gradle'
]

const MAX_TEXT_BYTES = 2 * 1024 * 1024

type ErrorData = {
  message: string
  reason?: string
  hint?: string
  troubleshooting?: string
}

type MediaEntry = {
  path: string
  size?: number
  source: string
  getBlob: () => Promise<Blob>
}

const ErrorDisplay = ({ error }: { error: ErrorData | string | null }) => {
  if (!error) return null
  
  let errorData: ErrorData
  
  if (typeof error === 'string') {
    // Try to parse structured error from string format
    const reasonMatch = error.match(/\n\s*•\s*Reason:\s*([^\n]+)/)
    const hintMatch = error.match(/\n\s*•\s*Hint:\s*([^\n]+(?:\n(?!\s*•)[^\n]+)*)/)
    const troubleshootMatch = error.match(/\n\s*•\s*Troubleshooting:\s*([^\n]+(?:\n(?!\s*•)[^\n]+)*)/)
    
    // Get the main message (everything before the first bullet point)
    const mainMessage = error.split('\n')[0].replace(/^❌\s*/, '')
    
    errorData = {
      message: mainMessage,
      reason: reasonMatch?.[1]?.trim(),
      hint: hintMatch?.[1]?.trim(),
      troubleshooting: troubleshootMatch?.[1]?.trim()
    }
  } else {
    errorData = error
  }
  
  return (
    <Alert variant="destructive" className="border-red-300 bg-red-50">
      <div className="space-y-3">
        <div className="flex items-start gap-2">
          <WarningCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-900">{errorData.message}</p>
          </div>
        </div>
        
        {errorData.reason && (
          <div className="ml-7 text-sm text-red-800 space-y-1">
            <p className="font-medium text-red-900">Why this happened:</p>
            <p className="text-red-700">{errorData.reason}</p>
          </div>
        )}
        
        {errorData.hint && (
          <div className="ml-7 text-sm text-amber-800 space-y-1">
            <div className="flex items-center gap-1">
              <Lightbulb className="w-4 h-4" />
              <p className="font-medium">Suggested fix:</p>
            </div>
            <p className="text-amber-700 whitespace-pre-wrap">{errorData.hint}</p>
          </div>
        )}
        
        {errorData.troubleshooting && (
          <div className="ml-7 text-sm text-blue-800 space-y-1">
            <p className="font-medium text-blue-900">Troubleshooting:</p>
            <p className="text-blue-700 whitespace-pre-wrap">{errorData.troubleshooting}</p>
          </div>
        )}
      </div>
    </Alert>
  )
}

export function ApkDeepScanner() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [mediaEntries, setMediaEntries] = useState<MediaEntry[]>([])
  const [extractedLinks, setExtractedLinks] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const [runtimeApkPath, setRuntimeApkPath] = useState('')
  const [runtimePackage, setRuntimePackage] = useState('')
  const [runtimeActivity, setRuntimeActivity] = useState('')
  const [runtimeStatus, setRuntimeStatus] = useState<string>('idle')
  const [runtimeUrls, setRuntimeUrls] = useState<string[]>([])
  const [runtimeLoading, setRuntimeLoading] = useState(false)
  const [preflightResult, setPreflightResult] = useState<any>(null)
  const runtimeFileInputRef = useRef<HTMLInputElement>(null)

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

  const linkItems = useMemo<LinkWithCount[]>(() => {
    return extractedLinks.map(url => ({
      url,
      count: 1,
      mediaType: getMediaType(url),
      contentType: detectContentType(url),
      filePaths: [selectedFile?.name || 'apk-scan']
    }))
  }, [extractedLinks, selectedFile])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null
    setSelectedFile(file)
    setMediaEntries([])
    setExtractedLinks([])
    setError(null)
    setSuccess(null)
  }

  const handleScan = async () => {
    if (!selectedFile) {
      setError('Please select an APK file first.')
      return
    }

    setIsScanning(true)
    setError(null)
    setSuccess(null)

    try {
      const zip = await JSZip.loadAsync(selectedFile)
      const aggregatedMedia: MediaEntry[] = []
      const linkSet = new Set<string>()

      const scanZip = async (apkZip: JSZip, source: string) => {
        const entries = Object.keys(apkZip.files)
        for (const entry of entries) {
          const fileRef = apkZip.file(entry)
          if (!fileRef) continue
          if (fileRef.dir) continue

          const extension = getExtension(entry)
          if (extension && MEDIA_EXTENSIONS.includes(extension)) {
            aggregatedMedia.push({
              path: entry,
              size: getZipEntrySize(fileRef),
              source,
              getBlob: async () => fileRef.async('blob')
            })
            continue
          }

          if (extension && TEXT_EXTENSIONS.includes(extension)) {
            const size = getZipEntrySize(fileRef)
            if (size && size > MAX_TEXT_BYTES) {
              continue
            }

            try {
              const content = await fileRef.async('text')
              const links = extractLinks(content)
              links.forEach(link => linkSet.add(link))
            } catch (err) {
              continue
            }
          }
        }
      }

      if (isContainerPackage(selectedFile.name)) {
        const apkEntries = Object.keys(zip.files).filter(path =>
          path.toLowerCase().endsWith('.apk') && !zip.files[path].dir
        )

        for (const apkPath of apkEntries) {
          const apkFile = zip.file(apkPath)
          if (!apkFile) continue
          const apkData = await apkFile.async('arraybuffer')
          const apkZip = await JSZip.loadAsync(apkData)
          await scanZip(apkZip, apkPath)
        }
      } else {
        await scanZip(zip, selectedFile.name)
      }

      setMediaEntries(aggregatedMedia)
      setExtractedLinks(Array.from(linkSet))
      setSuccess(`Found ${aggregatedMedia.length} media files and ${linkSet.size} links.`)
    } catch (err) {
      console.error('APK scan failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to scan APK')
    } finally {
      setIsScanning(false)
    }
  }

  const handleDownloadEntry = async (entry: MediaEntry) => {
    try {
      const blob = await entry.getBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = sanitizeFilename(entry.path)
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError('Failed to download media file')
    }
  }

  const handleDownloadAllMedia = async () => {
    if (mediaEntries.length === 0) {
      setError('No media files to download.')
      return
    }

    const zip = new JSZip()
    for (const entry of mediaEntries) {
      const blob = await entry.getBlob()
      zip.file(sanitizeFilename(entry.path), blob)
    }

    const archive = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(archive)
    const a = document.createElement('a')
    a.href = url
    a.download = 'apk-media-files.zip'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleDownloadLinks = () => {
    if (linkItems.length === 0) {
      setError('No links to download.')
      return
    }

    const blob = generateTextFile(linkItems)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'apk-links.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleDownloadM3U = () => {
    if (linkItems.length === 0) {
      setError('No links to export as M3U.')
      return
    }

    const result = generateM3UsByCategory(linkItems)
    downloadM3UFile(result.all, 'apk-links.m3u')
  }

  const runRuntimePreflight = async (): Promise<boolean> => {
    try {
      const response = await fetch(`${backendUrl}/api/apk-runtime/preflight`)
      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result.message || 'Failed to run emulator preflight check')
      }

      if (!result.preflight?.adbOk) {
        setRuntimeError('Android Studio adb not found on PATH. Add platform-tools to PATH and restart the backend.')
        return false
      }

      if (!result.preflight?.emulatorOk) {
        setRuntimeError('No running emulator detected. Start an Android Studio AVD before starting runtime capture.')
        return false
      }

      return true
    } catch (err) {
      setRuntimeError(err instanceof Error ? err.message : 'Failed to run emulator preflight check')
      return false
    }
  }


  const handleCheckEmulator = async () => {
    setRuntimeLoading(true)
    setRuntimeError(null)
    setSuccess(null)

    try {
      const response = await fetch(`${backendUrl}/api/apk-runtime/preflight`)
      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result.message || 'Failed to run emulator preflight check')
      }

      setPreflightResult(result.preflight)

      if (result.preflight?.adbOk) {
        if (result.preflight?.emulatorOk) {
          setSuccess(`Emulator ready! Devices: ${result.preflight.devices.join(', ')}`)
        } else {
          setRuntimeError('No running emulator detected. Start an Android Studio AVD.')
        }
      } else {
        setRuntimeError('Android Studio adb not found on PATH.')
      }
    } catch (err) {
      setRuntimeError(err instanceof Error ? err.message : 'Failed to check emulator')
      setPreflightResult(null)
    } finally {
      setRuntimeLoading(false)
    }
  }

  const handleStartRuntime = async () => {
    if (!runtimeApkPath && !runtimePackage) {
      setRuntimeError('Provide an APK path or package name to start runtime capture.')
      return
    }

    setRuntimeLoading(true)
    setRuntimeError(null)
    setSuccess(null)

    const preflightOk = await runRuntimePreflight()
    if (!preflightOk) {
      setRuntimeLoading(false)
      return
    }

    try {
      const response = await fetch(`${backendUrl}/api/apk-runtime/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apkPath: runtimeApkPath || undefined,
          packageName: runtimePackage || undefined,
          activity: runtimeActivity || undefined,
          enableProxy: true
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const reason = errorData.reason ? `\n  • Reason: ${errorData.reason}` : ''
        const hint = errorData.hint ? `\n  • Hint: ${errorData.hint}` : ''
        const message = errorData.message || `HTTP ${response.status}`
        throw new Error(`${message}${reason}${hint}`)
      }

      const result = await response.json()
      setRuntimeStatus(result.state.status || 'running')
      setSuccess('✓ Runtime capture started. Launch the app in the emulator to capture media URLs.')
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred'
      setRuntimeError(`❌ ${errorMsg}`)
    } finally {
      setRuntimeLoading(false)
    }
  }

  const handleStopRuntime = async () => {
    setRuntimeLoading(true)
    try {
      const response = await fetch(`${backendUrl}/api/apk-runtime/stop`, {
        method: 'POST'
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const reason = errorData.message || errorData.error || `HTTP ${response.status}`
        throw new Error(`Failed to stop runtime capture: ${reason}`)
      }
      const result = await response.json()
      setRuntimeStatus(result.state?.status || 'stopped')
      setRuntimeUrls(result.state?.urls || [])
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred'
      setRuntimeError(`❌ ${errorMsg}`)
    } finally {
      setRuntimeLoading(false)
    }
  }

  const handleRefreshRuntime = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/apk-runtime/status`)
      if (!response.ok) return
      const result = await response.json()
      setRuntimeStatus(result.state?.status || 'idle')
      setRuntimeUrls(result.state?.urls || [])
    } catch (err) {
      setRuntimeError(err instanceof Error ? err.message : 'Failed to refresh runtime status')
    }
  }

  useEffect(() => {
    if (runtimeStatus !== 'running') return

    const intervalId = window.setInterval(() => {
      handleRefreshRuntime()
    }, 20000)

    return () => window.clearInterval(intervalId)
  }, [runtimeStatus])

  const handleRuntimeFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setRuntimeLoading(true)
    setRuntimeError(null)
    setSuccess(null)

    const preflightOk = await runRuntimePreflight()
    if (!preflightOk) {
      setRuntimeLoading(false)
      if (runtimeFileInputRef.current) {
        runtimeFileInputRef.current.value = ''
      }
      return
    }

    try {
      const formData = new FormData()
      formData.append('apk', file)
      if (runtimePackage) {
        formData.append('packageName', runtimePackage)
      }
      if (runtimeActivity) {
        formData.append('activity', runtimeActivity)
      }

      const response = await fetch(`${backendUrl}/api/apk-runtime/upload-start`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const reason = errorData.reason ? `\n  • Reason: ${errorData.reason}` : ''
        const hint = errorData.hint ? `\n  • Hint: ${errorData.hint}` : ''
        const message = errorData.message || `HTTP ${response.status}`
        throw new Error(`${message}${reason}${hint}`)
      }

      const result = await response.json()
      setRuntimeStatus(result.state?.status || 'running')
      setRuntimeUrls(result.state?.urls || [])
      if (result.state?.packageName) {
        setRuntimePackage(result.state.packageName)
      }
      setSuccess('✓ APK installed and runtime capture started. Use the emulator to generate media activity.')
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred'
      setRuntimeError(`❌ ${errorMsg}`)
    } finally {
      setRuntimeLoading(false)
      if (runtimeFileInputRef.current) {
        runtimeFileInputRef.current.value = ''
      }
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Package className="w-6 h-6 text-accent" />
          <div>
            <CardTitle>APK Deep Scanner</CardTitle>
            <CardDescription>
              Open APK packages, extract embedded media files, and surface media links.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <ErrorDisplay error={error} />}
        {success && (
          <Alert>
            <AlertDescription className="text-green-600">{success}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-3">
          <Input
            type="file"
            accept=".apk,.xapk,.apkm,.apks,.apkx"
            onChange={handleFileChange}
          />
          <Button onClick={handleScan} disabled={isScanning || !selectedFile}>
            {isScanning ? (
              <ArrowClockwise className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            Scan APK
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-xs">
            Media files: {mediaEntries.length}
          </Badge>
          <Badge variant="outline" className="text-xs">
            Links: {extractedLinks.length}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleDownloadAllMedia} className="gap-2">
            <Download className="w-4 h-4" />
            Download All Media
          </Button>
          <Button variant="outline" onClick={handleDownloadLinks} className="gap-2">
            <Download className="w-4 h-4" />
            Download Links
          </Button>
          <Button variant="outline" onClick={handleDownloadM3U} className="gap-2">
            <Download className="w-4 h-4" />
            Download M3U
          </Button>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Media Files</h4>
          {mediaEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No media files found yet.</p>
          ) : (
            <ScrollArea className="h-56 border rounded-lg p-3">
              <div className="space-y-2">
                {mediaEntries.map((entry) => (
                  <div key={`${entry.source}:${entry.path}`} className="flex items-center justify-between text-xs">
                    <div className="truncate" title={`${entry.source} :: ${entry.path}`}>
                      {entry.path}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadEntry(entry)}
                      className="h-7 px-2 text-xs"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Extracted Links</h4>
          {extractedLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No links extracted yet.</p>
          ) : (
            <ScrollArea className="h-40 border rounded-lg p-3">
              <div className="space-y-1 text-xs">
                {extractedLinks.map(link => (
                  <div key={link} className="truncate" title={link}>
                    {link}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <div className="space-y-3 border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium">Runtime Emulator Capture</h4>
              <p className="text-xs text-muted-foreground">
                Installs the APK (optional), launches it, and captures media URLs via logcat + mitmproxy.
              </p>
            </div>
            <Badge variant="outline" className="text-xs">
              Status: {runtimeStatus}
            </Badge>
          </div>

          {runtimeError && <ErrorDisplay error={runtimeError} />}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input
              placeholder="APK path on server (optional)"
              value={runtimeApkPath}
              onChange={(event) => setRuntimeApkPath(event.target.value)}
            />
            <Input
              placeholder="Package name (com.example.app)"
              value={runtimePackage}
              onChange={(event) => setRuntimePackage(event.target.value)}
            />
            <Input
              placeholder="Activity (optional)"
              value={runtimeActivity}
              onChange={(event) => setRuntimeActivity(event.target.value)}
            />
          </div>

          <input
            ref={runtimeFileInputRef}
            type="file"
            accept=".apk,.xapk,.apkm,.apks,.apkx"
            onChange={handleRuntimeFileSelected}
            className="hidden"
          />

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleCheckEmulator} disabled={runtimeLoading}>
              Check Emulator
            </Button>
            <Button onClick={handleStartRuntime} disabled={runtimeLoading}>
              {runtimeLoading ? <ArrowClockwise className="w-4 h-4 mr-2 animate-spin" /> : null}
              Start Runtime Capture
            </Button>
            <Button
              variant="outline"
              onClick={() => runtimeFileInputRef.current?.click()}
              disabled={runtimeLoading}
            >
              Select APK & Start
            </Button>
            <Button variant="outline" onClick={handleStopRuntime} disabled={runtimeLoading}>
              Stop Capture
            </Button>
            <Button variant="outline" onClick={handleRefreshRuntime} disabled={runtimeLoading}>
              Refresh Status
            </Button>
          </div>

          {preflightResult && (
            <div className="border rounded-lg p-3 bg-slate-50 dark:bg-slate-900 space-y-2">
              <h4 className="text-sm font-medium">Emulator Status</h4>
              <div className="text-xs space-y-1">
                <div>
                  adb: {preflightResult.adbOk ? '✓ Found' : '✗ Not found'}
                  {preflightResult.adbVersion && ` (${preflightResult.adbVersion.split(' ')[0]})`}
                </div>
                <div>Emulator: {preflightResult.emulatorOk ? '✓ Running' : '✗ Not running'}</div>
                {preflightResult.devices && preflightResult.devices.length > 0 && (
                  <div>Devices: {preflightResult.devices.join(', ')}</div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Captured Runtime URLs</h4>
            {runtimeUrls.length === 0 ? (
              <p className="text-sm text-muted-foreground">No runtime URLs captured yet.</p>
            ) : (
              <ScrollArea className="h-32 border rounded-lg p-3">
                <div className="space-y-1 text-xs">
                  {runtimeUrls.map(url => (
                    <div key={url} className="truncate" title={url}>
                      {url}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <Alert>
          <AlertDescription className="text-xs">
            Runtime capture auto-refreshes while running. Use the emulator to navigate to media content and watch captured URLs populate.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}

function isContainerPackage(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return lower.endsWith('.xapk') || lower.endsWith('.apkm') || lower.endsWith('.apks') || lower.endsWith('.apkx')
}

function getExtension(path: string): string | null {
  const lastDot = path.lastIndexOf('.')
  if (lastDot === -1) return null
  return path.slice(lastDot + 1).toLowerCase()
}

function getZipEntrySize(fileRef: JSZip.JSZipObject): number | undefined {
  const data = (fileRef as unknown as { _data?: { uncompressedSize?: number } })._data
  return data?.uncompressedSize
}

function sanitizeFilename(path: string): string {
  return path.replace(/[<>:"|?*]/g, '_').replace(/\s+/g, '_')
}
