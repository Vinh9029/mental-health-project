from langchain_core.prompts import PromptTemplate, ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import SystemMessage, BaseMessage, AIMessage, HumanMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.chat_history import BaseChatMessageHistory
import langdetect
from langdetect import detect, LangDetectException
from functools import lru_cache
import json
import os

class ResponseGenerator:
    """Responsible for prompt creation, memory management, and LLM calls (OPTIMIZED - 2 calls max)."""
    # Initialize with LLM and memory for conversation history. Memory keeps the last 5 interactions for context.
    def __init__(self, llm):
        self.llm = llm
        self.chat_history = []  # Store last 5 messages
        self.max_history = 5
        
        # LRU Cache for language detection
        self._lang_cache = {}
        self.MAX_CACHE_SIZE = 256

    @lru_cache(maxsize=128)
    def detect_language(self, text: str) -> str:
        """
        Detect the language of input text with caching.
        Returns 'vi' for Vietnamese, 'en' for English, or defaults to 'en'.
        """
        try:
            detected_lang = detect(text[:100])  # Use first 100 chars to speed up detection
            return detected_lang
        except LangDetectException:
            return 'en'

    def _translate_with_llm(self, text: str, target_lang: str, source_lang: str = 'vi') -> str:
        """
        Translate using LLM with minimal token usage (extreme optimization).
        Returns ONLY translated text, no explanation.
        """
        translation_prompt = PromptTemplate.from_template(
            "Translate {source_lang} to {target_lang}:\n{text}"
        )
        chain = translation_prompt | self.llm | StrOutputParser()
        translated = chain.invoke({"text": text, "source_lang": source_lang, "target_lang": target_lang})
        return translated.strip()

    def translate_and_expand_query(self, user_query: str) -> tuple:
        """
        VIETNAMESE OPTIMIZATION (LLM Call #1):
        - Translate query to English
        - Identify mental health keywords in SAME call
        - Returns: (translated_query, english_query)
        
        This replaces 2 separate calls (translate + expand) into 1 call.
        """
        lang = self.detect_language(user_query)
        
        if lang == 'vi':
            # Single LLM call: translate + identify keywords
            combined_prompt = PromptTemplate.from_template(
                """Translate Vietnamese to English and add mental health keywords.
                Return ONLY: "TRANSLATION: [english text] | KEYWORDS: [comma-separated keywords]"
                
                Vietnamese query:
                {query}"""
            )
            chain = combined_prompt | self.llm | StrOutputParser()
            result = chain.invoke({"query": user_query})
            
            # Parse result format: "TRANSLATION: ... | KEYWORDS: ..."
            try:
                parts = result.split(" | KEYWORDS: ")
                translated = parts[0].replace("TRANSLATION: ", "").strip()
                keywords = parts[1].strip() if len(parts) > 1 else ""
                expanded = f"{translated}, {keywords}" if keywords else translated
                return translated, expanded
            except:
                return result.strip(), result.strip()
        
        # For English, just identify keywords
        keyword_prompt = PromptTemplate.from_template(
            """Identify mental health keywords and expand user query.
            Return ONLY expanded query with keywords, no explanation.
            
            User query:
            {query}"""
        )
        chain = keyword_prompt | self.llm | StrOutputParser()
        expanded = chain.invoke({"query": user_query})
        return user_query, expanded.strip()

    def generate_response(self, user_query: str, expanded_query: str, retriever, baseline_severity: str, baseline_issue: str, realtime_status: str, is_vietnamese: bool = False) -> str:
        """
        OPTIMIZED (LLM Call #2):
        - Generate mental health response ONLY in detected language
        - Saves tokens by not generating unnecessary language versions
        
        Args:
            user_query: Original user query (for memory)
            expanded_query: Expanded/translated query for retrieval
            retriever: Vector store retriever
            baseline_severity: Mental health severity level from Active test
            baseline_issue: Mental health condition from Active test
            realtime_status: NLP classification from Passive test (may be None)
            is_vietnamese: Whether response should be in Vietnamese
        """
        docs = retriever.invoke(expanded_query)
        context = "\n\n".join([doc.page_content for doc in docs])
        chat_history = self.chat_history[-self.max_history:]
        
        # ── Build profile context block (handle None / missing values) ──
        _severity = baseline_severity or "Unknown"
        _issue    = baseline_issue    or "None"
        _realtime = realtime_status   or None

        if _realtime and _realtime.lower() not in ("none", "unknown", ""):
            realtime_block_vi = (
                f"  Cảm xúc hiện tại (BERT NLP): {_realtime}\n"
                "  → Ưu tiên phản hồi với cảm xúc hiện tại, nhưng vẫn ghi nhớ tình trạng nền."
            )
            realtime_block_en = (
                f"  Current Emotion (BERT NLP from text): {_realtime}\n"
                "  → Prioritize the user's current emotional state while remaining mindful of their baseline."
            )
        else:
            realtime_block_vi = (
                "  Cảm xúc hiện tại: Không có (người dùng bỏ qua phần phân tích văn bản)\n"
                "  → Chỉ dựa vào Baseline lâm sàng để hiểu tình trạng người dùng."
            )
            realtime_block_en = (
                "  Current Emotion: Not available (user skipped NLP text analysis)\n"
                "  → Rely solely on the clinical Baseline to understand the user's condition."
            )

        if is_vietnamese:
            system_prompt = """⚠️ NGÔN NGỮ BẮT BUỘC: Bạn PHẢI trả lời 100% bằng tiếng VIỆT.

Bạn là MindCare AI — trợ lý hỗ trợ sức khỏe tâm thần thông tuệ, thông cảm và không phán xét.

═══ HỒ SƠ TÂM LÝ NGƯỜI DÙNG ═══
  Baseline lâm sàng (PHQ-9 + GAD-7, 2 tuần qua):
    Mức độ nghiêm trọng: {baseline_severity}
    Vấn đề chính       : {baseline_issue}
{realtime_block}
Hướng dẫn đọc hồ sơ:
  • Nếu Baseline = Normal + Không có cảm xúc hiện tại → người dùng nhìn chung ổn, tập trung wellness và phòng ngừa.
  • Nếu Baseline có vấn đề (Mild/Moderate/Severe) → điều chỉnh lời khuyên phù hợp với mức độ đó.
  • Nếu Cảm xúc hiện tại khác Baseline → tin tưởng cảm xúc hiện tại hơn; Baseline là bối cảnh nền.
  • Nếu Cảm xúc hiện tại = "Suicidal" → BẮT BUỘC cung cấp đường dây nóng NGAY LẬP TỨC.
════════════════════════════════════

QUY TẮC AN TOÀN:
1. Cảm xúc "Suicidal" → cung cấp ngay: 1925 (Việt Nam), 988 (Hoa Kỳ) và đề nghị liên hệ chuyên gia.
2. Không bao giờ chẩn đoán y tế. Gợi ý tham khảo chuyên gia khi cần.
3. Luôn nhắc bạn là AI, không thay thế được bác sĩ tâm lý có chuyên môn.
4. Phản hồi ấm áp, tích cực, tôn trọng văn hóa và cá nhân.

Bối cảnh tài liệu tham khảo (RAG):
{context}"""
            
            prompt_template = ChatPromptTemplate.from_messages([
                ("system", system_prompt),
                MessagesPlaceholder(variable_name="chat_history"),
                ("human", "{query}")
            ])
            
            response = (prompt_template | self.llm | StrOutputParser()).invoke({
                "context": context,
                "chat_history": chat_history,
                "query": expanded_query,
                "baseline_severity": _severity,
                "baseline_issue": _issue,
                "realtime_block": realtime_block_vi,
            })
        
        else:
            system_prompt = """You are MindCare AI — a compassionate, empathetic, and non-judgmental mental health support assistant.

═══ USER MENTAL HEALTH PROFILE ═══
  Clinical Baseline (PHQ-9 + GAD-7, Past 2 Weeks):
    Overall Severity : {baseline_severity}
    Dominant Concern : {baseline_issue}
{realtime_block}
Profile interpretation guide:
  • Baseline = Normal + No current emotion → user is generally well; focus on wellness and prevention.
  • Baseline shows concern (Mild/Moderate/Severe) → tailor advice to match that severity.
  • Current Emotion differs from Baseline → trust current emotion more; Baseline is background context.
  • Current Emotion = "Suicidal" → MUST provide crisis helpline IMMEDIATELY before anything else.
══════════════════════════════════

SAFETY RULES:
1. "Suicidal" emotion → immediately provide: 988 (US), 1925 (Vietnam), and urge professional contact.
2. Never give medical diagnoses. Suggest consulting a professional when appropriate.
3. Always clarify you are an AI and cannot replace a licensed mental health professional.
4. Respond with warmth, positivity, and hope. Respect cultural and individual differences.

Retrieved context for reference (RAG):
{context}"""
            
            prompt_template = ChatPromptTemplate.from_messages([
                ("system", system_prompt),
                MessagesPlaceholder(variable_name="chat_history"),
                ("human", "User: {query}")
            ])
            
            response = (prompt_template | self.llm | StrOutputParser()).invoke({
                "context": context,
                "chat_history": chat_history,
                "query": expanded_query,
                "baseline_severity": _severity,
                "baseline_issue": _issue,
                "realtime_block": realtime_block_en,
            })
        
        # Save to chat history
        self.chat_history.append(HumanMessage(content=user_query))
        self.chat_history.append(AIMessage(content=response))
        return response



