import JSZip from 'jszip'
import { extractLinks } from './linkExtractor'

export interface KodiAddon {
  id: string
  name: string
  version: string
  description?: string
  author?: string
  summary?: string
  platform?: string
  repositoryUrl?: string
  downloadUrl?: string
  icon?: string
  fanart?: string
}

export interface KodiRepository {
  url: string
  name: string
  addons: KodiAddon[]
  type: 'official' | 'third-party'
  platform: 'github' | 'gitlab' | 'direct' | 'unknown'
}

export interface KodiAddonScanResult {
  addon: KodiAddon
  files: {
    name: string
    path: string
    content: string
    size: number
  }[]
  links: string[]
  configFiles: {
    name: string
    content: string
    type: string
  }[]
  error?: string
}

const POPULAR_KODI_REPOS = [
  {
    name: 'Official Kodi Repository',
    url: 'https://mirrors.kodi.tv/addons/',
    type: 'official' as const,
    platform: 'direct' as const
  },
  {
    name: 'SuperRepo',
    url: 'https://github.com/superrepo',
    type: 'third-party' as const,
    platform: 'github' as const
  },
  {
    name: 'Ares Project',
    url: 'https://github.com/Ares-Project',
    type: 'third-party' as const,
    platform: 'github' as const
  }
]

export function getPopularKodiRepositories(): KodiRepository[] {
  return POPULAR_KODI_REPOS.map(repo => ({
    ...repo,
    addons: []
  }))
}

function parseAddonXml(xmlContent: string): Partial<KodiAddon> {
  const addon: Partial<KodiAddon> = {}
  
  const idMatch = xmlContent.match(/addon\s+id=["']([^"']+)["']/)
  if (idMatch) addon.id = idMatch[1]
  
  const versionMatch = xmlContent.match(/version=["']([^"']+)["']/)
  if (versionMatch) addon.version = versionMatch[1]
  
  const nameMatch = xmlContent.match(/name=["']([^"']+)["']/)
  if (nameMatch) addon.name = nameMatch[1]
  
  const descMatch = xmlContent.match(/<description[^>]*>([^<]+)<\/description>/)
  if (descMatch) addon.description = descMatch[1].trim()
  
  const summaryMatch = xmlContent.match(/<summary[^>]*>([^<]+)<\/summary>/)
  if (summaryMatch) addon.summary = summaryMatch[1].trim()
  
  const authorMatch = xmlContent.match(/<author>([^<]+)<\/author>/)
  if (authorMatch) addon.author = authorMatch[1].trim()
  
  return addon
}

export async function downloadKodiAddonFromGitHub(
  owner: string,
  repo: string,
  branch: string = 'master'
): Promise<KodiAddonScanResult> {
  const result: KodiAddonScanResult = {
    addon: {
      id: `${owner}/${repo}`,
      name: repo,
      version: 'unknown',
      repositoryUrl: `https://github.com/${owner}/${repo}`
    },
    files: [],
    links: [],
    configFiles: []
  }
  
  try {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/zipball/${branch}`
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3+json'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Failed to download addon: ${response.statusText}`)
    }
    
    const blob = await response.blob()
    const arrayBuffer = await blob.arrayBuffer()
    const zip = await JSZip.loadAsync(arrayBuffer)
    
    const fileNames = Object.keys(zip.files)
    
    for (const fileName of fileNames) {
      const zipEntry = zip.files[fileName]
      
      if (!zipEntry.dir && !fileName.includes('__MACOSX')) {
        const isTextFile = fileName.match(/\.(xml|py|txt|json|conf|cfg|ini|properties|m3u|m3u8|pls|xspf)$/i)
        
        if (isTextFile) {
          const content = await zipEntry.async('text')
          const size = content.length
          
          result.files.push({
            name: fileName.split('/').pop() || fileName,
            path: fileName,
            content,
            size
          })
          
          if (fileName.endsWith('addon.xml')) {
            const addonInfo = parseAddonXml(content)
            result.addon = {
              ...result.addon,
              ...addonInfo,
              downloadUrl: apiUrl
            }
          }
          
          if (fileName.match(/\.(xml|json|conf|cfg|ini|properties)$/i)) {
            result.configFiles.push({
              name: fileName.split('/').pop() || fileName,
              content,
              type: fileName.split('.').pop() || 'unknown'
            })
          }
          
          const urls = extractLinks(content)
          result.links.push(...urls)
        }
      }
    }
    
    result.links = Array.from(new Set(result.links))
    
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Failed to download addon'
  }
  
  return result
}

