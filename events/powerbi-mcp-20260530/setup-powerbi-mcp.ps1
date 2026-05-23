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

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  AI-Driven Power BI: MCP Workshop - Environment Setup" -ForegroundColor Cyan
Write-Host "  Date: 2026-05-30 | Student ID: $StudentId" -ForegroundColor Cyan
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

# ===========================================================
# STEP 1: VS Code
# ===========================================================
if (-not $SkipInstall) {
    if (Test-CommandExists "code") {
        Write-Host "[1/$TOTAL_STEPS] VS Code already installed" -ForegroundColor Green
    } else {
        Write-Host "[1/$TOTAL_STEPS] Installing VS Code..." -ForegroundColor Yellow
        $installer = "$env:TEMP\vscode-setup.exe"
        Invoke-WebRequest -Uri "https://code.visualstudio.com/sha/download?build=stable&os=win32-x64" -OutFile $installer
        Start-Process -FilePath $installer -ArgumentList "/verysilent /norestart /mergetasks=!runcode,addcontextmenufiles,addcontextmenufolders,associatewithfiles,addtopath" -Wait
        # Refresh PATH
        $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
        Write-Host "  VS Code installed" -ForegroundColor Green
    }
} else {
    Write-Host "[1/$TOTAL_STEPS] Skipped (SkipInstall)" -ForegroundColor Gray
}

# ===========================================================
# STEP 2: Cline Extension
# ===========================================================
if (-not $SkipInstall) {
    Write-Host "[2/$TOTAL_STEPS] Installing Cline extension..." -ForegroundColor Yellow
    code --install-extension saoudrizwan.claude-dev --force 2>$null
    Write-Host "  Cline extension installed" -ForegroundColor Green
} else {
    Write-Host "[2/$TOTAL_STEPS] Skipped (SkipInstall)" -ForegroundColor Gray
}

