import { useKV } from '@github/spark/hooks'
import type { CrawlResult, CrawlerJob, StorageIndex } from './crawler'
import { generateCrawlReport } from './crawler'

export function useCrawlerStorage() {
  const [storageIndex, setStorageIndex] = useKV<StorageIndex>('crawler-storage-index', {
    jobs: [],
    lastUpdated: new Date()
  })

  const saveCrawlResult = async (result: CrawlResult): Promise<void> => {
    const resultKey = `crawler-result-${result.id}`
    await window.spark.kv.set(resultKey, result)

    setStorageIndex((current) => {
      const currentIndex = current || { jobs: [], lastUpdated: new Date() }
      const existingJobIndex = currentIndex.jobs.findIndex(job => job.id === result.id)
      
      if (existingJobIndex !== -1) {
        const updatedJobs = [...currentIndex.jobs]
        updatedJobs[existingJobIndex] = {
          ...updatedJobs[existingJobIndex],
          status: 'completed',
          progress: 100,
          result,
          completedAt: new Date()
        }
        return {
          jobs: updatedJobs,
          lastUpdated: new Date()
        }
      } else {
        return {
          jobs: [
            ...currentIndex.jobs,
            {
              id: result.id,
              target: result.target,
              status: 'completed',
              progress: 100,
              result,
              startedAt: result.timestamp,
              completedAt: new Date()
            }
          ],
          lastUpdated: new Date()
        }
      }
    })
  }

  const getCrawlResult = async (id: string): Promise<CrawlResult | undefined> => {
    const resultKey = `crawler-result-${id}`
    return await window.spark.kv.get<CrawlResult>(resultKey)
  }

  const getAllCrawlResults = async (): Promise<CrawlResult[]> => {
    const currentIndex = await window.spark.kv.get<StorageIndex>('crawler-storage-index')
    if (!currentIndex) return []

    const results: CrawlResult[] = []
    for (const job of currentIndex.jobs) {
      if (job.result) {
        results.push(job.result)
      } else {
        const result = await getCrawlResult(job.id)
        if (result) results.push(result)
      }
    }

    return results
  }

  const deleteCrawlResult = async (id: string): Promise<void> => {
    const resultKey = `crawler-result-${id}`
    await window.spark.kv.delete(resultKey)

    setStorageIndex((current) => {
      const currentIndex = current || { jobs: [], lastUpdated: new Date() }
      return {
        jobs: currentIndex.jobs.filter(job => job.id !== id),
        lastUpdated: new Date()
      }
    })
  }

  const clearAllResults = async (): Promise<void> => {
    const currentIndex = await window.spark.kv.get<StorageIndex>('crawler-storage-index')
    if (!currentIndex) return

    for (const job of currentIndex.jobs) {
      const resultKey = `crawler-result-${job.id}`
      await window.spark.kv.delete(resultKey)
    }

    setStorageIndex({
      jobs: [],
      lastUpdated: new Date()
    })
  }

  const updateJobProgress = (id: string, progress: number): void => {
    setStorageIndex((current) => {
      const currentIndex = current || { jobs: [], lastUpdated: new Date() }
      const existingJobIndex = currentIndex.jobs.findIndex(job => job.id === id)
      
      if (existingJobIndex !== -1) {
        const updatedJobs = [...currentIndex.jobs]
        updatedJobs[existingJobIndex] = {
          ...updatedJobs[existingJobIndex],
          progress,
          status: 'running'
        }
        return {
          jobs: updatedJobs,
          lastUpdated: new Date()
        }
      }
      
      return currentIndex
    })
  }

  const addJob = (job: CrawlerJob): void => {
    setStorageIndex((current) => {
      const currentIndex = current || { jobs: [], lastUpdated: new Date() }
      return {
        jobs: [...currentIndex.jobs, job],
        lastUpdated: new Date()
      }
    })
  }

  const updateJobStatus = (id: string, status: CrawlerJob['status'], error?: string): void => {
    setStorageIndex((current) => {
      const currentIndex = current || { jobs: [], lastUpdated: new Date() }
      const existingJobIndex = currentIndex.jobs.findIndex(job => job.id === id)
      
      if (existingJobIndex !== -1) {
        const updatedJobs = [...currentIndex.jobs]
        updatedJobs[existingJobIndex] = {
          ...updatedJobs[existingJobIndex],
          status,
          error,
          completedAt: status === 'completed' || status === 'failed' ? new Date() : updatedJobs[existingJobIndex].completedAt
        }
        return {
          jobs: updatedJobs,
          lastUpdated: new Date()
        }
      }
      
      return currentIndex
    })
  }

  const exportCrawlHistory = async (): Promise<Blob> => {
    const results = await getAllCrawlResults()
    const historyData = {
      exportedAt: new Date().toISOString(),
      totalJobs: results.length,
      results: results
    }

    return new Blob([JSON.stringify(historyData, null, 2)], { type: 'application/json' })
  }

  const exportCrawlReport = async (id: string): Promise<Blob> => {
    const result = await getCrawlResult(id)
    if (!result) {
      throw new Error('Crawl result not found')
    }

    const report = generateCrawlReport(result)
    return new Blob([report], { type: 'text/plain' })
  }

  const getStorageStats = async (): Promise<{
    totalJobs: number
    completedJobs: number
    failedJobs: number
    totalLinks: number
    totalFiles: number
  }> => {
    const results = await getAllCrawlResults()
    
    return {
      totalJobs: results.length,
      completedJobs: results.filter(r => r.status === 'completed').length,
      failedJobs: results.filter(r => r.status === 'failed').length,
      totalLinks: results.reduce((sum, r) => sum + r.links.length, 0),
      totalFiles: results.reduce((sum, r) => sum + r.filesScanned, 0)
    }
  }

  return {
    storageIndex,
    saveCrawlResult,
    getCrawlResult,
    getAllCrawlResults,
    deleteCrawlResult,
    clearAllResults,
    updateJobProgress,
    addJob,
    updateJobStatus,
    exportCrawlHistory,
    exportCrawlReport,
    getStorageStats
  }
}

