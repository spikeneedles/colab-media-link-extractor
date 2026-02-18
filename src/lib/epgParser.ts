import type { ValidationStatus } from './urlValidator'

export interface EPGChannel {
  id: string
  displayName: string
  icon?: string
  url?: string
  category?: string
  group?: string
  validationStatus?: ValidationStatus
  responseTime?: number
  statusCode?: number
}

export interface EPGProgramme {
  channel: string
  start: string
  stop: string
  title: string
  description?: string
  category?: string
  icon?: string
  episodeNum?: string
  rating?: string
  language?: string
}

export interface EPGData {
  channels: EPGChannel[]
  programmes: EPGProgramme[]
  channelCount: number
  programmeCount: number
  categories: string[]
}

export function parseEPG(content: string): EPGData | null {
  try {
    if (!content.includes('<tv') && !content.includes('<channel') && !content.includes('<programme')) {
      return null
    }

    const channels: EPGChannel[] = []
    const programmes: EPGProgramme[] = []

    const channelRegex = /<channel\s+id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/channel>/gi
    let channelMatch

    while ((channelMatch = channelRegex.exec(content)) !== null) {
      const id = channelMatch[1]
      const channelContent = channelMatch[2]

      const displayNameMatch = channelContent.match(/<display-name[^>]*>([^<]+)<\/display-name>/)
      const iconMatch = channelContent.match(/<icon\s+src=["']([^"']+)["']/)
      const urlMatch = channelContent.match(/<url>([^<]+)<\/url>/)
      const categoryMatch = channelContent.match(/<category[^>]*>([^<]+)<\/category>/)
      const groupMatch = channelContent.match(/<group[^>]*>([^<]+)<\/group>/)

      channels.push({
        id,
        displayName: displayNameMatch ? displayNameMatch[1] : id,
        icon: iconMatch ? iconMatch[1] : undefined,
        url: urlMatch ? urlMatch[1] : undefined,
        category: categoryMatch ? categoryMatch[1] : undefined,
        group: groupMatch ? groupMatch[1] : undefined
      })
    }

    const programmeRegex = /<programme\s+([^>]+)>([\s\S]*?)<\/programme>/gi
    let programmeMatch

    while ((programmeMatch = programmeRegex.exec(content)) !== null) {
      const attributes = programmeMatch[1]
      const programmeContent = programmeMatch[2]

      const channelMatch = attributes.match(/channel=["']([^"']+)["']/)
      const startMatch = attributes.match(/start=["']([^"']+)["']/)
      const stopMatch = attributes.match(/stop=["']([^"']+)["']/)

      if (!channelMatch || !startMatch || !stopMatch) continue

      const titleMatch = programmeContent.match(/<title[^>]*>([^<]+)<\/title>/)
      const descMatch = programmeContent.match(/<desc[^>]*>([^<]+)<\/desc>/)
      const categoryMatch = programmeContent.match(/<category[^>]*>([^<]+)<\/category>/)
      const iconMatch = programmeContent.match(/<icon\s+src=["']([^"']+)["']/)
      const episodeMatch = programmeContent.match(/<episode-num[^>]*>([^<]+)<\/episode-num>/)
      const ratingMatch = programmeContent.match(/<rating[^>]*>[\s\S]*?<value>([^<]+)<\/value>/)
      const languageMatch = programmeContent.match(/<language>([^<]+)<\/language>/)

      programmes.push({
        channel: channelMatch[1],
        start: startMatch[1],
        stop: stopMatch[1],
        title: titleMatch ? titleMatch[1] : 'Unknown',
        description: descMatch ? descMatch[1] : undefined,
        category: categoryMatch ? categoryMatch[1] : undefined,
        icon: iconMatch ? iconMatch[1] : undefined,
        episodeNum: episodeMatch ? episodeMatch[1] : undefined,
        rating: ratingMatch ? ratingMatch[1] : undefined,
        language: languageMatch ? languageMatch[1] : undefined
      })
    }

    if (channels.length === 0 && programmes.length === 0) {
      return null
    }

    const categories = new Set<string>()
    channels.forEach(ch => {
      if (ch.category) categories.add(ch.category)
      if (ch.group) categories.add(ch.group)
    })
    programmes.forEach(prog => {
      if (prog.category) categories.add(prog.category)
    })

    return {
      channels,
      programmes,
      channelCount: channels.length,
      programmeCount: programmes.length,
      categories: Array.from(categories).sort()
    }
  } catch (error) {
    console.error('Error parsing EPG:', error)
    return null
  }
}

