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

    # PHQ-9 score → clinical meaning (for LLM context)
    PHQ9_SEVERITY = {
        "Normal":   "minimal/no depression (0-4)",
        "Mild":     "mild depression (5-9)",
        "Moderate": "moderate depression (10-14)",
        "Severe":   "moderately severe to severe depression (15-27)",
    }

    # GAD-7 score → clinical meaning (for LLM context)
    GAD7_SEVERITY = {
        "Normal":   "minimal/no anxiety (0-4)",
        "Mild":     "mild anxiety (5-9)",
        "Moderate": "moderate anxiety (10-14)",
        "Severe":   "severe anxiety (15-21)",
    }

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

    def generate_response(
        self,
        user_query: str,
        expanded_query: str,
        retriever,
        baseline_severity: str,
        baseline_issue: str,
        realtime_status: str,
        is_vietnamese: bool = False,
        # -- Clinical detail fields (optional, enriches LLM context) --
        phq9_score: int | None = None,
        phq9_severity: str | None = None,
        gad7_score: int | None = None,
        gad7_severity: str | None = None,
    ) -> str:
        """
        OPTIMIZED (LLM Call #2):
        - Generate mental health response ONLY in detected language.
        - Clinical detail (PHQ-9 / GAD-7 raw scores + severity) is injected
          into the profile block so the LLM has full quantitative context.

        Args:
            user_query:        Original user query (for memory).
            expanded_query:    Expanded/translated query for retrieval.
            retriever:         Vector store retriever.
            baseline_severity: Overall severity level (Normal/Mild/Moderate/Severe).
            baseline_issue:    Dominant concern (Depression/Anxiety/Mixed/None).
            realtime_status:   BERT NLP label from follow-up text analysis.
            is_vietnamese:     Whether response should be in Vietnamese.
            phq9_score:        Raw PHQ-9 total score (0-27).
            phq9_severity:     PHQ-9 severity label.
            gad7_score:        Raw GAD-7 total score (0-21).
            gad7_severity:     GAD-7 severity label.
        """
        docs = retriever.invoke(expanded_query)
        context = "\n\n".join([doc.page_content for doc in docs])
        chat_history = self.chat_history[-self.max_history:]

        # -- Normalize values --
        _severity = baseline_severity or "Unknown"
        _issue    = baseline_issue    or "None"
        _realtime = realtime_status   or None

        # -- Build PHQ-9 / GAD-7 detail lines --
        def _score_line_vi(score, sev, label, sev_map):
            if score is not None and sev:
                desc = sev_map.get(sev, sev)
                return f"    {label}: {score} diem -- {sev} ({desc})"
            return f"    {label}: Khong co du lieu"

        def _score_line_en(score, sev, label, sev_map):
            if score is not None and sev:
                desc = sev_map.get(sev, sev)
                return f"    {label}: {score} -- {sev} ({desc})"
            return f"    {label}: No data"

        phq9_line_vi = _score_line_vi(phq9_score, phq9_severity, "PHQ-9 (Trầm cảm)", self.PHQ9_SEVERITY)
        gad7_line_vi = _score_line_vi(gad7_score, gad7_severity, "GAD-7 (Lo âu)",    self.GAD7_SEVERITY)
        phq9_line_en = _score_line_en(phq9_score, phq9_severity, "PHQ-9 (Depression)", self.PHQ9_SEVERITY)
        gad7_line_en = _score_line_en(gad7_score, gad7_severity, "GAD-7 (Anxiety)",    self.GAD7_SEVERITY)

        # -- Build realtime block --
        if _realtime and _realtime.lower() not in ("none", "unknown", ""):
            realtime_block_vi = (
                f"  Cảm xúc hiện tại (BERT NLP): {_realtime}\n"
                "  → Ưu tiên phản hồi với cảm xúc hiện tại, nhưng vẫn ghi nhớ tình trạng nền."
            )
            realtime_block_en = (
                f"  Current Emotion (BERT NLP): {_realtime}\n"
                "  -> Prioritize the user's current emotional state while remaining mindful of their baseline."
            )
        else:
            realtime_block_vi = (
                "  Cảm xúc hiện tại: Không có (người dùng bỏ qua phần phân tích văn bản)\n"
                "  → Chỉ dựa vào Baseline lâm sàng để hiểu tình trạng người dùng."
            )
            realtime_block_en = (
                "  Current Emotion: Not available (user skipped NLP text analysis)\n"
                "  -> Rely solely on the clinical Baseline to understand the user's condition."
            )

        # -- Vietnamese prompt --
        if is_vietnamese:
            system_prompt = (
                "NGÔN NGỮ BẮT BUỘC: Bạn PHẢI trả lời 100% bằng tiếng VIỆT, không được dùng tiếng Anh.\n\n"
                "Bạn là MindCare AI — trợ lý hỗ trợ sức khỏe tâm thần thông tuệ, giàu sự thấu cảm và không phán xét.\n\n"

                "NGUYÊN TẮC GIAO TIẾP:\n"
                "- Luôn trả lời bằng tiếng Việt tự nhiên, giống cách một người thực sự quan tâm và lắng nghe.\n"
                "- Ưu tiên sự thấu hiểu cảm xúc trước khi đưa ra lời khuyên.\n"
                "- Tránh giọng điệu máy móc hoặc quá khuôn mẫu.\n\n"

                "HỒ SƠ TÂM LÝ NGƯỜI DÙNG\n"
                "  Baseline lâm sàng (PHQ-9 + GAD-7, đánh giá 2 tuần qua):\n"
                "{phq9_line}\n"
                "{gad7_line}\n"
                "    Tổng mức độ      : {baseline_severity}\n"
                "    Vấn đề chủ yếu  : {baseline_issue}\n"
                "{realtime_block}\n\n"
                "Hướng dẫn đọc hồ sơ:\n"
                "  • Normal + không có cảm xúc hiện tại → người dùng ổn, tập trung wellness và phòng ngừa.\n"
                "  • Mild/Moderate/Severe → điều chỉnh sâu độ hỗ trợ phù hợp với mức độ.\n"
                "  • Cảm xúc hiện tại khác Baseline → tin tưởng cảm xúc hiện tại hơn; Baseline là bối cảnh nền.\n"
                "  • Cảm xúc hiện tại = Suicidal → BẮT BUỘC cung cấp đường dây khủng hoảng NGAY LẬP TỨC.\n\n"
                "QUY TẮC AN TOÀN:\n"
                "1. Suicidal → cung cấp ngay: 1800 599 920 (Việt Nam, miễn phí), 988 (Hoa Kỳ).\n"
                "2. Không bao giờ chẩn đoán y tế. Gợi ý tham khảo chuyên gia khi cần.\n"
                "3. Luôn nhắc bạn là AI, không thay thế được bác sĩ / chuyên gia tâm lý có chứng chỉ.\n"
                "4. Phản hồi ấm áp, tích cực, tôn trọng văn hóa và cá nhân người dùng.\n\n"
                "ĐỊNH DẠNG PHẢN HỒI (dùng Markdown):\n"
                "  • Độ dài: 3-5 đoạn ngắn hoặc kết hợp đoạn + danh sách (≤ 800 từ).\n"
                "  • Bắt đầu bằng câu cảm thông ghi nhận cảm xúc người dùng.\n"
                "  • Dùng **in đậm** cho từ khóa quan trọng, kỹ thuật, hoặc hành động.\n"
                "  • Dùng danh sách gạch đầu dòng (- item) cho các bước / tips.\n"
                "  • Dùng bảng Markdown khi cần so sánh hoặc trình bày nhiều kỹ thuật:\n"
                "    | Kỹ thuật | Mô tả | Khi nào dùng |\n"
                "    |---------|-------|-------------|\n"
                "    | ... | ... | ... |\n"
                "  • Kết thúc bằng câu hỏi mở khuyến khích người dùng chia sẻ thêm.\n\n"
                "Bối cảnh tài liệu tham khảo (RAG):\n"
                "{context}"
            )

            prompt_template = ChatPromptTemplate.from_messages([
                ("system", system_prompt),
                MessagesPlaceholder(variable_name="chat_history"),
                # Pass original Vietnamese text so LLM context is Vietnamese → responds in Vietnamese
                ("human", "[PHẢI TRẢ LỜI BẰNG TIẾNG VIỆT] {query}")
            ])

            response = (prompt_template | self.llm | StrOutputParser()).invoke({
                "context":           context,
                "chat_history":      chat_history,
                "query":             user_query,   # ← original Vietnamese, NOT the English translation
                "baseline_severity": _severity,
                "baseline_issue":    _issue,
                "realtime_block":    realtime_block_vi,
                "phq9_line":         phq9_line_vi,
                "gad7_line":         gad7_line_vi,
            })

        # -- English prompt --
        else:
            system_prompt = (
                "You are MindCare AI -- a compassionate, empathetic, and non-judgmental mental health support assistant.\n\n"

                "COMMUNICATION PRINCIPLES:\n"
                "- Always respond in natural, empathetic English, like a caring listener.\n"
                "- Prioritize emotional validation before offering advice.\n"
                "- Avoid robotic or overly formulaic phrasing.\n\n"

                "USER MENTAL HEALTH PROFILE\n"
                "  Clinical Baseline (PHQ-9 + GAD-7, assessed over the past 2 weeks):\n"
                "{phq9_line}\n"
                "{gad7_line}\n"
                "    Overall Severity : {baseline_severity}\n"
                "    Dominant Concern : {baseline_issue}\n"
                "{realtime_block}\n\n"
                "Profile interpretation guide:\n"
                "  * Normal + no current emotion -> user is generally well; focus on wellness and prevention.\n"
                "  * Mild/Moderate/Severe -> tailor the depth of support to match that severity level.\n"
                "  * Current emotion differs from Baseline -> trust current emotion more; Baseline is background context.\n"
                "  * Current Emotion = Suicidal -> MUST provide crisis helpline IMMEDIATELY before anything else.\n\n"
                "SAFETY RULES:\n"
                "1. Suicidal -> immediately provide: 988 (US Suicide & Crisis Lifeline), 1800 599 920 (Vietnam, free).\n"
                "2. Never give medical diagnoses. Suggest a mental health professional when the issue exceeds AI scope.\n"
                "3. Always clarify you are an AI and cannot replace a licensed mental health professional.\n"
                "4. Respond with warmth, positivity, and hope. Respect cultural and individual differences.\n\n"
                "RESPONSE FORMAT (use Markdown):\n"
                "  * Length: 3-5 short paragraphs or mixed prose + lists (max ~800 words).\n"
                "  * Always open with an empathy statement acknowledging the user's feelings.\n"
                "  * Use **bold** for key terms, techniques, or action items.\n"
                "  * Use bullet lists (- item) for steps, tips, or options.\n"
                "  * Use a Markdown table when comparing techniques or summarizing multiple items:\n"
                "    | Technique | Description | Best For |\n"
                "    |-----------|-------------|----------|\n"
                "    | ...       | ...         | ...      |\n"
                "  * End with an open-ended follow-up question to encourage further sharing.\n\n"
                "Retrieved reference context (RAG):\n"
                "{context}"
            )

            prompt_template = ChatPromptTemplate.from_messages([
                ("system", system_prompt),
                MessagesPlaceholder(variable_name="chat_history"),
                ("human", "User: {query}")
            ])

            response = (prompt_template | self.llm | StrOutputParser()).invoke({
                "context":           context,
                "chat_history":      chat_history,
                "query":             user_query,   # ← original user message
                "baseline_severity": _severity,
                "baseline_issue":    _issue,
                "realtime_block":    realtime_block_en,
                "phq9_line":         phq9_line_en,
                "gad7_line":         gad7_line_en,
            })

        # Save to chat history
        self.chat_history.append(HumanMessage(content=user_query))
        self.chat_history.append(AIMessage(content=response))
        return response
