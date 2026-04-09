from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routers import chat

app = FastAPI(title="MindCare AI API", version="1.0")

# Cho phép Frontend React (chạy trên localhost:8080) giao tiếp
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:5173"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Nạp Router của Chatbot vào /api/chat
app.include_router(chat.router, prefix="/api", tags=["ChatBot"])

@app.get("/")
def root():
    return {"status": "ok", "message": "Backend FastAPI for Mindbloom is running!"}