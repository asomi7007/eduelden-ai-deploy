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
                            +--------------------------+
                            |    학생 브라우저 (Chrome)    |
                            +------------+-------------+
                                         |
                                    HTTPS 접속
                                         |
                            +------------v-------------+
                            |  Azure Static Web Apps    |
                            |  (프론트엔드 + API)        |
                            |  - GET  /api/slots        |
                            |  - POST /api/onboard      |
                            |  - POST /api/cancel       |
                            |  - POST /api/manage       |
                            +------------+-------------+
                                         |
                                  GitHub API 호출
                                         |
                            +------------v-------------+
                            |    GitHub Issues          |
                            |    (온보딩 요청 저장)       |
                            +------------+-------------+
                                         |
                                 Issue 생성 트리거
                                         |
                            +------------v-------------+
                            |  GitHub Actions Workflow  |
                            |  1. 패스코드 검증           |
                            |  2. APIM 구독 키 조회      |
                            |  3. ACS 이메일 발송        |
                            |  4. Issue 완료 처리        |
                            +------------+-------------+
                                         |
                                   이메일 수신
                                         |
                            +------------v-------------+
                            |    학생 이메일             |
                            |    - API 키 안내          |
                            |    - 설정 스크립트 링크     |
                            +------------+-------------+
                                         |
                              PowerShell 스크립트 실행
                                         |
                            +------------v-------------+
                            |  VS Code + Cline 확장     |
                            |  (AI 코딩 어시스턴트)       |
                            +------------+-------------+
                                         |
                             Authorization: Bearer 키
                                         |
                            +------------v-------------+
                            |     Azure APIM            |
                            |  - 인증 검증               |
                            |  - 속도 제한 (10/분)       |
                            |  - URL 형식 변환           |
                            |  - 백엔드 키 주입           |
                            +------+-------+-----------+
                                   |       |
                          +--------+       +--------+
                          |                         |
               +----------v----------+  +-----------v---------+
               |  Azure OpenAI       |  |  DeepSeek V4 Flash  |
               |  - gpt-54-mini      |  |  (라운드로빈 x2)     |
               |  - gpt-55           |  |                     |
               +---------------------+  +---------------------+
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
├── docs/                              # SWA 프론트엔드 + 문서
│   ├── index.html                     # 온보딩 웹 페이지 (학생 신청 + 관리자 대시보드)
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
├── api/                               # SWA 백엔드 (Azure Functions v4, Node.js)
│   └── src/functions/
│       ├── slots.js                   # GET /api/slots - 슬롯 현황 조회
│       ├── onboard.js                 # POST /api/onboard - 온보딩 신청
│       ├── cancel.js                  # POST /api/cancel - 온보딩 취소
│       └── admin.js                   # POST /api/manage - 관리자 대시보드
│
├── .github/
│   ├── workflows/
│   │   ├── student-onboarding.yml     # 핵심: Issue -> 키 발급 -> 이메일 파이프라인
│   │   ├── key-management.yml         # APIM 키 회전
│   │   ├── cost-monitor.yml           # 일일 비용 리포트 (09:00 KST)
│   │   └── azure-static-web-apps-*.yml # SWA 자동 배포
│   └── ISSUE_TEMPLATE/
│       └── student-onboarding.yml     # 온보딩 Issue 템플릿
│
├── scripts/
│   └── setup-student.ps1              # 학생 PC 자동 설정 (영문 출력)
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
- Azure CLI (`az login` 완료)
- GitHub 계정 + `gh` CLI
- 학생 계정 (`01@도메인` ~ `50@도메인`) 미리 생성
- Node.js 18+

### 설치 순서

전체 설치 과정은 8단계(Phase)로 나뉘어요. 자세한 내용은 [설치 매뉴얼](docs/INSTALL.ko.md)을 참고하세요.

| Phase | 내용 | 예상 시간 |
|---|---|---|
| 1 | 리소스 그룹 + 예산 설정 | 5분 |
| 2 | AI Foundry 모델 배포 | 10분 |
| 3 | Entra ID + RBAC 설정 | 10분 |
| 4 | APIM 생성 + 정책 적용 | 30분 |
| 5 | ACS 이메일 서비스 설정 | 10분 |
| 6 | GitHub 저장소 + 시크릿 설정 | 10분 |
| 7 | Static Web App 배포 | 5분 |
| 8 | 엔드투엔드 테스트 | 15분 |

### 수업 당일

1. 학생에게 온보딩 URL과 패스코드를 공유하세요.
2. 학생이 웹 페이지에서 신청하면 자동으로 이메일이 발송돼요.
3. 학생은 이메일의 안내에 따라 PowerShell 스크립트를 실행하면 끝이에요.

---

## 관련 문서

| 문서 | 영문 | 한국어 |
|---|---|---|
| 제품 요구사항 (PRD) | [docs/PRD.md](docs/PRD.md) | [docs/PRD.ko.md](docs/PRD.ko.md) |
| 설치 매뉴얼 | [docs/INSTALL.md](docs/INSTALL.md) | [docs/INSTALL.ko.md](docs/INSTALL.ko.md) |
| 사용자 가이드 | [docs/USER-GUIDE.md](docs/USER-GUIDE.md) | [docs/USER-GUIDE.ko.md](docs/USER-GUIDE.ko.md) |
| 예산 계획 | [docs/budget-plan.md](docs/budget-plan.md) | |
| 수동 설정 가이드 | [docs/manual-setup-guide.md](docs/manual-setup-guide.md) | |
| 리소스 정리 | [docs/resource-cleanup.md](docs/resource-cleanup.md) | |

---

## 기술 스택

| 분류 | 기술 | 용도 |
|---|---|---|
| API 게이트웨이 | Azure API Management (Developer SKU) | 학생 키 관리, 속도 제한, URL 변환 |
| AI 모델 | Azure OpenAI (GPT-5.4-mini, GPT-5.5) | AI 코딩 어시스턴트 백엔드 |
| AI 모델 | DeepSeek V4 Flash (Serverless x2) | 대안 모델, 라운드로빈 분산 |
| 프론트엔드 | Azure Static Web Apps (Free) | 온보딩 웹 페이지 |
| 백엔드 API | Azure Functions v4 (Node.js) | SWA 내장 API |
| CI/CD | GitHub Actions | 온보딩 자동화, 키 관리, 비용 모니터링 |
| 이메일 | Azure Communication Services Email | 환영 이메일 발송 (HMAC-SHA256) |
| 학생 IDE | VS Code + Cline 확장 | AI 코딩 어시스턴트 클라이언트 |
| 인증 | Microsoft Entra ID | 학생 계정 관리, RBAC |
| 스크립팅 | PowerShell | 학생 PC 자동 설정 |
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
