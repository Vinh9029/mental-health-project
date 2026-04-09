from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.llm_rag.src.generation import ResponseGenerator
from services.llm_rag.src.retrieval import AdvancedRetriever
from services.llm_rag.src.app_config import get_llm, get_vectorstore, CROSS_ENCODER_MODEL

router = APIRouter()

# Khai báo cấu trúc JSON nhận từ React (Chat.tsx)
class ChatRequest(BaseModel):
    message: str
    user_id: Optional[str] = "anonymous"
    severe_level: Optional[str] = "Normal"
    mental_status: Optional[str] = "None"

# Khai báo cấu trúc JSON trả về cho React
class ChatResponse(BaseModel):
    reply: str

# Khởi tạo Service 1 LẦN DUY NHẤT khi server chạy
llm = get_llm()
vectorstore = get_vectorstore()
retriever_service = AdvancedRetriever(vectorstore, model_name=CROSS_ENCODER_MODEL)
retriever = retriever_service.get_retriever()

generator = ResponseGenerator(llm)

@router.post("/chat", response_model=ChatResponse)
def chat_endpoint(req: ChatRequest):
    try:
        # 1. Dịch & Phân tích từ khoá bằng Local LLM
        translated_query, expanded_query = generator.translate_and_expand_query(req.message)
        is_vietnamese = (generator.detect_language(req.message) == 'vi')
        
        # 2. Thực hiện RAG và Generate Response (Sinh câu trả lời)
        reply = generator.generate_response(
            user_query=req.message,
            expanded_query=expanded_query,
            retriever=retriever,
            severe_level=req.severe_level,
            mental_status=req.mental_status,
            is_vietnamese=is_vietnamese
        )
        
        return ChatResponse(reply=reply)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))