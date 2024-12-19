from pymongo import MongoClient
import pprint
from sentence_transformers import SentenceTransformer
# Load the embedding model (https://huggingface.co/nomic-ai/nomic-embed-text-v1")
model = SentenceTransformer("nomic-ai/nomic-embed-text-v1", trust_remote_code=True)
    
# Define a function to generate embeddings
def get_embedding(data):
    """Generates vector embeddings for the given data."""
    embedding = model.encode(data)
    return embedding.tolist()


# Connect to your Atlas cluster
client = MongoClient("mongodb+srv://bd1:Papun$1996@cluster0.mehhr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0&readPreference=primary")
collection = client["rag_db"]["IDFC_JIRA_DATA"]

# Define a function to run vector search queries
def get_query_results(query):
  """Gets results from a vector search query."""

  query_embedding = get_embedding(query)
  pipeline = [
      {
            "$vectorSearch": {
              "index": "IDFC_JIRA_DATA",
              "queryVector": query_embedding,
              "path": "embedding",
              "exact": True,
              "limit": 5
            }
      }, {
            "$project": {
              "_id": 0,
              "text": 1,
              "page_number": 1
         }
      }
  ]

  results = collection.aggregate(pipeline)



  array_of_results = []
  for doc in results:
      array_of_results.append(doc)
  return array_of_results

# Test the function with a sample query
context_docs = get_query_results("OTP Verification is not required for UAN Linked Mobile Number")

print(context_docs)
print("==========>")
context_string = " ".join([doc["text"] for doc in context_docs])

print(context_string)