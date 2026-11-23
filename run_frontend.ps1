# SmartDustbin - Start React Frontend Server
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Starting SmartDustbin React Web Platform        " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$WorkspaceRoot = $PSScriptRoot
Set-Location -Path "$WorkspaceRoot\frontend"

Write-Host "[INFO] Frontend development server starting on: http://localhost:5173" -ForegroundColor Green
Write-Host "[INFO] Press Ctrl+C to terminate.`n" -ForegroundColor DarkGray

npm run dev
