import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { UploadSimple, DownloadSimple, Trash, CheckCircle, MagnifyingGlass, Copy, FileText, Package, VideoCamera, MusicNote, FunnelSimple, CaretRight, CaretDown, File, Television, List, SquaresFour, CopySimple, SortAscending, SortDescending, PlayCircle, StopCircle, Warning, Clock, Question, Pulse, Gauge, Play, Plus, FilmSlate, Broadcast, StackSimple, CheckSquare, Square, PencilSimple, X, FileArrowUp, FileArrowDown, Database, Globe, Key, Lock, LockOpen, Sparkle, PaperPlaneTilt, ArrowDown, ArrowUp, Moon, Sun, Desktop } from '@phosphor-icons/react'
import { extractLinks, generateTextFile, generateUniqueLinksFile, generateDuplicatesFile, generateBatchDownload, getMediaType, detectContentType, scanFiles, parseM3UWithMetadata, generateClassificationsBackup, parseClassificationsBackup, mergeClassificationsBackups, generateMergedClassificationsBackup, scanAPK, extractConfigFilesFromPackage, generateConfigFilesArchive, scanWebUrls, scanPlaylistUrls, scanXtreamCodesAPI, convertXtreamCodesToLinks, scanRepositoryUrls, scanZipFile, parseKodiFile, scanConfigFilesForLinks, type ScanResult, type ContentType, type ConfigFile, type PlaylistScanResult, type PlaylistAuthCredentials, type XtreamCodesCredentials, type XtreamCodesScanResult, type RepositoryScanResult, type ZipFileScanResult } from '@/lib/linkExtractor'
import { generateM3UsByCategory, generateCustomM3UsByCategory, downloadM3UFile, generateM3UBatchDownload, generateAdvancedM3UContent, generateM3UWithValidationStatus, type M3UGenerationResult, type CustomM3UGenerationResult } from '@/lib/m3uGenerator'
import { parseEPG, generateEPGChannelsFile, generateEPGProgrammesFile, generateEPGChannelURLsFile, type EPGData } from '@/lib/epgParser'
import { validateUrls, generateValidationReport, getValidationStats, DEFAULT_CONCURRENT_VALIDATIONS, MIN_CONCURRENT_VALIDATIONS, MAX_CONCURRENT_VALIDATIONS, type ValidationResult, type ValidationStatus } from '@/lib/urlValidator'
import { queryGemini, analyzeUrl, findPlaylistSources, type GeminiQueryResult } from '@/lib/geminiAssistant'
import { Slider } from '@/components/ui/slider'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { MediaPlayer, type QueueItem } from '@/components/MediaPlayer'
import { CrawlerManager } from '@/components/CrawlerManager'
import { ArchiveManager } from '@/components/ArchiveManager'
import { AddonComparison } from '@/components/AddonComparison'
import { RepositoryAutoScraper } from '@/components/RepositoryAutoScraper'
import { ScrapingRulesManager } from '@/components/ScrapingRulesManager'
import { PaginationManager } from '@/components/PaginationManager'
import { AnimatedRabbit, RabbitLoader, RabbitSuccess, RabbitThinking, RabbitSleeping } from '@/components/AnimatedRabbit'
import { ProviderPresets } from '@/components/ProviderPresets'
import { BulkPlaylistGenerator } from '@/components/BulkPlaylistGenerator'
import { ProtocolFilters } from '@/components/ProtocolFilters'
import { PatternGenerator } from '@/components/PatternGenerator'
import { PatternLibrary } from '@/components/PatternLibrary'
import { PatternRepository } from '@/components/PatternRepository'
import { CommunityPatternHub } from '@/components/CommunityPatternHub'
import { HealthCheckMonitor } from '@/components/HealthCheckMonitor'
import { AndroidMediaServer } from '@/components/AndroidMediaServer'
import { StremioIntegration } from '@/components/StremioIntegration'
import { ConfigSimulator } from '@/components/ConfigSimulator'
import { ApkDeepScanner } from '@/components/ApkDeepScanner'

type MediaFilter = 'all' | 'video' | 'audio'
type ContentTypeFilter = 'all' | 'movie' | 'tv-series' | 'live-tv' | 'vod' | 'unknown'
type ChannelViewMode = 'list' | 'grid'
type ChannelUrlFilter = 'all' | 'with-urls' | 'without-urls'
type SortOption = 'count-desc' | 'count-asc' | 'alpha-asc' | 'alpha-desc' | 'category-asc' | 'category-desc'
type ValidationFilter = 'all' | 'working' | 'broken' | 'pending' | 'timeout' | 'unknown'

const getPlatformColor = (platform: string): string => {
  switch (platform) {
    case 'github': return 'border-purple-500/30 text-purple-400'
    case 'gitlab': return 'border-orange-500/30 text-orange-400'
    case 'bitbucket': return 'border-blue-500/30 text-blue-400'
    case 'gitea': return 'border-green-500/30 text-green-400'
    case 'codeberg': return 'border-cyan-500/30 text-cyan-400'
    case 'sourcehut': return 'border-yellow-500/30 text-yellow-400'
    default: return 'border-accent/30 text-accent'
  }
}


