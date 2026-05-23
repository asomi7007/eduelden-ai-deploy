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
| Node.js 22+ | MCP 서버 실행 런타임 |
| Power BI Desktop | 대시보드 제작 도구 |

## MCP 서버

| 서버 | 패키지 | 용도 |
|------|--------|------|
| Power BI | `@anthropic/mcp-server-powerbi` | AI가 Power BI Desktop을 직접 제어 |
| Playwright | `@anthropic/mcp-server-playwright` | 웹 브라우저 자동화 (디자인 참조) |
| Filesystem | `@anthropic/mcp-server-filesystem` | 실습 파일 읽기/쓰기 |

## 파일 구조

```
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
.\setup-powerbi-mcp.ps1 -StudentId "01" -ApiKey "your-key-here"
```

### 수동 설치

1. [VS Code](https://code.visualstudio.com/download) 설치
2. VS Code에서 Cline 확장 설치 (`saoudrizwan.claude-dev`)
3. [Node.js 22 LTS](https://nodejs.org/) 설치
4. [Power BI Desktop](https://aka.ms/pbidesktopstore) 설치
5. Cline MCP 설정에서 3개 서버 추가

## 관리자 작업

### 이메일 발송

`email-template.html`의 플레이스홀더를 치환하여 발송:
- `{{STUDENT_NAME}}` — 학생 이름
- `{{STUDENT_ID}}` — 학생 계정 (예: 01)
- `{{STUDENT_NUM}}` — 학생 번호 (예: 01)
- `{{API_KEY}}` — APIM 구독 키

### 실습 파일 배치

`files/실습파일.pbix` 파일을 이 디렉토리에 배치하면 스크립트가 자동 다운로드합니다.
