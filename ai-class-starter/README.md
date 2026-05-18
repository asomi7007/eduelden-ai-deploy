# AI Class Starter - 바이브코딩 실습

Azure AI Foundry + Cline으로 AI 기반 개발을 체험하는 실습 프로젝트입니다.

## 시작하기

```bash
# 1. 의존성 설치
pip install -r requirements.txt

# 2. 환경변수 설정
set AI_CLASS_API_KEY=<이메일로 받은 키>
set APIM_BASE_URL=https://apim-eduelden-ai.azure-api.net

# 3. 서버 실행
uvicorn app.main:app --reload --port 8000
```

http://localhost:8000/docs 에서 API 문서를 확인할 수 있습니다.

## 실습 4단계

### 1단계: 코드 분석 (10분)
Cline에게 이 프로젝트의 구조를 설명해달라고 요청하세요.
- "이 프로젝트의 전체 구조를 분석해줘"
- "main.py의 각 엔드포인트가 하는 일을 설명해줘"

### 2단계: 버그 수정 (15분)
코드에 의도적으로 넣은 버그 2개를 찾아 수정하세요.
- **BUG 1**: `get_endpoint()` 함수에서 DeepSeek 모델의 엔드포인트 경로가 잘못됨
- **BUG 2**: `/chat` 엔드포인트에서 에러 처리 누락
- Cline에게 "이 코드에서 버그를 찾아줘"라고 요청해보세요

### 3단계: 기능 추가 (20분)
다음 기능 중 하나를 Cline과 함께 구현하세요:
- 대화 히스토리 저장 (메모리 또는 파일)
- 시스템 프롬프트 커스텀 설정
- 번역 엔드포인트 추가
- 모델 비교 엔드포인트 (같은 질문을 3개 모델에 보내고 결과 비교)

### 4단계: 풀 앱 생성 (15분)
Cline에게 처음부터 간단한 앱을 만들어달라고 요청하세요:
- "간단한 할 일 관리 API를 만들어줘. AI로 할 일의 우선순위를 자동 분류해줘"
- "날씨 챗봇을 만들어줘. 사용자가 도시를 입력하면 AI가 날씨 기반 활동을 추천해줘"

## 사용 가능한 모델

| 모델 ID | 특징 |
|---|---|
| `gpt-54-mini` | 범용, 빠름 (기본 추천) |
| `gpt-55` | 고품질, 느림 |
| `deepseek-v4-flash` | 대안 모델 |

## 모델 변경 방법

Cline 설정에서 Model 값만 바꾸면 됩니다. API Key는 동일합니다.

## 도움이 필요하면

1. Cline 채팅에서 질문
2. 강사에게 문의
3. GitHub Issues에 질문 등록
