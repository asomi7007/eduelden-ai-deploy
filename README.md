# 🎓 Azure AI Foundry 바이브코딩 실습 환경

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Azure-0078D4?logo=microsoftazure)](https://azure.microsoft.com)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs)](https://nodejs.org)
[![Students](https://img.shields.io/badge/Students-50명-blue)]()

> 학생 50명이 AI와 함께 코딩하는 수업을 위한 셀프서비스 온보딩 플랫폼입니다.

---

## 📑 목차

- [🎯 프로젝트 개요](#-프로젝트-개요)
- [🏗️ 아키텍처](#️-아키텍처)
- [⚡ 핵심 설계 결정](#-핵심-설계-결정)
- [📂 디렉터리 구조](#-디렉터리-구조)
- [🚀 빠른 시작 (강사용)](#-빠른-시작-강사용)
- [🔄 다른 조직에서 사용하기](#-다른-조직에서-사용하기)
- [📚 관련 문서](#-관련-문서)
- [🛠️ 기술 스택](#️-기술-스택)
- [💰 예산](#-예산)
- [🛡️ 보안 모델](#️-보안-모델)
- [🔧 트러블슈팅](#-트러블슈팅)
- [📄 라이선스](#-라이선스)

---

## 🎯 프로젝트 개요

"학생 50명에게 AI 코딩 도우미를 나눠주고 싶다." 간단한 목표처럼 들리지만, 실제로 해보면 여러 문제가 발생합니다.

| 문제 | 설명 |
|------|------|
| **API 키 분배** | Azure OpenAI 키는 리소스당 2개뿐입니다. 50명에게 나눠줄 수 없고, 원본 키가 유출되면 과금 폭탄이 발생합니다. |
| **사용량 통제** | 한 명이 AI를 과도하게 사용하면 다른 학생들이 쓸 수 없습니다. 요청 제한이 필요합니다. |
| **환경 설정** | VS Code 설치, 확장 설치, API 키 입력 등 50명분을 수작업으로 하면 수업 시간이 부족합니다. |

이 모든 문제를 해결하기 위해, **API 게이트웨이 + 자동 온보딩 + 원클릭 설정 스크립트**를 조합한 플랫폼을 구축했습니다.

---

## 🏗️ 아키텍처

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

## ⚡ 핵심 설계 결정

### APIM(API Management)을 사용하는 이유

학생에게 진짜 Azure OpenAI 키를 주는 대신, **APIM이 중간에서 대리인 역할**을 수행합니다.

- **학생 1명 = 키 1개 = 모델 3개**: 하나의 키로 GPT-5.4-mini, GPT-5.5, DeepSeek 세 가지 모델을 모두 사용할 수 있습니다.
- **속도 제한**: 분당 10회, 일 200회로 제한하여 한 명이 예산을 독점하는 것을 방지합니다.
- **키 은닉**: APIM이 학생의 키를 검증한 뒤, 백엔드에는 진짜 Azure OpenAI 키를 주입하여 전송합니다. 학생은 진짜 키를 절대 볼 수 없습니다.

### GitHub Issues 기반 온보딩

학생이 웹 페이지에서 신청하면, **GitHub Issue가 자동 생성**되고 **GitHub Actions가 나머지를 처리**합니다.

- **무료**: 데이터베이스가 필요 없습니다. GitHub Issue 자체가 저장소입니다.
- **추적 가능**: 누가 언제 신청했는지, 성공/실패 여부가 Issue 히스토리에 남습니다.
- **이벤트 기반**: Issue가 열리면 자동으로 워크플로우가 시작됩니다. 강사가 수동으로 할 일이 없습니다.

### Azure Static Web Apps(SWA)

학생 신청 웹 페이지와 API를 **무료로 호스팅**할 수 있습니다.

- **Free 티어**: 프론트엔드 + API(Azure Functions)가 무료입니다.
- **자동 배포**: GitHub에 코드를 push하면 자동으로 배포됩니다.
- **내장 API**: Azure Functions가 SWA 안에 포함되어 있어 별도 서버가 필요 없습니다.

### ACS Email (Graph API 대신)

처음에는 Microsoft Graph API로 이메일을 보내려 했으나, **Exchange Online 라이선스가 중단**되어 발송이 불가능했습니다. Azure Communication Services(ACS) Email은 라이선스 없이 바로 사용 가능하며, 첫 1,000통은 무료입니다.

### APIM URL 변환 정책

Cline 확장은 **OpenAI 형식**(`POST /openai/chat/completions`)으로 요청을 보내지만, Azure OpenAI는 **배포 이름 기반 URL**(`POST /openai/deployments/{model}/chat/completions?api-version=...`)을 요구합니다. APIM 정책이 이 차이를 **자동으로 변환**하므로, 학생은 표준 OpenAI 형식만 알면 됩니다.

---

## 📂 디렉터리 구조

```
eduelden-ai-deploy/
│
├── README.md                          # 프로젝트 소개
├── CLAUDE.md                          # Claude Code 프로젝트 메모리
├── HANDOVER.md                        # 작업 인수인계 문서
│
├── docs/                              # 온보딩 SWA 프론트엔드 + 문서
│   ├── index.html                     # 온보딩 웹 페이지 (학생 신청)
│   ├── staticwebapp.config.json       # SWA 라우팅 설정
│   ├── PRD.md / PRD.ko.md             # 제품 요구사항 문서 (EN/KO)
│   ├── INSTALL.md / INSTALL.ko.md     # 설치 매뉴얼 (EN/KO)
│   ├── USER-GUIDE.md / USER-GUIDE.ko.md # 사용자 가이드 (EN/KO)
│   ├── ARCHITECTURE.md                # 기술 아키텍처 해설
│   ├── budget-plan.md                 # 예산 계획
│   ├── manual-setup-guide.md          # 수동 설정 가이드
│   └── resource-cleanup.md            # 리소스 정리 가이드
│
├── dashboard/                         # 관리자 대시보드 SWA (React + Vite)
│   ├── src/pages/                     # 6개 페이지 (Login, Overview, Students, ...)
│   ├── staticwebapp.config.json       # 대시보드 SWA 라우팅
│   ├── package.json
│   └── vite.config.js
│
├── api/                               # SWA 공유 백엔드 (Azure Functions v4, Node.js)
│   └── src/
│       ├── functions/                 # 온보딩 API + 대시보드 API
│       └── lib/                       # 공통 모듈 (Log Analytics, Azure SDK)
│
├── .github/
│   ├── workflows/                     # CI/CD 파이프라인
│   │   ├── student-onboarding.yml     # Issue → 키 발급 → 이메일
│   │   ├── key-management.yml         # APIM 키 회전
│   │   ├── cost-monitor.yml           # 일일 비용 리포트 (09:00 KST)
│   │   └── dashboard-deploy.yml       # 대시보드 SWA 자동 배포
│   └── ISSUE_TEMPLATE/
│       └── student-onboarding.yml     # 온보딩 Issue 템플릿
│
├── scripts/
│   └── setup-student.ps1              # 학생 PC 자동 설정 스크립트
│
├── events/                            # 이벤트/워크숍별 설정
│   └── powerbi-mcp-20260530/          # Power BI MCP 워크숍 (2026-05-30)
│
├── ai-class-starter/                  # 학생용 스타터 프로젝트
│
├── .secrets/                          # 시크릿 (git에 포함하지 않음)
├── mcp.template.json                  # MCP 서버 설정 템플릿
└── setup-claude-code.ps1              # Claude Code 개발 환경 설정
```

---

## 🚀 빠른 시작 (강사용)

### 사전 준비

- Azure 구독 (Owner 권한)
- Azure CLI 2.50+ (`az login` 완료)
- GitHub 계정 + `gh` CLI 2.0+
- 학생 계정 (`01@도메인` ~ `50@도메인`) 미리 생성
- Node.js 18.x 또는 20.x LTS

### 설치 순서

전체 설치 과정은 8단계(Phase)로 나뉩니다. 자세한 내용은 [설치 매뉴얼](docs/INSTALL.ko.md)을 참고하시기 바랍니다.

| Phase | 내용 | 예상 시간 |
|-------|------|----------|
| 1 | 리소스 그룹 + 예산 설정 | 5분 |
| 2 | AI Foundry 모델 배포 | 10분 |
| 3 | Entra ID + RBAC 설정 | 10분 |
| 4 | APIM 생성 + 정책 적용 | **30~45분** (프로비저닝 대기) |
| 5 | ACS 이메일 서비스 설정 | 10분 |
| 6 | GitHub 저장소 + 시크릿 설정 | 10분 |
| 7 | Static Web App 배포 (온보딩 + 대시보드) | 10분 |
| 8 | 엔드투엔드 테스트 + 대시보드 확인 | 15분 |

### 대시보드 배포

관리자 대시보드는 별도 SWA(`swa-eduelden-dashboard`)로 운영됩니다.

```bash
# dashboard-deploy.yml 워크플로우가 자동 배포
# GitHub Secrets에 AZURE_SWA_DASHBOARD_TOKEN 등록 필요
gh secret set AZURE_SWA_DASHBOARD_TOKEN --body "<SWA 배포 토큰>"

# 배포 후 URL 확인
az staticwebapp show -n swa-eduelden-dashboard --query defaultHostname -o tsv
```

### 수업 당일

1. 학생에게 온보딩 URL과 패스코드를 공유합니다.
2. 학생이 웹 페이지에서 신청하면 자동으로 이메일이 발송됩니다.
3. 학생은 이메일의 안내에 따라 PowerShell 스크립트를 실행하면 완료됩니다.

### ⚠️ 주의사항

- **APIM 프로비저닝**: Developer SKU 생성에 30~45분이 소요됩니다. 이 시간 동안 다음 단계를 실행하면 실패합니다.
- **DeepSeek 약관**: Marketplace 모델이므로 첫 배포 전에 Azure Portal에서 약관을 수락해야 합니다.
- **동시 온보딩**: GitHub Free 플랜에서는 최대 20개 워크플로우가 동시 실행됩니다. 50명이 한꺼번에 신청하면 일부가 대기열에 들어갈 수 있으므로, 10명씩 시간차를 두고 신청하도록 안내하십시오.
- **APIM 삭제 후 재생성**: 삭제 후 48시간 동안 같은 이름으로 재생성이 불가능합니다. 즉시 재생성하려면 `purge` 명령이 필요합니다.
- **예산 모니터링**: 예산 이름이 `eduelden-ai-budget`으로 설정되어야 cost-monitor 워크플로우가 정상 동작합니다.

---

## 🔄 다른 조직에서 사용하기

이 시스템은 어떤 조직이든 재사용할 수 있도록 설계되었습니다.

### 1단계: 설정 파일 만들기

```bash
cp config.env.template config.env
```

`config.env`에서 변경해야 할 핵심 값은 다음과 같습니다.

| 항목 | 예시 | 설명 |
|------|------|------|
| `PROJECT_NAME` | `myaiclass` | 모든 Azure 리소스 이름의 기반 |
| `STUDENT_DOMAIN` | `school.ac.kr` | 학생 이메일 도메인 |
| `STUDENT_COUNT` | `30` | 학생 수 (기본 50) |
| `ADMIN_EMAIL` | `admin@school.ac.kr` | 관리자 이메일 |
| `BUDGET_AMOUNT` | `500` | 월 예산 (USD) |

`PROJECT_NAME`을 변경하면 모든 리소스 이름이 자동으로 변경됩니다:

- APIM: `apim-{PROJECT_NAME}-ai`
- SWA: `swa-{PROJECT_NAME}-onboard`
- 예산: `{PROJECT_NAME}-ai-budget`

### 2단계: 자동 배포

```bash
./scripts/deploy-all.sh
```

### 3단계: 워크플로우 설정

GitHub Repository Variables에 다음 값을 설정합니다 (`deploy-all.sh`가 자동으로 설정):

- `RG_NAME` — 리소스 그룹 이름
- `APIM_NAME` — APIM 인스턴스 이름
- `AI_RESOURCE_NAME` — AI 리소스 이름
- `BUDGET_NAME` — 예산 이름
- `STUDENT_DOMAIN` — 학생 도메인
- `APIM_GATEWAY` — APIM 게이트웨이 URL

> **학생 설정 스크립트**: `setup-student.ps1`은 `-ApimUrl` 매개변수로 APIM 주소를 변경할 수 있습니다:
> ```powershell
> .\setup-student.ps1 -StudentId 01 -ApiKey "key" -ApimUrl "https://apim-myaiclass-ai.azure-api.net"
> ```

### setup-student.ps1 자동화 항목

`scripts/setup-student.ps1` 스크립트 하나로 학생 PC에 필요한 모든 설정이 완료됩니다.

| 단계 | 내용 |
|------|------|
| VS Code 설치 | winget으로 설치 (이미 있으면 건너뜀) |
| Cline 확장 설치 | `saoudrizwan.claude-dev` |
| Cline API 설정 | APIM URL + 학생 키 + 모델 ID를 settings.json에 주입 |
| Power BI MCP 설치 | `C:\MCPServers\PowerBIModelingMCP\` 경로에 exe 배포 |
| Cline MCP 설정 | claude_mcp_settings.json에 Power BI MCP 서버 등록 (exe 직접 실행, npx 미사용) |
| 연결 테스트 | APIM 엔드포인트로 간단한 ping 호출 |

> **Power BI MCP 주의**: npx 래퍼를 사용하면 stdout에 경고 메시지가 섞여 MCP JSON-RPC 프로토콜이 오염됩니다. 반드시 exe를 직접 실행하도록 설정하십시오.

---

## 📚 관련 문서

| 문서 | 영문 | 한국어 |
|------|------|--------|
| 제품 요구사항 (PRD) | [docs/PRD.md](docs/PRD.md) | [docs/PRD.ko.md](docs/PRD.ko.md) |
| 설치 매뉴얼 | [docs/INSTALL.md](docs/INSTALL.md) | [docs/INSTALL.ko.md](docs/INSTALL.ko.md) |
| 사용자 가이드 | [docs/USER-GUIDE.md](docs/USER-GUIDE.md) | [docs/USER-GUIDE.ko.md](docs/USER-GUIDE.ko.md) |
| 기술 아키텍처 해설 | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | — |
| 예산 계획 | [docs/budget-plan.md](docs/budget-plan.md) | |
| 수동 설정 가이드 | [docs/manual-setup-guide.md](docs/manual-setup-guide.md) | |
| 리소스 정리 | [docs/resource-cleanup.md](docs/resource-cleanup.md) | |

---

## 🛠️ 기술 스택

| 분류 | 기술 | 용도 |
|------|------|------|
| API 게이트웨이 | Azure API Management (Developer SKU) | 학생 키 관리, 속도 제한, URL 변환, 파라미터 제거 |
| AI 모델 | Azure OpenAI (GPT-5.4-mini, GPT-5.5) | AI 코딩 어시스턴트 백엔드 |
| AI 모델 | DeepSeek V4 Flash (Serverless x2) | 대안 모델, 라운드로빈 분산 |
| 온보딩 프론트엔드 | Azure Static Web Apps | 학생 신청 웹 페이지 (`swa-eduelden-onboard`) |
| 대시보드 프론트엔드 | Azure Static Web Apps | 관리자 모니터링 대시보드 (`swa-eduelden-dashboard`) |
| 대시보드 UI | React 18 + Vite + Recharts | 실시간 차트, 학생별 통계, 예산 게이지 |
| 백엔드 API | Azure Functions v4 (Node.js) | SWA 내장 API (온보딩 + 대시보드 공용) |
| 모니터링 | Log Analytics | APIM 사용량 KQL 집계 (`ApiManagementGatewayLogs`) |
| CI/CD | GitHub Actions | 온보딩 자동화, 키 관리, 비용 모니터링, 대시보드 배포 |
| 이메일 | Azure Communication Services Email | 환영 이메일 발송 (HMAC-SHA256) |
| 학생 IDE | VS Code + Cline 확장 | AI 코딩 어시스턴트 클라이언트 |
| 인증 | Microsoft Entra ID | 학생 계정 관리, RBAC |
| 스크립팅 | PowerShell | 학생 PC 자동 설정 (VS Code, Cline, Power BI MCP) |
| 데이터 저장 | GitHub Issues | 온보딩 요청 기록 (DB 불필요) |

---

## 💰 예산

| 항목 | 금액 | 비고 |
|------|------|------|
| GPT 모델 (5.4-mini + 5.5) | $700 | TPM 제한으로 비용 통제 |
| DeepSeek V4 Flash | $70 | 서버리스 종량제 |
| APIM | ~$50/월 | Developer SKU |
| 버퍼 | $30 | 예비 |
| **합계** | **$800** | 50%, 80%, 95% 단계별 알림 |

---

## 🛡️ 보안 모델

이 시스템은 8개 계층의 보안 구조로 설계되었습니다.

| 구간 | 보안 방식 | 설명 |
|------|----------|------|
| 학생 → SWA API | 수업 패스코드 | 수업 참여자만 온보딩 가능 |
| SWA API → GitHub | PAT 토큰 | repo scope로 Issue CRUD |
| GitHub Actions → Azure | 서비스 주체 (RBAC) | Contributor 역할, 리소스 그룹 범위 |
| GitHub Actions → ACS | 연결 문자열 (HMAC-SHA256) | 이메일 발송 인증 |
| 학생 → APIM | APIM 구독 키 | 학생별 개별 키 발급 |
| APIM → Azure OpenAI | Named Value `{{aoai-api-key}}` | 정책에서 안전하게 참조, 학생에게 노출 안 됨 |
| 관리자 → 대시보드 SWA | `X-Admin-Token` 커스텀 헤더 | SWA가 Authorization 헤더를 덮어쓰는 문제 회피 |
| APIM 파라미터 제거 | 인바운드 정책 | `prediction`, `stream_options`, `service_tier` 등 불필요 파라미터 자동 제거 |

> **핵심 원칙**: 학생은 절대로 진짜 Azure OpenAI 키를 볼 수 없습니다. APIM이 학생의 키를 검증한 뒤, 백엔드에는 진짜 키를 주입하여 전송합니다.

---

## 🔧 트러블슈팅

| 문제 | 원인 | 해결 |
|------|------|------|
| SWA API가 404를 반환 | SWA가 `/api/admin*` 경로를 예약함 | 라우트 이름에 `admin`을 사용하지 않음 (→ `/api/manage`) |
| 학생이 401 Unauthorized | API 키가 잘못됨 | 이메일에서 키를 다시 복사 |
| 학생이 404 Resource not found | Base URL 또는 Model ID 오류 | Base URL이 `/v1`로 끝나는지, Model ID가 정확한지 확인 |
| 학생이 429 Too Many Requests | 속도 제한 초과 | 1분 후 재시도 (분당 10회 제한) |
| PowerShell 스크립트 한글 깨짐 | cp949 인코딩 문제 | 스크립트 출력은 전부 영문 (설계상 의도) |
| 이메일이 안 옴 | ACS 도메인 미연결 | Portal에서 Communication Services > Domains 확인 |
| APIM 생성 후 API 오류 | 프로비저닝 미완료 (30~45분 소요) | `az apim show`로 provisioningState 확인 |
| 대시보드 API 401 | SWA가 Authorization 헤더를 365자 토큰으로 덮어씀 | `X-Admin-Token` 커스텀 헤더 사용 (이미 적용됨) |
| 대시보드 APIM 로그 미표시 | 진단 설정이 레거시 모드 | Resource-specific 모드로 전환 (`ApiManagementGatewayLogs` 확인) |
| Cline 파라미터 오류 | `prediction`, `stream_options` 등 미지원 파라미터 | APIM 인바운드 정책에서 자동 제거 (이미 적용됨) |
| Power BI MCP 연결 실패 | npx 래퍼 stdout 오염으로 MCP 프로토콜 깨짐 | exe 직접 실행 (`C:\MCPServers\PowerBIModelingMCP\`) |

---

## 📄 라이선스

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
