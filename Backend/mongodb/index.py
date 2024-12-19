from sentence_transformers import SentenceTransformer
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from pymongo import MongoClient
import os
from pymongo.operations import SearchIndexModel
import time





def get_collection(index_name):
    client = MongoClient("mongodb+srv://bd1:Papun$1996@cluster0.mehhr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0&readPreference=primary")
    collection = client["rag_db"][index_name]
    return collection

# Define a function to generate embeddings
def get_embedding(data, model):
    """Generates vector embeddings for the given data."""

    embedding = model.encode(data)
    return embedding.tolist()


def save_temp_file(files, folder_path):
    if not files:
        return "Got no file for processing"
    file_paths = []
    for file in files:
        # Save file to uploads folder
        file_path = os.path.join(folder_path, file.filename)
        try:
            file.save(file_path)
            file_paths.append(file_path)
        except Exception as e:
            return f"An error occurred while saving the file: {str(e)}"
    return file_paths

        

# file_path = "uploads/30-days-of-react-ebook-fullstackio.pdf"
def upload_file_to_mongo_db(file, save_file_path, index_name):
    file_path = save_temp_file(file, save_file_path)

    for path in file_path:
        if os.path.exists(path) and os.path.getsize(path) > 0:
            loader = PyPDFLoader(path)
            data = loader.load()
        else:
            raise FileNotFoundError(f"File {path} not found or is empty.")
    # Split the data into chunks
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=400, chunk_overlap=20)
    documents = text_splitter.split_documents(data)
    print(f"Number of documents: {documents}")
    # Prepare documents for insertion
    model = SentenceTransformer("nomic-ai/nomic-embed-text-v1", trust_remote_code=True)
    docs_to_insert = [{
        "text": doc.page_content,
        "embedding": get_embedding(doc.page_content, model),
        "page_number": doc.metadata["page"],
        "doc_name": doc.metadata["source"]
    } for doc in documents]


    # Connect to your Atlas cluster
    collection = get_collection(index_name)

    # Insert documents into the collection
    try:
        result = collection.insert_many(docs_to_insert)
        return result
    except Exception as e:
        return f"An error occurred while inserting documents: {str(e)}"
   


def indexing(index_name):
    collection = get_collection(index_name)
    search_index_model = SearchIndexModel(
    definition = {
        "fields": [
        {
            "type": "vector",
            "numDimensions": 768,
            "path": "embedding",
            "similarity": "cosine"
        }
        ]
    },
    name = index_name,
    type = "vectorSearch"
    )
    collection.create_search_index(model=search_index_model)
    print("Polling to check if the index is ready. This may take up to a minute.")
    predicate=None
    if predicate is None:
        predicate = lambda index: index.get("queryable") is True

    while True:
        indices = list(collection.list_search_indexes(index_name))
        if len(indices) and predicate(indices[0]):
            break
        time.sleep(5)
    print(index_name + " is ready for querying.")


def get_query_results(query, index_name, no_of_results= 5):
  """Gets results from a vector search query."""
  model = SentenceTransformer("nomic-ai/nomic-embed-text-v1", trust_remote_code=True)
  collection = get_collection(index_name)
  query_embedding = get_embedding(query, model)
  pipeline = [
      {
            "$vectorSearch": {
              "index": index_name,
              "queryVector": query_embedding,
              "path": "embedding",
              "exact": True,
              "limit": no_of_results
            }
      }, {
            "$project": {
              "_id": 0,
              "text": 1,
              "page_number": 1,
              "doc_name": 1
         }
      }
  ]
  results = collection.aggregate(pipeline)
  array_of_results = []
  for doc in results:
      array_of_results.append(doc)
  return array_of_results

# # Test the function with a sample query
# context_docs = get_query_results("OTP Verification is not required for UAN Linked Mobile Number")
# print(context_docs)
# print("==========>")
# context_string = " ".join([doc["text"] for doc in context_docs])
# print(context_string)

def list_indexes():
    collection = get_collection("any")
    indexes = collection.database.list_collection_names()
    print(indexes)
    # indexes = collection.list_indexes()
    return indexes



