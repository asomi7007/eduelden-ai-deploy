# Cowork → Claude Code 핸드오프 문서

> Cowork 모드에서 시작한 작업을 로컬 Claude Code로 이관하면서 모든 컨텍스트를 정리한 문서.
> Claude Code 새 세션에서 **첫 프롬프트로 이 파일을 읽고 다음 단계를 진행**하세요.

---

## TL;DR — Claude Code에게 줄 첫 프롬프트

```text
이 폴더의 CLAUDE.md와 HANDOVER.md를 읽고, Phase별 체크리스트를 TodoWrite로 등록한 다음
Phase 0부터 시작해줘. Azure MCP가 연결되어 있는지 먼저 mcp list로 확인하고,
연결되어 있으면 그걸로 az 명령을 실행해. 안 되면 사용자에게 Cloud Shell에서 실행할
명령어를 보여주고 결과를 받아서 진행해.
```

---

## 지금까지 한 일 (세션 요약)

### Cowork 초기 세션

1. ✅ 가이드 docx 파일 분석 — 8개 Phase, 50명 학생, $800 예산, 3개 모델 구조 파악
2. ✅ 가이드 vs 실제 환경 차이 식별:
   - 가이드 적힌 리소스명 `eduelden09-8782-resource` → 실제는 `eduelden-ai-resource`
   - 가이드 적힌 프로젝트명 `eduelden09-8782` → 실제는 `eduelden-ai`
3. ✅ 사용자와 4가지 의사결정 확정 (모델·시작 단계·실행 주체·GitHub repo)
4. ✅ Cowork MCP 레지스트리 검색 — Azure/GitHub/Graph MCP 모두 없음 확인
5. ✅ **Claude Code로 이관 결정**

### Claude Code 세션 (Phase 진행)

1. ✅ Phase 0 — 사전 준비 점검 완료 (구독·리소스·학생계정 확인)
2. ✅ Phase 1 — 예산 $800 + 알림 3단계 (50%/80%/95%) 생성 완료
3. ✅ Phase 2 — 모델 배포 완료 (GPT-5.4-mini, GPT-5.5, DeepSeek-V4-Flash x2)
4. ✅ Phase 3 — Entra ID 보안그룹 + RBAC + Graph API 앱 등록 완료
5. ✅ Phase 4 — APIM `apim-eduelden-ai` 배포 + 정책 적용 완료
    - Named Value `{{aoai-api-key}}`로 키 안전 참조
    - Cline 호환 파라미터 자동 제거 정책 (`prediction`, `stream_options` 등)
    - 학생 구독 키 50개 생성 (`sub-student-01` ~ `sub-student-50`)
    - 진단 설정: Resource-specific 모드 (`ApiManagementGatewayLogs`)
