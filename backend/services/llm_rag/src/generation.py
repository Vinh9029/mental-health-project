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
        - Identify mental health keywords
        - Classify intent (clinical, general, casual)
        - Returns: (translated_query, expanded_query, query_type)
        """
        import re
        # ── Rule-based casual pre-filter (fast path — no LLM call needed) ─────
        _CASUAL_PATTERNS = [
            # Greetings / farewells
            r"^(hi|hello|hey|xin ch[àa]o|ch[àa]o|good morning|good evening|good night|ch[àa]o bu[ổo]i)",
            r"^(c[ảa]m [ơo]n|thanks?|thank you|ok(ay)?|alright|t[ạa]m bi[ệe]t|bye|kh[ôo]ng c[óo] g[ìi])",
            # Everyday chitchat
            r"(th[ờơ]i ti[ếe]t|cu[ốo]i tu[ầa]n|[ăa]n g[ìi] ngon|ng[ủu] ngon|ch[úu]c m[ừu]ng)",
            r"^(haha|hihi|hehe|lol|[😂🤣😄😊💚🙏👋])",
            # Identity questions
            r"^(b[ạa]n t[êe]n g[ìi]|b[ạa]n l[àa] ai|what('s| is) your name|who are you)",
            # ── Entertainment / leisure (KEY: prevent wrong RAG trigger) ──────
            r"(s[áa]ch.*gi[ảa]i tr[íi]|gi[ảa]i tr[íi].*s[áa]ch|g[ợo]i [ýy].*s[áa]ch|s[áa]ch hay|n[êe]n [dđ][oọ][cđ].*s[áa]ch)",
            r"(quy[êe]n s[áa]ch|[dđ][oọ][cđ] s[áa]ch.*vui|[dđ][oọ][cđ] g[ìi] cho vui)",
            r"(phim hay|xem phim|b[àa]i h[áa]t|nghe nh[ạa]c|ch[ơo]i game|du l[ịi]ch)",
            r"(recommend.*book|suggest.*book|book.*fun|book.*entertain|book.*leisure|book.*relax|book.*enjoy)",
            r"(what.*watch|what.*listen|movie.*recommend|music.*recommend|song.*suggest|game.*recommend)",
            r"(c[óo] ph[ải]m g[ìi]|xem g[ìi] hay|l[àa]m g[ìi] vui|entertainment|leisure activity)",
        ]
        for _pat in _CASUAL_PATTERNS:
            if re.search(_pat, user_query.strip(), re.IGNORECASE):
                return user_query, user_query, "casual"
        # ─────────────────────────────────────────────────────────────────────
        # ── Tier 1.5: Keyword-score pre-classification (no LLM needed) ────────────
        # If the query contains clear mental-health keywords, route to RAG even
        # before reaching the LLM classifier. This prevents the LLM from wrongly
        # labelling a mental-health query as "casual".
        _MH_CLINICAL_KEYWORDS = [
            # CBT & therapy techniques
            "cbt", "cognitive behavioral", "cognitive behaviour", "nhận thức hành vi",
            "exposure therapy", "liệu pháp phơi nhiễm",
            "behavioral activation", "kích hoạt hành vi",
            "thought record", "nhật ký suy nghĩ",
            "distorted thinking", "cognitive distortion", "sai lệch nhận thức",
            "grounding technique", "kỹ thuật neo giữ",
            "socratic questioning",
            # Specific symptoms
            "suicidal", "tự tử", "tự làm đau", "self-harm", "panic attack",
            "phobia", "ám ảnh", "ptsd", "rối loạn", "disorder",
            "antidepressant", "thuốc chống trầm cảm",
            # Clinical assessment
            "phq-9", "phq9", "gad-7", "gad7", "beck depression",
        ]
        _MH_GENERAL_KEYWORDS = [
            # Conditions (general awareness, not clinical detail)
            "trầm cảm", "depression", "lo âu", "anxiety", "stress", "căng thẳng",
            "mất ngủ", "insomnia", "cô đơn", "loneliness",
            "sức khỏe tâm thần", "mental health", "well-being", "wellbeing",
            # Wellness practices
            "thiền", "meditation", "mindfulness", "chánh niệm",
            "hít thở", "breathing", "thư giãn", "relaxation",
            "tập thể dục", "exercise", "yoga",
            # Emotional states in a support context
            "cảm xúc", "emotion", "tâm trạng", "mood",
            "coping", "đối phó",
        ]
        _q_lower = user_query.lower()
        if any(kw in _q_lower for kw in _MH_CLINICAL_KEYWORDS):
            _tier15_type = "clinical"
        elif any(kw in _q_lower for kw in _MH_GENERAL_KEYWORDS):
            _tier15_type = "general"
        else:
            _tier15_type = None  # let LLM decide
        # ─────────────────────────────────────────────────────────────────────
        lang = self.detect_language(user_query)
        # If Tier 1.5 already determined type, we still translate (VI only) but skip LLM classify
        if _tier15_type and lang != 'vi':
            return user_query, user_query, _tier15_type

        if lang == 'vi':
            combined_prompt = PromptTemplate.from_template(
                """Translate Vietnamese to English, add mental health keywords, and classify query intent.
                Intent categories:
                - "clinical": Specific CBT techniques, therapy methods, symptoms, mental health treatment.
                  Examples: "CBT là gì?", "Kỹ thuật thở 4-7-8", "Triệu chứng trầm cảm", "Cách giảm lo âu lâm sàng".
                - "general": General mental health overviews, wellness tips, mindfulness basics.
                  Examples: "Thiền định có lợi gì?", "Sức khỏe tâm thần là gì?", "Cách ngủ ngon hơn".
                - "casual": Everyday conversation, entertainment, leisure, non-mental-health topics.
                  Examples: "Gợi ý sách giải trí", "Hôm nay thời tiết thế nào?", "Bạn tên gì?",
                            "Recommend me a movie", "Suggest books to read for fun", "What games should I play?".
                  IMPORTANT: Book/movie/music recommendations for ENTERTAINMENT = casual.
                  IMPORTANT: Questions about the AI itself = casual.

                Return ONLY: "TRANSLATION: [english text] | KEYWORDS: [comma-separated keywords] | TYPE: [clinical/general/casual]"

                Vietnamese query:
                {query}"""
            )
            chain = combined_prompt | self.llm | StrOutputParser()
            result = chain.invoke({"query": user_query})

            try:
                parts = result.split(" | ")
                translated = parts[0].replace("TRANSLATION: ", "").strip()
                keywords = parts[1].replace("KEYWORDS: ", "").strip() if len(parts) > 1 else ""
                q_type = parts[2].replace("TYPE: ", "").strip().lower() if len(parts) > 2 else "general"
                
                # Validation — Tier 1.5 override has priority if set
                if q_type not in ["clinical", "general", "casual"]:
                    q_type = _tier15_type or "casual"
                elif _tier15_type and _tier15_type != "casual":
                    # Tier 1.5 detected MH keywords → upgrade to MH type if LLM said casual
                    if q_type == "casual":
                        q_type = _tier15_type
                
                expanded = f"{translated}, {keywords}" if keywords else translated
                return translated, expanded, q_type
            except:
                return result.strip(), result.strip(), _tier15_type or "casual"

        # For English
        keyword_prompt = PromptTemplate.from_template(
            """Classify this query intent and expand with keywords.
            Intent categories:
            - "clinical": CBT techniques, therapy methods, clinical symptoms, mental health treatment.
              Examples: "What is CBT?", "Breathing techniques for anxiety", "Depression symptoms".
            - "general": Broad wellness, mindfulness, general mental health overviews.
              Examples: "Benefits of meditation", "How to sleep better", "What is mental health?".
            - "casual": Everyday chat, entertainment, leisure, non-mental-health topics.
              Examples: "Suggest books to read for fun", "Recommend a movie", "What music should I listen to?",
                        "How are you?", "What's your name?", "Tell me a joke".
              IMPORTANT: Recommendations for entertainment/fun/leisure = casual (NOT general).

            Return ONLY: "EXPANDED: [query + relevant keywords] | TYPE: [clinical/general/casual]"

            User query:
            {query}"""
        )
        chain = keyword_prompt | self.llm | StrOutputParser()
        result = chain.invoke({"query": user_query})
        
        try:
            parts = result.split(" | ")
            expanded = parts[0].replace("EXPANDED: ", "").strip()
            q_type = parts[1].replace("TYPE: ", "").strip().lower() if len(parts) > 1 else "general"
            if q_type not in ["clinical", "general", "casual"]:
                q_type = "casual"  # safer default
            return user_query, expanded, q_type
        except:
            return user_query, user_query, "casual"  # safer: don't force RAG on parse failure

    def generate_response(
        self,
        user_query: str,
        expanded_query: str,
        retriever,
        baseline_severity: str,
        baseline_issue: str,
        realtime_status: str,
        query_type: str = "general",
        is_vietnamese: bool = False,
        # -- Clinical detail fields --
        phq9_score: int | None = None,
        phq9_severity: str | None = None,
        gad7_score: int | None = None,
        gad7_severity: str | None = None,
        # -- Behavioural context --
        mood_context: list | None = None,
        journal_context: list | None = None,
    ) -> dict:
        """
        OPTIMIZED (LLM Call #2):
        - Generate mental health response ONLY in detected language.
        - Clinical detail (PHQ-9 / GAD-7 raw scores + severity) is injected
        - mood_context:    List of recent mood check-ins
        - journal_context: List of recent journal AI summaries
        
        Returns:
            dict: {
                "reply": str,
                "sources": [
                    {"content": str, "source": str, "page": int/str, "ref": str},
                    ...
                ]
            }
        """
        # ── Intent-based RAG Routing ──────────────────────────────────────────
        sources_for_frontend = []
        rag_context = ""
        
        # Only perform RAG for clinical or general queries
        if query_type in ["clinical", "general"]:
            docs = retriever.invoke(expanded_query)
            print(f"\n[RAG] ({query_type}) Retrieved {len(docs)} documents for: '{expanded_query[:50]}...'")
            
            rag_context_list = []
            for i, doc in enumerate(docs):
                source_raw = doc.metadata.get('source', 'CBT Document')
                import os
                source_name = os.path.basename(source_raw)
                page = doc.metadata.get('page', '?')
                
                try:
                    if isinstance(page, (float, str)) and float(page) == int(float(page)):
                        page = int(float(page))
                except:
                    pass
                
                page_label = "trang" if is_vietnamese else "p."
                ref_label = f"[{source_name}, {page_label} {page}]"
                
                print(f"  {i+1}. {ref_label} {doc.page_content[:150]}...")
                rag_context_list.append(f"REFERENCE {ref_label}:\n{doc.page_content}")
                
                sources_for_frontend.append({
                    "content": doc.page_content,
                    "source": source_name,
                    "page": page,
                    "ref": ref_label
                })
            rag_context = "\n\n".join(rag_context_list)

            # ── Empty RAG: downgrade to casual so LLM doesn't hallucinate ──────────
            if not docs:
                print(f"[RAG] No documents found — downgrading '{query_type}' to general-knowledge response.")
                query_type = "casual"   # skip CBT prompt path
                rag_context = "[No relevant reference documents were found in the knowledge base for this query. Answer from general knowledge and be transparent about it.]"
        else:
            print(f"\n[RAG] Skipping retrieval for '{query_type}' query.")
            rag_context = "No reference documents provided for this casual interaction."
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

        # ── Build previous-response fingerprint to prevent repetition ──────────────
        _prev_ai_openings: list[str] = []
        for msg in chat_history:
            from langchain_core.messages import AIMessage as _AI
            if isinstance(msg, _AI):
                _first60 = msg.content.strip()[:60].replace('\n', ' ')
                if _first60:
                    _prev_ai_openings.append(f'  • "{_first60}…"')
        _anti_repeat_block = (
            "ANTI-REPETITION: You MUST NOT copy or paraphrase the following previous replies.\n"
            "Start with a COMPLETELY different phrase and structure:\n"
            + "\n".join(_prev_ai_openings[-3:])
        ) if _prev_ai_openings else ""

        # -- Vietnamese prompt selection --
        if is_vietnamese:
            if query_type == "casual":
                system_prompt = (
                    "Bạn là MindCare AI — một người bạn đồng hành thấu cảm và thân thiện.\n"
                    "NGÔN NGỮ: Bạn PHẢI trả lời hoàn toàn bằng tiếng VIỆT.\n\n"
                    "PHONG CÁCH:\n"
                    "- Đây là một cuộc trò chuyện xã giao hoặc ngoài lề lâm sàng.\n"
                    "- Hãy trả lời một cách tự nhiên, ấm áp và chân thành như một người bạn.\n"
                    "- CẤM: TUYỆT ĐỐI không đề cập đến CBT, liệu pháp tâm lý, trích dẫn tài liệu.\n"
                    "- CẤM: TUYỆT ĐỐI không mở đầu bằng 'Chào bạn! Tôi hiểu cảm xúc hiện tại'.\n"
                    "- FORMATTING: Sử dụng Markdown một cách đẹp mắt và nhất quán (in đậm các từ khóa quan trọng, sử dụng danh sách dạng bullet, chia đoạn ngắn rõ ràng).\n"
                    "- Giữ phản hồi ngắn gọn (1-2 đoạn hoặc bullet points), đa dạng câu mở đầu.\n\n"
                    "{anti_repeat}\n\n"
                    "HỒ SƠ NGƯỜI DÙNG (Để tham khảo bối cảnh):\n"
                    "{phq9_line}\n"
                    "{gad7_line}\n"
                    "Mức độ: {baseline_severity}\n"
                    "{realtime_block}\n"
                )
            else:
                system_prompt = (
                    "NGÔN NGỮ BẮT BUỘC: Bạn PHẢI trả lời 100% bằng tiếng VIỆT.\n"
                    "Bạn là MindCare AI — trợ lý sức khỏe tâm thần chuyên sâu, thấu cảm.\n\n"
                    "QUY TẮC QUAN TRỌNG:\n"
                    "- Trả lời ấm áp, đa dạng câu mở đầu — KHÔNG lặp lại khuôn mẫu.\n"
                    "- GROUNDING BẮT BUỘC: Câu trả lời PHẢI dựa trực tiếp vào DỮ LIỆU THAM KHẢO bên dưới.\n"
                    "  Nếu tài liệu có đề cập đến chủ đề → tổng hợp và giải thích từ tài liệu đó.\n"
                    "  Nếu tài liệu KHÔNG liên quan → thừa nhận và trả lời từ kiến thức tổng quát.\n"
                    "- TRÍCH DẪN NGUỒN: Dùng `[Tên_file.pdf, trang X]` khi trích từ RAG.\n\n"
                    "NHẬN THỨC HỔ SƠ (Rất quan trọng):\n"
                    "- Bạn ĐÃ CÓ ĐẦY ĐỦ thông tin tâm lý của người dùng trong HỒ SƠ bên dưới.\n"
                    "- Nếu người dùng hỏi về tình trạng tâm lý của họ, HÃY TRẢ LỜI DỰA TRÊN DỮ LIỆU HỒ SƠ ngay —\n"
                    "  KHÔNG hỏi họ cung cấp thêm thông tin mà bạn đã có. Vi dụ: nếu PHQ-9=12 → nói rõ mức độ trầm cảm.\n\n"
                    "{anti_repeat}\n\n"
                    "HỒ SƠ NGƯỜI DÙNG:\n"
                    "{phq9_line}\n"
                    "{gad7_line}\n"
                    "Tình trạng: {baseline_severity} | Vấn đề: {baseline_issue}\n"
                    "{realtime_block}\n\n"
                    "DỮ LIỆU THAM KHẢO (RAG):\n"
                    "{context}"
                )

            prompt_template = ChatPromptTemplate.from_messages([
                ("system", system_prompt),
                MessagesPlaceholder(variable_name="chat_history"),
                ("human", "{query}")
            ])

            response = (prompt_template | self.llm | StrOutputParser()).invoke({
                "context":           rag_context,
                "chat_history":      chat_history,
                "query":             user_query,
                "baseline_severity": _severity,
                "baseline_issue":    _issue,
                "realtime_block":    realtime_block_vi,
                "phq9_line":         phq9_line_vi,
                "gad7_line":         gad7_line_vi,
                "anti_repeat":       _anti_repeat_block,
            })
        
        # -- English prompt selection --
        else:
            if query_type == "casual":
                system_prompt = (
                    "You are MindCare AI — a warm and empathetic companion.\n"
                    "STYLE:\n"
                    "- This is a casual or non-clinical interaction.\n"
                    "- Respond naturally, like a caring friend.\n"
                    "- FORBIDDEN: Do NOT mention CBT, therapy techniques, or clinical citations.\n"
                    "- FORBIDDEN: Do NOT start with 'I understand your current emotional state'.\n"
                    "- FORMATTING: Use clean, consistent Markdown (bold key terms, use bullet points if listing things, keep paragraphs short and readable).\n"
                    "- Keep it concise (1-2 paragraphs or short lists). Use a varied, fresh opening.\n\n"
                    "{anti_repeat}\n\n"
                    "USER CONTEXT (for tone awareness only):\n"
                    "{phq9_line}\n"
                    "{gad7_line}\n"
                    "Severity: {baseline_severity}\n"
                    "{realtime_block}"
                )
            else:
                system_prompt = (
                    "You are MindCare AI — a compassionate mental health assistant.\n\n"
                    "CRITICAL RULES:\n"
                    "- GROUNDING: Your response MUST be directly based on the REFERENCE DATA below.\n"
                    "  If the references address the topic → synthesize and explain from them.\n"
                    "  If the references are NOT relevant → acknowledge this and use general knowledge.\n"
                    "- CITATIONS: Use `[Filename.pdf, p. X]` whenever you draw from a reference.\n"
                    "- TONE: Warm, varied openers — never repeat the same greeting pattern.\n\n"
                    "PROFILE AWARENESS (Critical):\n"
                    "- You ALREADY HAVE the user's full psychological profile in USER CONTEXT below.\n"
                    "- If the user asks about their mental/psychological state, USE THE DATA DIRECTLY.\n"
                    "  Example: if PHQ-9=12 → state they show moderate depression indicators.\n"
                    "  Do NOT ask them to provide info you already have.\n\n"
                    "{anti_repeat}\n\n"
                    "USER CONTEXT:\n"
                    "{phq9_line}\n"
                    "{gad7_line}\n"
                    "Severity: {baseline_severity} | Issue: {baseline_issue}\n"
                    "{realtime_block}\n\n"
                    "REFERENCE DATA (RAG):\n"
                    "{context}"
                )

            prompt_template = ChatPromptTemplate.from_messages([
                ("system", system_prompt),
                MessagesPlaceholder(variable_name="chat_history"),
                ("human", "{query}")
            ])

            response = (prompt_template | self.llm | StrOutputParser()).invoke({
                "context":           rag_context,
                "chat_history":      chat_history,
                "query":             user_query,
                "baseline_severity": _severity,
                "baseline_issue":    _issue,
                "realtime_block":    realtime_block_en,
                "phq9_line":         phq9_line_en,
                "gad7_line":         gad7_line_en,
                "anti_repeat":       _anti_repeat_block,
            })


        # Save to chat history
        self.chat_history.append(HumanMessage(content=user_query))
        self.chat_history.append(AIMessage(content=response))
        
        return {
            "reply": response,
            "sources": sources_for_frontend
        }

