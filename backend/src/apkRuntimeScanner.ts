import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { resolve } from 'path'
import { existsSync, statSync } from 'fs'

const MEDIA_EXTENSIONS = [
  'm3u', 'm3u8', 'mpd', 'ism', 'isml', 'f4m', 'ts', 'mp4', 'mkv', 'webm', 'mov', 'avi',
  'mp3', 'aac', 'flac', 'wav', 'ogg', 'opus', 'm4a', 'ac3', 'dts',
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'svg',
  'srt', 'vtt', 'ass', 'ssa', 'sub', 'idx'
]

const MEDIA_PROTOCOLS = ['rtsp://', 'rtmp://', 'rtmps://', 'mms://', 'mmsh://', 'udp://', 'hls://', 'dash://']

export type RuntimeCaptureStatus = 'idle' | 'starting' | 'running' | 'stopped' | 'error'

export interface RuntimeCaptureConfig {
  apkPath?: string
  packageName?: string
  activity?: string
  enableProxy?: boolean
  proxyHost?: string
  proxyPort?: number
}

export interface RuntimeCaptureState {
  status: RuntimeCaptureStatus
  startedAt?: Date
  stoppedAt?: Date
  error?: string
  urls: string[]
  logLines: number
  packageName?: string
}

export interface RuntimePreflightResult {
  adbOk: boolean
  adbVersion?: string
  emulatorOk: boolean
  devices: string[]
}

export class ApkRuntimeScanner {
  private logcatProcess: ChildProcessWithoutNullStreams | null = null
  private mitmProcess: ChildProcessWithoutNullStreams | null = null
  private urls: Set<string> = new Set()
  private status: RuntimeCaptureStatus = 'idle'
  private startedAt?: Date
  private stoppedAt?: Date
  private error?: string
  private logLines = 0
  private packageName?: string

  async preflight(): Promise<RuntimePreflightResult> {
    let adbVersionOutput = ''

    try {
      adbVersionOutput = await this.runAdbCommandWithOutput(['version'])
    } catch (error) {
      return {
        adbOk: false,
        emulatorOk: false,
        devices: []
      }
    }

    let devicesOutput = ''
    try {
      devicesOutput = await this.runAdbCommandWithOutput(['devices'])
    } catch (error) {
      return {
        adbOk: true,
        adbVersion: adbVersionOutput.trim().split('\n')[0],
        emulatorOk: false,
        devices: []
      }
    }

    const deviceLines = devicesOutput
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .filter(line => !line.startsWith('List of devices attached'))

    const devices = deviceLines
      .map(line => line.split(/\s+/)[0])
      .filter(Boolean)

    const emulatorOk = deviceLines.some(line => line.startsWith('emulator-') && /\sdevice\b/.test(line))

    return {
      adbOk: true,
      adbVersion: adbVersionOutput.trim().split('\n')[0],
      emulatorOk,
      devices
    }
  }

  async start(config: RuntimeCaptureConfig): Promise<RuntimeCaptureState> {
    if (this.status === 'running' || this.status === 'starting') {
      throw new Error('Runtime capture already running')
    }

    this.status = 'starting'
    this.startedAt = new Date()
    this.stoppedAt = undefined
    this.error = undefined
    this.urls.clear()
    this.logLines = 0

    // Wrap the entire start process with a timeout
    // Must be longer than APK install timeout (120s) + time for other operations
    return new Promise<RuntimeCaptureState>((resolve, reject) => {
      const startTimeout = setTimeout(() => {
        this.status = 'error'
        this.error = 'Timeout: Runtime startup exceeded 150 seconds. Causes: slow emulator, installation hang, or APK launch failure. Verify emulator is responsive.'
        this.stoppedAt = new Date()
        this.stop()
        reject(new Error(this.error))
      }, 150000) // 150 second timeout for entire start process (includes 120s APK install)

      this.startAsync(config)
        .then((state) => {
          clearTimeout(startTimeout)
          resolve(state)
        })
        .catch((err) => {
          clearTimeout(startTimeout)
          this.status = 'error'
          this.error = err instanceof Error ? err.message : 'Unknown error'
          this.stoppedAt = new Date()
          reject(err)
        })
    })
  }

