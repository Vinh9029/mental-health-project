# =====================================================================
# MODULE: APPLICATION CONSTANTS
# =====================================================================

# ===== SESSION STATE STAGES =====
STAGE_QUESTIONNAIRE = "QUESTIONNAIRE"
STAGE_CHATBOT = "CHATBOT"
STAGE_RESULTS = "RESULTS"
STAGE_TREATMENT = "TREATMENT"

# ===== ASSESSMENT CONSTANTS =====
PHQ9_MAX_SCORE = 27
GAD7_MAX_SCORE = 21

# Severity thresholds for PHQ-9
PHQ9_THRESHOLDS = {
    "Normal": (0, 4),
    "Mild": (5, 9),
    "Moderate": (10, 14),
    "Severe": (15, 27)
}

# Severity thresholds for GAD-7
GAD7_THRESHOLDS = {
    "Normal": (0, 4),
    "Mild": (5, 9),
    "Moderate": (10, 14),
    "Severe": (15, 21)
}

# Severity level mapping (numeric)
SEVERITY_LEVELS = {
    "Normal": 0,
    "Mild": 1,
    "Moderate": 2,
    "Severe": 3
}

SEVERITY_REVERSE = {v: k for k, v in SEVERITY_LEVELS.items()}

# ===== CHATBOT CONSTANTS =====
NUM_CONVERSATION_TURNS = 3  # Number of Q&A turns (user wants 2-3, we'll do 3)
CONVERSATION_QUESTIONS_PER_TURN = 1

# ===== SENTIMENT ANALYSIS =====
SENTIMENT_SCALE = {
    "Very Negative": -1.0,
    "Negative": -0.5,
    "Neutral": 0.0,
    "Positive": 0.5,
    "Very Positive": 1.0
}

# Thresholds for sentiment classification
SENTIMENT_THRESHOLDS = {
    "very_negative": (-1.0, -0.6),
    "negative": (-0.6, -0.2),
    "neutral": (-0.2, 0.2),
    "positive": (0.2, 0.6),
    "very_positive": (0.6, 1.0)
}

# ===== MODEL PATHS =====
MODEL_NAME = "bert-base-uncased"
BERT_MODEL_PATH = "data/bert_model"
TFIDF_PATH = "data/tfidf_vectorizer.pkl"
SVD_PATH = "data/svd_transformer.pkl"
SCALER_PATH = "data/standard_scaler.pkl"

# ===== TRAINED MODELS PATHS (từ Kaggle) =====
# Models are loaded from D:\IT_Project_\models\ (or d:\IT_Project_\models\ on Windows)
MODELS_BASE_PATH = "models"  # Relative to project root
SVM_MODEL_PATH = f"{MODELS_BASE_PATH}/svm/svm_model_full.pkl"
LSTM_MODEL_PATH = f"{MODELS_BASE_PATH}/lstm/lstm_model_full.pt"
BERT_TRAINED_MODEL_PATH = f"{MODELS_BASE_PATH}/bert"

# MODEL_PATHS dict for easy access
MODEL_PATHS = {
    'base_path': MODELS_BASE_PATH,
    'svm': SVM_MODEL_PATH,
    'lstm': LSTM_MODEL_PATH,
    'bert': BERT_TRAINED_MODEL_PATH,
    'models': {
        'svm': SVM_MODEL_PATH,
        'lstm': LSTM_MODEL_PATH,
        'bert': BERT_TRAINED_MODEL_PATH,
    }
}

# 7 Mental Health Classifications (Output Labels)
# MUST match the training dataset labels exactly
# From Kaggle training log: {'anxiety': 0, 'bipolar': 1, 'depression': 2, 'normal': 3, 'personality disorder': 4, 'stress': 5, 'suicidal': 6}
MENTAL_HEALTH_LABELS = {
    0: "Anxiety",
    1: "Bipolar",
    2: "Depression",
    3: "Normal",
    4: "Personality Disorder",
    5: "Stress",
    6: "Suicidal"
}

