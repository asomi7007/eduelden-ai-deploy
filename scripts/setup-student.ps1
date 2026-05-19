#Requires -Version 5.1
<#
.SYNOPSIS
    Azure AI Foundry 바이브코딩 실습 학생 PC 자동 설정 스크립트
.DESCRIPTION
    VS Code + Cline 확장 설치, API 설정 파일 생성, 연결 테스트 수행
.PARAMETER StudentId
    학생 번호 (01~50)
.PARAMETER ApiKey
    APIM 구독 키
.PARAMETER SkipInstall
    VS Code/Cline 설치 건너뛰기
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

Write-Host "=== Azure AI Foundry 학생 환경 설정 ===" -ForegroundColor Cyan
Write-Host "Student ID: $StudentId"

# 1. VS Code 설치 확인
if (-not $SkipInstall) {
    $vscodePath = Get-Command code -ErrorAction SilentlyContinue
    if (-not $vscodePath) {
        Write-Host "[1/4] VS Code 설치 중..." -ForegroundColor Yellow
        $installer = "$env:TEMP\vscode-setup.exe"
        Invoke-WebRequest -Uri "https://code.visualstudio.com/sha/download?build=stable&os=win32-x64" -OutFile $installer
        Start-Process -FilePath $installer -ArgumentList "/verysilent /norestart /mergetasks=!runcode,addcontextmenufiles,addcontextmenufolders,associatewithfiles,addtopath" -Wait
        $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
        Write-Host "  VS Code 설치 완료" -ForegroundColor Green
    } else {
        Write-Host "[1/4] VS Code 이미 설치됨" -ForegroundColor Green
    }

    # 2. Cline 확장 설치
    Write-Host "[2/4] Cline 확장 설치 중..." -ForegroundColor Yellow
    code --install-extension saoudrizwan.claude-dev --force 2>$null
    Write-Host "  Cline 확장 설치 완료" -ForegroundColor Green
} else {
    Write-Host "[1/4] 설치 건너뛰기 (--SkipInstall)" -ForegroundColor Gray
    Write-Host "[2/4] 설치 건너뛰기 (--SkipInstall)" -ForegroundColor Gray
}

# 3. API 설정 파일 생성
Write-Host "[3/4] API 설정 파일 생성 중..." -ForegroundColor Yellow
$configDir = "$env:USERPROFILE\.ai-class"
New-Item -ItemType Directory -Force -Path $configDir | Out-Null

$config = @{
    student_id = $StudentId
    apim_base_url = $APIM_BASE_URL
    models = @{
        "gpt-55" = @{
            endpoint = $OPENAI_ENDPOINT
            model_id = "gpt-55"
            description = "GPT-5.5 (고품질, 느림)"
        }
        "gpt-54-mini" = @{
            endpoint = $OPENAI_ENDPOINT
            model_id = "gpt-54-mini"
            description = "GPT-5.4-mini (범용, 빠름)"
        }
        "deepseek-v4-flash" = @{
            endpoint = $DEEPSEEK_ENDPOINT
            model_id = "deepseek-v4-flash"
            description = "DeepSeek-V4-Flash (대안 모델)"
        }
    }
} | ConvertTo-Json -Depth 5

$config | Out-File -FilePath "$configDir\config.json" -Encoding utf8
Write-Host "  설정 파일: $configDir\config.json" -ForegroundColor Green

# API 키는 환경변수로 설정
[System.Environment]::SetEnvironmentVariable("AI_CLASS_API_KEY", $ApiKey, "User")
$env:AI_CLASS_API_KEY = $ApiKey
Write-Host "  API 키: 환경변수 AI_CLASS_API_KEY에 저장" -ForegroundColor Green

# 3-b. Cline VS Code 확장 글로벌 설정 자동 주입
Write-Host "  Cline 설정 자동 구성 중..." -ForegroundColor Yellow
$vsCodeSettingsDir = "$env:APPDATA\Code\User"
if (Test-Path $vsCodeSettingsDir) {
    $vsCodeSettingsFile = "$vsCodeSettingsDir\settings.json"
    if (Test-Path $vsCodeSettingsFile) {
        $existingSettings = Get-Content $vsCodeSettingsFile -Raw | ConvertFrom-Json
    } else {
        $existingSettings = [PSCustomObject]@{}
    }

    $clineConfig = [PSCustomObject]@{
        baseUrl = "$APIM_BASE_URL/openai/v1"
        apiKey  = $ApiKey
        modelId = "gpt-54-mini"
    }

    $existingSettings | Add-Member -NotePropertyName "cline.apiProvider" -NotePropertyValue "openai-compatible" -Force
    $existingSettings | Add-Member -NotePropertyName "cline.openAiCompatibleApiConfiguration" -NotePropertyValue $clineConfig -Force

    $existingSettings | ConvertTo-Json -Depth 10 | Out-File -FilePath $vsCodeSettingsFile -Encoding utf8
    Write-Host "  Cline 설정 완료: $vsCodeSettingsFile" -ForegroundColor Green
    Write-Host "  → Provider: openai-compatible" -ForegroundColor Gray
    Write-Host "  → Base URL: $APIM_BASE_URL/openai/v1" -ForegroundColor Gray
    Write-Host "  → Model: gpt-54-mini (변경 가능: gpt-55, deepseek-v4-flash)" -ForegroundColor Gray
} else {
    Write-Host "  VS Code 설정 폴더를 찾을 수 없습니다. VS Code를 먼저 한 번 실행해주세요." -ForegroundColor Yellow
}

# 4. 연결 테스트
Write-Host "[4/4] API 연결 테스트..." -ForegroundColor Yellow

$headers = @{
    "Content-Type" = "application/json"
    "api-key" = $ApiKey
}

$testBody = @{
    messages = @(@{ role = "user"; content = "Say hello in Korean" })
    max_completion_tokens = 50
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$OPENAI_ENDPOINT/deployments/gpt-54-mini/chat/completions?api-version=2024-10-21" -Method POST -Headers $headers -Body $testBody -TimeoutSec 30
    $reply = $response.choices[0].message.content
    Write-Host "  GPT-5.4-mini 응답: $reply" -ForegroundColor Green
    Write-Host ""
    Write-Host "=== 설정 완료! ===" -ForegroundColor Cyan
    Write-Host "Cline에서 다음 설정을 사용하세요:"
    Write-Host "  Base URL: $OPENAI_ENDPOINT"
    Write-Host "  API Key: (환경변수 AI_CLASS_API_KEY)"
    Write-Host "  Model: gpt-54-mini (또는 gpt-55, deepseek-v4-flash)"
} catch {
    Write-Host "  연결 테스트 실패: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "  APIM이 아직 배포 중이거나 키가 잘못되었을 수 있습니다." -ForegroundColor Yellow
    Write-Host "  수동으로 테스트: curl $OPENAI_ENDPOINT/deployments/gpt-54-mini/chat/completions?api-version=2024-10-21" -ForegroundColor Yellow
}
