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

    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

$APIM_BASE_URL = "https://apim-eduelden-ai.azure-api.net"
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

$config | Out-File -FilePath "$configDir\config.json" -Encoding utf8
Write-Host "  Config saved: $configDir\config.json" -ForegroundColor Green

# Save API key as user environment variable
[System.Environment]::SetEnvironmentVariable("AI_CLASS_API_KEY", $ApiKey, "User")
$env:AI_CLASS_API_KEY = $ApiKey
Write-Host "  API Key saved to env var: AI_CLASS_API_KEY" -ForegroundColor Green

# 3-b. Auto-inject Cline provider settings
Write-Host "  Configuring Cline API provider..." -ForegroundColor Yellow

# Method 1: ~/.cline/data/settings/providers.json (Cline shared config)
$clineConfigDir = "$env:USERPROFILE\.cline\data\settings"
New-Item -ItemType Directory -Force -Path $clineConfigDir | Out-Null

$timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$providerConfig = @{
    version = 1
    lastUsedProvider = "openai-compatible"
    providers = @{
        "openai-compatible" = @{
            settings = @{
                provider = "openai-compatible"
                baseUrl = "$APIM_BASE_URL/openai/v1"
                apiKey = $ApiKey
                modelId = "gpt-54-mini"
            }
            updatedAt = $timestamp
            tokenSource = "manual"
        }
    }
} | ConvertTo-Json -Depth 5

$providerConfig | Out-File -FilePath "$clineConfigDir\providers.json" -Encoding utf8
Write-Host "  Cline config (shared): $clineConfigDir\providers.json" -ForegroundColor Green

# Method 2: VS Code settings.json (extension settings fallback)
$vsCodeSettingsDir = "$env:APPDATA\Code\User"
if (-not (Test-Path $vsCodeSettingsDir)) {
    New-Item -ItemType Directory -Force -Path $vsCodeSettingsDir | Out-Null
}
$vsCodeSettingsFile = "$vsCodeSettingsDir\settings.json"
if (Test-Path $vsCodeSettingsFile) {
    $existingSettings = Get-Content $vsCodeSettingsFile -Raw | ConvertFrom-Json
} else {
    $existingSettings = [PSCustomObject]@{}
}
$existingSettings | Add-Member -NotePropertyName "cline.apiProvider" -NotePropertyValue "openai-compatible" -Force
$existingSettings | Add-Member -NotePropertyName "cline.openAiCompatible.baseUrl" -NotePropertyValue "$APIM_BASE_URL/openai/v1" -Force
$existingSettings | Add-Member -NotePropertyName "cline.openAiCompatible.apiKey" -NotePropertyValue $ApiKey -Force
$existingSettings | Add-Member -NotePropertyName "cline.openAiCompatible.modelId" -NotePropertyValue "gpt-54-mini" -Force
$existingSettings | ConvertTo-Json -Depth 10 | Out-File -FilePath $vsCodeSettingsFile -Encoding utf8
Write-Host "  Cline config (VS Code): $vsCodeSettingsFile" -ForegroundColor Green

Write-Host "  -> Provider: openai-compatible" -ForegroundColor Gray
Write-Host "  -> Base URL: $APIM_BASE_URL/openai/v1" -ForegroundColor Gray
Write-Host "  -> Model: gpt-54-mini (you can switch to gpt-55 or deepseek-v4-flash)" -ForegroundColor Gray

# 4. Connection test
Write-Host "[4/4] Testing API connection..." -ForegroundColor Yellow

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $ApiKey"
}

$testBody = @{
    messages = @(@{ role = "user"; content = "Say hello in Korean" })
    max_completion_tokens = 50
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$OPENAI_ENDPOINT/deployments/gpt-54-mini/chat/completions?api-version=2024-10-21" -Method POST -Headers $headers -Body $testBody -TimeoutSec 30
    $reply = $response.choices[0].message.content
    Write-Host "  GPT-5.4-mini response: $reply" -ForegroundColor Green
    Write-Host ""
    Write-Host "=== Setup Complete! ===" -ForegroundColor Cyan
    Write-Host "Use these settings in Cline:"
    Write-Host "  Base URL : $OPENAI_ENDPOINT/v1"
    Write-Host "  API Key  : (stored in env var AI_CLASS_API_KEY)"
    Write-Host "  Model    : gpt-54-mini (or gpt-55, deepseek-v4-flash)"
} catch {
    Write-Host "  Connection test failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  APIM may still be deploying, or the key may be incorrect." -ForegroundColor Yellow
    Write-Host "  Manual test: curl $OPENAI_ENDPOINT/deployments/gpt-54-mini/chat/completions?api-version=2024-10-21" -ForegroundColor Yellow
}
