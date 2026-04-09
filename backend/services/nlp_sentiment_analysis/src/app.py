# =====================================================================
# MAIN STREAMLIT APPLICATION
# Mental Health Assessment Chatbot - 3 Phase Workflow (No Login)
# =====================================================================

import streamlit as st
from pathlib import Path
from datetime import datetime

# Import backend modules
from config import (
    STAGE_QUESTIONNAIRE,
    STAGE_CHATBOT,
    STAGE_RESULTS,
    COLORS,
    PHQ9_QUESTIONS,
    GAD7_QUESTIONS,
    SEVERITY_MESSAGES,
    RECOMMENDATIONS,
    ANSWER_OPTIONS,
    CRISIS_RESOURCES,
)

from src import (
    get_severity_level,
    calculate_baseline_profile,
    SentimentAnalyzer,
    ChatbotEngine,
)

# Try to import BERT (optional, with fallback)
try:
    from src import BertLabelPredictor
    BERT_AVAILABLE = True
except Exception as e:
    print(f"⚠️  BERT model not available: {e}")
    BERT_AVAILABLE = False

# =====================================================================
# PAGE CONFIG
# =====================================================================

st.set_page_config(
    page_title="Mental Health Assessment Chatbot",
    page_icon="🧠",
    layout="wide",
    initial_sidebar_state="expanded"
)

# =====================================================================
# INITIALIZE SESSION STATE
# =====================================================================

def initialize_session_state():
    """Initialize all session state variables."""
    if 'current_stage' not in st.session_state:
        st.session_state.current_stage = STAGE_QUESTIONNAIRE
    
    # Questionnaire responses
    if 'phq9_answers' not in st.session_state:
        st.session_state.phq9_answers = [0] * 9
    
    if 'gad7_answers' not in st.session_state:
        st.session_state.gad7_answers = [0] * 7
    
    if 'baseline_profile' not in st.session_state:
        st.session_state.baseline_profile = None
    
    # Chat phase
    if 'chatbot_engine' not in st.session_state:
        st.session_state.chatbot_engine = ChatbotEngine()
    
    if 'chat_history' not in st.session_state:
        st.session_state.chat_history = []
    
    if 'current_turn' not in st.session_state:
        st.session_state.current_turn = 0
    
    if 'user_messages' not in st.session_state:
        st.session_state.user_messages = []
    
    # Results
    if 'detected_label' not in st.session_state:
        st.session_state.detected_label = None
    
    if 'sentiment_analysis' not in st.session_state:
        st.session_state.sentiment_analysis = None


initialize_session_state()

# =====================================================================
# UTILITY FUNCTIONS
# =====================================================================

def change_stage(new_stage):
    """Change application stage."""
    st.session_state.current_stage = new_stage


def get_severity_color(severity_level):
    """Get color based on severity level."""
    color_map = {
        0: COLORS.get('normal', '#90EE90'),
        1: COLORS.get('mild', '#FFD700'),
        2: COLORS.get('moderate', '#FFA500'),
        3: COLORS.get('severe', '#DC143C'),
    }
    return color_map.get(severity_level, '#808080')


# =====================================================================
# PHASE 1: QUESTIONNAIRE
# =====================================================================

def render_questionnaire():
    """Render questionnaire phase (PHQ-9 + GAD-7)."""
    st.markdown("# 📋 Mental Health Questionnaire")
    st.markdown("---")
    
    # Welcome message
    st.markdown(
        """
        This questionnaire helps assess your current mental health status.
        Please answer honestly - your responses are confidential.
        
        **Instructions**: Rate each statement from 0 (Not at all) to 3 (Nearly every day)
        """
    )
    
    st.markdown("## PHQ-9: Depression Assessment")
    st.markdown("Over the last 2 weeks, how often have you been bothered by:")
    
    for i, question in enumerate(PHQ9_QUESTIONS):
        col1, col2 = st.columns([3, 1])
        with col1:
            st.markdown(f"{i+1}. {question}")
        with col2:
            st.session_state.phq9_answers[i] = st.selectbox(
                label="Response",
                options=[0, 1, 2, 3],
                format_func=lambda x: ANSWER_OPTIONS.get(x, ""),
                key=f"phq9_{i}",
                label_visibility="collapsed"
            )
    
    st.markdown("---")
    st.markdown("## GAD-7: Anxiety Assessment")
    st.markdown("Over the last 2 weeks, how often have you felt:")
    
    for i, question in enumerate(GAD7_QUESTIONS):
        col1, col2 = st.columns([3, 1])
        with col1:
            st.markdown(f"{i+1}. {question}")
        with col2:
            st.session_state.gad7_answers[i] = st.selectbox(
                label="Response",
                options=[0, 1, 2, 3],
                format_func=lambda x: ANSWER_OPTIONS.get(x, ""),
                key=f"gad7_{i}",
                label_visibility="collapsed"
            )
    
    st.markdown("---")
    
    # Submit button
    if st.button("✅ Complete Questionnaire", use_container_width=True, key="complete_questionnaire"):
        # Calculate baseline
        st.session_state.baseline_profile = calculate_baseline_profile(
            st.session_state.phq9_answers,
            st.session_state.gad7_answers
        )
        
        # Initialize chatbot
        severity_level = st.session_state.baseline_profile['baseline_level_numeric']
        st.session_state.chatbot_engine.set_session_context(
            severity_level,
            st.session_state.baseline_profile
        )
        
        # Move to chatbot phase
        change_stage(STAGE_CHATBOT)
        st.rerun()


