# KQL Queries for APIM Usage Analytics

## 데이터 소스

APIM 진단 로그는 Log Analytics의 `ApiManagementGatewayLogs` 테이블에 저장된다.
주요 필드:

| 필드 | 설명 |
|------|------|
| `TimeGenerated` | 요청 시각 |
| `OperationName` | API 경로 |
| `ApimSubscriptionId` | APIM 구독 ID (sub-student-XX) |
| `ResponseCode` | HTTP 응답 코드 |
| `BackendResponseCode` | 백엔드 응답 코드 |
| `RequestSize` | 요청 크기 (bytes) |
| `ResponseSize` | 응답 크기 (bytes) |
| `TotalTime` | 총 처리 시간 (ms) |
| `BackendTime` | 백엔드 처리 시간 (ms) |
| `Cache` | 캐시 hit/miss |

### 토큰 정보 추출

APIM에서 Azure OpenAI 백엔드로 프록시할 때, 응답 헤더에 토큰 사용량이 포함된다.
이를 캡처하려면 APIM outbound 정책에서 커스텀 차원을 추가해야 한다:

```xml
<outbound>
  <set-header name="x-ratelimit-remaining-tokens" exists-action="delete" />
  <log-to-eventhub logger-id="log-analytics">
    @{
      var promptTokens = context.Response.Headers.GetValueOrDefault("x-ratelimit-remaining-tokens","0");
      var completionTokens = context.Response.Headers.GetValueOrDefault("x-ms-completion-tokens","0");
      return new JObject(
        new JProperty("promptTokens", promptTokens),
        new JProperty("completionTokens", completionTokens)
      ).ToString();
    }
  </log-to-eventhub>
</outbound>
```

**대안 (더 간단):** Azure OpenAI의 응답 body에 `usage` 필드가 포함됨.
APIM 정책에서 응답 body를 파싱하여 커스텀 차원으로 기록:

```xml
<outbound>
  <choose>
    <when condition="@(context.Response.StatusCode == 200)">
      <set-variable name="responseBody" value="@(context.Response.Body.As<JObject>())" />
      <set-variable name="promptTokens" value="@(((JObject)context.Variables["responseBody"])["usage"]?["prompt_tokens"]?.ToString() ?? "0")" />
      <set-variable name="completionTokens" value="@(((JObject)context.Variables["responseBody"])["usage"]?["completion_tokens"]?.ToString() ?? "0")" />
      <set-variable name="model" value="@(((JObject)context.Variables["responseBody"])["model"]?.ToString() ?? "unknown")" />
    </when>
  </choose>
</outbound>
```

이 데이터는 `ApiManagementGatewayLogs`의 `BackendRequestBody` 또는 커스텀 차원으로 접근 가능.

## KQL 쿼리 모음

### 1. 전체 사용량 개요 (최근 7일)

```kql
ApiManagementGatewayLogs
| where TimeGenerated > ago(7d)
| where ApimSubscriptionId startswith "sub-student-"
| where ResponseCode == 200
| summarize 
    TotalRequests = count(),
    ActiveStudents = dcount(ApimSubscriptionId),
    TotalResponseSize = sum(ResponseSize)
| extend Period = "7d"
```

### 2. 일별 사용량 추이

```kql
ApiManagementGatewayLogs
| where TimeGenerated > ago(30d)
| where ApimSubscriptionId startswith "sub-student-"
| where ResponseCode == 200
| summarize 
    Requests = count(),
    AvgLatency = avg(TotalTime),
    TotalBytes = sum(ResponseSize)
  by bin(TimeGenerated, 1d)
| order by TimeGenerated asc
```

### 3. 학생별 사용량 집계

```kql
ApiManagementGatewayLogs
| where TimeGenerated > ago(7d)
| where ApimSubscriptionId startswith "sub-student-"
| where ResponseCode == 200
| summarize 
    Requests = count(),
    LastActive = max(TimeGenerated),
    TotalBytes = sum(ResponseSize)
  by ApimSubscriptionId
| extend StudentId = extract("sub-student-(\\d+)", 1, ApimSubscriptionId)
| order by Requests desc
```

