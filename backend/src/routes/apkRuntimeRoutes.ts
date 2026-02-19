import { Router, Request, Response } from 'express'
import multer, { type Multer } from 'multer'
import { tmpdir } from 'os'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { apkRuntimeScanner } from '../apkRuntimeScanner.js'

const router = Router()
const storage = multer.diskStorage({
  destination: tmpdir(),
  filename: (req, file, cb) => {
    // Preserve original filename to keep .apk extension for adb
    cb(null, file.originalname)
  }
})
const upload = multer({ storage })

// Add timeout middleware for APK runtime routes (160 seconds to allow 150s APK install + overhead)
router.use((req, res, next) => {
  req.setTimeout(160000)
  res.setTimeout(160000)
  next()
})

router.post('/start', async (req: Request, res: Response) => {
  try {
    const { apkPath, packageName, activity, enableProxy, proxyHost, proxyPort } = req.body

    if (!apkPath && !packageName) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Either apkPath or packageName must be provided'
      })
    }

    const state = await apkRuntimeScanner.start({
      apkPath,
      packageName,
      activity,
      enableProxy: Boolean(enableProxy),
      proxyHost,
      proxyPort: proxyPort ? Number(proxyPort) : undefined
    })

    res.json({
      success: true,
      state
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const isTimeout = errorMessage.includes('Timeout') || errorMessage.includes('timed out')
    const isEmulatorIssue = errorMessage.includes('emulator') || errorMessage.includes('No running')
    
    res.status(500).json({
      error: 'Failed to start runtime capture',
      message: errorMessage,
      reason: isTimeout ? 'Emulator or ADB is unresponsive' : isEmulatorIssue ? 'Emulator not running' : 'Runtime error',
      hint: 'Run: adb devices to check emulator connectivity'
    })
  }
})

router.post('/upload-start', upload.single('apk'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        error: 'APK file is required',
        message: 'No file was uploaded'
      })
    }

    const { packageName, activity } = req.body

    const state = await apkRuntimeScanner.start({
      apkPath: req.file.path,
      packageName: packageName || undefined,
      activity: activity || undefined,
      enableProxy: true
    })

    await unlink(req.file.path).catch(() => undefined)

    res.json({
      success: true,
      state
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const isEmulatorIssue = errorMessage.includes('emulator') || errorMessage.includes('adb')
    
    res.status(500).json({
      error: 'Failed to install APK and start capture',
      message: errorMessage,
      reason: isEmulatorIssue ? 'Emulator connectivity issue' : 'APK installation failed',
      hint: 'Check: 1) Emulator running, 2) APK is valid, 3) adb devices shows device'
    })
  }
})

router.post('/stop', (req: Request, res: Response) => {
  try {
    const state = apkRuntimeScanner.stop()
    res.json({ success: true, state })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    res.status(500).json({
      error: 'Failed to stop runtime capture',
      message: errorMessage,
      reason: 'Cleanup process encountered an error',
      note: 'Processes may still be running - some manual cleanup may be needed'
    })
  }
})

router.get('/preflight', async (req: Request, res: Response) => {
  try {
    const preflight = await apkRuntimeScanner.preflight()
    res.json({ success: true, preflight })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to run runtime preflight',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

router.get('/status', (req: Request, res: Response) => {
  res.json({ success: true, state: apkRuntimeScanner.getState() })
})

router.get('/urls', (req: Request, res: Response) => {
  res.json({ success: true, urls: apkRuntimeScanner.getState().urls })
})

export default router
