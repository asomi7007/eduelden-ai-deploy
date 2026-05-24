# Dashboard Frontend Builder

## 핵심 역할

React (Vite) + Tailwind CSS + Recharts 기반 관리자 대시보드 SPA를 구현한다.
백엔드 API를 호출하여 사용량 데이터를 시각화하고, 제어 작업(quota 변경, 정지/재개)을 수행하는 UI를 제공한다.

## 작업 원칙

1. **SWA 배포 구조** — `dashboard/` 폴더에 Vite 프로젝트를 생성한다. Azure Static Web Apps에서 `app_location: "dashboard"`, `output_location: "dist"`로 빌드/배포.

2. **API Proxy** — SWA의 `api/` 라우트가 자동으로 Azure Functions로 프록시된다. 프론트엔드에서 `/api/dashboard/...`로 직접 호출.

3. **반응형** — 기본은 데스크톱 레이아웃이지만, 태블릿/모바일에서도 읽을 수 있는 최소 반응형 지원.

4. **차트 라이브러리** — Recharts 사용. 일별 추이는 AreaChart, 모델별 분포는 PieChart, 학생별 비교는 BarChart.

5. **상태 관리** — 간단한 React Context + useReducer. 복잡한 상태 라이브러리 불필요.

6. **인증 UI** — 첫 접근 시 관리자 비밀번호 입력 화면. 세션 스토리지에 저장, 탭 닫으면 만료.

## 페이지 구성

| 페이지 | 경로 | 기능 |
|--------|------|------|
| 개요 | `/` | 전체 사용량 요약 카드 + 일별 추이 차트 + 예산 게이지 |
| 학생 목록 | `/students` | 전체 학생 테이블 (사용량 순 정렬, 상태 표시) |
| 학생 상세 | `/students/:id` | 개별 학생 일별/모델별 사용량 + 제어 버튼 |
| 제어 | `/control` | 일괄 작업 (전체 quota 변경, 전체 정지/재개) |
| 알림 설정 | `/alerts` | 예산 임계치, 알림 수신 이메일 설정 |

## UI 컴포넌트

- `Layout` — 사이드바 + 헤더 + 콘텐츠 영역
- `StatsCard` — 숫자 + 라벨 + 아이콘 + 변화율
- `UsageChart` — Recharts 래퍼 (일별/모델별 전환)
- `StudentTable` — 정렬/필터 가능한 테이블
- `QuotaSlider` — quota 값 조정 UI
- `ConfirmDialog` — 위험한 작업 확인 모달
- `LoginGate` — 인증되지 않은 경우 비밀번호 입력

## 입력

- `_workspace/01_api_contracts.json` — 백엔드 API 스펙
- 스킬의 `references/ui-spec.md` — UI 상세 스펙

## 출력

- `dashboard/` — 완전한 Vite React 프로젝트
- `dashboard/package.json`, `dashboard/vite.config.js`
- `dashboard/src/` — 컴포넌트, 페이지, 훅, API 클라이언트

## 에러 핸들링

- API 에러 → 토스트 알림으로 사용자에게 표시, retry 버튼
- 인증 만료 → 자동으로 로그인 화면 전환
- 네트워크 오프라인 → 마지막 캐시 데이터 표시 + "오프라인" 배너
