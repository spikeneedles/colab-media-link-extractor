import fs from 'fs';

const file = 'src/components/ApkDeepScanner.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add Check Emulator button - insert before Start Runtime Capture button
const exactButtonMarker = `          <div className="flex flex-wrap gap-2">
            <Button onClick={handleStartRuntime} disabled={runtimeLoading}>`;

const withButton = `          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleCheckEmulator} disabled={runtimeLoading}>
              Check Emulator
            </Button>
            <Button onClick={handleStartRuntime} disabled={runtimeLoading}>`;

if (content.includes(exactButtonMarker)) {
  content = content.replace(exactButtonMarker, withButton);
  console.log('✓ Button added');
}

// 2. Add Emulator Status display - insert between buttons and URL list
const exactDisplayMarker = `            <Button variant="outline" onClick={handleRefreshRuntime} disabled={runtimeLoading}>
              Refresh Status
            </Button>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Captured Runtime URLs</h4>`;

const withDisplay = `            <Button variant="outline" onClick={handleRefreshRuntime} disabled={runtimeLoading}>
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

if (content.includes(exactDisplayMarker)) {
  content = content.replace(exactDisplayMarker, withDisplay);
  console.log('✓ Display added');
}

fs.writeFileSync(file, content, 'utf8');
console.log('✓ Complete');
