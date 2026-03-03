#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Launch Media Link Extractor backend and frontend services
.DESCRIPTION
    Starts the backend (Express + Puppeteer) on port 3002 and frontend (Vite) on port 5001
.EXAMPLE
    .\start.ps1
#>

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting Media Link Extractor..." -ForegroundColor Cyan
Write-Host ""

# Check if ports are already in use
$backendPort = 3002
$frontendPort = 5001

$backendInUse = Get-NetTCPConnection -LocalPort $backendPort -State Listen -ErrorAction SilentlyContinue
$frontendInUse = Get-NetTCPConnection -LocalPort $frontendPort -State Listen -ErrorAction SilentlyContinue

if ($backendInUse) {
    Write-Host "⚠️  Port $backendPort is already in use (backend may already be running)" -ForegroundColor Yellow
} else {
    Write-Host "📦 Starting backend on port $backendPort..." -ForegroundColor Green
    Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; npm run dev" -WindowStyle Minimized
    Start-Sleep -Seconds 2
}

if ($frontendInUse) {
    Write-Host "⚠️  Port $frontendPort is already in use (frontend may already be running)" -ForegroundColor Yellow
} else {
    Write-Host "🎨 Starting frontend on port $frontendPort..." -ForegroundColor Green
    Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; npm run dev" -WindowStyle Minimized
    Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "⏳ Waiting for services to start..." -ForegroundColor Cyan
Start-Sleep -Seconds 3

# Verify services are running
Write-Host ""
Write-Host "🔍 Checking service status..." -ForegroundColor Cyan

$backendRunning = $false
$frontendRunning = $false

try {
    $null = Invoke-WebRequest -Uri "http://localhost:$backendPort/api/" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✅ Backend API: http://localhost:$backendPort" -ForegroundColor Green
    $backendRunning = $true
} catch {
    Write-Host "❌ Backend: Not responding on port $backendPort" -ForegroundColor Red
}

try {
    $null = Invoke-WebRequest -Uri "http://localhost:$frontendPort" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✅ Frontend UI: http://localhost:$frontendPort" -ForegroundColor Green
    $frontendRunning = $true
} catch {
    Write-Host "❌ Frontend: Not responding on port $frontendPort" -ForegroundColor Red
}

Write-Host ""
if ($backendRunning -and $frontendRunning) {
    Write-Host "🎉 All services started successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📖 Open your browser to: http://localhost:$frontendPort" -ForegroundColor Cyan
    Write-Host "📚 API Documentation: http://localhost:$backendPort/api/" -ForegroundColor Cyan
} else {
    Write-Host "⚠️  Some services failed to start. Check the output above." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "💡 Tip: Services are running in separate windows (minimized)" -ForegroundColor Gray
Write-Host "💡 To stop services, close those windows or use: .\stop.ps1" -ForegroundColor Gray
