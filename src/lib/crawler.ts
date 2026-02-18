import { extractLinks, parseM3UWithMetadata, scanAPK, extractConfigFilesFromPackage, parseKodiFile, scanZipFile, type ConfigFile } from './linkExtractor'
import { parseEPG, type EPGData } from './epgParser'

export type CrawlTarget = {
  url: string
  type: 'repository' | 'web' | 'file' | 'directory'
  depth?: number
}

export type CrawlResult = {
  id: string
  timestamp: Date
  target: CrawlTarget
  links: string[]
  linksWithMetadata: Array<{ url: string; title?: string; category?: string }>
  epgData?: EPGData
  configFiles: ConfigFile[]
  filesScanned: number
  errors: string[]
  status: 'completed' | 'failed' | 'partial'
}

export type CrawlerJob = {
  id: string
  target: CrawlTarget
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  result?: CrawlResult
  error?: string
  startedAt?: Date
  completedAt?: Date
}

export type StorageIndex = {
  jobs: CrawlerJob[]
  lastUpdated: Date
}

const SUPPORTED_EXTENSIONS = [
  '.m3u', '.m3u8', '.txt', '.json', '.pls', '.xspf', '.asx', '.xml',
  '.playlist', '.conf', '.list', '.urls', '.links', '.wpl', '.b4s',
  '.kpl', '.jspf', '.smil', '.smi', '.ram', '.qtl', '.wvx', '.m4u',
  '.vlc', '.zpl', '.mpcpl', '.mxu', '.cue', '.dpl', '.epg', '.aimppl',
  '.aimppl4', '.bio', '.fpl', '.mpls', '.pla', '.plc', '.plx', '.plist',
  '.sqf', '.wax', '.wmx', '.xpl', '.rmp', '.rpm', '.sml', '.ts', '.mpd',
  '.ism', '.isml', '.f4m', '.strm', '.xsp', '.nfo', '.py', '.apk', '.aab',
  '.xapk', '.apks', '.apkm', '.apex', '.apkx', '.zip'
]

