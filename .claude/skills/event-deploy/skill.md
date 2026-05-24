---
name: event-deploy
description: "핸즈온/워크숍 행사용 학생 환경 자동 배포 하네스. 행사 목적에 맞는 소프트웨어 설치 스크립트, 환영 이메일 템플릿, MCP 설정을 자동 생성한다. '행사 배포', '워크숍 환경', '핸즈온 설정', '행사 스크립트', 'event setup', '실습 환경' 등의 키워드가 나오면 이 스킬을 사용할 것."
---

# 행사 환경 자동 배포 오케스트레이터

핸즈온/워크숍 행사에 필요한 학생 환경 설정을 자동화하는 산출물을 생성한다.

## 워크플로우

### Phase 1: 행사 정보 수집 (AskUserQuestion 사용)

다음 정보를 사용자에게 질문한다:

**필수 질문:**
1. 행사명과 날짜
2. 참가 인원
3. 학생 계정 형태 (기존 계정 / 새 계정 / 개인 계정)
4. AI 모델 접근 방식 (기존 APIM / GitHub Copilot / API 키 직접 / 없음)

**설치 소프트웨어 질문:**
5. 어떤 소프트웨어가 필요한가? (복수 선택)
   - VS Code, Power BI Desktop, Node.js, Python, etc.
6. VS Code 확장은 무엇이 필요한가?
   - Cline, GitHub Copilot, Python, etc.

**MCP 서버 질문 (Phase 1.5에서 별도 확인):**
7. MCP 서버가 필요한가? 어떤 기능이 필요한가?
   - 이 단계에서는 "기능"만 파악한다 (예: "Power BI 제어", "브라우저 자동화")
   - 실제 패키지 선정은 Phase 1.5에서 검증 후 확정

**배포 방식 질문:**
8. 실습 파일이 있는가? 어디서 다운로드?
9. 온보딩 방식 (웹 온보딩 / 이메일만 / 배치파일 직접 배포)
10. 사전 안내 이메일이 필요한가?

### Phase 1.5: MCP 패키지 검증 및 확인 (필수)

MCP 서버를 등록하기 전에 반드시 이 단계를 거친다.

#### 왜 이 단계가 필요한가
- npm에는 비슷한 이름의 MCP 패키지가 여러 개 존재한다
- 공식 패키지와 커뮤니티 패키지가 혼재한다
- 잘못된 패키지를 넣으면 학생 환경이 깨지고 행사 당일 혼란이 생긴다
- 예시: Power BI MCP의 경우 `@anthropic/mcp-server-powerbi` (존재하지 않음), `powerbi-mcp` (비공식), `@microsoft/powerbi-modeling-mcp` (MS 공식) 등 여러 후보가 있었고, 실제로 틀린 패키지를 넣어서 문제가 발생했다

#### 검증 절차

**Step 1: 후보 패키지 조사**
각 MCP 기능에 대해 npm registry와 공식 문서를 검색한다:
- `npm search` 또는 `npm view <package>` 로 패키지 존재 여부 확인
- 공식 GitHub 저장소의 README에서 실제 설치 명령 확인
- context7 MCP로 최신 문서 참조

**Step 2: 사용자에게 확인 (AskUserQuestion)**
발견한 패키지 정보를 표로 정리해서 사용자에게 보여주고 확인받는다:

```
| 기능 | 패키지명 | 게시자 | 설명 | 필요 인수 |
|------|----------|--------|------|-----------|
| Power BI | @microsoft/powerbi-modeling-mcp@latest | Microsoft | Power BI 모델 제어 | --start --readwrite --skip-confirmation |
| Playwright | @playwright/mcp@latest | Microsoft | 브라우저 자동화 | (없음) |
| Filesystem | @modelcontextprotocol/server-filesystem | Anthropic | 파일시스템 접근 | [허용 경로] |
```

질문: "위 MCP 패키지로 설정하겠습니다. 맞는지 확인해주세요."

**Step 3: 확인 후 레지스트리 업데이트**
사용자가 확인하면 이 스킬의 "검증된 MCP 패키지 레지스트리" 섹션을 업데이트한다.
새로운 패키지나 변경된 패키지가 있으면 이 파일 자체를 수정해서 다음에도 올바른 정보를 사용한다.

### Phase 2: 산출물 생성

수집 및 검증된 정보를 기반으로 다음 파일들을 생성한다:

#### 2-1. 설치 스크립트 (PowerShell)
`events/{event-name}/setup-{event-name}.ps1` 생성:

**스크립트 작성 원칙:**

1. **출력 메시지는 모두 영어로** — 한글 출력은 PowerShell 인코딩 문제로 `TerminatorExpectedAtEndOfString` 파싱 에러를 일으킨다. 유니코드 특수문자(박스 그리기 문자 `═══`, `───`)도 사용 금지. ASCII 문자만 사용한다.

2. **단계별 소요시간 표시** — `[System.Diagnostics.Stopwatch]`를 사용해 각 스텝 완료 시 소요시간을 표시하고, 마지막에 총 소요시간을 표시한다.

3. **Desktop 경로 감지** — `$env:USERPROFILE\Desktop`은 한글 유저명이나 OneDrive 리다이렉트 환경에서 실패한다. 다음 순서로 감지한다:
   ```powershell
   $DesktopPath = [Environment]::GetFolderPath("Desktop")
   if (-not $DesktopPath -or -not (Test-Path $DesktopPath)) {
       try { $DesktopPath = (New-Object -ComObject Shell.Application).Namespace('shell:Desktop').Self.Path } catch {}
   }
   if (-not $DesktopPath -or -not (Test-Path $DesktopPath)) {
       $candidates = @("$env:USERPROFILE\Desktop", "$env:USERPROFILE\OneDrive\Desktop")
       $DesktopPath = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
   }
   ```

4. **Cline MCP 설정 경로** — Cline은 MCP 서버 설정을 다음 경로에서 읽는다:
   ```
   $env:APPDATA\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json
   ```
   **주의:** `~/.cline/data/mcpSettings.json`은 틀린 경로다. 절대 사용하지 않는다.

5. **Cline API 설정은 스크립트로 불가** — API Provider, Base URL, API Key, Model ID는 VS Code의 내부 SQLite(`state.vscdb`)와 SecretStorage에 저장되어 파일 쓰기로 설정할 수 없다. 스크립트에서는:
   - 바탕화면에 `CLINE_API_SETUP.txt` 참조 파일을 생성한다
   - 콘솔에 수동 설정 안내를 출력한다
   - **절대로 `~/.cline/data/globalState.json`이나 `secrets.json`에 쓰지 않는다**

6. **Power BI Desktop 설치** — `winget install Microsoft.PowerBI`는 잘못된 패키지(Cloud Managed Desktop Extension)를 설치할 수 있다. Microsoft Store ID를 사용한다:
   ```powershell
   winget install --id 9NTXR16HNW1T --source msstore --accept-package-agreements --accept-source-agreements --silent
   ```

7. **API 연결 테스트 프롬프트는 영어로** — `"Reply with exactly: Connection OK"` 같이 명확한 영어 프롬프트를 사용한다. 한글 프롬프트는 응답이 깨져서 출력될 수 있다.

#### 2-2. 이메일 템플릿 (GitHub Actions 워크플로우 내장)

이메일은 `.github/workflows/student-onboarding.yml`의 JavaScript 코드 안에 HTML 템플릿으로 작성된다.

**이메일 작성 원칙:**

1. **GitHub Actions YAML 파서 주의** — JavaScript 템플릿 리터럴 안의 내용도 YAML 파서에 영향을 줄 수 있다. 변경 후 반드시 워크플로우 이름이 정상 파싱되는지 확인한다:
   ```bash
   gh api repos/{owner}/{repo}/actions/workflows/{file} --jq '{name}'
   ```
   이름이 파일 경로(`.github/workflows/xxx.yml`)로 나오면 파서가 깨진 것이다.

2. **한 번에 많은 변경 금지** — 이메일 템플릿 수정 시 소규모 변경 → 푸시 → 파서 확인을 반복한다. 한 번에 많은 줄을 바꾸면 어느 변경이 파서를 깨뜨렸는지 추적이 불가능하다.

3. **Cline 수동 설정 안내 포함** — 자동 설치 스크립트 이후 Cline API 설정을 UI에서 직접 해야 한다는 안내 스텝을 이메일에 포함한다.

4. **MCP 패키지명 일치** — 이메일의 자동설치 테이블, 수동설치 섹션, 실제 스크립트의 MCP 패키지명이 모두 일치해야 한다.

#### 2-3. 온보딩 페이지 (선택)
기존 SWA 온보딩 시스템을 활용하거나, 별도 정적 페이지 생성.

### Phase 3: 검증

