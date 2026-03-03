#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Launch Media Link Extractor with automatic browser opening
.DESCRIPTION
    Starts backend, waits 4 seconds, starts frontend, then opens the UI in browser
.EXAMPLE
    .\launch.ps1
#>

$ErrorActionPreference = "SilentlyContinue"

Write-Host "[LAUNCHER] Media Link Extractor" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

$projectRoot = $PSScriptRoot
$backendPort = 3002
$frontendPort = 5001
$frontendUrl = "http://localhost:$frontendPort"

# Check if backend is already running
$backendRunning = Get-NetTCPConnection -LocalPort $backendPort -State Listen -ErrorAction SilentlyContinue

if ($backendRunning) {
    Write-Host "[OK] Backend already running on port $backendPort" -ForegroundColor Green
} else {
    Write-Host "[STARTING] Backend..." -ForegroundColor Cyan
    Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$projectRoot\backend'; npm run dev" -WindowStyle Minimized
    Write-Host "   Waiting 4 seconds for backend to initialize..." -ForegroundColor Yellow
    Start-Sleep -Seconds 4
}

Write-Host ""

# Check if frontend is already running
$frontendRunning = Get-NetTCPConnection -LocalPort $frontendPort -State Listen -ErrorAction SilentlyContinue

if ($frontendRunning) {
    Write-Host "[OK] Frontend already running on port $frontendPort" -ForegroundColor Green
} else {
    Write-Host "[STARTING] Frontend..." -ForegroundColor Cyan
    Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$projectRoot'; npm run dev" -WindowStyle Minimized
    Write-Host "   Waiting for frontend to be ready..." -ForegroundColor Yellow
    Start-Sleep -Seconds 3
}

Write-Host ""
Write-Host "[BROWSER] Opening Media Link Extractor UI..." -ForegroundColor Green
Start-Process "$frontendUrl"

Write-Host ""
Write-Host "[SUCCESS] All services launched successfully!" -ForegroundColor Green
Write-Host "   Frontend UI: $frontendUrl" -ForegroundColor Cyan
Write-Host "   Backend API: http://localhost:$backendPort" -ForegroundColor Cyan
Write-Host ""
Write-Host "[INFO] To stop services, close the terminal windows or run: .\stop.ps1" -ForegroundColor Gray

# Keep this window open for reference
Write-Host ""
Write-Host "[WAITING] Press Ctrl+C or close this window when done" -ForegroundColor Gray
Read-Host "Press Enter to keep launcher window open"
