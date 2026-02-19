import fs from 'fs';

const file = 'src/components/ApkDeepScanner.tsx';
let content = fs.readFileSync(file, 'utf8');

// Find and update the button section with multi-line precision
const buttonSection = `          <div className="flex flex-wrap gap-2">
            <Button onClick={handleStartRuntime} disabled={runtimeLoading}>
              {runtimeLoading ? <ArrowClockwise className="w-4 h-4 mr-2 animate-spin" /> : null}
              Start Runtime Capture
            </Button>`;

const newButtonSection = `          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleCheckEmulator} disabled={runtimeLoading}>
              Check Emulator
            </Button>
            <Button onClick={handleStartRuntime} disabled={runtimeLoading}>
              {runtimeLoading ? <ArrowClockwise className="w-4 h-4 mr-2 animate-spin" /> : null}
              Start Runtime Capture
            </Button>`;

content = content.replace(buttonSection, newButtonSection);

// Add status display
const displaySection = `          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Captured Runtime URLs</h4>`;

const newDisplaySection = `          </div>

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

content = content.replace(displaySection, newDisplaySection);

fs.writeFileSync(file, content, 'utf8');
console.log('✓ UI updated');
