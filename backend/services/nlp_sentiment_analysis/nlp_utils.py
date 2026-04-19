"""
NLP Classification utility for mental health text analysis.
Classifies user input into mental health categories:
- Suicidal: Immediate crisis detection
- Anxiety: Anxiety-related concerns
- Depression: Depression-related concerns
- Stress: Stress-related concerns
- Normal: No significant mental health concerns
"""

from typing import Dict, List, Literal
import re

MentalHealthLabel = Literal["Suicidal", "Anxiety", "Depression", "Stress", "Bipolar", "Personality Disorder", "Normal"]

# Crisis keywords - highest priority
CRISIS_KEYWORDS = [
    "suicide", "suicidal", "kill myself", "end my life", "better off dead",
    "don't want to live", "self-harm", "harm myself", "cut myself",
    "hang myself", "overdose", "end it all", "not worth living",
    "want to die", "wish i was dead", "no reason to live",
    "take my own life", "don't want to be alive", "give up on life",
]

# Mental health classification keywords
KEYWORD_MAP: Dict[MentalHealthLabel, List[str]] = {
    "Anxiety": [
        "anxious", "nervous", "worry", "worried", "worrying", "panic", "panicked",
        "fear", "afraid", "scared", "frightened", "tense", "stress", "stressed",
        "overwhelmed", "on edge", "restless", "fidgety", "can't relax",
        "heart racing", "pounding heart", "shortness of breath"
    ],
    "Depression": [
        "depressed", "sad", "sadness", "hopeless", "hopelessness", "worthless",
        "empty", "numb", "miserable", "despair", "despaired", "unmotivated",
        "no energy", "exhausted", "tired all the time", "lose interest",
        "nothing matters", "can't enjoy", "no point", "dark thoughts"
    ],
    "Stress": [
        "stressed", "stress", "overwhelmed", "pressure", "pressured", "burnout",
        "burned out", "overloaded", "too much", "can't cope", "struggling",
        "difficult time", "hard times", "challenging", "demanding", "exhausted"
    ],
    "Bipolar": [
        "mood swings", "manic", "bipolar", "highs and lows", "extreme mood",
        "impulsive", "racing thoughts", "decreased need for sleep", "grandiose",
        "euphoric", "irritable", "flight of ideas"
    ],
    "Personality Disorder": [
        "identity crisis", "unstable relationships", "fear of abandonment",
        "intense relationships", "splitting", "empty inside", "nobody understands",
        "misunderstood", "betrayed", "manipulated"
    ],
    "Normal": []
}

def classify_text(text: str) -> MentalHealthLabel:
    """
    Classify user text into mental health category using keyword matching.
    
    Args:
        text: User input text to classify
    
    Returns:
        Mental health label
    """
    if not text or not isinstance(text, str):
        return "Normal"
    
    text_lower = text.lower()
    
    # Safety check first - suicidal ideation is highest priority
    for keyword in CRISIS_KEYWORDS:
        if keyword in text_lower:
            return "Suicidal"
    
    # Score each category
    scores: Dict[MentalHealthLabel, int] = {
        label: 0 for label in KEYWORD_MAP.keys() if label != "Normal"
    }
    
    for label, keywords in KEYWORD_MAP.items():
        if label == "Normal" or label == "Suicidal":
            continue
        for keyword in keywords:
            if keyword in text_lower:
                scores[label] += 1
    
    # Return highest scoring label, or Normal if no matches
    if not any(scores.values()):
        return "Normal"
    
    return max(scores, key=scores.get)  # type: ignore

def extract_mental_health_theme(text: str) -> str:
    """
    Extract the primary mental health theme from text for context.
    
    Args:
        text: User input text
    
    Returns:
        Brief description of the detected theme
    """
    label = classify_text(text)
    
    themes = {
        "Suicidal": "Suicidal ideation or self-harm concerns",
        "Anxiety": "Anxiety or worry-related concerns",
        "Depression": "Depression or mood-related concerns",
        "Stress": "Stress or overwhelm",
        "Bipolar": "Mood disorder or bipolar spectrum",
        "Personality Disorder": "Relationship or identity concerns",
        "Normal": "General well-being"
    }
    
    return themes.get(label, "General concern")

def get_crisis_response() -> str:
    """
    Get appropriate crisis response message.
    
    Returns:
        Crisis response text
    """
    return """🚨 **I'm concerned about your safety.**

I want you to know that you're not alone, and help is available right now.

**Please reach out immediately:**
- 🇺🇸 **988 Suicide & Crisis Lifeline:** Call or text **988**
- 🌍 **Crisis Text Line:** Text **HOME** to **741741**
- 🇬🇧 **Samaritans:** Call **116 123**
- 🇻🇳 **Đường dây nóng tâm lý Việt Nam:** Gọi **1925**

You matter. Your feelings are valid. A trained counselor can help you through this moment.

*I'm an AI assistant and not equipped to provide crisis support. Please contact the resources above — they are available 24/7.*"""
