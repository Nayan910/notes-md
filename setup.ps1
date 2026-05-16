# notes.md — Project Setup Script
# Run this in PowerShell to set up the development environment

Write-Host "=== notes.md Setup ===" -ForegroundColor Cyan

# 1. Add Flutter to PATH
$flutterPath = "E:\apps\flutter\flutter\bin"
if (Test-Path $flutterPath) {
  $env:Path = "$flutterPath;$env:Path"
  Write-Host "✓ Flutter SDK found at $flutterPath" -ForegroundColor Green
} else {
  Write-Host "✗ Flutter SDK not found at $flutterPath" -ForegroundColor Red
}

# 2. Check if Developer Mode is enabled (needed for Flutter build on Windows)
$devMode = (Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock" -Name AllowDevelopmentWithoutDevLicense -ErrorAction SilentlyContinue).AllowDevelopmentWithoutDevLicense
if ($devMode -eq 1) {
  Write-Host "✓ Windows Developer Mode is enabled" -ForegroundColor Green
} else {
  Write-Host "⚠ Windows Developer Mode is DISABLED" -ForegroundColor Yellow
  Write-Host "  Run: start ms-settings:developers" -ForegroundColor Yellow
  Write-Host "  Then toggle 'Developer Mode' ON" -ForegroundColor Yellow
}

# 3. Verify Node.js
$nodeVer = node --version
Write-Host "✓ Node.js $nodeVer" -ForegroundColor Green

# 4. Verify Python
$pyVer = python --version 2>&1
Write-Host "✓ $pyVer" -ForegroundColor Green

# 5. Install web editor deps (if needed)
$webDir = "E:\oprncode\project\apps\notes-md"
if (Test-Path "$webDir\node_modules") {
  Write-Host "✓ Web editor deps already installed" -ForegroundColor Green
} else {
  Write-Host "Installing web editor dependencies..." -ForegroundColor Yellow
  Set-Location $webDir
  npm install
}

# 6. Flutter pub get
$flutterDir = "E:\oprncode\project\apps\notes-md-app"
if (Test-Host "$flutterDir\.dart_tool") {
  Write-Host "✓ Flutter deps already installed" -ForegroundColor Green
} else {
  Write-Host "Getting Flutter dependencies..." -ForegroundColor Yellow
  Set-Location $flutterDir
  flutter pub get
}

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
Write-Host "Web editor:  cd apps/notes-md && npm run dev" -ForegroundColor White
Write-Host "Flutter app: cd apps/notes-md-app && flutter run -d windows" -ForegroundColor White
