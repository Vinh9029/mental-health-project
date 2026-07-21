"""
Sentiment Analysis & Mental Health Classification using BERT
Analyzes follow-up text responses to determine mental_status
"""

from typing import Dict, List, Literal, Optional
import json
import re

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

    # ── Expanded clinical keyword vocabulary ───────────────────────────────────
    # Used by _score_with_keywords() to produce a keyword-based soft
    # probability distribution that is blended with BERT output.
    # Unlike the fallback keyword list, this is used ALWAYS alongside BERT.
    CLINICAL_KEYWORDS: Dict[str, List[str]] = {
        "Suicidal": [
            "suicide", "suicidal", "kill myself", "end my life", "better off dead",
            "self-harm", "harm myself", "cut myself", "hang myself", "overdose",
            "end it all", "not worth living", "want to die", "wish i was dead",
            "no reason to live", "can't go on", "give up on life", "ending everything",
            "take my own life", "don't want to be alive",
        ],
        "Depression": [
            "depressed", "depression", "sad", "sadness", "hopeless", "hopelessness",
            "worthless", "empty", "numb", "miserable", "despair", "unmotivated",
            "no energy", "exhausted", "tired all the time", "lose interest",
            "lost interest", "nothing matters", "can't enjoy", "no point",
            "dark thoughts", "crying", "can't get out of bed", "sleep too much",
            "no motivation", "feeling down", "feeling low", "feel down",
            "don't care anymore", "feel nothing", "feel empty", "crying a lot",
            "feel like a burden", "lonely", "isolating", "withdrawing",
            "feel hopeless", "feel worthless", "feel meaningless", "no joy",
            "can't feel anything", "nothing brings joy", "stopped enjoying",
            "can barely", "barely get out", "hard to get up",
        ],
        "Anxiety": [
            "anxious", "anxiety", "nervous", "worry", "worried", "worrying",
            "panic", "panicked", "panic attack", "fear", "afraid", "scared",
            "frightened", "tense", "on edge", "restless", "can't relax",
            "heart racing", "racing heart", "shortness of breath", "overthinking",
            "overthink", "dread", "dreading", "can't sleep", "can't stop worrying",
            "palpitations", "sweating", "shaking", "trembling", "feel scared",
            "terrified", "social anxiety", "avoid", "avoiding", "public speaking",
            "crowded", "meeting", "before events", "catastrophize",
        ],
        "Stress": [
            "stressed", "stress", "overwhelmed", "pressure", "pressured",
            "burnout", "burned out", "burnt out", "overloaded", "too much",
            "can't cope", "struggling", "difficult time", "hard time",
            "challenging", "demanding", "drained", "worn out",
            "work stress", "work pressure", "deadline", "overwhelm",
            "too many things", "can't handle", "falling behind", "swamped",
        ],
        "Bipolar": [
            "mood swings", "manic", "bipolar", "highs and lows", "extreme mood",
            "impulsive", "racing thoughts", "decreased need for sleep",
            "grandiose", "euphoric", "irritable", "cycling moods", "mania",
            "very up then down", "energy crashes", "spending sprees",
        ],
        "Personality Disorder": [
            "identity crisis", "unstable relationships", "fear of abandonment",
            "intense relationships", "splitting", "nobody understands",
            "misunderstood", "betrayed", "manipulated", "borderline",
            "impulsive behavior", "self-sabotage", "empty inside",
        ],
        "Normal": [],
    }

    def __init__(self):
        """Initialize BERT model (lazy load in load_model)"""
        self.model = None
        self.tokenizer = None
        self._model_loaded = False
        # NLTK resources — lazy-loaded on first call to _preprocess_answer
        self._stopwords: set = set()
        self._lemmatizer = None
        self._nltk_ready = False

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

    # ─────────────────────────────────────────────────────────────────
    # HYBRID ENGINE
    # ─────────────────────────────────────────────────────────────────

    def _score_with_keywords(self, text: str) -> Optional[Dict[str, float]]:
        """
        Match text against CLINICAL_KEYWORDS and return a soft probability
        distribution normalised to sum to 1 across the 7 labels.

        Returns None when NO keywords matched any label — caller treats that
        as "no keyword signal" and falls back to BERT-only output.

        The input should be the ORIGINAL (un-preprocessed) user text so that
        multi-word phrases like "can't get out of bed" are still intact.
        """
        text_lower = text.lower()
        raw: Dict[str, int] = {}

        for label, kws in self.CLINICAL_KEYWORDS.items():
            if label == "Normal" or not kws:
                continue
            raw[label] = sum(1 for kw in kws if kw in text_lower)

        total = sum(raw.values())
        if total == 0:
            return None  # No keyword signal — trust BERT alone

        # Normalise counts → soft probabilities across all 7 slots
        all_labels = list(self.LABEL_MAP.values())
        probs: Dict[str, float] = {lbl: 0.0 for lbl in all_labels}
        for label, count in raw.items():
            probs[label] = count / total
        return probs

    def _hybrid_classify(
        self,
        preprocessed_text: str,
        original_text: str,
        bert_weight: float = 0.65,
    ) -> Dict[str, any]:
        """
        Run BERT on `preprocessed_text` and keyword scoring on `original_text`,
        then blend the two probability distributions.

        Blending formula
        ----------------
            hybrid[label] = bert_weight  * bert_prob[label]
                          + kw_weight    * keyword_prob[label]

        where kw_weight = 1 − bert_weight.

        Keywords only influence the result when at least one keyword matched
        (i.e., `_score_with_keywords` returns a non-None dict). Otherwise the
        method returns the raw BERT result unchanged — so keywords never hurt
        when the user's text contains none of them.

        Why two separate texts?
        -----------------------
        • BERT receives the *preprocessed* text (stopwords removed, lemmatised)
          because the training data was preprocessed the same way.
        • Keywords are matched against the *original* text because multi-word
          phrases like "can't get out of bed" are destroyed by preprocessing.
        """
        # ── BERT inference ─────────────────────────────────────────────────
        bert_result = self.classify_with_bert(preprocessed_text)

        # Crisis short-circuit (fast_crisis_detection already returned)
        if bert_result.get("label") == "Suicidal":
            return bert_result

        bert_probs: Dict[str, float] = bert_result.get("probabilities", {})
        if not bert_probs:
            # BERT unavailable (keyword_fallback) — return as-is
            return bert_result

        # ── Keyword scoring ───────────────────────────────────────────────
        kw_probs = self._score_with_keywords(original_text)
        if kw_probs is None:
            # No clinical keyword found — trust BERT fully
            bert_result.setdefault("method", "bert_only")
            return bert_result

        # ── Blend ──────────────────────────────────────────────────────────
        kw_weight = 1.0 - bert_weight
        all_labels = set(bert_probs) | set(kw_probs)
        blended: Dict[str, float] = {
            label: bert_weight * bert_probs.get(label, 0.0)
                   + kw_weight  * kw_probs.get(label, 0.0)
            for label in all_labels
        }

        # Re-normalise (floating-point drift)
        total = sum(blended.values())
        if total > 0:
            blended = {k: v / total for k, v in blended.items()}

        best_label = max(blended, key=blended.get)
        best_conf  = blended[best_label]
        best_id    = self.REVERSE_LABEL_MAP.get(best_label, 3)

        # Log when keywords changed the BERT winner
        bert_label = bert_result["label"]
        if bert_label != best_label:
            print(
                f"[HYBRID] keyword override: {bert_label} → {best_label} "
                f"(bert={bert_probs.get(best_label, 0):.1%} | "
                f"kw={kw_probs.get(best_label, 0):.1%} | "
                f"hybrid={best_conf:.1%})"
            )
            method = f"hybrid_override({bert_label}→{best_label})"
        else:
            print(
                f"[HYBRID] confirmed {best_label} @ {best_conf:.1%} "
                f"(bert={bert_probs.get(best_label, 0):.1%}, "
                f"kw={kw_probs.get(best_label, 0):.1%})"
            )
            method = "hybrid_confirmed"

        return {
            "label":        best_label,
            "label_id":     best_id,
            "confidence":   best_conf,
            "probabilities": blended,
            "method":       method,
        }

    def _load_nltk(self) -> bool:
        """
        Lazy-load NLTK stopwords and WordNet lemmatizer.
        Called once on first preprocess — avoids startup overhead.
        Returns True if resources loaded successfully.
        """
        if self._nltk_ready:
            return True
        try:
            import nltk
            from nltk.corpus import stopwords
            from nltk.stem import WordNetLemmatizer

            # Download only if missing (silent)
            for pkg in ("stopwords", "wordnet", "omw-1.4"):
                try:
                    nltk.data.find(f"corpora/{pkg}")
                except LookupError:
                    nltk.download(pkg, quiet=True)

            # Build stopword set — PRESERVE affective / negation words that
            # carry strong clinical meaning even after stopword removal.
            # Removing these would change "not happy" → "happy", which is
            # exactly the kind of signal BERT relies on.
            AFFECTIVE_KEEP = {
                # Negation
                "no", "not", "never", "neither", "nor", "nothing", "nobody",
                "nowhere", "none", "cannot", "can't", "won't", "don't",
                "doesn't", "didn't", "wouldn't", "couldn't", "isn't",
                "aren't", "wasn't", "weren't", "haven't", "hasn't", "hadn't",
                # Isolation / extremes
                "alone", "anymore", "ever", "always", "anymore", "every",
                # Degree / intensity
                "very", "too", "so", "really",
            }
            raw_stops = set(stopwords.words("english"))
            self._stopwords = raw_stops - AFFECTIVE_KEEP
            self._lemmatizer = WordNetLemmatizer()
            self._nltk_ready = True
            print("[NLP] NLTK stopwords + lemmatizer loaded")
            return True
        except Exception as exc:
            print(f"[NLP] NLTK unavailable ({exc}) — skipping normalization")
            return False

    def _preprocess_answer(self, text: str) -> str:
        """
        Normalize a free-text conversational answer to match the distribution
        of the BERT model's training data (preprocessed Reddit/social posts).

        Pipeline
        ────────
        1. Lowercase + strip
        2. Remove URLs
        3. Punctuation → space  (keep apostrophes for negation contractions)
        4. Collapse whitespace
        5. Stopword removal  (affective/negation words PRESERVED — see _load_nltk)
        6. WordNet lemmatization  ("exhausted" → "exhaust", "hopeless" stays)
        7. Collapse whitespace again

        Why this matters
        ────────────────
        Training examples look like:
          "barely get bed feel exhaust hopeless life meaningless"
        A raw user answer looks like:
          "I can barely get out of bed, I feel completely exhausted and hopeless"
        After this pipeline:
          "barely get bed feel completely exhaust hopeless"
        → Dramatically closer to training distribution → BERT classifies correctly.
        """
        # ── Steps 1-4: basic cleaning ─────────────────────────────────────────
        t = text.lower().strip()
        t = re.sub(r"https?://\S+", "", t)     # remove URLs
        t = re.sub(r"[^\w\s']", " ", t)         # punctuation → space
        t = re.sub(r"\s{2,}", " ", t).strip()   # collapse spaces

        # ── Steps 5-6: NLTK normalization (if available) ─────────────────────
        if self._load_nltk():
            tokens = t.split()
            tokens = [
                self._lemmatizer.lemmatize(w)
                for w in tokens
                if w not in self._stopwords
            ]
            t = " ".join(tokens)
            t = re.sub(r"\s{2,}", " ", t).strip()

        return t


    def _aggregate_probabilities(
        self,
        per_answer_results: List[Dict[str, any]],
        weights: List[float],
    ) -> Dict[str, float]:
        """
        Compute weighted average of per-answer probability distributions.

        Each answer contributes proportionally to its `weight` (token length).
        This prevents a very short answer from dominating the final score.

        Returns a dict {label: avg_prob} normalized to sum to 1.
        """
        # Collect all seen labels
        all_labels = set()
        for r in per_answer_results:
            all_labels.update(r.get("probabilities", {}).keys())

        if not all_labels:
            # Fallback: uniform distribution
            return {lbl: 1 / 7 for lbl in self.LABEL_MAP.values()}

        total_w = sum(weights)
        averaged: Dict[str, float] = {}
        for label in all_labels:
            averaged[label] = sum(
                r.get("probabilities", {}).get(label, 0.0) * w
                for r, w in zip(per_answer_results, weights)
            ) / total_w

        # Renormalize (floating-point drift)
        total_p = sum(averaged.values())
        if total_p > 0:
            averaged = {k: v / total_p for k, v in averaged.items()}

        return averaged

    def analyze_followup_responses(
        self,
        text_responses: List[str],
        questions: Optional[List[str]] = None,
    ) -> Dict[str, any]:
        """
        Analyze up to 3 follow-up text answers using per-answer BERT inference
        with weighted probability aggregation.

        WHY per-answer instead of concatenation
        ----------------------------------------
        The BERT model was fine-tuned on short, first-person Reddit/social
        posts (~30-50 tokens) expressing a single mental state.  Feeding it a
        long Q+A chain (~100+ tokens) causes two problems:

          1. **Distribution mismatch** – Q+A structure ≠ training examples.
          2. **Token budget dilution** – questions consume ~50 % of the 512-
             token budget without carrying emotional content.

        Running BERT on each answer independently (typically 10-40 tokens,
        first-person statements) matches the training distribution far better.
        Probability vectors are then averaged (length-weighted) to produce a
        single final distribution, which is both more stable and more accurate
        than a single long-context inference.

        Crisis pre-filter
        -----------------
        Before any BERT call, keyword screening (`nlp_utils.classify_text`) is
        applied to the entire concatenated text.  A Suicidal hit short-circuits
        everything and returns immediately with confidence 1.0.

        Args:
            text_responses: 1-3 free-text answers from the FollowUp form.
            questions:      Corresponding follow-up questions (not used for
                            BERT input anymore, kept for API compatibility).

        Returns:
            Standard classification dict:
            {label, label_id, confidence, probabilities, method}
        """
        if not text_responses:
            return {
                "label": "Normal",
                "label_id": self.REVERSE_LABEL_MAP["Normal"],
                "confidence": 1.0,
                "probabilities": {},
                "method": "no_input",
            }

        # ── 1. Whole-text crisis pre-filter ───────────────────────────────────
        try:
            from services.nlp_sentiment_analysis.nlp_utils import classify_text
            all_text = " ".join(filter(None, text_responses))
            if classify_text(all_text) == "Suicidal":
                print("[BERT] Crisis pre-filter triggered — Suicidal detected")
                return {
                    "label": "Suicidal",
                    "label_id": self.REVERSE_LABEL_MAP["Suicidal"],
                    "confidence": 1.0,
                    "probabilities": {},
                    "method": "fast_crisis_detection",
                }
        except ImportError:
            pass

        # ── 2. Filter answers that have actual content ────────────────────────
        answered: List[str] = [a.strip() for a in text_responses if a.strip()]
        if not answered:
            return {
                "label": "Normal",
                "label_id": self.REVERSE_LABEL_MAP["Normal"],
                "confidence": 1.0,
                "probabilities": {},
                "method": "no_input",
            }

        # ── 3. Per-answer BERT inference ──────────────────────────────────────
        per_results: List[Dict[str, any]] = []
        weights: List[float] = []

        for ans in answered:
            preprocessed = self._preprocess_answer(ans)
            if not preprocessed:
                continue
            print(f"[BERT] answer: '{preprocessed[:80]}'")
            # ── Core change: use hybrid instead of bare BERT ─────────────────────
            # BERT runs on preprocessed text (closer to training distribution).
            # Keyword matching runs on the original text to preserve
            # multi-word phrases like "can't get out of bed".
            result = self._hybrid_classify(preprocessed, ans)
            per_results.append(result)
            # Weight = sqrt of token count (diminishing returns for long answers)
            token_count = len(preprocessed.split())
            weights.append(max(1.0, token_count ** 0.5))

        if not per_results:
            return {
                "label": "Normal",
                "label_id": self.REVERSE_LABEL_MAP["Normal"],
                "confidence": 1.0,
                "probabilities": {},
                "method": "no_input",
            }

        # Single answer — return directly (no aggregation needed)
        if len(per_results) == 1:
            result = per_results[0]
            result.setdefault("method", "bert_single")
            return result

        # ── 4. Aggregate probability distributions ────────────────────────────
        aggregated_probs = self._aggregate_probabilities(per_results, weights)

        # Determine winning label
        best_label = max(aggregated_probs, key=aggregated_probs.get)
        best_confidence = aggregated_probs[best_label]
        best_label_id = self.REVERSE_LABEL_MAP.get(best_label, 3)  # 3 = Normal

        print(
            f"[BERT] aggregated ({len(per_results)} answers): "
            f"{best_label} @ {best_confidence:.1%}"
        )
        return {
            "label": best_label,
            "label_id": best_label_id,
            "confidence": best_confidence,
            "probabilities": aggregated_probs,
            "method": f"bert_aggregate_{len(per_results)}",
        }


