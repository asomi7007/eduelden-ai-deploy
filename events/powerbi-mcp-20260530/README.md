# AI-Driven Power BI Workshop — 2026-05-30

> MCP(Model Context Protocol)로 AI가 Power BI를 직접 제어하여 대시보드를 자동 생성하는 워크숍

## 행사 개요

| 항목 | 내용 |
|------|------|
| 일시 | 2026년 5월 30일 (금) |
| 인원 | 50명 (01~50@eduelden.kr) |
| 강사 | 허석 |
| 환경 | Windows + VS Code + Cline + Power BI Desktop |

## 설치 항목

| 소프트웨어 | 용도 |
|-----------|------|
| VS Code | 코드 에디터 + AI 에이전트 실행 환경 |
| Cline 확장 | VS Code에서 AI 에이전트(MCP) 구동 |
| Git | Cline checkpoint 기능 지원 |
| Node.js 22+ | MCP 서버 실행 런타임 |
| Power BI Desktop | 대시보드 제작 도구 |
| Chrome 또는 Edge | Playwright MCP 브라우저 (자동 감지) |

## MCP 서버

| 서버 | 패키지 | 실행 방식 | 용도 |
|------|--------|----------|------|
| Power BI | `@microsoft/powerbi-modeling-mcp-win32-x64` | **exe 직접 실행** (npx 미사용) | AI가 Power BI Desktop을 직접 제어 |
| Playwright | `@playwright/mcp` | cmd.exe + npx (`--browser` 자동 감지) | 웹 브라우저 자동화 (디자인 참조) |
| Filesystem | `@modelcontextprotocol/server-filesystem` | cmd.exe + npx | 실습 파일 읽기/쓰기 |

> **Power BI MCP 주의**: 제네릭 래퍼(`@microsoft/powerbi-modeling-mcp`)를 npx로 실행하면 stdout에 `Detected platform: win32...` 텍스트가 먼저 출력되어 MCP JSON-RPC 전송이 오염됩니다. 반드시 플랫폼별 패키지의 exe를 직접 실행하세요. (ARM64 PC는 `powerbi-modeling-mcp-win32-arm64` 자동 선택)

## 파일 구조

```text
events/powerbi-mcp-20260530/
├── config.json              # 행사 설정
├── setup-powerbi-mcp.ps1    # 학생 PC 자동 설치 스크립트
├── email-template.html      # 사전 안내 이메일 템플릿
├── README.md                # 이 파일
└── files/
    └── 실습파일.pbix         # 실습용 Power BI 파일
```

## 학생 설치 방법

### 자동 설치 (권장)

PowerShell 관리자 권한으로 실행:

```powershell
powershell -ExecutionPolicy Bypass -File "setup-powerbi-mcp.ps1" -StudentId 01 -ApiKey "발급받은키"
```

스크립트가 하는 일 (8단계):

| 단계 | 내용 |
|------|------|
| 1 | VS Code 설치 (이미 있으면 건너뜀) |
| 2 | Cline 확장 설치 + VS Code 터미널 설정 (PowerShell + shell integration) |
| 2.5 | Git 설치 + 작업폴더 Git 초기화 (Cline checkpoint 지원) |
| 3 | Node.js 22+ 설치 (MCP 서버 런타임) |
| 4 | Power BI Desktop 설치 (Microsoft Store) |
| 5 | API 설정 (config.json + 환경변수) |
| 6 | Cline MCP 서버 3개 구성 (Power BI exe + Playwright + Filesystem) + Chrome/Edge 감지 |
| 7 | 실습 파일(`practice.pbix`) 바탕화면에 다운로드 |
| 8 | API 연결 테스트 + Vision(이미지) 테스트 + VS Code 작업폴더 자동 열기 |

> **주의**: Cline API Provider/Base URL/API Key/Model은 Cline UI에서 수동 입력 필요 (스크립트로 자동화 불가). 스크립트 실행 후 바탕화면의 `CLINE_API_SETUP.txt` 파일 참조.
>
> **Desktop에서 Cline을 시작하지 마세요.** Cline은 Desktop 디렉터리에서 checkpoint를 비활성화합니다. 스크립트가 `문서\New project 3` 폴더를 자동 생성하고 VS Code로 열어줍니다. 항상 이 작업폴더에서 Cline을 시작하세요.
>
> **VS Code가 열려 있었다면** 재시작 또는 Reload Window 실행 권장.