function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode')
    if (saved !== null) {
      return JSON.parse(saved)
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [isDragging, setIsDragging] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all')
  const [contentTypeFilter, setContentTypeFilter] = useState<ContentTypeFilter>('all')
  const [expandedLinks, setExpandedLinks] = useState<Set<string>>(new Set())
  const [channelViewMode, setChannelViewMode] = useState<ChannelViewMode>('list')
  const [channelUrlFilter, setChannelUrlFilter] = useState<ChannelUrlFilter>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [sortOption, setSortOption] = useState<SortOption>('count-desc')
  const [isValidating, setIsValidating] = useState(false)
  const [validationProgress, setValidationProgress] = useState(0)
  const [validationResults, setValidationResults] = useState<Map<string, ValidationResult>>(new Map())
  const [validationFilter, setValidationFilter] = useState<ValidationFilter>('all')
  const [concurrentRequests, setConcurrentRequests] = useState(DEFAULT_CONCURRENT_VALIDATIONS)
  const [validationRate, setValidationRate] = useState(0)
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(0)
  const validationAbortController = useRef<AbortController | null>(null)
  const [playlistQueue, setPlaylistQueue] = useState<QueueItem[]>([])
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0)
  const [showPlayer, setShowPlayer] = useState(false)
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set())
  const [bulkEditMode, setBulkEditMode] = useState(false)
  const [bulkEditContentType, setBulkEditContentType] = useState<ContentType>('movie')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const classificationsInputRef = useRef<HTMLInputElement>(null)
  const mergeClassificationsInputRef = useRef<HTMLInputElement>(null)
  const [webUrls, setWebUrls] = useState('')
  const [isScanningSites, setIsScanningSites] = useState(false)
  const [siteProgress, setSiteProgress] = useState(0)
  const [playlistUrls, setPlaylistUrls] = useState('')
  const [isScanningPlaylists, setIsScanningPlaylists] = useState(false)
  const [playlistProgress, setPlaylistProgress] = useState(0)
  const [playlistResults, setPlaylistResults] = useState<PlaylistScanResult[]>([])
  const [showPlaylistResults, setShowPlaylistResults] = useState(false)
  const [playlistAuthCredentials, setPlaylistAuthCredentials] = useState<Map<string, PlaylistAuthCredentials>>(new Map())
  const [showAuthDialog, setShowAuthDialog] = useState(false)
  const [currentAuthUrl, setCurrentAuthUrl] = useState<string>('')
  const [authUsername, setAuthUsername] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authApiKey, setAuthApiKey] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [authType, setAuthType] = useState<'basic' | 'apikey' | 'token'>('basic')
  const [xtreamServerUrl, setXtreamServerUrl] = useState('')
  const [xtreamUsername, setXtreamUsername] = useState('')
  const [xtreamPassword, setXtreamPassword] = useState('')
  const [isScanningXtream, setIsScanningXtream] = useState(false)
  const [xtreamProgress, setXtreamProgress] = useState({ stage: '', current: 0, total: 4 })
  const [xtreamResult, setXtreamResult] = useState<XtreamCodesScanResult | null>(null)
  const [showXtreamResult, setShowXtreamResult] = useState(false)
  const [repositoryUrls, setRepositoryUrls] = useState('')
  const [isScanningRepos, setIsScanningRepos] = useState(false)
  const [repoProgress, setRepoProgress] = useState(0)
  const [repoResults, setRepoResults] = useState<RepositoryScanResult[]>([])
  const [showRepoResults, setShowRepoResults] = useState(false)
  const [showAIAssistant, setShowAIAssistant] = useState(false)
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiResponse, setAiResponse] = useState<GeminiQueryResult | null>(null)
  const [isAiThinking, setIsAiThinking] = useState(false)
  const [aiChatHistory, setAiChatHistory] = useState<Array<{ question: string; answer: string }>>([])
  const [autoValidateAfterScan, setAutoValidateAfterScan] = useState(false)
  const [shouldTriggerValidation, setShouldTriggerValidation] = useState(false)
  const [isFollowingSystem, setIsFollowingSystem] = useState(() => {
    return localStorage.getItem('darkMode') === null
  })
  const [showThemeHint, setShowThemeHint] = useState(() => {
    return localStorage.getItem('themeHintShown') !== 'true' && localStorage.getItem('darkMode') === null
  })
  const [m3uGenerationResult, setM3uGenerationResult] = useState<M3UGenerationResult | CustomM3UGenerationResult | null>(null)
  const [showM3UDialog, setShowM3UDialog] = useState(false)
  const [showCustomM3UDialog, setShowCustomM3UDialog] = useState(false)
  const [customM3UMoviesName, setCustomM3UMoviesName] = useState('My Movies')
  const [customM3UMoviesDesc, setCustomM3UMoviesDesc] = useState('')
  const [customM3UTVSeriesName, setCustomM3UTVSeriesName] = useState('My TV Shows')
  const [customM3UTVSeriesDesc, setCustomM3UTVSeriesDesc] = useState('')
  const [customM3ULiveTVName, setCustomM3ULiveTVName] = useState('My Live TV')
  const [customM3ULiveTVDesc, setCustomM3ULiveTVDesc] = useState('')
  const [customM3UAllName, setCustomM3UAllName] = useState('My Complete Collection')
  const [customM3UAllDesc, setCustomM3UAllDesc] = useState('')
  const [customM3USortBy, setCustomM3USortBy] = useState<'title' | 'category' | 'url' | 'none'>('none')
  const [customM3UGroupByCategory, setCustomM3UGroupByCategory] = useState(false)

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode))
  }, [isDarkMode])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      const saved = localStorage.getItem('darkMode')
      if (saved === null) {
        setIsDarkMode(e.matches)
        setIsFollowingSystem(true)
        toast.info(`System theme changed to ${e.matches ? 'Dark' : 'Light'} mode`, { 
          duration: 2000,
          id: 'system-theme-change'
        })
      }
    }
    
    mediaQuery.addEventListener('change', handleSystemThemeChange)
    
    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange)
    }
  }, [])

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode(prev => {
      const newValue = !prev
      localStorage.setItem('darkMode', JSON.stringify(newValue))
      setIsFollowingSystem(false)
      return newValue
    })
  }, [])

  const resetToSystemTheme = useCallback(() => {
    localStorage.removeItem('darkMode')
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    setIsDarkMode(systemPrefersDark)
    setIsFollowingSystem(true)
    toast.success(`Following system theme (${systemPrefersDark ? 'Dark' : 'Light'} mode)`)
  }, [])

  const dismissThemeHint = useCallback(() => {
    setShowThemeHint(false)
    localStorage.setItem('themeHintShown', 'true')
  }, [])

  const processFiles = useCallback(async (items: FileList | DataTransferItemList) => {
    setIsScanning(true)
    setScanProgress(0)
    
    toast.loading('Scanning files and folders...', { id: 'scan-status' })
    
    const files = await scanFiles(items)
    
    if (files.length === 0) {
      setIsScanning(false)
      toast.error('No supported files found', { id: 'scan-status' })
      return
    }
    
    toast.loading(`Processing ${files.length} files...`, { id: 'scan-status' })
    
    const allLinks: string[] = []
    const linkToFilePathsMap = new Map<string, string[]>()
    const linkToMetadataMap = new Map<string, { title?: string, category?: string }>()
    const totalFiles = files.length
    let combinedEPGData: EPGData | undefined
    let allConfigFiles: ConfigFile[] = []
    
    for (let i = 0; i < totalFiles; i++) {
      const file = files[i]
      try {
        const fileName = file.name.toLowerCase()
        const isAndroidPackage = fileName.endsWith('.apk') || fileName.endsWith('.aab') || 
                                  fileName.endsWith('.xapk') || fileName.endsWith('.apks') || 
                                  fileName.endsWith('.apkm') || fileName.endsWith('.apex') || 
                                  fileName.endsWith('.apkx')
        
        const isArchiveFile = fileName.endsWith('.zip') || fileName.endsWith('.rar') || 
                              fileName.endsWith('.tar') || fileName.endsWith('.tar.gz') || 
                              fileName.endsWith('.tgz') || fileName.endsWith('.gz')
        
        const isExeFile = fileName.endsWith('.exe')
        
        if (isArchiveFile || isExeFile) {
          const zipResult = await scanZipFile(file)
          
          if (zipResult.error) {
            console.error(`Failed to scan ZIP ${file.name}:`, zipResult.error)
          } else {
            allLinks.push(...zipResult.links)
            
            zipResult.links.forEach(link => {
              const paths = linkToFilePathsMap.get(link) || []
              const filePath = (file as any).webkitRelativePath || file.name
              if (!paths.includes(filePath)) {
                paths.push(filePath)
              }
              linkToFilePathsMap.set(link, paths)
            })
            
            zipResult.linksWithMetadata.forEach(entry => {
              if (entry.category || entry.title) {
                linkToMetadataMap.set(entry.url, {
                  title: entry.title,
                  category: entry.category
                })
              }
            })
            
            allConfigFiles.push(...zipResult.configFiles)
          }
        } else if (isAndroidPackage) {
          const apkLinks = await scanAPK(file)
          allLinks.push(...apkLinks)
          
          apkLinks.forEach(link => {
            const paths = linkToFilePathsMap.get(link) || []
            const filePath = (file as any).webkitRelativePath || file.name
            if (!paths.includes(filePath)) {
              paths.push(filePath)
            }
            linkToFilePathsMap.set(link, paths)
          })

          const configFiles = await extractConfigFilesFromPackage(file)
          allConfigFiles.push(...configFiles)
        } else {
          const content = await file.text()
        
        const isKodiFile = fileName.endsWith('.xsp') || fileName.endsWith('.nfo') || 
                           fileName.endsWith('.strm') || fileName.endsWith('.py') ||
                           fileName === 'addon.xml' || fileName === 'sources.xml' ||
                           fileName === 'favourites.xml' || fileName === 'advancedsettings.xml' ||
                           fileName === 'playercorefactory.xml' || fileName.includes('addon')
        
        if (isKodiFile) {
          const kodiLinks = parseKodiFile(content, file.name)
          allLinks.push(...kodiLinks)
          
          kodiLinks.forEach(link => {
            const paths = linkToFilePathsMap.get(link) || []
            const filePath = (file as any).webkitRelativePath || file.name
            if (!paths.includes(filePath)) {
              paths.push(filePath)
            }
            linkToFilePathsMap.set(link, paths)
          })
        }
        
        const epgData = parseEPG(content)
        if (epgData) {
          if (!combinedEPGData) {
            combinedEPGData = {
              channels: [],
              programmes: [],
              channelCount: 0,
              programmeCount: 0,
              categories: []
            }
          }
          
          epgData.channels.forEach(channel => {
            if (!combinedEPGData!.channels.some(ch => ch.id === channel.id)) {
              combinedEPGData!.channels.push(channel)
            }
          })
          combinedEPGData.programmes.push(...epgData.programmes)
          combinedEPGData.channelCount = combinedEPGData.channels.length
          combinedEPGData.programmeCount = combinedEPGData.programmes.length
          
          const allCategories = new Set<string>()
          combinedEPGData.channels.forEach(ch => {
            if (ch.category) allCategories.add(ch.category)
            if (ch.group) allCategories.add(ch.group)
          })
          combinedEPGData.programmes.forEach(prog => {
            if (prog.category) allCategories.add(prog.category)
          })
          combinedEPGData.categories = Array.from(allCategories).sort()
          
          epgData.channels.forEach(channel => {
            if (channel.url) {
              allLinks.push(channel.url)
              const filePath = (file as any).webkitRelativePath || file.name
              const paths = linkToFilePathsMap.get(channel.url) || []
              if (!paths.includes(filePath)) {
                paths.push(filePath)
              }
              linkToFilePathsMap.set(channel.url, paths)
              
              if (channel.category || channel.group) {
                linkToMetadataMap.set(channel.url, {
                  title: channel.displayName,
                  category: channel.category || channel.group
                })
              }
            }
          })
        }
        
        if (content.includes('#EXTINF') || content.includes('#EXTM3U')) {
          const m3uEntries = parseM3UWithMetadata(content)
          m3uEntries.forEach(entry => {
            allLinks.push(entry.url)
            const filePath = (file as any).webkitRelativePath || file.name
            const paths = linkToFilePathsMap.get(entry.url) || []
            if (!paths.includes(filePath)) {
              paths.push(filePath)
            }
            linkToFilePathsMap.set(entry.url, paths)
            
            if (entry.category || entry.title) {
              linkToMetadataMap.set(entry.url, {
                title: entry.title,
                category: entry.category
              })
            }
          })
        }
        
        const links = extractLinks(content)
        allLinks.push(...links)
        
        links.forEach(link => {
          const paths = linkToFilePathsMap.get(link) || []
          const filePath = (file as any).webkitRelativePath || file.name
          if (!paths.includes(filePath)) {
            paths.push(filePath)
          }
          linkToFilePathsMap.set(link, paths)
        })
        }
        
        setScanProgress(((i + 1) / totalFiles) * 100)
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error)
      }
    }
    
    const linkCountMap = new Map<string, number>()
    allLinks.forEach(link => {
      linkCountMap.set(link, (linkCountMap.get(link) || 0) + 1)
    })
    
    const linksWithCounts = Array.from(linkCountMap.entries())
      .map(([url, count]) => {
        const metadata = linkToMetadataMap.get(url)
        const mediaType = getMediaType(url)
        const contentType = detectContentType(url, metadata?.title, metadata?.category)
        return { 
          url, 
          count, 
          mediaType,
          contentType,
          filePaths: linkToFilePathsMap.get(url) || [],
          title: metadata?.title,
          category: metadata?.category
        }
      })
      .sort((a, b) => b.count - a.count)
    
    if (allConfigFiles.length > 0) {
      const { configFilesWithLinks } = scanConfigFilesForLinks(allConfigFiles)
      allConfigFiles = configFilesWithLinks.length > 0 ? configFilesWithLinks : allConfigFiles
    }
    
    const uniqueLinks = Array.from(linkCountMap.keys())
    const duplicateCount = allLinks.length - uniqueLinks.length
    const videoCount = linksWithCounts.filter(link => link.mediaType === 'video').length
    const audioCount = linksWithCounts.filter(link => link.mediaType === 'audio').length
    const movieCount = linksWithCounts.filter(link => link.contentType === 'movie').length
    const tvSeriesCount = linksWithCounts.filter(link => link.contentType === 'tv-series').length
    const liveTvCount = linksWithCounts.filter(link => link.contentType === 'live-tv').length
    
    setResult({
      links: uniqueLinks,
      linksWithCounts,
      fileCount: totalFiles,
      linkCount: allLinks.length,
      uniqueLinkCount: uniqueLinks.length,
      duplicateCount,
      videoCount,
      audioCount,
      movieCount,
      tvSeriesCount,
      liveTvCount,
      epgData: combinedEPGData,
      configFiles: allConfigFiles.length > 0 ? allConfigFiles : undefined
    })
    
    setIsScanning(false)
    
    if (uniqueLinks.length > 0 || combinedEPGData || allConfigFiles.length > 0) {
      const epgInfo = combinedEPGData ? ` and EPG data (${combinedEPGData.channelCount} channels, ${combinedEPGData.programmeCount} programmes)` : ''
      const configInfo = allConfigFiles.length > 0 ? ` and ${allConfigFiles.length} config files` : ''
      toast.success(`Found ${uniqueLinks.length} unique links${epgInfo}${configInfo} in ${totalFiles} files`, { id: 'scan-status' })
      
      if (autoValidateAfterScan && uniqueLinks.length > 0) {
        setShouldTriggerValidation(true)
      }
    } else {
      toast.error('No media links, EPG data, or config files found in the uploaded files', { id: 'scan-status' })
    }
  }, [autoValidateAfterScan])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      processFiles(e.dataTransfer.items)
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files)
    }
  }, [processFiles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files)
    }
  }, [processFiles])

  const handleDownload = useCallback(() => {
    if (!result || result.links.length === 0) return
    
    const blob = generateTextFile(result.linksWithCounts)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'media-links.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast.success('Downloaded media-links.txt')
  }, [result])

  const handleDownloadUnique = useCallback(() => {
    if (!result || result.links.length === 0) return
    
    const blob = generateUniqueLinksFile(result.linksWithCounts)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'unique-links.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast.success('Downloaded unique-links.txt')
  }, [result])

  const handleDownloadDuplicates = useCallback(() => {
    if (!result || result.duplicateCount === 0) return
    
    const blob = generateDuplicatesFile(result.linksWithCounts)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'duplicate-links.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast.success('Downloaded duplicate-links.txt')
  }, [result])

  const handleBatchDownload = useCallback(async () => {
    if (!result || result.links.length === 0) return
    
    try {
      toast.loading('Creating ZIP archive...', { id: 'batch-download' })
      
      const blob = await generateBatchDownload(result)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'media-links-batch.zip'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast.success('Downloaded media-links-batch.zip', { id: 'batch-download' })
    } catch (error) {
      toast.error('Failed to create batch download', { id: 'batch-download' })
      console.error('Batch download error:', error)
    }
  }, [result])

  const handleDownloadEPGChannels = useCallback(() => {
    if (!result?.epgData || result.epgData.channelCount === 0) return
    
    const blob = generateEPGChannelsFile(result.epgData)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'epg-channels.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast.success('Downloaded epg-channels.txt')
  }, [result])

  const handleDownloadEPGProgrammes = useCallback(() => {
    if (!result?.epgData || result.epgData.programmeCount === 0) return
    
    const blob = generateEPGProgrammesFile(result.epgData)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'epg-programmes.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast.success('Downloaded epg-programmes.txt')
  }, [result])

  const handleDownloadEPGChannelURLs = useCallback(() => {
    if (!result?.epgData) return
    
    const channelsWithUrls = result.epgData.channels.filter(ch => ch.url)
    if (channelsWithUrls.length === 0) {
      toast.error('No channel URLs found to download')
      return
    }
    
    const blob = generateEPGChannelURLsFile(result.epgData)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'epg-channel-urls.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast.success(`Downloaded epg-channel-urls.txt (${channelsWithUrls.length} URLs)`)
  }, [result])

  const handleDownloadConfigFiles = useCallback(async () => {
    if (!result?.configFiles || result.configFiles.length === 0) return
    
    try {
      toast.loading('Creating config files archive...', { id: 'config-download' })
      
      const packageName = result.configFiles[0].path.split('/')[0] || 'package'
      const blob = await generateConfigFilesArchive(result.configFiles, packageName)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `config-files-${packageName}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast.success(`Downloaded ${result.configFiles.length} config files`, { id: 'config-download' })
    } catch (error) {
      toast.error('Failed to create config files archive', { id: 'config-download' })
      console.error('Config download error:', error)
    }
  }, [result])

  const handleDownloadConfigAnalysisReport = useCallback(() => {
    if (!result?.configFiles || result.configFiles.length === 0) return
    
    try {
      toast.loading('Generating config analysis report...', { id: 'config-report' })
      
      const report: string[] = []
      report.push('=' .repeat(80))
      report.push('CONFIG FILE ANALYSIS REPORT')
      report.push('=' .repeat(80))
      report.push('')
      report.push(`Generated: ${new Date().toISOString()}`)
      report.push(`Total Config Files: ${result.configFiles.length}`)
      
      const filesWithLinks = result.configFiles.filter(f => f.hasMediaLinks && f.linksFound && f.linksFound > 0)
      const filesWithoutLinks = result.configFiles.filter(f => !f.hasMediaLinks || !f.linksFound || f.linksFound === 0)
      const totalLinksFound = result.configFiles.reduce((sum, f) => sum + (f.linksFound || 0), 0)
      
      report.push(`Files with Media Links: ${filesWithLinks.length}`)
      report.push(`Files without Media Links: ${filesWithoutLinks.length}`)
      report.push(`Total Media Links Found: ${totalLinksFound}`)
      report.push('')
      report.push('=' .repeat(80))
      
      const configsByType = new Map<string, typeof result.configFiles>()
      result.configFiles.forEach(file => {
        const existing = configsByType.get(file.type) || []
        existing.push(file)
        configsByType.set(file.type, existing)
      })
      
      report.push('')
      report.push('CONFIG FILES BY TYPE')
      report.push('-' .repeat(80))
      configsByType.forEach((files, type) => {
        const linksInType = files.reduce((sum, f) => sum + (f.linksFound || 0), 0)
        report.push(`${type.toUpperCase()}: ${files.length} files, ${linksInType} links`)
      })
      
      if (filesWithLinks.length > 0) {
        report.push('')
        report.push('=' .repeat(80))
        report.push('CONFIG FILES WITH MEDIA LINKS')
        report.push('=' .repeat(80))
        
        filesWithLinks.sort((a, b) => (b.linksFound || 0) - (a.linksFound || 0))
        
        filesWithLinks.forEach((file, index) => {
          report.push('')
          report.push(`[${index + 1}] ${file.path}`)
          report.push(`${'─'.repeat(80)}`)
          report.push(`Type: ${file.type.toUpperCase()}`)
          report.push(`Size: ${file.size.toLocaleString()} bytes`)
          report.push(`Media Links Found: ${file.linksFound}`)
          
          const linksInFile = result.linksWithCounts.filter(link => 
            link.filePaths.includes(file.path)
          )
          
          if (linksInFile.length > 0) {
            report.push('')
            report.push('EXTRACTED LINKS:')
            linksInFile.forEach((link, linkIndex) => {
              report.push(`  ${linkIndex + 1}. ${link.url}`)
              if (link.title) {
                report.push(`      Title: ${link.title}`)
              }
              if (link.category) {
                report.push(`      Category: ${link.category}`)
              }
              if (link.contentType && link.contentType !== 'unknown') {
                report.push(`      Type: ${link.contentType}`)
              }
            })
          }
        })
      }
      
      if (filesWithoutLinks.length > 0) {
        report.push('')
        report.push('=' .repeat(80))
        report.push('CONFIG FILES WITHOUT MEDIA LINKS')
        report.push('=' .repeat(80))
        
        filesWithoutLinks.forEach((file, index) => {
          report.push('')
          report.push(`[${index + 1}] ${file.path}`)
          report.push(`Type: ${file.type.toUpperCase()} | Size: ${file.size.toLocaleString()} bytes`)
        })
      }
      
      report.push('')
      report.push('=' .repeat(80))
      report.push('END OF REPORT')
      report.push('=' .repeat(80))
      
      const blob = new Blob([report.join('\n')], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
      a.download = `config-analysis-report-${timestamp}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast.success('Downloaded config analysis report', { id: 'config-report' })
    } catch (error) {
      toast.error('Failed to generate config analysis report', { id: 'config-report' })
      console.error('Config report error:', error)
    }
  }, [result])

  const handleScanConfigFiles = useCallback(() => {
    if (!result?.configFiles || result.configFiles.length === 0) return
    
    toast.loading('Scanning config files for media links...', { id: 'config-scan' })
    
    try {
      const { links, configFilesWithLinks, linkToConfigMap } = scanConfigFilesForLinks(result.configFiles)
      
      if (links.length === 0) {
        toast.info('No additional media links found in config files', { id: 'config-scan' })
        return
      }
      
      const existingUrls = new Set(result.links)
      const newLinks = links.filter(link => !existingUrls.has(link))
      
      if (newLinks.length === 0) {
        toast.info(`Found ${links.length} links in config files, but all were already in the results`, { id: 'config-scan' })
        return
      }
      
      const allLinks = [...result.linksWithCounts.map(l => l.url), ...newLinks]
      const linkCountMap = new Map<string, number>()
      
      result.linksWithCounts.forEach(link => {
        linkCountMap.set(link.url, link.count)
      })
      
      newLinks.forEach(link => {
        linkCountMap.set(link, 1)
      })
      
      const linkToFilePathsMap = new Map<string, string[]>()
      result.linksWithCounts.forEach(link => {
        linkToFilePathsMap.set(link.url, link.filePaths)
      })
      
      linkToConfigMap.forEach((configs, link) => {
        const paths = linkToFilePathsMap.get(link) || []
        configs.forEach(config => {
          if (!paths.includes(config)) {
            paths.push(config)
          }
        })
        linkToFilePathsMap.set(link, paths)
      })
      
      const linksWithCounts = Array.from(linkCountMap.entries())
        .map(([url, count]) => {
          const existing = result.linksWithCounts.find(l => l.url === url)
          if (existing) {
            return {
              ...existing,
              filePaths: linkToFilePathsMap.get(url) || existing.filePaths
            }
          }
          
          const mediaType = getMediaType(url)
          const contentType = detectContentType(url)
          return {
            url,
            count,
            mediaType,
            contentType,
            filePaths: linkToFilePathsMap.get(url) || []
          }
        })
        .sort((a, b) => b.count - a.count)
      
      const uniqueLinks = Array.from(linkCountMap.keys())
      const videoCount = linksWithCounts.filter(link => link.mediaType === 'video').length
      const audioCount = linksWithCounts.filter(link => link.mediaType === 'audio').length
      const movieCount = linksWithCounts.filter(link => link.contentType === 'movie').length
      const tvSeriesCount = linksWithCounts.filter(link => link.contentType === 'tv-series').length
      const liveTvCount = linksWithCounts.filter(link => link.contentType === 'live-tv').length
      
      setResult(prev => ({
        ...prev!,
        links: uniqueLinks,
        linksWithCounts,
        linkCount: prev!.linkCount + newLinks.length,
        uniqueLinkCount: uniqueLinks.length,
        duplicateCount: (prev!.linkCount + newLinks.length) - uniqueLinks.length,
        videoCount,
        audioCount,
        movieCount,
        tvSeriesCount,
        liveTvCount,
        configFiles: configFilesWithLinks
      }))
      
      toast.success(`Found ${newLinks.length} new media links in ${configFilesWithLinks.length} config files`, { id: 'config-scan' })
    } catch (error) {
      toast.error('Failed to scan config files', { id: 'config-scan' })
      console.error('Config scan error:', error)
    }
  }, [result])

  const handleSaveIndividualConfigFile = useCallback((configFile: ConfigFile) => {
    try {
      const blob = new Blob([configFile.content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const fileName = configFile.path.split('/').pop() || 'config-file.txt'
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast.success(`Downloaded ${fileName}`)
    } catch (error) {
      toast.error('Failed to download config file')
      console.error('Config file download error:', error)
    }
  }, [])

  const handleViewConfigFile = useCallback((configFile: ConfigFile) => {
    const newWindow = window.open('', '_blank')
    if (newWindow) {
      newWindow.document.write('<html><head><title>' + configFile.path + '</title>')
      newWindow.document.write('<style>body { font-family: monospace; white-space: pre-wrap; word-wrap: break-word; margin: 20px; background: #1a1a1a; color: #e0e0e0; } .header { background: #2a2a2a; padding: 10px; margin: -20px -20px 20px -20px; border-bottom: 2px solid #3a3a3a; } .path { color: #60a5fa; font-size: 14px; } .type { color: #34d399; font-size: 12px; margin-top: 5px; } .size { color: #f59e0b; font-size: 12px; margin-top: 5px; } .content { background: #0d0d0d; padding: 15px; border-radius: 5px; border: 1px solid #3a3a3a; }</style>')
      newWindow.document.write('</head><body>')
      newWindow.document.write('<div class="header">')
      newWindow.document.write('<div class="path">' + configFile.path + '</div>')
      newWindow.document.write('<div class="type">Type: ' + configFile.type.toUpperCase() + '</div>')
      newWindow.document.write('<div class="size">Size: ' + configFile.size.toLocaleString() + ' bytes</div>')
      newWindow.document.write('</div>')
      newWindow.document.write('<div class="content">' + configFile.content.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>')
      newWindow.document.write('</body></html>')
      newWindow.document.close()
    } else {
      toast.error('Failed to open config file viewer')
    }
  }, [])

  const handleClear = useCallback(() => {
    setResult(null)
    setScanProgress(0)
    setMediaFilter('all')
    setContentTypeFilter('all')
    setExpandedLinks(new Set())
    setChannelViewMode('list')
    setChannelUrlFilter('all')
    setSelectedCategory('all')
    setSortOption('count-desc')
    setValidationResults(new Map())
    setValidationProgress(0)
    setValidationFilter('all')
    setValidationRate(0)
    setEstimatedTimeRemaining(0)
    setSelectedUrls(new Set())
    setBulkEditMode(false)
    setWebUrls('')
    setSiteProgress(0)
    setPlaylistUrls('')
    setPlaylistProgress(0)
    setPlaylistResults([])
    setShowPlaylistResults(false)
    setXtreamServerUrl('')
    setXtreamUsername('')
    setXtreamPassword('')
    setXtreamResult(null)
    setShowXtreamResult(false)
    setRepositoryUrls('')
    setRepoProgress(0)
    setRepoResults([])
    setShowRepoResults(false)
    if (validationAbortController.current) {
      validationAbortController.current.abort()
      validationAbortController.current = null
    }
  }, [])

  const handleValidateUrls = useCallback(async () => {
    if (!result || result.links.length === 0) return
    
    validationAbortController.current = new AbortController()
    setIsValidating(true)
    setValidationProgress(0)
    setValidationResults(new Map())
    setValidationRate(0)
    setEstimatedTimeRemaining(0)
    
    toast.loading('Starting URL validation...', { id: 'validation-status' })
    
    try {
      const results = await validateUrls(
        result.links,
        (completed, total, currentResult, rate, timeRemaining) => {
          setValidationProgress((completed / total) * 100)
          setValidationResults(prev => new Map(prev).set(currentResult.url, currentResult))
          setValidationRate(rate)
          setEstimatedTimeRemaining(timeRemaining)
          
          if (completed % 10 === 0 || completed === total) {
            toast.loading(`Validating URLs: ${completed}/${total} (${rate.toFixed(1)} URLs/s)`, { id: 'validation-status' })
          }
        },
        validationAbortController.current.signal,
        concurrentRequests
      )
      
      const stats = getValidationStats(results)
      
      setResult(prev => {
        if (!prev) return prev
        
        const updatedLinksWithCounts = prev.linksWithCounts.map(link => {
          const validation = results.get(link.url)
          if (validation) {
            return {
              ...link,
              validationStatus: validation.status,
              responseTime: validation.responseTime,
              statusCode: validation.statusCode
            }
          }
          return link
        })
        
        return {
          ...prev,
          linksWithCounts: updatedLinksWithCounts
        }
      })
      
      setIsValidating(false)
      validationAbortController.current = null
      
      toast.success(
        `Validation complete: ${stats.working} working, ${stats.broken} broken, ${stats.timeout} timeout`,
        { id: 'validation-status' }
      )
    } catch (error) {
      setIsValidating(false)
      validationAbortController.current = null
      
      if (error instanceof Error && error.name === 'AbortError') {
        toast.info('Validation cancelled', { id: 'validation-status' })
      } else {
        toast.error('Validation failed', { id: 'validation-status' })
        console.error('Validation error:', error)
      }
    }
  }, [result, concurrentRequests])

  useEffect(() => {
    if (shouldTriggerValidation && result && result.links.length > 0 && !isValidating) {
      setShouldTriggerValidation(false)
      setTimeout(() => {
        handleValidateUrls()
      }, 500)
    }
  }, [shouldTriggerValidation, result, isValidating, handleValidateUrls])

  const handleStopValidation = useCallback(() => {
    if (validationAbortController.current) {
      validationAbortController.current.abort()
      validationAbortController.current = null
      setIsValidating(false)
      toast.info('Validation stopped')
    }
  }, [])

  const handleValidateEPGUrls = useCallback(async () => {
    if (!result?.epgData) return
    
    const channelsWithUrls = result.epgData.channels.filter(ch => ch.url)
    if (channelsWithUrls.length === 0) {
      toast.error('No channel URLs found to validate')
      return
    }
    
    validationAbortController.current = new AbortController()
    setIsValidating(true)
    setValidationProgress(0)
    setValidationRate(0)
    setEstimatedTimeRemaining(0)
    
    toast.loading('Starting EPG URL validation...', { id: 'validation-status' })
    
    try {
      const urls = channelsWithUrls.map(ch => ch.url!)
      const results = await validateUrls(
        urls,
        (completed, total, currentResult, rate, timeRemaining) => {
          setValidationProgress((completed / total) * 100)
          setValidationRate(rate)
          setEstimatedTimeRemaining(timeRemaining)
          
          if (completed % 10 === 0 || completed === total) {
            toast.loading(`Validating EPG URLs: ${completed}/${total} (${rate.toFixed(1)} URLs/s)`, { id: 'validation-status' })
          }
        },
        validationAbortController.current.signal,
        concurrentRequests
      )
      
      const stats = getValidationStats(results)
      
      setResult(prev => {
        if (!prev?.epgData) return prev
        
        const updatedChannels = prev.epgData.channels.map(channel => {
          if (channel.url) {
            const validation = results.get(channel.url)
            if (validation) {
              return {
                ...channel,
                validationStatus: validation.status,
                responseTime: validation.responseTime,
                statusCode: validation.statusCode
              }
            }
          }
          return channel
        })
        
        return {
          ...prev,
          epgData: {
            ...prev.epgData,
            channels: updatedChannels
          }
        }
      })
      
      setIsValidating(false)
      validationAbortController.current = null
      
      toast.success(
        `EPG validation complete: ${stats.working} working, ${stats.broken} broken, ${stats.timeout} timeout`,
        { id: 'validation-status' }
      )
    } catch (error) {
      setIsValidating(false)
      validationAbortController.current = null
      
      if (error instanceof Error && error.name === 'AbortError') {
        toast.info('Validation cancelled', { id: 'validation-status' })
      } else {
        toast.error('Validation failed', { id: 'validation-status' })
        console.error('Validation error:', error)
      }
    }
  }, [result, concurrentRequests])

  const handleDownloadValidationReport = useCallback(() => {
    if (validationResults.size === 0) return
    
    const report = generateValidationReport(validationResults)
    const blob = new Blob([report], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'validation-report.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast.success('Downloaded validation-report.txt')
  }, [validationResults])

  const handleCopyUrl = useCallback((url: string, e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(url).then(() => {
      toast.success('URL copied to clipboard')
    }).catch(() => {
      toast.error('Failed to copy URL')
    })
  }, [])

  const toggleLinkExpansion = useCallback((url: string) => {
    setExpandedLinks(prev => {
      const newSet = new Set(prev)
      if (newSet.has(url)) {
        newSet.delete(url)
      } else {
        newSet.add(url)
      }
      return newSet
    })
  }, [])

  const getValidationIcon = useCallback((status?: ValidationStatus) => {
    switch (status) {
      case 'working':
        return <CheckCircle size={16} className="text-green-500" weight="fill" />
      case 'broken':
        return <Warning size={16} className="text-red-500" weight="fill" />
      case 'timeout':
        return <Clock size={16} className="text-yellow-500" weight="fill" />
      case 'validating':
        return <Pulse size={16} className="text-accent animate-pulse" />
      case 'unknown':
        return <Question size={16} className="text-muted-foreground" />
      default:
        return null
    }
  }, [])

  const getContentTypeIcon = useCallback((contentType?: ContentType) => {
    switch (contentType) {
      case 'movie':
        return <FilmSlate size={16} className="text-purple-500" weight="fill" />
      case 'tv-series':
        return <StackSimple size={16} className="text-blue-500" weight="fill" />
      case 'live-tv':
        return <Broadcast size={16} className="text-red-500" weight="fill" />
      case 'vod':
        return <VideoCamera size={16} className="text-green-500" weight="fill" />
      default:
        return null
    }
  }, [])

  const getContentTypeLabel = useCallback((contentType?: ContentType): string => {
    switch (contentType) {
      case 'movie':
        return 'Movie'
      case 'tv-series':
        return 'TV Series'
      case 'live-tv':
        return 'Live TV'
      case 'vod':
        return 'VOD'
      default:
        return ''
    }
  }, [])

  const formatTimeRemaining = useCallback((seconds: number): string => {
    if (!isFinite(seconds) || seconds <= 0) return 'Calculating...'
    
    if (seconds < 60) {
      return `${Math.ceil(seconds)}s`
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60)
      const secs = Math.ceil(seconds % 60)
      return `${minutes}m ${secs}s`
    } else {
      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      return `${hours}h ${minutes}m`
    }
  }, [])

  const filteredLinksWithCounts = useMemo(() => {
    if (!result) return []
    let filtered = result.linksWithCounts
    
    if (mediaFilter !== 'all') {
      filtered = filtered.filter(link => link.mediaType === mediaFilter)
    }
    
    if (contentTypeFilter !== 'all') {
      filtered = filtered.filter(link => link.contentType === contentTypeFilter)
    }
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(link => link.category === selectedCategory)
    }
    
    if (validationFilter !== 'all') {
      filtered = filtered.filter(link => link.validationStatus === validationFilter)
    }
    
    const sorted = [...filtered]
    
    switch (sortOption) {
      case 'count-desc':
        sorted.sort((a, b) => b.count - a.count)
        break
      case 'count-asc':
        sorted.sort((a, b) => a.count - b.count)
        break
      case 'alpha-asc':
        sorted.sort((a, b) => {
          const aName = a.title || a.url
          const bName = b.title || b.url
          return aName.localeCompare(bName)
        })
        break
      case 'alpha-desc':
        sorted.sort((a, b) => {
          const aName = a.title || a.url
          const bName = b.title || b.url
          return bName.localeCompare(aName)
        })
        break
      case 'category-asc':
        sorted.sort((a, b) => {
          const aCategory = a.category || 'zzz'
          const bCategory = b.category || 'zzz'
          return aCategory.localeCompare(bCategory)
        })
        break
      case 'category-desc':
        sorted.sort((a, b) => {
          const aCategory = a.category || ''
          const bCategory = b.category || ''
          return bCategory.localeCompare(aCategory)
        })
        break
    }
    
    return sorted
  }, [result, mediaFilter, contentTypeFilter, selectedCategory, sortOption, validationFilter])

  const filteredUniqueLinks = useMemo(() => {
    if (!result) return []
    let filtered = result.links
    
    if (mediaFilter !== 'all') {
      filtered = filtered.filter(link => getMediaType(link) === mediaFilter)
    }
    
    if (selectedCategory !== 'all') {
      const categorizedUrls = new Set(
        result.linksWithCounts
          .filter(l => l.category === selectedCategory)
          .map(l => l.url)
      )
      filtered = filtered.filter(url => categorizedUrls.has(url))
    }
    
    return filtered
  }, [result, mediaFilter, selectedCategory])

  const filteredEPGChannels = useMemo(() => {
    if (!result?.epgData) return []
    let filtered = result.epgData.channels
    
    if (channelUrlFilter === 'with-urls') {
      filtered = filtered.filter(ch => ch.url)
    } else if (channelUrlFilter === 'without-urls') {
      filtered = filtered.filter(ch => !ch.url)
    }
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(ch => 
        ch.category === selectedCategory || ch.group === selectedCategory
      )
    }
    
    return filtered
  }, [result, channelUrlFilter, selectedCategory])
  
  const allCategories = useMemo(() => {
    if (!result) return []
    const categories = new Set<string>()
    
    result.linksWithCounts.forEach(link => {
      if (link.category) categories.add(link.category)
    })
    
    if (result.epgData) {
      result.epgData.categories.forEach(cat => categories.add(cat))
    }
    
    return Array.from(categories).sort()
  }, [result])

  const handleBulkCopyUrls = useCallback(() => {
    if (!result || result.links.length === 0) return
    
    const urlsToCopy = filteredLinksWithCounts.map(link => link.url).join('\n')
    navigator.clipboard.writeText(urlsToCopy).then(() => {
      toast.success(`Copied ${filteredLinksWithCounts.length} URLs to clipboard`)
    }).catch(() => {
      toast.error('Failed to copy URLs')
    })
  }, [result, filteredLinksWithCounts])

  const handleBulkCopyEPGUrls = useCallback(() => {
    if (!result?.epgData || result.epgData.channelCount === 0) return
    
    const channelsWithUrls = result.epgData.channels.filter(ch => ch.url)
    if (channelsWithUrls.length === 0) {
      toast.error('No channel URLs found to copy')
      return
    }
    
    const urlsToCopy = channelsWithUrls.map(channel => channel.url).join('\n')
    navigator.clipboard.writeText(urlsToCopy).then(() => {
      toast.success(`Copied ${channelsWithUrls.length} EPG channel URLs to clipboard`)
    }).catch(() => {
      toast.error('Failed to copy EPG channel URLs')
    })
  }, [result])

  const handlePlayMedia = useCallback((url: string, title?: string, mediaType?: 'video' | 'audio' | 'unknown') => {
    setPlaylistQueue([{
      url,
      title,
      mediaType: mediaType || 'unknown'
    }])
    setCurrentQueueIndex(0)
    setShowPlayer(true)
  }, [])

  const handleAddToQueue = useCallback((url: string, title?: string, mediaType?: 'video' | 'audio' | 'unknown') => {
    const newItem: QueueItem = {
      url,
      title,
      mediaType: mediaType || 'unknown'
    }
    
    setPlaylistQueue(prev => [...prev, newItem])
    toast.success(`Added "${title || 'Media'}" to queue`)
    
    if (!showPlayer) {
      setCurrentQueueIndex(0)
      setShowPlayer(true)
    }
  }, [showPlayer])

  const handlePlayAll = useCallback((items: { url: string; title?: string; mediaType: 'video' | 'audio' | 'unknown' }[]) => {
    if (items.length === 0) return
    
    setPlaylistQueue(items)
    setCurrentQueueIndex(0)
    setShowPlayer(true)
    toast.success(`Added ${items.length} items to queue`)
  }, [])

  const handleClosePlayer = useCallback(() => {
    setShowPlayer(false)
  }, [])

  const handleQueueChange = useCallback((newQueue: QueueItem[], newIndex: number) => {
    setPlaylistQueue(newQueue)
    setCurrentQueueIndex(newIndex)
  }, [])

  const toggleUrlSelection = useCallback((url: string) => {
    setSelectedUrls(prev => {
      const newSet = new Set(prev)
      if (newSet.has(url)) {
        newSet.delete(url)
      } else {
        newSet.add(url)
      }
      return newSet
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (selectedUrls.size === filteredLinksWithCounts.length) {
      setSelectedUrls(new Set())
    } else {
      setSelectedUrls(new Set(filteredLinksWithCounts.map(link => link.url)))
    }
  }, [selectedUrls.size, filteredLinksWithCounts])

  const handleBulkEditStart = useCallback(() => {
    if (selectedUrls.size === 0) {
      toast.error('Please select at least one link to edit')
      return
    }
    setBulkEditMode(true)
  }, [selectedUrls.size])

  const handleBulkEditCancel = useCallback(() => {
    setBulkEditMode(false)
    setSelectedUrls(new Set())
  }, [])

  const handleBulkEditApply = useCallback(() => {
    if (selectedUrls.size === 0) return

    setResult(prev => {
      if (!prev) return prev

      const updatedLinksWithCounts = prev.linksWithCounts.map(link => {
        if (selectedUrls.has(link.url)) {
          return {
            ...link,
            contentType: bulkEditContentType
          }
        }
        return link
      })

      const movieCount = updatedLinksWithCounts.filter(link => link.contentType === 'movie').length
      const tvSeriesCount = updatedLinksWithCounts.filter(link => link.contentType === 'tv-series').length
      const liveTvCount = updatedLinksWithCounts.filter(link => link.contentType === 'live-tv').length

      return {
        ...prev,
        linksWithCounts: updatedLinksWithCounts,
        movieCount,
        tvSeriesCount,
        liveTvCount
      }
    })

    toast.success(`Updated ${selectedUrls.size} ${selectedUrls.size === 1 ? 'link' : 'links'} to ${bulkEditContentType}`)
    setBulkEditMode(false)
    setSelectedUrls(new Set())
  }, [selectedUrls, bulkEditContentType])

  const handleExportClassifications = useCallback(() => {
    if (!result || result.links.length === 0) return

    const blob = generateClassificationsBackup(result.linksWithCounts)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `content-classifications-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    const classifiedCount = result.linksWithCounts.filter(link => link.contentType && link.contentType !== 'unknown').length
    toast.success(`Exported ${classifiedCount} content classifications`)
  }, [result])

  const handleImportClassifications = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    if (!result) {
      toast.error('Please scan files first before importing classifications')
      return
    }

    const file = e.target.files[0]
    try {
      const content = await file.text()
      const classificationsMap = parseClassificationsBackup(content)

      if (classificationsMap.size === 0) {
        toast.error('No valid classifications found in file')
        return
      }

      setResult(prev => {
        if (!prev) return prev

        let updatedCount = 0
        const updatedLinksWithCounts = prev.linksWithCounts.map(link => {
          const importedType = classificationsMap.get(link.url)
          if (importedType && importedType !== link.contentType) {
            updatedCount++
            return {
              ...link,
              contentType: importedType
            }
          }
          return link
        })

        const movieCount = updatedLinksWithCounts.filter(link => link.contentType === 'movie').length
        const tvSeriesCount = updatedLinksWithCounts.filter(link => link.contentType === 'tv-series').length
        const liveTvCount = updatedLinksWithCounts.filter(link => link.contentType === 'live-tv').length

        return {
          ...prev,
          linksWithCounts: updatedLinksWithCounts,
          movieCount,
          tvSeriesCount,
          liveTvCount
        }
      })

      const importedCount = classificationsMap.size
      toast.success(`Imported ${importedCount} classifications from backup`)
    } catch (error) {
      toast.error('Failed to import classifications')
      console.error('Import error:', error)
    }

    if (classificationsInputRef.current) {
      classificationsInputRef.current.value = ''
    }
  }, [result])

  const handleMergeClassifications = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return

    const files = Array.from(e.target.files)
    
    try {
      toast.loading(`Reading ${files.length} classification files...`, { id: 'merge-status' })
      
      const fileContents = await Promise.all(
        files.map(file => file.text())
      )

      const mergedMap = mergeClassificationsBackups(fileContents)

      if (mergedMap.size === 0) {
        toast.error('No valid classifications found in any file', { id: 'merge-status' })
        return
      }

      if (result && result.links.length > 0) {
        setResult(prev => {
          if (!prev) return prev

          let updatedCount = 0
          const updatedLinksWithCounts = prev.linksWithCounts.map(link => {
            const importedType = mergedMap.get(link.url)
            if (importedType && importedType !== link.contentType) {
              updatedCount++
              return {
                ...link,
                contentType: importedType
              }
            }
            return link
          })

          const movieCount = updatedLinksWithCounts.filter(link => link.contentType === 'movie').length
          const tvSeriesCount = updatedLinksWithCounts.filter(link => link.contentType === 'tv-series').length
          const liveTvCount = updatedLinksWithCounts.filter(link => link.contentType === 'live-tv').length

          return {
            ...prev,
            linksWithCounts: updatedLinksWithCounts,
            movieCount,
            tvSeriesCount,
            liveTvCount
          }
        })

        toast.success(
          `Merged ${files.length} files with ${mergedMap.size} total classifications and applied to current scan`,
          { id: 'merge-status' }
        )
      } else {
        const blob = generateMergedClassificationsBackup(mergedMap)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `merged-classifications-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        toast.success(
          `Merged ${files.length} files with ${mergedMap.size} total classifications and downloaded result`,
          { id: 'merge-status' }
        )
      }
    } catch (error) {
      toast.error('Failed to merge classification files', { id: 'merge-status' })
      console.error('Merge error:', error)
    }

    if (mergeClassificationsInputRef.current) {
      mergeClassificationsInputRef.current.value = ''
    }
  }, [result])

  const handleScanWebUrls = useCallback(async () => {
    const urlList = webUrls.split('\n').filter(url => url.trim())
    
    if (urlList.length === 0) {
      toast.error('Please enter at least one URL')
      return
    }

    setIsScanningSites(true)
    setSiteProgress(0)
    
    toast.loading(`Scanning ${urlList.length} web ${urlList.length === 1 ? 'URL' : 'URLs'}...`, { id: 'web-scan-status' })
    
    try {
      const scanResults = await scanWebUrls(urlList, (current, total) => {
        setSiteProgress((current / total) * 100)
      })
      
      const allLinks: string[] = []
      const linkToFilePathsMap = new Map<string, string[]>()
      let successCount = 0
      let errorCount = 0
      
      scanResults.forEach(result => {
        if (result.error) {
          errorCount++
          console.error(`Failed to scan ${result.url}:`, result.error)
        } else {
          successCount++
          result.links.forEach(link => {
            allLinks.push(link)
            const paths = linkToFilePathsMap.get(link) || []
            if (!paths.includes(result.url)) {
              paths.push(result.url)
            }
            linkToFilePathsMap.set(link, paths)
          })
        }
      })
      
      const linkCountMap = new Map<string, number>()
      allLinks.forEach(link => {
        linkCountMap.set(link, (linkCountMap.get(link) || 0) + 1)
      })
      
      const linksWithCounts = Array.from(linkCountMap.entries())
        .map(([url, count]) => {
          const mediaType = getMediaType(url)
          const contentType = detectContentType(url)
          return { 
            url, 
            count, 
            mediaType,
            contentType,
            filePaths: linkToFilePathsMap.get(url) || []
          }
        })
        .sort((a, b) => b.count - a.count)
      
      const uniqueLinks = Array.from(linkCountMap.keys())
      const duplicateCount = allLinks.length - uniqueLinks.length
      const videoCount = linksWithCounts.filter(link => link.mediaType === 'video').length
      const audioCount = linksWithCounts.filter(link => link.mediaType === 'audio').length
      const movieCount = linksWithCounts.filter(link => link.contentType === 'movie').length
      const tvSeriesCount = linksWithCounts.filter(link => link.contentType === 'tv-series').length
      const liveTvCount = linksWithCounts.filter(link => link.contentType === 'live-tv').length
      
      setResult({
        links: uniqueLinks,
        linksWithCounts,
        fileCount: successCount,
        linkCount: allLinks.length,
        uniqueLinkCount: uniqueLinks.length,
        duplicateCount,
        videoCount,
        audioCount,
        movieCount,
        tvSeriesCount,
        liveTvCount
      })
      
      setIsScanningSites(false)
      
      if (uniqueLinks.length > 0) {
        const errorMsg = errorCount > 0 ? ` (${errorCount} ${errorCount === 1 ? 'URL' : 'URLs'} failed)` : ''
        toast.success(`Found ${uniqueLinks.length} unique links from ${successCount} ${successCount === 1 ? 'website' : 'websites'}${errorMsg}`, { id: 'web-scan-status' })
      } else {
        toast.error(`No media links found${errorCount > 0 ? ` (${errorCount} ${errorCount === 1 ? 'URL' : 'URLs'} failed to scan)` : ''}`, { id: 'web-scan-status' })
      }
      
    } catch (error) {
      setIsScanningSites(false)
      toast.error('Web scan failed', { id: 'web-scan-status' })
      console.error('Web scan error:', error)
    }
  }, [webUrls])

  const handleScanPlaylistUrls = useCallback(async () => {
    const urlList = playlistUrls.split('\n').filter(url => url.trim())
    
    if (urlList.length === 0) {
      toast.error('Please enter at least one playlist URL')
      return
    }

    setIsScanningPlaylists(true)
    setPlaylistProgress(0)
    setPlaylistResults([])
    
    toast.loading(`Scanning ${urlList.length} playlist ${urlList.length === 1 ? 'URL' : 'URLs'}...`, { id: 'playlist-scan-status' })
    
    try {
      const scanResults = await scanPlaylistUrls(
        urlList, 
        (current, total) => {
          setPlaylistProgress((current / total) * 100)
        },
        playlistAuthCredentials
      )
      
      setPlaylistResults(scanResults)
      setShowPlaylistResults(true)
      
      const allLinks: string[] = []
      const linkToFilePathsMap = new Map<string, string[]>()
      const linkToMetadataMap = new Map<string, { title?: string, category?: string }>()
      let successCount = 0
      let errorCount = 0
      let combinedEPGData: EPGData | undefined
      
      scanResults.forEach(result => {
        if (result.error) {
          errorCount++
          console.error(`Failed to scan ${result.url}:`, result.error)
        } else {
          successCount++
          
          result.linksWithMetadata.forEach(entry => {
            allLinks.push(entry.url)
            const paths = linkToFilePathsMap.get(entry.url) || []
            if (!paths.includes(result.url)) {
              paths.push(result.url)
            }
            linkToFilePathsMap.set(entry.url, paths)
            
            if (entry.category || entry.title) {
              linkToMetadataMap.set(entry.url, {
                title: entry.title,
                category: entry.category
              })
            }
          })
          
          result.links.forEach(link => {
            if (!allLinks.includes(link)) {
              allLinks.push(link)
            }
            const paths = linkToFilePathsMap.get(link) || []
            if (!paths.includes(result.url)) {
              paths.push(result.url)
            }
            linkToFilePathsMap.set(link, paths)
          })
          
          if (result.epgData) {
            if (!combinedEPGData) {
              combinedEPGData = {
                channels: [],
                programmes: [],
                channelCount: 0,
                programmeCount: 0,
                categories: []
              }
            }
            
            result.epgData.channels.forEach(channel => {
              if (!combinedEPGData!.channels.some(ch => ch.id === channel.id)) {
                combinedEPGData!.channels.push(channel)
              }
              
              if (channel.url && !allLinks.includes(channel.url)) {
                allLinks.push(channel.url)
                const paths = linkToFilePathsMap.get(channel.url) || []
                if (!paths.includes(result.url)) {
                  paths.push(result.url)
                }
                linkToFilePathsMap.set(channel.url, paths)
                
                if (channel.category || channel.group) {
                  linkToMetadataMap.set(channel.url, {
                    title: channel.displayName,
                    category: channel.category || channel.group
                  })
                }
              }
            })
            
            combinedEPGData.programmes.push(...result.epgData.programmes)
            combinedEPGData.channelCount = combinedEPGData.channels.length
            combinedEPGData.programmeCount = combinedEPGData.programmes.length
            
            const allCategories = new Set<string>()
            combinedEPGData.channels.forEach(ch => {
              if (ch.category) allCategories.add(ch.category)
              if (ch.group) allCategories.add(ch.group)
            })
            combinedEPGData.programmes.forEach(prog => {
              if (prog.category) allCategories.add(prog.category)
            })
            combinedEPGData.categories = Array.from(allCategories).sort()
          }
        }
      })
      
      const linkCountMap = new Map<string, number>()
      allLinks.forEach(link => {
        linkCountMap.set(link, (linkCountMap.get(link) || 0) + 1)
      })
      
      const linksWithCounts = Array.from(linkCountMap.entries())
        .map(([url, count]) => {
          const metadata = linkToMetadataMap.get(url)
          const mediaType = getMediaType(url)
          const contentType = detectContentType(url, metadata?.title, metadata?.category)
          return { 
            url, 
            count, 
            mediaType,
            contentType,
            filePaths: linkToFilePathsMap.get(url) || [],
            title: metadata?.title,
            category: metadata?.category
          }
        })
        .sort((a, b) => b.count - a.count)
      
      const uniqueLinks = Array.from(linkCountMap.keys())
      const duplicateCount = allLinks.length - uniqueLinks.length
      const videoCount = linksWithCounts.filter(link => link.mediaType === 'video').length
      const audioCount = linksWithCounts.filter(link => link.mediaType === 'audio').length
      const movieCount = linksWithCounts.filter(link => link.contentType === 'movie').length
      const tvSeriesCount = linksWithCounts.filter(link => link.contentType === 'tv-series').length
      const liveTvCount = linksWithCounts.filter(link => link.contentType === 'live-tv').length
      
      setResult({
        links: uniqueLinks,
        linksWithCounts,
        fileCount: successCount,
        linkCount: allLinks.length,
        uniqueLinkCount: uniqueLinks.length,
        duplicateCount,
        videoCount,
        audioCount,
        movieCount,
        tvSeriesCount,
        liveTvCount,
        epgData: combinedEPGData
      })
      
      setIsScanningPlaylists(false)
      
      if (uniqueLinks.length > 0) {
        const epgInfo = combinedEPGData ? ` and EPG data (${combinedEPGData.channelCount} channels, ${combinedEPGData.programmeCount} programmes)` : ''
        const errorMsg = errorCount > 0 ? ` (${errorCount} ${errorCount === 1 ? 'URL' : 'URLs'} failed)` : ''
        toast.success(`Found ${uniqueLinks.length} unique links${epgInfo} from ${successCount} playlist${successCount !== 1 ? 's' : ''}${errorMsg}`, { id: 'playlist-scan-status' })
      } else {
        toast.error(`No media links found${errorCount > 0 ? ` (${errorCount} ${errorCount === 1 ? 'URL' : 'URLs'} failed to scan)` : ''}`, { id: 'playlist-scan-status' })
      }
      
    } catch (error) {
      setIsScanningPlaylists(false)
      toast.error('Playlist scan failed', { id: 'playlist-scan-status' })
      console.error('Playlist scan error:', error)
    }
  }, [playlistUrls, playlistAuthCredentials])

  const handleOpenAuthDialog = useCallback((url: string) => {
    setCurrentAuthUrl(url)
    const existing = playlistAuthCredentials.get(url)
    if (existing) {
      setAuthUsername(existing.username || '')
      setAuthPassword(existing.password || '')
      setAuthApiKey(existing.apiKey || '')
      setAuthToken(existing.token || '')
      if (existing.token) {
        setAuthType('token')
      } else if (existing.apiKey) {
        setAuthType('apikey')
      } else {
        setAuthType('basic')
      }
    } else {
      setAuthUsername('')
      setAuthPassword('')
      setAuthApiKey('')
      setAuthToken('')
      setAuthType('basic')
    }
    setShowAuthDialog(true)
  }, [playlistAuthCredentials])

  const handleSaveAuth = useCallback(() => {
    if (!currentAuthUrl) return

    const credentials: PlaylistAuthCredentials = {}
    
    if (authType === 'basic' && authUsername && authPassword) {
      credentials.username = authUsername
      credentials.password = authPassword
    } else if (authType === 'apikey' && authApiKey) {
      credentials.apiKey = authApiKey
    } else if (authType === 'token' && authToken) {
      credentials.token = authToken
    }

    setPlaylistAuthCredentials(prev => {
      const newMap = new Map(prev)
      if (Object.keys(credentials).length > 0) {
        newMap.set(currentAuthUrl, credentials)
      } else {
        newMap.delete(currentAuthUrl)
      }
      return newMap
    })

    setShowAuthDialog(false)
    toast.success('Authentication credentials saved')
  }, [currentAuthUrl, authType, authUsername, authPassword, authApiKey, authToken])

  const handleCancelAuth = useCallback(() => {
    setShowAuthDialog(false)
    setCurrentAuthUrl('')
    setAuthUsername('')
    setAuthPassword('')
    setAuthApiKey('')
    setAuthToken('')
    setAuthType('basic')
  }, [])

  const handleRemoveAuth = useCallback((url: string) => {
    setPlaylistAuthCredentials(prev => {
      const newMap = new Map(prev)
      newMap.delete(url)
      return newMap
    })
    toast.success('Authentication credentials removed')
  }, [])

  const handleScanXtreamCodes = useCallback(async () => {
    if (!xtreamServerUrl.trim() || !xtreamUsername.trim() || !xtreamPassword.trim()) {
      toast.error('Please enter server URL, username, and password')
      return
    }

    setIsScanningXtream(true)
    setXtreamProgress({ stage: 'Starting', current: 0, total: 4 })
    setXtreamResult(null)
    setShowXtreamResult(false)
    
    toast.loading('Connecting to Xtream Codes API...', { id: 'xtream-scan-status' })
    
    try {
      const credentials: XtreamCodesCredentials = {
        serverUrl: xtreamServerUrl,
        username: xtreamUsername,
        password: xtreamPassword
      }
      
      const scanResult = await scanXtreamCodesAPI(credentials, (stage, current, total) => {
        setXtreamProgress({ stage, current, total })
        toast.loading(`${stage}... (${current}/${total})`, { id: 'xtream-scan-status' })
      })
      
      setXtreamResult(scanResult)
      setShowXtreamResult(true)
      
      if (scanResult.success) {
        const convertedLinks = convertXtreamCodesToLinks(scanResult)
        
        const allLinks: string[] = []
        const linkToMetadataMap = new Map<string, { title?: string, category?: string }>()
        const linkToFilePathsMap = new Map<string, string[]>()
        
        convertedLinks.forEach(link => {
          allLinks.push(link.url)
          linkToMetadataMap.set(link.url, {
            title: link.title,
            category: link.category
          })
          linkToFilePathsMap.set(link.url, [`Xtream Codes API: ${scanResult.serverUrl}`])
        })
        
        const linkCountMap = new Map<string, number>()
        allLinks.forEach(link => {
          linkCountMap.set(link, (linkCountMap.get(link) || 0) + 1)
        })
        
        const linksWithCounts = Array.from(linkCountMap.entries())
          .map(([url, count]) => {
            const metadata = linkToMetadataMap.get(url)
            const linkData = convertedLinks.find(l => l.url === url)
            const mediaType = linkData?.mediaType || getMediaType(url)
            const contentType = linkData?.contentType || detectContentType(url, metadata?.title, metadata?.category)
            return { 
              url, 
              count, 
              mediaType,
              contentType,
              filePaths: linkToFilePathsMap.get(url) || [],
              title: metadata?.title,
              category: metadata?.category
            }
          })
          .sort((a, b) => b.count - a.count)
        
        const uniqueLinks = Array.from(linkCountMap.keys())
        const duplicateCount = allLinks.length - uniqueLinks.length
        const videoCount = linksWithCounts.filter(link => link.mediaType === 'video').length
        const audioCount = linksWithCounts.filter(link => link.mediaType === 'audio').length
        const movieCount = linksWithCounts.filter(link => link.contentType === 'movie').length
        const tvSeriesCount = linksWithCounts.filter(link => link.contentType === 'tv-series').length
        const liveTvCount = linksWithCounts.filter(link => link.contentType === 'live-tv').length
        
        setResult({
          links: uniqueLinks,
          linksWithCounts,
          fileCount: 1,
          linkCount: allLinks.length,
          uniqueLinkCount: uniqueLinks.length,
          duplicateCount,
          videoCount,
          audioCount,
          movieCount,
          tvSeriesCount,
          liveTvCount
        })
        
        setIsScanningXtream(false)
        
        toast.success(
          `Found ${scanResult.totalStreams} streams: ${scanResult.liveStreams.length} live TV, ${scanResult.vodStreams.length} VOD, ${scanResult.series.length} series`,
          { id: 'xtream-scan-status' }
        )
      } else {
        setIsScanningXtream(false)
        toast.error(scanResult.error || 'Failed to scan Xtream Codes API', { id: 'xtream-scan-status' })
      }
      
    } catch (error) {
      setIsScanningXtream(false)
      toast.error('Xtream Codes scan failed', { id: 'xtream-scan-status' })
      console.error('Xtream Codes scan error:', error)
    }
  }, [xtreamServerUrl, xtreamUsername, xtreamPassword])

  const handleScanRepositoryUrls = useCallback(async () => {
    const urlList = repositoryUrls.split('\n').filter(url => url.trim())
    
    if (urlList.length === 0) {
      toast.error('Please enter at least one repository URL')
      return
    }

    setIsScanningRepos(true)
    setRepoProgress(0)
    setRepoResults([])
    
    toast.loading(`Scanning ${urlList.length} ${urlList.length === 1 ? 'repository' : 'repositories'}...`, { id: 'repo-scan-status' })
    
    try {
      const scanResults = await scanRepositoryUrls(urlList, (current, total, repoCurrent, repoTotal) => {
        if (repoCurrent !== undefined && repoTotal !== undefined) {
          const overallProgress = ((current / total) + (repoCurrent / repoTotal / total)) * 100
          setRepoProgress(overallProgress)
        } else {
          setRepoProgress((current / total) * 100)
        }
      })
      
      setRepoResults(scanResults)
      setShowRepoResults(true)
      
      const allLinks: string[] = []
      const linkToFilePathsMap = new Map<string, string[]>()
      const allConfigFiles: ConfigFile[] = []
      let successCount = 0
      let errorCount = 0
      
      scanResults.forEach(result => {
        if (result.error) {
          errorCount++
          console.error(`Failed to scan ${result.url}:`, result.error)
        } else {
          successCount++
          result.links.forEach(link => {
            allLinks.push(link)
            const paths = linkToFilePathsMap.get(link) || []
            const repoName = `${result.owner}/${result.repoName}`
            if (!paths.includes(repoName)) {
              paths.push(repoName)
            }
            linkToFilePathsMap.set(link, paths)
          })
          allConfigFiles.push(...result.configFiles)
        }
      })
      
      const linkCountMap = new Map<string, number>()
      allLinks.forEach(link => {
        linkCountMap.set(link, (linkCountMap.get(link) || 0) + 1)
      })
      
      const linksWithCounts = Array.from(linkCountMap.entries())
        .map(([url, count]) => {
          const mediaType = getMediaType(url)
          const contentType = detectContentType(url)
          return { 
            url, 
            count, 
            mediaType,
            contentType,
            filePaths: linkToFilePathsMap.get(url) || []
          }
        })
        .sort((a, b) => b.count - a.count)
      
      const uniqueLinks = Array.from(linkCountMap.keys())
      const duplicateCount = allLinks.length - uniqueLinks.length
      const videoCount = linksWithCounts.filter(link => link.mediaType === 'video').length
      const audioCount = linksWithCounts.filter(link => link.mediaType === 'audio').length
      const movieCount = linksWithCounts.filter(link => link.contentType === 'movie').length
      const tvSeriesCount = linksWithCounts.filter(link => link.contentType === 'tv-series').length
      const liveTvCount = linksWithCounts.filter(link => link.contentType === 'live-tv').length
      
      setResult({
        links: uniqueLinks,
        linksWithCounts,
        fileCount: successCount,
        linkCount: allLinks.length,
        uniqueLinkCount: uniqueLinks.length,
        duplicateCount,
        videoCount,
        audioCount,
        movieCount,
        tvSeriesCount,
        liveTvCount,
        configFiles: allConfigFiles.length > 0 ? allConfigFiles : undefined
      })
      
      setIsScanningRepos(false)
      
      if (uniqueLinks.length > 0) {
        const errorMsg = errorCount > 0 ? ` (${errorCount} ${errorCount === 1 ? 'repository' : 'repositories'} failed)` : ''
        const configMsg = allConfigFiles.length > 0 ? ` and ${allConfigFiles.length} config files` : ''
        toast.success(`Found ${uniqueLinks.length} unique links${configMsg} from ${successCount} ${successCount === 1 ? 'repository' : 'repositories'}${errorMsg}`, { id: 'repo-scan-status' })
      } else {
        toast.error(`No media links found${errorCount > 0 ? ` (${errorCount} ${errorCount === 1 ? 'repository' : 'repositories'} failed to scan)` : ''}`, { id: 'repo-scan-status' })
      }
      
    } catch (error) {
      setIsScanningRepos(false)
      toast.error('Repository scan failed', { id: 'repo-scan-status' })
      console.error('Repository scan error:', error)
    }
  }, [repositoryUrls])

  const handleAskAI = useCallback(async () => {
    if (!aiQuestion.trim()) {
      toast.error('Please enter a question')
      return
    }

    setIsAiThinking(true)
    setAiResponse(null)

    try {
      const context = result ? {
        scannedFiles: result.fileCount,
        foundLinks: result.uniqueLinkCount,
        contentTypes: {
          movies: result.movieCount,
          tvSeries: result.tvSeriesCount,
          liveTV: result.liveTvCount
        },
        recentUrls: result.links.slice(0, 5)
      } : undefined

      const response = await queryGemini(aiQuestion, context)
      setAiResponse(response)
      setAiChatHistory(prev => [...prev, { question: aiQuestion, answer: response.answer }])
      setAiQuestion('')
    } catch (error) {
      toast.error('Failed to get AI response')
      console.error('AI query error:', error)
    } finally {
      setIsAiThinking(false)
    }
  }, [aiQuestion, result])

  const handleAnalyzeSelectedUrl = useCallback(async (url: string) => {
    setShowAIAssistant(true)
    setIsAiThinking(true)
    setAiResponse(null)

    try {
      const response = await analyzeUrl(url)
      setAiResponse(response)
      setAiChatHistory(prev => [...prev, { 
        question: `Analyze this URL: ${url}`, 
        answer: response.answer 
      }])
    } catch (error) {
      toast.error('Failed to analyze URL')
      console.error('URL analysis error:', error)
    } finally {
      setIsAiThinking(false)
    }
  }, [])

  const handleFindPlaylistSources = useCallback(async (query: string) => {
    setShowAIAssistant(true)
    setIsAiThinking(true)
    setAiResponse(null)

    try {
      const response = await findPlaylistSources(query)
      setAiResponse(response)
      setAiChatHistory(prev => [...prev, { 
        question: `Find playlist sources for: ${query}`, 
        answer: response.answer 
      }])
    } catch (error) {
      toast.error('Failed to find playlist sources')
      console.error('Playlist sources error:', error)
    } finally {
      setIsAiThinking(false)
    }
  }, [])

  const handleGenerateM3Us = useCallback(() => {
    if (!result || result.links.length === 0) return
    
    const categorizedLinks = result.linksWithCounts.filter(link => 
      link.contentType === 'movie' || 
      link.contentType === 'tv-series' || 
      link.contentType === 'live-tv'
    )
    
    if (categorizedLinks.length === 0) {
      toast.error('No categorized links found. Please classify your links first.')
      return
    }
    
    toast.loading('Generating M3U playlists...', { id: 'm3u-generation' })
    
    try {
      const m3uResult = generateM3UsByCategory(result.linksWithCounts)
      setM3uGenerationResult(m3uResult)
      setShowM3UDialog(true)
      
      toast.success(`Generated M3U playlists: ${m3uResult.movieCount} movies, ${m3uResult.tvSeriesCount} TV series, ${m3uResult.liveTVCount} live TV`, { id: 'm3u-generation' })
    } catch (error) {
      toast.error('Failed to generate M3U playlists', { id: 'm3u-generation' })
      console.error('M3U generation error:', error)
    }
  }, [result])

  const handleGenerateCustomM3Us = useCallback(() => {
    if (!result || result.links.length === 0) return
    
    const categorizedLinks = result.linksWithCounts.filter(link => 
      link.contentType === 'movie' || 
      link.contentType === 'tv-series' || 
      link.contentType === 'live-tv'
    )
    
    if (categorizedLinks.length === 0) {
      toast.error('No categorized links found. Please classify your links first.')
      return
    }
    
    setShowCustomM3UDialog(true)
  }, [result])

  const handleApplyCustomM3U = useCallback(() => {
    if (!result) return
    
    toast.loading('Generating custom M3U playlists...', { id: 'm3u-generation' })
    
    try {
      const m3uResult = generateCustomM3UsByCategory(result.linksWithCounts, {
        moviesName: customM3UMoviesName,
        moviesDescription: customM3UMoviesDesc || undefined,
        tvSeriesName: customM3UTVSeriesName,
        tvSeriesDescription: customM3UTVSeriesDesc || undefined,
        liveTVName: customM3ULiveTVName,
        liveTVDescription: customM3ULiveTVDesc || undefined,
        allName: customM3UAllName,
        allDescription: customM3UAllDesc || undefined,
        sortBy: customM3USortBy,
        groupByCategory: customM3UGroupByCategory
      })
      
      setM3uGenerationResult(m3uResult)
      setShowCustomM3UDialog(false)
      setShowM3UDialog(true)
      
      toast.success(`Generated custom M3U playlists with your names and descriptions`, { id: 'm3u-generation' })
    } catch (error) {
      toast.error('Failed to generate custom M3U playlists', { id: 'm3u-generation' })
      console.error('Custom M3U generation error:', error)
    }
  }, [result, customM3UMoviesName, customM3UMoviesDesc, customM3UTVSeriesName, customM3UTVSeriesDesc, customM3ULiveTVName, customM3ULiveTVDesc, customM3UAllName, customM3UAllDesc, customM3USortBy, customM3UGroupByCategory])

  const handleDownloadM3UBatch = useCallback(async () => {
    if (!m3uGenerationResult) return
    
    try {
      toast.loading('Creating M3U playlists archive...', { id: 'm3u-batch' })
      
      const blob = await generateM3UBatchDownload(m3uGenerationResult)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `m3u-playlists-${new Date().toISOString().split('T')[0]}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast.success('Downloaded M3U playlists archive', { id: 'm3u-batch' })
    } catch (error) {
      toast.error('Failed to create M3U archive', { id: 'm3u-batch' })
      console.error('M3U batch download error:', error)
    }
  }, [m3uGenerationResult])

  const handleDownloadIndividualM3U = useCallback((type: 'movies' | 'tv-series' | 'live-tv' | 'all') => {
    if (!m3uGenerationResult) return
    
    const isCustomResult = 'moviesName' in m3uGenerationResult
    
    const fileMap = {
      'movies': { 
        content: m3uGenerationResult.movies, 
        filename: isCustomResult ? `${m3uGenerationResult.moviesName}.m3u` : 'movies.m3u',
        count: m3uGenerationResult.movieCount 
      },
      'tv-series': { 
        content: m3uGenerationResult.tvSeries, 
        filename: isCustomResult ? `${m3uGenerationResult.tvSeriesName}.m3u` : 'tv-series.m3u',
        count: m3uGenerationResult.tvSeriesCount 
      },
      'live-tv': { 
        content: m3uGenerationResult.liveTV, 
        filename: isCustomResult ? `${m3uGenerationResult.liveTVName}.m3u` : 'live-tv.m3u',
        count: m3uGenerationResult.liveTVCount 
      },
      'all': { 
        content: m3uGenerationResult.all, 
        filename: isCustomResult ? `${m3uGenerationResult.allName}.m3u` : 'all-categorized.m3u',
        count: m3uGenerationResult.totalCount 
      }
    }
    
    const file = fileMap[type]
    
    if (file.count === 0) {
      toast.error(`No ${type} links to download`)
      return
    }
    
    downloadM3UFile(file.content, file.filename)
    toast.success(`Downloaded ${file.filename} (${file.count} links)`)
  }, [m3uGenerationResult])

  const handleDownloadValidatedM3Us = useCallback(() => {
    if (!result || validationResults.size === 0) return
    
    toast.loading('Generating validated M3U playlists...', { id: 'validated-m3u' })
    
    try {
      const validatedM3Us = generateM3UWithValidationStatus(result.linksWithCounts)
      
      const workingCount = result.linksWithCounts.filter(l => l.validationStatus === 'working').length
      const brokenCount = result.linksWithCounts.filter(l => l.validationStatus === 'broken' || l.validationStatus === 'timeout').length
      
      if (workingCount > 0) {
        downloadM3UFile(validatedM3Us.working, 'working-links.m3u')
      }
      
      if (brokenCount > 0) {
        downloadM3UFile(validatedM3Us.broken, 'broken-links.m3u')
      }
      
      toast.success(`Downloaded validated M3U playlists: ${workingCount} working, ${brokenCount} broken`, { id: 'validated-m3u' })
    } catch (error) {
      toast.error('Failed to generate validated M3U playlists', { id: 'validated-m3u' })
      console.error('Validated M3U generation error:', error)
    }
  }, [result, validationResults])


  const handleSetupAuthForUrls = useCallback(() => {
    const urlList = playlistUrls.split('\n').filter(url => url.trim())
    if (urlList.length === 0) {
      toast.error('Please enter playlist URLs first')
      return
    }
    handleOpenAuthDialog(urlList[0])
  }, [playlistUrls, handleOpenAuthDialog])

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-8"
        >
          <div className="flex items-start justify-between gap-4 mb-2">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight flex items-center gap-3">
              <AnimatedRabbit size={40} variant="idle" />
              Media Link Scanner
              <Sparkle size={32} weight="fill" className="text-accent" />
            </h1>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={`border-accent/30 hover:bg-accent/10 text-accent shrink-0 relative ${isFollowingSystem ? 'ring-1 ring-accent/50' : ''}`}
                  title={isFollowingSystem ? `Following system (${isDarkMode ? 'Dark' : 'Light'})` : `${isDarkMode ? 'Dark' : 'Light'} mode`}
                >
                  {isDarkMode ? (
                    <Moon size={20} weight="fill" />
                  ) : (
                    <Sun size={20} weight="fill" />
                  )}
                  {isFollowingSystem && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent rounded-full animate-pulse" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem 
                  onClick={() => {
                    setIsDarkMode(false)
                    localStorage.setItem('darkMode', JSON.stringify(false))
                    setIsFollowingSystem(false)
                  }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Sun size={16} weight="fill" />
                  <span>Light</span>
                  {!isDarkMode && !isFollowingSystem && <CheckCircle size={14} className="ml-auto text-accent" weight="fill" />}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => {
                    setIsDarkMode(true)
                    localStorage.setItem('darkMode', JSON.stringify(true))
                    setIsFollowingSystem(false)
                  }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Moon size={16} weight="fill" />
                  <span>Dark</span>
                  {isDarkMode && !isFollowingSystem && <CheckCircle size={14} className="ml-auto text-accent" weight="fill" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={resetToSystemTheme}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Desktop size={16} weight="fill" />
                  <span>System</span>
                  {isFollowingSystem && <CheckCircle size={14} className="ml-auto text-accent" weight="fill" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <p className="text-muted-foreground">
            AI-powered scanner for IPTV, Kodi, and streaming media. Extract URLs from files, folders, archives (ZIP, 7Z, BZ2, RAR, TAR), Git repositories, web apps, M3U playlists, Xtream Codes API, Kodi configurations (.nfo, .strm, .xsp, addon.xml), Kodi addon repositories, Android packages, and 50+ formats. Batch archive scanning and Kodi addon downloader included. Get instant AI assistance for finding sources and understanding media links.
          </p>
        </motion.div>

        {showThemeHint && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4"
          >
            <Alert className="border-accent/30 bg-accent/5">
              <Desktop size={16} className="text-accent" />
              <AlertDescription className="flex items-center justify-between gap-2">
                <span className="text-foreground text-sm">
                  <strong>Auto theme enabled:</strong> App follows your system's {isDarkMode ? 'dark' : 'light'} mode. Click the theme button to customize.
                </span>
                <Button
                  onClick={dismissThemeHint}
                  variant="ghost"
                  size="sm"
                  className="h-6 shrink-0 hover:bg-accent/20"
                >
                  <X size={14} />
                </Button>
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        <Card className="bg-card border-border p-6 md:p-8">
          <div className="space-y-6">
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`
                relative border-2 border-dashed rounded-lg p-8 md:p-12 text-center transition-all duration-150
                ${isDragging 
                  ? 'border-accent bg-accent/10 scale-[1.02]' 
                  : 'border-border hover:border-accent/50 hover:bg-accent/5'
                }
                ${isScanning ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              `}
            >
              <input
                type="file"
                multiple
                onChange={handleFileInput}
                ref={fileInputRef}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                accept=".m3u,.m3u8,.txt,.json,.pls,.xspf,.asx,.xml,.playlist,.conf,.list,.urls,.links,.wpl,.b4s,.kpl,.jspf,.smil,.smi,.ram,.qtl,.wvx,.m4u,.vlc,.zpl,.mpcpl,.mxu,.cue,.dpl,.epg,.aimppl,.aimppl4,.bio,.fpl,.mpls,.pla,.plc,.plx,.plist,.sqf,.wax,.wmx,.xpl,.rmp,.rpm,.sml,.ts,.mpd,.ism,.isml,.f4m,.strm,.apk,.aab,.xapk,.apks,.apkm,.apex,.apkx,.zip,.rar,.tar,.gz,.tgz,.tar.gz,.7z,.bz2,.bzip2,.exe"
                disabled={isScanning}
              />
              
              <input
                type="file"
                onChange={handleImportClassifications}
                ref={classificationsInputRef}
                className="hidden"
                accept=".json"
              />
              
              <input
                type="file"
                multiple
                onChange={handleMergeClassifications}
                ref={mergeClassificationsInputRef}
                className="hidden"
                accept=".json"
              />
              
              <motion.div
                animate={isDragging ? { scale: 1.1 } : { scale: 1 }}
                transition={{ duration: 0.15 }}
              >
                <UploadSimple 
                  className={`mx-auto mb-4 ${isDragging ? 'text-accent' : 'text-muted-foreground'}`}
                  size={48}
                />
              </motion.div>
              
              <h3 className="text-lg font-bold text-foreground mb-2">
                Drop files or folders here or click to browse
              </h3>
              <p className="text-sm text-muted-foreground">
                Supports M3U, M3U8, PLS, XSPF, ASX, WPL, SMIL, DASH, Smooth Streaming, EPG XML, Android packages (APK, AAB, XAPK, APKS, APKM, APEX, APKX), ZIP archives, 7Z archives, BZ2 archives, RAR archives, TAR archives (including .tar.gz, .tgz), EXE files, and 50+ formats. Detects HTTP, HTTPS, RTSP, RTMP, RTP, UDP, HLS, DASH, MMS, and other streaming protocols. Folders are scanned recursively. Archives are extracted and scanned automatically.
              </p>
              
              <div className="mt-4 flex items-center justify-center gap-2">
                <Checkbox
                  id="auto-validate"
                  checked={autoValidateAfterScan}
                  onCheckedChange={(checked) => setAutoValidateAfterScan(checked as boolean)}
                />
                <label
                  htmlFor="auto-validate"
                  className="text-sm font-medium text-foreground cursor-pointer"
                >
                  Automatically validate URLs after scanning
                </label>
              </div>
            </div>

            {!isScanning && !result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="flex justify-center py-8"
              >
                <RabbitSleeping size={80} message="Waiting for files to scan... Drop some files to wake me up! 💤" />
              </motion.div>
            )}

            {isScanning && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-3"
              >
                <div className="flex items-center gap-3 text-accent">
                  <RabbitLoader size={24} />
                  <span className="text-sm font-medium">Scanning files...</span>
                </div>
                <Progress value={scanProgress} className="h-2" />
              </motion.div>
            )}

            <Separator className="bg-border" />

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Broadcast size={24} className="text-accent" />
                <h3 className="text-lg font-bold text-foreground">Scan IPTV/Streaming Playlist URLs</h3>
              </div>
              
              <p className="text-sm text-muted-foreground">
                Enter M3U/M3U8 playlist URLs directly from IPTV providers or streaming services (one per line). Perfect for scanning remote playlists without downloading files.
              </p>

              <div className="space-y-3">
                <Textarea
                  id="playlist-urls"
                  placeholder="http://example.com/playlist.m3u8&#10;https://iptv-provider.com/channels.m3u&#10;http://provider.tv/stream/playlist.m3u8"
                  value={playlistUrls}
                  onChange={(e) => setPlaylistUrls(e.target.value)}
                  className="font-mono text-sm min-h-[120px]"
                  disabled={isScanningPlaylists}
                />
                
                <div className="flex gap-2">
                  <Button
                    onClick={handleScanPlaylistUrls}
                    disabled={isScanningPlaylists || !playlistUrls.trim()}
                    className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    <Broadcast size={20} className="mr-2" />
                    {isScanningPlaylists ? 'Scanning Playlists...' : 'Scan Playlist URLs'}
                  </Button>
                  <Button
                    onClick={handleSetupAuthForUrls}
                    disabled={isScanningPlaylists || !playlistUrls.trim()}
                    variant="outline"
                    className="border-accent/30 hover:bg-accent/10 text-accent"
                    title="Set up authentication for password-protected playlists"
                  >
                    <Key size={20} />
                  </Button>
                </div>
                
                {playlistAuthCredentials.size > 0 && (
                  <Alert className="border-accent/30 bg-accent/5">
                    <AlertDescription className="text-foreground text-xs">
                      <Lock size={14} className="inline mr-1" />
                      <strong>{playlistAuthCredentials.size}</strong> playlist{playlistAuthCredentials.size !== 1 ? 's' : ''} configured with authentication
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {isScanningPlaylists && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-3 text-accent">
                    <RabbitLoader size={20} />
                    <span className="text-sm font-medium">Scanning playlists...</span>
                  </div>
                  <Progress value={playlistProgress} className="h-2" />
                </motion.div>
              )}

              {showPlaylistResults && playlistResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <Alert className="border-accent/30 bg-accent/5">
                    <AlertDescription>
                      <div className="space-y-2 text-sm">
                        <div className="font-semibold text-foreground">Playlist Scan Results:</div>
                        {playlistResults.map((result, index) => (
                          <div key={index} className="pl-4 border-l-2 border-accent/30">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <div className="font-mono text-xs break-all text-muted-foreground flex-1">{result.url}</div>
                              {result.requiresAuth && (
                                <Button
                                  onClick={() => handleOpenAuthDialog(result.url)}
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 px-2 text-xs hover:bg-accent/20 text-accent shrink-0"
                                  title="Add authentication"
                                >
                                  <Key size={12} className="mr-1" />
                                  Auth
                                </Button>
                              )}
                              {!result.requiresAuth && playlistAuthCredentials.has(result.url) && (
                                <div className="flex gap-1 shrink-0">
                                  <Button
                                    onClick={() => handleOpenAuthDialog(result.url)}
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 px-2 text-xs hover:bg-accent/20 text-green-500"
                                    title="Edit authentication"
                                  >
                                    <Lock size={12} />
                                  </Button>
                                  <Button
                                    onClick={() => handleRemoveAuth(result.url)}
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 px-2 text-xs hover:bg-destructive/20 text-destructive"
                                    title="Remove authentication"
                                  >
                                    <X size={12} />
                                  </Button>
                                </div>
                              )}
                            </div>
                            {result.error ? (
                              <div className="flex items-start gap-2">
                                <div className="text-destructive text-xs flex-1">
                                  {result.requiresAuth ? '🔒' : '❌'} {result.error}
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="outline" className="text-xs border-accent/30 text-accent">
                                  ✓ {result.totalLinks} links
                                </Badge>
                                {result.videoLinks > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    <VideoCamera size={12} className="mr-1" />
                                    {result.videoLinks} video
                                  </Badge>
                                )}
                                {result.audioLinks > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    <MusicNote size={12} className="mr-1" />
                                    {result.audioLinks} audio
                                  </Badge>
                                )}
                                {result.epgData && (
                                  <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-400">
                                    <Television size={12} className="mr-1" />
                                    EPG: {result.epgData.channelCount} channels
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </AlertDescription>
                  </Alert>
                </motion.div>
              )}
            </div>

            <Separator className="bg-border" />

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Globe size={24} className="text-accent" />
                <h3 className="text-lg font-bold text-foreground">Scan Web URLs</h3>
              </div>
              
              <p className="text-sm text-muted-foreground">
                Enter website URLs (one per line) to scan for media links. This will fetch the web pages and extract any streaming URLs found.
              </p>

              <div className="space-y-3">
                <Textarea
                  id="web-urls"
                  placeholder="https://example.com/playlist&#10;https://example.com/media"
                  value={webUrls}
                  onChange={(e) => setWebUrls(e.target.value)}
                  className="font-mono text-sm min-h-[120px]"
                  disabled={isScanningSites}
                />
                
                <Button
                  onClick={handleScanWebUrls}
                  disabled={isScanningSites || !webUrls.trim()}
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  <Globe size={20} className="mr-2" />
                  {isScanningSites ? 'Scanning...' : 'Scan Web URLs'}
                </Button>
              </div>

              {isScanningSites && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-3 text-accent">
                    <RabbitLoader size={20} />
                    <span className="text-sm font-medium">Scanning websites...</span>
                  </div>
                  <Progress value={siteProgress} className="h-2" />
                </motion.div>
              )}
            </div>

            <Separator className="bg-border" />

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Database size={24} className="text-accent" />
                <h3 className="text-lg font-bold text-foreground">Scan Xtream Codes API</h3>
              </div>
              
              <p className="text-sm text-muted-foreground">
                Connect directly to Xtream Codes IPTV providers using your API credentials. Enter your server URL and login details to fetch all live TV, movies, and series from the provider.
              </p>

              <div className="space-y-3">
                <div>
                  <label htmlFor="xtream-server-url" className="text-sm font-medium text-foreground block mb-1">
                    Server URL
                  </label>
                  <Input
                    id="xtream-server-url"
                    placeholder="http://example.com:8080 or https://provider.tv"
                    value={xtreamServerUrl}
                    onChange={(e) => setXtreamServerUrl(e.target.value)}
                    className="font-mono text-sm"
                    disabled={isScanningXtream}
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="xtream-username" className="text-sm font-medium text-foreground block mb-1">
                      Username
                    </label>
                    <Input
                      id="xtream-username"
                      type="text"
                      placeholder="Enter username"
                      value={xtreamUsername}
                      onChange={(e) => setXtreamUsername(e.target.value)}
                      disabled={isScanningXtream}
                      autoComplete="username"
                    />
                  </div>
                  <div>
                    <label htmlFor="xtream-password" className="text-sm font-medium text-foreground block mb-1">
                      Password
                    </label>
                    <Input
                      id="xtream-password"
                      type="password"
                      placeholder="Enter password"
                      value={xtreamPassword}
                      onChange={(e) => setXtreamPassword(e.target.value)}
                      disabled={isScanningXtream}
                      autoComplete="current-password"
                    />
                  </div>
                </div>
                
                <Button
                  onClick={handleScanXtreamCodes}
                  disabled={isScanningXtream || !xtreamServerUrl.trim() || !xtreamUsername.trim() || !xtreamPassword.trim()}
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  <Database size={20} className="mr-2" />
                  {isScanningXtream ? 'Scanning Xtream Codes...' : 'Scan Xtream Codes API'}
                </Button>
              </div>

              {isScanningXtream && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-3 text-accent">
                    <RabbitLoader size={20} />
                    <span className="text-sm font-medium">{xtreamProgress.stage}...</span>
                  </div>
                  <Progress value={(xtreamProgress.current / xtreamProgress.total) * 100} className="h-2" />
                  <div className="text-xs text-muted-foreground text-center">
                    Step {xtreamProgress.current} of {xtreamProgress.total}
                  </div>
                </motion.div>
              )}

              {showXtreamResult && xtreamResult && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <Alert className={xtreamResult.success ? 'border-accent/30 bg-accent/5' : 'border-destructive/30 bg-destructive/5'}>
                    <AlertDescription>
                      <div className="space-y-2 text-sm">
                        <div className="font-semibold text-foreground">Xtream Codes API Result:</div>
                        {xtreamResult.success ? (
                          <>
                            {xtreamResult.userInfo && (
                              <div className="pl-4 border-l-2 border-accent/30">
                                <div className="font-mono text-xs text-muted-foreground mb-2">{xtreamResult.serverUrl}</div>
                                <div className="flex flex-wrap gap-2 mb-2">
                                  <Badge variant="outline" className="text-xs border-accent/30 text-accent">
                                    ✓ Authenticated: {xtreamResult.userInfo.username}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs border-green-500/30 text-green-500">
                                    Status: {xtreamResult.userInfo.status}
                                  </Badge>
                                  {xtreamResult.userInfo.exp_date && (
                                    <Badge variant="outline" className="text-xs">
                                      Expires: {new Date(parseInt(xtreamResult.userInfo.exp_date) * 1000).toLocaleDateString()}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    <Broadcast size={12} className="mr-1" />
                                    {xtreamResult.liveStreams.length} Live TV
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    <VideoCamera size={12} className="mr-1" />
                                    {xtreamResult.vodStreams.length} VOD
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    <StackSimple size={12} className="mr-1" />
                                    {xtreamResult.series.length} Series
                                  </Badge>
                                  <Badge variant="outline" className="text-xs border-accent/30 text-accent">
                                    <CheckCircle size={12} className="mr-1" weight="fill" />
                                    {xtreamResult.totalStreams} Total Streams
                                  </Badge>
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-destructive text-sm pl-4 border-l-2 border-destructive/30">
                            ❌ {xtreamResult.error}
                          </div>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                </motion.div>
              )}
            </div>

            <Separator className="bg-border" />

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Package size={24} className="text-accent" />
                <h3 className="text-lg font-bold text-foreground">Scan Git Repositories</h3>
              </div>
              
              <p className="text-sm text-muted-foreground">
                Enter repository URLs (one per line) from GitHub, GitLab, Bitbucket, Gitea, Codeberg, or other Git hosting platforms. Scans for media links in playlist files, config files, and other supported formats.
              </p>

              <div className="space-y-3">
                <Textarea
                  id="repository-urls"
                  placeholder="https://github.com/username/repository&#10;https://gitlab.com/username/project&#10;https://bitbucket.org/username/repo&#10;https://codeberg.org/username/repo"
                  value={repositoryUrls}
                  onChange={(e) => setRepositoryUrls(e.target.value)}
                  className="font-mono text-sm min-h-[120px]"
                  disabled={isScanningRepos}
                />
                
                <Button
                  onClick={handleScanRepositoryUrls}
                  disabled={isScanningRepos || !repositoryUrls.trim()}
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  <Package size={20} className="mr-2" />
                  {isScanningRepos ? 'Scanning Repositories...' : 'Scan Git Repositories'}
                </Button>
              </div>

              {isScanningRepos && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-3 text-accent">
                    <RabbitLoader size={20} />
                    <span className="text-sm font-medium">Scanning repositories...</span>
                  </div>
                  <Progress value={repoProgress} className="h-2" />
                </motion.div>
              )}

              {showRepoResults && repoResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <Alert className="border-accent/30 bg-accent/5">
                    <AlertDescription>
                      <div className="space-y-2 text-sm">
                        <div className="font-semibold text-foreground">Repository Scan Results:</div>
                        {repoResults.map((result, index) => (
                          <div key={index} className="pl-4 border-l-2 border-accent/30">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="font-mono text-xs text-muted-foreground flex-1">{result.owner}/{result.repoName}</div>
                              <Badge variant="outline" className={`text-xs uppercase ${getPlatformColor(result.platform)}`}>
                                {result.platform}
                              </Badge>
                            </div>
                            {result.error ? (
                              <div className="text-destructive text-xs">
                                ❌ {result.error}
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="outline" className="text-xs border-accent/30 text-accent">
                                  ✓ {result.totalLinks} links
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {result.filesScanned} files scanned
                                </Badge>
                                {result.videoLinks > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    <VideoCamera size={12} className="mr-1" />
                                    {result.videoLinks} video
                                  </Badge>
                                )}
                                {result.audioLinks > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    <MusicNote size={12} className="mr-1" />
                                    {result.audioLinks} audio
                                  </Badge>
                                )}
                                {result.configFiles.length > 0 && (
                                  <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-400">
                                    <File size={12} className="mr-1" />
                                    {result.configFiles.length} config files
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </AlertDescription>
                  </Alert>
                </motion.div>
              )}
            </div>

            <Separator className="bg-border" />

            <CrawlerManager />

            <Separator className="bg-border" />

            <ScrapingRulesManager />

            <Separator className="bg-border" />

            <PaginationManager />

            <Separator className="bg-border" />

            <ArchiveManager />

            <Separator className="bg-border" />

            <RepositoryAutoScraper />

            <Separator className="bg-border" />

            <ProviderPresets onScanComplete={(results) => {
              console.log('Bulk scan results:', results)
            }} />

            <Separator className="bg-border" />

            <PatternGenerator />

            <Separator className="bg-border" />

            <PatternLibrary />

            <Separator className="bg-border" />

            <PatternRepository onImportPattern={(pattern) => {
              toast.success(`Pattern "${pattern.name}" ready to use!`)
              console.log('Imported pattern:', pattern)
            }} />

            <Separator className="bg-border" />

            <CommunityPatternHub onImportPattern={(pattern) => {
              toast.success(`Imported pattern "${pattern.name}" from community hub!`)
              console.log('Imported community pattern:', pattern)
            }} />

            <Separator className="bg-border" />

            <AddonComparison />

            <Separator className="bg-border" />

            <HealthCheckMonitor />

            <Separator className="bg-border" />

            <AndroidMediaServer 
              linksWithCounts={result ? result.linksWithCounts.map(link => ({
                url: link.url,
                title: link.title,
                category: link.category,
                mediaType: link.mediaType
              })) : []}
            />

            <Separator className="bg-border" />

            <StremioIntegration
              extractedLinks={result ? result.linksWithCounts.map(link => ({
                url: link.url,
                title: link.title,
                category: link.category,
                contentType: link.contentType
              })) : []}
              onLinksExported={() => {
                toast.success('Links exported to Stremio addon!')
              }}
            />

            <Separator className="bg-border" />

            <ConfigSimulator />

            <Separator className="bg-border" />

            <ApkDeepScanner />

            {result && !isScanning && (
              <>
                <Separator className="bg-border" />
                
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div className="flex flex-wrap gap-3">
                    <Badge variant="outline" className="px-4 py-2 text-sm font-mono border-accent/30 text-accent">
                      <CheckCircle size={16} className="mr-2" />
                      {result.uniqueLinkCount} unique links
                    </Badge>
                    <Badge variant="outline" className="px-4 py-2 text-sm font-mono border-border text-muted-foreground">
                      {result.linkCount} total occurrences
                    </Badge>
                    {result.duplicateCount > 0 && (
                      <Badge variant="outline" className="px-4 py-2 text-sm font-mono border-destructive/30 text-destructive">
                        {result.duplicateCount} duplicates
                      </Badge>
                    )}
                    <Badge variant="outline" className="px-4 py-2 text-sm font-mono border-border text-muted-foreground">
                      {result.fileCount} {result.fileCount === 1 ? 'file' : 'files'} processed
                    </Badge>
                    {result.movieCount > 0 && (
                      <Badge variant="outline" className="px-4 py-2 text-sm font-mono border-accent/30 text-accent">
                        <FilmSlate size={16} className="mr-2" />
                        {result.movieCount} movies
                      </Badge>
                    )}
                    {result.tvSeriesCount > 0 && (
                      <Badge variant="outline" className="px-4 py-2 text-sm font-mono border-accent/30 text-accent">
                        <StackSimple size={16} className="mr-2" />
                        {result.tvSeriesCount} TV series
                      </Badge>
                    )}
                    {result.liveTvCount > 0 && (
                      <Badge variant="outline" className="px-4 py-2 text-sm font-mono border-accent/30 text-accent">
                        <Broadcast size={16} className="mr-2" />
                        {result.liveTvCount} live TV
                      </Badge>
                    )}
                    {result.epgData && (result.epgData.channelCount > 0 || result.epgData.programmeCount > 0) && (
                      <Badge variant="outline" className="px-4 py-2 text-sm font-mono border-accent/30 text-accent">
                        <Television size={16} className="mr-2" />
                        EPG: {result.epgData.channelCount} channels, {result.epgData.programmeCount} programmes
                      </Badge>
                    )}
                    {result.configFiles && result.configFiles.length > 0 && (
                      <Badge variant="outline" className="px-4 py-2 text-sm font-mono border-accent/30 text-accent">
                        <File size={16} className="mr-2" />
                        {result.configFiles.length} config files
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Database size={18} className="text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">Content Classifications:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={handleExportClassifications}
                          variant="outline"
                          size="sm"
                          className="border-accent/30 hover:bg-accent/10 text-accent"
                          disabled={!result || result.linksWithCounts.filter(l => l.contentType && l.contentType !== 'unknown').length === 0}
                        >
                          <FileArrowDown size={16} className="mr-1" />
                          Export
                        </Button>
                        <Button
                          onClick={() => classificationsInputRef.current?.click()}
                          variant="outline"
                          size="sm"
                          className="border-accent/30 hover:bg-accent/10 text-accent"
                          disabled={!result || result.links.length === 0}
                        >
                          <FileArrowUp size={16} className="mr-1" />
                          Import
                        </Button>
                        <Button
                          onClick={() => mergeClassificationsInputRef.current?.click()}
                          variant="outline"
                          size="sm"
                          className="border-accent/30 hover:bg-accent/10 text-accent"
                        >
                          <StackSimple size={16} className="mr-1" />
                          Merge Files
                        </Button>
                      </div>
                    </div>
                    <Alert className="border-accent/30 bg-accent/5">
                      <AlertDescription className="text-foreground text-xs">
                        <Database size={14} className="inline mr-1" />
                        <strong>Export:</strong> Save current classifications to JSON. <strong>Import:</strong> Restore from a single backup file. <strong>Merge:</strong> Combine multiple backup files into one (newer classifications take priority). Works without scanning if you just want to merge files.
                      </AlertDescription>
                    </Alert>
                  </div>

                  <Separator className="bg-border" />

                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <FilmSlate size={18} className="text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">Generate M3U Playlists:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={handleGenerateM3Us}
                          variant="outline"
                          size="sm"
                          className="border-accent/30 hover:bg-accent/10 text-accent"
                          disabled={!result || result.linksWithCounts.filter(l => l.contentType && l.contentType !== 'unknown').length === 0}
                        >
                          <StackSimple size={16} className="mr-1" />
                          Quick Generate
                        </Button>
                        <Button
                          onClick={handleGenerateCustomM3Us}
                          variant="outline"
                          size="sm"
                          className="border-accent/30 hover:bg-accent/10 text-accent"
                          disabled={!result || result.linksWithCounts.filter(l => l.contentType && l.contentType !== 'unknown').length === 0}
                        >
                          <PencilSimple size={16} className="mr-1" />
                          Custom Names & Descriptions
                        </Button>
                      </div>
                    </div>
                    <Alert className="border-accent/30 bg-accent/5">
                      <AlertDescription className="text-foreground text-xs">
                        <FilmSlate size={14} className="inline mr-1" />
                        <strong>Quick Generate:</strong> Create M3U playlists with default names. <strong>Custom:</strong> Set your own playlist names, descriptions, and sorting options for better organization.
                      </AlertDescription>
                    </Alert>
                  </div>

                  <Separator className="bg-border" />

                  <BulkPlaylistGenerator 
                    linksWithCounts={result.linksWithCounts}
                    availableCategories={allCategories}
                  />

                  {result.configFiles && result.configFiles.length > 0 && (
                    <>
                      <Separator className="bg-border" />
                      
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <Package size={18} className="text-muted-foreground" />
                            <span className="text-sm font-medium text-foreground">Extracted Configuration Files:</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              onClick={handleScanConfigFiles}
                              variant="outline"
                              size="sm"
                              className="border-accent/30 hover:bg-accent/10 text-accent"
                            >
                              <MagnifyingGlass size={16} className="mr-1" />
                              Scan for Links
                            </Button>
                            <Button
                              onClick={handleDownloadConfigAnalysisReport}
                              variant="outline"
                              size="sm"
                              className="border-accent/30 hover:bg-accent/10 text-accent"
                            >
                              <FileText size={16} className="mr-1" />
                              Analysis Report
                            </Button>
                            <Button
                              onClick={handleDownloadConfigFiles}
                              variant="outline"
                              size="sm"
                              className="border-accent/30 hover:bg-accent/10 text-accent"
                            >
                              <Package size={16} className="mr-1" />
                              Download All (ZIP)
                            </Button>
                          </div>
                        </div>
                        <Alert className="border-accent/30 bg-accent/5">
                          <AlertDescription className="text-foreground text-xs">
                            <Package size={14} className="inline mr-1" />
                            Found {result.configFiles.length} configuration {result.configFiles.length === 1 ? 'file' : 'files'} in Android packages. These may contain API endpoints, server URLs, IPTV configurations, and other settings. Click "Scan for Links" to extract media URLs from these config files, or download all as ZIP to preserve the folder structure.
                          </AlertDescription>
                        </Alert>
                        <ScrollArea className="h-[200px] rounded-md border border-border bg-primary/30 p-4">
                          <div className="space-y-2 text-sm">
                            {result.configFiles.map((file, index) => (
                              <motion.div
                                key={`${file.path}-${index}`}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.2, delay: Math.min(index * 0.02, 1) }}
                                className="p-3 rounded hover:bg-accent/10 transition-colors duration-100 group"
                              >
                                <div className="flex items-start gap-2">
                                  <FileText size={16} className="text-accent shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-foreground font-mono text-xs break-all">
                                      {file.path}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                      <Badge variant="outline" className="text-xs border-accent/30 text-accent uppercase">
                                        {file.type}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground">
                                        {file.size.toLocaleString()} bytes
                                      </span>
                                      {file.hasMediaLinks && (
                                        <Badge variant="outline" className="text-xs border-green-500/30 text-green-500">
                                          <CheckCircle size={12} className="mr-1" weight="fill" />
                                          {file.linksFound} {file.linksFound === 1 ? 'link' : 'links'}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                      onClick={() => handleViewConfigFile(file)}
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 hover:bg-accent/20 text-accent"
                                      title="View file content"
                                    >
                                      <MagnifyingGlass size={14} />
                                    </Button>
                                    <Button
                                      onClick={() => handleSaveIndividualConfigFile(file)}
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 hover:bg-accent/20 text-accent"
                                      title="Download this file"
                                    >
                                      <DownloadSimple size={14} />
                                    </Button>
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    </>
                  )}

                  <Separator className="bg-border" />

                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <FunnelSimple size={18} className="text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">Filter by media type:</span>
                      </div>
                      <div className="flex gap-2">
                        {selectedUrls.size > 0 && !bulkEditMode && (
                          <Button
                            onClick={handleBulkEditStart}
                            variant="outline"
                            size="sm"
                            className="border-accent/30 hover:bg-accent/10 text-accent"
                          >
                            <PencilSimple size={16} className="mr-1" />
                            Edit Selected ({selectedUrls.size})
                          </Button>
                        )}
                        {bulkEditMode && (
                          <>
                            <Select
                              value={bulkEditContentType}
                              onValueChange={(value) => setBulkEditContentType(value as ContentType)}
                            >
                              <SelectTrigger className="w-[140px] h-8 border-accent/30">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="movie">
                                  <div className="flex items-center gap-2">
                                    <FilmSlate size={16} weight="fill" />
                                    Movie
                                  </div>
                                </SelectItem>
                                <SelectItem value="tv-series">
                                  <div className="flex items-center gap-2">
                                    <StackSimple size={16} weight="fill" />
                                    TV Series
                                  </div>
                                </SelectItem>
                                <SelectItem value="live-tv">
                                  <div className="flex items-center gap-2">
                                    <Broadcast size={16} weight="fill" />
                                    Live TV
                                  </div>
                                </SelectItem>
                                <SelectItem value="vod">
                                  <div className="flex items-center gap-2">
                                    <VideoCamera size={16} weight="fill" />
                                    VOD
                                  </div>
                                </SelectItem>
                                <SelectItem value="unknown">
                                  <div className="flex items-center gap-2">
                                    <Question size={16} />
                                    Unknown
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              onClick={handleBulkEditApply}
                              variant="default"
                              size="sm"
                              className="bg-accent text-accent-foreground hover:bg-accent/90"
                            >
                              <CheckCircle size={16} className="mr-1" weight="fill" />
                              Apply
                            </Button>
                            <Button
                              onClick={handleBulkEditCancel}
                              variant="outline"
                              size="sm"
                              className="border-border"
                            >
                              <X size={16} />
                            </Button>
                          </>
                        )}
                        <Button
                          onClick={() => {
                            const mediaItems = filteredLinksWithCounts
                              .filter(link => link.mediaType === 'video' || link.mediaType === 'audio')
                              .map(link => ({
                                url: link.url,
                                title: link.title,
                                mediaType: link.mediaType
                              }))
                            handlePlayAll(mediaItems)
                          }}
                          variant="outline"
                          size="sm"
                          className="border-accent/30 hover:bg-accent/10 text-accent"
                          disabled={filteredLinksWithCounts.filter(l => l.mediaType === 'video' || l.mediaType === 'audio').length === 0}
                        >
                          <Play size={16} className="mr-1" weight="fill" />
                          Play All
                        </Button>
                        <Button
                          onClick={handleBulkCopyUrls}
                          variant="outline"
                          size="sm"
                          className="border-accent/30 hover:bg-accent/10 text-accent"
                          disabled={filteredLinksWithCounts.length === 0}
                      >
                        <CopySimple size={16} className="mr-1" />
                        Copy All URLs
                      </Button>
                      </div>
                    </div>
                    {selectedUrls.size > 0 && (
                      <Alert className="border-accent/50 bg-accent/10">
                        <AlertDescription className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-foreground text-sm">
                            <CheckSquare size={16} className="text-accent" weight="fill" />
                            {selectedUrls.size} {selectedUrls.size === 1 ? 'link' : 'links'} selected
                          </div>
                          <Button
                            onClick={() => setSelectedUrls(new Set())}
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs hover:bg-accent/20"
                          >
                            Clear Selection
                          </Button>
                        </AlertDescription>
                      </Alert>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => setMediaFilter('all')}
                        variant={mediaFilter === 'all' ? 'default' : 'outline'}
                        size="sm"
                        className={mediaFilter === 'all' ? 'bg-accent text-accent-foreground' : 'border-border'}
                      >
                        All ({result.uniqueLinkCount})
                      </Button>
                      <Button
                        onClick={() => setMediaFilter('video')}
                        variant={mediaFilter === 'video' ? 'default' : 'outline'}
                        size="sm"
                        className={mediaFilter === 'video' ? 'bg-accent text-accent-foreground' : 'border-border'}
                      >
                        <VideoCamera size={16} className="mr-1" />
                        Video ({result.videoCount})
                      </Button>
                      <Button
                        onClick={() => setMediaFilter('audio')}
                        variant={mediaFilter === 'audio' ? 'default' : 'outline'}
                        size="sm"
                        className={mediaFilter === 'audio' ? 'bg-accent text-accent-foreground' : 'border-border'}
                      >
                        <MusicNote size={16} className="mr-1" />
                        Audio ({result.audioCount})
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <FunnelSimple size={18} className="text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">Filter by content type:</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => setContentTypeFilter('all')}
                        variant={contentTypeFilter === 'all' ? 'default' : 'outline'}
                        size="sm"
                        className={contentTypeFilter === 'all' ? 'bg-accent text-accent-foreground' : 'border-border'}
                      >
                        All Content
                      </Button>
                      {result.movieCount > 0 && (
                        <Button
                          onClick={() => setContentTypeFilter('movie')}
                          variant={contentTypeFilter === 'movie' ? 'default' : 'outline'}
                          size="sm"
                          className={contentTypeFilter === 'movie' ? 'bg-accent text-accent-foreground' : 'border-border'}
                        >
                          <FilmSlate size={16} className="mr-1" />
                          Movies ({result.movieCount})
                        </Button>
                      )}
                      {result.tvSeriesCount > 0 && (
                        <Button
                          onClick={() => setContentTypeFilter('tv-series')}
                          variant={contentTypeFilter === 'tv-series' ? 'default' : 'outline'}
                          size="sm"
                          className={contentTypeFilter === 'tv-series' ? 'bg-accent text-accent-foreground' : 'border-border'}
                        >
                          <StackSimple size={16} className="mr-1" />
                          TV Series ({result.tvSeriesCount})
                        </Button>
                      )}
                      {result.liveTvCount > 0 && (
                        <Button
                          onClick={() => setContentTypeFilter('live-tv')}
                          variant={contentTypeFilter === 'live-tv' ? 'default' : 'outline'}
                          size="sm"
                          className={contentTypeFilter === 'live-tv' ? 'bg-accent text-accent-foreground' : 'border-border'}
                        >
                          <Broadcast size={16} className="mr-1" />
                          Live TV ({result.liveTvCount})
                        </Button>
                      )}
                    </div>
                  </div>

                  {allCategories.length > 0 && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <FunnelSimple size={18} className="text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">Filter by category:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => setSelectedCategory('all')}
                          variant={selectedCategory === 'all' ? 'default' : 'outline'}
                          size="sm"
                          className={selectedCategory === 'all' ? 'bg-accent text-accent-foreground' : 'border-border'}
                        >
                          All Categories
                        </Button>
                        {allCategories.map(category => (
                          <Button
                            key={category}
                            onClick={() => setSelectedCategory(category)}
                            variant={selectedCategory === category ? 'default' : 'outline'}
                            size="sm"
                            className={selectedCategory === category ? 'bg-accent text-accent-foreground' : 'border-border'}
                          >
                            {category}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <SortAscending size={18} className="text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">Sort by:</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => setSortOption('count-desc')}
                        variant={sortOption === 'count-desc' ? 'default' : 'outline'}
                        size="sm"
                        className={sortOption === 'count-desc' ? 'bg-accent text-accent-foreground' : 'border-border'}
                      >
                        <SortDescending size={16} className="mr-1" />
                        Count (High to Low)
                      </Button>
                      <Button
                        onClick={() => setSortOption('count-asc')}
                        variant={sortOption === 'count-asc' ? 'default' : 'outline'}
                        size="sm"
                        className={sortOption === 'count-asc' ? 'bg-accent text-accent-foreground' : 'border-border'}
                      >
                        <SortAscending size={16} className="mr-1" />
                        Count (Low to High)
                      </Button>
                      <Button
                        onClick={() => setSortOption('alpha-asc')}
                        variant={sortOption === 'alpha-asc' ? 'default' : 'outline'}
                        size="sm"
                        className={sortOption === 'alpha-asc' ? 'bg-accent text-accent-foreground' : 'border-border'}
                      >
                        <SortAscending size={16} className="mr-1" />
                        A-Z
                      </Button>
                      <Button
                        onClick={() => setSortOption('alpha-desc')}
                        variant={sortOption === 'alpha-desc' ? 'default' : 'outline'}
                        size="sm"
                        className={sortOption === 'alpha-desc' ? 'bg-accent text-accent-foreground' : 'border-border'}
                      >
                        <SortDescending size={16} className="mr-1" />
                        Z-A
                      </Button>
                      <Button
                        onClick={() => setSortOption('category-asc')}
                        variant={sortOption === 'category-asc' ? 'default' : 'outline'}
                        size="sm"
                        className={sortOption === 'category-asc' ? 'bg-accent text-accent-foreground' : 'border-border'}
                      >
                        <SortAscending size={16} className="mr-1" />
                        Category (A-Z)
                      </Button>
                      <Button
                        onClick={() => setSortOption('category-desc')}
                        variant={sortOption === 'category-desc' ? 'default' : 'outline'}
                        size="sm"
                        className={sortOption === 'category-desc' ? 'bg-accent text-accent-foreground' : 'border-border'}
                      >
                        <SortDescending size={16} className="mr-1" />
                        Category (Z-A)
                      </Button>
                    </div>
                  </div>

                  <Separator className="bg-border" />

                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-foreground">URL Validation</h3>
                      {isValidating ? (
                        <Button
                          onClick={handleStopValidation}
                          variant="destructive"
                          size="sm"
                          className="bg-destructive text-destructive-foreground"
                        >
                          <StopCircle size={16} className="mr-1" />
                          Stop Validation
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          {result.linkCount > 0 && (
                            <Button
                              onClick={handleValidateUrls}
                              variant="outline"
                              size="sm"
                              className="border-accent/30 hover:bg-accent/10 text-accent"
                            >
                              <PlayCircle size={16} className="mr-1" />
                              Validate All Links
                            </Button>
                          )}
                          {result.epgData && result.epgData.channels.some(ch => ch.url) && (
                            <Button
                              onClick={handleValidateEPGUrls}
                              variant="outline"
                              size="sm"
                              className="border-accent/30 hover:bg-accent/10 text-accent"
                            >
                              <PlayCircle size={16} className="mr-1" />
                              Validate EPG URLs
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    {!isValidating && (
                      <div className="flex flex-col gap-2 p-4 rounded-lg border border-border bg-card/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Gauge size={18} className="text-accent" />
                            <span className="text-sm font-medium text-foreground">Validation Speed</span>
                          </div>
                          <Badge variant="outline" className="border-accent/30 text-accent font-mono">
                            {concurrentRequests} {concurrentRequests === 1 ? 'request' : 'requests'}/parallel
                          </Badge>
                        </div>
                        <Slider
                          value={[concurrentRequests]}
                          onValueChange={(value) => setConcurrentRequests(value[0])}
                          min={MIN_CONCURRENT_VALIDATIONS}
                          max={MAX_CONCURRENT_VALIDATIONS}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Slower (1)</span>
                          <span>Balanced ({DEFAULT_CONCURRENT_VALIDATIONS})</span>
                          <span>Faster (20)</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Higher values test more URLs simultaneously but may trigger rate limits on some servers.
                        </p>
                      </div>
                    )}

                    {isValidating && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 text-accent">
                            <RabbitLoader size={20} />
                            <span className="text-sm font-medium">Validating URLs...</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <Clock size={16} className="text-muted-foreground" />
                              <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground font-mono text-sm">
                                {formatTimeRemaining(estimatedTimeRemaining)} remaining
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <Gauge size={16} className="text-accent" />
                              <Badge variant="outline" className="border-accent/30 text-accent font-mono text-sm">
                                {validationRate.toFixed(1)} URLs/s
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <Progress value={validationProgress} className="h-2" />
                      </motion.div>
                    )}

                    {validationResults.size > 0 && (
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-3">
                          {(() => {
                            const stats = getValidationStats(validationResults)
                            return (
                              <>
                                <Badge variant="outline" className="px-4 py-2 text-sm font-mono border-green-500/30 text-green-500">
                                  <CheckCircle size={16} className="mr-2" weight="fill" />
                                  {stats.working} working
                                </Badge>
                                <Badge variant="outline" className="px-4 py-2 text-sm font-mono border-red-500/30 text-red-500">
                                  <Warning size={16} className="mr-2" weight="fill" />
                                  {stats.broken} broken
                                </Badge>
                                <Badge variant="outline" className="px-4 py-2 text-sm font-mono border-yellow-500/30 text-yellow-500">
                                  <Clock size={16} className="mr-2" weight="fill" />
                                  {stats.timeout} timeout
                                </Badge>
                                {stats.avgResponseTime > 0 && (
                                  <Badge variant="outline" className="px-4 py-2 text-sm font-mono border-border text-muted-foreground">
                                    Avg: {stats.avgResponseTime}ms
                                  </Badge>
                                )}
                              </>
                            )
                          })()}
                        </div>

                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-2">
                            <FunnelSimple size={18} className="text-muted-foreground" />
                            <span className="text-sm font-medium text-foreground">Filter by validation status:</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              onClick={() => setValidationFilter('all')}
                              variant={validationFilter === 'all' ? 'default' : 'outline'}
                              size="sm"
                              className={validationFilter === 'all' ? 'bg-accent text-accent-foreground' : 'border-border'}
                            >
                              All
                            </Button>
                            <Button
                              onClick={() => setValidationFilter('working')}
                              variant={validationFilter === 'working' ? 'default' : 'outline'}
                              size="sm"
                              className={validationFilter === 'working' ? 'bg-green-500 text-white hover:bg-green-600' : 'border-border'}
                            >
                              <CheckCircle size={16} className="mr-1" weight="fill" />
                              Working
                            </Button>
                            <Button
                              onClick={() => setValidationFilter('broken')}
                              variant={validationFilter === 'broken' ? 'default' : 'outline'}
                              size="sm"
                              className={validationFilter === 'broken' ? 'bg-red-500 text-white hover:bg-red-600' : 'border-border'}
                            >
                              <Warning size={16} className="mr-1" weight="fill" />
                              Broken
                            </Button>
                            <Button
                              onClick={() => setValidationFilter('timeout')}
                              variant={validationFilter === 'timeout' ? 'default' : 'outline'}
                              size="sm"
                              className={validationFilter === 'timeout' ? 'bg-yellow-500 text-white hover:bg-yellow-600' : 'border-border'}
                            >
                              <Clock size={16} className="mr-1" weight="fill" />
                              Timeout
                            </Button>
                          </div>
                        </div>

                        <Button
                          onClick={handleDownloadValidationReport}
                          variant="outline"
                          className="w-full border-accent/30 hover:bg-accent/10 text-accent"
                        >
                          <DownloadSimple size={20} className="mr-2" />
                          Download Validation Report
                        </Button>
                        
                        <Button
                          onClick={handleDownloadValidatedM3Us}
                          variant="outline"
                          className="w-full border-accent/30 hover:bg-accent/10 text-accent"
                        >
                          <FilmSlate size={20} className="mr-2" />
                          Download Validated M3U Playlists
                        </Button>
                      </div>
                    )}
                  </div>

                  <Separator className="bg-border" />

                  {result.linkCount > 0 && (
                    <ProtocolFilters 
                      urls={result.links}
                      onFilteredUrlsChange={(filteredUrls) => {
                        setResult(prev => {
                          if (!prev) return prev
                          
                          const filteredLinksWithCounts = prev.linksWithCounts.filter(link => 
                            filteredUrls.includes(link.url)
                          )
                          
                          return {
                            ...prev,
                            links: filteredUrls,
                            linksWithCounts: filteredLinksWithCounts,
                            uniqueLinkCount: filteredUrls.length,
                            linkCount: filteredLinksWithCounts.reduce((sum, link) => sum + link.count, 0)
                          }
                        })
                      }}
                    />
                  )}

                  {result.linkCount > 0 && <Separator className="bg-border" />}

                  {result.linkCount > 0 || (result.epgData && (result.epgData.channelCount > 0 || result.epgData.programmeCount > 0)) ? (
                    <>
                      <Tabs defaultValue={result.linkCount > 0 ? "with-counts" : "epg"} className="w-full">
                        <TabsList className={`grid w-full ${result.linkCount > 0 && result.epgData && (result.epgData.channelCount > 0 || result.epgData.programmeCount > 0) ? 'grid-cols-3' : result.linkCount > 0 ? 'grid-cols-2' : 'grid-cols-1'} bg-primary/30`}>
                          {result.linkCount > 0 && (
                            <>
                              <TabsTrigger value="with-counts">With Counts</TabsTrigger>
                              <TabsTrigger value="unique-only">Unique Only</TabsTrigger>
                            </>
                          )}
                          {result.epgData && (result.epgData.channelCount > 0 || result.epgData.programmeCount > 0) && (
                            <TabsTrigger value="epg">EPG Data</TabsTrigger>
                          )}
                        </TabsList>
                        
                        {result.linkCount > 0 && (
                          <>
                            <TabsContent value="with-counts" className="mt-4">
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-lg font-bold text-foreground">
                                All Links with Occurrence Counts
                                {mediaFilter !== 'all' && (
                                  <span className="text-sm font-normal text-muted-foreground ml-2">
                                    (Filtered: {filteredLinksWithCounts.length} {mediaFilter} links)
                                  </span>
                                )}
                              </h3>
                              <Button
                                onClick={toggleSelectAll}
                                variant="outline"
                                size="sm"
                                className="border-accent/30 hover:bg-accent/10 text-accent flex items-center gap-2"
                              >
                                {selectedUrls.size === filteredLinksWithCounts.length && filteredLinksWithCounts.length > 0 ? (
                                  <CheckSquare size={16} weight="fill" />
                                ) : (
                                  <Square size={16} />
                                )}
                                Select All
                              </Button>
                            </div>
                            <ScrollArea className="h-[300px] md:h-[400px] rounded-md border border-border bg-primary/30 p-4">
                              <div className="space-y-2 font-mono text-sm">
                                <AnimatePresence>
                                  {filteredLinksWithCounts.map(({ url, count, mediaType, contentType, filePaths, title, category, validationStatus, responseTime }, index) => {
                                    const isExpanded = expandedLinks.has(url)
                                    const isSelected = selectedUrls.has(url)
                                    return (
                                      <motion.div
                                        key={url}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.2, delay: Math.min(index * 0.02, 1) }}
                                        className="rounded overflow-hidden"
                                      >
                                        <div className={`flex items-start gap-3 px-3 py-2 hover:bg-accent/10 transition-colors duration-100 group ${isSelected ? 'bg-accent/5' : ''}`}>
                                          <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={() => toggleUrlSelection(url)}
                                            className="mt-0.5 shrink-0"
                                          />
                                          <span className="text-muted-foreground shrink-0">{index + 1}.</span>
                                          {mediaType === 'video' && <VideoCamera size={16} className="text-accent shrink-0 mt-0.5" />}
                                          {mediaType === 'audio' && <MusicNote size={16} className="text-accent shrink-0 mt-0.5" />}
                                          <div className="flex-1 min-w-0">
                                            {title && (
                                              <div className="text-sm font-semibold text-foreground mb-1">{title}</div>
                                            )}
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                              {contentType && contentType !== 'unknown' && (
                                                <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-400 flex items-center gap-1">
                                                  {getContentTypeIcon(contentType)}
                                                  {getContentTypeLabel(contentType)}
                                                </Badge>
                                              )}
                                              {category && (
                                                <Badge variant="outline" className="text-xs border-accent/30 text-accent">
                                                  {category}
                                                </Badge>
                                              )}
                                              {validationStatus && (
                                                <div className="flex items-center gap-1">
                                                  {getValidationIcon(validationStatus)}
                                                  {responseTime && (
                                                    <span className="text-xs text-muted-foreground">
                                                      {responseTime}ms
                                                    </span>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                            <div className="text-foreground/90 break-all">{url}</div>
                                            {filePaths.length > 0 && (
                                              <button
                                                onClick={() => toggleLinkExpansion(url)}
                                                className="flex items-center gap-1 mt-1 text-xs text-muted-foreground hover:text-accent transition-colors"
                                              >
                                                {isExpanded ? <CaretDown size={12} /> : <CaretRight size={12} />}
                                                Found in {filePaths.length} {filePaths.length === 1 ? 'file' : 'files'}
                                              </button>
                                            )}
                                            {isExpanded && (
                                              <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="mt-2 pl-4 space-y-1"
                                              >
                                                {filePaths.map((path, idx) => (
                                                  <div key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                                                    <File size={12} className="shrink-0 mt-0.5" />
                                                    <span className="break-all">{path}</span>
                                                  </div>
                                                ))}
                                              </motion.div>
                                            )}
                                          </div>
                                          <div className="flex gap-1 shrink-0">
                                            {(mediaType === 'video' || mediaType === 'audio') && (
                                              <>
                                                <Button
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    handlePlayMedia(url, title, mediaType)
                                                  }}
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-6 w-6 p-0 hover:bg-accent/20 text-accent opacity-0 group-hover:opacity-100 transition-opacity"
                                                  title="Play now"
                                                >
                                                  <Play size={14} weight="fill" />
                                                </Button>
                                                <Button
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleAddToQueue(url, title, mediaType)
                                                  }}
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-6 w-6 p-0 hover:bg-accent/20 text-accent opacity-0 group-hover:opacity-100 transition-opacity"
                                                  title="Add to queue"
                                                >
                                                  <Plus size={14} weight="bold" />
                                                </Button>
                                              </>
                                            )}
                                            <Button
                                              onClick={(e) => handleCopyUrl(url, e)}
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 w-6 p-0 hover:bg-accent/20 text-accent opacity-0 group-hover:opacity-100 transition-opacity"
                                              title="Copy URL"
                                            >
                                              <Copy size={14} />
                                            </Button>
                                            <Button
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                handleAnalyzeSelectedUrl(url)
                                              }}
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 w-6 p-0 hover:bg-accent/20 text-accent opacity-0 group-hover:opacity-100 transition-opacity"
                                              title="Analyze with AI"
                                            >
                                              <Sparkle size={14} weight="fill" />
                                            </Button>
                                            <Badge 
                                              variant={count > 1 ? "destructive" : "outline"} 
                                              className={`shrink-0 ${count > 1 ? 'bg-destructive/20 text-destructive border-destructive/30' : 'text-muted-foreground'}`}
                                            >
                                              ×{count}
                                            </Badge>
                                          </div>
                                        </div>
                                      </motion.div>
                                    )
                                  })}
                                </AnimatePresence>
                              </div>
                            </ScrollArea>
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="unique-only" className="mt-4">
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-lg font-bold text-foreground">
                                Unique Links Only
                                {mediaFilter !== 'all' && (
                                  <span className="text-sm font-normal text-muted-foreground ml-2">
                                    (Filtered: {filteredUniqueLinks.length} {mediaFilter} links)
                                  </span>
                                )}
                              </h3>
                              <Button
                                onClick={toggleSelectAll}
                                variant="outline"
                                size="sm"
                                className="border-accent/30 hover:bg-accent/10 text-accent flex items-center gap-2"
                              >
                                {selectedUrls.size === filteredLinksWithCounts.length && filteredLinksWithCounts.length > 0 ? (
                                  <CheckSquare size={16} weight="fill" />
                                ) : (
                                  <Square size={16} />
                                )}
                                Select All
                              </Button>
                            </div>
                            <ScrollArea className="h-[300px] md:h-[400px] rounded-md border border-border bg-primary/30 p-4">
                              <div className="space-y-2 font-mono text-sm">
                                <AnimatePresence>
                                  {filteredLinksWithCounts.map((linkData, index) => {
                                    const { url, filePaths, mediaType, contentType, title, category, validationStatus, responseTime } = linkData
                                    const isExpanded = expandedLinks.has(url)
                                    const isSelected = selectedUrls.has(url)
                                    return (
                                      <motion.div
                                        key={url}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.2, delay: Math.min(index * 0.02, 1) }}
                                        className="rounded overflow-hidden"
                                      >
                                        <div className={`flex items-start gap-2 px-3 py-2 hover:bg-accent/10 transition-colors duration-100 group ${isSelected ? 'bg-accent/5' : ''}`}>
                                          <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={() => toggleUrlSelection(url)}
                                            className="mt-0.5 shrink-0"
                                          />
                                          <span className="text-muted-foreground">{index + 1}.</span>
                                          {mediaType === 'video' && <VideoCamera size={16} className="text-accent shrink-0 mt-0.5" />}
                                          {mediaType === 'audio' && <MusicNote size={16} className="text-accent shrink-0 mt-0.5" />}
                                          <div className="flex-1 min-w-0">
                                            {title && (
                                              <div className="text-sm font-semibold text-foreground mb-1">{title}</div>
                                            )}
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                              {contentType && contentType !== 'unknown' && (
                                                <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-400 flex items-center gap-1">
                                                  {getContentTypeIcon(contentType)}
                                                  {getContentTypeLabel(contentType)}
                                                </Badge>
                                              )}
                                              {category && (
                                                <Badge variant="outline" className="text-xs border-accent/30 text-accent">
                                                  {category}
                                                </Badge>
                                              )}
                                              {validationStatus && (
                                                <div className="flex items-center gap-1">
                                                  {getValidationIcon(validationStatus)}
                                                  {responseTime && (
                                                    <span className="text-xs text-muted-foreground">
                                                      {responseTime}ms
                                                    </span>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                            <div className="text-foreground/90 break-all">{url}</div>
                                            {filePaths.length > 0 && (
                                              <button
                                                onClick={() => toggleLinkExpansion(url)}
                                                className="flex items-center gap-1 mt-1 text-xs text-muted-foreground hover:text-accent transition-colors"
                                              >
                                                {isExpanded ? <CaretDown size={12} /> : <CaretRight size={12} />}
                                                Found in {filePaths.length} {filePaths.length === 1 ? 'file' : 'files'}
                                              </button>
                                            )}
                                            {isExpanded && (
                                              <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="mt-2 pl-4 space-y-1"
                                              >
                                                {filePaths.map((path, idx) => (
                                                  <div key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                                                    <File size={12} className="shrink-0 mt-0.5" />
                                                    <span className="break-all">{path}</span>
                                                  </div>
                                                ))}
                                              </motion.div>
                                            )}
                                          </div>
                                          <div className="flex gap-1 shrink-0">
                                            {(mediaType === 'video' || mediaType === 'audio') && (
                                              <>
                                                <Button
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    handlePlayMedia(url, title, mediaType)
                                                  }}
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-6 w-6 p-0 hover:bg-accent/20 text-accent opacity-0 group-hover:opacity-100 transition-opacity"
                                                  title="Play now"
                                                >
                                                  <Play size={14} weight="fill" />
                                                </Button>
                                                <Button
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleAddToQueue(url, title, mediaType)
                                                  }}
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-6 w-6 p-0 hover:bg-accent/20 text-accent opacity-0 group-hover:opacity-100 transition-opacity"
                                                  title="Add to queue"
                                                >
                                                  <Plus size={14} weight="bold" />
                                                </Button>
                                              </>
                                            )}
                                            <Button
                                              onClick={(e) => handleCopyUrl(url, e)}
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 w-6 p-0 hover:bg-accent/20 text-accent opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                            >
                                              <Copy size={14} />
                                            </Button>
                                          </div>
                                        </div>
                                      </motion.div>
                                    )
                                  })}
                                </AnimatePresence>
                              </div>
                            </ScrollArea>
                          </div>
                        </TabsContent>
                          </>
                        )}
                        
                        {result.epgData && (result.epgData.channelCount > 0 || result.epgData.programmeCount > 0) && (
                          <TabsContent value="epg" className="mt-4">
                            <div className="space-y-4">
                              <div>
                                <div className="flex items-center justify-between mb-3">
                                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                                    <Television size={24} className="text-accent" />
                                    EPG Channels ({filteredEPGChannels.length}{channelUrlFilter !== 'all' ? ` of ${result.epgData.channelCount}` : ''})
                                  </h3>
                                  <div className="flex gap-2">
                                    <Button
                                      onClick={handleBulkCopyEPGUrls}
                                      variant="outline"
                                      size="sm"
                                      className="border-accent/30 hover:bg-accent/10 text-accent"
                                      disabled={!result.epgData.channels.some(ch => ch.url)}
                                    >
                                      <CopySimple size={16} className="mr-1" />
                                      Copy All URLs
                                    </Button>
                                    <Button
                                      onClick={() => setChannelViewMode('list')}
                                      variant={channelViewMode === 'list' ? 'default' : 'outline'}
                                      size="sm"
                                      className={channelViewMode === 'list' ? 'bg-accent text-accent-foreground' : 'border-border'}
                                    >
                                      <List size={16} />
                                    </Button>
                                    <Button
                                      onClick={() => setChannelViewMode('grid')}
                                      variant={channelViewMode === 'grid' ? 'default' : 'outline'}
                                      size="sm"
                                      className={channelViewMode === 'grid' ? 'bg-accent text-accent-foreground' : 'border-border'}
                                    >
                                      <SquaresFour size={16} />
                                    </Button>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2 mb-3">
                                  <FunnelSimple size={18} className="text-muted-foreground" />
                                  <span className="text-sm font-medium text-foreground">Channel filter:</span>
                                  <div className="flex flex-wrap gap-2 ml-2">
                                    <Button
                                      onClick={() => setChannelUrlFilter('all')}
                                      variant={channelUrlFilter === 'all' ? 'default' : 'outline'}
                                      size="sm"
                                      className={channelUrlFilter === 'all' ? 'bg-accent text-accent-foreground' : 'border-border'}
                                    >
                                      All ({result.epgData.channelCount})
                                    </Button>
                                    <Button
                                      onClick={() => setChannelUrlFilter('with-urls')}
                                      variant={channelUrlFilter === 'with-urls' ? 'default' : 'outline'}
                                      size="sm"
                                      className={channelUrlFilter === 'with-urls' ? 'bg-accent text-accent-foreground' : 'border-border'}
                                    >
                                      With URLs ({result.epgData.channels.filter(ch => ch.url).length})
                                    </Button>
                                    <Button
                                      onClick={() => setChannelUrlFilter('without-urls')}
                                      variant={channelUrlFilter === 'without-urls' ? 'default' : 'outline'}
                                      size="sm"
                                      className={channelUrlFilter === 'without-urls' ? 'bg-accent text-accent-foreground' : 'border-border'}
                                    >
                                      Without URLs ({result.epgData.channels.filter(ch => !ch.url).length})
                                    </Button>
                                  </div>
                                </div>
                                
                                {channelViewMode === 'list' ? (
                                  <ScrollArea className="h-[200px] rounded-md border border-border bg-primary/30 p-4">
                                    <div className="space-y-3 text-sm">
                                      {filteredEPGChannels.map((channel, index) => (
                                        <motion.div
                                          key={channel.id}
                                          initial={{ opacity: 0, x: -20 }}
                                          animate={{ opacity: 1, x: 0 }}
                                          transition={{ duration: 0.2, delay: Math.min(index * 0.02, 1) }}
                                          className="p-3 rounded hover:bg-accent/10 transition-colors duration-100 flex gap-3"
                                        >
                                          {channel.icon && (
                                            <div className="shrink-0">
                                              <img 
                                                src={channel.icon} 
                                                alt={channel.displayName}
                                                className="w-12 h-12 rounded object-contain bg-secondary/50"
                                                onError={(e) => {
                                                  (e.target as HTMLImageElement).style.display = 'none'
                                                }}
                                              />
                                            </div>
                                          )}
                                          <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-foreground">{channel.displayName}</div>
                                            <div className="text-xs text-muted-foreground mt-1">ID: {channel.id}</div>
                                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                              {(channel.category || channel.group) && (
                                                <Badge variant="outline" className="text-xs border-accent/30 text-accent">
                                                  {channel.category || channel.group}
                                                </Badge>
                                              )}
                                              {channel.validationStatus && (
                                                <div className="flex items-center gap-1">
                                                  {getValidationIcon(channel.validationStatus)}
                                                  {channel.responseTime && (
                                                    <span className="text-xs text-muted-foreground">
                                                      {channel.responseTime}ms
                                                    </span>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                            {channel.url && (
                                              <div className="flex items-start gap-2 mt-1">
                                                <div className="text-xs text-accent font-mono break-all flex-1">{channel.url}</div>
                                                <div className="flex gap-1 shrink-0">
                                                  <Button
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      const urlMediaType = getMediaType(channel.url!)
                                                      handlePlayMedia(channel.url!, channel.displayName, urlMediaType)
                                                    }}
                                                    variant="ghost"
                                                    size="sm"
                                                    className="shrink-0 h-6 w-6 p-0 hover:bg-accent/20 text-accent"
                                                    title="Play now"
                                                  >
                                                    <Play size={14} weight="fill" />
                                                  </Button>
                                                  <Button
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      const urlMediaType = getMediaType(channel.url!)
                                                      handleAddToQueue(channel.url!, channel.displayName, urlMediaType)
                                                    }}
                                                    variant="ghost"
                                                    size="sm"
                                                    className="shrink-0 h-6 w-6 p-0 hover:bg-accent/20 text-accent"
                                                    title="Add to queue"
                                                  >
                                                    <Plus size={14} weight="bold" />
                                                  </Button>
                                                  <Button
                                                    onClick={(e) => handleCopyUrl(channel.url!, e)}
                                                    variant="ghost"
                                                    size="sm"
                                                    className="shrink-0 h-6 w-6 p-0 hover:bg-accent/20 text-accent"
                                                  >
                                                    <Copy size={14} />
                                                  </Button>
                                                </div>
                                              </div>
                                            )}
                                            {channel.icon && (
                                              <div className="text-xs text-muted-foreground/70 mt-1 font-mono break-all">Logo: {channel.icon}</div>
                                            )}
                                          </div>
                                        </motion.div>
                                      ))}
                                    </div>
                                  </ScrollArea>
                                ) : (
                                  <ScrollArea className="h-[400px] rounded-md border border-border bg-primary/30 p-4">
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                      {filteredEPGChannels.map((channel, index) => (
                                        <motion.div
                                          key={channel.id}
                                          initial={{ opacity: 0, scale: 0.9 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          transition={{ duration: 0.2, delay: Math.min(index * 0.02, 1) }}
                                          className="group relative"
                                        >
                                          <div className="rounded-lg overflow-hidden border border-border hover:border-accent/50 transition-all duration-200 hover:shadow-lg hover:shadow-accent/20 bg-card">
                                            <div className="aspect-square flex items-center justify-center bg-secondary/30 p-4 relative overflow-hidden">
                                              {channel.icon ? (
                                                <img 
                                                  src={channel.icon} 
                                                  alt={channel.displayName}
                                                  className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-200"
                                                  onError={(e) => {
                                                    const target = e.target as HTMLImageElement
                                                    target.style.display = 'none'
                                                    const parent = target.parentElement
                                                    if (parent) {
                                                      const fallback = document.createElement('div')
                                                      fallback.className = 'w-full h-full flex items-center justify-center'
                                                      fallback.innerHTML = `<svg class="w-16 h-16 text-muted-foreground" fill="currentColor" viewBox="0 0 256 256"><path d="M232,208a8,8,0,0,1-8,8H32a8,8,0,0,1,0-16H224A8,8,0,0,1,232,208ZM80,144V56a16,16,0,0,1,16-16H200a16,16,0,0,1,16,16v88a16,16,0,0,1-16,16H96A16,16,0,0,1,80,144Zm16,0H200V56H96ZM56,112V72a8,8,0,0,0-16,0v40a8,8,0,0,0,16,0Z"></path></svg>`
                                                      parent.appendChild(fallback)
                                                    }
                                                  }}
                                                />
                                              ) : (
                                                <Television size={64} className="text-muted-foreground opacity-30" />
                                              )}
                                            </div>
                                            <div className="p-3 bg-card">
                                              <div className="font-semibold text-foreground text-sm line-clamp-2 text-center mb-1">
                                                {channel.displayName}
                                              </div>
                                              <div className="flex flex-wrap justify-center items-center gap-1 mb-1">
                                                {(channel.category || channel.group) && (
                                                  <Badge variant="outline" className="text-xs border-accent/30 text-accent">
                                                    {channel.category || channel.group}
                                                  </Badge>
                                                )}
                                                {channel.validationStatus && (
                                                  <div className="flex items-center gap-1">
                                                    {getValidationIcon(channel.validationStatus)}
                                                  </div>
                                                )}
                                              </div>
                                              <div className="text-xs text-muted-foreground text-center truncate">
                                                {channel.id}
                                              </div>
                                            </div>
                                          </div>
                                          {channel.url && (
                                            <motion.div 
                                              initial={{ opacity: 0 }}
                                              whileHover={{ opacity: 1 }}
                                              className="absolute inset-0 bg-background/95 rounded-lg p-3 flex flex-col justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                            >
                                              <div className="font-semibold text-foreground text-sm text-center mb-2">
                                                {channel.displayName}
                                              </div>
                                              <div className="flex flex-wrap justify-center items-center gap-2 mb-2">
                                                {(channel.category || channel.group) && (
                                                  <Badge variant="outline" className="text-xs border-accent/30 text-accent">
                                                    {channel.category || channel.group}
                                                  </Badge>
                                                )}
                                                {channel.validationStatus && (
                                                  <div className="flex items-center gap-1">
                                                    {getValidationIcon(channel.validationStatus)}
                                                    {channel.responseTime && (
                                                      <span className="text-xs text-muted-foreground">
                                                        {channel.responseTime}ms
                                                      </span>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                              <div className="relative">
                                                <div className="text-xs text-accent font-mono break-all line-clamp-4 bg-secondary/50 p-2 rounded pr-16">
                                                  {channel.url}
                                                </div>
                                                <div className="absolute top-1 right-1 flex gap-1">
                                                  <Button
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      const urlMediaType = getMediaType(channel.url!)
                                                      handlePlayMedia(channel.url!, channel.displayName, urlMediaType)
                                                    }}
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0 hover:bg-accent/20 text-accent"
                                                    title="Play now"
                                                  >
                                                    <Play size={14} weight="fill" />
                                                  </Button>
                                                  <Button
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      const urlMediaType = getMediaType(channel.url!)
                                                      handleAddToQueue(channel.url!, channel.displayName, urlMediaType)
                                                    }}
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0 hover:bg-accent/20 text-accent"
                                                    title="Add to queue"
                                                  >
                                                    <Plus size={14} weight="bold" />
                                                  </Button>
                                                  <Button
                                                    onClick={(e) => handleCopyUrl(channel.url!, e)}
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0 hover:bg-accent/20 text-accent"
                                                  >
                                                    <Copy size={14} />
                                                  </Button>
                                                </div>
                                              </div>
                                              {channel.icon && (
                                                <div className="text-xs text-muted-foreground font-mono break-all line-clamp-2 bg-secondary/30 p-2 rounded">
                                                  {channel.icon}
                                                </div>
                                              )}
                                            </motion.div>
                                          )}
                                        </motion.div>
                                      ))}
                                    </div>
                                  </ScrollArea>
                                )}
                              </div>
                              
                              {result.epgData.programmeCount > 0 && (
                                <div>
                                  <h3 className="text-lg font-bold text-foreground mb-3">
                                    Programme Schedule ({result.epgData.programmeCount} programmes)
                                  </h3>
                                  <ScrollArea className="h-[200px] rounded-md border border-border bg-primary/30 p-4">
                                    <div className="space-y-3 text-sm">
                                      {result.epgData.programmes.slice(0, 50).map((programme, index) => (
                                        <motion.div
                                          key={`${programme.channel}-${programme.start}-${index}`}
                                          initial={{ opacity: 0, x: -20 }}
                                          animate={{ opacity: 1, x: 0 }}
                                          transition={{ duration: 0.2, delay: Math.min(index * 0.02, 1) }}
                                          className="p-3 rounded hover:bg-accent/10 transition-colors duration-100 border-l-2 border-accent/30 flex gap-3"
                                        >
                                          {programme.icon && (
                                            <div className="shrink-0">
                                              <img 
                                                src={programme.icon} 
                                                alt={programme.title}
                                                className="w-16 h-16 rounded object-cover bg-secondary/50"
                                                onError={(e) => {
                                                  (e.target as HTMLImageElement).style.display = 'none'
                                                }}
                                              />
                                            </div>
                                          )}
                                          <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-foreground">{programme.title}</div>
                                            <div className="text-xs text-muted-foreground mt-1">
                                              Channel: {programme.channel}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                              Time: {programme.start.substring(0, 4)}-{programme.start.substring(4, 6)}-{programme.start.substring(6, 8)} {programme.start.substring(8, 10)}:{programme.start.substring(10, 12)}
                                            </div>
                                            {programme.description && (
                                              <div className="text-xs text-foreground/80 mt-2">{programme.description}</div>
                                            )}
                                            <div className="flex flex-wrap gap-2 mt-2">
                                              {programme.category && (
                                                <Badge variant="outline" className="text-xs">{programme.category}</Badge>
                                              )}
                                              {programme.rating && (
                                                <Badge variant="outline" className="text-xs">Rating: {programme.rating}</Badge>
                                              )}
                                              {programme.episodeNum && (
                                                <Badge variant="outline" className="text-xs">Ep: {programme.episodeNum}</Badge>
                                              )}
                                            </div>
                                          </div>
                                        </motion.div>
                                      ))}
                                      {result.epgData.programmeCount > 50 && (
                                        <div className="text-center text-muted-foreground text-xs py-2">
                                          ... and {result.epgData.programmeCount - 50} more programmes (download full EPG data to see all)
                                        </div>
                                      )}
                                    </div>
                                  </ScrollArea>
                                </div>
                              )}
                              
                              <div className="flex flex-col sm:flex-row gap-3">
                                <Button
                                  onClick={handleDownloadEPGChannels}
                                  variant="outline"
                                  className="border-accent/30 hover:bg-accent/10 text-accent"
                                  disabled={!result.epgData || result.epgData.channelCount === 0}
                                >
                                  <DownloadSimple size={20} className="mr-2" />
                                  Download Channels
                                </Button>
                                <Button
                                  onClick={handleDownloadEPGChannelURLs}
                                  variant="outline"
                                  className="border-accent/30 hover:bg-accent/10 text-accent"
                                  disabled={!result.epgData || !result.epgData.channels.some(ch => ch.url)}
                                >
                                  <DownloadSimple size={20} className="mr-2" />
                                  Download Channel URLs
                                </Button>
                                <Button
                                  onClick={handleDownloadEPGProgrammes}
                                  variant="outline"
                                  className="border-accent/30 hover:bg-accent/10 text-accent"
                                  disabled={!result.epgData || result.epgData.programmeCount === 0}
                                >
                                  <DownloadSimple size={20} className="mr-2" />
                                  Download Programmes
                                </Button>
                              </div>
                            </div>
                          </TabsContent>
                        )}
                      </Tabs>

                      <div className="flex flex-col gap-3">
                        {result.linkCount > 0 && mediaFilter !== 'all' && (
                          <Alert className="border-accent/50 bg-accent/10">
                            <AlertDescription className="text-foreground text-sm">
                              <FunnelSimple size={16} className="inline mr-1" />
                              Viewing {mediaFilter} links only. Downloads include all links regardless of filter.
                            </AlertDescription>
                          </Alert>
                        )}
                        
                        {(result.linkCount > 0 || (result.epgData && (result.epgData.channelCount > 0 || result.epgData.programmeCount > 0))) && (
                          <Button
                            onClick={handleBatchDownload}
                            className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-medium hover:translate-y-[-2px] transition-transform duration-100"
                          >
                            <Package size={20} className="mr-2" />
                            Download All Files (ZIP)
                          </Button>
                        )}
                        
                        {result.linkCount > 0 && (
                          <>
                            <Separator className="bg-border" />
                            
                            <div className="text-xs text-muted-foreground text-center font-medium">
                              Or download individually:
                            </div>
                            
                            <Button
                              onClick={handleDownload}
                              variant="outline"
                              className="w-full border-accent/30 hover:bg-accent/10 text-accent"
                            >
                              <DownloadSimple size={20} className="mr-2" />
                              All Links ({result.linkCount})
                            </Button>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <Button
                                onClick={handleDownloadUnique}
                                variant="outline"
                                className="border-accent/30 hover:bg-accent/10 text-accent"
                              >
                                <FileText size={20} className="mr-2" />
                                Unique Only ({result.uniqueLinkCount})
                              </Button>
                              
                              <Button
                                onClick={handleDownloadDuplicates}
                                variant="outline"
                                className={`border-destructive/30 hover:bg-destructive/10 text-destructive ${result.duplicateCount === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                disabled={result.duplicateCount === 0}
                              >
                                <FileText size={20} className="mr-2" />
                                Duplicates {result.duplicateCount > 0 && `(${result.duplicateCount})`}
                              </Button>
                            </div>
                          </>
                        )}

                        <Button
                          onClick={handleClear}
                          variant="outline"
                          className="w-full border-border hover:bg-secondary"
                        >
                          <Trash size={20} className="mr-2" />
                          Clear Results
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-center py-8">
                        <RabbitSleeping size={96} message="No media links found yet... upload some files to wake me up!" />
                      </div>
                      <Alert className="border-accent/30 bg-accent/5">
                        <AlertDescription className="text-foreground text-center">
                          No media links or EPG data found in the uploaded files. Make sure your files contain valid URLs, playlist entries, or EPG XML data.
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                </motion.div>
              </>
            )}
          </div>
        </Card>

        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 text-center text-sm text-muted-foreground"
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <AnimatedRabbit size={20} variant="idle" />
            <span className="font-semibold text-accent">AI-Powered Media Scanner</span>
          </div>
          Supports 50+ formats including M3U, M3U8, PLS, XSPF, ASX, WPL, SMIL, DASH, EPG XML, Android packages (APK, AAB, XAPK, APKS, APKM, APEX, APKX), ZIP archives, 7Z archives, BZ2 archives, RAR archives, TAR archives (including .tar.gz, .tgz), EXE files, Git repositories (GitHub, GitLab, Bitbucket, Gitea, Codeberg), Kodi files (.nfo, .strm, .xsp, addon.xml, sources.xml, .py plugins), Kodi addon repositories, web apps, and Xtream Codes API. Batch archive scanning and Kodi addon downloader included. Detects HTTP, HTTPS, RTSP, RTMP, RTP, UDP, HLS, DASH, MMS protocols. Get instant AI assistance for finding IPTV sources, understanding URL patterns, and troubleshooting with Gemini 2.0 Flash.
        </motion.footer>
      </div>

      {showPlayer && playlistQueue.length > 0 && (
        <MediaPlayer
          url={playlistQueue[currentQueueIndex]?.url || ''}
          title={playlistQueue[currentQueueIndex]?.title}
          mediaType={playlistQueue[currentQueueIndex]?.mediaType || 'unknown'}
          queue={playlistQueue}
          currentIndex={currentQueueIndex}
          onQueueChange={handleQueueChange}
          onClose={handleClosePlayer}
        />
      )}

      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key size={20} className="text-accent" />
              Playlist Authentication
            </DialogTitle>
            <DialogDescription>
              Enter credentials for password-protected playlists. Supports Basic Auth, API Keys, and Bearer Tokens.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Playlist URL</label>
              <Input
                value={currentAuthUrl}
                readOnly
                className="font-mono text-xs bg-muted"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Authentication Type</label>
              <div className="flex gap-2">
                <Button
                  onClick={() => setAuthType('basic')}
                  variant={authType === 'basic' ? 'default' : 'outline'}
                  size="sm"
                  className={authType === 'basic' ? 'bg-accent text-accent-foreground' : 'border-border'}
                >
                  Basic Auth
                </Button>
                <Button
                  onClick={() => setAuthType('apikey')}
                  variant={authType === 'apikey' ? 'default' : 'outline'}
                  size="sm"
                  className={authType === 'apikey' ? 'bg-accent text-accent-foreground' : 'border-border'}
                >
                  API Key
                </Button>
                <Button
                  onClick={() => setAuthType('token')}
                  variant={authType === 'token' ? 'default' : 'outline'}
                  size="sm"
                  className={authType === 'token' ? 'bg-accent text-accent-foreground' : 'border-border'}
                >
                  Bearer Token
                </Button>
              </div>
            </div>

            {authType === 'basic' && (
              <>
                <div className="space-y-2">
                  <label htmlFor="auth-username" className="text-sm font-medium text-foreground">
                    Username
                  </label>
                  <Input
                    id="auth-username"
                    type="text"
                    placeholder="Enter username"
                    value={authUsername}
                    onChange={(e) => setAuthUsername(e.target.value)}
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="auth-password" className="text-sm font-medium text-foreground">
                    Password
                  </label>
                  <Input
                    id="auth-password"
                    type="password"
                    placeholder="Enter password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
              </>
            )}

            {authType === 'apikey' && (
              <div className="space-y-2">
                <label htmlFor="auth-apikey" className="text-sm font-medium text-foreground">
                  API Key
                </label>
                <Input
                  id="auth-apikey"
                  type="text"
                  placeholder="Enter API key"
                  value={authApiKey}
                  onChange={(e) => setAuthApiKey(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Will be sent as X-API-Key header or api_key query parameter
                </p>
              </div>
            )}

            {authType === 'token' && (
              <div className="space-y-2">
                <label htmlFor="auth-token" className="text-sm font-medium text-foreground">
                  Bearer Token
                </label>
                <Textarea
                  id="auth-token"
                  placeholder="Enter bearer token"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  className="font-mono text-xs min-h-[80px]"
                />
                <p className="text-xs text-muted-foreground">
                  Will be sent as Authorization: Bearer header
                </p>
              </div>
            )}

            <Alert className="border-accent/30 bg-accent/5">
              <AlertDescription className="text-xs">
                <Lock size={14} className="inline mr-1" />
                Credentials are stored in memory only and not persisted. You'll need to re-enter them if you refresh the page.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button
              onClick={handleCancelAuth}
              variant="outline"
              className="border-border"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveAuth}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={
                (authType === 'basic' && (!authUsername || !authPassword)) ||
                (authType === 'apikey' && !authApiKey) ||
                (authType === 'token' && !authToken)
              }
            >
              <Lock size={16} className="mr-2" />
              Save Credentials
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showM3UDialog} onOpenChange={setShowM3UDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FilmSlate size={20} className="text-accent" />
              M3U Playlists Generated
            </DialogTitle>
            <DialogDescription>
              Your media links have been organized into M3U playlist files by category. Download individually or get all in a ZIP archive.
            </DialogDescription>
          </DialogHeader>
          
          {m3uGenerationResult && (
            <div className="space-y-4 py-4">
              {('moviesDescription' in m3uGenerationResult || 'tvSeriesDescription' in m3uGenerationResult || 'liveTVDescription' in m3uGenerationResult || 'allDescription' in m3uGenerationResult) && (
                <>
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-foreground">Playlist Information:</h4>
                    {m3uGenerationResult.movieCount > 0 && 'moviesDescription' in m3uGenerationResult && m3uGenerationResult.moviesDescription && (
                      <div className="text-xs text-muted-foreground bg-accent/5 rounded p-2">
                        <strong>Movies:</strong> {m3uGenerationResult.moviesDescription}
                      </div>
                    )}
                    {m3uGenerationResult.tvSeriesCount > 0 && 'tvSeriesDescription' in m3uGenerationResult && m3uGenerationResult.tvSeriesDescription && (
                      <div className="text-xs text-muted-foreground bg-accent/5 rounded p-2">
                        <strong>TV Series:</strong> {m3uGenerationResult.tvSeriesDescription}
                      </div>
                    )}
                    {m3uGenerationResult.liveTVCount > 0 && 'liveTVDescription' in m3uGenerationResult && m3uGenerationResult.liveTVDescription && (
                      <div className="text-xs text-muted-foreground bg-accent/5 rounded p-2">
                        <strong>Live TV:</strong> {m3uGenerationResult.liveTVDescription}
                      </div>
                    )}
                    {m3uGenerationResult.totalCount > 0 && 'allDescription' in m3uGenerationResult && m3uGenerationResult.allDescription && (
                      <div className="text-xs text-muted-foreground bg-accent/5 rounded p-2">
                        <strong>All Media:</strong> {m3uGenerationResult.allDescription}
                      </div>
                    )}
                  </div>
                  <Separator className="bg-border" />
                </>
              )}
              
              <div className="grid grid-cols-2 gap-3">
                <Card className="bg-card border-border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FilmSlate size={20} className="text-purple-500" weight="fill" />
                    <span className="text-sm font-semibold text-foreground">Movies</span>
                  </div>
                  <div className="text-2xl font-bold text-accent">{m3uGenerationResult.movieCount}</div>
                  <Button
                    onClick={() => handleDownloadIndividualM3U('movies')}
                    variant="outline"
                    size="sm"
                    className="w-full mt-2 border-accent/30 hover:bg-accent/10 text-accent"
                    disabled={m3uGenerationResult.movieCount === 0}
                  >
                    <DownloadSimple size={16} className="mr-1" />
                    Download
                  </Button>
                </Card>
                
                <Card className="bg-card border-border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <StackSimple size={20} className="text-blue-500" weight="fill" />
                    <span className="text-sm font-semibold text-foreground">TV Series</span>
                  </div>
                  <div className="text-2xl font-bold text-accent">{m3uGenerationResult.tvSeriesCount}</div>
                  <Button
                    onClick={() => handleDownloadIndividualM3U('tv-series')}
                    variant="outline"
                    size="sm"
                    className="w-full mt-2 border-accent/30 hover:bg-accent/10 text-accent"
                    disabled={m3uGenerationResult.tvSeriesCount === 0}
                  >
                    <DownloadSimple size={16} className="mr-1" />
                    Download
                  </Button>
                </Card>
                
                <Card className="bg-card border-border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Broadcast size={20} className="text-red-500" weight="fill" />
                    <span className="text-sm font-semibold text-foreground">Live TV</span>
                  </div>
                  <div className="text-2xl font-bold text-accent">{m3uGenerationResult.liveTVCount}</div>
                  <Button
                    onClick={() => handleDownloadIndividualM3U('live-tv')}
                    variant="outline"
                    size="sm"
                    className="w-full mt-2 border-accent/30 hover:bg-accent/10 text-accent"
                    disabled={m3uGenerationResult.liveTVCount === 0}
                  >
                    <DownloadSimple size={16} className="mr-1" />
                    Download
                  </Button>
                </Card>
                
                <Card className="bg-card border-border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle size={20} className="text-accent" weight="fill" />
                    <span className="text-sm font-semibold text-foreground">All Categories</span>
                  </div>
                  <div className="text-2xl font-bold text-accent">{m3uGenerationResult.totalCount}</div>
                  <Button
                    onClick={() => handleDownloadIndividualM3U('all')}
                    variant="outline"
                    size="sm"
                    className="w-full mt-2 border-accent/30 hover:bg-accent/10 text-accent"
                    disabled={m3uGenerationResult.totalCount === 0}
                  >
                    <DownloadSimple size={16} className="mr-1" />
                    Download
                  </Button>
                </Card>
              </div>
              
              <Alert className="border-accent/30 bg-accent/5">
                <AlertDescription className="text-foreground text-xs">
                  <FilmSlate size={14} className="inline mr-1" />
                  M3U playlists include metadata like titles and categories. Compatible with VLC, Kodi, PotPlayer, IPTV Smarters, TiviMate, GSE Smart IPTV, and Perfect Player.
                </AlertDescription>
              </Alert>
              
              <Separator className="bg-border" />
              
              <Button
                onClick={handleDownloadM3UBatch}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                disabled={m3uGenerationResult.totalCount === 0}
              >
                <Package size={20} className="mr-2" />
                Download All M3U Files (ZIP)
              </Button>
            </div>
          )}
          
          <DialogFooter>
            <Button
              onClick={() => setShowM3UDialog(false)}
              variant="outline"
              className="border-border"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCustomM3UDialog} onOpenChange={setShowCustomM3UDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PencilSimple size={20} className="text-accent" />
              Custom M3U Playlist Names & Descriptions
            </DialogTitle>
            <DialogDescription>
              Personalize your M3U playlists with custom names and descriptions for better organization. Set sorting options and grouping preferences.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground">Movies Playlist</h4>
              <div className="space-y-3">
                <div>
                  <label htmlFor="movies-name" className="text-sm font-medium text-foreground block mb-1">
                    Playlist Name
                  </label>
                  <Input
                    id="movies-name"
                    placeholder="e.g., My Action Movies, Kids Movies Collection"
                    value={customM3UMoviesName}
                    onChange={(e) => setCustomM3UMoviesName(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="movies-desc" className="text-sm font-medium text-foreground block mb-1">
                    Description (Optional)
                  </label>
                  <Textarea
                    id="movies-desc"
                    placeholder="Describe this playlist, e.g., Collection of action-packed blockbusters from 2020-2024"
                    value={customM3UMoviesDesc}
                    onChange={(e) => setCustomM3UMoviesDesc(e.target.value)}
                    className="min-h-[60px]"
                  />
                </div>
              </div>
            </div>

            <Separator className="bg-border" />

            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground">TV Series Playlist</h4>
              <div className="space-y-3">
                <div>
                  <label htmlFor="tv-name" className="text-sm font-medium text-foreground block mb-1">
                    Playlist Name
                  </label>
                  <Input
                    id="tv-name"
                    placeholder="e.g., Binge-Worthy Shows, Family TV Series"
                    value={customM3UTVSeriesName}
                    onChange={(e) => setCustomM3UTVSeriesName(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="tv-desc" className="text-sm font-medium text-foreground block mb-1">
                    Description (Optional)
                  </label>
                  <Textarea
                    id="tv-desc"
                    placeholder="Describe this playlist, e.g., Complete episodes of popular drama and comedy series"
                    value={customM3UTVSeriesDesc}
                    onChange={(e) => setCustomM3UTVSeriesDesc(e.target.value)}
                    className="min-h-[60px]"
                  />
                </div>
              </div>
            </div>

            <Separator className="bg-border" />

            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground">Live TV Playlist</h4>
              <div className="space-y-3">
                <div>
                  <label htmlFor="live-name" className="text-sm font-medium text-foreground block mb-1">
                    Playlist Name
                  </label>
                  <Input
                    id="live-name"
                    placeholder="e.g., Premium IPTV Channels, Sports & News"
                    value={customM3ULiveTVName}
                    onChange={(e) => setCustomM3ULiveTVName(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="live-desc" className="text-sm font-medium text-foreground block mb-1">
                    Description (Optional)
                  </label>
                  <Textarea
                    id="live-desc"
                    placeholder="Describe this playlist, e.g., Live streaming channels for news, sports, and entertainment"
                    value={customM3ULiveTVDesc}
                    onChange={(e) => setCustomM3ULiveTVDesc(e.target.value)}
                    className="min-h-[60px]"
                  />
                </div>
              </div>
            </div>

            <Separator className="bg-border" />

            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground">Complete Collection Playlist</h4>
              <div className="space-y-3">
                <div>
                  <label htmlFor="all-name" className="text-sm font-medium text-foreground block mb-1">
                    Playlist Name
                  </label>
                  <Input
                    id="all-name"
                    placeholder="e.g., Master Media Collection, Everything"
                    value={customM3UAllName}
                    onChange={(e) => setCustomM3UAllName(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="all-desc" className="text-sm font-medium text-foreground block mb-1">
                    Description (Optional)
                  </label>
                  <Textarea
                    id="all-desc"
                    placeholder="Describe this playlist, e.g., Complete media collection with movies, TV shows, and live channels"
                    value={customM3UAllDesc}
                    onChange={(e) => setCustomM3UAllDesc(e.target.value)}
                    className="min-h-[60px]"
                  />
                </div>
              </div>
            </div>

            <Separator className="bg-border" />

            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground">Playlist Options</h4>
              <div className="space-y-3">
                <div>
                  <label htmlFor="sort-by" className="text-sm font-medium text-foreground block mb-1">
                    Sort By
                  </label>
                  <Select
                    value={customM3USortBy}
                    onValueChange={(value) => setCustomM3USortBy(value as 'title' | 'category' | 'url' | 'none')}
                  >
                    <SelectTrigger id="sort-by">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Sorting (Original Order)</SelectItem>
                      <SelectItem value="title">Sort by Title (A-Z)</SelectItem>
                      <SelectItem value="category">Sort by Category</SelectItem>
                      <SelectItem value="url">Sort by URL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="group-by-category"
                    checked={customM3UGroupByCategory}
                    onCheckedChange={(checked) => setCustomM3UGroupByCategory(checked as boolean)}
                  />
                  <label
                    htmlFor="group-by-category"
                    className="text-sm font-medium text-foreground cursor-pointer"
                  >
                    Group entries by category in playlists
                  </label>
                </div>
              </div>
            </div>

            <Alert className="border-accent/30 bg-accent/5">
              <AlertDescription className="text-foreground text-xs">
                <Sparkle size={14} className="inline mr-1" />
                Custom names and descriptions help you organize playlists by theme, quality, language, or source. They'll appear in the README file and can make your media library easier to navigate.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              onClick={() => setShowCustomM3UDialog(false)}
              variant="outline"
              className="border-border"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApplyCustomM3U}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <CheckCircle size={16} className="mr-2" weight="fill" />
              Generate Custom M3U Files
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="fixed bottom-6 right-6 z-50"
      >
        <Button
          onClick={() => setShowAIAssistant(!showAIAssistant)}
          className="h-14 w-14 rounded-full bg-linear-to-br from-accent to-accent/70 hover:from-accent/90 hover:to-accent/60 shadow-lg hover:shadow-xl transition-all duration-200 relative overflow-hidden"
          title="AI Assistant - Ask about media links and playlists"
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <AnimatedRabbit size={32} variant={showAIAssistant ? (isAiThinking ? "thinking" : "idle") : "sleeping"} />
          </div>
        </Button>
      </motion.div>

      <AnimatePresence>
        {showAIAssistant && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 right-6 w-[400px] max-w-[90vw] z-50"
          >
            <Card className="bg-card border-accent/30 shadow-2xl">
              <div className="p-4 border-b border-border flex items-center justify-between bg-accent/5">
                <div className="flex items-center gap-2">
                  <AnimatedRabbit size={24} variant="thinking" />
                  <h3 className="font-bold text-foreground">AI Media Assistant</h3>
                </div>
                <Button
                  onClick={() => setShowAIAssistant(false)}
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                >
                  <X size={16} />
                </Button>
              </div>

              <ScrollArea className="h-[400px] p-4">
                <div className="space-y-4">
                  {aiChatHistory.length === 0 && !aiResponse && (
                    <div className="text-center text-muted-foreground text-sm space-y-3">
                      <div className="flex justify-center">
                        <RabbitSleeping size={64} message="Waiting for your questions..." />
                      </div>
                      <p className="text-xs">Ask me about:</p>
                      <div className="grid grid-cols-1 gap-2 text-xs">
                        <Button
                          onClick={() => setAiQuestion('Where can I find IPTV playlists?')}
                          variant="outline"
                          size="sm"
                          className="justify-start text-left h-auto py-2 border-accent/30"
                        >
                          Where can I find IPTV playlists?
                        </Button>
                        <Button
                          onClick={() => setAiQuestion('What are Kodi addons and how do they work?')}
                          variant="outline"
                          size="sm"
                          className="justify-start text-left h-auto py-2 border-accent/30"
                        >
                          What are Kodi addons?
                        </Button>
                        <Button
                          onClick={() => setAiQuestion('How do I scan for media links in repositories?')}
                          variant="outline"
                          size="sm"
                          className="justify-start text-left h-auto py-2 border-accent/30"
                        >
                          How do I scan repositories?
                        </Button>
                      </div>
                    </div>
                  )}

                  {aiChatHistory.map((chat, index) => (
                    <div key={index} className="space-y-2">
                      <div className="bg-accent/10 rounded-lg p-3">
                        <div className="text-xs text-muted-foreground mb-1">You asked:</div>
                        <div className="text-sm text-foreground">{chat.question}</div>
                      </div>
                      <div className="bg-primary/30 rounded-lg p-3">
                        <div className="text-xs text-accent mb-1 flex items-center gap-1">
                          <AnimatedRabbit size={16} variant="idle" />
                          AI Assistant:
                        </div>
                        <div className="text-sm text-foreground whitespace-pre-wrap">{chat.answer}</div>
                      </div>
                    </div>
                  ))}

                  {isAiThinking && (
                    <div className="flex items-center justify-center gap-2 py-4">
                      <RabbitThinking size={24} />
                    </div>
                  )}

                  {aiResponse && !isAiThinking && (
                    <div className="space-y-2">
                      <div className="bg-primary/30 rounded-lg p-3">
                        <div className="text-xs text-accent mb-1 flex items-center gap-1">
                          <AnimatedRabbit size={16} variant="success" />
                          AI Assistant:
                        </div>
                        <div className="text-sm text-foreground whitespace-pre-wrap">{aiResponse.answer}</div>
                      </div>

                      {aiResponse.suggestions && aiResponse.suggestions.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Suggestions:</div>
                          {aiResponse.suggestions.map((suggestion, i) => (
                            <div key={i} className="text-xs bg-accent/5 rounded p-2 border border-accent/20">
                              • {suggestion}
                            </div>
                          ))}
                        </div>
                      )}

                      {aiResponse.relatedLinks && aiResponse.relatedLinks.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Related links:</div>
                          {aiResponse.relatedLinks.map((link, i) => (
                            <div key={i} className="text-xs font-mono bg-secondary/30 rounded p-2 break-all">
                              {link}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="p-4 border-t border-border">
                <div className="flex gap-2">
                  <Input
                    placeholder="Ask about media links, playlists, or scanning..."
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleAskAI()
                      }
                    }}
                    disabled={isAiThinking}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleAskAI}
                    disabled={isAiThinking || !aiQuestion.trim()}
                    className="bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    <PaperPlaneTilt size={18} weight="fill" />
                  </Button>
                </div>
                <div className="mt-2 text-xs text-muted-foreground text-center">
                  Powered by Gemini 2.5 Flash • Media & IPTV Expert
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
