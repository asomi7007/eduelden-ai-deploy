# 수동 설정 가이드 (PowerShell 스크립트 대신)

> setup-student.ps1을 실행할 수 없는 경우 이 가이드를 따라주세요.

## 1단계: VS Code 설치

1. https://code.visualstudio.com 에서 다운로드
2. 설치 시 "PATH에 추가" 옵션 체크

## 2단계: Cline 확장 설치

1. VS Code 실행
2. 좌측 Extensions 아이콘 클릭 (Ctrl+Shift+X)
3. 검색창에 `Cline` 입력
4. "Cline" (saoudrizwan.claude-dev) 설치

## 3단계: API 설정

Cline 설정에서 다음 정보를 입력하세요:

| 항목 | 값 |
|---|---|
| Provider | OpenAI Compatible |
| Base URL | `https://apim-eduelden-ai.azure-api.net/openai` |
| API Key | 이메일로 전달받은 키 |
| Model | `gpt-54-mini` (기본 추천) |

### 모델 선택 가이드

| 모델 ID | 특징 | 추천 용도 |
|---|---|---|
| `gpt-55` | 고품질, 느림 | 복잡한 코드 생성, 아키텍처 설계 |
| `gpt-54-mini` | 범용, 빠름 | 일반 코딩, 버그 수정 (기본 추천) |
| `deepseek-v4-flash` | 대안 모델 | GPT 모델 비교 실습 |

DeepSeek 모델 사용 시 Base URL을 변경하세요:
- Base URL: `https://apim-eduelden-ai.azure-api.net/deepseek`

## 4단계: 연결 테스트

Cline 채팅창에서 "안녕하세요"를 입력하여 응답이 오는지 확인하세요.

## 문제 해결

- **429 에러**: 분당 요청 제한(10회) 초과. 잠시 후 다시 시도
- **401 에러**: API 키가 잘못됨. 이메일의 키를 다시 확인
- **연결 안 됨**: Base URL 오타 확인, VPN 사용 시 해제 후 시도
