from main.nlq import nlq
from helper.utils import convert_string_to_json, convert_to_json, add_query_to_json
from sql.index import  execute_query
from flask import Flask, request, jsonify
from gpt.analiticts import getAnalitics, call_gpt
from flask_cors import CORS
from vector_db.vector_db import delete_collection, upload_files, list_collections, search_data
from vector_db.fine_chunking import fine_chunking
import os

from gimini.llm import extract_img


if __name__ == "__main__":
    
    app = Flask(__name__)

    CORS(app)

    app.config['UPLOAD_FOLDER'] = 'vector_db/uploads'
    app.config['IMG_UPLOAD_FOLDER'] = 'gimini/uploads'
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs(app.config['IMG_UPLOAD_FOLDER'], exist_ok=True)

    @app.route('/query-mock', methods=['POST'])
    def query_mock():
        data = request.json
        user_question = data.get('question')
        if not user_question:
            return jsonify({"error": "No question provided"}), 400
        try:
            with open('data/mock/tabuler.json', 'r') as file:
                result_json = file.read()
                print("Mock Result:", result_json)
                return result_json
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route('/save-query', methods=['POST'])
    def save_query():
        data = request.json
        q_data = data.get('data')
        if not q_data:
            return jsonify({"error": "No question provided"}), 400
        try:
            add_query_to_json(q_data)
            return jsonify({
                "status": "success"
            })
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route('/query-list', methods=['GET'])
    def get_all_query():
        try:
            with open('query_storage/query.json', 'r') as file:
                result_json = file.read()
                print("Mock Result:", result_json)
                return result_json
        except Exception as e:
            return jsonify({"error": str(e)}), 500
        

    @app.route('/query', methods=['POST'])
    def query():
        data = request.json
        user_question = data.get('question')
        if not user_question:
            return jsonify({"error": "No question provided"}), 400

        try:
            print("User Question:", user_question)
            query = nlq(user_question)
            print("SQL Query:", query  )
            result = execute_query(query)

            result_json = convert_to_json(result)

            # analitics = getAnalitics(result_json)

            return jsonify({
                "result": result_json,
                "query": query
            })
        except Exception as e:
            return jsonify({"error": str(e)}), 500
        

    @app.route('/analitics', methods=['POST'])
    def analitics_data():
        data = request.json
        result_json = data.get('result_json')
        if not result_json:
            return jsonify({"error": "No data provided"}), 400

        try:
            analitics = getAnalitics(result_json)
            return jsonify({
                "analitics": analitics
            })
           
        except Exception as e:
            return jsonify({"error": str(e)}), 500
        

    @app.route('/analitics-mock', methods=['POST'])
    def analitics_data_mock():
        data = request.json
        result_json = data.get('result_json')
        if not result_json:
            return jsonify({"error": "No data provided"}), 400

        try:
            with open('data/mock/analitics.json', 'r') as file:
                result_json = file.read()
                print("Mock Result:", result_json)
                return result_json
        except Exception as e:
            return jsonify({"error": str(e)}), 500


    @app.route('/exicute-raw-query', methods=['POST'])
    def exicute_query():
        data = request.json
        user_sql_query = data.get('sql_query')
        if not user_sql_query:
            return jsonify({"error": "No question provided"}), 400

        try:
            print("User Question:", user_sql_query)
            
            result = execute_query(user_sql_query)

            result_json = convert_to_json(result)

            # analitics = getAnalitics(result_json)

            return jsonify({
                "result": result_json,
                "query": user_sql_query,
                # "analitics": analitics
            })
        except Exception as e:
            return jsonify({"error": str(e)}), 500


# ------------------------------------user story api --------------------------------------------

    @app.route('/call-gpt', methods=['POST'])
    def direct_gpt_call():
        data = request.json
        user_question = data.get('question')
        if not user_question:
            return jsonify({"error": "No question provided"}), 400
        try:
            result_json = call_gpt("You are an expert to generate user story requiremets", user_question, 1000)
            return result_json
        except Exception as e:
            return jsonify({"error": str(e)}), 500


# ------------------------------------file upload --------------------------------------------

# File upload endpoint
@app.route('/upload', methods=['POST'])
def upload_files_data():
    if 'files' not in request.files:
        return "No files provided", 400
    collection_name = request.form.get('collection_name')
    files = request.files.getlist('files')
    try:
        upload_files(collection_name, files, app.config['UPLOAD_FOLDER'])
        return jsonify({"message": f"{len(files)} files uploaded and indexed successfully."}), 200 
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# Search endpoint
@app.route('/search', methods=['POST'])
def search_file_data():
    data = request.get_json()
    query = data.get('query')
    no_of_results = data.get('no_of_results')
    collection_name = data.get('collection_name')
    if_fine_chunking = data.get('fine_chunking')
    if_gpt_summarize = data.get('if_gpt_summarize')
    if not query:
        return jsonify({"error": "No query provided"}), 400       
    if not collection_name:
        return jsonify({"error": "No collection_name provided"}), 400       
    results = search_data(query, collection_name,no_of_results)

    response_result = {"results": results}
  
    ### file chunking ######
    if if_fine_chunking:
        fine_results = fine_chunking(results['documents'],query, 100)
        response_result["fine_results"] = fine_results
       
    if if_gpt_summarize:
        gpt_results = call_gpt("You are an expert summrizer", f"find and list all the key points: \n{results['documents']}", 1000)
        response_result["gpt_results"] = gpt_results
        
    return jsonify(response_result), 200


# Search endpoint
@app.route('/collection', methods=['GET'])
def get_all_collection():
    dlist_collections = list_collections()
    return jsonify({"collections": dlist_collections}), 200


# Search endpoint
@app.route('/collection', methods=['DELETE'])
def delete_collection():
    data = request.get_json()
    collection_name = data.get('collection_name')
    result = delete_collection(collection_name)
    return jsonify({"collections": result}), 200



@app.route('/extract-img', methods=['POST'])
def extract_img_api():
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    file = request.files['file']
    file_path = os.path.join(app.config['IMG_UPLOAD_FOLDER'], file.filename)
    file.save(file_path)
    try:
        img_details = extract_img(file_path)
        return jsonify({"details": img_details}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
        app.run(debug=True)