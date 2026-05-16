import os
import sys
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_pinecone import PineconeVectorStore
from pinecone import Pinecone

# Setup paths and environment
# This file is in backend/services/llm_rag/external_data
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Root of llm_rag is one level up
ROOT_DIR = os.path.dirname(BASE_DIR)
# backend root is two levels up from this file
BACKEND_DIR = os.path.dirname(ROOT_DIR)

sys.path.append(BACKEND_DIR)

# Load environment variables from backend/services/llm_rag/.env
load_dotenv(os.path.join(ROOT_DIR, '.env'), override=True)

# Configuration from .env
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", 1000))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", 200))
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX", "mental-health-cbt")
PINECONE_NAMESPACE = os.getenv("PINECONE_NAMESPACE", "cbt")

def embed_pdfs():
    """
    Loads PDFs from the external_data folder, chunks them, 
    and uploads embeddings to Pinecone.
    """
    print(f"--- Pinecone Embedding Script ---")
    print(f"Chunk Size: {CHUNK_SIZE}, Overlap: {CHUNK_OVERLAP}")
    
    # 1. Initialize Embeddings (matching the app's configuration)
    print("Initializing HuggingFace embeddings (all-MiniLM-L6-v2)...")
    embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

    # 2. Load and Split Documents
    all_docs = []
    pdf_files = [f for f in os.listdir(BASE_DIR) if f.endswith('.pdf')]
    
    if not pdf_files:
        print("No PDF files found in external_data directory.")
        return

    print(f"Found {len(pdf_files)} PDF files: {pdf_files}")

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP
    )

    for pdf_file in pdf_files:
        file_path = os.path.join(BASE_DIR, pdf_file)
        print(f"Processing {pdf_file}...")
        try:
            loader = PyPDFLoader(file_path)
            docs = loader.load()
            
            # Add metadata about source to each document
            for doc in docs:
                doc.metadata["source"] = pdf_file
            
            split_docs = text_splitter.split_documents(docs)
            all_docs.extend(split_docs)
            print(f"   - Split into {len(split_docs)} chunks.")
        except Exception as e:
            print(f"   - Error loading {pdf_file}: {e}")

    if not all_docs:
        print("No documents were successfully loaded and split.")
        return

    print(f"---")
    print(f"Total chunks to embed: {len(all_docs)}")

    # 3. Upload to Pinecone
    print(f"Uploading to Pinecone index '{PINECONE_INDEX_NAME}'...")
    print(f"Namespace: '{PINECONE_NAMESPACE}'")
    
    try:
        # Initialize Pinecone client to check index existence
        pc = Pinecone(api_key=PINECONE_API_KEY)
        existing_indexes = [idx.name for idx in pc.list_indexes()]
        
        if PINECONE_INDEX_NAME not in existing_indexes:
             print(f"Index '{PINECONE_INDEX_NAME}' does not exist.")
             print(f"Available indexes: {existing_indexes}")
             print("Please create the index first with dimension 384.")
             return

        # Upload using Langchain's PineconeVectorStore
        vectorstore = PineconeVectorStore.from_documents(
            all_docs,
            embeddings,
            index_name=PINECONE_INDEX_NAME,
            pinecone_api_key=PINECONE_API_KEY,
            namespace=PINECONE_NAMESPACE
        )
        print("Successfully uploaded all documents to Pinecone!")
        
    except Exception as e:
        print(f"Error during Pinecone upload: {e}")

if __name__ == "__main__":
    embed_pdfs()
