import os
import sys
from dotenv import load_dotenv
from pinecone import Pinecone

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)
env_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path=env_path, override=True)

pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
index = pc.Index(os.getenv("PINECONE_INDEX_NAME", "mental-health-cbt"))

print("Fetching metadata sample from index...")
stats = index.describe_index_stats()
print(stats)

# Fetch from whatever namespace is present
namespaces = list(stats['namespaces'].keys())
if namespaces:
    ns = namespaces[0]
    print(f"Fetching sample from namespace: {ns}")
    res = index.query(namespace=ns, vector=[0.1] * 384, top_k=1, include_metadata=True)
    if res.matches:
        metadata = res.matches[0].metadata
        print("Data found! Metadata keys:", list(metadata.keys()))
        for k, v in metadata.items():
            print(f"   - {k}: {str(v)[:50]}")
else:
    print("No namespaces found with data.")