export async function downloadKodiAddonFromGitLab(
  namespace: string,
  project: string,
  branch: string = 'master'
): Promise<KodiAddonScanResult> {
  const result: KodiAddonScanResult = {
    addon: {
      id: `${namespace}/${project}`,
      name: project,
      version: 'unknown',
      repositoryUrl: `https://gitlab.com/${namespace}/${project}`
    },
    files: [],
    links: [],
    configFiles: []
  }
  
  try {
    const encodedPath = encodeURIComponent(`${namespace}/${project}`)
    const apiUrl = `https://gitlab.com/api/v4/projects/${encodedPath}/repository/archive.zip?sha=${branch}`
    
    const response = await fetch(apiUrl)
    
    if (!response.ok) {
      throw new Error(`Failed to download addon: ${response.statusText}`)
    }
    
    const blob = await response.blob()
    const arrayBuffer = await blob.arrayBuffer()
    const zip = await JSZip.loadAsync(arrayBuffer)
    
    const fileNames = Object.keys(zip.files)
    
    for (const fileName of fileNames) {
      const zipEntry = zip.files[fileName]
      
      if (!zipEntry.dir) {
        const isTextFile = fileName.match(/\.(xml|py|txt|json|conf|cfg|ini|properties|m3u|m3u8|pls|xspf)$/i)
        
        if (isTextFile) {
          const content = await zipEntry.async('text')
          const size = content.length
          
          result.files.push({
            name: fileName.split('/').pop() || fileName,
            path: fileName,
            content,
            size
          })
          
          if (fileName.endsWith('addon.xml')) {
            const addonInfo = parseAddonXml(content)
            result.addon = {
              ...result.addon,
              ...addonInfo,
              downloadUrl: apiUrl
            }
          }
          
          if (fileName.match(/\.(xml|json|conf|cfg|ini|properties)$/i)) {
            result.configFiles.push({
              name: fileName.split('/').pop() || fileName,
              content,
              type: fileName.split('.').pop() || 'unknown'
            })
          }
          
          const urls = extractLinks(content)
          result.links.push(...urls)
        }
      }
    }
    
    result.links = Array.from(new Set(result.links))
    
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Failed to download addon'
  }
  
  return result
}

export async function downloadKodiAddonFromUrl(url: string): Promise<KodiAddonScanResult> {
  const result: KodiAddonScanResult = {
    addon: {
      id: url,
      name: url.split('/').pop() || 'Unknown',
      version: 'unknown',
      downloadUrl: url
    },
    files: [],
    links: [],
    configFiles: []
  }
  
  try {
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`Failed to download addon: ${response.statusText}`)
    }
    
    const contentType = response.headers.get('content-type') || ''
    
    if (contentType.includes('application/zip') || url.endsWith('.zip')) {
      const blob = await response.blob()
      const arrayBuffer = await blob.arrayBuffer()
      const zip = await JSZip.loadAsync(arrayBuffer)
      
      const fileNames = Object.keys(zip.files)
      
      for (const fileName of fileNames) {
        const zipEntry = zip.files[fileName]
        
        if (!zipEntry.dir) {
          const isTextFile = fileName.match(/\.(xml|py|txt|json|conf|cfg|ini|properties|m3u|m3u8|pls|xspf)$/i)
          
          if (isTextFile) {
            const content = await zipEntry.async('text')
            const size = content.length
            
            result.files.push({
              name: fileName.split('/').pop() || fileName,
              path: fileName,
              content,
              size
            })
            
            if (fileName.endsWith('addon.xml')) {
              const addonInfo = parseAddonXml(content)
              result.addon = {
                ...result.addon,
                ...addonInfo
              }
            }
            
            if (fileName.match(/\.(xml|json|conf|cfg|ini|properties)$/i)) {
              result.configFiles.push({
                name: fileName.split('/').pop() || fileName,
                content,
                type: fileName.split('.').pop() || 'unknown'
              })
            }
            
            const urls = extractLinks(content)
            result.links.push(...urls)
          }
        }
      }
    } else {
      const text = await response.text()
      result.files.push({
        name: url.split('/').pop() || 'content.txt',
        path: url,
        content: text,
        size: text.length
      })
      
      const urls = extractLinks(text)
      result.links.push(...urls)
    }
    
    result.links = Array.from(new Set(result.links))
    
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Failed to download addon'
  }
  
  return result
}

