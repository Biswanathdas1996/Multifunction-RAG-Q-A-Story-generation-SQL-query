from pymongo.operations import SearchIndexModel
import time
from pymongo import MongoClient

# Connect to your Atlas cluster
client = MongoClient("mongodb+srv://bd1:Papun$1996@cluster0.mehhr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0&readPreference=primary")
collection = client["rag_db"]["IDFC_JIRA_DATA"]

# Create your index model, then create the search index
index_name="IDFC_JIRA_DATA"

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

# Wait for initial sync to complete
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