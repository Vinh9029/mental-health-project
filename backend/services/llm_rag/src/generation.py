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
        # -- Behavioural context (mood + journal, pulled fresh per request) --
        mood_context: list | None = None,
        journal_context: list | None = None,
    ) -> str:
        """
        OPTIMIZED (LLM Call #2):
        - Generate mental health response ONLY in detected language.
        - Clinical detail (PHQ-9 / GAD-7 raw scores + severity) is injected
          into the profile block so the LLM has full quantitative context.
        - mood_context:    List of recent mood check-ins
                          [{emoji, label, stress_score, note, created_at}, ...]
        - journal_context: List of recent journal AI summaries
                          [{ai_summary, created_at}, ...]
        Both are injected as a 'Personal Behavioural Context' block that
        gives the LLM live, user-specific data BEFORE the CBT RAG docs.

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
            mood_context:      Recent mood check-ins (max 3).
            journal_context:   Recent journal AI summaries (max 2).
        """
        docs = retriever.invoke(expanded_query)
        rag_context = "\n\n".join([doc.page_content for doc in docs])
        chat_history = self.chat_history[-self.max_history:]

        # -- Build Mood Context block --
        def _build_mood_block_vi(moods: list) -> str:
            if not moods:
                return "  Mood check-in gần đây: Không có dữ liệu."
            lines = ["  Mood check-in gần đây (từ mới nhất):"]
            for m in moods[:3]:
                stress = f", căng thẳng {m.get('stress_score')}/10" if m.get('stress_score') is not None else ""
                note = f" — '{m.get('note')}' " if m.get('note') else ""
                lines.append(f"    • {m.get('emoji','')} {m.get('label','')}{stress}{note}")
            return "\n".join(lines)

        def _build_mood_block_en(moods: list) -> str:
            if not moods:
                return "  Recent mood check-ins: No data available."
            lines = ["  Recent mood check-ins (newest first):"]
            for m in moods[:3]:
                stress = f", stress {m.get('stress_score')}/10" if m.get('stress_score') is not None else ""
                note = f" — '{m.get('note')}' " if m.get('note') else ""
                lines.append(f"    • {m.get('emoji','')} {m.get('label','')}{stress}{note}")
            return "\n".join(lines)

        # -- Build Journal Context block --
        def _build_journal_block_vi(journals: list) -> str:
            if not journals:
                return "  Tóm tắt nhật ký gần đây: Không có dữ liệu."
            lines = ["  Tóm tắt nhật ký gần đây (AI phân tích):"]
            for j in journals[:2]:
                summary = (j.get('ai_summary') or '').strip()
                if summary:
                    # Show first 200 chars to keep prompt tight
                    preview = summary[:200] + ('…' if len(summary) > 200 else '')
                    lines.append(f"    › {preview}")
            return "\n".join(lines)

        def _build_journal_block_en(journals: list) -> str:
            if not journals:
                return "  Recent journal AI insights: No data available."
            lines = ["  Recent journal AI insights:"]
            for j in journals[:2]:
                summary = (j.get('ai_summary') or '').strip()
                if summary:
                    preview = summary[:200] + ('…' if len(summary) > 200 else '')
                    lines.append(f"    › {preview}")
            return "\n".join(lines)

        _mood_list    = mood_context    or []
        _journal_list = journal_context or []
        mood_block_vi    = _build_mood_block_vi(_mood_list)
        mood_block_en    = _build_mood_block_en(_mood_list)
        journal_block_vi = _build_journal_block_vi(_journal_list)
        journal_block_en = _build_journal_block_en(_journal_list)

        # Personal context = mood + journal, placed BEFORE CBT RAG docs
        personal_context_vi = (
            "[Ngữ cảnh cá nhân của người dùng — ưu tiên cao hơn tài liệu tham khảo]\n"
            f"{mood_block_vi}\n"
            f"{journal_block_vi}"
        )
        personal_context_en = (
            "[User's personal context — higher priority than reference documents]\n"
            f"{mood_block_en}\n"
            f"{journal_block_en}"
        )

        # Full context = personal (live) + RAG (knowledge base)
        context_vi = f"{personal_context_vi}\n\n[Tài liệu CBT tham khảo (RAG)]\n{rag_context}"
        context_en = f"{personal_context_en}\n\n[CBT Reference Documents (RAG)]\n{rag_context}"

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
                "- Luôn trả lời bằng tiếng Việt tự nhiên, ấm áp, giống cách một người bạn thực sự quan tâm và lắng nghe.\n"
                "- Ưu tiên sự thấu hiểu cảm xúc trước khi đưa ra lời khuyên hoặc kỹ thuật.\n"
                "- Tránh giọng điệu máy móc, quá khuôn mẫu hoặc lặp lại câu mở đầu giống nhau.\n\n"

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
                "ĐỊNH DẠNG PHẢN HỒI (dùng Markdown — BẮT BUỘC tuân theo):\n"
                "\n"
                "  CẤU TRÚC:\n"
                "  • Độ dài: 5–8 đoạn hoặc kết hợp đoạn + danh sách (≤ 800 từ).\n"
                "  • **Dòng đầu tiên**: câu cảm thông ấm áp, ghi nhận cảm xúc cụ thể của người dùng (KHÔNG bắt đầu bằng 'Tôi hiểu...' mãi mãi — hãy đa dạng).\n"
                "  • Nếu có nhiều ý / bước / mẹo → dùng danh sách thay vì viết thành đoạn dài.\n"
                "  • **Dòng cuối cùng**: câu hỏi mở khuyến khích người dùng chia sẻ thêm.\n"
                "\n"
                "  VĂN BẢN ĐẬM & NGHIÊNG:\n"
                "  • Dùng **in đậm** cho: tên kỹ thuật (vd: **Thở 4-7-8**), hành động chính, từ khóa quan trọng.\n"
                "  • Dùng *nghiêng* cho: cảm xúc mô tả (vd: *mệt mỏi*, *lo lắng*), nhấn mạnh nhẹ.\n"
                "  • KHÔNG in đậm toàn bộ câu.\n"
                "\n"
                "  DANH SÁCH (bullet / numbered):\n"
                "  • Dùng `- item` cho danh sách không có thứ tự (tips, gợi ý, triệu chứng).\n"
                "  • Dùng `1. item` cho các bước theo trình tự (hướng dẫn từng bước).\n"
                "  • Mỗi bullet ngắn gọn (1–2 dòng), KHÔNG lồng quá 2 cấp.\n"
                "\n"
                "  TIÊU ĐỀ:\n"
                "  • Dùng `## Tiêu đề` khi phản hồi có ≥2 phần rõ ràng (vd: ## Hiểu cảm xúc / ## Kỹ thuật thực hành).\n"
                "  • KHÔNG dùng `#` (h1) — chỉ dùng `##` hoặc `###`.\n"
                "\n"
                "  BẢNG MARKDOWN:\n"
                "  • Dùng bảng khi so sánh ≥3 kỹ thuật/phương pháp hoặc tóm tắt nhiều mục cùng loại.\n"
                "  • Mẫu bảng kỹ thuật:\n"
                "    | Kỹ thuật | Mô tả ngắn | Khi nào dùng |\n"
                "    |----------|------------|--------------|\n"
                "    | **Thở 4-7-8** | Hít 4s – giữ 7s – thở ra 8s | Cơn lo âu cấp |\n"
                "    | **Grounding 5-4-3-2-1** | Nhận diện 5 thứ nhìn thấy... | Căng thẳng, phân tâm |\n"
                "  • KHÔNG dùng bảng cho nội dung có thể diễn đạt bằng 1–2 câu.\n\n"
                "{context}"
            )

            prompt_template = ChatPromptTemplate.from_messages([
                ("system", system_prompt),
                MessagesPlaceholder(variable_name="chat_history"),
                # Pass original Vietnamese text so LLM context is Vietnamese → responds in Vietnamese
                ("human", "[PHẢI TRẢ LỜI BẰNG TIẾNG VIỆT] {query}")
            ])

            response = (prompt_template | self.llm | StrOutputParser()).invoke({
                "context":           context_vi,
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
                "You are MindCare AI — a compassionate, empathetic, and non-judgmental mental health support assistant.\n\n"

                "COMMUNICATION PRINCIPLES:\n"
                "- Respond in warm, natural English like a caring, trusted friend who genuinely listens.\n"
                "- Validate the user's emotions first before offering techniques or advice.\n"
                "- Vary your opening lines — never start every reply with 'I understand...' or 'I hear you...'.\n"
                "- Avoid robotic, over-clinical, or formulaic phrasing.\n\n"

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
                "RESPONSE FORMAT (use Markdown — STRICTLY follow these rules):\n"
                "\n"
                "  STRUCTURE:\n"
                "  * Length: 3–5 paragraphs or mixed prose + lists (max ~800 words).\n"
                "  * **First line**: a warm, specific empathy statement acknowledging the user's exact feeling (vary the phrasing each time).\n"
                "  * If sharing multiple tips, steps, or techniques -> use a list or table, NOT a long paragraph.\n"
                "  * **Last line**: an open-ended question to invite the user to share more.\n"
                "\n"
                "  BOLD & ITALIC:\n"
                "  * Use **bold** for: technique names (e.g., **Box Breathing**), key action items, critical warnings.\n"
                "  * Use *italic* for: emotional descriptors (e.g., *overwhelmed*, *exhausted*), gentle emphasis.\n"
                "  * Do NOT bold entire sentences.\n"
                "\n"
                "  LISTS:\n"
                "  * Use `- item` for unordered lists (tips, options, symptoms).\n"
                "  * Use `1. item` for sequential steps (guided exercises, instructions).\n"
                "  * Keep each bullet concise (1–2 lines). Do NOT nest more than 2 levels.\n"
                "\n"
                "  HEADINGS:\n"
                "  * Use `## Heading` when the response has ≥2 clearly distinct sections (e.g., ## Understanding Your Feelings / ## Practical Techniques).\n"
                "  * Never use `#` (h1). Use only `##` or `###`.\n"
                "\n"
                "  MARKDOWN TABLES:\n"
                "  * Use a table when comparing ≥3 techniques/methods or summarizing multiple structured items.\n"
                "  * Table template for techniques:\n"
                "    | Technique | How It Works | Best For |\n"
                "    |-----------|--------------|----------|\n"
                "    | **Box Breathing** | Inhale 4s → Hold 4s → Exhale 4s → Hold 4s | Acute anxiety |\n"
                "    | **5-4-3-2-1 Grounding** | Name 5 things you see, 4 you feel... | Panic, dissociation |\n"
                "  * Do NOT use a table for content that fits in 1–2 sentences.\n\n"
                "{context}"
            )

            prompt_template = ChatPromptTemplate.from_messages([
                ("system", system_prompt),
                MessagesPlaceholder(variable_name="chat_history"),
                ("human", "User: {query}")
            ])

            response = (prompt_template | self.llm | StrOutputParser()).invoke({
                "context":           context_en,
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
