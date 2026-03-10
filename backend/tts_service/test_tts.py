import requests

API_URL = "http://localhost:8001/generate-speech"
AUTH_TOKEN = "Bearer bridge-dev-token-123"

def test_tts():
    print("Testing TTS API...")
    payload = {
        "text": "Hello, this is tejus davis .",
        "language": "en",
        "speed": 1.0
    }
    headers = {
        "Authorization": AUTH_TOKEN,
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(API_URL, json=payload, headers=headers)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("Response Data:", data)
            audio_url = data.get("audio_url")
            print(f"\nSuccess! Audio available at: {audio_url}")
        else:
            print("Failed Response Data:", response.text)
            
    except Exception as e:
        print(f"Error connecting to server: {e}")

if __name__ == "__main__":
    test_tts()
