# SmartDustbin - Start FastAPI Backend Server
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Starting SmartDustbin FastAPI Backend Engine    " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$WorkspaceRoot = $PSScriptRoot
Set-Location -Path "$WorkspaceRoot\backend"

$VenvPython = "$WorkspaceRoot\backend\venv\Scripts\python.exe"
if (-Not (Test-Path $VenvPython)) {
    Write-Host "[ERROR] Virtual environment python.exe not found at $VenvPython" -ForegroundColor Red
    Exit 1
}

Write-Host "[INFO] Backend running on: http://127.0.0.1:8000" -ForegroundColor Green
Write-Host "[INFO] Interactive API Docs: http://127.0.0.1:8000/docs" -ForegroundColor Yellow
Write-Host "[INFO] Press Ctrl+C to terminate the server.`n" -ForegroundColor DarkGray

& $VenvPython "$WorkspaceRoot\backend\run.py"
