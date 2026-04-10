"""
Sentiment Analysis & Mental Health Classification using BERT
Analyzes follow-up text responses to determine mental_status
"""

from typing import Dict, List, Literal, Optional
import json

MentalHealthLabel = Literal["Anxiety", "Bipolar", "Depression", "Normal", "Personality Disorder", "Stress", "Suicidal"]

class BertSentimentAnalyzer:
    """
    Wrapper for BERT-based sentiment analysis.
    Maps to 7 mental health labels from trained BERT model.
    """
    
    # Label mapping (must match BERT model training)
    LABEL_MAP = {
        0: "Anxiety",
        1: "Bipolar",
        2: "Depression",
        3: "Normal",
        4: "Personality Disorder",
        5: "Stress",
        6: "Suicidal"
    }
    
    REVERSE_LABEL_MAP = {v: k for k, v in LABEL_MAP.items()}
    
    def __init__(self):
        """Initialize BERT model (lazy load in load_model)"""
        self.model = None
        self.tokenizer = None
        self._model_loaded = False
    
    def load_model(self):
        """
        Lazy load BERT model if available.
        Falls back to keyword-based classification if model unavailable.
        """
        if self._model_loaded:
            return True
        
        try:
            # Try to load from transformers
            from transformers import AutoTokenizer, AutoModelForSequenceClassification
            import torch
            import os
            
            # Load trained BERT model from local path
            model_path = os.path.join(
                os.path.dirname(__file__),
                "model", "bert", "bert_model_full"
            )
            
            self.tokenizer = AutoTokenizer.from_pretrained(model_path, local_files_only=True)
            self.model = AutoModelForSequenceClassification.from_pretrained(model_path, local_files_only=True)
            self._model_loaded = True
            
            return True
        except Exception as e:
            print(f"⚠️ BERT model not available: {e}")
            print("Falling back to keyword-based classification")
            return False
    
    def classify_with_bert(self, text: str) -> Dict[str, any]:
        """
        Classify text using BERT model.
        
        Args:
            text: Follow-up text responses to analyze
        
        Returns:
            {
                "label": "Anxiety",
                "label_id": 0,
                "confidence": 0.95,
                "probabilities": {...}
            }
        """
        # Sàn lọc nhanh (Fast screening) for crisis intents bypassing the BERT model
        try:
            from services.nlp_sentiment_analysis.nlp_utils import classify_text
            if classify_text(text) == "Suicidal":
                return {
                    "label": "Suicidal",
                    "label_id": self.REVERSE_LABEL_MAP["Suicidal"],
                    "confidence": 1.0,
                    "probabilities": {},
                    "method": "fast_crisis_detection"
                }
        except ImportError:
            pass

        if not self.load_model():
            return self.classify_with_keywords(text)
        
        if not text or not text.strip():
            return {
                "label": "Normal",
                "label_id": self.REVERSE_LABEL_MAP["Normal"],
                "confidence": 1.0,
                "probabilities": {}
            }
        
        try:
            import torch
            
            # Tokenize
            inputs = self.tokenizer(
                text,
                return_tensors="pt",
                max_length=512,
                truncation=True,
                padding=True
            )
            
            # Predict
            with torch.no_grad():
                outputs = self.model(**inputs)
                logits = outputs.logits
            
            # Get probabilities
            probabilities = torch.softmax(logits, dim=1)[0].cpu().numpy()
            predicted_id = probabilities.argmax()
            confidence = float(probabilities[predicted_id])
            
            predicted_label = self.LABEL_MAP.get(int(predicted_id), "Normal")
            
            # Build probability map
            prob_map = {
                self.LABEL_MAP[i]: float(probabilities[i])
                for i in range(len(probabilities))
            }
            
            return {
                "label": predicted_label,
                "label_id": int(predicted_id),
                "confidence": confidence,
                "probabilities": prob_map
            }
        
        except Exception as e:
            print(f"Error in BERT classification: {e}")
            return self.classify_with_keywords(text)
    
    def classify_with_keywords(self, text: str) -> Dict[str, any]:
        """
        Fallback keyword-based classification when BERT unavailable.
        """
        text_lower = text.lower()
        
        # Keyword patterns for each category
        keyword_patterns = {
            "Suicidal": [
                "suicide", "suicidal", "kill myself", "end my life",
                "better off dead", "self-harm", "harm myself", "cut myself"
            ],
            "Anxiety": [
                "anxious", "nervous", "worry", "panic", "fear", "scared",
                "tense", "overwhelmed", "on edge", "restless", "can't relax"
            ],
            "Depression": [
                "depressed", "sad", "hopeless", "worthless", "empty", "numb",
                "miserable", "no energy", "exhausted", "no interest", "nothing matters"
            ],
            "Stress": [
                "stressed", "stress", "overwhelmed", "pressure", "burnout",
                "overloaded", "too much", "can't cope", "struggling"
            ],
            "Bipolar": [
                "mood swings", "manic", "bipolar", "highs and lows", "racing thoughts"
            ],
            "Personality Disorder": [
                "identity", "unstable relationships", "abandonment", "betrayed"
            ],
            "Normal": []
        }
        
        # Score each category
        scores = {}
        for label, keywords in keyword_patterns.items():
            if label == "Suicidal":  # Highest priority
                if any(kw in text_lower for kw in keywords):
                    return {
                        "label": "Suicidal",
                        "label_id": self.REVERSE_LABEL_MAP["Suicidal"],
                        "confidence": 1.0,
                        "probabilities": {},
                        "method": "keyword_crisis"
                    }
            
            score = sum(1 for kw in keywords if kw in text_lower)
            scores[label] = score
        
        if max(scores.values()) == 0:
            best_label = "Normal"
        else:
            best_label = max(scores, key=scores.get)
        
        return {
            "label": best_label,
            "label_id": self.REVERSE_LABEL_MAP[best_label],
            "confidence": 0.5,  # Lower confidence for keyword method
            "probabilities": scores,
            "method": "keyword_fallback"
        }
    
    def analyze_followup_responses(self, text_responses: List[str]) -> Dict[str, any]:
        """
     p   Analyze multiple follow-up text responses.
        Combines all texts and classifies as one.
        
        Args:
            text_responses: List of 3 follow-up text responses
        
        Returns:
            Classification result with mental_status label
        """
        if not text_responses:
            return {
                "label": "Normal",
                "label_id": self.REVERSE_LABEL_MAP["Normal"],
                "confidence": 1.0,
                "probabilities": {}
            }
        
        # Combine all responses
        combined_text = " ".join(filter(None, text_responses))
        
        # Classify combined text
        return self.classify_with_bert(combined_text)


# Global analyzer instance
_analyzer = None

def get_analyzer() -> BertSentimentAnalyzer:
    """Get or create global analyzer instance"""
    global _analyzer
    if _analyzer is None:
        _analyzer = BertSentimentAnalyzer()
    return _analyzer

def analyze_sentiment(text_responses: List[str]) -> Dict[str, any]:
    """
    Analyze sentiment for list of text responses.
    
    Args:
        text_responses: List of follow-up responses
    
    Returns:
        Classification result
    """
    analyzer = get_analyzer()
    return analyzer.analyze_followup_responses(text_responses)
