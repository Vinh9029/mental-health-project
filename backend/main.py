from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routers import chat, sentiment, journal

app = FastAPI(title="MindCare AI API", version="1.0")

# Cho phép Frontend React (chạy trên localhost:5173) giao tiếp
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Nạp Router của Chatbot vào /api/chat
app.include_router(chat.router, prefix="/api", tags=["ChatBot"])

# Nạp Router của Sentiment Analysis vào /api/sentiment
app.include_router(sentiment.router, prefix="/api", tags=["Sentiment Analysis"])

# Journal summarisation router
app.include_router(journal.router, prefix="/api", tags=["Journal"])

@app.get("/")
def root():
    return {"status": "ok", "message": "Backend FastAPI for Mindbloom is running!"}