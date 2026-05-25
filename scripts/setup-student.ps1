#Requires -Version 5.1
<#
.SYNOPSIS
    Azure AI Foundry Vibe-Coding Lab - Student PC Auto-Setup Script
.DESCRIPTION
    Installs VS Code + Cline extension, creates API config, and runs a connection test.
.PARAMETER StudentId
    Student number (01-50)
.PARAMETER ApiKey
    APIM subscription key
.PARAMETER SkipInstall
    Skip VS Code / Cline installation
#>
param(
    [Parameter(Mandatory=$true)]
    [ValidatePattern('^\d{2}$')]
    [string]$StudentId,

    [Parameter(Mandatory=$true)]
    [string]$ApiKey,

    [Parameter(Mandatory=$false)]
    [string]$ApimUrl = "https://apim-eduelden-ai.azure-api.net",

    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

$APIM_BASE_URL = $ApimUrl.TrimEnd('/')
$OPENAI_ENDPOINT = "$APIM_BASE_URL/openai"
$DEEPSEEK_ENDPOINT = "$APIM_BASE_URL/deepseek"

Write-Host "=== Azure AI Foundry - Student Environment Setup ===" -ForegroundColor Cyan
Write-Host "Student ID: $StudentId"

# 1. VS Code installation check
if (-not $SkipInstall) {
    $vscodePath = Get-Command code -ErrorAction SilentlyContinue
    if (-not $vscodePath) {
        Write-Host "[1/4] Installing VS Code..." -ForegroundColor Yellow
        $installer = "$env:TEMP\vscode-setup.exe"
        Invoke-WebRequest -Uri "https://code.visualstudio.com/sha/download?build=stable&os=win32-x64" -OutFile $installer
        Start-Process -FilePath $installer -ArgumentList "/verysilent /norestart /mergetasks=!runcode,addcontextmenufiles,addcontextmenufolders,associatewithfiles,addtopath" -Wait
        $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
        Write-Host "  VS Code installed successfully" -ForegroundColor Green
    } else {
        Write-Host "[1/4] VS Code already installed" -ForegroundColor Green
    }

    # 2. Cline extension installation
    Write-Host "[2/4] Installing Cline extension..." -ForegroundColor Yellow
    code --install-extension saoudrizwan.claude-dev --force 2>$null
    Write-Host "  Cline extension installed" -ForegroundColor Green
} else {
    Write-Host '[1/4] Skipped (SkipInstall flag set)' -ForegroundColor Gray
    Write-Host '[2/4] Skipped (SkipInstall flag set)' -ForegroundColor Gray
}

# 3. Create API config file
Write-Host "[3/4] Creating API config..." -ForegroundColor Yellow
$configDir = "$env:USERPROFILE\.ai-class"
New-Item -ItemType Directory -Force -Path $configDir | Out-Null

$config = @{
    student_id = $StudentId
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
        "deepseek-v4-flash" = @{
            endpoint = $DEEPSEEK_ENDPOINT
            model_id = "deepseek-v4-flash"
            description = "DeepSeek-V4-Flash (alternative model)"
        }
    }
} | ConvertTo-Json -Depth 5

# Write without BOM (PS 5.1 Out-File -Encoding utf8 adds BOM which breaks JSON parsers)
[System.IO.File]::WriteAllText("$configDir\config.json", $config, [System.Text.UTF8Encoding]::new($false))
Write-Host "  Config saved: $configDir\config.json" -ForegroundColor Green

# Save API key as user environment variable
[System.Environment]::SetEnvironmentVariable("AI_CLASS_API_KEY", $ApiKey, "User")
$env:AI_CLASS_API_KEY = $ApiKey
Write-Host "  API Key saved to env var: AI_CLASS_API_KEY" -ForegroundColor Green

# 3-b. Auto-inject Cline provider config (~/.cline/data/)
Write-Host "  Configuring Cline API provider..." -ForegroundColor Yellow

$clineDataDir = "$env:USERPROFILE\.cline\data"
New-Item -ItemType Directory -Force -Path $clineDataDir | Out-Null

