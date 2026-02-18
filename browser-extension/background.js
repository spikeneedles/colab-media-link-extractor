// Background service worker for Media Link Scanner extension
const DEFAULT_API_URL = 'http://localhost:3001/api/external-scan'

// Initialize context menu when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'send-to-scanner',
    title: 'Send to Media Link Scanner',
    contexts: ['link', 'page', 'selection']
  })

  chrome.contextMenus.create({
    id: 'scan-link',
    title: 'Scan this link',
    contexts: ['link']
  })

  chrome.contextMenus.create({
    id: 'scan-page',
    title: 'Scan current page',
    contexts: ['page']
  })

  console.log('Media Link Scanner extension installed')
})

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  let targetUrl = null
  let label = null
  let mediaType = 'web'

  if (info.menuItemId === 'scan-link' && info.linkUrl) {
    targetUrl = info.linkUrl
    label = `Link from ${new URL(info.pageUrl || '').hostname || 'unknown'}`
  } else if (info.menuItemId === 'scan-page' && info.pageUrl) {
    targetUrl = info.pageUrl
    label = tab?.title || 'Current Page'
  } else if (info.menuItemId === 'send-to-scanner') {
    if (info.linkUrl) {
      targetUrl = info.linkUrl
      label = `Link from ${new URL(info.pageUrl || '').hostname || 'unknown'}`
    } else if (info.pageUrl) {
      targetUrl = info.pageUrl
      label = tab?.title || 'Current Page'
    } else if (info.selectionText) {
      targetUrl = info.selectionText.trim()
      label = 'Selected text'
    }
  }

  if (!targetUrl) {
    showNotification('Error', 'No valid URL found to scan', 'error')
    return
  }

  // Detect media type from URL
  mediaType = detectMediaType(targetUrl)

  try {
    const settings = await chrome.storage.sync.get({
      apiUrl: DEFAULT_API_URL,
      apiKey: '',
      autoOpen: true
    })

    const jobId = await sendToScanner(targetUrl, label, mediaType, settings)
    
    if (jobId) {
      showNotification(
        'Scan Started', 
        `Job ID: ${jobId.substring(0, 8)}...\n${label || targetUrl}`,
        'success'
      )

      // Store the job ID for tracking
      const jobs = await chrome.storage.local.get({ recentJobs: [] })
      jobs.recentJobs.unshift({
        id: jobId,
        url: targetUrl,
        label,
        timestamp: Date.now(),
        status: 'pending'
      })
      // Keep only last 20 jobs
      jobs.recentJobs = jobs.recentJobs.slice(0, 20)
      await chrome.storage.local.set(jobs)

      // Open scanner UI if auto-open is enabled
      if (settings.autoOpen) {
        const scannerUrl = settings.apiUrl.replace('/api/external-scan', '') + `#/jobs/${jobId}`
        chrome.tabs.create({ url: scannerUrl })
      }
    }
  } catch (error) {
    showNotification('Scan Failed', error.message, 'error')
    console.error('Scan error:', error)
  }
})

// Send URL to scanner API
async function sendToScanner(url, label, mediaType, settings) {
  const payload = {
    source_url: url,
    label: label || url,
    media_type: mediaType,
    depth: 3
  }

  const headers = {
    'Content-Type': 'application/json'
  }

  if (settings.apiKey) {
    headers['Authorization'] = `Bearer ${settings.apiKey}`
  }

  const response = await fetch(settings.apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
  }

  const result = await response.json()
  
  if (result.status === 'error') {
    throw new Error(result.message)
  }

  return result.job_id
}

// Detect media type from URL
function detectMediaType(url) {
  const urlLower = url.toLowerCase()

  // Repository detection
  if (urlLower.includes('github.com') || 
      urlLower.includes('gitlab.com') || 
      urlLower.includes('bitbucket.org') ||
      urlLower.includes('codeberg.org') ||
      urlLower.includes('gitea')) {
    return 'repository'
  }

  // Playlist detection
  if (urlLower.endsWith('.m3u') || 
      urlLower.endsWith('.m3u8') ||
      urlLower.endsWith('.pls') ||
      urlLower.endsWith('.xspf') ||
      urlLower.includes('playlist')) {
    return 'web'
  }

  // Package detection
  if (urlLower.endsWith('.apk') ||
      urlLower.endsWith('.aab') ||
      urlLower.endsWith('.xapk') ||
      urlLower.endsWith('.apks') ||
      urlLower.endsWith('.apkm') ||
      urlLower.endsWith('.apex')) {
    return 'file'
  }

  // Archive detection
  if (urlLower.endsWith('.zip') ||
      urlLower.endsWith('.rar') ||
      urlLower.endsWith('.7z') ||
      urlLower.endsWith('.tar') ||
      urlLower.endsWith('.tar.gz')) {
    return 'file'
  }

  // Default to web
  return 'web'
}

// Show notification
function showNotification(title, message, type = 'info') {
  const iconMap = {
    success: 'icons/icon-success.png',
    error: 'icons/icon-error.png',
    info: 'icons/icon48.png'
  }

  chrome.notifications.create({
    type: 'basic',
    iconUrl: iconMap[type] || iconMap.info,
    title,
    message,
    priority: 2
  })
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'scanUrl') {
    const { url, label, mediaType } = message
    chrome.storage.sync.get({
      apiUrl: DEFAULT_API_URL,
      apiKey: ''
    }, (settings) => {
      sendToScanner(url, label, mediaType, settings)
        .then(jobId => {
          sendResponse({ success: true, jobId })
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message })
        })
    })
    return true // Keep channel open for async response
  }

  if (message.action === 'getRecentJobs') {
    chrome.storage.local.get({ recentJobs: [] }, (data) => {
      sendResponse({ jobs: data.recentJobs })
    })
    return true
  }

  if (message.action === 'clearJobs') {
    chrome.storage.local.set({ recentJobs: [] }, () => {
      sendResponse({ success: true })
    })
    return true
  }
})

console.log('Media Link Scanner background worker loaded')
