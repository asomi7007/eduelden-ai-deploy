# Claude Code 핸드오프 패키지

Cowork 모드에서 시작한 **Azure AI Foundry 바이브코딩 실습 환경 구축** 작업을
로컬 Claude Code로 이어서 진행하기 위한 패키지예요.

## 폴더 구성

| 파일 | 용도 |
|---|---|
| `README.md` | 이 파일. 사용 방법 |
| `CLAUDE.md` | Claude Code가 자동으로 메모리에 로드하는 프로젝트 컨텍스트 (Azure 환경값, 모델 정책, 규칙) |
| `HANDOVER.md` | 지금까지의 의사결정·진행 상황·Phase별 체크리스트 |
| `setup-claude-code.ps1` | 원클릭 셋업 스크립트 (도구 확인 → Azure/GitHub 로그인 → MCP 서버 등록) |
| `.mcp.json` | 프로젝트별 MCP 설정 (다른 PC에서도 동일하게 동작하도록 안전망) |

## 사용법 (5분)

### 1. 이 폴더를 본인 PC의 작업 폴더로 복사

예) `C:\Users\허석\eduelden-ai-deploy\` 같은 곳에 폴더 통째로 복사.
이 폴더가 곧 GitHub repo 루트가 될 거예요.

### 2. 필수 도구 설치 (없는 것만)

```powershell
# PowerShell (관리자 권한)에서
winget install Microsoft.AzureCLI
winget install GitHub.cli
winget install OpenJS.NodeJS.LTS
npm install -g @anthropic-ai/claude-code
```

### 3. 셋업 스크립트 실행

```powershell
cd C:\Users\허석\eduelden-ai-deploy
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\setup-claude-code.ps1
```

스크립트가 자동으로:
1. 도구 설치 확인
2. `az login` 및 구독 검증
3. `gh auth login` (브라우저에서 asomi7007 계정 로그인)
4. Claude Code에 Azure MCP, GitHub MCP, Microsoft Learn MCP 3개 등록
5. 결과 요약 출력

### 4. Claude Code 실행

```powershell
# 같은 폴더에서
claude
```

### 5. 첫 프롬프트

Claude Code가 뜨면 아래를 그대로 붙여넣으세요:

```
이 폴더의 CLAUDE.md와 HANDOVER.md를 읽고, Phase별 체크리스트를 TodoWrite로
등록한 다음 Phase 0부터 시작해줘. Azure MCP가 있으면 그걸로 az 명령을 실행하고,
없으면 명령어를 보여주고 내 답을 받아서 진행해.
```

그러면 Cowork에서 멈췄던 지점부터 정확히 이어서 진행됩니다.

## 만약 setup 스크립트가 실패하면

각 MCP 서버를 수동으로 추가할 수도 있어요:

```powershell
# Azure MCP
claude mcp add azure -- npx -y "@azure/mcp@latest" server start

# GitHub MCP (먼저 gh auth login 한 뒤)
$env:GITHUB_PERSONAL_ACCESS_TOKEN = (gh auth token)
claude mcp add github --env "GITHUB_PERSONAL_ACCESS_TOKEN=$env:GITHUB_PERSONAL_ACCESS_TOKEN" `
  -- npx -y "@modelcontextprotocol/server-github"

# Microsoft Learn (선택)
claude mcp add --transport http mslearn "https://learn.microsoft.com/api/mcp"

# 확인
claude mcp list
```

## 안전 노트

- `setup-claude-code.ps1`은 환경변수에 GitHub 토큰을 저장해요. 공용 PC면 끝나고 지우세요.
- `.mcp.json`은 토큰을 직접 담지 않고 환경변수 참조 형태(`${GITHUB_PERSONAL_ACCESS_TOKEN}`)예요. 그대로 GitHub에 push해도 안전합니다.
- 그래도 혹시 모르니 `.gitignore`에 `*.secret`, `secrets/`, `.env` 정도는 미리 넣어두세요.