- 스크립트 문법 검증 (PowerShell parse test)
- **MCP 서버 패키지명이 npm에 실제 존재하는지 확인**
- **이메일 템플릿과 스크립트의 MCP 패키지명 일치 확인**
- 다운로드 URL 유효성 확인
- GitHub Actions 워크플로우 파서 정상 확인
- 이메일 HTML 렌더링 테스트

## 행사별 폴더 구조

```
events/
├── {event-name}/
│   ├── config.json          # 행사 설정
│   ├── setup-{event-name}.ps1  # 설치 스크립트
│   ├── README.md            # 행사 안내
│   └── files/               # 실습 파일
```

## 검증된 MCP 패키지 레지스트리

> 아래 목록은 실제 검증된 패키지만 포함한다. 새 패키지를 추가할 때는 Phase 1.5 절차를 따른다.

| 기능 | 공식 패키지 | 게시자 | 설치 인수 | 비고 |
|------|------------|--------|-----------|------|
| Power BI 모델링 | `@microsoft/powerbi-modeling-mcp@latest` | Microsoft | `--start --readwrite --skip-confirmation --compatibility=full` | MS 공식. `@anthropic/mcp-server-powerbi`는 존재하지 않음 |
| 브라우저 자동화 | `@playwright/mcp@latest` | Microsoft | (없음) | MS 공식. `@anthropic/mcp-server-playwright`는 존재하지 않음 |
| 파일시스템 | `@modelcontextprotocol/server-filesystem` | Anthropic (MCP 프로토콜) | `[허용 디렉터리 경로]` | `@anthropic/mcp-server-filesystem`은 존재하지 않음 |
| SQLite | `@modelcontextprotocol/server-sqlite` | Anthropic (MCP 프로토콜) | `[DB 파일 경로]` | 미검증 — 사용 전 npm 확인 필요 |
| GitHub | `@modelcontextprotocol/server-github` | Anthropic (MCP 프로토콜) | env: GITHUB_TOKEN | 미검증 — 사용 전 npm 확인 필요 |

### 잘못된 패키지 (사용 금지)

| 잘못된 패키지명 | 문제 |
|----------------|------|
| `@anthropic/mcp-server-powerbi` | npm에 존재하지 않음 |
| `@anthropic/mcp-server-playwright` | npm에 존재하지 않음 |
| `@anthropic/mcp-server-filesystem` | npm에 존재하지 않음 |
| `powerbi-mcp` | 비공식 커뮤니티 패키지, MS 공식 사용할 것 |
| `winget install Microsoft.PowerBI` | 잘못된 패키지 설치됨 (Cloud Managed Desktop Extension) |

## Cline 설정 경로 정리

| 설정 항목 | 경로 | 스크립트 설정 가능 여부 |
|-----------|------|----------------------|
| MCP 서버 | `$env:APPDATA\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json` | **가능** (JSON 파일 쓰기) |
| API Provider / Base URL / Model | VS Code 내부 SQLite (`state.vscdb`) | **불가** (UI에서 수동 입력) |
| API Key | VS Code SecretStorage | **불가** (UI에서 수동 입력) |

> `~/.cline/data/globalState.json`, `~/.cline/data/secrets.json`, `~/.cline/data/mcpSettings.json`은 모두 틀린 경로다. Cline은 이 경로를 사용하지 않는다.

## 에러 핸들링

- MCP 패키지가 npm에 없으면: 사용자에게 알리고 수동 설치 가이드 제공
- Power BI Desktop 설치 실패: MS Store ID `9NTXR16HNW1T` 사용, `Microsoft.PowerBI` 사용 금지
- Node.js 설치 실패: 직접 다운로드 URL 제공
- 스크립트 인코딩 에러: 한글/유니코드 출력 제거, ASCII 전용
- GitHub Actions 워크플로우 파서 깨짐: 소규모 변경 → 파서 확인 반복, 마지막 정상 커밋으로 복원 가능하도록 커밋 SHA 기록

## 실제 배포 사례

### Power BI MCP 워크숍 (2026-05-30)
- 폴더: `events/powerbi-mcp-20260530/`
- 스크립트: `setup-powerbi-mcp.ps1`
- MCP: powerbi-modeling-mcp, playwright/mcp, server-filesystem
- 교훈: `@anthropic/mcp-server-powerbi`가 존재하지 않아 MS 공식 패키지로 교체, Cline 설정 경로 수정, 스크립트 한글 출력 → 영어로 전환