  private async startAsync(config: RuntimeCaptureConfig): Promise<RuntimeCaptureState> {
    const preflight = await this.preflight()
    if (!preflight.adbOk) {
      this.status = 'error'
      this.error = 'Android Studio adb not found on PATH. Add platform-tools to PATH and restart the backend.'
      this.stoppedAt = new Date()
      throw new Error(this.error)
    }

    if (!preflight.emulatorOk) {
      this.status = 'error'
      this.error = 'No running emulator detected. Start an Android Studio AVD before starting runtime capture.'
      this.stoppedAt = new Date()
      throw new Error(this.error)
    }

    if (config.apkPath) {
      // Validate APK file exists and is accessible
      if (!existsSync(config.apkPath)) {
        this.status = 'error'
        this.error = `APK file not found: ${config.apkPath}. File may have been deleted or path is incorrect.`
        this.stoppedAt = new Date()
        throw new Error(this.error)
      }

      // Check file size
      const stats = statSync(config.apkPath)
      const fileSizeMB = stats.size / (1024 * 1024)
      if (stats.size === 0) {
        this.status = 'error'
        this.error = `APK file is empty (0 bytes): ${config.apkPath}. Upload may have failed.`
        this.stoppedAt = new Date()
        throw new Error(this.error)
      }

      if (fileSizeMB > 500) {
        this.status = 'error'
        this.error = `APK file too large (${fileSizeMB.toFixed(1)}MB): ${config.apkPath}. Max 500MB allowed.`
        this.stoppedAt = new Date()
        throw new Error(this.error)
      }

      // Check device storage before install
      try {
        const storageOutput = await this.runAdbCommandWithOutput(['shell', 'df', '/data'])
        const lines = storageOutput.split('\n').filter(line => line.includes('/data'))
        if (lines.length > 0) {
          const parts = lines[0].split(/\s+/)
          if (parts.length >= 4) {
            const available = parseInt(parts[3]) * 1024 // Convert to bytes
            if (available < stats.size * 2) {
              this.status = 'error'
              const availableMB = (available / (1024 * 1024)).toFixed(1)
              this.error = `Insufficient device storage. Available: ${availableMB}MB, Required: ${(fileSizeMB * 2).toFixed(1)}MB`
              this.stoppedAt = new Date()
              throw new Error(this.error)
            }
          }
        }
      } catch (storageCheck) {
        // If storage check fails, continue anyway but log it
        console.warn('Could not verify device storage:', storageCheck instanceof Error ? storageCheck.message : 'unknown error')
      }

      const beforePackages = await this.listPackages()
      
      // Check adb connectivity before attempting install
      console.log(`[APK] Verifying adb connection to device...`)
      try {
        await this.runAdbCommand(['shell', 'echo', 'test'])
        console.log(`[APK] adb connection verified`)
      } catch (connError) {
        console.error(`[APK] adb connection check failed:`, connError)
        throw new Error(`Cannot connect to device via adb. Try: adb kill-server && adb devices`)
      }

      // Log the exact file path being installed
      console.log(`[APK] APK file details: ${config.apkPath}`)
      console.log(`[APK] File exists: yes, Size: ${(statSync(config.apkPath).size / (1024 * 1024)).toFixed(2)}MB`)
      
      // Use two-stage install: push APK to device, then install from device
      // This provides better progress visibility
      const remotePath = '/data/local/tmp/app.apk'
      
      console.log(`[APK] Pushing APK to device: ${remotePath}`)
      const pushStartTime = Date.now()
      try {
        await this.runAdbCommand(['push', config.apkPath, remotePath])
        const pushElapsed = (Date.now() - pushStartTime) / 1000
        console.log(`[APK] Push completed in ${pushElapsed.toFixed(1)}s`)
      } catch (pushError) {
        console.error(`[APK] Push failed:`, pushError)
        throw new Error(`Failed to push APK to device: ${pushError instanceof Error ? pushError.message : String(pushError)}`)
      }

      // Now install from the remote path
      console.log(`[APK] Installing from device: ${remotePath}`)
      const installStartTime = Date.now()
      
      try {
        // Use pm install instead of adb install for more granular control
        await this.runAdbCommand(['shell', 'pm', 'install', '-r', '-g', remotePath])
      } catch (installError) {
        console.log(`[APK] pm install with -g failed, retrying...`)
        try {
          await this.runAdbCommand(['shell', 'pm', 'install', '-r', remotePath])
        } catch (basicInstallError) {
          const elapsedSeconds = (Date.now() - installStartTime) / 1000
          console.error(`[APK] Installation failed after ${elapsedSeconds.toFixed(1)}s:`, basicInstallError)
          
          // Clean up the remote file
          await this.runAdbCommand(['shell', 'rm', remotePath]).catch(() => undefined)
          throw basicInstallError
        }
      }
      
      const elapsedSeconds = (Date.now() - installStartTime) / 1000
      console.log(`[APK] Installation completed in ${elapsedSeconds.toFixed(1)}s`)
      
      // Clean up the remote APK file
      await this.runAdbCommand(['shell', 'rm', remotePath]).catch(() => undefined)
      
      if (!config.packageName) {
        const afterPackages = await this.listPackages()
        const newPackages = afterPackages.filter(pkg => !beforePackages.includes(pkg))
        if (newPackages.length > 0) {
          config.packageName = newPackages[0]
          console.log(`[APK] Detected new package: ${config.packageName}`)
        }
      }
    }

    if (config.enableProxy) {
      const host = config.proxyHost || '127.0.0.1'
      const port = config.proxyPort || 8081
      await this.setEmulatorProxy(`${host}:${port}`)
      this.startMitmProxy(port)
    }

    if (config.packageName) {
      this.packageName = config.packageName
      if (config.activity) {
        await this.runAdbCommand(['shell', 'am', 'start', '-n', `${config.packageName}/${config.activity}`])
      } else {
        await this.runAdbCommand(['shell', 'monkey', '-p', config.packageName, '-c', 'android.intent.category.LAUNCHER', '1'])
      }
    }

    this.startLogcat()
    this.status = 'running'

    return this.getState()
  }