### 수동 설치

1. [VS Code](https://code.visualstudio.com/download) 설치
2. VS Code에서 Cline 확장 설치 (`saoudrizwan.claude-dev`)
3. [Node.js 22 LTS](https://nodejs.org/) 설치
4. [Power BI Desktop](https://aka.ms/pbidesktopstore) 설치
5. Cline MCP 설정에서 3개 서버 추가 (Power BI는 반드시 exe 직접 실행)

## 관리자 작업

### 이메일 발송

`email-template.html`의 플레이스홀더를 치환하여 발송:

- `{{STUDENT_NAME}}` — 학생 이름
- `{{STUDENT_ID}}` — 학생 계정 (예: 01)
- `{{STUDENT_NUM}}` — 학생 번호 (예: 01)
- `{{API_KEY}}` — APIM 구독 키

### 실습 파일 배치

`files/실습파일.pbix` 파일을 이 디렉토리에 배치하면 스크립트가 자동 다운로드합니다.

## 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| 스크립트가 STEP 6에서 `NativeCommandError` 후 중단 | npm이 stderr로 `npm notice`를 출력 → `$ErrorActionPreference=Stop`이 오류로 인식 | **이미 수정됨** (v2, `2>&1 \| Out-Null` + try/catch). 최신 스크립트를 다시 다운로드하세요. |
| Power BI MCP "No connection found for server" | npx 래퍼가 stdout에 일반 텍스트 출력 → MCP JSON-RPC 오염 | exe 직접 실행으로 전환 (이미 스크립트에 반영됨) |
| Cline에서 API 설정이 안 됨 | Cline은 API provider/key를 VS Code SQLite DB에 저장 — 파일로 주입 불가 | Cline UI에서 수동 입력 (바탕화면 `CLINE_API_SETUP.txt` 참조) |
| VS Code에서 MCP 서버가 안 뜸 | 스크립트 실행 중 VS Code가 열려 있었음 | VS Code 재시작 또는 `Ctrl+Shift+P` → "Reload Window" |
| 바탕 화면 경로를 못 찾음 | OneDrive 동기화로 바탕화면이 `OneDrive\바탕 화면`으로 리다이렉트 | 스크립트가 자동 감지 (Shell.Application + OneDrive 후보 + mojibake 복구) |
| Playwright MCP 실행 시 `Chromium distribution 'chrome' is not found` | PC에 Chrome이 없고 Edge만 설치됨 | **이미 수정됨** (v3). 스크립트가 Chrome/Edge를 자동 감지하여 `--browser` 인자를 설정합니다. 둘 다 없으면 Chrome을 자동 설치합니다. |
| Cline 터미널에서 `Starting directory (cwd) does not exist` | OneDrive가 바탕화면을 리다이렉트하여 `C:\Users\...\Desktop` 경로가 없음 | **이미 수정됨** (v3). 스크립트가 junction을 생성하여 호환 경로를 확보합니다. |
| `Shell Integration Unavailable` 경고 | VS Code 터미널 프로필이 미설정 | **이미 수정됨** (v3). 스크립트가 PowerShell 기본 프로필 + shell integration을 자동 설정합니다. |
| `Git must be installed to use checkpoints` | Cline checkpoint에 Git이 필요하나 미설치 | **이미 수정됨** (v3). 스크립트가 Git을 자동 설치합니다. |
| Cline에서 이미지를 인식 못 함 | 파일 경로를 텍스트로 보내면 Cline이 이미지로 인식하지 않음 | 이미지 파일을 Cline 채팅에 첨부하거나, Playwright MCP의 스크린샷 도구를 사용하세요. `gpt-54-mini`는 API 레벨에서 이미지 입력을 지원합니다. |
| Cline checkpoint `Cannot use checkpoints in Desktop directory` | Cline이 Desktop 디렉터리에서 checkpoint를 차단함 | Desktop이 아닌 작업폴더(`문서\New project 3`)에서 VS Code를 열고 Cline을 시작하세요. 스크립트가 자동으로 작업폴더를 생성하고 Git을 초기화합니다. |
