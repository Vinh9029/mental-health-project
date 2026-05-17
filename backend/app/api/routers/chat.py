"""
Chat API Router
Handles chat requests and integrates LLM RAG with mental health assessment.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, AsyncGenerator
import sys
import os
import json
import asyncio
import httpx

# Add services to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

from services.nlp_sentiment_analysis.scoring import (
    calculate_baseline_profile,
    map_to_severe_level,
    SeverityLevel
)
from services.nlp_sentiment_analysis.nlp_utils import classify_text, get_crisis_response

router = APIRouter()

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    """Chat request schema"""
    message: str
    user_id: Optional[str] = None
    baseline_severity: Optional[str] = "Normal"
    baseline_issue: Optional[str] = "None"
    realtime_status: Optional[str] = "Normal"
    history: Optional[List[Message]] = []
    # Clinical detail (optional — sent from Profile / FollowUp pages)
    phq9_score: Optional[int] = None
    phq9_severity: Optional[str] = None
    gad7_score: Optional[int] = None
    gad7_severity: Optional[str] = None
    # Behavioural context — passed pre-fetched from the frontend
    # Each mood entry: {emoji, label, stress_score, note}
    # Each journal entry: {ai_summary}
    mood_context: Optional[List[dict]] = None
    journal_context: Optional[List[dict]] = None

class ChatResponse(BaseModel):
    """Chat response schema"""
    reply: str
    detected_label: Optional[str] = None
    requires_crisis_support: bool = False
    sources: Optional[List[dict]] = None

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
        
        # Convert frontend history to Langchain format
        from langchain_core.messages import HumanMessage, AIMessage
        history_msgs = []
        if request.history:
            for msg in request.history:
                if msg.role == "user" or msg.role == "human":
                    history_msgs.append(HumanMessage(content=msg.content))
                elif msg.role == "assistant" or msg.role == "ai":
                    history_msgs.append(AIMessage(content=msg.content))
        generator.chat_history = history_msgs[-generator.max_history:]  # Keep within limits

        # Translate & expand query (now returns 3 values)
        translated_query, expanded_query, query_type = generator.translate_and_expand_query(request.message)
        is_vietnamese = (generator.detect_language(request.message) == 'vi')
        
        # Generate response with RAG routing
        result = generator.generate_response(
            user_query=request.message,
            expanded_query=expanded_query,
            retriever=retriever,
            baseline_severity=request.baseline_severity or "Normal",
            baseline_issue=request.baseline_issue or "None",
            realtime_status=request.realtime_status or "Normal",
            query_type=query_type,
            is_vietnamese=is_vietnamese,
            phq9_score=request.phq9_score,
            phq9_severity=request.phq9_severity,
            gad7_score=request.gad7_score,
            gad7_severity=request.gad7_severity,
            mood_context=request.mood_context,
            journal_context=request.journal_context,
        )
        
        return ChatResponse(
            reply=result["reply"],
            sources=result["sources"]
        )
    except Exception as e:
        # If RAG not available, return None to trigger fallback
        print(f"RAG service error: {e}")
        return None

# ---------------------------------------------------------------------------
# Streaming helper
# ---------------------------------------------------------------------------

async def _stream_rag_response(request: ChatRequest) -> AsyncGenerator[str, None]:
    """
    Async generator that yields Server-Sent Events (SSE) chunks.
    Each chunk: `data: <json>\n\n`   Final chunk: `data: [DONE]\n\n`

    Why simulate streaming instead of true token streaming?
    LM Studio local LLM does NOT support streaming over HTTP by default.
    We get the full response synchronously in a thread pool, then replay it
    word-by-word with asyncio.sleep so the frontend sees a typewriter effect.
    Using asyncio.to_thread() keeps the FastAPI event loop unblocked so the
    sleep delays actually fire (vs. blocking the loop = instant burst).
    """
    detected_label = classify_text(request.message)

    # ── Crisis fast-path (EN + VI keywords) ─────────────────────────────────
    if detected_label == "Suicidal":
        crisis_text = get_crisis_response()
        payload = json.dumps({"token": crisis_text, "detected_label": detected_label, "requires_crisis_support": True})
        yield f"data: {payload}\n\n"
        yield "data: [DONE]\n\n"
        return

    # ── RAG + LLM path ───────────────────────────────────────────────────────
    try:
        from services.llm_rag.src.generation import ResponseGenerator
        from services.llm_rag.src.retrieval import AdvancedRetriever
        from services.llm_rag.src.app_config import get_llm, get_vectorstore, CROSS_ENCODER_MODEL
        from langchain_core.messages import HumanMessage, AIMessage

        llm         = get_llm()
        vectorstore = get_vectorstore()
        retriever   = AdvancedRetriever(vectorstore, model_name=CROSS_ENCODER_MODEL).get_retriever()
        generator   = ResponseGenerator(llm)

        # Restore conversation history
        history_msgs = []
        for msg in (request.history or []):
            if msg.role in ("user", "human"):
                history_msgs.append(HumanMessage(content=msg.content))
            elif msg.role in ("assistant", "ai"):
                history_msgs.append(AIMessage(content=msg.content))
        generator.chat_history = history_msgs[-generator.max_history:]

        # Language detection + query expansion + intent classification
        translated_query, expanded_query, query_type = generator.translate_and_expand_query(request.message)
        is_vietnamese = (generator.detect_language(request.message) == "vi")

        # ── Offload blocking LLM call to thread pool ─────────────────────────
        def _blocking_generate() -> dict:
            return generator.generate_response(
                user_query        = request.message,
                expanded_query    = expanded_query,
                retriever         = retriever,
                baseline_severity = request.baseline_severity or "Normal",
                baseline_issue    = request.baseline_issue    or "None",
                realtime_status   = request.realtime_status   or "",
                query_type        = query_type,
                is_vietnamese     = is_vietnamese,
                phq9_score        = request.phq9_score,
                phq9_severity     = request.phq9_severity,
                gad7_score        = request.gad7_score,
                gad7_severity     = request.gad7_severity,
                mood_context      = request.mood_context,
                journal_context   = request.journal_context,
            )

        gen_result: dict = await asyncio.to_thread(_blocking_generate)
        full_response = gen_result["reply"]
        sources = gen_result["sources"]

        # ── Word-by-word replay ───────────────────────────────────────────────
        words = full_response.split(" ")
        for i, word in enumerate(words):
            chunk   = word if i == 0 else " " + word
            payload = json.dumps({
                "token": chunk, 
                "detected_label": detected_label, 
                "requires_crisis_support": False
            })
            yield f"data: {payload}\n\n"
            await asyncio.sleep(0.02)   # ≈ 50 words/sec — comfortable reading pace

        # ── Send sources at the end ──────────────────────────────────────────
        if sources:
            payload = json.dumps({"sources": sources})
            yield f"data: {payload}\n\n"

        yield "data: [DONE]\n\n"

    except Exception as e:
        print(f"Streaming error: {e}")
        payload = json.dumps({"token": "I'm sorry, something went wrong. Please try again.", "detected_label": "Error", "requires_crisis_support": False})
        yield f"data: {payload}\n\n"
        yield "data: [DONE]\n\n"


@router.post("/chat/stream")
async def handle_chat_stream(request: ChatRequest):
    """
    Streaming chat endpoint — returns Server-Sent Events.
    Each event carries a JSON payload: { token, detected_label, requires_crisis_support }
    The final event is the literal string '[DONE]'.
    """
    if not request.message or not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    return StreamingResponse(
        _stream_rag_response(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# Non-streaming (kept for backwards compatibility)
# ---------------------------------------------------------------------------

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
    
    # If the active message says something serious, override realtime_status for safety
    if detected_label == "Suicidal":
        request.realtime_status = "Suicidal"

    # Try to use RAG service
    rag_response = get_rag_chat_response(request)
    if rag_response:
        return ChatResponse(
            reply=rag_response.reply,
            detected_label=detected_label,
            requires_crisis_support=False
        )
    
    # Fallback: Generate mock response
    baseline_severity = request.baseline_severity or "Normal"
    realtime_status = request.realtime_status or detected_label
    
    reply = f"""Thank you for sharing. I hear you. 💚

Based on our conversation, I understand you're dealing with {realtime_status.lower()} right now.
We also acknowledge your recent baseline of {baseline_severity}.

Here are some things we can explore together:
- **Breathing techniques** for immediate relief
- **Mood tracking** to identify patterns
- **Coping strategies** tailored to your situation

What would be most helpful for you right now?

*Your severity level: {baseline_severity} | Detected concern: {realtime_status}*"""
    
    return ChatResponse(
        reply=reply,
        detected_label=detected_label,
        requires_crisis_support=False
    )