6. ✅ Phase 5 — GitHub Actions 온보딩 워크플로우 완료 (student-onboarding, key-management, cost-monitor)
7. ✅ Phase 6 — `setup-student.ps1` 완성 (VS Code, Cline, Power BI MCP 설치 포함)
    - npx 래퍼 대신 Windows exe 직접 실행 방식으로 MCP 등록
    - `C:\MCPServers\PowerBIModelingMCP\` 경로
8. ✅ Phase 7 — SWA 배포 완료
    - 온보딩 SWA: `swa-eduelden-onboard`
    - 대시보드 SWA: `swa-eduelden-dashboard` (`calm-beach-02d18ca00.7.azurestaticapps.net`)
    - 대시보드 소스: `dashboard/` 폴더 (React + Vite + Recharts)
    - 대시보드 6개 페이지: 로그인, 개요, 학생관리, 학생상세, 일괄제어, 알림설정
    - 대시보드 API 6개 함수: overview, daily, students, control, alerts, health
    - 인증: `X-Admin-Token` 커스텀 헤더 (SWA Authorization 헤더 충돌 회피)
    - KQL: `union ApiManagementGatewayLogs, AzureDiagnostics` (양쪽 모드 호환)
9. ✅ Phase 8 — 모니터링 설정 + 엔드투엔드 테스트 완료

## 사용자가 확정한 의사결정

| 질문 | 답 |
|---|---|
| 모델 선택 | 가이드 문서에 적힌 모델명 그대로 사용 (사용자가 실제 카탈로그에서 확인했다고 함) — **단, Phase 2 첫 단계에서 재검증** |
| 시작 단계 | Phase 0부터 순서대로 |
| 실행 주체 | MCP 가능하면 Claude가 직접, 안 되면 사용자가 Cloud Shell에서 |
| GitHub repo | `asomi7007/eduelden-ai-deploy` Private 새로 생성 |
| 환경 이관 | Cowork → Claude Code (현재 진행 중) |

## 사용자 환경 (확정)

- OS: Windows
- Azure CLI 설치됨, `az login` 된 상태로 가정
- Azure AI Foundry CLI 설치됨
- GitHub 계정: `asomi7007`
- Azure 권한: 구독 소유자(Owner) 또는 동급
- GitHub 연결 의사: 있음

## Phase별 체크리스트 (Claude Code TodoWrite로 등록할 항목)

### Phase 0 — 사전 준비 점검

- [x] 0-1. 구독 활성·리소스 그룹 접근 확인 (`az group show`)
- [x] 0-2. 현재 사용자 RBAC 권한 확인 (Owner 또는 동급)
- [x] 0-3. AI Foundry 리소스 + **모델 카탈로그 조회** (가이드 모델명 검증)
- [x] 0-4. 기 배포된 모델 확인
- [x] 0-5. 학생 계정 샘플(01/25/50) 활성 확인
- [x] 0-6. 테넌트 ID + 관리자 계정 확인

### Phase 1 — 예산 및 비용 통제

- [x] 1-1. Cost Management 예산 $800 생성 (RG 범위, Monthly)
- [x] 1-2. 알림 3단계 (50%/$400, 80%/$640, 95%/$760) → admin@eldensoluton.kr
- [x] 1-3. 모델별 예산 배분 계획 문서화

### Phase 2 — AI Foundry 모델 배포

- [x] 2-0. **모델 카탈로그 재확인** (Phase 0-3 결과 기반으로 모델명 최종 확정)
- [x] 2-1. 모델 A 배포 (GPT-5.5, TPM 50K)
- [x] 2-2. 모델 B 배포 (GPT-5.4-mini, TPM 100K)
- [x] 2-3. DeepSeek-V4-Flash × 2 서버리스 배포 (Marketplace 약관 — 수동)
- [x] 2-4. Playground에서 3개 모델 응답 테스트

### Phase 3 — Entra ID + RBAC

- [x] 3-1. 학생 계정 확인 (이미 존재함, 50명 전체 검증)
- [x] 3-2. 보안그룹 `AI-Class-Students-Eduelden` 생성
- [x] 3-3. 학생 50명을 그룹에 일괄 추가
- [x] 3-4. Cognitive Services User 역할을 그룹에 할당
- [x] 3-5. Graph API 앱 `eduelden-github-actions-mailer` 등록
- [x] 3-6. Mail.Send 권한 추가 + **관리자 동의 클릭(Portal 수동)**

### Phase 4 — APIM 설정

- [x] 4-1. APIM 인스턴스 `apim-eduelden-ai` 배포 (Developer SKU, ~$50/월)
- [x] 4-2. OpenAI Proxy API 등록 + 정책 (Rate Limit, Quota, Named Value 키 주입)
- [x] 4-3. DeepSeek API 등록 + 라운드로빈 정책
- [x] 4-4. 학생 구독 50개 생성 (`sub-student-01` ~ `sub-student-50`)
- [x] 4-5. 학생 키 CSV 내보내기 (안전한 위치, 평문 chat 출력 금지)
- [x] 4-6. 엔드투엔드 테스트 (1명 키로 3개 모델 호출)
- [x] 4-7. Cline 호환 파라미터 자동 제거 정책 추가 (`prediction`, `stream_options`, `service_tier`, `store`, `metadata`, `reasoning_effort`)
- [x] 4-8. Log Analytics 진단 설정: Resource-specific 모드 (`ApiManagementGatewayLogs`)

### Phase 5 — GitHub Actions 온보딩

- [x] 5-1. Private repo `asomi7007/eduelden-ai-deploy` 생성
- [x] 5-2. 배포 스크립트 4종 작성 (`01_deploy_foundry.sh`, `02_manage_keys.sh`, `setup-student.ps1`, `cost-monitor.sh`)
- [x] 5-3. GitHub Actions 워크플로우 3종 작성 (student-onboarding.yml, key-management.yml, cost-monitor.yml)
- [x] 5-4. Issue 템플릿 작성 (`student-onboarding.yml`)
- [x] 5-5. 시크릿 6개 등록 (AZURE_CREDENTIALS, GRAPH_*, SENDER_EMAIL 등)
- [x] 5-6. 라벨 5개 생성
- [x] 5-7. 테스트 계정 1명 온보딩 → 이메일 수신 확인

### Phase 6 — 학생 PC 설정 스크립트

- [x] 6-1. `setup-student.ps1` 완성 (VS Code/Cline 설치, API 설정, 연결 테스트)
- [x] 6-2. PowerShell 실행 정책 안내 포함
- [x] 6-3. 수동 설정 대체 가이드 문서
- [x] 6-4. Power BI MCP 설치 자동화 (`C:\MCPServers\PowerBIModelingMCP\`, exe 직접 실행)

### Phase 7 — Static Web Apps 배포 (온보딩 + 대시보드)

- [x] 7-1. `ai-class-starter` repo 준비 (FastAPI 샘플 + 일부러 넣은 버그 + 빈 폴더 옵션)
- [x] 7-2. README — 4단계 실습 가이드 (분석/버그수정/기능추가/풀앱생성)
- [x] 7-3. 온보딩 SWA `swa-eduelden-onboard` 배포
- [x] 7-4. 대시보드 SWA `swa-eduelden-dashboard` 생성 및 배포
  - URL: `calm-beach-02d18ca00.7.azurestaticapps.net`
  - 소스: `dashboard/` (React 18 + Vite + Recharts)
  - 6개 페이지: 로그인, 개요, 학생관리, 학생상세, 일괄제어, 알림설정
- [x] 7-5. 대시보드 API 함수 6개 작성 (`dashboard-overview`, `dashboard-daily`, `dashboard-students`, `dashboard-control`, `dashboard-alerts`, `dashboard-health`)
- [x] 7-6. `api/src/lib/log-analytics.js` + `api/src/lib/azure-client.js` 공통 라이브러리 작성
- [x] 7-7. `X-Admin-Token` 인증 방식 도입 (SWA Authorization 헤더 충돌 회피)
- [x] 7-8. KQL: `union ApiManagementGatewayLogs, AzureDiagnostics` (레거시/신규 모드 모두 지원)
- [x] 7-9. `dashboard-deploy.yml` 워크플로우 작성

### Phase 8 — 모니터링 및 정리

- [x] 8-1. cost-monitor.yml 매일 09:00 KST 실행
- [x] 8-2. 학생별 APIM 사용량 조회 스크립트
- [x] 8-3. 키 일괄 비활성화·재발급 스크립트
- [x] 8-4. 수업 후 리소스 정리 절차서

### 최종 검증

- [x] V-1. 테스트 학생 1명 풀 동선 (Issue 신청 → 이메일 → Cline 연결 → 3개 모델 호출)
- [x] V-2. APIM Rate Limit 동작 확인 (10/분 초과 시 429)
- [x] V-3. 비용 알림 50% 트리거 시뮬레이션
- [x] V-4. 키 비활성화 동작 확인

## 배포된 리소스 URL 요약

| 리소스 | URL / 이름 |
|--------|-----------|
| 온보딩 SWA | `swa-eduelden-onboard` (GitHub Actions 자동 배포) |
| 대시보드 SWA | `calm-beach-02d18ca00.7.azurestaticapps.net` |
| APIM 게이트웨이 | `https://apim-eduelden-ai.azure-api.net` |
| AI Foundry 엔드포인트 | `https://eduelden-ai-resource.openai.azure.com/openai/v1` |

