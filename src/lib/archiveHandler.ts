import JSZip from 'jszip'
import { extractLinks } from './linkExtractor'

export interface ArchiveFile {
  name: string
  path: string
  size: number
  content: string | ArrayBuffer
  type: 'text' | 'binary'
}

export interface ArchiveScanResult {
  archiveName: string
  files: ArchiveFile[]
  links: string[]
  error?: string
  totalFiles: number
  totalSize: number
  format: '7z' | 'bz2' | 'zip' | 'rar' | 'tar' | 'gz' | 'unknown'
}

export interface BatchArchiveResult {
  archives: ArchiveScanResult[]
  totalLinks: string[]
  totalFiles: number
  successCount: number
  errorCount: number
}

const TEXT_EXTENSIONS = [
  'txt', 'json', 'xml', 'html', 'htm', 'css', 'js', 'ts', 'jsx', 'tsx',
  'md', 'markdown', 'yml', 'yaml', 'ini', 'conf', 'cfg', 'properties',
  'm3u', 'm3u8', 'pls', 'xspf', 'asx', 'wpl', 'smil', 'smi', 'strm',
  'nfo', 'xsp', 'py', 'log', 'csv', 'tsv', 'sql', 'sh', 'bat', 'cmd'
]

function isTextFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase()
  return ext ? TEXT_EXTENSIONS.includes(ext) : false
}

function detectArchiveFormat(filename: string): ArchiveScanResult['format'] {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.7z')) return '7z'
  if (lower.endsWith('.bz2') || lower.endsWith('.bzip2')) return 'bz2'
  if (lower.endsWith('.zip')) return 'zip'
  if (lower.endsWith('.rar')) return 'rar'
  if (lower.endsWith('.tar') || lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) return 'tar'
  if (lower.endsWith('.gz') && !lower.endsWith('.tar.gz')) return 'gz'
  return 'unknown'
}

async function decompressBz2(data: ArrayBuffer): Promise<ArrayBuffer> {
  const uint8Array = new Uint8Array(data)
  
  if (uint8Array[0] !== 0x42 || uint8Array[1] !== 0x5A || uint8Array[2] !== 0x68) {
    throw new Error('Not a valid BZ2 file')
  }
  
  try {
    const pako = await import('pako')
    const decompressed = pako.inflate(uint8Array)
    return decompressed.buffer
  } catch (error) {
    console.error('BZ2 decompression failed, trying alternative method:', error)
    return data
  }
}

async function extractTarArchive(data: ArrayBuffer): Promise<ArchiveFile[]> {
  const files: ArchiveFile[] = []
  const view = new DataView(data)
  let offset = 0
  
  while (offset < data.byteLength - 512) {
    const header = new Uint8Array(data, offset, 512)
    
    if (header.every(b => b === 0)) {
      break
    }
    
    const nameBytes = header.slice(0, 100)
    const name = new TextDecoder().decode(nameBytes).replace(/\0.*$/g, '')
    
    if (!name) {
      offset += 512
      continue
    }
    
    const sizeBytes = header.slice(124, 136)
    const sizeStr = new TextDecoder().decode(sizeBytes).replace(/\0.*$/g, '').trim()
    const size = parseInt(sizeStr, 8) || 0
    
    const typeFlag = String.fromCharCode(header[156])
    
    offset += 512
    
    if (typeFlag === '0' || typeFlag === '\0') {
      if (size > 0 && offset + size <= data.byteLength) {
        const fileData = data.slice(offset, offset + size)
        const isText = isTextFile(name)
        
        files.push({
          name: name.split('/').pop() || name,
          path: name,
          size,
          content: isText ? new TextDecoder().decode(fileData) : fileData,
          type: isText ? 'text' : 'binary'
        })
      }
      
      const paddedSize = Math.ceil(size / 512) * 512
      offset += paddedSize
    }
  }
  
  return files
}

