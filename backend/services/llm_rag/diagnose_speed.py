"""
🔍 DIAGNOSE SPEED SCRIPT
Đo thời gian chính xác từng bước trong RAG pipeline để xác định bottleneck.
"""
import os
import sys
import time

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)
env_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path=env_path, override=True)

def measure(label, fn):
    print(f"\n⏱️  [{label}] Bắt đầu...")
    t0 = time.time()
    result = fn()
    elapsed = time.time() - t0
    status = "🐢 CHẬM" if elapsed > 5 else ("⚡ NHANH" if elapsed < 1 else "✅ ỔN")
    print(f"   → Hoàn thành trong: {elapsed:.2f}s  {status}")
    return result

print("=" * 60)
print("🔍 MINDBLOOM RAG SPEED DIAGNOSTIC")
print("=" * 60)

# ─── BƯỚC 1: Kiểm tra LM Studio đang chạy GPU hay CPU ────────────────────────
print("\n📡 BƯỚC 1: Kiểm tra kết nối + trạng thái GPU trên LM Studio")
try:
    import requests
    t0 = time.time()
    r = requests.get("http://localhost:1234/v1/models", timeout=5)
    ping = time.time() - t0
    if r.status_code == 200:
        models = r.json().get("data", [])
        print(f"   ✅ LM Studio đang chạy. Ping: {ping*1000:.0f}ms")
        print(f"   📦 Các model hiện có:")
        for m in models:
            print(f"      - {m['id']}")
    else:
        print(f"   ❌ LM Studio trả lỗi: {r.status_code}")
except Exception as e:
    print(f"   ❌ Không kết nối được LM Studio: {e}")
    print("   → Hãy mở LM Studio và bật 'Start Server' trước khi chạy script này!")
    sys.exit(1)