## GitHub Secrets 목록

| Secret 이름 | 용도 | 등록 여부 |
|-------------|------|-----------|
| `AZURE_CREDENTIALS` | 서비스 주체 JSON | ✅ |
| `GRAPH_CLIENT_SECRET` | Graph API 이메일 발송 | ✅ |
| `GRAPH_CLIENT_ID` | Graph API 앱 ID | ✅ |
| `GRAPH_TENANT_ID` | 테넌트 ID | ✅ |
| `SENDER_EMAIL` | ACS 발신 이메일 | ✅ |
| `ACS_CONNECTION_STRING` | ACS 연결 문자열 | ✅ |
| `AZURE_SWA_DASHBOARD_TOKEN` | 대시보드 SWA 배포 토큰 | ✅ |
| `ADMIN_TOKEN` | 대시보드 X-Admin-Token 값 | ✅ |

## 시크릿 관리 원칙 (중요)

다음 값들은 **절대로 chat에 평문 출력하지 마세요**:

- `AZURE_CREDENTIALS` (서비스 주체 JSON)
- `GRAPH_CLIENT_SECRET`
- `ADMIN_TOKEN` (대시보드 인증 토큰)
- APIM 학생 구독 키 50개
- API Key 1차/2차 키
- `AZURE_SWA_DASHBOARD_TOKEN` (대시보드 SWA 배포 토큰)

