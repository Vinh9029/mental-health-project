"""
Chat API Router
Handles chat requests and integrates LLM RAG with mental health assessment.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import sys
import os

# Add services to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from services.nlp_sentiment_analysis.scoring import (
    calculate_baseline_profile,
    map_to_severe_level,
    SeverityLevel
)
from services.nlp_sentiment_analysis.nlp_utils import classify_text, get_crisis_response

router = APIRouter()

class ChatRequest(BaseModel):
    """Chat request schema"""
    message: str
    user_id: Optional[str] = None
    severe_level: Optional[str] = None  # From assessment: 'Normal', 'Mild', 'Moderate', 'Severe'
    mental_status: Optional[str] = None  # From NLP: 'Anxiety', 'Depression', 'Normal', etc.

class ChatResponse(BaseModel):
    """Chat response schema"""
    reply: str
    detected_label: Optional[str] = None
    requires_crisis_support: bool = False

def get_rag_chat_response(request: ChatRequest) -> ChatResponse:
    """
    Try to use RAG service if available, fall back to mock response.
    """
    try:
        # Import RAG service
        from services.llm_rag.src.generation import ResponseGenerator
        from services.llm_rag.src.retrieval import AdvancedRetriever
        from services.llm_rag.src.app_config import get_llm, get_vectorstore, CROSS_ENCODER_MODEL
        
        # Initialize services
        llm = get_llm()
        vectorstore = get_vectorstore()
        retriever_service = AdvancedRetriever(vectorstore, model_name=CROSS_ENCODER_MODEL)
        retriever = retriever_service.get_retriever()
        generator = ResponseGenerator(llm)
        
        # Translate & expand query
        translated_query, expanded_query = generator.translate_and_expand_query(request.message)
        is_vietnamese = (generator.detect_language(request.message) == 'vi')
        
        # Generate response with RAG
        reply = generator.generate_response(
            user_query=request.message,
            expanded_query=expanded_query,
            retriever=retriever,
            severe_level=request.severe_level or "Normal",
            mental_status=request.mental_status or "Normal",
            is_vietnamese=is_vietnamese
        )
        
        return ChatResponse(reply=reply)
    except Exception as e:
        # If RAG not available, return None to trigger fallback
        print(f"RAG service error: {e}")
        return None

@router.post("/chat", response_model=ChatResponse)
async def handle_chat(request: ChatRequest) -> ChatResponse:
    """
    Handle chat message and return AI response.
    
    Args:
        request: ChatRequest with message and assessment data
    
    Returns:
        ChatResponse with AI reply
    """
    if not request.message or not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    # Detect mental health label from message
    detected_label = classify_text(request.message)
    
    # Handle crisis situation
    if detected_label == "Suicidal":
        return ChatResponse(
            reply=get_crisis_response(),
            detected_label=detected_label,
            requires_crisis_support=True
        )
    
    # Try to use RAG service
    rag_response = get_rag_chat_response(request)
    if rag_response:
        return ChatResponse(
            reply=rag_response.reply,
            detected_label=detected_label,
            requires_crisis_support=False
        )
    
    # Fallback: Generate mock response
    severe_level = request.severe_level or "Normal"
    mental_status = request.mental_status or detected_label
    
    reply = f"""Thank you for sharing. I hear you. 💚

Based on our conversation, I understand you're dealing with {mental_status.lower()}.

Here are some things we can explore together:
- **Breathing techniques** for immediate relief
- **Mood tracking** to identify patterns
- **Coping strategies** tailored to your situation

What would be most helpful for you right now?

*Your severity level: {severe_level} | Detected concern: {mental_status}*"""
    
    return ChatResponse(
        reply=reply,
        detected_label=detected_label,
        requires_crisis_support=False
    )
