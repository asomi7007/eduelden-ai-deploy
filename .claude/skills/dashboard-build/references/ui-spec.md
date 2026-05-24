# Dashboard UI Specification

## 디자인 원칙

1. **간결 우선** — 관리자(강사)가 수업 중에도 빠르게 확인할 수 있도록, 핵심 지표가 한눈에 보여야 한다.
2. **위험 강조** — 예산 초과 임박, 비정상 사용량, 정지된 학생은 빨간색/주황색으로 시각적 경고.
3. **확인 후 실행** — quota 변경, 정지 등 제어 작업은 반드시 확인 모달을 거친다.
4. **다크모드 불필요** — 관리자 전용이므로 라이트 테마만.

## 기술 스택

| 도구 | 버전 | 용도 |
|------|------|------|
| React | 18+ | UI 프레임워크 |
| Vite | 5+ | 빌드 도구 |
| React Router | 6+ | 라우팅 |
| Tailwind CSS | 3+ | 스타일링 |
| Recharts | 2+ | 차트 |
| Lucide React | latest | 아이콘 |

## 프로젝트 구조

```
dashboard/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── api/
│   │   └── client.js          # fetch wrapper + auth
│   ├── context/
│   │   └── AuthContext.jsx     # 인증 상태
│   ├── hooks/
│   │   ├── useApi.js           # 데이터 fetching hook
│   │   └── useInterval.js      # 자동 새로고침
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   ├── OverviewPage.jsx
│   │   ├── StudentsPage.jsx
│   │   ├── StudentDetailPage.jsx
│   │   ├── ControlPage.jsx
│   │   └── AlertsPage.jsx
│   ├── components/
│   │   ├── Layout.jsx          # 사이드바 + 헤더
│   │   ├── Sidebar.jsx
│   │   ├── StatsCard.jsx
│   │   ├── UsageChart.jsx
│   │   ├── StudentTable.jsx
│   │   ├── QuotaControl.jsx
│   │   ├── ConfirmDialog.jsx
│   │   ├── BudgetGauge.jsx
│   │   └── StatusBadge.jsx
│   └── utils/
│       ├── format.js           # 숫자/날짜 포맷
│       └── constants.js        # 모델 목록, 색상 등
└── public/
    └── favicon.svg
```

## 페이지별 상세

### 로그인 (LoginPage)

- 중앙 정렬된 카드형 폼
- 비밀번호 입력 필드 + 로그인 버튼
- 실패 시 빨간색 에러 메시지
- 성공 시 sessionStorage에 토큰 저장, Overview로 리다이렉트

### 개요 (OverviewPage)

**상단 카드 4개 (가로 배열):**
| 카드 | 아이콘 | 값 | 색상 |
|------|--------|-----|------|
| 총 사용량 | Zap | 토큰 수 (K/M 단위) | 파란색 |
| 총 비용 | DollarSign | $XX.XX | 초록색 |
| 활성 학생 | Users | XX/50 | 보라색 |
| 예산 사용률 | PieChart | XX% | 게이지에 따라 변동 |

**예산 게이지:**
- 원형 또는 수평 바 형태
- 0~50%: 초록, 50~80%: 주황, 80%+: 빨강
- 중앙에 `$XX / $800` 텍스트

**일별 추이 차트:**
- AreaChart (Recharts)
- X축: 날짜, Y축: 토큰 수 (왼쪽) + 비용 (오른쪽)
- 모델별 색상 구분 (스택)
- 기간 선택: 7일 / 14일 / 30일 토글 버튼

**하단: 상위 사용자 미니 테이블 (Top 5)**
- 클릭 시 학생 상세로 이동

### 학생 목록 (StudentsPage)

**테이블 컬럼:**
| 컬럼 | 정렬 | 설명 |
|------|------|------|
| # | id asc | 학생 번호 |
| 상태 | - | 초록 뱃지(active) / 빨강 뱃지(suspended) |
| 토큰 | desc | 총 사용 토큰 |
| 비용 | desc | 추정 비용 |
| 호출 수 | desc | API 호출 횟수 |
| 마지막 활동 | desc | 최근 API 호출 시각 |
| Quota | - | 분당/일별 제한 표시 |
| 액션 | - | 정지/재개 버튼 |

