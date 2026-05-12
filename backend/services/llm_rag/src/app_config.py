import os
from dotenv import load_dotenv
from langchain_pinecone import PineconeVectorStore
from langchain_huggingface import HuggingFaceEmbeddings

# Load biến môi trường từ file .env
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
load_dotenv(dotenv_path=env_path, override=True)

# ── Provider switch ────────────────────────────────────────────────────────────
# Đặt LLM_PROVIDER=gemini trong .env để dùng Gemini API (Cloud, miễn phí)
# Đặt LLM_PROVIDER=lm_studio để dùng model local qua LM Studio
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "lm_studio")

# Gemini config
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
GEMINI_MODEL   = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

# LM Studio config
LOCAL_LLM_URL = os.getenv("LM_STUDIO_API_URL", os.getenv("LOCAL_LLM_URL", "http://127.0.0.1:1234/v1"))
LOCAL_LLM_KEY = os.getenv("LOCAL_LLM_KEY", "lm-studio")

# Pinecone + Cross-Encoder
PINECONE_API_KEY    = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX", os.getenv("PINECONE_INDEX_NAME", "mental-health-cbt"))
CROSS_ENCODER_MODEL = os.getenv("CROSS_ENCODER_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2")


def get_llm():
    """
    Tự động chọn LLM dựa trên biến LLM_PROVIDER trong .env:
      - 'gemini'   → Google Gemini 2.0 Flash (Cloud API, miễn phí)
      - 'lm_studio' → Local LM Studio (mặc định khi chạy local)
    """
    if LLM_PROVIDER == "gemini":
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
        except ImportError as e:
            raise ImportError(
                "Thiếu package langchain-google-genai. "
                "Chạy: pip install langchain-google-genai"
            ) from e
        print(f"[LLM] Dùng Gemini: {GEMINI_MODEL}")
        return ChatGoogleGenerativeAI(
            model=GEMINI_MODEL,
            google_api_key=GOOGLE_API_KEY,
            temperature=float(os.getenv("TEMPERATURE", "0.7")),
            convert_system_message_to_human=True,  # Gemini không có system role riêng
        )
    else:
        from langchain_openai import ChatOpenAI
        print(f"[LLM] Dùng LM Studio: {LOCAL_LLM_URL}")
        return ChatOpenAI(
            base_url=LOCAL_LLM_URL,
            api_key=LOCAL_LLM_KEY,
            temperature=float(os.getenv("TEMPERATURE", "0.7")),
        )


def get_vectorstore():
    """Khởi tạo kết nối tới Pinecone VectorDB với HuggingFace Embeddings."""
    embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    namespace  = os.getenv("PINECONE_NAMESPACE", "cbt")
    return PineconeVectorStore(
        index_name=PINECONE_INDEX_NAME,
        embedding=embeddings,
        pinecone_api_key=PINECONE_API_KEY,
        namespace=namespace,
        text_key="page_content"
    )