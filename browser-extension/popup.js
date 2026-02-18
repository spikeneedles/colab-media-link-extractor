// Popup script for Media Link Scanner extension

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('scanForm')
  const urlInput = document.getElementById('urlInput')
  const labelInput = document.getElementById('labelInput')
  const typeSelect = document.getElementById('typeSelect')
  const openScannerBtn = document.getElementById('openScanner')
  const clearJobsBtn = document.getElementById('clearJobs')
  const alert = document.getElementById('alert')
  const loading = document.getElementById('loading')
  const jobsList = document.getElementById('jobsList')

  // Load settings
  const settings = await chrome.storage.sync.get({
    apiUrl: 'http://localhost:3001/api/external-scan',
    apiKey: ''
  })

  // Try to get current tab URL
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://')) {
      urlInput.value = tab.url
      labelInput.value = tab.title || ''
    }
  } catch (error) {
    console.log('Could not get active tab:', error)
  }

  // Load recent jobs
  loadRecentJobs()

  // Handle form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    
    const url = urlInput.value.trim()
    const label = labelInput.value.trim() || url
    let mediaType = typeSelect.value

    if (!url) {
      showAlert('Please enter a URL to scan', 'error')
      return
    }

    // Auto-detect media type if set to auto
    if (mediaType === 'auto') {
      mediaType = detectMediaType(url)
    }

    loading.classList.add('show')
    form.style.display = 'none'
    openScannerBtn.style.display = 'none'

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'scanUrl',
        url,
        label,
        mediaType
      })

      loading.classList.remove('show')
      form.style.display = 'block'
      openScannerBtn.style.display = 'block'

      if (response.success) {
        showAlert(`Scan started! Job ID: ${response.jobId.substring(0, 8)}...`, 'success')
        
        // Clear form
        urlInput.value = ''
        labelInput.value = ''
        typeSelect.value = 'auto'

        // Reload jobs list
        setTimeout(loadRecentJobs, 500)

        // Open scanner app
        const scannerUrl = settings.apiUrl.replace('/api/external-scan', '') + `#/jobs/${response.jobId}`
        chrome.tabs.create({ url: scannerUrl })
      } else {
        showAlert(`Scan failed: ${response.error}`, 'error')
      }
    } catch (error) {
      loading.classList.remove('show')
      form.style.display = 'block'
      openScannerBtn.style.display = 'block'
      showAlert(`Error: ${error.message}`, 'error')
    }
  })

  // Handle open scanner button
  openScannerBtn.addEventListener('click', () => {
    const scannerUrl = settings.apiUrl.replace('/api/external-scan', '')
    chrome.tabs.create({ url: scannerUrl })
  })

  // Handle clear jobs button
  clearJobsBtn.addEventListener('click', async () => {
    if (confirm('Clear all recent jobs?')) {
      await chrome.runtime.sendMessage({ action: 'clearJobs' })
      loadRecentJobs()
      showAlert('Recent jobs cleared', 'success')
    }
  })

  // Load recent jobs from storage
  async function loadRecentJobs() {
    const response = await chrome.runtime.sendMessage({ action: 'getRecentJobs' })
    const jobs = response.jobs || []

    if (jobs.length === 0) {
      jobsList.innerHTML = '<div class="empty-state">No recent scans</div>'
      return
    }

    jobsList.innerHTML = jobs.map(job => {
      const date = new Date(job.timestamp)
      const timeAgo = getTimeAgo(date)
      const statusClass = `status-${job.status}`

      return `
        <div class="job-item">
          <div class="job-label" title="${job.label}">${job.label}</div>
          <div class="job-meta">
            <span class="status-badge ${statusClass}">${job.status}</span>
            <span>${timeAgo}</span>
          </div>
        </div>
      `
    }).join('')
  }

  // Show alert message
  function showAlert(message, type = 'success') {
    alert.textContent = message
    alert.className = `alert alert-${type} show`
    
    setTimeout(() => {
      alert.classList.remove('show')
    }, 5000)
  }

  // Detect media type from URL
  function detectMediaType(url) {
    const urlLower = url.toLowerCase()

    if (urlLower.includes('github.com') || 
        urlLower.includes('gitlab.com') || 
        urlLower.includes('bitbucket.org') ||
        urlLower.includes('codeberg.org')) {
      return 'repository'
    }

    if (urlLower.endsWith('.m3u') || 
        urlLower.endsWith('.m3u8') ||
        urlLower.endsWith('.apk') ||
        urlLower.endsWith('.zip')) {
      return 'web'
    }

    return 'web'
  }

  // Get time ago string
  function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000)
    
    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }
})
