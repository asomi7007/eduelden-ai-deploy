# Dashboard API Specification

## 인증

모든 대시보드 API는 `Authorization: Bearer <token>` 헤더를 요구한다.
토큰은 관리자 비밀번호 해시를 base64 인코딩한 값.

또는 기존 패턴 호환: POST body에 `{ adminPw: "..." }` 포함.

```javascript
// 인증 미들웨어 패턴
function verifyAdmin(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    return token === process.env.ADMIN_TOKEN;
  }
  // fallback: body에서 adminPw 확인 (기존 호환)
  return false;
}
```

## 환경변수

| 변수명 | 용도 | 예시 |
|--------|------|------|
| `ADMIN_TOKEN` | 대시보드 인증 토큰 | (랜덤 생성) |
| `AZURE_SUBSCRIPTION_ID` | Azure 구독 | `3354f2f5-e261-49af-9ead-2c6938f447a3` |
| `AZURE_RESOURCE_GROUP` | 리소스 그룹 | `rg-powerplatform-billing` |
| `APIM_SERVICE_NAME` | APIM 인스턴스 | `apim-eduelden-ai` |
| `LOG_ANALYTICS_WORKSPACE_ID` | LA 워크스페이스 ID | (az cli로 조회) |
| `AZURE_TENANT_ID` | 테넌트 | (eduelden09outlook.onmicrosoft.com의 ID) |
| `AZURE_CLIENT_ID` | 서비스 주체 앱 ID | (생성 필요) |
| `AZURE_CLIENT_SECRET` | 서비스 주체 시크릿 | (생성 필요) |

## API 상세

### GET /api/dashboard/overview

전체 사용량 개요. 쿼리파라미터로 기간 지정.

**Query params:**
- `period`: `today` | `7d` | `30d` | `all` (기본: `7d`)

**Response:**
```json
{
  "success": true,
  "data": {
    "totalTokens": 1250000,
    "totalCost": 45.50,
    "totalRequests": 3200,
    "activeStudents": 42,
    "suspendedStudents": 3,
    "budgetUsed": 45.50,
    "budgetTotal": 800,
    "budgetPercent": 5.7,
    "topModel": { "name": "gpt-54-mini", "tokens": 800000 },
    "period": "7d"
  }
}
```

### GET /api/dashboard/daily

일별 사용량 추이.

**Query params:**
- `days`: 숫자 (기본: 30, 최대: 90)
- `studentId`: 특정 학생만 (선택)

**Response:**
```json
{
  "success": true,
  "data": {
    "days": [
      {
        "date": "2026-05-24",
        "tokens": 45000,
        "cost": 1.80,
        "requests": 120,
        "models": {
          "gpt-54-mini": { "tokens": 30000, "requests": 80 },
          "gpt-55": { "tokens": 10000, "requests": 30 },
          "deepseek-v4-flash": { "tokens": 5000, "requests": 10 }
        }
      }
    ]
  }
}
```

### GET /api/dashboard/students

학생별 사용량 목록.

**Query params:**
- `sort`: `tokens` | `cost` | `requests` | `id` (기본: `tokens`)
- `order`: `asc` | `desc` (기본: `desc`)
- `status`: `active` | `suspended` | `all` (기본: `all`)

**Response:**
```json
{
  "success": true,
  "data": {
    "students": [
      {
        "id": "01",
        "subscriptionId": "sub-student-01",
        "status": "active",
        "tokens": 85000,
        "cost": 3.20,
        "requests": 250,
        "lastActive": "2026-05-24T14:30:00Z",
        "quota": { "callsPerMinute": 10, "callsPerDay": 200 }
      }
    ],
    "total": 50
  }
}
```

### GET /api/dashboard/students/:id

특정 학생 상세.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "01",
    "subscriptionId": "sub-student-01",
    "status": "active",
    "totalTokens": 85000,
    "totalCost": 3.20,
    "totalRequests": 250,
    "quota": { "callsPerMinute": 10, "callsPerDay": 200 },
    "daily": [
      { "date": "2026-05-24", "tokens": 5000, "cost": 0.20, "requests": 15 }
    ],
    "byModel": [
      { "model": "gpt-54-mini", "tokens": 60000, "cost": 1.80, "requests": 180 },
      { "model": "gpt-55", "tokens": 20000, "cost": 1.20, "requests": 50 },
      { "model": "deepseek-v4-flash", "tokens": 5000, "cost": 0.20, "requests": 20 }
    ]
  }
}
```

### POST /api/dashboard/control/quota

Quota 변경.

**Body:**
```json
{
  "target": "01",         // 학생 ID 또는 "all"
  "callsPerMinute": 15,   // 분당 호출 (선택)
  "callsPerDay": 300      // 일 호출 (선택)
}
```

**Response:**
```json
{
  "success": true,
  "data": { "updated": 1, "target": "01", "newQuota": { "callsPerMinute": 15, "callsPerDay": 300 } }
}
```

### POST /api/dashboard/control/suspend

구독 정지/재개.

**Body:**
```json
{
  "target": "01",       // 학생 ID 또는 "all"
  "action": "suspend"   // "suspend" | "activate"
}
```

**Response:**
```json
{
  "success": true,
  "data": { "updated": 1, "target": "01", "newStatus": "suspended" }
}
```

### POST /api/dashboard/control/bulk

일괄 작업.

**Body:**
```json
{
  "action": "resetQuota",    // "resetQuota" | "suspendAll" | "activateAll"
  "quota": { "callsPerMinute": 10, "callsPerDay": 200 }  // resetQuota일 때만
}
```

### GET /api/dashboard/alerts

알림 설정 조회.

**Response:**
```json
{
  "success": true,
  "data": {
    "thresholds": [
      { "percent": 50, "enabled": true, "notified": false },
      { "percent": 80, "enabled": true, "notified": true },
      { "percent": 95, "enabled": true, "notified": false }
    ],
    "email": "admin@eldensoluton.kr"
  }
}
```

### POST /api/dashboard/alerts

알림 설정 수정.

**Body:**
```json
{
  "thresholds": [
    { "percent": 50, "enabled": true },
    { "percent": 80, "enabled": true },
    { "percent": 95, "enabled": true }
  ],
  "email": "admin@eldensoluton.kr"
}
```

## APIM Management API 참조

### 구독 목록 조회
```
GET https://management.azure.com/subscriptions/{subId}/resourceGroups/{rg}/providers/Microsoft.ApiManagement/service/{apim}/subscriptions?api-version=2022-08-01
```

### 구독 상태 변경
```
PATCH https://management.azure.com/subscriptions/{subId}/resourceGroups/{rg}/providers/Microsoft.ApiManagement/service/{apim}/subscriptions/{sid}?api-version=2022-08-01
Body: { "properties": { "state": "suspended" | "active" } }
Header: If-Match: *
```

### 구독 정책 수정 (quota)
APIM 정책은 XML 기반. 구독별 rate-limit은 product-level 또는 subscription-level policy로 관리.
실제 구현 시 APIM Policy API를 사용하여 rate-limit-by-key 값을 변경한다.

## 비용 계산 로직

| 모델 | 입력 토큰 (per 1K) | 출력 토큰 (per 1K) |
|------|-------------------|-------------------|
| gpt-54-mini | $0.0004 | $0.0016 |
| gpt-55 | $0.005 | $0.015 |
| deepseek-v4-flash | $0.00014 | $0.00028 |

비용 = (input_tokens * input_rate + output_tokens * output_rate) / 1000
