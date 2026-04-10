try:
    from langchain.retrievers.contextual_compression import ContextualCompressionRetriever
except ImportError:
    ContextualCompressionRetriever = None

# Try multiple import paths for CrossEncoderReranker (varies by langchain-community version)
CrossEncoderReranker = None
try:
    # langchain-community >= 0.2.x
    from langchain_community.cross_encoders.huggingface import HuggingFaceCrossEncoder as _CE
    from langchain.retrievers.document_compressors import CrossEncoderReranker
except ImportError:
    pass

if CrossEncoderReranker is None:
    try:
        # Fallback for older versions
        from langchain_community.document_compressors import CrossEncoderReranker
    except ImportError:
        pass

if CrossEncoderReranker is None:
    try:
        # Manual implementation as last resort
        from langchain_core.documents import Document
        from langchain_core.documents.compressor import BaseDocumentCompressor
        from langchain_community.cross_encoders import HuggingFaceCrossEncoder as _HF
        from typing import Optional, Sequence
        from langchain_core.callbacks import Callbacks

        class CrossEncoderReranker(BaseDocumentCompressor):
            """Minimal CrossEncoder Reranker implementation."""
            model: _HF
            top_n: int = 3

            class Config:
                arbitrary_types_allowed = True

            def compress_documents(self, documents: Sequence[Document], query: str,
                                   callbacks: Optional[Callbacks] = None) -> Sequence[Document]:
                scores = self.model.score([(query, doc.page_content) for doc in documents])
                scored = sorted(zip(scores, documents), key=lambda x: x[0], reverse=True)
                return [doc for _, doc in scored[:self.top_n]]
    except Exception as e:
        print(f"Warning: CrossEncoderReranker unavailable: {e}")

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