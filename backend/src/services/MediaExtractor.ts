/**
 * Media Extractor Service
 * 
 * Extracts media metadata including:
 * - Thumbnails/Posters from video files
 * - Episode metadata from file structure
 * - Descriptions from file metadata
 * - Integration with metadata databases
 */

import { spawn } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'

export interface ExtractedMediaInfo {
  filename: string
  title: string
  season?: number
  episode?: number
  episodeTitle?: string
  description?: string
  duration?: number
  resolution?: string
  codec?: string
  bitrate?: string
}

export interface MetadataMatch {
  title: string
  type: 'movie' | 'series' | 'live-tv'
  year?: number
  season?: number
  episode?: number
  description?: string
  imdbId?: string
  tmdbId?: string
  tvdbId?: string
  rating?: number
  genres?: string[]
  poster?: string
  backdrop?: string
}

export class MediaExtractor {
  private ffmpegPath: string = 'ffmpeg'
  private ffprobePath: string = 'ffprobe'

  constructor(ffmpegPath?: string, ffprobePath?: string) {
    if (ffmpegPath) this.ffmpegPath = ffmpegPath
    if (ffprobePath) this.ffprobePath = ffprobePath
  }

  /**
   * Extract metadata from video file using ffprobe
   */
  async extractVideoMetadata(filepath: string): Promise<ExtractedMediaInfo> {
    return new Promise((resolve, reject) => {
      const probe = spawn(this.ffprobePath, [
        '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'format=duration:stream=width,height,codec_name,bit_rate',
        '-of', 'json',
        filepath
      ])

      let output = ''
      let error = ''

      probe.stdout.on('data', (data) => {
        output += data.toString()
      })

      probe.stderr.on('data', (data) => {
        error += data.toString()
      })

      probe.on('close', (code) => {
        if (code !== 0) {
          console.warn(`⚠️  ffprobe warning for ${filepath}:`, error)
          // Return basic info even if ffprobe fails
          resolve({
            filename: path.basename(filepath),
            title: this.extractTitleFromPath(filepath)
          })
          return
        }

        try {
          const data = JSON.parse(output)
          const stream = data.streams?.[0] || {}
          const format = data.format || {}

          const info: ExtractedMediaInfo = {
            filename: path.basename(filepath),
            title: this.extractTitleFromPath(filepath),
            duration: format.duration ? Math.round(parseFloat(format.duration)) : undefined,
            resolution: stream.width && stream.height ? `${stream.width}x${stream.height}` : undefined,
            codec: stream.codec_name,
            bitrate: stream.bit_rate ? `${Math.round(parseInt(stream.bit_rate) / 1000)} kbps` : undefined
          }

          // Extract season/episode
          const seasonEpisode = this.extractSeasonEpisode(filepath)
          if (seasonEpisode) {
            info.season = seasonEpisode.season
            info.episode = seasonEpisode.episode
          }

          resolve(info)
        } catch (err) {
          reject(err)
        }
      })
    })
  }

