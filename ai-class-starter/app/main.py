"""Azure AI Foundry 바이브코딩 실습 스타터 프로젝트"""
import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import httpx

app = FastAPI(title="AI Class Starter", version="0.1.0")

API_KEY = os.environ.get("AI_CLASS_API_KEY", "")
APIM_BASE = os.environ.get("APIM_BASE_URL", "https://apim-eduelden-ai.azure-api.net")


class ChatRequest(BaseModel):
    message: str
    model: str = "gpt-54-mini"


class ChatResponse(BaseModel):
    reply: str
    model: str
    tokens_used: int


# BUG 1: 이 함수에 버그가 있습니다. 찾아서 수정해보세요!
def get_endpoint(model: str) -> str:
    if model in ("gpt-55", "gpt-54-mini"):
        return f"{APIM_BASE}/openai/deployments/{model}/chat/completions?api-version=2024-10-21"
    elif model == "deepseek-v4-flash":
        return f"{APIM_BASE}/openai/deployments/{model}/chat/completions?api-version=2024-10-21"
    else:
        return None


@app.get("/")
def root():
    return {"status": "running", "message": "AI Class Starter API"}


@app.get("/health")
def health():
    return {"status": "ok", "api_key_set": bool(API_KEY)}


# BUG 2: 이 엔드포인트에도 버그가 있습니다!
@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    endpoint = get_endpoint(req.model)
    if not endpoint:
        raise HTTPException(status_code=400, detail=f"Unknown model: {req.model}")

    headers = {"Content-Type": "application/json", "api-key": API_KEY}
    body = {
        "messages": [{"role": "user", "content": req.message}],
        "max_tokens": 500,
        "temperature": 0.7,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(endpoint, json=body, headers=headers)

    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)

    data = resp.json()
    reply = data["choices"][0]["message"]["content"]
    tokens = data["usage"]["total_tokens"]

    return ChatResponse(reply=reply, model=req.model, tokens_used=tokens)


# TODO: 여기에 새 기능을 추가해보세요!
# 아이디어: 대화 히스토리, 시스템 프롬프트, 스트리밍 응답, 번역 기능 등