# Read existing globalState.json or create base
$gsFile = "$clineDataDir\globalState.json"
if (Test-Path $gsFile) {
    $gs = Get-Content $gsFile -Raw | ConvertFrom-Json
} else {
    $gs = [PSCustomObject]@{}
}

# Set OpenAI Compatible as the active provider (both plan & act modes)
$gs | Add-Member -NotePropertyName "actModeApiProvider" -NotePropertyValue "openai-compatible" -Force
$gs | Add-Member -NotePropertyName "planModeApiProvider" -NotePropertyValue "openai-compatible" -Force
$gs | Add-Member -NotePropertyName "planActSeparateModelsSetting" -NotePropertyValue $false -Force
$gs | Add-Member -NotePropertyName "openAiCompatibleBaseUrl" -NotePropertyValue "$APIM_BASE_URL/openai/v1" -Force
$gs | Add-Member -NotePropertyName "openAiCompatibleModelId" -NotePropertyValue "gpt-54-mini" -Force
$gs | Add-Member -NotePropertyName "actModeOpenAiCompatibleModelId" -NotePropertyValue "gpt-54-mini" -Force
$gs | Add-Member -NotePropertyName "planModeOpenAiCompatibleModelId" -NotePropertyValue "gpt-54-mini" -Force
$gs | Add-Member -NotePropertyName "actModeOpenAiCompatibleBaseUrl" -NotePropertyValue "$APIM_BASE_URL/openai/v1" -Force
$gs | Add-Member -NotePropertyName "planModeOpenAiCompatibleBaseUrl" -NotePropertyValue "$APIM_BASE_URL/openai/v1" -Force

$gsJson = $gs | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($gsFile, $gsJson, [System.Text.UTF8Encoding]::new($false))
Write-Host "  Cline globalState: $gsFile" -ForegroundColor Green

# Store API key in secrets.json
$secFile = "$clineDataDir\secrets.json"
if (Test-Path $secFile) {
    $sec = Get-Content $secFile -Raw | ConvertFrom-Json
} else {
    $sec = [PSCustomObject]@{}
}
$sec | Add-Member -NotePropertyName "openAiCompatibleApiKey" -NotePropertyValue $ApiKey -Force
$secJson = $sec | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($secFile, $secJson, [System.Text.UTF8Encoding]::new($false))
Write-Host "  Cline secrets: $secFile" -ForegroundColor Green

Write-Host "  -> Provider: OpenAI Compatible" -ForegroundColor Gray
Write-Host "  -> Base URL: $APIM_BASE_URL/openai/v1" -ForegroundColor Gray
Write-Host "  -> Default Model: gpt-54-mini" -ForegroundColor Gray
Write-Host "  -> To switch models in Cline settings:" -ForegroundColor Gray
Write-Host "     gpt-55 (high quality) | deepseek-v4-flash (Base URL: /deepseek/v1)" -ForegroundColor Gray

# 3-c. Install Power BI MCP (exe, not npx - npx wrapper outputs non-JSON text to stdout breaking MCP transport)
Write-Host "  Installing Power BI MCP..." -ForegroundColor Yellow

$powerBiMcpRoot = "C:\MCPServers\PowerBIModelingMCP"
$powerBiMcpExe = Join-Path $powerBiMcpRoot "node_modules\@microsoft\powerbi-modeling-mcp-win32-x64\dist\powerbi-modeling-mcp.exe"

if (-not (Test-Path $powerBiMcpExe)) {
    Write-Host "  Downloading Power BI MCP Windows binary..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path $powerBiMcpRoot | Out-Null
    & npm install --prefix $powerBiMcpRoot "@microsoft/powerbi-modeling-mcp-win32-x64@latest" 2>$null
    if (Test-Path $powerBiMcpExe) {
        Write-Host "  Power BI MCP exe installed: $powerBiMcpExe" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: Power BI MCP exe not found after install. Check npm logs." -ForegroundColor Red
    }
} else {
    Write-Host "  Power BI MCP exe already installed" -ForegroundColor Green
}

