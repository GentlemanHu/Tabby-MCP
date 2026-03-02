# ============================================
# Tabby MCP Plugin Installation Script
# Downloads pre-built release from GitHub
# Platform: Windows (PowerShell)
# ============================================

$ErrorActionPreference = "Stop"

$Repo = "GentlemanHu/Tabby-MCP"
$PluginName = "tabby-mcp-server"
$ApiUrl = "https://api.github.com/repos/$Repo/releases"
$TabbyPluginDir = Join-Path $env:APPDATA "tabby\plugins\node_modules\$PluginName"

Write-Host ""
Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Blue
Write-Host "║       Tabby MCP Plugin Installer         ║" -ForegroundColor Blue
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Blue
Write-Host ""

# Get latest release (supports both stable and prerelease)
Write-Host "🔍 Fetching latest release info..." -ForegroundColor Yellow

try {
    $AllReleases = Invoke-RestMethod -Uri $ApiUrl -Headers @{"User-Agent"="PowerShell"}
    
    # Get the first release (latest, whether prerelease or not)
    $LatestRelease = $AllReleases[0]
    $Version = $LatestRelease.tag_name
    $IsPrerelease = $LatestRelease.prerelease
    
    # Find zip asset
    $ZipAsset = $LatestRelease.assets | Where-Object { $_.name -like "*.zip" } | Select-Object -First 1
    
    if (-not $ZipAsset) {
        Write-Host "❌ No zip release found. Check: https://github.com/$Repo/releases" -ForegroundColor Red
        exit 1
    }
    
    $DownloadUrl = $ZipAsset.browser_download_url
    
    if ($IsPrerelease) {
        Write-Host "✓ Found version: $Version (pre-release)" -ForegroundColor Green
    } else {
        Write-Host "✓ Found version: $Version" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Failed to fetch release info: $_" -ForegroundColor Red
    exit 1
}

# Download
Write-Host "📥 Downloading..." -ForegroundColor Yellow

$TempDir = New-TemporaryFile | ForEach-Object { Remove-Item $_; New-Item -ItemType Directory -Path $_ }
$ZipFile = Join-Path $TempDir "tabby-mcp-server.zip"

try {
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $ZipFile -UseBasicParsing
    Write-Host "✓ Downloaded" -ForegroundColor Green
} catch {
    Write-Host "❌ Download failed: $_" -ForegroundColor Red
    Remove-Item -Recurse -Force $TempDir
    exit 1
}

# Extract
Write-Host "📦 Extracting..." -ForegroundColor Yellow

$ExtractDir = Join-Path $TempDir "extracted"
Expand-Archive -Path $ZipFile -DestinationPath $ExtractDir

# Find extracted folder - support both "tabby-mcp-server" (new) and "tabby-mcp" (old releases)
$SourceDir = Get-ChildItem -Path $ExtractDir -Directory | Where-Object { $_.Name -eq "tabby-mcp-server" } | Select-Object -First 1

if (-not $SourceDir) {
    $SourceDir = Get-ChildItem -Path $ExtractDir -Directory | Where-Object { $_.Name -eq "tabby-mcp" } | Select-Object -First 1
}

# Last resort: find any directory containing package.json
if (-not $SourceDir) {
    $SourceDir = Get-ChildItem -Path $ExtractDir -Directory | Where-Object { Test-Path (Join-Path $_.FullName "package.json") } | Select-Object -First 1
}

if (-not $SourceDir) {
    Write-Host "❌ Extraction failed - could not find plugin files" -ForegroundColor Red
    Write-Host "Archive contents:"
    Get-ChildItem -Path $ExtractDir -Recurse | Select-Object FullName | Format-Table
    Remove-Item -Recurse -Force $TempDir
    exit 1
}

Write-Host "✓ Extracted" -ForegroundColor Green

# Install
Write-Host "📁 Installing to Tabby plugins..." -ForegroundColor Yellow

New-Item -ItemType Directory -Force -Path $TabbyPluginDir | Out-Null

$DistPath = Join-Path $SourceDir.FullName "dist"
if (Test-Path $DistPath) {
    Copy-Item -Path $DistPath -Destination $TabbyPluginDir -Recurse -Force
}

$PkgJsonPath = Join-Path $SourceDir.FullName "package.json"
if (Test-Path $PkgJsonPath) {
    Copy-Item -Path $PkgJsonPath -Destination $TabbyPluginDir -Force
}

$TypingsPath = Join-Path $SourceDir.FullName "typings"
if (Test-Path $TypingsPath) {
    Copy-Item -Path $TypingsPath -Destination $TabbyPluginDir -Recurse -Force
}

# Cleanup
Remove-Item -Recurse -Force $TempDir

Write-Host "✓ Installed successfully" -ForegroundColor Green
Write-Host ""

Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║     ✅ Plugin installed successfully!    ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Version:  $Version" -ForegroundColor Cyan
Write-Host "Location: $TabbyPluginDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔄 Please restart Tabby to load the plugin." -ForegroundColor Yellow
Write-Host ""
Write-Host "📋 After restart, go to Settings → MCP to configure." -ForegroundColor Blue
Write-Host ""