# =====================================================================
# PHASE 2: CHATBOT CONVERSATION
# =====================================================================

def render_chatbot():
    """Render chatbot conversation phase."""
    st.markdown("# 💬 Chat Conversation")
    st.markdown("---")
    
    baseline_profile = st.session_state.baseline_profile
    severity_level = baseline_profile['baseline_level_numeric']
    severity_label = baseline_profile['overall_baseline_level']
    
    # Show baseline summary
    with st.expander("📊 Your Baseline Assessment", expanded=False):
        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("PHQ-9 Score", f"{baseline_profile['phq9_score']}/27", 
                     f"({baseline_profile['phq9_level']})")
        with col2:
            st.metric("GAD-7 Score", f"{baseline_profile['gad7_score']}/21",
                     f"({baseline_profile['gad7_level']})")
        with col3:
            st.metric("Primary Issue", baseline_profile['primary_issue'])
    
    # Show opening message
    opening_msg = st.session_state.chatbot_engine.get_opening_message()
    st.info(f"🤖 **Assistant**: {opening_msg}")
    
    # Display chat history
    st.markdown("---")
    for msg in st.session_state.chat_history:
        if msg['role'] == 'assistant':
            st.markdown(f"🤖 **Assistant**: {msg['content']}")
        else:
            st.markdown(f"👤 **You**: {msg['content']}")
    
    # Current turn
    if st.session_state.current_turn < 3:
        st.markdown("---")
        
        # Get next question
        if len(st.session_state.chat_history) == st.session_state.current_turn * 2:
            question_data = st.session_state.chatbot_engine.get_next_question()
            st.session_state.chat_history.append({
                'role': 'assistant',
                'content': question_data['question']
            })
        
        # Get question from history
        last_agent_msg = None
        for msg in reversed(st.session_state.chat_history):
            if msg['role'] == 'assistant':
                last_agent_msg = msg['content']
                break
        
        if last_agent_msg:
            st.markdown(f"🤖 **Assistant**: {last_agent_msg}")
        
        # User input
        user_response = st.text_area(
            "Your response:",
            placeholder="Share your thoughts here...",
            height=100,
            key="user_input"
        )
        
        col_send, col_skip = st.columns(2)
        
        with col_send:
            if st.button("📤 Send", use_container_width=True, key="send_btn"):
                if user_response.strip():
                    # Add user message to history
                    st.session_state.chat_history.append({
                        'role': 'user',
                        'content': user_response
                    })
                    st.session_state.user_messages.append(user_response)
                    st.session_state.current_turn += 1
                    st.rerun()
                else:
                    st.warning("Please enter a response")
        
        with col_skip:
            if st.button("⏭️  Skip", use_container_width=True, key="skip_btn"):
                st.session_state.user_messages.append("[Skipped]")
                st.session_state.current_turn += 1
                st.rerun()
    
    else:
        # Chatbot complete
        st.success("✅ Conversation complete! Processing results...")
        
        # Analyze sentiment
        sentiment_analyzer = SentimentAnalyzer(backend='vader')
        st.session_state.sentiment_analysis = sentiment_analyzer.analyze_chat_history(
            st.session_state.user_messages
        )
        
        # Detect label with BERT if available
        if BERT_AVAILABLE and st.session_state.user_messages:
            try:
                predictor = BertLabelPredictor()
                result = predictor.predict_from_aggregated_chat(st.session_state.user_messages)
                st.session_state.detected_label = result['predicted_label_name']
            except Exception as e:
                st.warning(f"Could not load BERT model: {e}")
                st.session_state.detected_label = "Review Required"
        else:
            st.session_state.detected_label = "Review Required"
        
        # Move to results
        change_stage(STAGE_RESULTS)
        st.rerun()


