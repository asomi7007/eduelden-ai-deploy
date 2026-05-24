---
name: dashboard-build
description: "APIM 토큰 사용량 모니터링 + 제어 대시보드를 구축하고 Azure에 배포하는 하네스. 학생별/전체/일자별 사용량 조회, quota 배분/수정/정지, 비용 알림 기능을 포함하는 관리자 대시보드를 React + Azure Functions + SWA로 구현한다. '대시보드', '사용량 모니터링', '토큰 사용량', 'quota 관리', '비용 모니터링', '학생 사용량', 'APIM 대시보드', '사용량 제어' 등의 키워드가 나오면 이 스킬을 사용할 것."
---

# APIM 사용량 모니터링 대시보드 빌드 오케스트레이터

학생 50명의 AI API 토큰 사용량을 모니터링하고 제어하는 관리자 대시보드를 구축한다.

## 실행 모드

서브 에이전트 (파이프라인). Phase별로 에이전트를 순차 실행하며, 각 Phase의 산출물이 다음 Phase의 입력이 된다.

## 팀 구성

| 역할 | 에이전트 정의 | subagent_type | 산출물 |
|------|-------------|---------------|--------|
| 백엔드 | `dashboard-backend.md` | general-purpose | `api/src/functions/dashboard-*.js`, `_workspace/01_api_contracts.json` |
| 프론트엔드 | `dashboard-frontend.md` | general-purpose | `dashboard/` 프로젝트 |
| 배포/QA | `dashboard-deployer.md` | general-purpose | 워크플로우, 인프라 스크립트, QA 보고서 |

## 실행 절차

### Phase 0: 사전 확인

1. APIM 진단 로깅이 Log Analytics에 연결되어 있는지 확인
2. 없으면 사용자에게 알리고 진단 설정 스크립트 실행 여부 질문
3. Functions 환경변수 현황 확인

```bash
# APIM 진단 설정 확인
az monitor diagnostic-settings list \
  --resource "/subscriptions/3354f2f5-e261-49af-9ead-2c6938f447a3/resourceGroups/rg-powerplatform-billing/providers/Microsoft.ApiManagement/service/apim-eduelden-ai" \
  --output table
```

### Phase 1: 백엔드 API 구축

**에이전트**: `dashboard-backend.md`

프롬프트:
```
.claude/agents/dashboard-backend.md의 역할에 따라 작업을 수행하라.
references/api-spec.md와 references/kql-queries.md를 읽고 참고하라.
기존 api/src/functions/admin.js 패턴을 따라 대시보드 API를 구현하라.
결과로 _workspace/01_api_contracts.json에 프론트엔드용 API 스펙을 저장하라.
```

**완료 조건**: 모든 API 엔드포인트 파일 생성 + API 스펙 JSON 출력

### Phase 2: 프론트엔드 구축

**에이전트**: `dashboard-frontend.md`

프롬프트:
```
.claude/agents/dashboard-frontend.md의 역할에 따라 작업을 수행하라.
_workspace/01_api_contracts.json을 읽어 API 인터페이스를 파악하라.
references/ui-spec.md를 참고하여 대시보드 React 앱을 구현하라.
dashboard/ 폴더에 완전한 Vite React 프로젝트를 생성하라.
```

**완료 조건**: `dashboard/` 프로젝트 생성, `npm run build` 성공

### Phase 3: 배포 및 QA

**에이전트**: `dashboard-deployer.md`

프롬프트:
```
.claude/agents/dashboard-deployer.md의 역할에 따라 작업을 수행하라.
api/src/functions/dashboard-*.js와 dashboard/ 코드를 검증하라.
GitHub Actions 워크플로우, 인프라 설정, 통합 QA를 수행하라.
결과를 _workspace/03_deploy_checklist.md와 _workspace/04_qa_report.md에 저장하라.
```

**완료 조건**: 워크플로우 파일 생성 + QA 보고서 작성

### Phase 4: 사용자 보고

모든 Phase 완료 후:
1. `_workspace/` 결과 파일 종합
2. 배포 전 필요한 수동 작업 목록 (환경변수 설정, Secret 추가 등)
3. 배포 명령 안내

## 데이터 흐름

```
[Phase 0: 사전 확인]
    │
    ▼
[Phase 1: dashboard-backend]
    │ → _workspace/01_api_contracts.json
    │ → api/src/functions/dashboard-*.js
    │ → api/src/lib/*.js
    ▼
[Phase 2: dashboard-frontend]
    │ → dashboard/ (Vite React project)
    ▼
[Phase 3: dashboard-deployer]
    │ → .github/workflows/dashboard-deploy.yml
    │ → infra/dashboard-setup.sh
    │ → _workspace/03_deploy_checklist.md
    │ → _workspace/04_qa_report.md
    ▼
[Phase 4: 사용자 보고]
```

## Azure 환경 참조값

| 항목 | 값 |
|------|-----|
| 구독 ID | `3354f2f5-e261-49af-9ead-2c6938f447a3` |
| 리소스 그룹 | `rg-powerplatform-billing` |
| APIM 이름 | `apim-eduelden-ai` |
| Log Analytics | `eduelden-ai-resource-logs` |
| App Insights | `eduelden-ai-resource-appinsights` |
| SWA | 기존 SWA 리소스 활용 |
| 학생 구독 | `sub-student-01` ~ `sub-student-50` |
| APIM Base URL | `https://apim-eduelden-ai.azure-api.net` |

## 에러 핸들링

- APIM 진단 로깅 미설정 → Phase 0에서 차단, 설정 스크립트 제공
- API 엔드포인트 구현 실패 → 해당 기능 제외하고 프론트엔드에 "준비 중" 표시
- 프론트엔드 빌드 실패 → 에러 로그 분석 후 1회 재시도
- QA에서 API 불일치 발견 → 백엔드 수정 후 프론트엔드 재확인

## 테스트 시나리오

### 정상 흐름
1. Phase 0에서 APIM 진단 확인 완료
2. Phase 1에서 8개 API 엔드포인트 + 클라이언트 라이브러리 생성
3. Phase 2에서 5개 페이지 + 컴포넌트 세트 생성, 빌드 성공
4. Phase 3에서 워크플로우 생성, QA 통과, 배포 체크리스트 출력

### 에러 흐름: APIM 진단 미설정
1. Phase 0에서 진단 미설정 감지
2. 사용자에게 설정 스크립트 제안 (`az monitor diagnostic-settings create ...`)
3. 사용자 승인 후 스크립트 실행
4. 재확인 후 Phase 1 진행

### 에러 흐름: Managed Identity 미설정
1. Phase 3 QA에서 APIM Management API 호출 시 401 발견
2. 서비스 주체(SP) 기반 인증으로 fallback 코드 제안
3. 사용자에게 SP 생성 + RBAC 할당 스크립트 제공
