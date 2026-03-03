#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Create a desktop shortcut for Media Link Extractor launcher
.DESCRIPTION
    Creates a desktop shortcut that launches the Media Link Extractor application
.EXAMPLE
    .\create-shortcut.ps1
#>

param(
    [string]$ShortcutName = "Media Link Extractor"
)

try {
    # Get the desktop path
    $desktopPath = [System.IO.Path]::Combine([System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop))
    
    # Get the project root (parent directory of where this script is)
    $projectRoot = $PSScriptRoot
    
    # Path to the launcher script
    $launcherScript = Join-Path $projectRoot "launch.ps1"
    
    # Shortcut path
    $shortcutPath = Join-Path $desktopPath "$ShortcutName.lnk"
    
    # Verify launcher script exists
    if (-not (Test-Path $launcherScript)) {
        throw "Launcher script not found at: $launcherScript"
    }
    
    # Create COM object for Windows Shell
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    
    # Configure shortcut
    $shortcut.TargetPath = "powershell.exe"
    $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$launcherScript`""
    $shortcut.WorkingDirectory = $projectRoot
    $shortcut.WindowStyle = 1  # Normal window
    $shortcut.IconLocation = "C:\Windows\System32\cmd.exe,0"  # Use command prompt icon
    $shortcut.Description = "Launch Media Link Extractor (backend, frontend, and UI)"
    
    # Save the shortcut
    $shortcut.Save()
    
    Write-Host "[OK] Desktop shortcut created successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Shortcut Details:" -ForegroundColor Cyan
    Write-Host "   Name: $ShortcutName.lnk" -ForegroundColor White
    Write-Host "   Location: $shortcutPath" -ForegroundColor White
    Write-Host "   Target: PowerShell Launcher" -ForegroundColor White
    Write-Host ""
    Write-Host "[PIN] What the shortcut does:" -ForegroundColor Cyan
    Write-Host "   1. Starts the backend service (port 3002)" -ForegroundColor White
    Write-Host "   2. Waits 4 seconds for backend to initialize" -ForegroundColor White
    Write-Host "   3. Starts the frontend dev server (port 5001)" -ForegroundColor White
    Write-Host "   4. Opens the UI in your default browser" -ForegroundColor White
    Write-Host ""
    Write-Host "[TIP] The shortcut is ready to use! You can:" -ForegroundColor Gray
    Write-Host "   * Double-click it to launch the application" -ForegroundColor Gray
    Write-Host "   * Pin it to Start menu or Taskbar for quick access" -ForegroundColor Gray
    Write-Host "   * Rename it to customize the display name" -ForegroundColor Gray
    
}
catch {
    Write-Host "[ERROR] Error creating shortcut: $_" -ForegroundColor Red
    exit 1
}
