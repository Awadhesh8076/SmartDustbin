<#
.SYNOPSIS
  SmartDustbin - Complete Windows Local Network & Hardware Startup Script
.DESCRIPTION
  Activates Python virtual environment, launches FastAPI backend on 0.0.0.0:8000,
  starts Vite React frontend on 0.0.0.0:5173 for local and LAN access, detects the
  machine's local Wi-Fi IP address, and outputs interactive URLs.
#>

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$WorkspaceRoot = $PSScriptRoot
Set-Location -Path $WorkspaceRoot

Write-Host "`n=================================================================" -ForegroundColor Green
Write-Host "     SMARTDUSTBIN - LOCAL NETWORK & HARDWARE LAUNCHER            " -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green

# 1. Resolve Active Wi-Fi / Local Area Network IP Address
$HostName = [System.Net.Dns]::GetHostName()
$LanIP = [System.Net.Dns]::GetHostAddresses($HostName) | Where-Object {
    $_.AddressFamily -eq 'InterNetwork' -and
    $_.IPAddressToString -notlike '127.*' -and
    $_.IPAddressToString -notlike '169.254*'
} | Select-Object -ExpandProperty IPAddressToString -First 1

if (-not $LanIP) {
    $LanIP = "127.0.0.1"
}

Write-Host "`n[NETWORK DETECTED]" -ForegroundColor Cyan
Write-Host "  Laptop Hostname : $HostName" -ForegroundColor White
Write-Host "  Local Wi-Fi IP  : $LanIP" -ForegroundColor Yellow

# 2. Verify Backend Virtual Environment & Dependencies
$VenvPython = "$WorkspaceRoot\backend\venv\Scripts\python.exe"
if (-not (Test-Path $VenvPython)) {
    Write-Host "`n[ERROR] Virtual environment Python not found at: $VenvPython" -ForegroundColor Red
    Write-Host "Please create the venv with: python -m venv backend\venv" -ForegroundColor Yellow
    Exit 1
}

# 3. Start FastAPI Backend (0.0.0.0:8000)
Write-Host "`n[1/3] Starting FastAPI Backend Engine on 0.0.0.0:8000..." -ForegroundColor Cyan
Start-Process powershell.exe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", "`"$WorkspaceRoot\run_backend.ps1`""

Start-Sleep -Seconds 2

# 4. Start React Frontend Server (0.0.0.0:5173)
Write-Host "[2/3] Starting React Vite Platform on 0.0.0.0:5173..." -ForegroundColor Cyan
Start-Process powershell.exe -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", "`"$WorkspaceRoot\run_frontend.ps1`""

Start-Sleep -Seconds 3

# 5. Output Access Matrix
Write-Host "`n=================================================================" -ForegroundColor Green
Write-Host "             SMARTDUSTBIN ACCESS URLS                           " -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green
Write-Host "  Local Website     : http://localhost:5173" -ForegroundColor White
Write-Host "  LAN Website       : http://${LanIP}:5173" -ForegroundColor Yellow
Write-Host "  Backend Local API : http://localhost:8000" -ForegroundColor White
Write-Host "  Backend LAN API   : http://${LanIP}:8000" -ForegroundColor Yellow
Write-Host "  Swagger Docs (Loc): http://localhost:8000/docs" -ForegroundColor White
Write-Host "  Swagger Docs (LAN): http://${LanIP}:8000/docs" -ForegroundColor Yellow
Write-Host "-----------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "  ESP32-CAM Stream  : http://<CAM_DHCP_IP>/capture" -ForegroundColor Magenta
Write-Host "  ESP32 DevKit Sort : http://<DEVKIT_DHCP_IP>/status" -ForegroundColor Magenta
Write-Host "=================================================================" -ForegroundColor Green

# 6. Open Web Browser to SmartDustbin
Write-Host "`n[3/3] Opening default browser to http://localhost:5173..." -ForegroundColor Green
Start-Process "http://localhost:5173"

Write-Host "`n[INFO] Both service windows are now running in the background." -ForegroundColor Yellow
Write-Host "[INFO] Close each PowerShell window to stop the respective server.`n" -ForegroundColor DarkGray
