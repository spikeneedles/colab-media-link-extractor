#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Stop Media Link Extractor backend and frontend services
.DESCRIPTION
    Kills processes listening on ports 3002 (backend) and 5001 (frontend)
.EXAMPLE
    .\stop.ps1
#>

$ErrorActionPreference = "Continue"

Write-Host "🛑 Stopping Media Link Extractor services..." -ForegroundColor Cyan
Write-Host ""

$backendPort = 3002
$frontendPort = 5001
$stopped = 0

# Stop backend
$backendConn = Get-NetTCPConnection -LocalPort $backendPort -State Listen -ErrorAction SilentlyContinue
if ($backendConn) {
    $processId = $backendConn.OwningProcess
    Write-Host "🔴 Stopping backend (PID: $processId)..." -ForegroundColor Yellow
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    $stopped++
} else {
    Write-Host "ℹ️  Backend is not running on port $backendPort" -ForegroundColor Gray
}

# Stop frontend
$frontendConn = Get-NetTCPConnection -LocalPort $frontendPort -State Listen -ErrorAction SilentlyContinue
if ($frontendConn) {
    $processId = $frontendConn.OwningProcess
    Write-Host "🔴 Stopping frontend (PID: $processId)..." -ForegroundColor Yellow
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    $stopped++
} else {
    Write-Host "ℹ️  Frontend is not running on port $frontendPort" -ForegroundColor Gray
}

Write-Host ""
if ($stopped -gt 0) {
    Write-Host "✅ Stopped $stopped service(s)" -ForegroundColor Green
} else {
    Write-Host "ℹ️  No services were running" -ForegroundColor Gray
}
