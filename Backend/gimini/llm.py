import os
from PIL import Image
import google.generativeai as genai

model = genai.GenerativeModel('gemini-1.5-flash-002')
 
# genai.configure(api_key=os.getenv('GOOGLE_API_KEY'))
 
genai.configure(api_key='AIzaSyC7PTgHyIW6zs0BTKooOMOcMjbMzojhFKA')
 
def extract_img(file_path):
    img= Image.open(file_path) 
    response = model.generate_content(["Summrize the flow from the flow diagram.", img], stream=True)
    response.resolve()
    ing_details = response.candidates[0].content.parts[0].text
    print(ing_details)
    return ing_details




