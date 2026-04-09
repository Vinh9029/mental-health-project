try:
    from langchain.retrievers.contextual_compression import ContextualCompressionRetriever
except ImportError:
    ContextualCompressionRetriever = None

try:
    from langchain_community.document_compressors import CrossEncoderReranker
except ImportError:
    CrossEncoderReranker = None

from langchain_community.cross_encoders import HuggingFaceCrossEncoder
from langchain_pinecone import PineconeVectorStore

class AdvancedRetriever:
    """Chịu trách nhiệm tìm kiếm Vector và tinh chỉnh hạng (Rerank) trên Pinecone.
    
    Dimensions:
    - Embedding: 384 dims (all-MiniLM-L6-v2) - matches Pinecone index
    - Cross-Encoder: Local HuggingFace model
    """
    def __init__(self, vectorstore, model_name: str, search_k: int = 10, top_n: int = 3):
        self.vectorstore = vectorstore
        self.search_k = search_k
        self.top_n = top_n
        self.model_name = model_name

    def get_retriever(self):
        """
        Get retriever with compression if available, otherwise return base retriever.
        Falls back gracefully if ContextualCompressionRetriever not available.
        """
        base_retriever = self.vectorstore.as_retriever(search_kwargs={"k": self.search_k})
        
        # Try to use compression retriever if available
        if ContextualCompressionRetriever and CrossEncoderReranker:
            try:
                model = HuggingFaceCrossEncoder(model_name=self.model_name)
                compressor = CrossEncoderReranker(model=model, top_n=self.top_n)
                return ContextualCompressionRetriever(
                    base_compressor=compressor,
                    base_retriever=base_retriever
                )
            except Exception as e:
                print(f"⚠️ Compression retriever failed: {e}. Using base retriever.")
                return base_retriever
        
        # Fallback to base retriever
        return base_retriever