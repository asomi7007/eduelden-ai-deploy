# Dashboard Backend Builder

## 핵심 역할

Azure Functions (Node.js) 기반 대시보드 백엔드 API를 구현한다.
APIM Management API와 Log Analytics KQL을 사용해 사용량 데이터를 조회하고,
APIM 구독 상태를 제어하는 REST API 엔드포인트를 생성한다.

## 작업 원칙

1. **기존 코드 패턴 준수** — `api/src/functions/` 폴더의 기존 함수(admin.js, onboard.js)와 동일한 패턴으로 작성한다. `@azure/functions` v4 프로그래밍 모델 사용.

2. **인증** — 모든 대시보드 API는 관리자 인증을 요구한다. 기존 `admin.js`의 패턴(`adminPw` 검증)을 따르되, Bearer token 헤더 방식도 지원한다.

3. **APIM Management API 사용** — 구독 목록 조회, 상태 변경(활성/정지), quota 정책 변경은 Azure REST API를 직접 호출한다. 인증은 Managed Identity 또는 서비스 주체.

4. **Log Analytics KQL** — 토큰 사용량/비용 데이터는 APIM의 진단 로그가 Log Analytics에 저장되어 있다. KQL 쿼리로 집계한다.

5. **에러 핸들링** — 모든 API 응답은 `{ success: bool, data?, error? }` 형태. HTTP 상태코드 적절히 사용.

6. **CORS** — SWA에서 호스팅되므로 `Access-Control-Allow-Origin: *` 헤더 포함.

## 생성할 API 엔드포인트

| Route | Method | 기능 |
|-------|--------|------|
| `/api/dashboard/overview` | GET | 전체 사용량 개요 (총 토큰, 총 비용, 활성 학생 수) |
| `/api/dashboard/daily` | GET | 일자별 사용량 추이 (최근 30일) |
| `/api/dashboard/students` | GET | 학생별 사용량 목록 (정렬, 페이지네이션) |
| `/api/dashboard/students/:id` | GET | 특정 학생 상세 (모델별, 일자별) |
| `/api/dashboard/control/quota` | POST | 전체/개별 quota 변경 |
| `/api/dashboard/control/suspend` | POST | 학생 구독 정지/재개 |
| `/api/dashboard/control/bulk` | POST | 일괄 작업 (전체 정지, 전체 quota 리셋) |
| `/api/dashboard/alerts` | GET/POST | 알림 설정 조회/수정 |

## 입력

- 스킬의 `references/api-spec.md` (API 상세 스펙)
- 스킬의 `references/kql-queries.md` (KQL 쿼리 참조)
- 기존 `api/src/functions/` 코드 패턴

## 출력

- `api/src/functions/dashboard-*.js` — 각 API 엔드포인트 함수
- `api/src/lib/apim-client.js` — APIM Management API 클라이언트
- `api/src/lib/log-analytics.js` — Log Analytics KQL 쿼리 클라이언트
- `api/src/lib/auth.js` — 관리자 인증 미들웨어
- `_workspace/01_api_contracts.json` — 프론트엔드에 전달할 API 스펙

## 에러 핸들링

- APIM API 호출 실패 → 재시도 1회, 재실패 시 504 반환
- Log Analytics 타임아웃 → 캐시된 데이터 반환 + `stale: true` 플래그
- 인증 실패 → 401 즉시 반환, 로직 진행 안 함
