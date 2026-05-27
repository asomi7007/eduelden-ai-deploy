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
.PARAMETER WorkspacePath
    VS Code/Cline workspace folder. Do not use Desktop; Cline checkpoints
    are disabled in Desktop directories.
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

    [Parameter(Mandatory=$false)]
    [string]$WorkspacePath,

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

# Cline/VS Code often initializes tasks with the conventional English Desktop
# path even when Windows redirects the actual Desktop to OneDrive/Korean
# "바탕 화면". Make the conventional path exist so terminals and screenshots do
# not fail with "cwd C:\Users\...\Desktop does not exist".
$LegacyDesktopPath = "$env:USERPROFILE\Desktop"
if ($DesktopPath -and (Test-Path -LiteralPath $DesktopPath) -and $DesktopPath -ne $LegacyDesktopPath -and -not (Test-Path -LiteralPath $LegacyDesktopPath)) {
    try {
        New-Item -ItemType Junction -Path $LegacyDesktopPath -Target $DesktopPath -Force | Out-Null
        Write-Host "  Desktop compatibility path: $LegacyDesktopPath -> $DesktopPath" -ForegroundColor Gray
    } catch {
        New-Item -ItemType Directory -Force -Path $LegacyDesktopPath | Out-Null
        Write-Host "  Desktop compatibility directory created: $LegacyDesktopPath" -ForegroundColor Yellow
    }
}

