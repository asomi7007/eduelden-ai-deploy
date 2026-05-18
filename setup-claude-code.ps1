# ============================================================
# Claude Code 환경 셋업 스크립트 (Windows PowerShell)
# ============================================================
# 사용법:
#   1. 이 폴더(claude-code-handoff)를 작업 폴더로 복사
#   2. PowerShell을 관리자 권한으로 열기
#   3. cd <복사한 경로>
#   4. Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
#   5. .\setup-claude-code.ps1
#   6. 스크립트가 끝나면 같은 폴더에서 `claude` 실행
# ============================================================

$ErrorActionPreference = "Stop"
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host " Azure AI Foundry 실습 환경 — Claude Code 셋업" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# ---- 1. 필수 도구 확인 ----
Write-Host "[1/6] 필수 도구 확인 중..." -ForegroundColor Yellow

function Check-Command($cmd, $installHint) {
    $exists = Get-Command $cmd -ErrorAction SilentlyContinue
    if ($exists) {
        $version = & $cmd --version 2>&1 | Select-Object -First 1
        Write-Host "  OK $cmd : $version" -ForegroundColor Green
        return $true
    } else {
        Write-Host "  X $cmd 없음. 설치 방법: $installHint" -ForegroundColor Red
        return $false
    }
}

$allOk = $true
$allOk = (Check-Command "az"     "winget install Microsoft.AzureCLI") -and $allOk
$allOk = (Check-Command "gh"     "winget install GitHub.cli") -and $allOk
$allOk = (Check-Command "node"   "winget install OpenJS.NodeJS.LTS") -and $allOk
$allOk = (Check-Command "claude" "npm install -g @anthropic-ai/claude-code") -and $allOk

if (-not $allOk) {
    Write-Host ""
    Write-Host "필수 도구가 없어요. 위 안내대로 설치 후 다시 실행해주세요." -ForegroundColor Red
    exit 1
}

# ---- 2. Azure 로그인 확인 ----
Write-Host ""
Write-Host "[2/6] Azure 로그인 상태 확인..." -ForegroundColor Yellow
$azAccount = az account show 2>$null | ConvertFrom-Json
if ($null -eq $azAccount) {
    Write-Host "  로그인 안 돼있음. az login 실행할게요." -ForegroundColor Yellow
    az login
    $azAccount = az account show | ConvertFrom-Json
}
Write-Host "  OK 로그인됨: $($azAccount.user.name)" -ForegroundColor Green
Write-Host "  구독:     $($azAccount.name) ($($azAccount.id))" -ForegroundColor Green

# 구독 ID 검증
$expectedSub = "3354f2f5-e261-49af-9ead-2c6938f447a3"
if ($azAccount.id -ne $expectedSub) {
    Write-Host "  ! 구독이 예상값과 달라요. 전환할까요?" -ForegroundColor Yellow
    Write-Host "    예상: $expectedSub"
    Write-Host "    현재: $($azAccount.id)"
    $ans = Read-Host "  전환하려면 Y, 그대로 진행하려면 N"
    if ($ans -eq "Y") {
        az account set --subscription $expectedSub
        Write-Host "  OK 구독 전환 완료." -ForegroundColor Green
    }
}

# ---- 3. GitHub 로그인 확인 ----
Write-Host ""
Write-Host "[3/6] GitHub CLI 로그인 상태..." -ForegroundColor Yellow
$ghStatus = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  GitHub 로그인이 필요해요. gh auth login 실행할게요." -ForegroundColor Yellow
    Write-Host "  (브라우저에서 asomi7007 계정으로 로그인하세요)" -ForegroundColor Yellow
    gh auth login --scopes "repo,workflow,admin:org,user:email"
} else {
    Write-Host "  OK GitHub 로그인됨." -ForegroundColor Green
}

# GitHub 토큰을 환경변수로 익스포트 (MCP가 쓸 수 있게)
$env:GITHUB_PERSONAL_ACCESS_TOKEN = (gh auth token)
[Environment]::SetEnvironmentVariable("GITHUB_PERSONAL_ACCESS_TOKEN", $env:GITHUB_PERSONAL_ACCESS_TOKEN, "User")
Write-Host "  GITHUB_PERSONAL_ACCESS_TOKEN 환경변수 등록 완료." -ForegroundColor Green

# ---- 4. Claude Code MCP 서버 등록 ----
Write-Host ""
Write-Host "[4/6] Claude Code MCP 서버 등록..." -ForegroundColor Yellow

# 4-1. Azure MCP
Write-Host "  - Azure MCP 추가..." -ForegroundColor Cyan
claude mcp remove azure 2>$null | Out-Null
claude mcp add azure -- npx -y "@azure/mcp@latest" server start
if ($LASTEXITCODE -eq 0) {
    Write-Host "    OK Azure MCP 등록됨." -ForegroundColor Green
} else {
    Write-Host "    ! Azure MCP 등록 실패. 나중에 수동 추가하세요." -ForegroundColor Yellow
}

# 4-2. GitHub MCP
Write-Host "  - GitHub MCP 추가..." -ForegroundColor Cyan
claude mcp remove github 2>$null | Out-Null
claude mcp add github --env "GITHUB_PERSONAL_ACCESS_TOKEN=$env:GITHUB_PERSONAL_ACCESS_TOKEN" -- npx -y "@modelcontextprotocol/server-github"
if ($LASTEXITCODE -eq 0) {
    Write-Host "    OK GitHub MCP 등록됨." -ForegroundColor Green
} else {
    Write-Host "    ! GitHub MCP 등록 실패." -ForegroundColor Yellow
}

# 4-3. Microsoft Learn MCP (보너스 - 문서 검색용)
Write-Host "  - Microsoft Learn MCP 추가..." -ForegroundColor Cyan
claude mcp remove mslearn 2>$null | Out-Null
claude mcp add --transport http mslearn "https://learn.microsoft.com/api/mcp" 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "    OK Microsoft Learn MCP 등록됨." -ForegroundColor Green
}

# ---- 4-4. 프로젝트별 .mcp.json 생성 (다른 PC에서도 자동 인식되도록) ----
if (Test-Path ".\mcp.template.json") {
    Copy-Item ".\mcp.template.json" ".\.mcp.json" -Force
    Write-Host "  - .mcp.json (프로젝트별 MCP 설정) 생성 완료." -ForegroundColor Green
}

# ---- 5. MCP 등록 결과 출력 ----
Write-Host ""
Write-Host "[5/6] 등록된 MCP 서버 목록:" -ForegroundColor Yellow
claude mcp list

# ---- 6. 안내 ----
Write-Host ""
Write-Host "[6/6] 셋업 완료!" -ForegroundColor Green
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host " 다음 단계" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. 이 폴더에서 'claude' 명령을 실행하세요." -ForegroundColor White
Write-Host "2. 첫 프롬프트로 아래를 그대로 붙여넣으세요:" -ForegroundColor White
Write-Host ""
Write-Host "   이 폴더의 CLAUDE.md와 HANDOVER.md를 읽고," -ForegroundColor Yellow
Write-Host "   Phase별 체크리스트를 TodoWrite로 등록한 다음" -ForegroundColor Yellow
Write-Host "   Phase 0부터 시작해줘. Azure MCP가 있으면 그걸로 az 명령을 실행하고," -ForegroundColor Yellow
Write-Host "   없으면 명령어를 보여주고 내 답을 받아서 진행해." -ForegroundColor Yellow
Write-Host ""
Write-Host "3. Claude Code가 자동으로 CLAUDE.md를 메모리로 로드합니다." -ForegroundColor White
Write-Host ""
