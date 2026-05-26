# Azure AI Foundry 바이브코딩 실습 환경

> 학생 50명이 AI와 함께 코딩하는 수업을 위한 셀프서비스 온보딩 플랫폼

---

## 이 시스템은 왜 만들었나요?

"학생 50명에게 AI 코딩 도우미를 나눠주고 싶다."

간단한 목표처럼 들리지만, 실제로 해보면 여러 문제가 생겨요.

- **API 키를 학생마다 따로 발급하면?** Azure OpenAI 키는 리소스당 2개밖에 없어요. 50명에게 나눠줄 수 없고, 원본 키가 유출되면 과금 폭탄을 맞아요.
- **학생이 요청을 너무 많이 보내면?** 한 명이 AI를 과도하게 사용하면 다른 학생들이 쓸 수 없어요. 요청 제한이 필요해요.
- **50명의 환경을 하나하나 세팅하면?** VS Code 설치, 확장 설치, API 키 입력... 수작업으로는 수업 시간이 모자라요.

이 모든 문제를 해결하기 위해, **API 게이트웨이 + 자동 온보딩 + 원클릭 설정 스크립트**를 조합한 플랫폼을 만들었어요.

---

## 왜 이렇게 만들었나요? (아키텍처 선택 이유)

### 왜 APIM(API Management)인가요?

학생에게 진짜 Azure OpenAI 키를 주는 대신, **APIM이 중간에서 대리인 역할**을 해요.

- **학생 1명 = 키 1개 = 모델 3개**: 학생은 하나의 키로 GPT-5.4-mini, GPT-5.5, DeepSeek 세 가지 모델을 모두 사용할 수 있어요.
- **속도 제한**: 분당 10회, 일 200회로 제한해서 한 명이 예산을 독점하는 걸 막아요.
- **진짜 키 숨기기**: APIM이 학생의 키를 검증한 뒤, 백엔드에는 진짜 Azure OpenAI 키를 넣어서 보내요. 학생은 진짜 키를 절대 볼 수 없어요.

### 왜 GitHub Issues로 온보딩하나요?

학생이 웹 페이지에서 신청하면, **GitHub Issue가 자동 생성**되고, **GitHub Actions가 나머지를 처리**해요.

- **무료**: 데이터베이스가 필요 없어요. GitHub Issue 자체가 저장소예요.
- **추적 가능**: 누가 언제 신청했는지, 성공했는지 실패했는지 Issue 히스토리에 다 남아요.
- **이벤트 기반**: Issue가 열리면 자동으로 워크플로우가 시작돼요. 강사가 수동으로 할 일이 없어요.

### 왜 Azure Static Web Apps(SWA)인가요?

학생이 신청하는 웹 페이지와 API를 **무료로 호스팅**할 수 있어요.

- **Free 티어**: 프론트엔드 + API(Azure Functions)가 무료예요.
- **자동 배포**: GitHub에 코드를 push하면 자동으로 배포돼요.
- **내장 API**: Azure Functions가 SWA 안에 포함되어 있어서 별도 서버가 필요 없어요.

### 왜 ACS Email인가요? (Graph API가 아니라)

처음에는 Microsoft Graph API로 이메일을 보내려 했는데, **Exchange Online 라이선스가 중단**돼서 발송이 안 됐어요. Azure Communication Services(ACS) Email은 라이선스 없이도 바로 쓸 수 있어요. 첫 1,000통은 무료예요.

### 왜 PowerShell 설정 스크립트인가요?

학생들의 PC는 **Windows**예요. PowerShell은 Windows에 기본 설치되어 있으니, 추가 프로그램 없이 바로 실행할 수 있어요.

스크립트 하나로 VS Code 설치, Cline 확장 설치, API 설정까지 자동으로 완료돼요.

### 왜 APIM URL 변환 정책이 필요한가요?

학생이 사용하는 Cline 확장은 **OpenAI 형식**으로 요청을 보내요:
```
POST /openai/chat/completions
Body: {"model": "gpt-54-mini", ...}
```

하지만 Azure OpenAI는 **배포 이름 기반 URL**을 기대해요:
```
POST /openai/deployments/gpt-54-mini/chat/completions?api-version=2024-10-21
```

APIM 정책이 이 차이를 **자동으로 변환**해줘요. 학생은 표준 OpenAI 형식만 알면 돼요.