# ===== DATABASE CONSTANTS =====
SUPABASE_URL = None  # Will load from environment
SUPABASE_KEY = None  # Will load from environment

# ===== UI CONSTANTS =====
PAGE_ICON = "🧠"
PAGE_TITLE = "Mental Health Assessment & Support"
LAYOUT = "wide"
INITIAL_SIDEBAR_STATE = "expanded"

# Color scheme
COLORS = {
    "primary": "#1f77b4",
    "success": "#2ca02c",
    "warning": "#ff7f0e",
    "danger": "#d62728",
    "info": "#17a2b8",
    "normal": "#90EE90",      # Light green
    "mild": "#FFD700",         # Gold
    "moderate": "#FFA500",     # Orange
    "severe": "#DC143C"        # Crimson
}

# Severity-based messages
SEVERITY_MESSAGES = {
    "Normal": "✅ Your assessment shows normal mental health status. Keep maintaining good habits!",
    "Mild": "⚠️ You're experiencing mild symptoms. Consider practicing self-care techniques.",
    "Moderate": "⚠️⚠️ You're experiencing moderate symptoms. Professional support is recommended.",
    "Severe": "🚨 You're experiencing severe symptoms. Please reach out to a mental health professional immediately.",
}

# ===== RECOMMENDATION MESSAGES =====
RECOMMENDATIONS = {
    0: [  # Normal
        {"title": "Continue Healthy Practices", "description": "✅ Continue your current healthy habits and lifestyle"},
        {"title": "Maintain Activity", "description": "💪 Keep regular exercise and social activities"},
        {"title": "Sleep Hygiene", "description": "😴 Maintain a consistent, healthy sleep routine"},
        {"title": "Preventive Mindfulness", "description": "🧘 Practice mindfulness or meditation for mental wellness"}
    ],
    1: [  # Mild
        {"title": "Journal Your Thoughts", "description": "✨ Try journaling to express and process your feelings"},
        {"title": "Increase Physical Activity", "description": "🚶 Engage in regular exercise - walks, yoga, or sports"},
        {"title": "Seek Social Support", "description": "🗣️ Talk to friends, family, or consider a counselor"},
        {"title": "Learn Relaxation Techniques", "description": "📚 Practice breathing exercises or progressive muscle relaxation"}
    ],
    2: [  # Moderate
        {"title": "Professional Consultation", "description": "🏥 Consider consulting a therapist, counselor, or psychiatrist"},
        {"title": "Medical Evaluation", "description": "💊 Ask your doctor about potential treatment options"},
        {"title": "Evidence-Based Therapy", "description": "🧠 Start Cognitive Behavioral Therapy (CBT) or similar approaches"},
        {"title": "Support Communities", "description": "🤝 Join support groups for your specific condition"}
    ],
    3: [  # Severe
        {"title": "URGENT: Seek Professional Help", "description": "🚨 Contact a mental health professional immediately"},
        {"title": "Crisis Support", "description": "📞 Call a crisis hotline if you're in immediate danger"},
        {"title": "Inpatient Treatment", "description": "🏥 Consider inpatient or intensive treatment programs"},
        {"title": "Emergency Services", "description": "🆘 Contact emergency services if you're at risk of self-harm"}
    ]
}

# ===== TIMEOUT SETTINGS =====
SESSION_TIMEOUT_MINUTES = 30
INACTIVITY_WARNING_MINUTES = 25

# ===== METADATA =====
APP_VERSION = "1.0.0"
LAST_UPDATED = "2024-03-18"
DISCLAIMER = """
⚠️ **MEDICAL DISCLAIMER:**
This application provides AI-assisted assessments and is NOT a replacement for professional medical diagnosis or treatment. 
The results are based on self-reported information and machine learning models, which may not be 100% accurate.

Always consult with qualified mental health professionals for proper diagnosis and treatment.
If you're in crisis or having thoughts of self-harm, please contact emergency services immediately.
"""
