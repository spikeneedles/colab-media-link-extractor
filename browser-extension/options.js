// Options page script for Media Link Scanner extension

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('settingsForm')
  const apiUrlInput = document.getElementById('apiUrl')
  const apiKeyInput = document.getElementById('apiKey')
  const autoOpenCheckbox = document.getElementById('autoOpen')
  const notificationsCheckbox = document.getElementById('notifications')
  const testConnectionBtn = document.getElementById('testConnection')
  const alert = document.getElementById('alert')

  // Load saved settings
  const settings = await chrome.storage.sync.get({
    apiUrl: 'http://localhost:3001/api/external-scan',
    apiKey: '',
    autoOpen: true,
    notifications: true
  })

  apiUrlInput.value = settings.apiUrl
  apiKeyInput.value = settings.apiKey
  autoOpenCheckbox.checked = settings.autoOpen
  notificationsCheckbox.checked = settings.notifications

  // Handle form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault()

    const newSettings = {
      apiUrl: apiUrlInput.value.trim(),
      apiKey: apiKeyInput.value.trim(),
      autoOpen: autoOpenCheckbox.checked,
      notifications: notificationsCheckbox.checked
    }

    try {
      await chrome.storage.sync.set(newSettings)
      showAlert('Settings saved successfully!', 'success')
    } catch (error) {
      showAlert(`Failed to save settings: ${error.message}`, 'error')
    }
  })

  // Handle test connection button
  testConnectionBtn.addEventListener('click', async () => {
    const apiUrl = apiUrlInput.value.trim()
    
    if (!apiUrl) {
      showAlert('Please enter an API URL first', 'error')
      return
    }

    testConnectionBtn.disabled = true
    testConnectionBtn.textContent = '🔄 Testing...'

    try {
      // Try to reach the health endpoint
      const healthUrl = apiUrl.replace('/api/external-scan', '/api/health')
      
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        showAlert(
          `✅ Connection successful! Server is running with ${data.active_jobs || 0} active jobs.`,
          'success'
        )
      } else {
        showAlert(
          `⚠️ Server responded with status ${response.status}. The API may not be configured correctly.`,
          'error'
        )
      }
    } catch (error) {
      showAlert(
        `❌ Connection failed: ${error.message}. Make sure the API server is running and accessible.`,
        'error'
      )
    } finally {
      testConnectionBtn.disabled = false
      testConnectionBtn.textContent = '🧪 Test Connection'
    }
  })

  // Show alert message
  function showAlert(message, type = 'success') {
    alert.textContent = message
    alert.className = `alert alert-${type} show`
    
    // Scroll to top to show alert
    window.scrollTo({ top: 0, behavior: 'smooth' })

    setTimeout(() => {
      alert.classList.remove('show')
    }, 5000)
  }
})