---

## 시스템 아키텍처

```
  ┌──────────────────────────────────────────────────────────────┐
  │                        학생 (Chrome)                          │
  └──────────────────────┬───────────────────────────────────────┘
                         │ HTTPS
                         ▼
  ┌──────────────────────────────────────┐
  │  온보딩 SWA (swa-eduelden-onboard)    │
  │  - GET  /api/slots                   │
  │  - POST /api/onboard                 │
  │  - POST /api/cancel                  │
  │  - POST /api/manage                  │
  └──────────────────────┬───────────────┘
                         │ GitHub API 호출
                         ▼
  ┌──────────────────────────────────────┐
  │  GitHub Issues (온보딩 요청 저장)      │
  └──────────────────────┬───────────────┘
                         │ Issue 생성 트리거
                         ▼
  ┌──────────────────────────────────────┐
  │  GitHub Actions Workflow              │
  │  1. 패스코드 검증                      │
  │  2. APIM 구독 키 조회                  │
  │  3. ACS 이메일 발송                    │
  │  4. Issue 완료 처리                    │
  └──────────────────────┬───────────────┘
                         │ 이메일 수신 → PowerShell 실행
                         ▼
  ┌──────────────────────────────────────┐
  │  VS Code + Cline 확장                 │
  │  (Authorization: Bearer 키)           │
  └──────────────────────┬───────────────┘
                         │
                         ▼
  ┌──────────────────────────────────────┐
  │  Azure APIM (apim-eduelden-ai)        │
  │  - 인증 검증 / 속도 제한 (10/분)        │
  │  - URL 형식 변환 / 백엔드 키 주입       │
  │  - 불필요 파라미터 자동 제거            │
  └────────────┬──────────────┬──────────┘
               │              │
               ▼              ▼
  ┌────────────────┐  ┌───────────────────┐
  │  Azure OpenAI  │  │  DeepSeek V4 Flash │
  │  - gpt-54-mini │  │  (라운드로빈 x2)   │
  │  - gpt-55      │  │                   │
  └────────────────┘  └───────────────────┘

  ┌──────────────────────────────────────┐
  │  관리자 (Chrome)                       │
  └──────────────────────┬───────────────┘
                         │ HTTPS + X-Admin-Token
                         ▼
  ┌──────────────────────────────────────┐
  │  대시보드 SWA (swa-eduelden-dashboard) │
  │  calm-beach-02d18ca00.7.azurestaticapps.net │
  │  - 개요/학생관리/상세/일괄제어/알림설정  │
  └──────────────────────┬───────────────┘
                         │ X-Admin-Token
                         ▼
  ┌──────────────────────────────────────┐
  │  Dashboard API (Azure Functions)      │
  │  - /api/dashboard/overview           │
  │  - /api/dashboard/daily              │
  │  - /api/dashboard/students           │
  │  - /api/dashboard/control            │
  │  - /api/dashboard/alerts             │
  └──────────────────────┬───────────────┘
                         │ KQL 쿼리
                         ▼
  ┌──────────────────────────────────────┐
  │  Log Analytics (ApiManagementGatewayLogs) │
  │  실시간 APIM 사용량 집계               │
  └──────────────────────────────────────┘
```

---

## 디렉터리 구조