# =====================================================================
# PHASE 3: RESULTS & RECOMMENDATIONS
# =====================================================================

def render_results():
    """Render results and recommendations phase."""
    st.markdown("# 📈 Assessment Results")
    st.markdown("---")
    
    baseline_profile = st.session_state.baseline_profile
    severity_level = baseline_profile['baseline_level_numeric']
    severity_label = baseline_profile['overall_baseline_level']
    detected_label = st.session_state.detected_label or "Not Available"
    
    # Color code based on severity
    severity_color = get_severity_color(severity_level)
    
    # Display severity
    st.markdown(f"### Severity Level: **{severity_label}**")
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric("PHQ-9", f"{baseline_profile['phq9_score']}/27")
    
    with col2:
        st.metric("GAD-7", f"{baseline_profile['gad7_score']}/21")
    
    with col3:
        st.metric("Primary Issue", baseline_profile['primary_issue'])
    
    with col4:
        st.metric("Detected Label", detected_label)
    
    st.markdown("---")
    
    # Show message for severity level
    if severity_label in SEVERITY_MESSAGES:
        st.info(SEVERITY_MESSAGES[severity_label])
    
    st.markdown("---")
    
    # Show sentiment analysis
    if st.session_state.sentiment_analysis:
        st.markdown("### 📊 Sentiment Analysis")
        sentiment = st.session_state.sentiment_analysis
        
        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("Average Sentiment", f"{sentiment['average_sentiment']:.2f}")
        with col2:
            st.metric("Overall Mood", sentiment['overall_sentiment_label'].upper())
        with col3:
            st.metric("Dominant Emotions", ", ".join(sentiment['dominant_emotions']) or "None")
    
    st.markdown("---")
    
    # Show recommendations
    st.markdown("### 💡 Recommendations")
    
    if severity_level in RECOMMENDATIONS:
        for i, rec in enumerate(RECOMMENDATIONS[severity_level], 1):
            st.markdown(f"**{i}. {rec['title']}**")
            st.markdown(f"   {rec['description']}")
    
    st.markdown("---")
    
    # Show crisis resources if needed
    if severity_level >= 3:
        st.error("⚠️  **Important**: The symptoms you're experiencing are significant. "
                 "Please reach out for professional help.")
        
        st.markdown("### 🆘 Crisis Resources")
        st.markdown(f"**National Crisis Hotline**: {CRISIS_RESOURCES['hotline']}")
        st.markdown(f"**Website**: {CRISIS_RESOURCES['website']}")
        
        if 'international' in CRISIS_RESOURCES:
            st.markdown("**International Resources**:")
            for country, info in CRISIS_RESOURCES['international'].items():
                st.markdown(f"- **{country}**: {info}")
    
    st.markdown("---")
    
    # Action buttons
    col1, col2 = st.columns(2)
    
    with col1:
        if st.button("🔄 Restart Assessment", use_container_width=True):
            # Reset session state
            for key in list(st.session_state.keys()):
                if key != 'current_stage':
                    del st.session_state[key]
            change_stage(STAGE_QUESTIONNAIRE)
            st.rerun()
    
    with col2:
        if st.button("🏠 Home", use_container_width=True):
            for key in list(st.session_state.keys()):
                if key != 'current_stage':
                    del st.session_state[key]
            change_stage(STAGE_QUESTIONNAIRE)
            st.rerun()


# =====================================================================
# MAIN APP ROUTING
# =====================================================================

def main():
    """Main application router."""
    # Sidebar
    with st.sidebar:
        st.markdown("### 📱 Navigation")
        
        if st.button("🏠 Reset Assessment", use_container_width=True):
            for key in list(st.session_state.keys()):
                if key != 'current_stage':
                    del st.session_state[key]
            change_stage(STAGE_QUESTIONNAIRE)
            st.rerun()
        
        st.markdown("---")
        st.markdown("### ℹ️  About")
        st.markdown(
            """
            This is a mental health self-assessment tool that combines:
            - **PHQ-9** for depression screening
            - **GAD-7** for anxiety screening
            - **Conversational AI** for deeper understanding
            - **Sentiment Analysis** for emotional detection
            
            **Disclaimer**: This is not a substitute for professional 
            mental health evaluation. Please consult a healthcare provider 
            for proper diagnosis and treatment.
            """
        )
    
    # Main content routing
    if st.session_state.current_stage == STAGE_QUESTIONNAIRE:
        render_questionnaire()
    
    elif st.session_state.current_stage == STAGE_CHATBOT:
        render_chatbot()
    
    elif st.session_state.current_stage == STAGE_RESULTS:
        render_results()


if __name__ == "__main__":
    main()