### 4. 특정 학생 상세 (일별 + 모델별)

```kql
let studentSub = "sub-student-01";
ApiManagementGatewayLogs
| where TimeGenerated > ago(30d)
| where ApimSubscriptionId == studentSub
| where ResponseCode == 200
| extend Model = extract("/deployments/([^/]+)/", 1, Url)
| summarize 
    Requests = count(),
    TotalBytes = sum(ResponseSize)
  by bin(TimeGenerated, 1d), Model
| order by TimeGenerated asc
```

### 5. 모델별 분포

```kql
ApiManagementGatewayLogs
| where TimeGenerated > ago(7d)
| where ApimSubscriptionId startswith "sub-student-"
| where ResponseCode == 200
| extend Model = extract("/deployments/([^/]+)/", 1, Url)
| summarize Requests = count(), TotalBytes = sum(ResponseSize) by Model
| order by Requests desc
```

### 6. 에러 비율

```kql
ApiManagementGatewayLogs
| where TimeGenerated > ago(7d)
| where ApimSubscriptionId startswith "sub-student-"
| summarize 
    Total = count(),
    Errors = countif(ResponseCode >= 400),
    RateLimited = countif(ResponseCode == 429)
| extend ErrorRate = round(100.0 * Errors / Total, 1),
         RateLimitRate = round(100.0 * RateLimited / Total, 1)
```

### 7. 비용 추정 (토큰 기반이 아닌 요청 기반 fallback)

토큰 수가 로그에 없는 경우, 응답 크기 기반으로 추정:
- 평균 응답 1KB ~ 약 250 output tokens
- 평균 요청 0.5KB ~ 약 125 input tokens

```kql
ApiManagementGatewayLogs
| where TimeGenerated > ago(7d)
| where ApimSubscriptionId startswith "sub-student-"
| where ResponseCode == 200
| extend Model = extract("/deployments/([^/]+)/", 1, Url)
| extend EstInputTokens = RequestSize / 4.0   // rough: 4 bytes per token
| extend EstOutputTokens = ResponseSize / 4.0
| extend EstCost = case(
    Model == "gpt-54-mini", (EstInputTokens * 0.0004 + EstOutputTokens * 0.0016) / 1000,
    Model == "gpt-55", (EstInputTokens * 0.005 + EstOutputTokens * 0.015) / 1000,
    Model == "deepseek-v4-flash", (EstInputTokens * 0.00014 + EstOutputTokens * 0.00028) / 1000,
    0.0
  )
| summarize TotalCost = sum(EstCost), TotalRequests = count() by ApimSubscriptionId
| extend StudentId = extract("sub-student-(\\d+)", 1, ApimSubscriptionId)
| order by TotalCost desc
```

## Log Analytics REST API 호출

```javascript
// Node.js에서 Log Analytics 쿼리 실행
const { DefaultAzureCredential } = require('@azure/identity');
const { LogsQueryClient } = require('@azure/monitor-query');

const credential = new DefaultAzureCredential();
const client = new LogsQueryClient(credential);

const result = await client.queryWorkspace(
  workspaceId,
  kqlQuery,
  { duration: 'P7D' }  // ISO 8601 duration
);
```

또는 REST API 직접 호출:
```
POST https://api.loganalytics.io/v1/workspaces/{workspaceId}/query
Headers: Authorization: Bearer {token}
Body: { "query": "...", "timespan": "P7D" }
```

## 주의사항

1. **토큰 수 정확도** — APIM 로그에는 실제 토큰 수가 없을 수 있다. 정확한 토큰 데이터를 얻으려면 APIM outbound 정책에서 Azure OpenAI 응답의 `usage` 필드를 파싱하여 Application Insights 커스텀 이벤트로 기록하는 것이 가장 정확하다.

2. **지연** — Log Analytics 데이터는 5~15분 지연될 수 있다. 대시보드에 "마지막 업데이트" 타임스탬프를 표시한다.

3. **쿼리 비용** — KQL 쿼리도 데이터 스캔 비용이 발생한다. 결과를 캐시하고 (5분 TTL), 동일 쿼리 반복 호출을 방지한다.