# --- Cline workspace path ---
# Do not use Desktop as the Cline workspace. Cline intentionally disables
# checkpoints in Desktop directories, even when Git is installed.
$DocumentsPath = [Environment]::GetFolderPath("MyDocuments")
$DocumentsPath = Repair-Utf8MojibakePath $DocumentsPath
if (-not $DocumentsPath -or -not (Test-Path -LiteralPath $DocumentsPath)) {
    $DocumentsPath = "$env:USERPROFILE\Documents"
    New-Item -ItemType Directory -Force -Path $DocumentsPath | Out-Null
}
if ([string]::IsNullOrWhiteSpace($WorkspacePath)) {
    $WorkspacePath = Join-Path $DocumentsPath "New project 3"
}
$WorkspacePath = Repair-Utf8MojibakePath $WorkspacePath
if (-not (Test-Path -LiteralPath $WorkspacePath)) {
    New-Item -ItemType Directory -Force -Path $WorkspacePath | Out-Null
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  AI-Driven Power BI: MCP Workshop - Environment Setup" -ForegroundColor Cyan
Write-Host "  Date: 2026-05-30 | Student ID: $StudentId" -ForegroundColor Cyan
Write-Host "  Desktop: $DesktopPath" -ForegroundColor Cyan
Write-Host "  VS Code Workspace: $WorkspacePath" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# --- Helper: Check if command exists ---
function Test-CommandExists($cmd) {
    return [bool](Get-Command $cmd -ErrorAction SilentlyContinue)
}

# --- Helper: Return the first existing path from a candidate list ---
function Get-FirstExistingPath([string[]]$Paths) {
    foreach ($path in $Paths) {
        $repaired = Repair-Utf8MojibakePath $path
        if ($repaired -and (Test-Path -LiteralPath $repaired)) {
            return $repaired
        }
    }
    return $null
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
# STEP 2: Cline Extension + Markdownlint Extension
# ===========================================================
$stepTimer.Restart()
if (-not $SkipInstall) {
    Write-Host "[2/$TOTAL_STEPS] Installing VS Code extensions (Cline, markdownlint)..." -ForegroundColor Yellow
    code --install-extension saoudrizwan.claude-dev --force 2>$null
    code --install-extension DavidAnson.vscode-markdownlint --force 2>$null
    Write-Host "  Cline + markdownlint extensions installed  ($(Format-Elapsed $stepTimer))" -ForegroundColor Green
} else {
    Write-Host "[2/$TOTAL_STEPS] Skipped (SkipInstall)  ($(Format-Elapsed $stepTimer))" -ForegroundColor Gray
}

# VS Code terminal defaults for Cline command execution. Cline shell
# integration is most reliable when the default profile is an explicitly
# supported shell and shell integration is enabled.
$vsCodeSettingsFile = "$env:APPDATA\Code\User\settings.json"
$vsCodeSettingsDir = Split-Path -Parent $vsCodeSettingsFile
New-Item -ItemType Directory -Force -Path $vsCodeSettingsDir | Out-Null
try {
    if (Test-Path -LiteralPath $vsCodeSettingsFile) {
        $vsCodeSettings = Get-Content -LiteralPath $vsCodeSettingsFile -Raw -Encoding UTF8 | ConvertFrom-Json
    } else {
        $vsCodeSettings = [PSCustomObject]@{}
    }
} catch {
    $vsCodeSettings = [PSCustomObject]@{}
}
$vsCodeSettings | Add-Member -NotePropertyName "terminal.integrated.defaultProfile.windows" -NotePropertyValue "PowerShell" -Force
$vsCodeSettings | Add-Member -NotePropertyName "terminal.integrated.shellIntegration.enabled" -NotePropertyValue $true -Force
$vsCodeSettings | Add-Member -NotePropertyName "terminal.integrated.automationProfile.windows" -NotePropertyValue ([PSCustomObject]@{
    path = "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
    args = @("-NoLogo")
}) -Force
$vsCodeSettings | Add-Member -NotePropertyName "terminal.integrated.profiles.windows" -NotePropertyValue ([PSCustomObject]@{
    PowerShell = [PSCustomObject]@{
        source = "PowerShell"
        icon = "terminal-powershell"
    }
}) -Force
Write-Utf8NoBom $vsCodeSettingsFile ($vsCodeSettings | ConvertTo-Json -Depth 10)
Write-Host "      VS Code terminal profile configured: PowerShell + shell integration" -ForegroundColor Green

# ===========================================================
# STEP 2.5: Git (Cline checkpoints require it)
# ===========================================================
if (-not $SkipInstall) {
    if (Test-CommandExists "git") {
        Write-Host "      Git already installed: $(git --version)  ($(Format-Elapsed $stepTimer))" -ForegroundColor Green
    } else {
        Write-Host "      Installing Git for Cline checkpoints..." -ForegroundColor Yellow
        if (Test-CommandExists "winget") {
            winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements --silent 2>$null
        } else {
            $gitInstaller = "$env:TEMP\git-setup.exe"
            $gitRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/git-for-windows/git/releases/latest" -TimeoutSec 30
            $gitAsset = $gitRelease.assets | Where-Object { $_.name -match '^Git-.*-64-bit\.exe$' } | Select-Object -First 1
            if (-not $gitAsset) { throw "Could not find latest Git for Windows 64-bit installer asset." }
            Invoke-WebRequest -Uri $gitAsset.browser_download_url -OutFile $gitInstaller
            Start-Process -FilePath $gitInstaller -ArgumentList "/VERYSILENT /NORESTART /NOCANCEL /SP-" -Wait
        }
        $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
        if (Test-CommandExists "git") {
            Write-Host "      Git installed: $(git --version)" -ForegroundColor Green
        } else {
            $gitCmdDir = "C:\Program Files\Git\cmd"
            $gitExe = Join-Path $gitCmdDir "git.exe"
            if (Test-Path -LiteralPath $gitExe) {
                $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
                $pathParts = @($userPath -split ';' | Where-Object { $_ })
                if (-not ($pathParts | Where-Object { $_.TrimEnd('\') -ieq $gitCmdDir.TrimEnd('\') })) {
                    $newUserPath = if ([string]::IsNullOrWhiteSpace($userPath)) { $gitCmdDir } else { "$userPath;$gitCmdDir" }
                    [System.Environment]::SetEnvironmentVariable("Path", $newUserPath, "User")
                }
                $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
                Write-Host "      Git installed and added to user PATH: $(& $gitExe --version)" -ForegroundColor Green
            } else {
                Write-Host "      WARNING: Git install finished but git.exe was not found. Restart VS Code/PowerShell or install Git manually." -ForegroundColor Yellow
            }
        }
    }
}

# Initialize the workspace as a Git repository so Cline checkpoints can work.
# This is intentionally not done in Desktop, where Cline disables checkpoints.
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
if (Test-CommandExists "git") {
    if (-not (Test-Path -LiteralPath (Join-Path $WorkspacePath ".git"))) {
        git -C $WorkspacePath init 2>$null | Out-Null
        git -C $WorkspacePath config user.name "Cline Checkpoints" 2>$null
        git -C $WorkspacePath config user.email "cline-checkpoints@example.local" 2>$null
        Write-Host "      Git workspace initialized for Cline checkpoints: $WorkspacePath" -ForegroundColor Green
    } else {
        Write-Host "      Git workspace already initialized: $WorkspacePath" -ForegroundColor Green
    }
    git -C $WorkspacePath config user.name "Cline Checkpoints" 2>$null
    git -C $WorkspacePath config user.email "cline-checkpoints@example.local" 2>$null
    git -C $WorkspacePath rev-parse --verify HEAD 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        git -C $WorkspacePath commit --allow-empty -m "Initial workspace for Cline checkpoints" 2>$null | Out-Null
        Write-Host "      Git initial checkpoint commit created" -ForegroundColor Green
    }
} else {
    Write-Host "      WARNING: Git is unavailable; Cline checkpoints may not work until VS Code/PowerShell is restarted." -ForegroundColor Yellow
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

# Playwright MCP currently defaults to the Chrome channel on Windows. Some
# student PCs only have Microsoft Edge, so detect an installed browser and pass
# it explicitly instead of letting Playwright fail at first use.
$chromePath = Get-FirstExistingPath @(
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
)
$edgePath = Get-FirstExistingPath @(
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
)

if (-not $chromePath -and -not $edgePath -and -not $SkipInstall -and (Test-CommandExists "winget")) {
    Write-Host "  Installing Google Chrome for Playwright MCP..." -ForegroundColor Yellow
    $null = winget install --id Google.Chrome --source winget --accept-package-agreements --accept-source-agreements --silent 2>$null
    $chromePath = Get-FirstExistingPath @(
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
    )
}

$playwrightBrowserArgs = @()
$playwrightBrowserLabel = "default"
if ($chromePath) {
    $playwrightBrowserArgs = @("--browser", "chrome")
    $playwrightBrowserLabel = "chrome ($chromePath)"
} elseif ($edgePath) {
    $playwrightBrowserArgs = @("--browser", "msedge")
    $playwrightBrowserLabel = "msedge ($edgePath)"
} else {
    Write-Host "  WARNING: Chrome/Edge was not found. Playwright MCP may fail until a browser is installed." -ForegroundColor Red
    Write-Host "           Install Chrome manually or run: winget install --id Google.Chrome --source winget" -ForegroundColor Yellow
}

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
    # npm writes "npm notice" to stderr; with $ErrorActionPreference=Stop
    # PowerShell treats ANY stderr output as a terminating error.
    # Merge stderr into stdout and discard to prevent false failure.
    try { & npm install --prefix $powerBiMcpRoot $powerBiPkg 2>&1 | Out-Null } catch {}
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
    type = "stdio"
    command = "cmd.exe"
    args = @("/d", "/c", "npx", "-y", "@playwright/mcp@latest") + $playwrightBrowserArgs
    env = $mcpEnv
    timeout = 60
    disabled = $false
    autoApprove = @()
}) -Force

# Filesystem MCP Server (official: @modelcontextprotocol/server-filesystem)
# Allows access to both Desktop (practice file) and Workspace (Cline project)
$mcp.mcpServers | Add-Member -NotePropertyName "filesystem" -NotePropertyValue ([PSCustomObject]@{
    type = "stdio"
    command = "cmd.exe"
    args = @("/d", "/c", "npx", "-y", "@modelcontextprotocol/server-filesystem", $DesktopPath, $WorkspacePath)
    env = $mcpEnv
    timeout = 60
    disabled = $false
    autoApprove = @()
}) -Force

Write-Utf8NoBom $mcpFile ($mcp | ConvertTo-Json -Depth 10)
Write-Host "  MCP settings: $mcpFile" -ForegroundColor Green
Write-Host "    - powerbi    : exe direct ($powerBiArch, no npx)" -ForegroundColor Gray
Write-Host "    - playwright : @playwright/mcp (cmd.exe + npx, browser: $playwrightBrowserLabel)" -ForegroundColor Gray
Write-Host "    - filesystem : @modelcontextprotocol/server-filesystem ($DesktopPath, $WorkspacePath)  ($(Format-Elapsed $stepTimer))" -ForegroundColor Gray

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

Workspace note:
   Open this folder in VS Code before starting Cline tasks:
   $WorkspacePath

   Do not start Cline from Desktop. Cline disables checkpoints in
   Desktop directories.

Image note:
   gpt-54-mini supports image input through the API, but Cline can only
   analyze an image when the image is attached to the chat or returned by
   an MCP/browser tool. A plain file path in terminal output is not enough.
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

    # Vision smoke test: verify image inputs reach the selected model through APIM.
    try {
        Add-Type -AssemblyName System.Drawing
        $bmp = New-Object System.Drawing.Bitmap 80, 40
        $gfx = [System.Drawing.Graphics]::FromImage($bmp)
        $gfx.Clear([System.Drawing.Color]::White)
        $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::Red)
        $gfx.FillRectangle($brush, 8, 8, 64, 24)
        $ms = New-Object System.IO.MemoryStream
        $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $imageBase64 = [Convert]::ToBase64String($ms.ToArray())
        $gfx.Dispose(); $brush.Dispose(); $bmp.Dispose(); $ms.Dispose()

        $visionBody = @{
            model = "gpt-54-mini"
            messages = @(@{
                role = "user"
                content = @(
                    @{ type = "text"; text = "Look at the image. Reply with exactly one English color word." },
                    @{ type = "image_url"; image_url = @{ url = "data:image/png;base64,$imageBase64" } }
                )
            })
            max_completion_tokens = 30
        } | ConvertTo-Json -Depth 8

        $visionResponse = Invoke-RestMethod -Uri "$OPENAI_ENDPOINT/v1/chat/completions" `
            -Method POST -Headers $headers -Body $visionBody -TimeoutSec 30
        $visionReply = ($visionResponse.choices[0].message.content).Trim()
        Write-Host "  Vision response: $visionReply" -ForegroundColor Green
    } catch {
        Write-Host "  Vision test warning: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "  Text API works, but image input should be tested manually in Cline." -ForegroundColor Yellow
    }
} catch {
    Write-Host "  Connection test failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  This may be normal if APIM is still deploying." -ForegroundColor Yellow
    Write-Host "  You can test manually later in Cline." -ForegroundColor Yellow
}

# Open VS Code with the workspace folder (not Desktop)
if (Test-CommandExists "code") {
    try {
        code -r $WorkspacePath 2>$null
        Write-Host "  VS Code workspace opened: $WorkspacePath" -ForegroundColor Green
    } catch {
        Write-Host "  Could not auto-open VS Code workspace: $($_.Exception.Message)" -ForegroundColor Yellow
    }
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
Write-Host "    - Git (for Cline checkpoints)" -ForegroundColor Gray
Write-Host ""
Write-Host "  Auto-configured:" -ForegroundColor White
Write-Host "    - Power BI MCP: exe direct (no npx, no stdout noise)" -ForegroundColor Gray
Write-Host "    - Playwright MCP: browser auto-detected ($playwrightBrowserLabel)" -ForegroundColor Gray
Write-Host "    - Cline MCP servers (powerbi, playwright, filesystem)" -ForegroundColor Gray
Write-Host "    - VS Code terminal: PowerShell + shell integration" -ForegroundColor Gray
Write-Host "    - Cline workspace: $WorkspacePath (Git initialized)" -ForegroundColor Gray
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
Write-Host "  VS Code workspace: $WorkspacePath" -ForegroundColor White
Write-Host "  Practice file: $destFile" -ForegroundColor White
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor Yellow
Write-Host "    1. VS Code should have opened with workspace: $WorkspacePath" -ForegroundColor White
Write-Host "       (If not, open VS Code and open this folder manually)" -ForegroundColor Gray
Write-Host "    2. Configure Cline API in the UI (see above)" -ForegroundColor White
Write-Host "    3. Open the practice file in Power BI Desktop" -ForegroundColor White
Write-Host "    4. In Cline, ask: 'Analyze the file open in Power BI Desktop'" -ForegroundColor White
Write-Host ""
Write-Host "  IMPORTANT: Do NOT start Cline from Desktop." -ForegroundColor Red
Write-Host "  Cline disables checkpoints in Desktop directories." -ForegroundColor Red
Write-Host "  Always use the workspace folder above." -ForegroundColor Red
Write-Host ""
