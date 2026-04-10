import os
import sys
from dotenv import load_dotenv

# Đảm bảo đường dẫn module hợp lệ nếu chạy trực tiếp
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(BASE_DIR))))

# Cần load_dotenv trước khi import do các file config sử dụng os.getenv
env_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path=env_path, override=True)

from src.app_config import get_llm, get_vectorstore, CROSS_ENCODER_MODEL
from src.retrieval import AdvancedRetriever
from src.generation import ResponseGenerator

def run_test():
    print("="*50)
    print("🚀 Bắt đầu test RAG LLM trực tiếp (Bypass API)")
    print("="*50)

    # 1. Khởi tạo LLM (Gọi đến LM Studio ở localhost)
    print("\n[1] Đang khởi tạo kết nối LLM (Local LLM qua LM Studio)...")
    try:
        llm = get_llm()
        print("✅ Khởi tạo LLM thành công.")
    except Exception as e:
        print(f"❌ Lỗi khi khởi tạo LLM: {e}")
        return

    # 2. Khởi tạo VectorStore ( Pinecone với 384-dimension HuggingFaceEmbeddings)
    print("\n[2] Đang kết nối Pinecone (Vector Database - 384 dims)...")
    try:
        vectorstore = get_vectorstore()
        print("✅ Kết nối Pinecone thành công.")
    except Exception as e:
        print(f"❌ Lỗi khi kết nối Pinecone: {e}")
        return

    # 3. Cấu hình tính năng Retrieval với Rerank (Cross-Encoder)
    print("\n[3] Thiết lập công cụ Retrieval (Reranking)...")
    try:
        advanced_retriever = AdvancedRetriever(
            vectorstore=vectorstore, 
            model_name=CROSS_ENCODER_MODEL, 
            search_k=5, 
            top_n=3
        )
        retriever = advanced_retriever.get_retriever()
        print("✅ Thiết lập Retriever thành công.")
    except Exception as e:
        print(f"❌ Lỗi khi tải Retriever: {e}")
        return

    # 4. Khởi tạo Response Generator để sinh câu trả lời
    print("\n[4] Khởi tạo Response Generator...")
    generator = ResponseGenerator(llm=llm)

    # Dữ liệu Test Mẫu
    test_query = "Dạo này tôi cảm thấy rất áp lực và thường xuyên thiếu ngủ, tôi nên làm gì?"
    test_baseline_sev = "Moderate"
    test_baseline_issue = "Anxiety"
    test_realtime_status = "Stress"

    print("="*50)
    print(f"👤 USER QUERY: {test_query}")
    print(f"📊 NGỮ CẢNH: Baseline: {test_baseline_sev} - {test_baseline_issue} | Real-time (BERT): {test_realtime_status}")
    print("="*50)

    try:
        # Bước A: Translate & Expand Keyword 
        print("\n⚙️ BƯỚC A: LLM đang xử lý keyword (Yêu cầu đầu tiên tới LM Studio)...")
        translated, expanded_query = generator.translate_and_expand_query(test_query)
        print(f"  → Bản dịch (để nhúng vector): {translated}")
        print(f"  → Mở rộng Keywords: {expanded_query}")

        # Bước B: Generate Response kết hợp RAG & Context
        print("\n⚙️ BƯỚC B: RAG Retrieval & LLM Generation (Yêu cầu thứ hai tới LM Studio)...")
        print(" (Vui lòng đợi vài giây, kiểm tra trong app LM Studio (tab Server) xem log sinh token nhé!)\n")
        
        response = generator.generate_response(
            user_query=test_query,
            expanded_query=expanded_query,
            retriever=retriever,
            baseline_severity=test_baseline_sev,
            baseline_issue=test_baseline_issue,
            realtime_status=test_realtime_status,
            is_vietnamese=True
        )

        print("🤖 MINDCARE AI PHẢN HỒI:")
        print("-"*50)
        print(response)
        print("-"*50)

    except Exception as e:
        print(f"\n❌ Lỗi khi sinh câu trả lời: {e}")
        print("=> Hãy kiểm tra xem: ")
        print(" 1) LM Studio đã bật Server (Start Server) ở cổng 1234 chưa?")
        print(" 2) Model LLM đã được Load thành công vào RAM/VRAM trong app LM Studio chưa?")

if __name__ == "__main__":
    run_test()
