# 모델별 예산 배분 계획

> 총 예산: **$800 USD** / 기간: 2026-05 ~ 2026-12

| 모델 | 용도 | 배분 | TPM | 비고 |
|---|---|---|---|---|
| gpt-5.5 | 고품질 추론 (느림) | $500 | 50K | Standard 배포 |
| gpt-5.4-mini | 범용 빠른 응답 | $200 | 100K | Standard 배포 |
| DeepSeek-V4-Flash ×2 | 대안 모델 (라운드로빈) | $70 | Marketplace | 서버리스 배포 |
| 버퍼 | 예비 | $30 | - | APIM 등 부가 비용 |

## 알림 설정

| 단계 | 임계값 | 금액 | 수신 |
|---|---|---|---|
| 1단계 | 50% | $400 | admin@eldensoluton.kr + Owner |
| 2단계 | 80% | $640 | admin@eldensoluton.kr + Owner |
| 3단계 | 95% | $760 | admin@eldensoluton.kr + Owner |

## 비용 절감 전략

- 학생당 Rate Limit: 분당 10회, 일 200회 (APIM Quota)
- DeepSeek 라운드로빈으로 동접 분산
- cost-monitor.yml 매일 09:00 KST 자동 체크