  stop(): RuntimeCaptureState {
    if (this.logcatProcess) {
      this.logcatProcess.kill()
      this.logcatProcess = null
    }

    if (this.mitmProcess) {
      this.mitmProcess.kill()
      this.mitmProcess = null
    }

    this.status = 'stopped'
    this.stoppedAt = new Date()
    this.clearEmulatorProxy().catch(() => undefined)

    return this.getState()
  }

  getState(): RuntimeCaptureState {
    return {
      status: this.status,
      startedAt: this.startedAt,
      stoppedAt: this.stoppedAt,
      error: this.error,
      urls: Array.from(this.urls),
      logLines: this.logLines,
      packageName: this.packageName
    }
  }

  private startLogcat(): void {
    this.logcatProcess = spawn('adb', ['logcat', '-v', 'time'])

    this.logcatProcess.stdout.on('data', (data) => {
      const text = data.toString('utf8')
      const lines = text.split('\n')
      lines.forEach((line: string) => {
        if (!line.trim()) return
        this.logLines += 1
        this.extractUrlsFromText(line)
      })
    })

    this.logcatProcess.stderr.on('data', (data) => {
      this.error = data.toString('utf8').trim()
    })

    this.logcatProcess.on('exit', () => {
      if (this.status === 'running') {
        this.status = 'stopped'
        this.stoppedAt = new Date()
      }
    })
  }

  private startMitmProxy(port: number): void {
    const scriptPath = resolve(process.cwd(), 'scripts', 'mitm_capture.py')
    this.mitmProcess = spawn('mitmdump', ['-p', String(port), '-s', scriptPath])

    this.mitmProcess.stdout.on('data', (data) => {
      const text = data.toString('utf8')
      this.extractUrlsFromText(text)
    })

    this.mitmProcess.stderr.on('data', (data) => {
      const message = data.toString('utf8').trim()
      if (message) {
        this.error = message
      }
    })
  }

