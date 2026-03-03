# Prowlarr Indexer Test Script
param()
$script:ProwlarrUrl = "http://localhost:9696"
$script:ProwlarrApiKey = ""

# Try to load from both .env and backend/.env
foreach ($envFile in @(".env", "backend/.env")) {
    if (Test-Path $envFile) {
        Get-Content $envFile | ForEach-Object {
            if ($_ -match "^PROWLARR_API_KEY=(.*)$") {
                $script:ProwlarrApiKey = $Matches[1]
            }
            if ($_ -match "^PROWLARR_URL=(.*)$") {
                $script:ProwlarrUrl = $Matches[1]
            }
        }
        if ($ProwlarrApiKey) { break }
    }
}

Write-Host "Prowlarr Indexer Test Suite" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  URL: $ProwlarrUrl"
Write-Host "  API Key: $(if ($ProwlarrApiKey) { 'Configured' } else { 'Not configured' })"

Write-Host ""
Write-Host "Checking Prowlarr..." -ForegroundColor Yellow

$headers = @{"X-Api-Key" = $ProwlarrApiKey}

try {
    $null = Invoke-RestMethod -Uri "$ProwlarrUrl/api/v1/health" -Headers $headers -TimeoutSec 10
    Write-Host "Status: ONLINE" -ForegroundColor Green
} catch {
    Write-Host "Status: OFFLINE" -ForegroundColor Red
    Write-Host "Cannot connect to Prowlarr at $ProwlarrUrl" -ForegroundColor Red
    Write-Host "Make sure Prowlarr is running!" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Fetching indexers..." -ForegroundColor Yellow

try {
    $indexers = Invoke-RestMethod -Uri "$ProwlarrUrl/api/v1/indexer" -Headers $headers -TimeoutSec 10
    Write-Host "Found $($indexers.Count) indexers:" -ForegroundColor Green
    Write-Host ""
    
    foreach ($indexer in $indexers) {
        $status = if ($indexer.enable) { "ENABLED" } else { "DISABLED" }
        Write-Host "  - $($indexer.name) [$status]" -ForegroundColor Cyan
    }
} catch {
    Write-Host "Error fetching indexers: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Testing search..." -ForegroundColor Yellow
Write-Host "Query: Inception" -ForegroundColor Gray

try {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $results = Invoke-RestMethod -Uri "$ProwlarrUrl/api/v1/search" -Headers $headers -Body @{query = "Inception"; type = "search"} -TimeoutSec 60
    $sw.Stop()
    
    $count = if ($results -is [array]) { $results.Count } else { 1 }
    Write-Host "Results: $count found in $($sw.Elapsed.TotalSeconds)s" -ForegroundColor Green
    Write-Host ""
    
    if ($count -gt 0) {
        Write-Host "Top 5 results:" -ForegroundColor Yellow
        $sample = if ($results -is [array]) { $results[0..4] } else { @($results) }
        $i = 1
        foreach ($result in $sample) {
            Write-Host "  $i. $($result.title)" -ForegroundColor Cyan
            if ($result.size) {
                $mb = [math]::Round($result.size / 1MB, 2)
                Write-Host "     Size: $mb MB" -ForegroundColor Gray
            }
            if ($result.seeders) {
                Write-Host "     Seeders: $($result.seeders)" -ForegroundColor Gray
            }
            if ($result.indexer) {
                Write-Host "     Source: $($result.indexer)" -ForegroundColor Gray
            }
            Write-Host ""
            $i++
        }
    }
} catch {
    Write-Host "Error during search: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "Test Complete" -ForegroundColor Green
Write-Host ""
