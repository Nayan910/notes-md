# setup-android.ps1
# Installs Android SDK command-line tools for Flutter Android builds.
# No Android Studio required - just the CLI tools + platform SDK.

param(
    [string]$InstallDir = "E:\apps\android-sdk"
)

$ErrorActionPreference = "Stop"

Write-Host "=== notes.md - Android SDK Setup ===" -ForegroundColor Cyan
Write-Host ""

# Create install directory
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
Set-Location -LiteralPath $InstallDir

# 1. Download Android SDK command-line tools
$cmdlineToolsUrl = "https://dl.google.com/android/repository/commandlinetools-win-latest.zip"
$zipPath = "$InstallDir\cmdline-tools.zip"

if (-not (Test-Path $zipPath)) {
    Write-Host "Downloading Android SDK command-line tools..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri $cmdlineToolsUrl -OutFile $zipPath
    Write-Host "Downloaded." -ForegroundColor Green
} else {
    Write-Host "Command-line tools zip already exists." -ForegroundColor Gray
}

# 2. Extract cmdline-tools
$toolsDir = "$InstallDir\cmdline-tools"
if (-not (Test-Path "$toolsDir\latest\bin\sdkmanager.bat")) {
    Write-Host "Extracting command-line tools..." -ForegroundColor Yellow
    Expand-Archive -Path $zipPath -DestinationPath "$InstallDir\tmp" -Force
    New-Item -ItemType Directory -Path $toolsDir -Force | Out-Null
    Move-Item -Path "$InstallDir\tmp\cmdline-tools\*" -Destination "$toolsDir\latest\" -Force
    Remove-Item -Path "$InstallDir\tmp" -Recurse -Force
    Write-Host "Extracted." -ForegroundColor Green
} else {
    Write-Host "Command-line tools already extracted." -ForegroundColor Gray
}

# 3. Set JAVA_HOME if not already set
if (-not $env:JAVA_HOME) {
    Write-Host "WARNING: JAVA_HOME not set." -ForegroundColor Yellow
    Write-Host "Install JDK 17 from: https://adoptium.net/temurin/releases/?version=17" -ForegroundColor Yellow
    Write-Host "Then set: [Environment]::SetEnvironmentVariable('JAVA_HOME', 'C:\Program Files\Eclipse Adoptium\jdk-17.0.xx-hotspot', 'User')" -ForegroundColor Yellow
}

# 4. Install Android SDK components
$sdkManager = "$toolsDir\latest\bin\sdkmanager.bat"
if (Test-Path $sdkManager) {
    Write-Host "Installing Android SDK components (platforms, build-tools)..." -ForegroundColor Yellow
    
    # Accept licenses
    cmd /c "echo y | `"$sdkManager`" --install `"platforms;android-35`"" 2>&1 | Out-Null
    cmd /c "echo y | `"$sdkManager`" --install `"build-tools;35.0.0`"" 2>&1 | Out-Null
    cmd /c "echo y | `"$sdkManager`" --install `"platform-tools`"" 2>&1 | Out-Null
    
    Write-Host "Android SDK components installed." -ForegroundColor Green
} else {
    Write-Host "sdkmanager.bat not found at $sdkManager" -ForegroundColor Red
}

# 5. Configure Flutter to use the Android SDK
$env:ANDROID_HOME = $InstallDir
$env:ANDROID_SDK_ROOT = $InstallDir
$env:PATH = "$InstallDir\platform-tools;$InstallDir\cmdline-tools\latest\bin;$env:PATH"

Write-Host ""
Write-Host "=== Post-Setup Instructions ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Run these in PowerShell to set environment variables for this session:"
Write-Host "  `$env:ANDROID_HOME = '$InstallDir'" -ForegroundColor Green
Write-Host "  `$env:ANDROID_SDK_ROOT = '$InstallDir'" -ForegroundColor Green
Write-Host "  `$env:PATH = '$InstallDir\platform-tools;' + `$env:PATH" -ForegroundColor Green
Write-Host ""
Write-Host "Then run Flutter doctor to verify:"
Write-Host "  flutter doctor --android-licenses" -ForegroundColor Yellow
Write-Host "  flutter doctor" -ForegroundColor Yellow
Write-Host ""
Write-Host "Then build the APK:" -ForegroundColor Cyan
Write-Host "  cd apps/notes-md-app" -ForegroundColor Green
Write-Host "  flutter build apk --debug" -ForegroundColor Green
Write-Host ""