# ─── BƯỚC 2: Đo thời gian load Embedding Model ───────────────────────────────
print("\n📡 BƯỚC 2: Load HuggingFace Embedding Model (all-MiniLM-L6-v2)")
try:
    from langchain_huggingface import HuggingFaceEmbeddings
    embeddings = measure("Load Embedding Model", lambda: HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2"))
    
    # Thử nhúng 1 câu để đo tốc độ
    test_vec = measure("Embed 1 câu test", lambda: embeddings.embed_query("hello world"))
    print(f"   → Dimension vector: {len(test_vec)}")
except Exception as e:
    print(f"   ❌ Lỗi Embedding: {e}")

# ─── BƯỚC 3: Kết nối Pinecone ─────────────────────────────────────────────────
print("\n📡 BƯỚC 3: Kết nối Pinecone VectorDB")
try:
    from langchain_pinecone import PineconeVectorStore
    index_name = os.getenv("PINECONE_INDEX_NAME", "mental-health-cbt")
    api_key = os.getenv("PINECONE_API_KEY")
    namespace = os.getenv("PINECONE_NAMESPACE", "cbt")
    vectorstore = measure(f"Connect Pinecone [{index_name} | {namespace}]", lambda: PineconeVectorStore(
        index_name=index_name, embedding=embeddings, pinecone_api_key=api_key, namespace=namespace, text_key="page_content"
    ))
    
    # Thử search 1 câu để đo thời gian round-trip thực tế
    docs = measure("Pinecone Similarity Search (k=5)", lambda: vectorstore.similarity_search("sleep anxiety stress", k=5))
    print(f"   → Số doc trả về: {len(docs)}")
    if docs:
        print(f"   → Preview doc[0]: {docs[0].page_content[:80]}...")
except Exception as e:
    print(f"   ❌ Lỗi Pinecone: {e}")
    vectorstore = None

# ─── BƯỚC 4: Đo Cross-Encoder Reranker ───────────────────────────────────────
print("\n📡 BƯỚC 4: Load Cấu hình Advanced Retriever (từ src.retrieval)")
try:
    from src.retrieval import AdvancedRetriever
    model_name = os.getenv("CROSS_ENCODER_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2")
    
    if vectorstore is not None:
        adv_retriever = measure("Initialize AdvancedRetriever", lambda: AdvancedRetriever(
            vectorstore=vectorstore, model_name=model_name, search_k=5, top_n=3
        ))
        retriever = adv_retriever.get_retriever()
        
        reranked = measure("Rerank search (Full pipeline)", 
                           lambda: retriever.invoke("sleep anxiety stress pressure"))
        print(f"   → Số doc sau rerank: {len(reranked)}")
        if reranked:
            print(f"   → Top 1 Doc Score: (Có thể xem logs phía sau)")
except Exception as e:
    print(f"   ❌ Lỗi Retriever: {e}")
    retriever = None

# ─── BƯỚC 5: LLM Call #1 - Translate + Expand ────────────────────────────────

print("\n📡 BƯỚC 5: LLM Call #1 — Translate & Expand Query")
try:
    from langchain_openai import ChatOpenAI
    from langchain_core.prompts import PromptTemplate
    from langchain_core.output_parsers import StrOutputParser

    llm_url = os.getenv("LOCAL_LLM_URL", "http://localhost:1234/v1")
    llm_key = os.getenv("LOCAL_LLM_KEY", "lm-studio")
    llm = ChatOpenAI(base_url=llm_url, api_key=llm_key, temperature=0.7)

    test_vi = "Dạo này tôi cảm thấy rất áp lực và thường xuyên thiếu ngủ, tôi nên làm gì?"
    prompt = PromptTemplate.from_template(
        'Translate Vietnamese to English and add mental health keywords.\n'
        'Return ONLY: "TRANSLATION: [english text] | KEYWORDS: [comma-separated keywords]"\n\n'
        'Vietnamese query:\n{query}'
    )
    chain = prompt | llm | StrOutputParser()
    result1 = measure("LLM Call #1 (Translate+Keywords)", lambda: chain.invoke({"query": test_vi}))
    print(f"   → Kết quả: {result1[:120]}...")
except Exception as e:
    print(f"   ❌ Lỗi LLM Call #1: {e}")
    result1 = test_vi

# ─── BƯỚC 6: LLM Call #2 - Generate Response ─────────────────────────────────
print("\n📡 BƯỚC 6: LLM Call #2 — Generate Full RAG Response")
try:
    from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
    context_text = "\n\n".join([d.page_content for d in (reranked if retriever else docs[:3])])
    
    system_prompt = """Bạn là MindCare AI — trợ lý hỗ trợ sức khỏe tâm thần.
Baseline: Moderate Anxiety. Cảm xúc hiện tại: Stress.
Context: {context}"""
    
    prompt2 = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "{query}")
    ])
    chain2 = prompt2 | llm | StrOutputParser()
    
    response = measure("LLM Call #2 (Generate Response)", lambda: chain2.invoke({
        "context": context_text[:2000],  # giới hạn để không làm chậm test
        "query": test_vi
    }))
    print(f"   → Response length: {len(response)} chars")
    print(f"   → Preview: {response[:150]}...")
except Exception as e:
    print(f"   ❌ Lỗi LLM Call #2: {e}")

# ─── TỔNG KẾT ─────────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("📊 TỔNG KẾT CHẨN ĐOÁN")
print("=" * 60)
print("""
Hướng dẫn đọc kết quả:
  ⚡ < 1s  → Rất nhanh, không cần tối ưu
  ✅ 1-5s  → Bình thường, chấp nhận được
  🐢 > 5s  → ĐÂY LÀ BOTTLENECK, cần tối ưu

Nếu LLM Call #1 hoặc #2 chậm > 10s:
  → LM Studio đang chạy trên CPU (chưa offload GPU hoàn toàn)
  → Giải pháp: Mở LM Studio → Load tab → kéo GPU Offload lên Max

Nếu Load Model (Bước 3,4) chậm hơn mọi thứ khác:
  → Lần đầu bao giờ cũng chậm hơn (phải tải weights từ disk)
  → Lần chạy thứ 2 sẽ được cache lại và nhanh hơn rất nhiều
""")