```
eduelden-ai-deploy/
│
├── README.md                          # 이 파일 (프로젝트 소개)
├── CLAUDE.md                          # Claude Code 프로젝트 메모리
├── HANDOVER.md                        # 작업 인수인계 문서
│
├── docs/                              # 온보딩 SWA 프론트엔드 + 문서
│   ├── index.html                     # 온보딩 웹 페이지 (학생 신청)
│   ├── staticwebapp.config.json       # SWA 라우팅 설정
│   ├── PRD.md                         # 제품 요구사항 문서 (영문)
│   ├── PRD.ko.md                      # 제품 요구사항 문서 (한국어)
│   ├── INSTALL.md                     # 설치 매뉴얼 (영문)
│   ├── INSTALL.ko.md                  # 설치 매뉴얼 (한국어)
│   ├── USER-GUIDE.md                  # 사용자 가이드 (영문)
│   ├── USER-GUIDE.ko.md              # 사용자 가이드 (한국어)
│   ├── budget-plan.md                 # 예산 계획
│   ├── manual-setup-guide.md          # 수동 설정 가이드
│   └── resource-cleanup.md            # 리소스 정리 가이드
│
├── dashboard/                         # 관리자 대시보드 SWA (React + Vite)
│   ├── src/
│   │   ├── pages/                     # 6개 페이지 컴포넌트
│   │   │   ├── Login.jsx              # 로그인 (X-Admin-Token 인증)
│   │   │   ├── Overview.jsx           # 전체 개요 (예산 게이지, 모델별 사용량)
│   │   │   ├── Students.jsx           # 학생 목록
│   │   │   ├── StudentDetail.jsx      # 학생 상세
│   │   │   ├── BulkControl.jsx        # 일괄 제어 (키 활성화/정지)
│   │   │   └── AlertSettings.jsx      # 알림 설정
│   │   └── App.jsx
│   ├── staticwebapp.config.json       # 대시보드 SWA 라우팅
│   ├── package.json
│   └── vite.config.js
│
├── api/                               # SWA 공유 백엔드 (Azure Functions v4, Node.js)
│   └── src/
│       ├── functions/
│       │   ├── slots.js               # GET  /api/slots - 슬롯 현황 조회
│       │   ├── onboard.js             # POST /api/onboard - 온보딩 신청
│       │   ├── cancel.js              # POST /api/cancel - 온보딩 취소
│       │   ├── admin.js               # POST /api/manage - 관리자 액션
│       │   ├── dashboard-overview.js  # GET  /api/dashboard/overview
│       │   ├── dashboard-daily.js     # GET  /api/dashboard/daily
│       │   ├── dashboard-students.js  # GET  /api/dashboard/students
│       │   ├── dashboard-control.js   # POST /api/dashboard/control
│       │   ├── dashboard-alerts.js    # GET/POST /api/dashboard/alerts
│       │   └── dashboard-health.js    # GET  /api/dashboard/health
│       └── lib/
│           ├── log-analytics.js       # Log Analytics KQL 클라이언트
│           └── azure-client.js        # Azure SDK 공통 초기화
│
├── .github/
│   ├── workflows/
│   │   ├── student-onboarding.yml     # 핵심: Issue → 키 발급 → 이메일 파이프라인
│   │   ├── key-management.yml         # APIM 키 회전
│   │   ├── cost-monitor.yml           # 일일 비용 리포트 (09:00 KST)
│   │   ├── azure-static-web-apps-*.yml # 온보딩 SWA 자동 배포
│   │   └── dashboard-deploy.yml       # 대시보드 SWA 자동 배포
│   └── ISSUE_TEMPLATE/
│       └── student-onboarding.yml     # 온보딩 Issue 템플릿
│
├── scripts/
│   └── setup-student.ps1              # 학생 PC 자동 설정 (영문 출력)
│                                      # VS Code, Cline, Power BI MCP 설치 포함
│
├── events/                            # 이벤트/워크숍별 설정
│   └── powerbi-mcp-20260530/          # Power BI MCP 워크숍 (2026-05-30)
│       ├── setup-powerbi-mcp.ps1      # 워크숍 전용 설치 스크립트
│       ├── config.json                # 행사 설정
│       ├── email-template.html        # 사전 안내 이메일 템플릿
│       └── files/실습파일.pbix         # 실습용 Power BI 파일
│
├── ai-class-starter/                  # 학생용 스타터 프로젝트
│   ├── README.md
│   ├── requirements.txt
│   └── app/
│       ├── __init__.py
│       └── main.py
│
├── .secrets/                          # 시크릿 (git에 포함하지 않음)
│   ├── azure-credentials.json
│   ├── graph-app-credentials.json
│   ├── ai-resource-key.txt
│   └── student_keys.csv
│
├── mcp.template.json                  # MCP 서버 설정 템플릿
└── setup-claude-code.ps1              # Claude Code 개발 환경 설정
```

---

## 빠른 시작 (강사용)

### 사전 준비

- Azure 구독 (Owner 권한)
- Azure CLI 2.50+ (`az login` 완료) — `az --version`으로 확인
- GitHub 계정 + `gh` CLI 2.0+ — `gh --version`으로 확인
- 학생 계정 (`01@도메인` ~ `50@도메인`) 미리 생성
- Node.js 18.x 또는 20.x LTS — `node --version`으로 확인

### 설치 순서

