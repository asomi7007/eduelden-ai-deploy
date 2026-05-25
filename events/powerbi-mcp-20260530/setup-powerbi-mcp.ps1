#Requires -Version 5.1
<#
.SYNOPSIS
    Power BI MCP Workshop - Student PC Auto-Setup Script
.DESCRIPTION
    Installs VS Code, Cline extension, Power BI Desktop, Node.js 22+,
    configures MCP servers (Power BI, Playwright, Filesystem) in Cline,
    sets up API connection via APIM, and downloads practice files.
.PARAMETER StudentId
    Student number (01-50)
.PARAMETER ApiKey
    APIM subscription key
.PARAMETER ApimUrl
    APIM base URL (default: https://apim-eduelden-ai.azure-api.net)
.PARAMETER PracticeFileUrl
    URL to download practice .pbix file
.PARAMETER SkipInstall
    Skip software installation (only configure)
.EXAMPLE
    .\setup-powerbi-mcp.ps1 -StudentId 01 -ApiKey "your-key-here"
#>
param(
    [Parameter(Mandatory=$true)]
    [ValidatePattern('^\d{2}$')]
    [string]$StudentId,

    [Parameter(Mandatory=$true)]
    [string]$ApiKey,

    [Parameter(Mandatory=$false)]
    [string]$ApimUrl = "https://apim-eduelden-ai.azure-api.net",

    [Parameter(Mandatory=$false)]
    [string]$PracticeFileUrl = "https://github.com/asomi7007/eduelden-ai-deploy/raw/main/events/powerbi-mcp-20260530/files/%EC%8B%A4%EC%8A%B5%ED%8C%8C%EC%9D%BC.pbix",

    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
$APIM_BASE_URL = $ApimUrl.TrimEnd('/')
$OPENAI_ENDPOINT = "$APIM_BASE_URL/openai"
$TOTAL_STEPS = 8
$totalTimer = [System.Diagnostics.Stopwatch]::StartNew()
$stepTimer  = [System.Diagnostics.Stopwatch]::new()

# --- Helper: Fix UTF-8 mojibake in paths (Korean usernames stored as Latin-1) ---
function Repair-Utf8MojibakePath([string]$Path) {
    if ([string]::IsNullOrWhiteSpace($Path) -or (Test-Path -LiteralPath $Path)) {
        return $Path
    }
    try {
        $latin1 = [System.Text.Encoding]::GetEncoding(28591)
        $candidate = [System.Text.Encoding]::UTF8.GetString($latin1.GetBytes($Path))
        if ($candidate -ne $Path -and (Test-Path -LiteralPath $candidate)) {
            return $candidate
        }
    } catch {}
    return $Path
}

# --- Desktop path (handles Korean usernames, OneDrive redirect, etc.) ---
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$DesktopPath = Repair-Utf8MojibakePath $DesktopPath
if (-not $DesktopPath -or -not (Test-Path $DesktopPath)) {
    try {
        $DesktopPath = (New-Object -ComObject Shell.Application).Namespace('shell:Desktop').Self.Path
        $DesktopPath = Repair-Utf8MojibakePath $DesktopPath
    } catch {}
}
if (-not $DesktopPath -or -not (Test-Path $DesktopPath)) {
    $candidates = @(
        "$env:USERPROFILE\Desktop",
        "$env:USERPROFILE\OneDrive\Desktop"
    )
    $DesktopPath = $candidates | ForEach-Object { Repair-Utf8MojibakePath $_ } | Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $DesktopPath -or -not (Test-Path $DesktopPath)) {
    $DesktopPath = "$env:USERPROFILE\Desktop"
    New-Item -ItemType Directory -Force -Path $DesktopPath | Out-Null
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  AI-Driven Power BI: MCP Workshop - Environment Setup" -ForegroundColor Cyan
Write-Host "  Date: 2026-05-30 | Student ID: $StudentId" -ForegroundColor Cyan
Write-Host "  Desktop: $DesktopPath" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# --- Helper: Check if command exists ---
function Test-CommandExists($cmd) {
    return [bool](Get-Command $cmd -ErrorAction SilentlyContinue)
}

# --- Helper: Write UTF-8 without BOM ---
function Write-Utf8NoBom($path, $content) {
    [System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))
}

# --- Helper: Format elapsed time ---
function Format-Elapsed($sw) {
    $ts = $sw.Elapsed
    if ($ts.TotalSeconds -lt 1)   { return "{0:N0}ms" -f $ts.TotalMilliseconds }
    if ($ts.TotalSeconds -lt 60)  { return "{0:N1}s"  -f $ts.TotalSeconds }
    return "{0}m {1:N0}s" -f [int][math]::Floor($ts.TotalMinutes), $ts.Seconds
}

# ===========================================================
# STEP 1: VS Code
# ===========================================================
$stepTimer.Restart()
if (-not $SkipInstall) {
    if (Test-CommandExists "code") {
        Write-Host "[1/$TOTAL_STEPS] VS Code already installed  ($(Format-Elapsed $stepTimer))" -ForegroundColor Green
    } else {
        Write-Host "[1/$TOTAL_STEPS] Installing VS Code..." -ForegroundColor Yellow
        $installer = "$env:TEMP\vscode-setup.exe"
        Invoke-WebRequest -Uri "https://code.visualstudio.com/sha/download?build=stable&os=win32-x64" -OutFile $installer
        Start-Process -FilePath $installer -ArgumentList "/verysilent /norestart /mergetasks=!runcode,addcontextmenufiles,addcontextmenufolders,associatewithfiles,addtopath" -Wait
        # Refresh PATH
        $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
        Write-Host "  VS Code installed  ($(Format-Elapsed $stepTimer))" -ForegroundColor Green
    }
} else {
    Write-Host "[1/$TOTAL_STEPS] Skipped (SkipInstall)  ($(Format-Elapsed $stepTimer))" -ForegroundColor Gray
}

# ===========================================================
# STEP 2: Cline Extension
# ===========================================================
$stepTimer.Restart()
if (-not $SkipInstall) {
    Write-Host "[2/$TOTAL_STEPS] Installing Cline extension..." -ForegroundColor Yellow
    code --install-extension saoudrizwan.claude-dev --force 2>$null
    Write-Host "  Cline extension installed  ($(Format-Elapsed $stepTimer))" -ForegroundColor Green
} else {
    Write-Host "[2/$TOTAL_STEPS] Skipped (SkipInstall)  ($(Format-Elapsed $stepTimer))" -ForegroundColor Gray
}

# ===========================================================
# STEP 3: Node.js 22+ (MCP servers require it)
# ===========================================================
$stepTimer.Restart()
if (-not $SkipInstall) {
    $nodeOk = $false
    if (Test-CommandExists "node") {
        $nodeVer = (node --version) -replace '^v', ''
        $major = [int]($nodeVer.Split('.')[0])
        if ($major -ge 22) {
            Write-Host "[3/$TOTAL_STEPS] Node.js $nodeVer already installed (>= 22)  ($(Format-Elapsed $stepTimer))" -ForegroundColor Green
            $nodeOk = $true
        }
    }
    if (-not $nodeOk) {
        Write-Host "[3/$TOTAL_STEPS] Installing Node.js 22 LTS..." -ForegroundColor Yellow
        if (Test-CommandExists "winget") {
            winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent 2>$null
        } else {
            # Fallback: direct download
            $nodeInstaller = "$env:TEMP\node-setup.msi"
            Invoke-WebRequest -Uri "https://nodejs.org/dist/v22.15.0/node-v22.15.0-x64.msi" -OutFile $nodeInstaller
            Start-Process -FilePath msiexec.exe -ArgumentList "/i `"$nodeInstaller`" /qn" -Wait
        }
        # Refresh PATH
        $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
        Write-Host "  Node.js installed  ($(Format-Elapsed $stepTimer))" -ForegroundColor Green
    }
} else {
    Write-Host "[3/$TOTAL_STEPS] Skipped (SkipInstall)  ($(Format-Elapsed $stepTimer))" -ForegroundColor Gray
}

# ===========================================================
# STEP 4: Power BI Desktop
# NOTE: 'winget install Microsoft.PowerBI' (winget source) is
# unreliable — it can install an unrelated "Cloud Managed
# Desktop Extension" package. Use the Microsoft Store ID
# (9NTXR16HNW1T) instead.
# ===========================================================
$stepTimer.Restart()
if (-not $SkipInstall) {
    # Check known install paths AND winget list for Store-installed version
    $pbiPaths = @(
        "${env:ProgramFiles}\Microsoft Power BI Desktop\bin\PBIDesktop.exe",
        "${env:ProgramFiles(x86)}\Microsoft Power BI Desktop\bin\PBIDesktop.exe",
        "$env:LOCALAPPDATA\Microsoft\WindowsApps\PBIDesktop.exe"
    )
    $pbiFound = $pbiPaths | Where-Object { Test-Path $_ } | Select-Object -First 1

    # If not found in paths, check winget list (catches Store installs)
    if (-not $pbiFound -and (Test-CommandExists "winget")) {
        $wingetList = winget list --id 9NTXR16HNW1T --source msstore 2>$null
        if ($LASTEXITCODE -eq 0 -and $wingetList -match "Power BI") {
            $pbiFound = "(Microsoft Store)"
        }
    }

    if ($pbiFound) {
        Write-Host "[4/$TOTAL_STEPS] Power BI Desktop already installed: $pbiFound  ($(Format-Elapsed $stepTimer))" -ForegroundColor Green
    } else {
        Write-Host "[4/$TOTAL_STEPS] Installing Power BI Desktop (Microsoft Store)..." -ForegroundColor Yellow
        $pbiInstalled = $false
        if (Test-CommandExists "winget") {
            $null = winget install --id 9NTXR16HNW1T --source msstore --accept-package-agreements --accept-source-agreements --silent 2>$null
            # Exit code 0 = installed, -1978335189 (0x8A150067) = already installed/no upgrade
            if ($LASTEXITCODE -eq 0 -or $LASTEXITCODE -eq -1978335189) { $pbiInstalled = $true }
        }
        if ($pbiInstalled) {
            Write-Host "  Power BI Desktop installed via Microsoft Store  ($(Format-Elapsed $stepTimer))" -ForegroundColor Green
        } else {
            Write-Host "  Auto-install could not complete. Please install manually:" -ForegroundColor Yellow
            Write-Host "    https://aka.ms/pbidesktopstore" -ForegroundColor Yellow
            Write-Host "    (Or: Microsoft Store > search 'Power BI Desktop')" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "[4/$TOTAL_STEPS] Skipped (SkipInstall)  ($(Format-Elapsed $stepTimer))" -ForegroundColor Gray
}

# ===========================================================
# STEP 5: API Configuration (config.json + env var)
# ===========================================================
$stepTimer.Restart()
Write-Host "[5/$TOTAL_STEPS] Creating API config..." -ForegroundColor Yellow

$configDir = "$env:USERPROFILE\.ai-class"
New-Item -ItemType Directory -Force -Path $configDir | Out-Null

$config = @{
    student_id = $StudentId
    event = "powerbi-mcp-20260530"
    apim_base_url = $APIM_BASE_URL
    models = @{
        "gpt-55" = @{
            endpoint = $OPENAI_ENDPOINT
            model_id = "gpt-55"
            description = "GPT-5.5 (high quality, slower)"
        }
        "gpt-54-mini" = @{
            endpoint = $OPENAI_ENDPOINT
            model_id = "gpt-54-mini"
            description = "GPT-5.4-mini (general purpose, fast)"
        }
    }
} | ConvertTo-Json -Depth 5

Write-Utf8NoBom "$configDir\config.json" $config
Write-Host "  Config: $configDir\config.json" -ForegroundColor Green

# Save API key as user environment variable
[System.Environment]::SetEnvironmentVariable("AI_CLASS_API_KEY", $ApiKey, "User")
$env:AI_CLASS_API_KEY = $ApiKey
Write-Host "  API Key saved to env: AI_CLASS_API_KEY  ($(Format-Elapsed $stepTimer))" -ForegroundColor Green

# ===========================================================
# STEP 6: Cline MCP Server Configuration
# NOTE: Cline (saoudrizwan.claude-dev) reads its MCP servers
# from VS Code's globalStorage, NOT from ~/.cline/data/.
# The API provider, key, and model are stored in VS Code's
# internal SQLite state DB and SecretStorage — those CANNOT
# be set by writing files. Only MCP settings are file-based;
# API config must be entered in the Cline UI (printed below).
# ===========================================================
$stepTimer.Restart()
Write-Host "[6/$TOTAL_STEPS] Configuring Cline MCP servers..." -ForegroundColor Yellow

$clineSettingsDir = "$env:APPDATA\Code\User\globalStorage\saoudrizwan.claude-dev\settings"
New-Item -ItemType Directory -Force -Path $clineSettingsDir | Out-Null

$mcpFile = "$clineSettingsDir\cline_mcp_settings.json"
if (Test-Path $mcpFile) {
    $mcp = Get-Content $mcpFile -Raw -Encoding UTF8 | ConvertFrom-Json
} else {
    $mcp = [PSCustomObject]@{
        mcpServers = [PSCustomObject]@{}
    }
}

# Ensure mcpServers property exists
if (-not ($mcp | Get-Member -Name "mcpServers" -MemberType NoteProperty)) {
    $mcp | Add-Member -NotePropertyName "mcpServers" -NotePropertyValue ([PSCustomObject]@{}) -Force
}

# FIX: Node.js ESM loader fails when npm cache path contains non-ASCII
# characters (e.g. Korean username C:\Users\허석\...). Redirect npm cache
# to an ASCII-safe path so npx-spawned MCP servers resolve modules correctly.
$npmCacheFix = "C:\npm-cache"
if (-not (Test-Path $npmCacheFix)) {
    New-Item -ItemType Directory -Force -Path $npmCacheFix | Out-Null
}
$mcpEnv = [PSCustomObject]@{ npm_config_cache = $npmCacheFix }

# --- Power BI MCP: Install exe directly (NOT npx) ---
# The generic @microsoft/powerbi-modeling-mcp wrapper writes "Detected platform..."
# to stdout before MCP JSON-RPC starts, corrupting Cline's stdio transport.
# Fix: install the platform-specific package and run the exe directly.
$powerBiMcpRoot = "C:\MCPServers\PowerBIModelingMCP"

# Detect ARM64 vs x64
$powerBiArch = "x64"
$powerBiPkg = "@microsoft/powerbi-modeling-mcp-win32-x64@latest"
if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64" -or $env:PROCESSOR_ARCHITEW6432 -eq "ARM64") {
    $powerBiArch = "arm64"
    $powerBiPkg = "@microsoft/powerbi-modeling-mcp-win32-arm64@latest"
}
$powerBiMcpExe = Join-Path $powerBiMcpRoot "node_modules\@microsoft\powerbi-modeling-mcp-win32-$powerBiArch\dist\powerbi-modeling-mcp.exe"

if (-not (Test-Path $powerBiMcpExe)) {
    Write-Host "  Installing Power BI MCP ($powerBiArch) exe..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path $powerBiMcpRoot | Out-Null
    $env:npm_config_cache = $npmCacheFix
    & npm install --prefix $powerBiMcpRoot $powerBiPkg 2>$null
    if (Test-Path $powerBiMcpExe) {
        Write-Host "  Power BI MCP exe installed: $powerBiMcpExe" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: Power BI MCP exe not found after install." -ForegroundColor Red
    }
} else {
    Write-Host "  Power BI MCP exe already installed" -ForegroundColor Green
}

# Power BI Modeling MCP Server — exe direct execution
# --start                  : required to launch the MCP server
# --readwrite              : allow model edits (alias of --read-write)
# --skip-confirmation      : suppress per-write confirmation prompts
# --compatibility=full     : PowerBI + Analysis Services + Fabric semantic models
$mcp.mcpServers | Add-Member -NotePropertyName "powerbi" -NotePropertyValue ([PSCustomObject]@{
    type = "stdio"
    command = $powerBiMcpExe.Replace('\', '\\')
    args = @("--start", "--readwrite", "--skip-confirmation", "--compatibility=full")
    env = [PSCustomObject]@{}
    timeout = 300
    disabled = $false
    autoApprove = @()
}) -Force

# Playwright MCP Server (official Microsoft package: @playwright/mcp)
# No stdout noise issue — npx via cmd.exe is safe here
$mcp.mcpServers | Add-Member -NotePropertyName "playwright" -NotePropertyValue ([PSCustomObject]@{
    command = "cmd.exe"
    args = @("/d", "/c", "npx", "-y", "@playwright/mcp@latest")
    env = $mcpEnv
    disabled = $false
    autoApprove = @()
}) -Force

# Filesystem MCP Server (official: @modelcontextprotocol/server-filesystem)
$mcp.mcpServers | Add-Member -NotePropertyName "filesystem" -NotePropertyValue ([PSCustomObject]@{
    command = "cmd.exe"
    args = @("/d", "/c", "npx", "-y", "@modelcontextprotocol/server-filesystem", $DesktopPath)
    env = $mcpEnv
    disabled = $false
    autoApprove = @()
}) -Force

Write-Utf8NoBom $mcpFile ($mcp | ConvertTo-Json -Depth 10)
Write-Host "  MCP settings: $mcpFile" -ForegroundColor Green
Write-Host "    - powerbi    : exe direct ($powerBiArch, no npx)" -ForegroundColor Gray
Write-Host "    - playwright : @playwright/mcp (cmd.exe + npx)" -ForegroundColor Gray
Write-Host "    - filesystem : @modelcontextprotocol/server-filesystem ($DesktopPath)  ($(Format-Elapsed $stepTimer))" -ForegroundColor Gray

# --- Manual API provider/key/model configuration (Cline UI) ---
# These cannot be written to disk: Cline stores them in VS Code's
# globalState (state.vscdb SQLite) and SecretStorage via the
# extension API. Print the values the user must paste in the UI
# and write a reference file to the desktop for easy access.
$clineReadme = Join-Path $DesktopPath "CLINE_API_SETUP.txt"
$clineReadmeBody = @"
Cline API Setup (manual — values cannot be auto-applied)
========================================================
1. Open VS Code -> click the Cline icon in the sidebar
2. Click the gear (Settings) -> API Configuration
3. Fill in the following:

   API Provider : OpenAI Compatible
   Base URL     : $APIM_BASE_URL/openai/v1
   API Key      : $ApiKey
   Model ID     : gpt-54-mini

4. Save. MCP servers (powerbi / playwright / filesystem) are
   already configured at:
   $mcpFile
"@
Write-Utf8NoBom $clineReadme $clineReadmeBody

Write-Host ""
Write-Host "  IMPORTANT: API provider/key/model must be set in the Cline UI." -ForegroundColor Yellow
Write-Host "  Values to paste (also saved to $clineReadme):" -ForegroundColor Yellow
Write-Host "    Provider : OpenAI Compatible" -ForegroundColor White
Write-Host "    Base URL : $APIM_BASE_URL/openai/v1" -ForegroundColor White
Write-Host "    API Key  : (from env AI_CLASS_API_KEY)" -ForegroundColor White
Write-Host "    Model    : gpt-54-mini" -ForegroundColor White

# ===========================================================
# STEP 7: Download Practice File (.pbix)
# ===========================================================
$stepTimer.Restart()
Write-Host "[7/$TOTAL_STEPS] Downloading practice file..." -ForegroundColor Yellow

$destFile = Join-Path $DesktopPath "practice.pbix"

if (Test-Path $destFile) {
    Write-Host "  Practice file already exists: $destFile  ($(Format-Elapsed $stepTimer))" -ForegroundColor Green
} else {
    try {
        Invoke-WebRequest -Uri $PracticeFileUrl -OutFile $destFile -TimeoutSec 60
        Write-Host "  Downloaded: $destFile  ($(Format-Elapsed $stepTimer))" -ForegroundColor Green
    } catch {
        Write-Host "  Download failed: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "  Please download manually from the onboarding email link" -ForegroundColor Yellow
    }
}

# ===========================================================
# STEP 8: Connection Test
# ===========================================================
$stepTimer.Restart()
Write-Host "[8/$TOTAL_STEPS] Testing API connection..." -ForegroundColor Yellow

$headers = @{
    "Content-Type"  = "application/json"
    "Authorization" = "Bearer $ApiKey"
}

$testBody = @{
    model = "gpt-54-mini"
    messages = @(@{ role = "user"; content = "Reply with exactly: Connection OK" })
    max_completion_tokens = 20
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$OPENAI_ENDPOINT/v1/chat/completions" `
        -Method POST -Headers $headers -Body $testBody -TimeoutSec 30
    $reply = $response.choices[0].message.content
    Write-Host "  API response: $reply  ($(Format-Elapsed $stepTimer))" -ForegroundColor Green
} catch {
    Write-Host "  Connection test failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  This may be normal if APIM is still deploying." -ForegroundColor Yellow
    Write-Host "  You can test manually later in Cline." -ForegroundColor Yellow
}

# ===========================================================
# DONE
# ===========================================================
$totalTimer.Stop()
$totalElapsed = Format-Elapsed $totalTimer
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Setup Complete!  (Total: $totalElapsed)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Installed:" -ForegroundColor White
Write-Host "    - VS Code + Cline extension" -ForegroundColor Gray
Write-Host "    - Node.js 22+ (for MCP servers)" -ForegroundColor Gray
Write-Host "    - Power BI Desktop" -ForegroundColor Gray
Write-Host ""
Write-Host "  Auto-configured:" -ForegroundColor White
Write-Host "    - Power BI MCP: exe direct (no npx, no stdout noise)" -ForegroundColor Gray
Write-Host "    - Cline MCP servers (powerbi, playwright, filesystem)" -ForegroundColor Gray
Write-Host "    - API reference file: $DesktopPath\CLINE_API_SETUP.txt" -ForegroundColor Gray
Write-Host ""
Write-Host "  Manual step required (cannot be scripted):" -ForegroundColor Yellow
Write-Host "    Open Cline -> Settings and paste:" -ForegroundColor White
Write-Host "      Provider : OpenAI Compatible" -ForegroundColor Gray
Write-Host "      Base URL : $APIM_BASE_URL/openai/v1" -ForegroundColor Gray
Write-Host "      API Key  : (from env AI_CLASS_API_KEY)" -ForegroundColor Gray
Write-Host "      Model    : gpt-54-mini" -ForegroundColor Gray
Write-Host ""
Write-Host "  Desktop: $DesktopPath" -ForegroundColor White
Write-Host "  Practice file: $destFile" -ForegroundColor White
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor Yellow
Write-Host "    1. Open VS Code (restart it if it was open during setup)" -ForegroundColor White
Write-Host "    2. Configure Cline API in the UI (see above)" -ForegroundColor White
Write-Host "    3. Open the practice file in Power BI Desktop" -ForegroundColor White
Write-Host "    4. In Cline, ask: 'Analyze the file open in Power BI Desktop'" -ForegroundColor White
Write-Host ""
