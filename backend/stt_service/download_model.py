import os
import urllib.request
import zipfile

MODEL_URL = "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip"
ZIP_PATH = "vosk-model.zip"
MODEL_DIR = "model"

def download_and_extract():
    if os.path.exists(MODEL_DIR):
        print(f"Model directory '{MODEL_DIR}' already exists. Skipping download.")
        return

    print(f"Downloading model from {MODEL_URL}...")
    urllib.request.urlretrieve(MODEL_URL, ZIP_PATH)
    print("Download complete.")

    print(f"Extracting '{ZIP_PATH}'...")
    with zipfile.ZipFile(ZIP_PATH, 'r') as zip_ref:
        zip_ref.extractall(".")
    
    # The zip usually contains a folder named 'vosk-model-small-en-us-0.15'
    # Let's rename it to 'model' for simplicity.
    extracted_folder = "vosk-model-small-en-us-0.15"
    if os.path.exists(extracted_folder):
        os.rename(extracted_folder, MODEL_DIR)
        print(f"Renamed '{extracted_folder}' to '{MODEL_DIR}'.")
    else:
        print("Warning: Expected extracted folder not found.")
        
    if os.path.exists(ZIP_PATH):
        os.remove(ZIP_PATH)
        print("Cleaned up zip file.")

if __name__ == "__main__":
    download_and_extract()
