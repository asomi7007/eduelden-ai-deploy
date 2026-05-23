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
7. MCP 서버가 필요한가? 어떤 것?
   - Power BI MCP, Playwright MCP, File MCP, etc.

**배포 방식 질문:**
8. 실습 파일이 있는가? 어디서 다운로드?
9. 온보딩 방식 (웹 온보딩 / 이메일만 / 배치파일 직접 배포)
10. 사전 안내 이메일이 필요한가?

### Phase 2: 산출물 생성

수집된 정보를 기반으로 다음 파일들을 생성한다:

#### 2-1. 설치 스크립트 (PowerShell)
`scripts/setup-{event-name}.ps1` 생성:

```powershell
# 구조:
# 1. 매개변수 정의 (StudentId, ApiKey, 기타 행사별 매개변수)
# 2. 기본 소프트웨어 설치 (VS Code, Node.js, etc.)
# 3. VS Code 확장 설치
# 4. MCP 서버 설정 (Cline의 mcpServers 설정 파일에 기록)
# 5. API/모델 설정
# 6. 실습 파일 다운로드
# 7. 연결 테스트
```

**MCP 설정 원칙:**
Cline의 MCP 서버 설정은 VS Code의 settings.json에 기록한다:
```json
// .vscode/settings.json 또는 User settings
{
  "cline.mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@package/mcp-server"],
      "env": {}
    }
  }
}
```

또는 Cline의 MCP 설정 파일 (`~/.cline/data/mcpSettings.json`)에 직접 기록.

#### 2-2. 이메일 템플릿
`events/{event-name}/email-template.html` 생성:
- 행사 안내
- 설치 방법 (자동/수동)
- 실습 파일 다운로드 링크
- 트러블슈팅 가이드
- 당일 준비물 체크리스트

#### 2-3. 온보딩 페이지 (선택)
기존 SWA 온보딩 시스템을 활용하거나, 별도 정적 페이지 생성.

### Phase 3: 검증

- 스크립트 문법 검증 (PowerShell parse test)
- MCP 서버 패키지명 확인
- 다운로드 URL 유효성 확인
- 이메일 HTML 렌더링 테스트

## 행사별 폴더 구조

```
events/
├── {event-name}/
│   ├── config.json          # 행사 설정
│   ├── setup.ps1            # 설치 스크립트
│   ├── email-template.html  # 이메일 템플릿
│   ├── README.md            # 행사 안내
│   └── files/               # 실습 파일
```

## MCP 서버 레지스트리

자주 사용하는 MCP 서버 목록:

| MCP 서버 | 패키지 | 용도 |
|----------|--------|------|
| Power BI | `@anthropic/mcp-server-powerbi` 또는 `powerbi-mcp` | Power BI Desktop 제어 |
| Playwright | `@anthropic/mcp-server-playwright` 또는 `@playwright/mcp` | 웹 브라우저 자동화 |
| Filesystem | `@anthropic/mcp-server-filesystem` | 파일 시스템 접근 |
| SQLite | `@anthropic/mcp-server-sqlite` | SQLite DB 접근 |
| GitHub | `@anthropic/mcp-server-github` | GitHub API 접근 |

> 패키지명은 실제 npm registry에서 확인 필요. 없으면 사용자에게 알리고 대안 제시.

## 에러 핸들링

- MCP 패키지가 npm에 없으면: 사용자에게 알리고 수동 설치 가이드 제공
- Power BI Desktop 설치 실패 (MS Store 접근 불가): winget 대안 제공
- Node.js 설치 실패: 직접 다운로드 URL 제공