  private extractUrlsFromText(text: string): void {
    const regex = /(https?:\/\/[^\s"'<>]+)|(rtsp:\/\/[^\s"'<>]+)|(rtmp[s]?:\/\/[^\s"'<>]+)|(mms:\/\/[^\s"'<>]+)|(udp:\/\/[^\s"'<>]+)/gi
    const matches = text.match(regex) || []
    matches.forEach((url) => {
      if (this.isMediaUrl(url)) {
        this.urls.add(url)
      }
    })
  }

  private isMediaUrl(url: string): boolean {
    const lower = url.toLowerCase()
    if (MEDIA_PROTOCOLS.some(protocol => lower.startsWith(protocol))) {
      return true
    }

    const extensionMatch = lower.split('?')[0].split('#')[0].split('.').pop()
    if (extensionMatch && MEDIA_EXTENSIONS.includes(extensionMatch)) {
      return true
    }

    return /playlist|stream|live|video|media|cdn|hls|dash|manifest/i.test(lower)
  }

  private async runAdbCommand(args: string[]): Promise<void> {
    return new Promise<void>((resolvePromise, reject) => {
      const proc = spawn('adb', args)
      let stderr = ''
      let stdout = ''
      let timedOut = false
      let lastOutput = Date.now()
      let hasOutput = false

      // APK install commands need longer timeout (120s), others use 30s
      const isInstall = args[0] === 'install'
      const timeoutMs = isInstall ? 120000 : 30000
      
      // Log the exact command being run
      console.log(`[adb] Executing: adb ${args.join(' ')}`)

      const timeout = setTimeout(() => {
        timedOut = true
        proc.kill()
        const noOutputMsg = !hasOutput ? ' (No output received from adb)' : ''
        reject(new Error(`Timeout after ${timeoutMs / 1000}s running command: adb ${args.join(' ')}.${noOutputMsg} Emulator appears unresponsive or very slow.`))
      }, timeoutMs)

      // Track when we last got output to detect stalls
      const outputTimeout = setInterval(() => {
        if (isInstall && (Date.now() - lastOutput) > 10000) {
          const elapsed = (Date.now() - lastOutput) / 1000
          console.log(`[APK] WARNING: No output from adb for ${elapsed.toFixed(1)}s - emulator may be unresponsive`)
        }
      }, 5000)

      proc.stdout.on('data', (data) => {
        const output = data.toString('utf8')
        stdout += output
        lastOutput = Date.now()
        hasOutput = true
        
        // Log adb install progress
        if (isInstall) {
          console.log(`[adb stdout] ${output.replace(/\n$/, '')}`)
        }
      })

      proc.stderr.on('data', (data) => {
        const output = data.toString('utf8')
        stderr += output
        lastOutput = Date.now()
        hasOutput = true
        
        // Log adb errors in real-time
        if (isInstall) {
          console.log(`[adb stderr] ${output.replace(/\n$/, '')}`)
        }
      })

      proc.on('exit', (code) => {
        clearTimeout(timeout)
        clearInterval(outputTimeout)
        if (timedOut) return

        console.log(`[adb] Process exited with code: ${code}`)
        
        if (code === 0) {
          resolvePromise()
        } else {
          // For install commands, provide more detailed error info
          if (isInstall) {
            const output = stdout + stderr
            if (output.includes('INSTALL_FAILED_INVALID_APK')) {
              reject(new Error('Invalid APK file format. Re-download the APK and try again.'))
            } else if (output.includes('INSTALL_FAILED_INSUFFICIENT_STORAGE')) {
              reject(new Error('Device storage full. Clear some space on the emulator and retry.'))
            } else if (output.includes('INSTALL_FAILED_DUPLICATE_PACKAGE')) {
              reject(new Error('Package already installed. Uninstall first or use -r flag (already enabled).'))
            } else if (output.includes('cmd: Can\'t find service: package')) {
              reject(new Error('Emulator package manager not responding. Restart the emulator.'))
            } else {
              reject(new Error(`APK installation failed: ${output || stderr || `exit code ${code}`}`))
            }
          } else {
            reject(new Error(stderr || stdout || `adb exited with code ${code}`))
          }
        }
      })

      proc.on('error', (err) => {
        clearTimeout(timeout)
        clearInterval(outputTimeout)
        console.error(`[adb] Process error:`, err)
        reject(new Error(`Failed to execute adb: ${err instanceof Error ? err.message : String(err)}`))
      })
    })
  }

  private async runAdbCommandWithOutput(args: string[]): Promise<string> {
    return new Promise<string>((resolvePromise, reject) => {
      const proc = spawn('adb', args)
      let stdout = ''
      let stderr = ''
      let timedOut = false

      // APK install commands need longer timeout (120s), others use 30s
      const isInstall = args[0] === 'install'
      const timeoutMs = isInstall ? 120000 : 30000

      const timeout = setTimeout(() => {
        timedOut = true
        proc.kill()
        reject(new Error(`Timeout after ${timeoutMs / 1000}s: adb ${args.join(' ')}. Emulator unresponsive - check adb devices and emulator status.`))
      }, timeoutMs)

      proc.stdout.on('data', (data) => {
        stdout += data.toString('utf8')
      })

      proc.stderr.on('data', (data) => {
        stderr += data.toString('utf8')
      })

      proc.on('exit', (code) => {
        clearTimeout(timeout)
        if (timedOut) return
        if (code === 0) {
          resolvePromise(stdout)
        } else {
          reject(new Error(stderr || `adb exited with code ${code}`))
        }
      })
    })
  }

  private async listPackages(): Promise<string[]> {
    return new Promise((resolvePromise, reject) => {
      const proc = spawn('adb', ['shell', 'pm', 'list', 'packages'])
      let stdout = ''
      let stderr = ''

      proc.stdout.on('data', (data) => {
        stdout += data.toString('utf8')
      })

      proc.stderr.on('data', (data) => {
        stderr += data.toString('utf8')
      })

      proc.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(stderr || `adb exited with code ${code}`))
          return
        }

        const packages = stdout
          .split('\n')
          .map(line => line.trim())
          .filter(Boolean)
          .map(line => line.replace('package:', ''))

        resolvePromise(packages)
      })
    })
  }

  private async setEmulatorProxy(proxy: string): Promise<void> {
    await this.runAdbCommand(['shell', 'settings', 'put', 'global', 'http_proxy', proxy])
  }

  private async clearEmulatorProxy(): Promise<void> {
    await this.runAdbCommand(['shell', 'settings', 'put', 'global', 'http_proxy', ':0'])
  }
}

export const apkRuntimeScanner = new ApkRuntimeScanner()