# ── Singleton + thread-safety ────────────────────────────────────────────────
import threading

_analyzer: "BertSentimentAnalyzer | None" = None
_analyzer_lock = threading.Lock()


def get_analyzer() -> "BertSentimentAnalyzer":
    """
    Return the process-wide singleton BertSentimentAnalyzer.
    Thread-safe: uses a Lock so concurrent requests on startup
    cannot create two instances (and load BERT twice).
    """
    global _analyzer
    if _analyzer is None:               # fast path (no lock overhead after init)
        with _analyzer_lock:
            if _analyzer is None:       # double-checked locking
                _analyzer = BertSentimentAnalyzer()
    return _analyzer


def warm_up() -> None:
    """
    Pre-load BERT model + NLTK resources at server startup.

    Call this from the FastAPI lifespan / startup event so the
    first real user request is not delayed by model loading (~5-30s).
    """
    print("[BERT] Warming up — loading model and NLTK resources...")
    analyzer = get_analyzer()
    analyzer.load_model()          # loads BERT weights from disk
    analyzer._load_nltk()          # downloads / caches NLTK corpora
    print("[BERT] Warm-up complete — model ready.")


def analyze_sentiment(
    text_responses: List[str],
    questions: Optional[List[str]] = None
) -> Dict[str, any]:
    """
    Analyze mental health sentiment for a list of follow-up text responses.

    Full pipeline
    ─────────────
    1. Crisis pre-filter  — keyword scan of ALL answers; Suicidal halts pipeline
    2. Per-answer preprocessing  — NLTK stopwords remove + lemmatize
    3. Per-answer hybrid inference  — BERT (0.65) + keyword score (0.35)
    4. Length-weighted probability aggregation  — outputs final label

    Args:
        text_responses: 1–3 free-text answers from the FollowUp form.
        questions:      Follow-up questions (kept for API compatibility;
                        no longer used as BERT input).

    Returns:
        {label, label_id, confidence, probabilities, method}
    """
    analyzer = get_analyzer()
    return analyzer.analyze_followup_responses(text_responses, questions=questions)