export function parseKodiAddonUrl(url: string): {
  platform: 'github' | 'gitlab' | 'direct'
  owner?: string
  repo?: string
  namespace?: string
  project?: string
  branch?: string
} | null {
  const githubMatch = url.match(/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+))?/)
  if (githubMatch) {
    return {
      platform: 'github',
      owner: githubMatch[1],
      repo: githubMatch[2].replace('.git', ''),
      branch: githubMatch[3] || 'master'
    }
  }
  
  const gitlabMatch = url.match(/gitlab\.com\/([^/]+)\/([^/]+)(?:\/-\/tree\/([^/]+))?/)
  if (gitlabMatch) {
    return {
      platform: 'gitlab',
      namespace: gitlabMatch[1],
      project: gitlabMatch[2].replace('.git', ''),
      branch: gitlabMatch[3] || 'master'
    }
  }
  
  if (url.startsWith('http')) {
    return {
      platform: 'direct'
    }
  }
  
  return null
}

export async function downloadKodiAddon(url: string): Promise<KodiAddonScanResult> {
  const parsed = parseKodiAddonUrl(url)
  
  if (!parsed) {
    return {
      addon: {
        id: url,
        name: 'Unknown',
        version: 'unknown'
      },
      files: [],
      links: [],
      configFiles: [],
      error: 'Invalid URL format'
    }
  }
  
  if (parsed.platform === 'github' && parsed.owner && parsed.repo) {
    return downloadKodiAddonFromGitHub(parsed.owner, parsed.repo, parsed.branch)
  }
  
  if (parsed.platform === 'gitlab' && parsed.namespace && parsed.project) {
    return downloadKodiAddonFromGitLab(parsed.namespace, parsed.project, parsed.branch)
  }
  
  return downloadKodiAddonFromUrl(url)
}

export async function generateKodiAddonReport(scanResult: KodiAddonScanResult): Promise<string> {
  let report = 'Kodi Addon Scan Report\n'
  report += '='.repeat(80) + '\n\n'
  
  report += `Addon ID: ${scanResult.addon.id}\n`
  report += `Name: ${scanResult.addon.name}\n`
  report += `Version: ${scanResult.addon.version}\n`
  
  if (scanResult.addon.author) {
    report += `Author: ${scanResult.addon.author}\n`
  }
  
  if (scanResult.addon.description) {
    report += `Description: ${scanResult.addon.description}\n`
  }
  
  if (scanResult.addon.repositoryUrl) {
    report += `Repository: ${scanResult.addon.repositoryUrl}\n`
  }
  
  if (scanResult.error) {
    report += `\nError: ${scanResult.error}\n`
  }
  
  report += `\nFiles Found: ${scanResult.files.length}\n`
  report += `Config Files: ${scanResult.configFiles.length}\n`
  report += `Links Found: ${scanResult.links.length}\n`
  
  if (scanResult.links.length > 0) {
    report += '\n' + '-'.repeat(80) + '\n'
    report += 'Media Links:\n'
    report += '-'.repeat(80) + '\n'
    scanResult.links.forEach(link => {
      report += `${link}\n`
    })
  }
  
  if (scanResult.configFiles.length > 0) {
    report += '\n' + '-'.repeat(80) + '\n'
    report += 'Configuration Files:\n'
    report += '-'.repeat(80) + '\n'
    scanResult.configFiles.forEach(file => {
      report += `${file.name} (${file.type})\n`
    })
  }
  
  return report
}

export async function exportKodiAddonAsZip(scanResult: KodiAddonScanResult): Promise<Blob> {
  const zip = new JSZip()
  
  const addonName = scanResult.addon.name.replace(/[^a-z0-9]/gi, '_')
  const folder = zip.folder(addonName)
  
  if (folder) {
    for (const file of scanResult.files) {
      folder.file(file.path, file.content)
    }
    
    const report = await generateKodiAddonReport(scanResult)
    folder.file('SCAN_REPORT.txt', report)
    
    if (scanResult.links.length > 0) {
      const linksContent = scanResult.links.join('\n')
      folder.file('extracted_links.txt', linksContent)
    }
  }
  
  return await zip.generateAsync({ type: 'blob' })
}