export function formatEPGDateTime(dateTime: string): string {
  try {
    const year = dateTime.substring(0, 4)
    const month = dateTime.substring(4, 6)
    const day = dateTime.substring(6, 8)
    const hour = dateTime.substring(8, 10)
    const minute = dateTime.substring(10, 12)
    
    return `${year}-${month}-${day} ${hour}:${minute}`
  } catch {
    return dateTime
  }
}

export function generateEPGSummary(epgData: EPGData): string {
  const lines = [
    'EPG (Electronic Program Guide) Summary',
    '=' .repeat(50),
    '',
    `Total Channels: ${epgData.channelCount}`,
    `Total Programmes: ${epgData.programmeCount}`,
    '',
    'Channels:',
    '-'.repeat(50)
  ]

  epgData.channels.forEach(channel => {
    lines.push(`ID: ${channel.id}`)
    lines.push(`Name: ${channel.displayName}`)
    if (channel.category) lines.push(`Category: ${channel.category}`)
    if (channel.group) lines.push(`Group: ${channel.group}`)
    if (channel.url) lines.push(`URL: ${channel.url}`)
    if (channel.icon) lines.push(`Icon: ${channel.icon}`)
    lines.push('')
  })

  if (epgData.programmes.length > 0) {
    lines.push('Programme Schedule (Sample):')
    lines.push('-'.repeat(50))
    
    const sampleProgrammes = epgData.programmes.slice(0, 20)
    sampleProgrammes.forEach(programme => {
      lines.push(`Channel: ${programme.channel}`)
      lines.push(`Title: ${programme.title}`)
      lines.push(`Time: ${formatEPGDateTime(programme.start)} - ${formatEPGDateTime(programme.stop)}`)
      if (programme.description) lines.push(`Description: ${programme.description}`)
      if (programme.category) lines.push(`Category: ${programme.category}`)
      lines.push('')
    })
    
    if (epgData.programmes.length > 20) {
      lines.push(`... and ${epgData.programmes.length - 20} more programmes`)
    }
  }

  return lines.join('\n')
}

export function generateEPGChannelsFile(epgData: EPGData): Blob {
  const lines = [
    'EPG Channels',
    '=' .repeat(50),
    ''
  ]

  epgData.channels.forEach(channel => {
    lines.push(`[${channel.id}]`)
    lines.push(`Name: ${channel.displayName}`)
    if (channel.category) lines.push(`Category: ${channel.category}`)
    if (channel.group) lines.push(`Group: ${channel.group}`)
    if (channel.url) lines.push(`URL: ${channel.url}`)
    if (channel.icon) lines.push(`Icon: ${channel.icon}`)
    lines.push('')
  })

  return new Blob([lines.join('\n')], { type: 'text/plain' })
}

export function generateEPGProgrammesFile(epgData: EPGData): Blob {
  const lines = [
    'EPG Programme Schedule',
    '=' .repeat(50),
    ''
  ]

  const programmesByChannel = new Map<string, EPGProgramme[]>()
  
  epgData.programmes.forEach(programme => {
    if (!programmesByChannel.has(programme.channel)) {
      programmesByChannel.set(programme.channel, [])
    }
    programmesByChannel.get(programme.channel)!.push(programme)
  })

  programmesByChannel.forEach((programmes, channelId) => {
    const channel = epgData.channels.find(ch => ch.id === channelId)
    const channelName = channel ? channel.displayName : channelId
    
    lines.push(`Channel: ${channelName} (${channelId})`)
    lines.push('-'.repeat(50))
    
    programmes.forEach(programme => {
      lines.push(`${formatEPGDateTime(programme.start)} - ${formatEPGDateTime(programme.stop)}`)
      lines.push(`  ${programme.title}`)
      if (programme.description) lines.push(`  ${programme.description}`)
      if (programme.category) lines.push(`  Category: ${programme.category}`)
      if (programme.episodeNum) lines.push(`  Episode: ${programme.episodeNum}`)
      lines.push('')
    })
    
    lines.push('')
  })

  return new Blob([lines.join('\n')], { type: 'text/plain' })
}

export function generateEPGChannelURLsFile(epgData: EPGData): Blob {
  const channelsWithUrls = epgData.channels.filter(ch => ch.url)
  const urls = channelsWithUrls.map(ch => ch.url!)
  
  return new Blob([urls.join('\n')], { type: 'text/plain' })
}