export async function scanArchive(file: File): Promise<ArchiveScanResult> {
  const format = detectArchiveFormat(file.name)
  const result: ArchiveScanResult = {
    archiveName: file.name,
    files: [],
    links: [],
    totalFiles: 0,
    totalSize: 0,
    format
  }
  
  try {
    const arrayBuffer = await file.arrayBuffer()
    
    if (format === 'zip') {
      const zip = await JSZip.loadAsync(arrayBuffer)
      const fileNames = Object.keys(zip.files)
      
      for (const fileName of fileNames) {
        const zipEntry = zip.files[fileName]
        
        if (!zipEntry.dir) {
          const isText = isTextFile(fileName)
          let content: string | ArrayBuffer
          
          if (isText) {
            content = await zipEntry.async('text')
          } else {
            content = await zipEntry.async('arraybuffer')
          }
          
          result.files.push({
            name: fileName.split('/').pop() || fileName,
            path: fileName,
            size: content instanceof ArrayBuffer ? content.byteLength : content.length,
            content,
            type: isText ? 'text' : 'binary'
          })
        }
      }
    } else if (format === 'bz2') {
      const decompressed = await decompressBz2(arrayBuffer)
      const content = new TextDecoder().decode(decompressed)
      
      result.files.push({
        name: file.name.replace(/\.bz2$/i, ''),
        path: file.name,
        size: decompressed.byteLength,
        content,
        type: 'text'
      })
    } else if (format === 'tar' || format === 'gz') {
      let tarData = arrayBuffer
      
      if (format === 'gz' || file.name.toLowerCase().endsWith('.tar.gz') || file.name.toLowerCase().endsWith('.tgz')) {
        try {
          const pako = await import('pako')
          const uint8Array = new Uint8Array(arrayBuffer)
          const decompressed = pako.inflate(uint8Array)
          tarData = decompressed.buffer
        } catch (error) {
          console.error('GZ decompression failed:', error)
        }
      }
      
      const extractedFiles = await extractTarArchive(tarData)
      result.files.push(...extractedFiles)
    } else if (format === '7z') {
      result.error = '7z format requires external library. Please convert to ZIP for full support.'
      
      const text = new TextDecoder().decode(arrayBuffer)
      const urls = extractLinks(text)
      result.links.push(...urls)
      
      return result
    } else if (format === 'rar') {
      result.error = 'RAR format requires external library. Please convert to ZIP for full support.'
      
      const text = new TextDecoder().decode(arrayBuffer)
      const urls = extractLinks(text)
      result.links.push(...urls)
      
      return result
    } else {
      result.error = 'Unsupported archive format'
      return result
    }
    
    for (const archiveFile of result.files) {
      if (archiveFile.type === 'text' && typeof archiveFile.content === 'string') {
        const urls = extractLinks(archiveFile.content)
        result.links.push(...urls)
      }
    }
    
    result.totalFiles = result.files.length
    result.totalSize = result.files.reduce((sum, f) => sum + f.size, 0)
    
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Failed to scan archive'
  }
  
  return result
}

export async function scanBatchArchives(
  files: File[],
  onProgress?: (current: number, total: number) => void
): Promise<BatchArchiveResult> {
  const result: BatchArchiveResult = {
    archives: [],
    totalLinks: [],
    totalFiles: 0,
    successCount: 0,
    errorCount: 0
  }
  
  for (let i = 0; i < files.length; i++) {
    if (onProgress) {
      onProgress(i, files.length)
    }
    
    const archiveResult = await scanArchive(files[i])
    result.archives.push(archiveResult)
    
    if (archiveResult.error) {
      result.errorCount++
    } else {
      result.successCount++
    }
    
    result.totalLinks.push(...archiveResult.links)
    result.totalFiles += archiveResult.totalFiles
  }
  
  if (onProgress) {
    onProgress(files.length, files.length)
  }
  
  const uniqueLinks = Array.from(new Set(result.totalLinks))
  result.totalLinks = uniqueLinks
  
  return result
}

export async function extractArchiveToZip(file: File): Promise<Blob> {
  const scanResult = await scanArchive(file)
  const zip = new JSZip()
  
  const folder = zip.folder(file.name.replace(/\.(zip|7z|bz2|rar|tar|gz|tgz)$/i, ''))
  
  if (folder) {
    for (const archiveFile of scanResult.files) {
      if (typeof archiveFile.content === 'string') {
        folder.file(archiveFile.path, archiveFile.content)
      } else {
        folder.file(archiveFile.path, archiveFile.content)
      }
    }
  }
  
  return await zip.generateAsync({ type: 'blob' })
}

export async function generateArchiveReport(archives: ArchiveScanResult[]): Promise<string> {
  let report = 'Archive Scan Report\n'
  report += '='.repeat(80) + '\n\n'
  report += `Generated: ${new Date().toLocaleString()}\n`
  report += `Total Archives: ${archives.length}\n\n`
  
  for (const archive of archives) {
    report += '-'.repeat(80) + '\n'
    report += `Archive: ${archive.archiveName}\n`
    report += `Format: ${archive.format.toUpperCase()}\n`
    report += `Files: ${archive.totalFiles}\n`
    report += `Size: ${(archive.totalSize / 1024).toFixed(2)} KB\n`
    report += `Links Found: ${archive.links.length}\n`
    
    if (archive.error) {
      report += `Error: ${archive.error}\n`
    }
    
    if (archive.links.length > 0) {
      report += '\nLinks:\n'
      archive.links.forEach(link => {
        report += `  ${link}\n`
      })
    }
    
    if (archive.files.length > 0) {
      report += '\nFiles:\n'
      archive.files.slice(0, 20).forEach(file => {
        report += `  ${file.path} (${(file.size / 1024).toFixed(2)} KB)\n`
      })
      
      if (archive.files.length > 20) {
        report += `  ... and ${archive.files.length - 20} more files\n`
      }
    }
    
    report += '\n'
  }
  
  return report
}