# ===========================================================
# STEP 3: Node.js 22+ (MCP servers require it)
# ===========================================================
if (-not $SkipInstall) {
    $nodeOk = $false
    if (Test-CommandExists "node") {
        $nodeVer = (node --version) -replace '^v', ''
        $major = [int]($nodeVer.Split('.')[0])
        if ($major -ge 22) {
            Write-Host "[3/$TOTAL_STEPS] Node.js $nodeVer already installed (>= 22)" -ForegroundColor Green
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
        Write-Host "  Node.js installed" -ForegroundColor Green
    }
} else {
    Write-Host "[3/$TOTAL_STEPS] Skipped (SkipInstall)" -ForegroundColor Gray
}

# ===========================================================
# STEP 4: Power BI Desktop
# ===========================================================
if (-not $SkipInstall) {
    $pbiPath = Get-Command "PBIDesktop" -ErrorAction SilentlyContinue
    if (-not $pbiPath) {
        # Also check common install paths
        $pbiPaths = @(
            "${env:ProgramFiles}\Microsoft Power BI Desktop\bin\PBIDesktop.exe",
            "${env:ProgramFiles(x86)}\Microsoft Power BI Desktop\bin\PBIDesktop.exe",
            "$env:LOCALAPPDATA\Microsoft\WindowsApps\PBIDesktop.exe"
        )
        $pbiFound = $pbiPaths | Where-Object { Test-Path $_ } | Select-Object -First 1
    }
    if ($pbiPath -or $pbiFound) {
        Write-Host "[4/$TOTAL_STEPS] Power BI Desktop already installed" -ForegroundColor Green
    } else {
        Write-Host "[4/$TOTAL_STEPS] Installing Power BI Desktop..." -ForegroundColor Yellow
        if (Test-CommandExists "winget") {
            winget install Microsoft.PowerBI --accept-package-agreements --accept-source-agreements --silent 2>$null
            Write-Host "  Power BI Desktop installed via winget" -ForegroundColor Green
        } else {
            Write-Host "  winget not available. Please install Power BI Desktop manually:" -ForegroundColor Red
            Write-Host "  https://aka.ms/pbidesktopstore" -ForegroundColor Yellow
            Write-Host "  Or: Microsoft Store > 'Power BI Desktop'" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "[4/$TOTAL_STEPS] Skipped (SkipInstall)" -ForegroundColor Gray
}

# ===========================================================
# STEP 5: API Configuration (config.json + env var)
# ===========================================================
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
Write-Host "  API Key saved to env: AI_CLASS_API_KEY" -ForegroundColor Green

# ===========================================================
# STEP 6: Cline Provider + MCP Server Configuration
# ===========================================================
Write-Host "[6/$TOTAL_STEPS] Configuring Cline (API provider + MCP servers)..." -ForegroundColor Yellow

$clineDataDir = "$env:USERPROFILE\.cline\data"
New-Item -ItemType Directory -Force -Path $clineDataDir | Out-Null

# --- 6a: Cline API Provider (globalState.json) ---
$gsFile = "$clineDataDir\globalState.json"
if (Test-Path $gsFile) {
    $gs = Get-Content $gsFile -Raw | ConvertFrom-Json
} else {
    $gs = [PSCustomObject]@{}
}

$gs | Add-Member -NotePropertyName "actModeApiProvider" -NotePropertyValue "openai-compatible" -Force
$gs | Add-Member -NotePropertyName "planModeApiProvider" -NotePropertyValue "openai-compatible" -Force
$gs | Add-Member -NotePropertyName "planActSeparateModelsSetting" -NotePropertyValue $false -Force
$gs | Add-Member -NotePropertyName "openAiCompatibleBaseUrl" -NotePropertyValue "$APIM_BASE_URL/openai/v1" -Force
$gs | Add-Member -NotePropertyName "openAiCompatibleModelId" -NotePropertyValue "gpt-54-mini" -Force
$gs | Add-Member -NotePropertyName "actModeOpenAiCompatibleModelId" -NotePropertyValue "gpt-54-mini" -Force
$gs | Add-Member -NotePropertyName "planModeOpenAiCompatibleModelId" -NotePropertyValue "gpt-54-mini" -Force
$gs | Add-Member -NotePropertyName "actModeOpenAiCompatibleBaseUrl" -NotePropertyValue "$APIM_BASE_URL/openai/v1" -Force
$gs | Add-Member -NotePropertyName "planModeOpenAiCompatibleBaseUrl" -NotePropertyValue "$APIM_BASE_URL/openai/v1" -Force

Write-Utf8NoBom $gsFile ($gs | ConvertTo-Json -Depth 10)
Write-Host "  Cline provider: OpenAI Compatible ($APIM_BASE_URL/openai/v1)" -ForegroundColor Green

# --- 6b: Cline API Key (secrets.json) ---
$secFile = "$clineDataDir\secrets.json"
if (Test-Path $secFile) {
    $sec = Get-Content $secFile -Raw | ConvertFrom-Json
} else {
    $sec = [PSCustomObject]@{}
}
$sec | Add-Member -NotePropertyName "openAiCompatibleApiKey" -NotePropertyValue $ApiKey -Force
Write-Utf8NoBom $secFile ($sec | ConvertTo-Json -Depth 5)
Write-Host "  Cline API key saved" -ForegroundColor Green

# --- 6c: MCP Servers (mcpSettings.json) ---
$mcpFile = "$clineDataDir\mcpSettings.json"
if (Test-Path $mcpFile) {
    $mcp = Get-Content $mcpFile -Raw | ConvertFrom-Json
} else {
    $mcp = [PSCustomObject]@{
        mcpServers = [PSCustomObject]@{}
    }
}

# Ensure mcpServers property exists
if (-not ($mcp | Get-Member -Name "mcpServers" -MemberType NoteProperty)) {
    $mcp | Add-Member -NotePropertyName "mcpServers" -NotePropertyValue ([PSCustomObject]@{}) -Force
}

# Power BI MCP Server
$mcp.mcpServers | Add-Member -NotePropertyName "powerbi" -NotePropertyValue ([PSCustomObject]@{
    command = "npx"
    args = @("-y", "@anthropic/mcp-server-powerbi")
    env = [PSCustomObject]@{}
    disabled = $false
    autoApprove = @()
}) -Force

# Playwright MCP Server
$mcp.mcpServers | Add-Member -NotePropertyName "playwright" -NotePropertyValue ([PSCustomObject]@{
    command = "npx"
    args = @("-y", "@anthropic/mcp-server-playwright")
    env = [PSCustomObject]@{}
    disabled = $false
    autoApprove = @()
}) -Force

# Filesystem MCP Server (access to practice files directory)
$practiceDir = "$env:USERPROFILE\Desktop"
$mcp.mcpServers | Add-Member -NotePropertyName "filesystem" -NotePropertyValue ([PSCustomObject]@{
    command = "npx"
    args = @("-y", "@anthropic/mcp-server-filesystem", $practiceDir)
    env = [PSCustomObject]@{}
    disabled = $false
    autoApprove = @()
}) -Force

Write-Utf8NoBom $mcpFile ($mcp | ConvertTo-Json -Depth 10)
Write-Host "  MCP servers configured:" -ForegroundColor Green
Write-Host "    - powerbi  : @anthropic/mcp-server-powerbi" -ForegroundColor Gray
Write-Host "    - playwright: @anthropic/mcp-server-playwright" -ForegroundColor Gray
Write-Host "    - filesystem: @anthropic/mcp-server-filesystem ($practiceDir)" -ForegroundColor Gray

# ===========================================================
# STEP 7: Download Practice File (.pbix)
# ===========================================================
Write-Host "[7/$TOTAL_STEPS] Downloading practice file..." -ForegroundColor Yellow

$destDir = "$env:USERPROFILE\Desktop"
$destFile = "$destDir\practice.pbix"

if (Test-Path $destFile) {
    Write-Host "  Practice file already exists: $destFile" -ForegroundColor Green
} else {
    try {
        Invoke-WebRequest -Uri $PracticeFileUrl -OutFile $destFile -TimeoutSec 60
        Write-Host "  Downloaded: $destFile" -ForegroundColor Green
    } catch {
        Write-Host "  Download failed: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "  Please download manually from the onboarding email link" -ForegroundColor Yellow
    }
}

# ===========================================================
# STEP 8: Connection Test
# ===========================================================
Write-Host "[8/$TOTAL_STEPS] Testing API connection..." -ForegroundColor Yellow

$headers = @{
    "Content-Type"  = "application/json"
    "Authorization" = "Bearer $ApiKey"
}

$testBody = @{
    model = "gpt-54-mini"
    messages = @(@{ role = "user"; content = "Say hello in Korean" })
    max_completion_tokens = 50
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$OPENAI_ENDPOINT/v1/chat/completions" `
        -Method POST -Headers $headers -Body $testBody -TimeoutSec 30
    $reply = $response.choices[0].message.content
    Write-Host "  API response: $reply" -ForegroundColor Green
} catch {
    Write-Host "  Connection test failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  This may be normal if APIM is still deploying." -ForegroundColor Yellow
    Write-Host "  You can test manually later in Cline." -ForegroundColor Yellow
}

# ===========================================================
# DONE
# ===========================================================
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Setup Complete!" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Installed:" -ForegroundColor White
Write-Host "    - VS Code + Cline extension" -ForegroundColor Gray
Write-Host "    - Node.js 22+ (for MCP servers)" -ForegroundColor Gray
Write-Host "    - Power BI Desktop" -ForegroundColor Gray
Write-Host ""
Write-Host "  Configured in Cline:" -ForegroundColor White
Write-Host "    - API Provider: OpenAI Compatible" -ForegroundColor Gray
Write-Host "    - Base URL: $APIM_BASE_URL/openai/v1" -ForegroundColor Gray
Write-Host "    - Model: gpt-54-mini" -ForegroundColor Gray
Write-Host "    - MCP: powerbi, playwright, filesystem" -ForegroundColor Gray
Write-Host ""
Write-Host "  Practice file: $destFile" -ForegroundColor White
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor Yellow
Write-Host "    1. Open VS Code" -ForegroundColor White
Write-Host "    2. Open the practice file in Power BI Desktop" -ForegroundColor White
Write-Host "    3. In Cline, ask: 'Analyze the file open in Power BI Desktop'" -ForegroundColor White
Write-Host ""
