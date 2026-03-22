$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent

# 1. 프론트엔드 정적 빌드
Write-Host "=== [1/3] 프론트엔드 빌드 ===" -ForegroundColor Cyan
Set-Location "$Root\frontend"
npm run build
if ($LASTEXITCODE -ne 0) { throw "프론트엔드 빌드 실패" }

# 2. 백엔드 PyInstaller 빌드
Write-Host "=== [2/3] 백엔드 빌드 ===" -ForegroundColor Cyan
Set-Location "$Root\backend"
& "$Root\.venv\Scripts\pyinstaller.exe" backend.spec --noconfirm
if ($LASTEXITCODE -ne 0) { throw "백엔드 빌드 실패" }

# 3. Electron 빌드
Write-Host "=== [3/3] Electron 빌드 ===" -ForegroundColor Cyan
Set-Location "$Root\electron"
npm install
npm run build
if ($LASTEXITCODE -ne 0) { throw "Electron 빌드 실패" }

Write-Host ""
Write-Host "=== 빌드 완료! ===" -ForegroundColor Green
Write-Host "설치파일: $Root\electron\dist\" -ForegroundColor Yellow
