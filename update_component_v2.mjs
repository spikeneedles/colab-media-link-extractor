import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'src/components/ApkDeepScanner.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Add Check Emulator button before Start Runtime Capture button
const oldButtonSection = `          <div className="flex flex-wrap gap-2">
            <Button onClick={handleStartRuntime} disabled={runtimeLoading}>`;

const newButtonSection = `          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleCheckEmulator} disabled={runtimeLoading}>
              Check Emulator
            </Button>
            <Button onClick={handleStartRuntime} disabled={runtimeLoading}>`;

if (content.includes(oldButtonSection) && !content.includes('Check Emulator')) {
  content = content.replace(oldButtonSection, newButtonSection);
  console.log('✓ Added Check Emulator button');
}

// Add preflight result display after buttons
const oldDisplaySection = `            <Button variant="outline" onClick={handleRefreshRuntime} disabled={runtimeLoading}>
              Refresh Status
            </Button>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Captured Runtime URLs</h4>`;

const newDisplaySection = `            <Button variant="outline" onClick={handleRefreshRuntime} disabled={runtimeLoading}>
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

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Captured Runtime URLs</h4>`;

if (content.includes(oldDisplaySection) && !content.includes('Emulator Status')) {
  content = content.replace(oldDisplaySection, newDisplaySection);
  console.log('✓ Added preflight result display');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('✓ File updated successfully');