  /**
   * Extract thumbnail from video at specified time
   */
  async extractThumbnail(
    filepath: string,
    outputPath: string,
    timeSeconds: number = 5
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn(this.ffmpegPath, [
        '-i', filepath,
        '-ss', timeSeconds.toString(),
        '-vframes', '1',
        '-q:v', '2',
        '-y', // Overwrite output
        outputPath
      ])

      let error = ''

      ffmpeg.stderr.on('data', (data) => {
        error += data.toString()
      })

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log(`✓ Thumbnail extracted: ${outputPath}`)
          resolve(outputPath)
        } else {
          const err = new Error(`Failed to extract thumbnail: ${error}`)
          console.error(err)
          reject(err)
        }
      })
    })
  }

  /**
   * Extract multiple screenshots from video
   */
  async extractScreenshots(
    filepath: string,
    outputDir: string,
    count: number = 3
  ): Promise<string[]> {
    try {
      // Get video duration first
      const metadata = await this.extractVideoMetadata(filepath)
      if (!metadata.duration) {
        console.warn('Could not determine video duration')
        return []
      }

      // Create output directory if it doesn't exist
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
      }

      const duration = metadata.duration
      const interval = Math.floor(duration / (count + 1))
      const screenshots: string[] = []

      for (let i = 1; i <= count; i++) {
        const timeSeconds = interval * i
        const outputFile = path.join(outputDir, `screenshot_${i}.jpg`)
        
        try {
          await this.extractThumbnail(filepath, outputFile, timeSeconds)
          screenshots.push(outputFile)
        } catch (err) {
          console.warn(`Could not extract screenshot ${i}:`, err)
        }
      }

      return screenshots
    } catch (error) {
      console.error('Error extracting screenshots:', error)
      return []
    }
  }

  /**
   * Parse episode information from filename/path
   */
  extractSeasonEpisode(filepath: string): { season: number; episode: number } | null {
    const filename = path.basename(filepath, path.extname(filepath))
    
    // Pattern: S01E05, s01e05, etc.
    const match = filename.match(/[Ss](\d{1,2})[Ee](\d{1,2})/)
    if (match) {
      return {
        season: parseInt(match[1]),
        episode: parseInt(match[2])
      }
    }

    // Alternative: 1x05, 1x5
    const altMatch = filename.match(/(\d{1,2})x(\d{1,2})/)
    if (altMatch) {
      return {
        season: parseInt(altMatch[1]),
        episode: parseInt(altMatch[2])
      }
    }

    return null
  }

  /**
   * Extract title from file path
   */
  extractTitleFromPath(filepath: string): string {
    let filename = path.basename(filepath, path.extname(filepath))
    
    // Remove common patterns
    filename = filename
      .replace(/\[.*?\]/g, '') // [brackets]
      .replace(/\(.*?\)/g, '') // (parentheses)
      .replace(/[Ss]\d{1,2}[Ee]\d{1,2}/g, '') // S01E05
      .replace(/\d{4}/g, '') // years
      .replace(/720p|1080p|480p|4K|2160p|HD|SD|UHD/gi, '') // quality
      .replace(/BluRay|WEB-DL|HDTV|DVDRip|BRRip/gi, '') // source
      .replace(/-+/g, ' ')
      .replace(/_+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    return filename || 'Unknown'
  }

  /**
   * Format media info for display
   */
  formatMediaInfo(info: ExtractedMediaInfo): string {
    const parts = [
      info.title,
      info.season !== undefined && info.episode !== undefined
        ? `S${String(info.season).padStart(2, '0')}E${String(info.episode).padStart(2, '0')}`
        : null,
      info.resolution,
      info.duration ? `${Math.floor(info.duration / 60)}m` : null
    ].filter(Boolean)

    return parts.join(' • ')
  }

  /**
   * Detect content type based on patterns
   */
  detectContentType(filepath: string): 'movie' | 'series' | 'live-tv' | 'unknown' {
    const filename = path.basename(filepath).toLowerCase()

    // Series patterns
    if (/[Ss]\d{1,2}[Ee]\d{1,2}|series|season|episode|\d{1,2}x\d{1,2}/.test(filename)) {
      return 'series'
    }

    // Live TV patterns
    if (/live|stream|m3u8|playlist|channel|broadcast/i.test(filename)) {
      return 'live-tv'
    }

    // Movie patterns
    if (/movie|film|\d{4}|720p|1080p|4k|bluray|webrip/i.test(filename)) {
      return 'movie'
    }

    return 'unknown'
  }

  /**
   * Build search query for metadata lookup
   */
  buildMetadataQuery(filepath: string): {
    title: string
    season?: number
    episode?: number
    year?: number
  } {
    const title = this.extractTitleFromPath(filepath)
    const se = this.extractSeasonEpisode(filepath)
    
    const filename = path.basename(filepath)
    const yearMatch = filename.match(/(\d{4})/)
    const year = yearMatch
      ? parseInt(yearMatch[1])
      : undefined

    return {
      title,
      season: se?.season,
      episode: se?.episode,
      year
    }
  }
}
