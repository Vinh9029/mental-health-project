"""
Sentiment Analysis API Endpoint
Handles BERT-based mental health classification from follow-up text responses
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from services.nlp_sentiment_analysis.sentiment_analyzer import analyze_sentiment

router = APIRouter()

class SentimentRequest(BaseModel):
    """Sentiment analysis request"""
    text_responses: List[str]         # 3 follow-up text answers
    questions: Optional[List[str]] = None  # Paired follow-up questions for Q+A context
    user_id: Optional[str] = None

class SentimentResponse(BaseModel):
    """Sentiment analysis response"""
    label: str  # "Anxiety", "Depression", "Normal", etc.
    label_id: int  # 0-6 mapping
    confidence: float  # 0.0-1.0
    probabilities: dict = {}  # All label scores
    method: Optional[str] = None  # "bert" or "keyword_fallback"

@router.post("/sentiment", response_model=SentimentResponse)
async def analyze_followup_sentiment(request: SentimentRequest) -> SentimentResponse:
    """
    Analyze follow-up text responses using BERT.
    Returns the mental_status label (Anxiety, Depression, Normal, etc.)
    
    Args:
        request: SentimentRequest with 3 text responses
    
    Returns:
        SentimentResponse with label and confidence
    """
    if not request.text_responses:
        raise HTTPException(status_code=400, detail="text_responses cannot be empty")
    
    if not (1 <= len(request.text_responses) <= 3):
        raise HTTPException(status_code=400, detail="Must provide between 1 and 3 text responses")
    
    try:
        # Analyze sentiment — pass questions for Q+A-pair enriched input
        result = analyze_sentiment(request.text_responses, questions=request.questions)
        
        return SentimentResponse(
            label=result["label"],
            label_id=result["label_id"],
            confidence=result["confidence"],
            probabilities=result.get("probabilities", {}),
            method=result.get("method", "bert")
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sentiment analysis failed: {str(e)}")
