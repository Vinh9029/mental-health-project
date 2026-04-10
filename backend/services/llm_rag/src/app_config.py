import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_pinecone import PineconeVectorStore
from langchain_huggingface import HuggingFaceEmbeddings

# Load biến môi trường từ file .env
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
load_dotenv(dotenv_path=env_path, override=True)

# Các cấu hình cho Local LLM (VD: dùng LM Studio thì base_url thường là http://localhost:1234/v1)
LOCAL_LLM_URL = os.getenv("LOCAL_LLM_URL", "http://localhost:1234/v1")
LOCAL_LLM_KEY = os.getenv("LOCAL_LLM_KEY", "lm-studio")

# Cấu hình Pinecone
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "mental-health-cbt")

# Cross-Encoder cho Reranking
CROSS_ENCODER_MODEL = os.getenv("CROSS_ENCODER_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2")

def get_llm():
    """Khởi tạo Local LLM (Sử dụng interface của OpenAI trỏ về localhost)"""
    return ChatOpenAI(base_url=LOCAL_LLM_URL, api_key=LOCAL_LLM_KEY, temperature=0.7)

def get_vectorstore():
    """Khởi tạo kết nối tới Pinecone VectorDB với model Embedding chuẩn"""
    embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    namespace = os.getenv("PINECONE_NAMESPACE", "cbt")
    return PineconeVectorStore(
        index_name=PINECONE_INDEX_NAME, 
        embedding=embeddings, 
        pinecone_api_key=PINECONE_API_KEY,
        namespace=namespace,
        text_key="page_content"
    )