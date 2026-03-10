import requests
import os

TTS_API_URL = "http://localhost:8001/generate-speech"
STT_API_URL = "http://localhost:8002/speech-to-text"
AUTH_TOKEN = "Bearer bridge-dev-token-123"

def test_stt():
    print("--- Step 1: Generating Audio from TTS ---")
    headers = {
        "Authorization": AUTH_TOKEN,
        "Content-Type": "application/json"
    }
    tts_payload = {
        "text": "Hello, this is the Bridge team Speech to Text translation test.",
        "language": "en"
    }

    test_audio_path = "test_audio.mp3"

    try:
        # Ask TTS to generate Audio
        tts_response = requests.post(TTS_API_URL, json=tts_payload, headers=headers)
        if tts_response.status_code != 200:
            print("Failed to reach TTS:", tts_response.text)
            return
            
        audio_url = tts_response.json().get("audio_url")
        print(f"Obtained Audio URL: {audio_url}")
        
        # Download the audio file to disk
        audio_content = requests.get(audio_url).content
        with open(test_audio_path, "wb") as f:
            f.write(audio_content)
        print(f"Saved generated audio to: {test_audio_path}")

    except Exception as e:
        print(f"Error connecting to TTS server: {e}")
        return

    print("\n--- Step 2: Transcribing Audio with STT ---")
    
    stt_headers = {
        "Authorization": AUTH_TOKEN
    }

    try:
        with open(test_audio_path, "rb") as f:
            files = {"audio": (test_audio_path, f, "audio/mpeg")}
            data = {"language": "en"}
            
            print("Sending audio to STT API...")
            response = requests.post(STT_API_URL, headers=stt_headers, data=data, files=files)
            
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            res_data = response.json()
            print("\nTranscription Result:")
            print(f" - Text: {res_data.get('transcribed_text')}")
            print(f" - Confidence: {res_data.get('confidence')}")
        else:
            print("Failed Response Data:", response.text)
            
    except Exception as e:
        print(f"Error connecting to STT server: {e}")

    finally:
        if os.path.exists(test_audio_path):
            os.remove(test_audio_path)

if __name__ == "__main__":
    test_stt()