전체 설치 과정은 8단계(Phase)로 나뉘어요. 자세한 내용은 [설치 매뉴얼](docs/INSTALL.ko.md)을 참고하세요.

| Phase | 내용 | 예상 시간 |
|---|---|---|
| 1 | 리소스 그룹 + 예산 설정 | 5분 |
| 2 | AI Foundry 모델 배포 | 10분 |
| 3 | Entra ID + RBAC 설정 | 10분 |
| 4 | APIM 생성 + 정책 적용 | **30~45분** (프로비저닝 대기) |
| 5 | ACS 이메일 서비스 설정 | 10분 |
| 6 | GitHub 저장소 + 시크릿 설정 | 10분 |
| 7 | Static Web App 배포 (온보딩 + 대시보드 각 1개) | 10분 |
| 8 | 엔드투엔드 테스트 + 대시보드 확인 | 15분 |

### 대시보드 배포

관리자 대시보드는 별도 SWA(`swa-eduelden-dashboard`)로 운영돼요.

```bash
# dashboard-deploy.yml 워크플로우가 자동 배포
# GitHub Secrets에 AZURE_SWA_DASHBOARD_TOKEN 등록 필요
gh secret set AZURE_SWA_DASHBOARD_TOKEN --body "<SWA 배포 토큰>"

# 배포 후 URL 확인
az staticwebapp show -n swa-eduelden-dashboard --query defaultHostname -o tsv
# calm-beach-02d18ca00.7.azurestaticapps.net
```

### 수업 당일

1. 학생에게 온보딩 URL과 패스코드를 공유하세요.
2. 학생이 웹 페이지에서 신청하면 자동으로 이메일이 발송돼요.
3. 학생은 이메일의 안내에 따라 PowerShell 스크립트를 실행하면 끝이에요.

### ⚠️ 주의사항

- **APIM 프로비저닝**: Developer SKU 생성에 30~45분이 걸려요. 이 시간 동안 다음 단계를 실행하면 실패해요.
- **DeepSeek 약관**: Marketplace 모델이므로 첫 배포 전에 Azure Portal에서 약관을 수락해야 해요.
- **동시 온보딩**: GitHub Free 플랜에서는 최대 20개 워크플로우가 동시 실행돼요. 50명이 한꺼번에 신청하면 일부가 대기열에 들어갈 수 있으니, 10명씩 시간차를 두고 신청하도록 안내하세요.
- **APIM 삭제 후 재생성**: 삭제 후 48시간 동안 같은 이름으로 재생성이 안 돼요. 즉시 재생성하려면 `purge` 명령이 필요해요.
- **예산 모니터링**: 예산 이름이 `eduelden-ai-budget`으로 설정되어야 cost-monitor 워크플로우가 정상 동작해요.

---

## 다른 조직에서 사용하기

이 시스템은 어떤 조직이든 재사용할 수 있도록 설계되었어요.

### 1단계: 설정 파일 만들기
```bash
cp config.env.template config.env
```

`config.env`에서 바꿔야 할 핵심 값:

| 항목 | 예시 | 설명 |
|------|------|------|
| `PROJECT_NAME` | `myaiclass` | 모든 Azure 리소스 이름의 기반 |
| `STUDENT_DOMAIN` | `school.ac.kr` | 학생 이메일 도메인 |
| `STUDENT_COUNT` | `30` | 학생 수 (기본 50) |
| `ADMIN_EMAIL` | `admin@school.ac.kr` | 관리자 이메일 |
| `BUDGET_AMOUNT` | `500` | 월 예산 (USD) |

`PROJECT_NAME`을 바꾸면 모든 리소스 이름이 자동으로 바뀌어요:
- APIM: `apim-{PROJECT_NAME}-ai`
- SWA: `swa-{PROJECT_NAME}-onboard`
- 예산: `{PROJECT_NAME}-ai-budget`

### 2단계: 자동 배포
```bash
./scripts/deploy-all.sh
```

### 3단계: 워크플로우 설정
GitHub Repository Variables에 다음 값을 설정하세요 (deploy-all.sh가 자동으로 설정):
- `RG_NAME` — 리소스 그룹 이름
- `APIM_NAME` — APIM 인스턴스 이름
- `AI_RESOURCE_NAME` — AI 리소스 이름
- `BUDGET_NAME` — 예산 이름
- `STUDENT_DOMAIN` — 학생 도메인
- `APIM_GATEWAY` — APIM 게이트웨이 URL

