import fs from 'fs';

const file = 'src/components/ApkDeepScanner.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add Check Emulator button
const old1 = `          <div className="flex flex-wrap gap-2">
            <Button onClick={handleStartRuntime} disabled={runtimeLoading}>
              {runtimeLoading ? <ArrowClockwise className="w-4 h-4 mr-2 animate-spin" /> : null}
              Start Runtime Capture`;

const new1 = `          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleCheckEmulator} disabled={runtimeLoading}>
              Check Emulator
            </Button>
            <Button onClick={handleStartRuntime} disabled={runtimeLoading}>
              {runtimeLoading ? <ArrowClockwise className="w-4 h-4 mr-2 animate-spin" /> : null}
              Start Runtime Capture`;

if (content.includes(old1)) {
  content = content.replace(old1, new1);
  console.log('✓ Added button');
} else {
  console.log('✗ Button marker not found');
}

// Add preflight display
const old2 = `            </Button>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Captured Runtime URLs</h4>`;

const new2 = `            </Button>
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

if (content.includes(old2)) {
  content = content.replace(old2, new2);
  console.log('✓ Added display');
} else {
  console.log('✗ Display marker not found');
}

fs.writeFileSync(file, content, 'utf8');
console.log('✓ Done');