**기능:**
- 컬럼 헤더 클릭 시 정렬
- 상태 필터 (전체/활성/정지)
- 검색: 학생 번호로 필터
- 행 클릭 시 학생 상세로 이동
- 체크박스로 복수 선택 → 일괄 작업 버튼 활성화

### 학생 상세 (StudentDetailPage)

**정보 카드:**
- 학생 번호, 상태, 계정(XX@eduelden.kr)
- 현재 Quota (분당/일별)
- 총 사용량/비용

**차트 영역:**
- 일별 사용량 LineChart
- 모델별 분포 PieChart (도넛형)

**제어 패널:**
- Quota 조정 (숫자 입력 또는 슬라이더)
- 정지/재개 버튼 (토글)
- "변경 적용" 버튼 → ConfirmDialog

### 제어 (ControlPage)

**일괄 작업 카드:**
1. **전체 Quota 리셋** — 모든 학생의 quota를 기본값으로 리셋
   - 기본 분당: 10, 기본 일별: 200
   - 커스텀 값 입력 가능
2. **전체 정지** — 모든 학생 구독 일괄 정지 (긴급 상황용)
3. **전체 재개** — 모든 정지된 학생 일괄 재개

각 카드에:
- 영향 범위 표시 ("50명의 학생에게 적용됩니다")
- 확인 모달 필수 (빨간 배경 경고)

### 알림 설정 (AlertsPage)

- 예산 임계치 3단계: 50%, 80%, 95%
- 각 단계별 ON/OFF 토글
- 알림 수신 이메일 입력
- 현재 알림 이력 (발송된 알림 목록)

## 공통 컴포넌트

### Layout

```jsx
// 사이드바 + 메인 콘텐츠
<div className="flex h-screen">
  <Sidebar />
  <main className="flex-1 overflow-auto bg-gray-50 p-6">
    <Outlet />
  </main>
</div>
```

### Sidebar 메뉴

| 아이콘 | 라벨 | 경로 |
|--------|------|------|
| BarChart3 | 개요 | `/` |
| Users | 학생 | `/students` |
| Settings | 제어 | `/control` |
| Bell | 알림 | `/alerts` |

하단: 로그아웃 버튼

### StatsCard

```jsx
<div className="bg-white rounded-xl shadow-sm border p-5">
  <div className="flex items-center gap-3">
    <div className={`p-2 rounded-lg ${bgColor}`}>
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  </div>
</div>
```

### StatusBadge

- active: `bg-green-100 text-green-700` + 초록 dot
- suspended: `bg-red-100 text-red-700` + 빨강 dot

### ConfirmDialog

- 반투명 오버레이
- 중앙 카드: 제목, 설명, 영향 범위
- 버튼: "취소" (회색) + "확인" (빨강, 위험 작업) 또는 (파랑, 일반 작업)
- 위험 작업 시 "확인"을 입력하게 하는 옵션

## 색상 팔레트

| 용도 | 색상 | Tailwind |
|------|------|----------|
| 기본 액센트 | 파랑 | `blue-600` |
| 성공/정상 | 초록 | `green-600` |
| 경고 | 주황 | `amber-500` |
| 위험/에러 | 빨강 | `red-600` |
| 차트 모델별 | - | `blue-500`, `purple-500`, `emerald-500` |

## 자동 새로고침

- Overview 페이지: 5분마다 자동 갱신
- Student 목록: 수동 새로고침 버튼
- 마지막 업데이트 시각 표시: "5분 전 업데이트"

## SWA 라우팅 설정

```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/api/*", "/assets/*"]
  },
  "routes": [
    { "route": "/api/*", "allowedRoles": ["anonymous"] }
  ]
}
```