export async function downloadCrawlResultAsZip(result: CrawlResult): Promise<Blob> {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()

  const folder = zip.folder(`crawl-${result.id}`)!

  if (result.links.length > 0) {
    folder.file('all-links.txt', result.links.join('\n'))
  }

  if (result.linksWithMetadata.length > 0) {
    const metadataLines: string[] = []
    result.linksWithMetadata.forEach(entry => {
      metadataLines.push(entry.url)
      if (entry.title) metadataLines.push(`  Title: ${entry.title}`)
      if (entry.category) metadataLines.push(`  Category: ${entry.category}`)
      metadataLines.push('')
    })
    folder.file('links-with-metadata.txt', metadataLines.join('\n'))
  }

  if (result.epgData) {
    const epgJson = JSON.stringify(result.epgData, null, 2)
    folder.file('epg-data.json', epgJson)

    if (result.epgData.channels.length > 0) {
      const channelLines = result.epgData.channels.map(ch => 
        `${ch.displayName} (${ch.id})${ch.url ? ` - ${ch.url}` : ''}`
      )
      folder.file('epg-channels.txt', channelLines.join('\n'))
    }
  }

  if (result.configFiles.length > 0) {
    const configFolder = folder.folder('config-files')!
    result.configFiles.forEach(file => {
      configFolder.file(file.path, file.content)
    })
  }

  const report = generateCrawlReport(result)
  folder.file('crawl-report.txt', report)

  const metadata = {
    id: result.id,
    timestamp: result.timestamp,
    target: result.target,
    status: result.status,
    filesScanned: result.filesScanned,
    linksFound: result.links.length,
    errors: result.errors
  }
  folder.file('metadata.json', JSON.stringify(metadata, null, 2))

  return await zip.generateAsync({ type: 'blob' })
}
