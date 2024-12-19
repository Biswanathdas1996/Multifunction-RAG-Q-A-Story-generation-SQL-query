from sentence_transformers import SentenceTransformer

# Load the embedding model (https://huggingface.co/nomic-ai/nomic-embed-text-v1")
model = SentenceTransformer("nomic-ai/nomic-embed-text-v1", trust_remote_code=True)
    
# Define a function to generate embeddings
def get_embedding(data):
    """Generates vector embeddings for the given data."""

    embedding = model.encode(data)
    return embedding.tolist()



from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter

# Load the PDF
import os

file_path = "uploads/30-days-of-react-ebook-fullstackio.pdf"
if os.path.exists(file_path) and os.path.getsize(file_path) > 0:
    loader = PyPDFLoader(file_path)
    data = loader.load()
else:
    raise FileNotFoundError(f"File {file_path} not found or is empty.")

# Split the data into chunks
text_splitter = RecursiveCharacterTextSplitter(chunk_size=400, chunk_overlap=20)
documents = text_splitter.split_documents(data)

print(f"Number of documents: {documents}")



# Prepare documents for insertion
docs_to_insert = [{
    "text": doc.page_content,
    "embedding": get_embedding(doc.page_content),
    "page_number": doc.metadata["page"],
    "doc_name": doc.metadata["source"]
} for doc in documents]


from pymongo import MongoClient

# Connect to your Atlas cluster
client = MongoClient("mongodb+srv://bd1:Papun$1996@cluster0.mehhr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0&readPreference=primary")
collection = client["rag_db"]["IDFC_JIRA_DATA"]

# Insert documents into the collection
result = collection.insert_many(docs_to_insert)