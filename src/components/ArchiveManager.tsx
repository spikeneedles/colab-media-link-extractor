import { useState, useCallback, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Package, 
  DownloadSimple, 
  FileArchive, 
  FolderOpen, 
  File, 
  CheckCircle,
  Warning,
  MagnifyingGlass,
  CopySimple,
  FilmSlate,
  Sparkle,
  FileArrowDown,
  Database,
  FileZip
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { 
  scanArchive, 
  scanBatchArchives, 
  extractArchiveToZip,
  generateArchiveReport,
  type ArchiveScanResult,
  type BatchArchiveResult 
} from '@/lib/archiveHandler'
import { 
  downloadKodiAddon,
  getPopularKodiRepositories,
  generateKodiAddonReport,
  exportKodiAddonAsZip,
  type KodiAddonScanResult,
  type KodiRepository
} from '@/lib/kodiAddonDownloader'

export function ArchiveManager() {
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [batchResult, setBatchResult] = useState<BatchArchiveResult | null>(null)
  const [selectedArchive, setSelectedArchive] = useState<ArchiveScanResult | null>(null)
  const [kodiAddonUrl, setKodiAddonUrl] = useState('')
  const [isDownloadingAddon, setIsDownloadingAddon] = useState(false)
  const [addonResult, setAddonResult] = useState<KodiAddonScanResult | null>(null)
  const [popularRepos] = useState<KodiRepository[]>(getPopularKodiRepositories())
  const archiveInputRef = useRef<HTMLInputElement>(null)

  const handleArchiveUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return

    const files = Array.from(e.target.files)
    setIsScanning(true)
    setScanProgress(0)
    setBatchResult(null)
    setSelectedArchive(null)

    toast.loading(`Scanning ${files.length} archive${files.length !== 1 ? 's' : ''}...`, { id: 'archive-scan' })

    try {
      const result = await scanBatchArchives(files, (current, total) => {
        setScanProgress((current / total) * 100)
      })

      setBatchResult(result)
      setIsScanning(false)

      if (result.successCount > 0) {
        toast.success(
          `Scanned ${result.successCount} archives, found ${result.totalLinks.length} unique links`,
          { id: 'archive-scan' }
        )
      } else {
        toast.error('Failed to scan archives', { id: 'archive-scan' })
      }
    } catch (error) {
      setIsScanning(false)
      toast.error('Archive scan failed', { id: 'archive-scan' })
      console.error('Archive scan error:', error)
    }

    if (archiveInputRef.current) {
      archiveInputRef.current.value = ''
    }
  }, [])

  const handleExtractArchive = useCallback(async (archive: ArchiveScanResult) => {
    toast.info('Extract feature available when re-uploading archive file')
  }, [])

  const handleDownloadArchiveReport = useCallback(async () => {
    if (!batchResult) return

    const report = await generateArchiveReport(batchResult.archives)
    const blob = new Blob([report], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'archive-scan-report.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success('Downloaded archive report')
  }, [batchResult])

  const handleDownloadArchiveLinks = useCallback(() => {
    if (!batchResult) return

    const linksContent = batchResult.totalLinks.join('\n')
    const blob = new Blob([linksContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'archive-extracted-links.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success('Downloaded archive links')
  }, [batchResult])

  const handleCopyArchiveLinks = useCallback(() => {
    if (!batchResult) return

    const linksContent = batchResult.totalLinks.join('\n')
    navigator.clipboard.writeText(linksContent).then(() => {
      toast.success(`Copied ${batchResult.totalLinks.length} links to clipboard`)
    }).catch(() => {
      toast.error('Failed to copy links')
    })
  }, [batchResult])

  const handleDownloadKodiAddon = useCallback(async () => {
    if (!kodiAddonUrl.trim()) {
      toast.error('Please enter a Kodi addon URL')
      return
    }

    setIsDownloadingAddon(true)
    setAddonResult(null)

    toast.loading('Downloading Kodi addon...', { id: 'kodi-download' })

    try {
      const result = await downloadKodiAddon(kodiAddonUrl)
      setAddonResult(result)
      setIsDownloadingAddon(false)

      if (result.error) {
        toast.error(result.error, { id: 'kodi-download' })
      } else {
        toast.success(
          `Downloaded ${result.addon.name} - found ${result.links.length} links`,
          { id: 'kodi-download' }
        )
      }
    } catch (error) {
      setIsDownloadingAddon(false)
      toast.error('Failed to download Kodi addon', { id: 'kodi-download' })
      console.error('Kodi download error:', error)
    }
  }, [kodiAddonUrl])

  const handleDownloadAddonReport = useCallback(async () => {
    if (!addonResult) return

    const report = await generateKodiAddonReport(addonResult)
    const blob = new Blob([report], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${addonResult.addon.name}_report.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success('Downloaded addon report')
  }, [addonResult])

  const handleDownloadAddonAsZip = useCallback(async () => {
    if (!addonResult) return

    toast.loading('Creating addon archive...', { id: 'addon-zip' })

    try {
      const blob = await exportKodiAddonAsZip(addonResult)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${addonResult.addon.name}_addon.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success('Downloaded addon archive', { id: 'addon-zip' })
    } catch (error) {
      toast.error('Failed to create addon archive', { id: 'addon-zip' })
      console.error('Addon zip error:', error)
    }
  }, [addonResult])

  const handleCopyAddonLinks = useCallback(() => {
    if (!addonResult) return

    const linksContent = addonResult.links.join('\n')
    navigator.clipboard.writeText(linksContent).then(() => {
      toast.success(`Copied ${addonResult.links.length} links to clipboard`)
    }).catch(() => {
      toast.error('Failed to copy links')
    })
  }, [addonResult])

  return (
    <div className="space-y-6">
      <Separator className="bg-border" />

      <Tabs defaultValue="archives" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-primary/30">
          <TabsTrigger value="archives">
            <FileArchive size={18} className="mr-2" />
            Batch Archive Scanner
          </TabsTrigger>
          <TabsTrigger value="kodi">
            <Package size={18} className="mr-2" />
            Kodi Addon Downloader
          </TabsTrigger>
        </TabsList>

        <TabsContent value="archives" className="mt-6 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FileArchive size={24} className="text-accent" />
              <h3 className="text-lg font-bold text-foreground">Batch Archive Scanner</h3>
            </div>

            <p className="text-sm text-muted-foreground">
              Scan multiple archive files at once. Supports ZIP, 7Z, BZ2, RAR, TAR, TAR.GZ, and TGZ formats. 
              Automatically extracts and analyzes all files for media links.
            </p>

            <input
              type="file"
              multiple
              onChange={handleArchiveUpload}
              ref={archiveInputRef}
              className="hidden"
              accept=".zip,.7z,.bz2,.rar,.tar,.gz,.tgz,.tar.gz"
            />

            <Button
              onClick={() => archiveInputRef.current?.click()}
              disabled={isScanning}
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <FolderOpen size={20} className="mr-2" />
              {isScanning ? 'Scanning Archives...' : 'Select Archive Files'}
            </Button>

            {isScanning && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-3"
              >
                <div className="flex items-center gap-3 text-accent">
                  <MagnifyingGlass size={20} className="animate-pulse" />
                  <span className="text-sm font-medium">Scanning archives...</span>
                </div>
                <Progress value={scanProgress} className="h-2" />
              </motion.div>
            )}

            {batchResult && !isScanning && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="flex flex-wrap gap-3">
                  <Badge variant="outline" className="px-4 py-2 text-sm font-mono border-accent/30 text-accent">
                    <CheckCircle size={16} className="mr-2" weight="fill" />
                    {batchResult.successCount} successful
                  </Badge>
                  {batchResult.errorCount > 0 && (
                    <Badge variant="outline" className="px-4 py-2 text-sm font-mono border-destructive/30 text-destructive">
                      <Warning size={16} className="mr-2" weight="fill" />
                      {batchResult.errorCount} failed
                    </Badge>
                  )}
                  <Badge variant="outline" className="px-4 py-2 text-sm font-mono border-border text-muted-foreground">
                    <File size={16} className="mr-2" />
                    {batchResult.totalFiles} files
                  </Badge>
                  <Badge variant="outline" className="px-4 py-2 text-sm font-mono border-border text-muted-foreground">
                    <Database size={16} className="mr-2" />
                    {batchResult.totalLinks.length} unique links
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={handleDownloadArchiveLinks}
                    variant="outline"
                    size="sm"
                    className="border-accent/30 hover:bg-accent/10 text-accent"
                    disabled={batchResult.totalLinks.length === 0}
                  >
                    <DownloadSimple size={16} className="mr-1" />
                    Download Links
                  </Button>
                  <Button
                    onClick={handleCopyArchiveLinks}
                    variant="outline"
                    size="sm"
                    className="border-accent/30 hover:bg-accent/10 text-accent"
                    disabled={batchResult.totalLinks.length === 0}
                  >
                    <CopySimple size={16} className="mr-1" />
                    Copy Links
                  </Button>
                  <Button
                    onClick={handleDownloadArchiveReport}
                    variant="outline"
                    size="sm"
                    className="border-accent/30 hover:bg-accent/10 text-accent"
                  >
                    <FileArrowDown size={16} className="mr-1" />
                    Download Report
                  </Button>
                </div>

                <ScrollArea className="h-[300px] rounded-md border border-border bg-primary/30 p-4">
                  <div className="space-y-3">
                    {batchResult.archives.map((archive, index) => (
                      <motion.div
                        key={`${archive.archiveName}-${index}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: Math.min(index * 0.05, 1) }}
                        className="p-3 rounded hover:bg-accent/10 transition-colors duration-100 cursor-pointer"
                        onClick={() => setSelectedArchive(archive)}
                      >
                        <div className="flex items-start gap-3">
                          <FileArchive size={20} className="text-accent shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-foreground break-all">{archive.archiveName}</div>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs uppercase border-accent/30 text-accent">
                                {archive.format}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {archive.totalFiles} files
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {(archive.totalSize / 1024).toFixed(2)} KB
                              </Badge>
                              {archive.links.length > 0 && (
                                <Badge variant="outline" className="text-xs border-green-500/30 text-green-500">
                                  {archive.links.length} links
                                </Badge>
                              )}
                            </div>
                            {archive.error && (
                              <div className="text-xs text-destructive mt-1">
                                {archive.error}
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>

                {selectedArchive && (
                  <Alert className="border-accent/30 bg-accent/5">
                    <AlertDescription>
                      <div className="space-y-2 text-sm">
                        <div className="font-semibold text-foreground">Selected: {selectedArchive.archiveName}</div>
                        <div className="text-muted-foreground">
                          Format: {selectedArchive.format.toUpperCase()} • Files: {selectedArchive.totalFiles} • 
                          Links: {selectedArchive.links.length}
                        </div>
                        {selectedArchive.files.length > 0 && (
                          <div className="pt-2">
                            <div className="text-xs font-semibold text-foreground mb-1">Files:</div>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {selectedArchive.files.slice(0, 10).map((file, i) => (
                                <div key={i} className="text-xs font-mono text-muted-foreground">
                                  {file.path}
                                </div>
                              ))}
                              {selectedArchive.files.length > 10 && (
                                <div className="text-xs text-muted-foreground">
                                  ... and {selectedArchive.files.length - 10} more files
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </motion.div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="kodi" className="mt-6 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Package size={24} className="text-accent" />
              <h3 className="text-lg font-bold text-foreground">Kodi Addon Downloader</h3>
            </div>

            <p className="text-sm text-muted-foreground">
              Download Kodi addons from GitHub, GitLab, or direct URLs. Automatically extracts addon files, 
              configuration, and media links. Perfect for analyzing IPTV and streaming addons.
            </p>

            <div className="space-y-3">
              <Textarea
                id="kodi-addon-url"
                placeholder="https://github.com/username/kodi.addon.name&#10;https://gitlab.com/username/addon&#10;https://example.com/addon.zip"
                value={kodiAddonUrl}
                onChange={(e) => setKodiAddonUrl(e.target.value)}
                className="font-mono text-sm min-h-[100px]"
                disabled={isDownloadingAddon}
              />

              <Button
                onClick={handleDownloadKodiAddon}
                disabled={isDownloadingAddon || !kodiAddonUrl.trim()}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <DownloadSimple size={20} className="mr-2" />
                {isDownloadingAddon ? 'Downloading Addon...' : 'Download & Analyze Addon'}
              </Button>
            </div>

            {popularRepos.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-foreground">Popular Repositories:</div>
                <div className="flex flex-wrap gap-2">
                  {popularRepos.map((repo, index) => (
                    <Button
                      key={index}
                      onClick={() => setKodiAddonUrl(repo.url)}
                      variant="outline"
                      size="sm"
                      className="border-accent/30 hover:bg-accent/10 text-accent"
                    >
                      <Sparkle size={14} className="mr-1" weight="fill" />
                      {repo.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {addonResult && !isDownloadingAddon && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <Card className="bg-card border-accent/30 p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-lg font-bold text-foreground">{addonResult.addon.name}</div>
                        {addonResult.addon.version && (
                          <div className="text-sm text-muted-foreground">Version: {addonResult.addon.version}</div>
                        )}
                        {addonResult.addon.author && (
                          <div className="text-sm text-muted-foreground">Author: {addonResult.addon.author}</div>
                        )}
                      </div>
                      <Badge variant="outline" className="border-accent/30 text-accent shrink-0">
                        {addonResult.addon.id}
                      </Badge>
                    </div>

                    {addonResult.addon.description && (
                      <p className="text-sm text-muted-foreground">{addonResult.addon.description}</p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="text-xs">
                        <File size={12} className="mr-1" />
                        {addonResult.files.length} files
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        <Database size={12} className="mr-1" />
                        {addonResult.configFiles.length} configs
                      </Badge>
                      {addonResult.links.length > 0 && (
                        <Badge variant="outline" className="text-xs border-green-500/30 text-green-500">
                          <CheckCircle size={12} className="mr-1" weight="fill" />
                          {addonResult.links.length} links
                        </Badge>
                      )}
                    </div>

                    {addonResult.error && (
                      <Alert className="border-destructive/30 bg-destructive/5">
                        <AlertDescription className="text-destructive text-sm">
                          {addonResult.error}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </Card>

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={handleDownloadAddonAsZip}
                    variant="outline"
                    size="sm"
                    className="border-accent/30 hover:bg-accent/10 text-accent"
                  >
                    <FileZip size={16} className="mr-1" />
                    Download as ZIP
                  </Button>
                  <Button
                    onClick={handleDownloadAddonReport}
                    variant="outline"
                    size="sm"
                    className="border-accent/30 hover:bg-accent/10 text-accent"
                  >
                    <FileArrowDown size={16} className="mr-1" />
                    Download Report
                  </Button>
                  {addonResult.links.length > 0 && (
                    <Button
                      onClick={handleCopyAddonLinks}
                      variant="outline"
                      size="sm"
                      className="border-accent/30 hover:bg-accent/10 text-accent"
                    >
                      <CopySimple size={16} className="mr-1" />
                      Copy Links
                    </Button>
                  )}
                </div>

                {addonResult.links.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-foreground">Extracted Media Links:</div>
                    <ScrollArea className="h-[200px] rounded-md border border-border bg-primary/30 p-4">
                      <div className="space-y-2 font-mono text-xs">
                        {addonResult.links.map((link, index) => (
                          <div key={index} className="text-accent break-all hover:bg-accent/10 p-1 rounded">
                            {link}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {addonResult.configFiles.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-foreground">Configuration Files:</div>
                    <ScrollArea className="h-[150px] rounded-md border border-border bg-primary/30 p-4">
                      <div className="space-y-2">
                        {addonResult.configFiles.map((config, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm">
                            <File size={14} className="text-accent" />
                            <span className="font-mono text-foreground">{config.name}</span>
                            <Badge variant="outline" className="text-xs uppercase">
                              {config.type}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
