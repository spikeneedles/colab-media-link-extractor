import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'src/components/ApkDeepScanner.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Add handleCheckEmulator function after runRuntimePreflight
const preflight = `
  const handleCheckEmulator = async () => {
    setRuntimeLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(\`\${backendUrl}/api/apk-runtime/preflight\`)
      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result.message || 'Failed to run emulator preflight check')
      }

      setPreflightResult(result.preflight)

      if (result.preflight?.adbOk) {
        if (result.preflight?.emulatorOk) {
          setSuccess(\`Emulator ready! Devices: \${result.preflight.devices.join(', ')}\`)
        } else {
          setError('No running emulator detected. Start an Android Studio AVD.')
        }
      } else {
        setError('Android Studio adb not found on PATH.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check emulator')
      setPreflightResult(null)
    } finally {
      setRuntimeLoading(false)
    }
  }`;

const marker1 = `  const handleStartRuntime = async () => {`;
if (content.includes(marker1) && !content.includes('handleCheckEmulator')) {
  content = content.replace(marker1, preflight + '\n\n  const handleStartRuntime = async () => {');
  console.log('✓ Added handleCheckEmulator function');
}

// Add Check Emulator button to UI
const buttonMarker = `          <div className="flex flex-wrap gap-2">
            <Button onClick={handleStartRuntime}`;
const buttonReplacement = `          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleCheckEmulator} disabled={runtimeLoading}>
              Check Emulator
            </Button>
            <Button onClick={handleStartRuntime}`;

if (content.includes(buttonMarker) && !content.includes('Check Emulator')) {
  content = content.replace(buttonMarker, buttonReplacement);
  console.log('✓ Added Check Emulator button');
}

// Add preflight result display
const displayMarker = `            <Button variant="outline" onClick={handleRefreshRuntime} disabled={runtimeLoading}>
              Refresh Status
            </Button>
          </div>

          <div className="space-y-2">`;
const displayReplacement = `            <Button variant="outline" onClick={handleRefreshRuntime} disabled={runtimeLoading}>
              Refresh Status
            </Button>
          </div>

          {preflightResult && (
            <div className="border rounded-lg p-3 bg-slate-50 dark:bg-slate-900 space-y-2">
              <h4 className="text-sm font-medium">Emulator Status</h4>
              <div className="text-xs space-y-1">
                <div>adb: {preflightResult.adbOk ? '✓ Found' : '✗ Not found'} {preflightResult.adbVersion && \`(\${preflightResult.adbVersion.split(' ')[0]})\`}</div>
                <div>Emulator: {preflightResult.emulatorOk ? '✓ Running' : '✗ Not running'}</div>
                {preflightResult.devices && preflightResult.devices.length > 0 && (
                  <div>Devices: {preflightResult.devices.join(', ')}</div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">`;

if (content.includes(displayMarker) && !content.includes('Emulator Status')) {
  content = content.replace(displayMarker, displayReplacement);
  console.log('✓ Added preflight result display');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('✓ File updated successfully');
