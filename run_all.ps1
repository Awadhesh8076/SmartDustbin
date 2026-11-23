# SmartDustbin - Simultaneous Full-Stack Launch Script
Write-Host "==================================================" -ForegroundColor Green
Write-Host "  Launching SmartDustbin Web Platform & Backend   " -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green

$WorkspaceRoot = $PSScriptRoot

# 1. Start FastAPI Backend in a separate window
Write-Host "[1/3] Launching FastAPI Backend on http://localhost:8000..." -ForegroundColor Cyan
Start-Process powershell.exe -ArgumentList "-NoExit", "-File", "`"$WorkspaceRoot\run_backend.ps1`""

Start-Sleep -Seconds 2

# 2. Start React Frontend in a separate window
Write-Host "[2/3] Launching React Vite Frontend on http://localhost:5173..." -ForegroundColor Cyan
Start-Process powershell.exe -ArgumentList "-NoExit", "-File", "`"$WorkspaceRoot\run_frontend.ps1`""

Start-Sleep -Seconds 3

# 3. Open Web Browser to SmartDustbin
Write-Host "[3/3] Opening default browser to http://localhost:5173..." -ForegroundColor Green
Start-Process "http://localhost:5173"

Write-Host "`nSmartDustbin is running! Both service windows are active." -ForegroundColor Yellow
Write-Host "Close the respective PowerShell windows to stop servers." -ForegroundColor DarkGray