> **학생 설정 스크립트**: `setup-student.ps1`은 `-ApimUrl` 매개변수로 APIM 주소를 변경할 수 있어요:
> ```powershell
> .\setup-student.ps1 -StudentId 01 -ApiKey "key" -ApimUrl "https://apim-myaiclass-ai.azure-api.net"
> ```

### setup-student.ps1 자동화 항목

`scripts/setup-student.ps1` 스크립트 하나로 학생 PC에 필요한 모든 설정이 완료돼요.

| 단계 | 내용 |
|------|------|
| VS Code 설치 | winget으로 설치 (이미 있으면 건너뜀) |
| Cline 확장 설치 | `saoudrizwan.claude-dev` |
| Cline API 설정 | APIM URL + 학생 키 + 모델 ID를 settings.json에 주입 |
| Power BI MCP 설치 | `C:\MCPServers\PowerBIModelingMCP\` 경로에 exe 배포 |
| Cline MCP 설정 | claude_mcp_settings.json에 Power BI MCP 서버 등록 (exe 직접 실행, npx 미사용) |
| 연결 테스트 | APIM 엔드포인트로 간단한 ping 호출 |

> **Power BI MCP 주의**: npx 래퍼를 사용하면 stdout에 경고 메시지가 섞여 MCP JSON-RPC 프로토콜이 오염돼요. 반드시 exe를 직접 실행하도록 설정하세요.

---

## 관련 문서

| 문서 | 영문 | 한국어 |
|---|---|---|
| 제품 요구사항 (PRD) | [docs/PRD.md](docs/PRD.md) | [docs/PRD.ko.md](docs/PRD.ko.md) |
| 설치 매뉴얼 | [docs/INSTALL.md](docs/INSTALL.md) | [docs/INSTALL.ko.md](docs/INSTALL.ko.md) |
| 사용자 가이드 | [docs/USER-GUIDE.md](docs/USER-GUIDE.md) | [docs/USER-GUIDE.ko.md](docs/USER-GUIDE.ko.md) |
| 기술 아키텍처 해설 | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | — |
| 예산 계획 | [docs/budget-plan.md](docs/budget-plan.md) | |
| 수동 설정 가이드 | [docs/manual-setup-guide.md](docs/manual-setup-guide.md) | |
| 리소스 정리 | [docs/resource-cleanup.md](docs/resource-cleanup.md) | |

---

## 기술 스택

| 분류 | 기술 | 용도 |
|---|---|---|
| API 게이트웨이 | Azure API Management (Developer SKU) | 학생 키 관리, 속도 제한, URL 변환, 파라미터 제거 |
| AI 모델 | Azure OpenAI (GPT-5.4-mini, GPT-5.5) | AI 코딩 어시스턴트 백엔드 |
| AI 모델 | DeepSeek V4 Flash (Serverless x2) | 대안 모델, 라운드로빈 분산 |
| 온보딩 프론트엔드 | Azure Static Web Apps — `swa-eduelden-onboard` | 학생 신청 웹 페이지 |
| 대시보드 프론트엔드 | Azure Static Web Apps — `swa-eduelden-dashboard` | 관리자 모니터링 대시보드 |
| 대시보드 UI | React 18 + Vite + Recharts | 실시간 차트, 학생별 통계, 예산 게이지 |
| 백엔드 API | Azure Functions v4 (Node.js) | SWA 내장 API (온보딩 + 대시보드 공용) |
| 모니터링 | Log Analytics — `ApiManagementGatewayLogs` | APIM 사용량 KQL 집계 |
| CI/CD | GitHub Actions | 온보딩 자동화, 키 관리, 비용 모니터링, 대시보드 배포 |
| 이메일 | Azure Communication Services Email | 환영 이메일 발송 (HMAC-SHA256) |
| 학생 IDE | VS Code + Cline 확장 | AI 코딩 어시스턴트 클라이언트 |
| 인증 | Microsoft Entra ID | 학생 계정 관리, RBAC |
| 스크립팅 | PowerShell | 학생 PC 자동 설정 (VS Code, Cline, Power BI MCP) |
| 데이터 저장 | GitHub Issues | 온보딩 요청 기록 (DB 불필요) |

---

## 예산

| 항목 | 금액 | 비고 |
|---|---|---|
| GPT 모델 (5.4-mini + 5.5) | $700 | TPM 제한으로 비용 통제 |
| DeepSeek V4 Flash | $70 | 서버리스 종량제 |
| APIM | ~$50/월 | Developer SKU |
| 버퍼 | $30 | 예비 |
| **합계** | **$800** | 50%, 80%, 95% 단계별 알림 |

---

## 보안 모델

이 시스템은 8개 계층의 보안 구조로 설계되었어요.

| 구간 | 보안 방식 | 설명 |
|------|---------|------|
| 학생 → SWA API | 수업 패스코드 | 수업 참여자만 온보딩 가능 |
| SWA API → GitHub | PAT 토큰 | repo scope로 Issue CRUD |
| GitHub Actions → Azure | 서비스 주체 (RBAC) | Contributor 역할, 리소스 그룹 범위 |
| GitHub Actions → ACS | 연결 문자열 (HMAC-SHA256) | 이메일 발송 인증 |
| 학생 → APIM | APIM 구독 키 | 학생별 개별 키 발급 |
| APIM → Azure OpenAI | Named Value `{{aoai-api-key}}` | 정책에서 안전하게 참조, 학생에게 노출 안 됨 |
| 관리자 → 대시보드 SWA | `X-Admin-Token` 커스텀 헤더 | SWA가 Authorization 헤더를 덮어쓰는 문제 회피 |
| APIM 파라미터 제거 | 인바운드 정책 | `prediction`, `stream_options`, `service_tier` 등 불필요 파라미터 자동 제거 |

> **핵심 원칙**: 학생은 절대로 진짜 Azure OpenAI 키를 볼 수 없어요. APIM이 학생의 키를 검증한 뒤, 백엔드에는 진짜 키를 주입해서 보내요.
> **대시보드 인증**: SWA가 인바운드 Authorization 헤더를 365자 토큰으로 덮어쓰기 때문에, 관리자 인증은 `X-Admin-Token` 커스텀 헤더를 별도로 사용해요.

---

## 자주 발생하는 문제와 해결법

| 문제 | 원인 | 해결 |
|------|------|------|
| SWA API가 404를 반환 | SWA가 `/api/admin*` 경로를 예약함 | 라우트 이름에 `admin`을 사용하지 않음 (→ `/api/manage`) |
| 학생이 401 Unauthorized | API 키가 잘못됨 | 이메일에서 키를 다시 복사 |
| 학생이 404 Resource not found | Base URL 또는 Model ID 오류 | Base URL이 `/v1`로 끝나는지, Model ID가 정확한지 확인 |
| 학생이 429 Too Many Requests | 속도 제한 초과 | 1분 후 재시도 (분당 10회 제한) |
| PowerShell 스크립트 한글 깨짐 | cp949 인코딩 문제 | 스크립트 출력은 전부 영문 (설계상 의도) |
| 이메일이 안 옴 | ACS 도메인 미연결 | Portal에서 Communication Services > Domains 확인 |
| APIM 생성 후 API 오류 | 프로비저닝 미완료 (30~45분 소요) | `az apim show` 로 provisioningState 확인 |
| 대시보드 API 401 — Authorization 헤더 오류 | SWA가 Authorization 헤더를 365자 토큰으로 덮어씀 | `X-Admin-Token` 커스텀 헤더 사용 (이미 적용됨) |
| 대시보드 APIM 로그가 안 보임 | 진단 설정이 AzureDiagnostics(레거시) 모드임 | Log Analytics 진단을 Resource-specific 모드로 전환 (`ApiManagementGatewayLogs` 테이블 확인) |
| Cline에서 `gpt-55` 관련 파라미터 오류 | Cline이 보내는 `prediction`, `stream_options` 등 Azure OpenAI가 모르는 파라미터 | APIM 인바운드 정책에서 자동 제거 (이미 적용됨) |
| Power BI MCP가 Claude에 연결 안 됨 | npx 래퍼 실행 시 stdout에 경고가 섞여 MCP 프로토콜 오염 | `setup-student.ps1` 기준으로 `C:\MCPServers\PowerBIModelingMCP\` exe 직접 실행 |

---

## 라이선스

이 프로젝트는 교육 목적으로 제작되었습니다.

MIT License

Copyright (c) 2026 EduElden

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
