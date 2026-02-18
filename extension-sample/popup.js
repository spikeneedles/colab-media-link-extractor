/**
 * Media Link Extractor - Popup Script
 */

const WEB_APP_URL = 'http://localhost:5173'

async function updateStatus() {
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
    if (!response) return

    const statusEl = document.getElementById('status')
    const statusText = document.getElementById('statusText')
    const capturedCount = document.getElementById('capturedCount')

    if (response.connected) {
      statusEl.classList.add('connected')
      statusEl.classList.remove('disconnected')
      statusText.textContent = 'Connected'
    } else {
      statusEl.classList.add('disconnected')
      statusEl.classList.remove('connected')
      statusText.textContent = 'Disconnected'
    }

    capturedCount.textContent = response.capturedCount || 0
  })
}

document.getElementById('openDashboard').addEventListener('click', () => {
  chrome.tabs.create({ url: `${WEB_APP_URL}?view=extensions` })
})

document.getElementById('testCapture').addEventListener('click', () => {
  const testUrls = [
    'https://example.com/live.m3u8',
    'http://test.tv/stream.ts',
    'https://cdn.example.com/video.mp4',
  ]

  testUrls.forEach((url) => {
    chrome.runtime.sendMessage({
      type: 'CAPTURE_MEDIA',
      url,
      title: `Test - ${new URL(url).hostname}`,
    })
  })

  setTimeout(() => updateStatus(), 500)
})

document.getElementById('openOptions').addEventListener('click', (e) => {
  e.preventDefault()
  chrome.runtime.openOptionsPage?.()
})

document.getElementById('openHelp').addEventListener('click', (e) => {
  e.preventDefault()
  chrome.tabs.create({ url: 'https://github.com/yourusername/media-link-extractor' })
})

// Update status on popup open
updateStatus()
setInterval(updateStatus, 2000)