const KODI_FILES = [
  'addon.xml', 'sources.xml', 'favourites.xml', 'advancedsettings.xml',
  'playercorefactory.xml'
]

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function crawlRepository(
  repoUrl: string,
  maxDepth: number = 3,
  onProgress?: (current: number, total: number, currentFile?: string) => void
): Promise<CrawlResult> {
  const id = `crawl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const timestamp = new Date()
  const allLinks: string[] = []
  const linksWithMetadata: Array<{ url: string; title?: string; category?: string }> = []
  const configFiles: ConfigFile[] = []
  const errors: string[] = []
  let filesScanned = 0
  let epgData: EPGData | undefined

  try {
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/)
    if (!match) {
      throw new Error('Invalid GitHub repository URL')
    }

    const [, owner, repo] = match
    const cleanRepo = repo.replace(/\.git$/, '')

    onProgress?.(0, 1, 'Fetching repository tree...')

    const treeResponse = await fetch(
      `https://api.github.com/repos/${owner}/${cleanRepo}/git/trees/main?recursive=1`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
        }
      }
    )

    if (!treeResponse.ok) {
      const masterResponse = await fetch(
        `https://api.github.com/repos/${owner}/${cleanRepo}/git/trees/master?recursive=1`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
          }
        }
      )

      if (!masterResponse.ok) {
        throw new Error(`Failed to fetch repository tree: ${treeResponse.status}`)
      }

      const masterData = await masterResponse.json()
      return await processTree(masterData, owner, cleanRepo, 'master')
    }

    const treeData = await treeResponse.json()
    return await processTree(treeData, owner, cleanRepo, 'main')

    async function processTree(
      data: any,
      owner: string,
      repo: string,
      branch: string
    ): Promise<CrawlResult> {
      const files = data.tree.filter((item: any) => {
        if (item.type !== 'blob') return false
        const path = item.path.toLowerCase()
        const depth = path.split('/').length
        if (depth > maxDepth) return false

        return (
          SUPPORTED_EXTENSIONS.some(ext => path.endsWith(ext)) ||
          KODI_FILES.some(name => path.includes(name.toLowerCase()))
        )
      })

      const totalFiles = files.length
      let processedFiles = 0

      for (const file of files) {
        try {
          onProgress?.(processedFiles, totalFiles, file.path)

          await delay(100)

          const fileUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file.path}`
          const response = await fetch(fileUrl)

          if (!response.ok) {
            errors.push(`Failed to fetch ${file.path}: ${response.status}`)
            processedFiles++
            continue
          }

          const fileName = file.path.toLowerCase()
          const isAndroidPackage = ['.apk', '.aab', '.xapk', '.apks', '.apkm', '.apex', '.apkx'].some(ext => fileName.endsWith(ext))
          const isZipFile = fileName.endsWith('.zip')

          if (isAndroidPackage) {
            const blob = await response.blob()
            const fileObj = new File([blob], file.path.split('/').pop() || 'package', { type: 'application/octet-stream' })
            
            const links = await scanAPK(fileObj)
            allLinks.push(...links)

            const configs = await extractConfigFilesFromPackage(fileObj)
            configFiles.push(...configs)
          } else if (isZipFile) {
            const blob = await response.blob()
            const fileObj = new File([blob], file.path.split('/').pop() || 'archive.zip', { type: 'application/zip' })
            
            const zipResult = await scanZipFile(fileObj)
            allLinks.push(...zipResult.links)
            linksWithMetadata.push(...zipResult.linksWithMetadata)
            configFiles.push(...zipResult.configFiles)
          } else {
            const content = await response.text()

            const isKodiFile = KODI_FILES.some(name => fileName.includes(name.toLowerCase())) ||
                               ['.xsp', '.nfo', '.strm', '.py'].some(ext => fileName.endsWith(ext))

            if (isKodiFile) {
              const kodiLinks = parseKodiFile(content, file.path)
              allLinks.push(...kodiLinks)
            }

            if (content.includes('<?xml') && (content.includes('<tv') || content.includes('<channel'))) {
              const parsedEPG = parseEPG(content)
              if (parsedEPG) {
                if (!epgData) {
                  epgData = parsedEPG
                } else {
                  parsedEPG.channels.forEach(channel => {
                    if (!epgData!.channels.some(ch => ch.id === channel.id)) {
                      epgData!.channels.push(channel)
                    }
                  })
                  epgData.programmes.push(...parsedEPG.programmes)
                  epgData.channelCount = epgData.channels.length
                  epgData.programmeCount = epgData.programmes.length

                  const allCategories = new Set<string>()
                  epgData.channels.forEach(ch => {
                    if (ch.category) allCategories.add(ch.category)
                    if (ch.group) allCategories.add(ch.group)
                  })
                  epgData.programmes.forEach(prog => {
                    if (prog.category) allCategories.add(prog.category)
                  })
                  epgData.categories = Array.from(allCategories).sort()
                }

                parsedEPG.channels.forEach(channel => {
                  if (channel.url) {
                    allLinks.push(channel.url)
                    linksWithMetadata.push({
                      url: channel.url,
                      title: channel.displayName,
                      category: channel.category || channel.group
                    })
                  }
                })
              }
            }

            if (content.includes('#EXTINF') || content.includes('#EXTM3U')) {
              const m3uEntries = parseM3UWithMetadata(content)
              m3uEntries.forEach(entry => {
                allLinks.push(entry.url)
                linksWithMetadata.push(entry)
              })
            }

            const links = extractLinks(content)
            allLinks.push(...links)
          }

          filesScanned++
          processedFiles++
        } catch (error) {
          errors.push(`Error processing ${file.path}: ${error instanceof Error ? error.message : 'Unknown error'}`)
          processedFiles++
        }
      }

      onProgress?.(totalFiles, totalFiles, 'Completed')

      return {
        id,
        timestamp,
        target: { url: repoUrl, type: 'repository', depth: maxDepth },
        links: Array.from(new Set(allLinks)),
        linksWithMetadata,
        epgData,
        configFiles,
        filesScanned,
        errors,
        status: errors.length > 0 ? 'partial' : 'completed'
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown error')
    return {
      id,
      timestamp,
      target: { url: repoUrl, type: 'repository', depth: maxDepth },
      links: Array.from(new Set(allLinks)),
      linksWithMetadata,
      epgData,
      configFiles,
      filesScanned,
      errors,
      status: 'failed'
    }
  }
}

export async function crawlWebsite(
  baseUrl: string,
  maxDepth: number = 2,
  maxPages: number = 50,
  onProgress?: (current: number, total: number, currentUrl?: string) => void
): Promise<CrawlResult> {
  const id = `crawl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const timestamp = new Date()
  const allLinks: string[] = []
  const linksWithMetadata: Array<{ url: string; title?: string; category?: string }> = []
  const errors: string[] = []
  const visited = new Set<string>()
  const toVisit: Array<{ url: string; depth: number }> = [{ url: baseUrl, depth: 0 }]
  let filesScanned = 0

  try {
    const baseUrlObj = new URL(baseUrl)

    while (toVisit.length > 0 && visited.size < maxPages) {
      const { url, depth } = toVisit.shift()!

      if (visited.has(url) || depth > maxDepth) {
        continue
      }

      visited.add(url)
      onProgress?.(visited.size, Math.min(toVisit.length + visited.size, maxPages), url)

      try {
        await delay(200)

        const response = await fetch(url, {
          headers: {
            'User-Agent': 'MediaLinkScanner/1.0',
          },
        })

        if (!response.ok) {
          errors.push(`Failed to fetch ${url}: ${response.status}`)
          continue
        }

        const contentType = response.headers.get('content-type') || ''
        const content = await response.text()

        if (contentType.includes('text/html')) {
          const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g
          const foundUrls = content.match(urlPattern) || []

          for (const foundUrl of foundUrls) {
            try {
              const urlObj = new URL(foundUrl)

              if (urlObj.hostname === baseUrlObj.hostname && depth < maxDepth) {
                const normalizedUrl = foundUrl.split('#')[0].split('?')[0]
                if (!visited.has(normalizedUrl) && toVisit.length + visited.size < maxPages) {
                  toVisit.push({ url: normalizedUrl, depth: depth + 1 })
                }
              }

              const ext = foundUrl.split('?')[0].split('#')[0].toLowerCase()
              if (SUPPORTED_EXTENSIONS.some(e => ext.endsWith(e)) ||
                  /\.(mp4|mkv|avi|mov|wmv|flv|webm|m3u8|ts|mpd)/.test(ext)) {
                allLinks.push(foundUrl)
              }
            } catch {
            }
          }

          if (content.includes('#EXTINF') || content.includes('#EXTM3U')) {
            const m3uEntries = parseM3UWithMetadata(content)
            m3uEntries.forEach(entry => {
              allLinks.push(entry.url)
              linksWithMetadata.push(entry)
            })
          }

          const links = extractLinks(content)
          allLinks.push(...links)
        } else {
          if (content.includes('#EXTINF') || content.includes('#EXTM3U')) {
            const m3uEntries = parseM3UWithMetadata(content)
            m3uEntries.forEach(entry => {
              allLinks.push(entry.url)
              linksWithMetadata.push(entry)
            })
          }

          const links = extractLinks(content)
          allLinks.push(...links)
        }

        filesScanned++
      } catch (error) {
        errors.push(`Error crawling ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    onProgress?.(visited.size, visited.size, 'Completed')

    return {
      id,
      timestamp,
      target: { url: baseUrl, type: 'web', depth: maxDepth },
      links: Array.from(new Set(allLinks)),
      linksWithMetadata,
      configFiles: [],
      filesScanned,
      errors,
      status: errors.length > 0 ? 'partial' : 'completed'
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown error')
    return {
      id,
      timestamp,
      target: { url: baseUrl, type: 'web', depth: maxDepth },
      links: Array.from(new Set(allLinks)),
      linksWithMetadata,
      configFiles: [],
      filesScanned,
      errors,
      status: 'failed'
    }
  }
}

export async function crawlDirectory(
  files: FileList | File[],
  onProgress?: (current: number, total: number, currentFile?: string) => void
): Promise<CrawlResult> {
  const id = `crawl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const timestamp = new Date()
  const allLinks: string[] = []
  const linksWithMetadata: Array<{ url: string; title?: string; category?: string }> = []
  const configFiles: ConfigFile[] = []
  const errors: string[] = []
  let epgData: EPGData | undefined

  const fileArray = Array.from(files)
  const totalFiles = fileArray.length
  let filesScanned = 0

  for (let i = 0; i < totalFiles; i++) {
    const file = fileArray[i]
    
    try {
      onProgress?.(i, totalFiles, file.name)

      const fileName = file.name.toLowerCase()
      const isAndroidPackage = ['.apk', '.aab', '.xapk', '.apks', '.apkm', '.apex', '.apkx'].some(ext => fileName.endsWith(ext))
      const isZipFile = fileName.endsWith('.zip')

      if (isAndroidPackage) {
        const links = await scanAPK(file)
        allLinks.push(...links)

        const configs = await extractConfigFilesFromPackage(file)
        configFiles.push(...configs)
      } else if (isZipFile) {
        const zipResult = await scanZipFile(file)
        allLinks.push(...zipResult.links)
        linksWithMetadata.push(...zipResult.linksWithMetadata)
        configFiles.push(...zipResult.configFiles)
      } else {
        const content = await file.text()

        const isKodiFile = KODI_FILES.some(name => fileName.includes(name.toLowerCase())) ||
                           ['.xsp', '.nfo', '.strm', '.py'].some(ext => fileName.endsWith(ext))

        if (isKodiFile) {
          const kodiLinks = parseKodiFile(content, file.name)
          allLinks.push(...kodiLinks)
        }

        const parsedEPG = parseEPG(content)
        if (parsedEPG) {
          if (!epgData) {
            epgData = parsedEPG
          } else {
            parsedEPG.channels.forEach(channel => {
              if (!epgData!.channels.some(ch => ch.id === channel.id)) {
                epgData!.channels.push(channel)
              }
            })
            epgData.programmes.push(...parsedEPG.programmes)
            epgData.channelCount = epgData.channels.length
            epgData.programmeCount = epgData.programmes.length

            const allCategories = new Set<string>()
            epgData.channels.forEach(ch => {
              if (ch.category) allCategories.add(ch.category)
              if (ch.group) allCategories.add(ch.group)
            })
            epgData.programmes.forEach(prog => {
              if (prog.category) allCategories.add(prog.category)
            })
            epgData.categories = Array.from(allCategories).sort()
          }

          parsedEPG.channels.forEach(channel => {
            if (channel.url) {
              allLinks.push(channel.url)
              linksWithMetadata.push({
                url: channel.url,
                title: channel.displayName,
                category: channel.category || channel.group
              })
            }
          })
        }

        if (content.includes('#EXTINF') || content.includes('#EXTM3U')) {
          const m3uEntries = parseM3UWithMetadata(content)
          m3uEntries.forEach(entry => {
            allLinks.push(entry.url)
            linksWithMetadata.push(entry)
          })
        }

        const links = extractLinks(content)
        allLinks.push(...links)
      }

      filesScanned++
    } catch (error) {
      errors.push(`Error processing ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  onProgress?.(totalFiles, totalFiles, 'Completed')

  return {
    id,
    timestamp,
    target: { url: 'local-files', type: 'directory' },
    links: Array.from(new Set(allLinks)),
    linksWithMetadata,
    epgData,
    configFiles,
    filesScanned,
    errors,
    status: errors.length > 0 ? 'partial' : 'completed'
  }
}

export function generateCrawlReport(result: CrawlResult): string {
  const lines: string[] = []

  lines.push('='.repeat(80))
  lines.push(`CRAWLER REPORT - ${result.id}`)
  lines.push('='.repeat(80))
  lines.push(`Timestamp: ${result.timestamp.toISOString()}`)
  lines.push(`Target: ${result.target.url} (${result.target.type})`)
  lines.push(`Status: ${result.status.toUpperCase()}`)
  lines.push(`Files Scanned: ${result.filesScanned}`)
  lines.push(`Links Found: ${result.links.length}`)
  if (result.epgData) {
    lines.push(`EPG Channels: ${result.epgData.channelCount}`)
    lines.push(`EPG Programmes: ${result.epgData.programmeCount}`)
  }
  if (result.configFiles.length > 0) {
    lines.push(`Config Files: ${result.configFiles.length}`)
  }
  if (result.errors.length > 0) {
    lines.push(`Errors: ${result.errors.length}`)
  }
  lines.push('='.repeat(80))
  lines.push('')

  if (result.links.length > 0) {
    lines.push('DISCOVERED LINKS:')
    lines.push('-'.repeat(80))
    result.links.forEach((link, index) => {
      lines.push(`${index + 1}. ${link}`)
    })
    lines.push('')
  }

  if (result.linksWithMetadata.length > 0) {
    lines.push('LINKS WITH METADATA:')
    lines.push('-'.repeat(80))
    result.linksWithMetadata.forEach((entry, index) => {
      lines.push(`${index + 1}. ${entry.url}`)
      if (entry.title) lines.push(`   Title: ${entry.title}`)
      if (entry.category) lines.push(`   Category: ${entry.category}`)
    })
    lines.push('')
  }

  if (result.epgData) {
    lines.push('EPG DATA:')
    lines.push('-'.repeat(80))
    lines.push(`Channels: ${result.epgData.channelCount}`)
    lines.push(`Programmes: ${result.epgData.programmeCount}`)
    if (result.epgData.categories.length > 0) {
      lines.push(`Categories: ${result.epgData.categories.join(', ')}`)
    }
    lines.push('')
  }

  if (result.configFiles.length > 0) {
    lines.push('CONFIG FILES:')
    lines.push('-'.repeat(80))
    result.configFiles.forEach((file, index) => {
      lines.push(`${index + 1}. ${file.path} (${file.type}, ${file.size} bytes)`)
    })
    lines.push('')
  }

  if (result.errors.length > 0) {
    lines.push('ERRORS:')
    lines.push('-'.repeat(80))
    result.errors.forEach((error, index) => {
      lines.push(`${index + 1}. ${error}`)
    })
    lines.push('')
  }

  return lines.join('\n')
}