# 3-d. Configure Cline MCP settings (Power BI + filesystem)
Write-Host "  Configuring Cline MCP servers..." -ForegroundColor Yellow

# Find Cline MCP settings file (VS Code globalStorage)
$clineExtId = "saoudrizwan.claude-dev"
$vscodeStoragePaths = @(
    "$env:APPDATA\Code\User\globalStorage\$clineExtId\settings\cline_mcp_settings.json",
    "$env:APPDATA\Code - Insiders\User\globalStorage\$clineExtId\settings\cline_mcp_settings.json"
)

foreach ($mcpSettingsFile in $vscodeStoragePaths) {
    $mcpSettingsDir = Split-Path $mcpSettingsFile -Parent
    if (-not (Test-Path $mcpSettingsDir)) {
        # Skip if Cline extension storage directory doesn't exist
        continue
    }

    if (Test-Path $mcpSettingsFile) {
        $mcpSettings = Get-Content $mcpSettingsFile -Raw | ConvertFrom-Json
    } else {
        $mcpSettings = [PSCustomObject]@{ mcpServers = [PSCustomObject]@{} }
    }

    # Add/update Power BI MCP server (exe, not npx)
    $powerBiConfig = [PSCustomObject]@{
        type = "stdio"
        command = $powerBiMcpExe.Replace('\', '\\')
        args = @("--start", "--readwrite", "--skip-confirmation", "--compatibility=full")
        env = [PSCustomObject]@{}
        timeout = 300
        disabled = $false
        autoApprove = @()
    }
    $mcpSettings.mcpServers | Add-Member -NotePropertyName "powerbi" -NotePropertyValue $powerBiConfig -Force

    $mcpJson = $mcpSettings | ConvertTo-Json -Depth 10
    [System.IO.File]::WriteAllText($mcpSettingsFile, $mcpJson, [System.Text.UTF8Encoding]::new($false))
    Write-Host "  Cline MCP settings updated: $mcpSettingsFile" -ForegroundColor Green
}

Write-Host "  -> Power BI MCP: exe direct (no npx wrapper)" -ForegroundColor Gray

# 4. Connection test
Write-Host "[4/4] Testing API connection..." -ForegroundColor Yellow

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $ApiKey"
}

$testBody = @{
    model = "gpt-54-mini"
    messages = @(@{ role = "user"; content = "Say hello in Korean" })
    max_completion_tokens = 50
} | ConvertTo-Json

try {
    # Test using the same URL format that Cline uses (OpenAI-compatible)
    # APIM policy rewrites this to /deployments/gpt-54-mini/chat/completions
    $response = Invoke-RestMethod -Uri "$OPENAI_ENDPOINT/v1/chat/completions" -Method POST -Headers $headers -Body $testBody -TimeoutSec 30
    $reply = $response.choices[0].message.content
    Write-Host "  GPT-5.4-mini response: $reply" -ForegroundColor Green
    Write-Host ""
    Write-Host "=== Setup Complete! ===" -ForegroundColor Cyan
    Write-Host "Use these settings in Cline:"
    Write-Host "  Base URL : $OPENAI_ENDPOINT/v1"
    Write-Host "  API Key  : (stored in env var AI_CLASS_API_KEY)"
    Write-Host "  Model    : gpt-54-mini (or gpt-55, deepseek-v4-flash)"
    Write-Host ""
    Write-Host "To switch to DeepSeek, change Base URL to: $DEEPSEEK_ENDPOINT/v1"
} catch {
    Write-Host "  Connection test failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  APIM may still be deploying, or the key may be incorrect." -ForegroundColor Yellow
    Write-Host "  Manual test:" -ForegroundColor Yellow
    Write-Host "    curl -X POST '$OPENAI_ENDPOINT/v1/chat/completions' -H 'Authorization: Bearer YOUR_KEY' -H 'Content-Type: application/json' -d '{""model"":""gpt-54-mini"",""messages"":[{""role"":""user"",""content"":""Hello""}]}'" -ForegroundColor Yellow
}
