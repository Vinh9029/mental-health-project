"""
Journal API Router
Handles journal entry summarisation using the local LLM with SSE streaming.
Supports both English and Vietnamese input/output.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, AsyncGenerator
import sys
import os
import json
import asyncio

# Add services to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

router = APIRouter()


class JournalSummarizeRequest(BaseModel):
    content: str
    language: Optional[str] = "auto"   # "en" | "vi" | "auto"


class JournalSummarizeResponse(BaseModel):
    summary: str


def detect_vietnamese(text: str) -> bool:
    """Detect if text contains Vietnamese characters."""
    vi_chars = "àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ"
    return any(c in vi_chars.lower() for c in text.lower())


def build_prompt(content: str, is_vietnamese: bool) -> str:
    """Build a bilingual journal analysis prompt."""
    if is_vietnamese:
        return f"""Bạn là một trợ lý nhật ký sức khỏe tâm thần đầy lòng trắc ẩn.
Hãy phân tích bài nhật ký riêng tư sau và cung cấp phân tích theo định dạng này (mỗi mục trên một dòng riêng):

1. Cảm xúc chủ đạo: [1-2 từ mô tả trạng thái cảm xúc]
2. Chủ đề chính: [2-3 mối quan tâm hoặc chủ đề được đề cập]
3. Điểm tích cực: [các chiến lược đối phó hoặc khoảnh khắc tích cực nếu có]
4. Nhận xét hỗ trợ: [một cái nhìn sâu sắc, nhẹ nhàng và đồng cảm]

Hãy ngắn gọn (3-5 câu tổng cộng), ấm áp, không phán xét và nói theo ngôi thứ hai ("bạn").
KHÔNG lặp lại nguyên văn nhật ký.
Trả lời HOÀN TOÀN bằng tiếng Việt.

Bài nhật ký:
\"\"\"
{content[:2000]}
\"\"\"

Phân tích của bạn:"""
    else:
        return f"""You are a compassionate mental health journaling assistant.
Analyse the following private journal entry and provide your analysis in this format (each item on its own line):

1. Emotional tone: [1-2 words describing the emotional state]
2. Key themes: [2-3 main concerns or topics mentioned]
3. Positive notes: [any coping strategies or positive moments found]
4. Supportive insight: [one gentle, empathetic reflection]

Be brief (3-5 sentences total), warm, non-judgmental, and speak in second person ("you").
Do NOT repeat the journal verbatim.

Journal entry:
\"\"\"
{content[:2000]}
\"\"\"

Your analysis:"""


async def _stream_journal_summary(content: str, is_vietnamese: bool) -> AsyncGenerator[str, None]:
    """
    Async SSE generator — streams the LLM journal summary word-by-word.
    Falls back to a static message if the LLM is unavailable.
    """
    try:
        from services.llm_rag.src.app_config import get_llm

        prompt = build_prompt(content, is_vietnamese)

        def _blocking_invoke() -> str:
            llm = get_llm()
            result = llm.invoke(prompt)
            return result.content if hasattr(result, "content") else str(result)

        full_response: str = await asyncio.to_thread(_blocking_invoke)
        full_response = full_response.strip()

        if not full_response:
            raise ValueError("Empty LLM response")

        # Stream word-by-word (same pattern as chat router)
        words = full_response.split(" ")
        for i, word in enumerate(words):
            chunk = word if i == 0 else " " + word
            payload = json.dumps({"token": chunk})
            yield f"data: {payload}\n\n"
            await asyncio.sleep(0.02)   # ~50 words/sec

        yield "data: [DONE]\n\n"

    except Exception as e:
        print(f"Journal summarisation error: {e}")

        # Bilingual fallback
        word_count = len(content.split())
        if is_vietnamese:
            fallback = (
                f"1. Cảm xúc chủ đạo: Suy ngẫm\n"
                f"2. Chủ đề chính: Bài nhật ký {word_count} từ của bạn chứa những suy nghĩ và cảm xúc cá nhân.\n"
                f"3. Điểm tích cực: Việc viết nhật ký thường xuyên là một chiến lược đối phó lành mạnh — hãy tiếp tục!\n"
                f"4. Nhận xét hỗ trợ: Hãy xem lại bài nhật ký này khi AI sẵn sàng để có phân tích sâu hơn."
            )
        else:
            fallback = (
                f"1. Emotional tone: Reflective\n"
                f"2. Key themes: Your {word_count}-word entry contains personal thoughts and feelings.\n"
                f"3. Positive notes: Writing regularly is a healthy coping strategy — keep it up!\n"
                f"4. Supportive insight: Revisit this entry when the AI backend is available for a deeper analysis."
            )

        words = fallback.split(" ")
        for i, word in enumerate(words):
            chunk = word if i == 0 else " " + word
            payload = json.dumps({"token": chunk})
            yield f"data: {payload}\n\n"
            await asyncio.sleep(0.015)

        yield "data: [DONE]\n\n"


@router.post("/journal/summarize/stream")
async def summarize_journal_stream(request: JournalSummarizeRequest):
    """
    Streaming journal summarisation endpoint — returns Server-Sent Events.
    Each event: { token: string }  |  Final: [DONE]
    Detects Vietnamese input automatically and responds in the same language.
    """
    if not request.content or not request.content.strip():
        raise HTTPException(status_code=400, detail="Journal content cannot be empty.")

    if len(request.content) < 20:
        raise HTTPException(status_code=400, detail="Entry is too short to summarise.")

    is_vietnamese = detect_vietnamese(request.content)

    return StreamingResponse(
        _stream_journal_summary(request.content, is_vietnamese),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/journal/summarize", response_model=JournalSummarizeResponse)
async def summarize_journal(request: JournalSummarizeRequest):
    """
    Non-streaming fallback — returns the full summary as JSON.
    Kept for backwards compatibility.
    """
    if not request.content or not request.content.strip():
        raise HTTPException(status_code=400, detail="Journal content cannot be empty.")

    if len(request.content) < 20:
        raise HTTPException(status_code=400, detail="Entry is too short to summarise.")

    is_vietnamese = detect_vietnamese(request.content)

    try:
        from services.llm_rag.src.app_config import get_llm

        prompt = build_prompt(request.content, is_vietnamese)
        llm = get_llm()
        result = await asyncio.to_thread(lambda: llm.invoke(prompt))
        summary = (result.content if hasattr(result, "content") else str(result)).strip()

        if not summary:
            raise ValueError("Empty response from LLM")

        return JournalSummarizeResponse(summary=summary)

    except Exception as e:
        print(f"Journal summarisation error: {e}")
        word_count = len(request.content.split())
        if is_vietnamese:
            summary = (
                f"1. Cảm xúc chủ đạo: Suy ngẫm\n"
                f"2. Chủ đề chính: Bài nhật ký {word_count} từ của bạn phản ánh những suy nghĩ cá nhân.\n"
                f"3. Điểm tích cực: Viết nhật ký thường xuyên là thói quen lành mạnh — hãy tiếp tục!\n"
                f"4. Nhận xét hỗ trợ: Hãy xem lại khi AI sẵn sàng để có phân tích sâu hơn."
            )
        else:
            summary = (
                f"1. Emotional tone: Reflective\n"
                f"2. Key themes: Your {word_count}-word entry reflects personal thoughts and feelings.\n"
                f"3. Positive notes: Writing regularly is a healthy coping strategy — keep it up!\n"
                f"4. Supportive insight: Revisit this entry when the AI backend is available for deeper analysis."
            )
        return JournalSummarizeResponse(summary=summary)
