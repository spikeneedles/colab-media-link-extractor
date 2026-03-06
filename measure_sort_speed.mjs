import { fileSorter } from './backend/src/services/FileSorterService.js'
import { archivist } from './backend/src/services/ArchivistService.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

async function run() {
  console.log('Starting file sort measurement...')
  const stats = await fileSorter.sortAll(8)
  console.log('Sort completed!')
  console.log('FileSorter Stats:', JSON.stringify(stats, null, 2))
  console.log('Archivist Stats:', JSON.stringify(archivist.getStats(), null, 2))
  console.log(`Sorting speed: ${(stats.scanned / (stats.durationMs / 1000)).toFixed(2)} files per second`)
}

run().catch(err => {
  console.error('Error running sort:', err)
  process.exit(1)
})