대신:

- `/tmp/eduelden-secrets/` (Cloud Shell) 또는 로컬 폴더에 파일로 저장
- GitHub Secrets 등록은 `gh secret set NAME --body "$VALUE"` 로 변수 참조
- 사용자에게 보여줄 때는 마지막 4자리만 마스킹해서 확인

## 위험 작업 체크리스트 — 실행 전 사용자 확인 필수

| 작업 | 비용 영향 | 되돌리기 |
|---|---|---|
| APIM 배포 | ~$50/월 시작 | RG 삭제 가능 |
| 모델 배포 | 사용량 과금 | 배포 삭제 가능 |
| 학생 계정 50개 생성 | 라이선스 영향 | 일괄 삭제 가능 |
| RBAC 역할 부여 | 없음 | 회수 가능 |
| GitHub repo 생성 | 없음 | 삭제 가능 |
| Graph 앱 관리자 동의 | 보안 영향 | 동의 철회 가능 |

이 작업 들어가기 직전엔 항상 사용자에게 "지금 X를 실행할게요. 진행할까요?" 확인하세요.

## 참고 — 가이드 문서 원본

사용자 PC에 업로드된 원본:
`Azure_AI_Foundry_바이브코딩_가이드_1차시_2026-5-19-.docx`

가이드의 핵심 모순(가이드 vs 실제):

- 리소스명 불일치 (위 표 참고)
- 모델명이 미래 모델(`gpt-5.5`)로 적혀있어 실제 카탈로그 재확인 필요

## 현재 상태 요약 (2026-05-25 기준)

**Phase 0~8 전체 완료.** 대시보드까지 포함해 시스템이 운영 가능한 상태입니다.

### 알려진 이슈 / 주의사항

1. **APIM 로그 이중 구조**: AzureDiagnostics(레거시) → Resource-specific 전환 완료.
   대시보드 KQL은 `union` 으로 양쪽을 합쳐 구 데이터도 함께 표시.
2. **DeepSeek 약관**: Marketplace 모델이므로 Azure Portal에서 한 번 수동 수락이 필요함.
   재배포 시 다시 수락해야 할 수 있음.
3. **APIM 삭제 금지**: 삭제 후 48시간 동안 같은 이름으로 재생성 불가.
   문제가 생기면 `az apim delete --purge` 로 즉시 제거 가능.
4. **대시보드 X-Admin-Token**: SWA 환경변수 `ADMIN_TOKEN` 값과 일치해야 함.
   GitHub Secret `ADMIN_TOKEN` 변경 시 SWA Application settings도 함께 업데이트.

### 다음 추가 작업 후보 (현재 미완료)

- [ ] 학생 실습 스타터 프로젝트 고도화 (버그 추가, 난이도 조절)
- [ ] 대시보드 예산 게이지 Cost Management API 실시간 연동 (현재는 Log Analytics 추정치)
- [ ] 수업 후 일괄 키 비활성화 자동화 스크립트
- [ ] 다음 차시 가이드 문서 작성

## 다음 즉시 액션 (새 세션 시작 시)

1. `claude mcp list` 로 Azure/GitHub MCP 연결 상태 확인
2. `az account show` 로 로그인 상태 확인
3. 대시보드 상태 확인: `https://calm-beach-02d18ca00.7.azurestaticapps.net`
4. 해결이 필요한 이슈가 있으면 위 "알려진 이슈" 항목부터 확인
